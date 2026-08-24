/**
 * update-dataset.js — 多源聚合 + 每日全量健康检查
 *
 * 功能：
 *   1) 从多个公开源拉取免费 API 目录，按 URL 去重合并；
 *      - source A: public-apis/public-apis        (含 Auth/HTTPS/CORS，作为基础源)
 *      - source B: public-api-lists/public-api-lists  (多源合并的大型列表，作为补充)
 *      - source C: cheeaun/awesome-apis           (精选资源，作为补充)
 *   2) 对合并后的每个 API 做一次健康检查（GET，5s 超时），
 *      记录 status / statusCode / timeMs / checkedAt 到 apis.json；
 *   3) 写入 public/data/apis.json，供前端渲染（含健康状态展示）。
 *
 * 安全/健壮性：
 *   - 任一源拉取失败只跳过该源，只要至少一个源成功且有数据就继续；
 *   - 健康检查为尽力而为，单项失败标记为 down，不影响整体；
 *   - 内容未变化时保留旧 updatedAt + 旧健康数据（不写 diff 触发无谓提交）。
 *
 * 用法：
 *   node update-dataset.js             # 全量联网（拉源 + 健康检查）
 *   node update-dataset.js --no-health # 只聚合，跳过健康检查
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = resolve(__dirname, '..', 'public/data/apis.json');

const noHealth = process.argv.includes('--no-health');

const UA = 'apis-sendafun-dataset-sync/1.0';
const HEALTH_TIMEOUT_MS = 5000;
const HEALTH_CONCURRENCY = 24;

/** 数据源定义 */
const SOURCES = [
  {
    id: 'public-apis',
    name: 'public-apis/public-apis',
    url: 'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md',
    parser: 'table-strict',
  },
  {
    id: 'public-api-lists',
    name: 'public-api-lists/public-api-lists',
    url: 'https://raw.githubusercontent.com/public-api-lists/public-api-lists/master/README.md',
    parser: 'table-links',
  },
  {
    id: 'apis-guru',
    name: 'APIs.guru OpenAPI Directory',
    url: 'https://api.apis.guru/v2/list.json',
    parser: 'apis-guru',
  },
];

