// 自动发布脚本：从 public/blog/drafts/ 取下一篇草稿，发布到 posts/ + posts.json
// 用法: node scripts/publish-next-post.mjs
// 返回码: 0 = 发布成功; 1 = 无草稿可发布
import { readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const blogDir = resolve(__dirname, '..', 'public', 'blog');
const draftsDir = resolve(blogDir, 'drafts');
const postsDir = resolve(blogDir, 'posts');
const indexPath = resolve(blogDir, 'posts.json');

// 1. 读取所有草稿（按文件名排序，确保发布顺序稳定）
let draftFiles;
try {
  draftFiles = readdirSync(draftsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();
} catch {
  console.log('草稿目录不存在，跳过发布。');
  process.exit(1);
}

if (draftFiles.length === 0) {
  console.log('没有待发布的草稿。');
  process.exit(1);
}

// 2. 取第一篇草稿
const draftFile = draftFiles[0];
const draftPath = resolve(draftsDir, draftFile);
const raw = readFileSync(draftPath, 'utf8');

// 3. 解析 frontmatter（---\n{json}\n---）
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
if (!fmMatch) {
  console.error(`草稿 ${draftFile} 缺少 frontmatter 头，跳过。`);
  process.exit(1);
}

let meta;
try {
  meta = JSON.parse(fmMatch[1].trim());
} catch (e) {
  console.error(`草稿 ${draftFile} 的 frontmatter JSON 解析失败:`, e.message);
  process.exit(1);
}

// 4. 去掉 frontmatter，得到正文
const content = raw.slice(fmMatch[0].length);

// 5. slug 来自文件名（去掉 .md）
const slug = basename(draftFile, '.md');

// 6. 写入 posts/{slug}.md
const postPath = resolve(postsDir, `${slug}.md`);
writeFileSync(postPath, content, 'utf8');
console.log(`已发布正文: ${postPath}`);

// 7. 追加到 posts.json（日期 = 今天 UTC）
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const entry = {
  slug,
  title: meta.title,
  date: today,
  excerpt: meta.excerpt || '',
  tags: meta.tags || [],
  author: meta.author || 'SendAFun',
};

// 避免重复（同 slug 已存在则替换）
const existingIdx = index.findIndex((p) => p.slug === slug);
if (existingIdx >= 0) {
  index[existingIdx] = entry;
  console.log(`已更新文章: ${slug} (${today})`);
} else {
  index.push(entry);
  console.log(`已新增文章: ${slug} (${today})`);
}

// 按日期倒序排列（新的在前）
index.sort((a, b) => b.date.localeCompare(a.date));

writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');

// 8. 删除已发布的草稿
unlinkSync(draftPath);
console.log(`已删除草稿: ${draftFile}`);

console.log(`\n✅ 发布完成: "${entry.title}"`);
console.log(`   剩余草稿: ${draftFiles.length - 1} 篇`);
