/**
 * blog.js — 博客系统 SSR 渲染（供 Cloudflare Worker 调用）
 *
 * 功能：
 *   - 从 posts-data.json（构建时合并 posts.json + posts/*.md）导入文章数据
 *   - Markdown → HTML 轻量解析（无需依赖）
 *   - 渲染 /blog 列表页、/blog/:slug 文章页（完整 HTML，利于 SEO）
 *   - 生成 sitemap.xml、robots.txt
 */

import postsData from './posts-data.json' with { type: 'json' };

const SITE_URL = 'https://apis.sendafun.com';
const SITE_NAME = 'APIS SendAFun';

/* ---------- 文章数据（已按日期倒序） ---------- */
const POSTS = postsData
  .slice()
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

function getPostIndex() {
  return POSTS.map(({ content, ...meta }) => meta);
}

function getPostBySlug(slug) {
  return POSTS.find((p) => p.slug === slug) || null;
}

/* ---------- Markdown → HTML ---------- */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseInline(text) {
  // 代码块内不解析，由块级处理；这里处理行内
  let s = escapeHtml(text);
  // 行内代码 `code`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 加粗 **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text* 或 _text_
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  // 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    const href = u.trim();
    const safe = /^https?:\/\//i.test(href) ? href : '#';
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${t}</a>`;
  });
  return s;
}

function parseMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 代码块 ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // 跳过结束 ```
      out.push(`<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // 标题 # ## ###
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${parseInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // 分割线 ---
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }

    // 引用 >
    if (line.trim().startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${parseInline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // 表格 | col | col |
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const header = line.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || (arr[0] === '' && idx > 0));
      // 简化：按 | 分割，去掉首尾空
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '');
      i += 2; // 跳过分隔行
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(lines[i].split('|').map((c) => c.trim()).filter((c) => c !== ''));
        i++;
      }
      let html = '<div class="table-wrap"><table><thead><tr>';
      for (const c of cells) html += `<th>${parseInline(c)}</th>`;
      html += '</tr></thead><tbody>';
      for (const r of rows) {
        html += '<tr>';
        for (const c of r) html += `<td>${parseInline(c)}</td>`;
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      out.push(html);
      continue;
    }

    // 无序列表 - * +
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*[-*+]\s+/, '')));
        i++;
      }
      out.push('<ul>' + items.map((it) => `<li>${it}</li>`).join('') + '</ul>');
      continue;
    }

    // 有序列表 1.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*\d+\.\s+/, '')));
        i++;
      }
      out.push('<ol>' + items.map((it) => `<li>${it}</li>`).join('') + '</ol>');
      continue;
    }

    // 空行
    if (line.trim() === '') { i++; continue; }

    // 段落（合并连续非空行）
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|>|```|-{3,}|\s*[-*+]\s+|\s*\d+\.\s+)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${parseInline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

/* ---------- HTML 页面模板 ---------- */
function pageShell({ title, description, canonical, body, jsonLd }) {
  const ld = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="/assets/app.css">
${ld}
</head>
<body>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/">apis-sendafun</a>
    <nav class="header-nav">
      <a class="header-link" href="/">Home</a>
      <a class="header-link" href="/blog">Blog</a>
      <a class="header-link" href="/#about">About</a>
      <a class="header-link" href="https://github.com/yusheng-zhang-star/apis-sendafun" target="_blank" rel="noopener noreferrer">GitHub</a>
    </nav>
  </div>
</header>
<main class="container blog-main">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-links">
      <a href="/blog">Blog</a>
      <a href="https://github.com/yusheng-zhang-star/apis-sendafun" target="_blank" rel="noopener noreferrer">GitHub</a>
    </div>
    <p class="footer-credit">Open-source project · API dataset from <a href="https://github.com/public-apis/public-apis" target="_blank" rel="noopener noreferrer">public-apis</a>, MIT License.</p>
  </div>
</footer>
</body>
</html>`;
}

/* ---------- 博客列表页 ---------- */
function renderBlogList(posts) {
  const cards = posts.map((p) => `
    <article class="blog-card">
      <div class="blog-card-meta">
        <time datetime="${escapeHtml(p.date)}">${escapeHtml(p.date)}</time>
        ${(p.tags || []).map((t) => `<span class="blog-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <h2 class="blog-card-title"><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h2>
      <p class="blog-card-excerpt">${escapeHtml(p.excerpt || '')}</p>
      <a class="blog-readmore" href="/blog/${escapeHtml(p.slug)}">Read more →</a>
    </article>
  `).join('');

  const body = `
    <section class="blog-hero">
      <h1>Blog</h1>
      <p>Guides, comparisons, and tutorials about free public APIs.</p>
    </section>
    <div class="blog-list">${cards || '<p>No posts yet.</p>'}</div>
  `;

  return pageShell({
    title: `Blog — ${SITE_NAME}`,
    description: 'Guides, comparisons, and tutorials about free public APIs. Learn how to find, test, and integrate free APIs into your projects.',
    canonical: `${SITE_URL}/blog`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${SITE_NAME} Blog`,
      url: `${SITE_URL}/blog`,
    },
  });
}

/* ---------- 单篇博客页 ---------- */
function renderBlogPost(meta, contentHtml) {
  const tags = (meta.tags || []).map((t) => `<span class="blog-tag">${escapeHtml(t)}</span>`).join('');
  const body = `
    <article class="blog-article">
      <header class="blog-article-header">
        <div class="blog-card-meta">
          <time datetime="${escapeHtml(meta.date)}">${escapeHtml(meta.date)}</time>
          ${tags}
        </div>
        <h1>${escapeHtml(meta.title)}</h1>
        <p class="blog-article-excerpt">${escapeHtml(meta.excerpt || '')}</p>
      </header>
      <div class="blog-article-content">
        ${contentHtml}
      </div>
      <div class="blog-article-footer">
        <a href="/blog">← Back to Blog</a>
      </div>
    </article>
  `;

  return pageShell({
    title: `${meta.title} — ${SITE_NAME}`,
    description: meta.excerpt || meta.title,
    canonical: `${SITE_URL}/blog/${meta.slug}`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: meta.title,
      description: meta.excerpt,
      datePublished: meta.date,
      dateModified: meta.date,
      author: { '@type': 'Organization', name: SITE_NAME },
      publisher: { '@type': 'Organization', name: SITE_NAME },
      mainEntityOfPage: `${SITE_URL}/blog/${meta.slug}`,
      keywords: (meta.tags || []).join(', '),
    },
  });
}

/* ---------- 404 ---------- */
function renderNotFound() {
  return pageShell({
    title: `Post not found — ${SITE_NAME}`,
    description: 'The blog post you are looking for does not exist.',
    canonical: `${SITE_URL}/blog`,
    body: `<section class="blog-hero"><h1>404</h1><p>This blog post does not exist.</p><p><a href="/blog">← Back to Blog</a></p></section>`,
  });
}

/* ---------- Sitemap ---------- */
function renderSitemap() {
  const posts = getPostIndex();
  const urls = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/blog`, priority: '0.9' },
    ...posts.map((p) => ({ loc: `${SITE_URL}/blog/${p.slug}`, lastmod: p.date, priority: '0.8' })),
  ];
  const xml = urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xml}
</urlset>`;
}

/* ---------- Robots ---------- */
function renderRobots() {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /#admin

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

/* ---------- 路由处理 ---------- */
export async function handleBlogRoutes(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // /sitemap.xml
  if (path === '/sitemap.xml') {
    return new Response(renderSitemap(), {
      status: 200,
      headers: { 'content-type': 'application/xml; charset=utf-8' },
    });
  }

  // /robots.txt
  if (path === '/robots.txt') {
    return new Response(renderRobots(), {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // /blog (列表页)
  if (path === '/blog' || path === '/blog/') {
    const posts = getPostIndex();
    const html = renderBlogList(posts);
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  // /blog/:slug (单篇)
  const m = path.match(/^\/blog\/([a-z0-9-]+)\/?$/i);
  if (m) {
    const slug = m[1];
    const post = getPostBySlug(slug);
    if (!post) {
      return new Response(renderNotFound(), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    const meta = { ...post };
    delete meta.content;
    const html = renderBlogPost(meta, parseMarkdown(post.content));
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  return null; // 非博客路由，交给上层处理
}
