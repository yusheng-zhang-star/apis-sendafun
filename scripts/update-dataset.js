/**
 * update-dataset.js
 *
 * 每日数据集同步脚本。
 * 拉取 public-apis 上游 README.md，解析出结构化 API 目录，
 * 输出为 public/data/apis.json，供前端 SPA 渲染。
 *
 * 数据源: https://github.com/public-apis/public-apis (MIT License)
 *
 * 用法:
 *   node scripts/update-dataset.js
 *   node scripts/update-dataset.js --local ./upstream-readme.md
 *     （从本地文件解析，跳过网络拉取，便于离线/本地生成）
 *
 * 边界处理:
 *   - 拉取失败 / 网络异常 => 打印错误并以非零码退出（保留旧数据，不破坏线上站点）
 *   - 解析结果为空 => 视为失败，保留旧数据
 *   - 仅当内容有实际变更时才允许提交（由 GitHub Actions 判断 git diff）
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_FILE = resolve(ROOT, 'public/data/apis.json');

// --local <path>：从本地文件解析（跳过网络）
const localIdx = process.argv.indexOf('--local');
const LOCAL_README = localIdx > -1 ? process.argv[localIdx + 1] : null;

const UPSTREAM_URL =
  'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md';

const USER_AGENT = 'apis-sendafun-dataset-sync/1.0';

/** 尝试拉取上游 README，最多重试 3 次，每次退避 5s */
async function fetchUpstream() {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(UPSTREAM_URL, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      if (!text || text.length < 10_000) {
        throw new Error(`上游内容异常，长度 ${text ? text.length : 0}`);
      }
      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`[warn] 第 ${attempt} 次拉取失败: ${err.message}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
  throw lastErr;
}

/** 解析 markdown 表格行: | [Name](URL) | Description | Auth | HTTPS | CORS | */
const ROW_RE =
  /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*(Yes|No)\s*\|\s*(Yes|No|Unknown)\s*\|\s*$/;

function cleanCell(value) {
  // 去除反引号、HTML 标签、多余空白
  return (value || '')
    .replace(/`/g, '')
    .replace(/<\/?[a-z]+>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 从 README markdown 解析出 API 目录。
 * 分类以 `### Category` 三级标题界定；遇到 `## License` 停止。
 */
function parseReadme(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  let category = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '## License') break;

    if (line.startsWith('### ')) {
      category = line.slice(4).trim();
      continue;
    }

    if (!category || !line.startsWith('|')) continue;

    const m = line.match(ROW_RE);
    if (!m) continue;

    const [, name, link, description, auth, https, cors] = m;
    const cleanName = cleanCell(name);
    const cleanDesc = cleanCell(description);
    const rawAuth = cleanCell(auth);
    const cleanAuth = rawAuth.toLowerCase() === 'no' ? '' : rawAuth;
    const cleanLink = link.trim();

    if (!cleanName || !cleanLink) continue;

    entries.push({
      name: cleanName,
      description: cleanDesc,
      auth: cleanAuth,
      https: https === 'Yes',
      cors: cors === 'Yes' ? 'yes' : cors === 'No' ? 'no' : 'unknown',
      link: cleanLink,
      category,
    });
  }

  return entries;
}

async function main() {
  const start = Date.now();
  console.log('[info] 开始同步 public-apis 数据集...');

  try {
    const markdown = LOCAL_README
      ? await readFile(resolve(ROOT, LOCAL_README), 'utf8')
      : await fetchUpstream();
    const entries = parseReadme(markdown);

    if (!entries.length) {
      console.error('[error] 解析结果为空，中止本次更新，保留旧数据。');
      process.exit(1);
    }

    const categories = [...new Set(entries.map((e) => e.category))].sort();

    const payload = {
      meta: {
        source: 'https://github.com/public-apis/public-apis',
        license: 'MIT',
        updatedAt: new Date().toISOString(),
        count: entries.length,
        categories: categories.length,
      },
      categories,
      apis: entries,
    };

    await writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');

    const sizeKB = (await readFile(OUT_FILE)).length / 1024;
    console.log(
      `[ok] 数据集已写入: ${OUT_FILE} (${entries.length} APIs, ${categories.length} 分类, ${sizeKB.toFixed(1)} KB, 耗时 ${Date.now() - start}ms)`
    );
  } catch (err) {
    console.error(`[error] 同步失败: ${err.message}`);
    console.error('[error] 已跳过本次更新，保留旧数据，线上站点不受影响。');
    process.exit(1);
  }
}

await main();