/* ---------- 工具 ---------- */
function clean(s) {
  return String(s || '')
    .replace(/`/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function validHttpUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== 'http:' && x.protocol !== 'https:') return false;
    if (!x.hostname) return false;
    return /^[a-z0-9.-]/i.test(x.hostname);
  } catch { return false; }
}
/** 去重键：host+路径（忽略协议、www.、尾斜杠、大小写） */
function normUrl(u) {
  try {
    const x = new URL(u);
    const h = x.hostname.toLowerCase().replace(/^www\./, '');
    return h + x.pathname.replace(/\/+$/, '').toLowerCase() + (x.search ? x.search.toLowerCase() : '');
  } catch {
    return String(u).toLowerCase().trim();
  }
}

/* ---------- 拉取（带重试） ---------- */
async function fetchText(url, label) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: '*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (!text || text.length < 2000) throw new Error('内容过短 ' + (text ? text.length : 0));
      return text;
    } catch (err) {
      lastErr = err;
      console.warn('[warn] [' + label + '] 第' + attempt + '次拉取失败: ' + err.message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

/* ---------- 解析：public-apis 严格表格（含 Auth/HTTPS/CORS） ---------- */
const ROW_RE = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*(Yes|No)\s*\|\s*(Yes|No|Unknown)\s*\|\s*$/;
function parseTableStrict(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let category = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '## License' || line.startsWith('## Question')) break;
    if (line.startsWith('#')) {
      const m = line.match(/^#{2,4}\s+(.+)/);
      if (m) category = clean(m[1]);
      continue;
    }
    const m = line.match(ROW_RE);
    if (!m) continue;
    const [, name, link, description, auth, https, cors] = m;
    const cName = clean(name), cLink = link.trim(), cDesc = clean(description);
    if (!cName || !validHttpUrl(cLink)) continue;
    const cAuth = clean(auth).toLowerCase() === 'no' ? '' : clean(auth);
    out.push({
      name: cName, description: cDesc,
      auth: cAuth, https: https === 'Yes',
      cors: cors === 'Yes' ? 'yes' : cors === 'No' ? 'no' : 'unknown',
      link: cLink, category: category || 'Other',
    });
  }
  return out;
}

/* ---------- 解析：通用链接形式（表格行或无序列表） ---------- */
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
function isSepRow(line) {
  const cells = line.replace(/^\||\|$/g, '').split('|');
  return cells.every((c) => /^\s*:?-{2,}\s*$/.test(c));
}
function parseLinks(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let category = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const m = line.match(/^#{2,4}\s+(.+)/);
      if (m) category = clean(m[1]);
      continue;
    }
    if (isSepRow(line)) continue;
    LINK_RE.lastIndex = 0;
    let m;
    const links = [];
    while ((m = LINK_RE.exec(line)) !== null) {
      const text = clean(m[1]), href = m[2].trim();
      if (text && validHttpUrl(href) && text.toLowerCase() !== href.toLowerCase()) {
        links.push({ text, href });
      }
    }
    if (!links.length) continue;
    const pick = links[0];
    let desc = line.replace(/\[[^\]]*\]\([^)]+\)/g, ' ').replace(/[|\-–—:;]/g, ' ').trim();
    desc = clean(desc);
    out.push({
      name: pick.text, description: desc,
      auth: '', https: true, cors: 'unknown',
      link: pick.href, category: category || 'Other',
    });
  }
  return out;
}

/* ---------- 解析：APIs.guru OpenAPI 目录（大 JSON） ---------- */
function titleCase(s) {
  return String(s || '')
    .split(/[_-\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
function parseApisGuru(jsonText) {
  let data;
  try { data = JSON.parse(jsonText); } catch { return []; }
  const out = [];
  for (const key of Object.keys(data || {})) {
    const e = data[key];
    if (!e || typeof e !== 'object' || !e.versions) continue;
    const v = e.versions[e.preferred] || Object.values(e.versions)[0];
    if (!v) continue;
    const info = v.info || {};
    const name = (info.title || key).trim();
    if (!name) continue;
    const catArr = info['x-apisguru-categories'];
    const category = catArr && catArr.length ? titleCase(catArr[0]) : 'Other';
    const contactUrl = info.contact && info.contact.url;
    let link = contactUrl && validHttpUrl(contactUrl) ? contactUrl : (v.link || '');
    if (!validHttpUrl(link)) link = v.swaggerUrl || '';
    if (!validHttpUrl(link)) continue;
    out.push({
      name, description: clean(info.description || ''),
      auth: 'Unknown', https: link.startsWith('https://'),
      cors: 'unknown', link, category,
    });
  }
  return out;
}

/* ---------- 健康检查（分级策略） ---------- */
// 策略（节省资源、避免无谓请求）：
//   1) 上次健康(up) 且检查时间在 48h 内 → 复用旧结果，不重复检查（健康 API 隔天查）
//   2) 上次异常(down/unknown) 且检查时间在 24h 内 → 复用；超过 24h → 立即重查（异常 API 每日查）
//   3) 从未检查过，或找不到旧记录 → 立即检查
const HEALTH_TTL_UP_MS = 48 * 60 * 60 * 1000;    // 健康 API：隔天查
const HEALTH_TTL_DOWN_MS = 24 * 60 * 60 * 1000;  // 异常 API：每天查

async function healthOne(entry) {
  const t0 = Date.now();
  const bo = { status: 'down', statusCode: null, timeMs: 0, checkedAt: new Date().toISOString(), error: '' };
  try {
    const res = await fetch(entry.link, {
      method: 'GET', redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: '*/*' },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    bo.timeMs = Date.now() - t0;
    bo.statusCode = res.status;
    bo.status = res.status >= 200 && res.status < 400 ? 'up' : 'down';
    return bo;
  } catch (err) {
    bo.timeMs = Date.now() - t0;
    bo.status = 'down';
    bo.error = String(err.message || err).slice(0, 50);
    return bo;
  }
}

function shouldReuseHealth(prev, now) {
  if (!prev || !prev.checkedAt) return false;
  const age = now - new Date(prev.checkedAt).getTime();
  if (!(age >= 0)) return false;
  const ttl = prev.status === 'up' ? HEALTH_TTL_UP_MS : HEALTH_TTL_DOWN_MS;
  return age < ttl;
}

async function healthAll(entries, prevHealthMap) {
  const now = Date.now();
  const result = new Array(entries.length);
  let idx = 0;
  let checked = 0;
  let reused = 0;
  const workers = Array.from({ length: HEALTH_CONCURRENCY }, async () => {
    while (idx < entries.length) {
      const i = idx++;
      const e = entries[i];
      const prev = prevHealthMap ? prevHealthMap[normUrl(e.link)] : null;
      if (shouldReuseHealth(prev, now)) {
        result[i] = prev; // 复用上次健康状态
        reused++;
        continue;
      }
      try { result[i] = await healthOne(e); } catch { result[i] = { status: 'unknown', timeMs: 0 }; }
      checked++;
      const done = checked + reused;
      if (done % Math.max(100, Math.round(entries.length / 20)) === 0 || done === entries.length) {
        console.log('  ... 新查 ' + checked + ', 复用 ' + reused + ' / ' + entries.length);
      }
    }
  });
  await Promise.all(workers);
  console.log('[ok] 分级健康检查: 新查 ' + checked + ' 条, 复用旧健康 ' + reused + ' 条');
  return result;
}

/* ---------- 主流程 ---------- */
async function main() {
  console.log('[info] 开始多源聚合...');
  const sourcesData = [];
  for (const s of SOURCES) {
    try {
      const text = await fetchText(s.url, s.id);
      sourcesData.push({ src: s, text });
      console.log('[ok] 拉取 ' + s.name + ' (' + text.length + ' 字符)');
    } catch (e) {
      console.warn('[warn] 跳过源 ' + s.name + ': ' + e.message);
    }
  }
  if (!sourcesData.length) {
    console.error('[error] 所有源均拉取失败，保留旧数据。');
    process.exit(1);
  }

  const entries = [];
  const seen = new Set();
  const bySrc = {};
  for (const s of SOURCES) bySrc[s.id] = 0;

  for (const { src, text } of sourcesData) {
    let list = src.parser === 'table-strict' ? parseTableStrict(text) : src.parser === 'apis-guru' ? parseApisGuru(text) : parseLinks(text);
    let added = 0;
    for (const e of list) {
      const k = normUrl(e.link);
      if (seen.has(k)) continue;
      seen.add(k);
      entries.push(Object.assign({}, e, { source: src.id }));
      added++;
    }
    bySrc[src.id] = added;
    console.log('[ok] 源 ' + src.name + ': 解析 ' + list.length + ' 条, 新增 ' + added);
  }

  if (!entries.length) {
    console.error('[error] 合并结果为空，中止，保留旧数据。');
    process.exit(1);
  }

  // 读取旧数据：构建“按去重URL → 上次健康记录”映射（供分级检查复用），并保留旧 updatedAt
  let prevHealthMap = null;
  let prevUpdatedAt = null;
  try {
    const prev = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    if (Array.isArray(prev.apis)) {
      prevHealthMap = {};
      for (const a of prev.apis) {
        if (a && a.health && a.health.checkedAt) prevHealthMap[normUrl(a.link)] = a.health;
      }
    }
    if (!noHealth && prev.meta && prev.meta.updatedAt) prevUpdatedAt = prev.meta.updatedAt;
  } catch (e) { /* 首次运行，无旧数据 */ }

  if (!noHealth) {
    console.log('[info] 开始分级健康检查（并发 ' + HEALTH_CONCURRENCY + ', 超时 ' + HEALTH_TIMEOUT_MS + 'ms）...');
    const arr = await healthAll(entries, prevHealthMap);
    for (let i = 0; i < entries.length; i++) {
      const h = arr[i];
      entries[i].health = {
        status: h.status === 'up' ? 'up' : h.status === 'down' ? 'down' : 'unknown',
        statusCode: h.statusCode, timeMs: h.timeMs, checkedAt: h.checkedAt, error: h.error || '',
      };
    }
    const up = entries.filter((e) => e.health && e.health.status === 'up').length;
    const down = entries.filter((e) => e.health && e.health.status === 'down').length;
    console.log('[ok] 健康检查完成: up ' + up + ', down ' + down + ', total ' + entries.length);
  }

  const categories = [...new Set(entries.map((e) => e.category))].sort();

  const payload = {
    meta: {
      sources: SOURCES.map((s) => ({ id: s.id, name: s.name })),
      source: SOURCES.map((s) => s.name).join(' + '),
      license: 'MIT',
      updatedAt: prevUpdatedAt || new Date().toISOString(),
      healthCheckedAt: new Date().toISOString(),
      count: entries.length,
      categories: categories.length,
    },
    categories,
    apis: entries,
  };

  await writeFile(OUT_FILE, JSON.stringify(payload) + '\n', 'utf8');
  const sizeKB = (await readFile(OUT_FILE)).length / 1024;
  console.log('[ok] 已写入 ' + OUT_FILE + ': ' + entries.length + ' APIs / ' + categories.length + ' 分类 / ' + sizeKB.toFixed(1) + ' KB');
  console.log('     各源贡献: ' + JSON.stringify(bySrc));
}

await main();