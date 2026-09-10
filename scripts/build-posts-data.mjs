// 构建脚本：合并 posts.json 元数据 + posts/*.md 正文为 posts-data.json（供 Worker 导入）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const blogDir = resolve(__dirname, '..', 'public', 'blog');
const postsDir = resolve(blogDir, 'posts');
const srcDir = resolve(__dirname, '..', 'src');

const index = JSON.parse(readFileSync(resolve(blogDir, 'posts.json'), 'utf8'));
const data = index.map((meta) => {
  const mdPath = resolve(postsDir, `${meta.slug}.md`);
  const content = readFileSync(mdPath, 'utf8');
  return { ...meta, content };
});

writeFileSync(
  resolve(srcDir, 'posts-data.json'),
  JSON.stringify(data, null, 2) + '\n',
  'utf8'
);

console.log(`已生成 posts-data.json: ${data.length} 篇文章`);
