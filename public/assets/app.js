/* ============================================================
   apis-sendafun — 公共 API 索引 + 在线调试 SPA
   功能：搜索/筛选/分页、详情(健康探测/Playground/代码生成)、
        提交 API、自托管访客统计、明暗主题、GA4、联盟链接
   ============================================================ */

/* ---------- 配置 ---------- */
var GA4_ID = '';                 // Google Analytics 4 测量 ID，留空禁用
var AMAZON_TAG = 'amazon-tag-placeholder'; // 亚马逊联盟 tag，仅页脚文本链接
var PAGE_SIZE = 12;
var SEARCH_DEBOUNCE_MS = 200;

/* ---------- 状态 ---------- */
var state = {
  all: [],
  categories: [],
  query: '',
  category: 'all',
  auth: 'all',
  https: 'all',
  cors: 'all',
  page: 1,
  loading: true,
  error: null,
  current: null,      // 当前查看的 API
};

/* ---------- DOM 工具 ---------- */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }

/* ---------- Toast（顶部彩色通知条，绿色成功/红色错误，自动消失） ---------- */
var toastTimer = null;
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.toggle('success', !isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- 剪贴板 ---------- */
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

/* ---------- 数据加载 ---------- */
function loadData() {
  fetch('data/apis.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((data) => {
      state.all = data.apis || [];
      state.categories = data.categories || [];
      const m = data.meta || {};
      const upd = document.getElementById('updatedAt');
      if (m.updatedAt) { const d = new Date(m.updatedAt); upd.textContent = '数据更新于 ' + d.toLocaleDateString('zh-CN'); }
      document.getElementById('statApis').textContent = fmtNum(state.all.length);
      document.getElementById('statTotal').textContent = fmtNum(state.all.length);
      document.getElementById('statCats').textContent = fmtNum(state.categories.length);
      populateCategoryFilter();
      renderCategoryChips();
      fillCategoryDatalist();
      state.loading = false;
      applyFilters(true);
    })
    .catch((err) => { state.loading = false; state.error = err; renderError(); });
}

function populateCategoryFilter() {
  const sel = document.getElementById('filterCategory');
  sel.innerHTML = '';
  const all = el('option', null, '全部'); all.value = 'all'; sel.appendChild(all);
  state.categories.forEach((c) => {
    const o = el('option', null, c); o.value = c; sel.appendChild(o);
  });
}
function renderCategoryChips() {
  const wrap = document.getElementById('categoryChips');
  wrap.innerHTML = '';
  state.categories.forEach((c) => {
    const chip = el('button', 'chip' + (state.category === c ? ' active' : ''), c);
    chip.type = 'button';
    chip.dataset.cat = c;
    chip.addEventListener('click', () => {
      state.category = state.category === c ? 'all' : c;
      document.getElementById('filterCategory').value = state.category;
      renderCategoryChips();
      applyFilters(true);
    });
    wrap.appendChild(chip);
  });
}
function fillCategoryDatalist() {
  const dl = document.getElementById('catlist');
  dl.innerHTML = '';
  state.categories.forEach((c) => dl.appendChild(el('option', null, c)));
}

/* ---------- 筛选 ---------- */
function getFiltered() {
  const q = state.query.trim().toLowerCase();
  return state.all.filter((a) => {
    if (state.category !== 'all' && a.category !== state.category) return false;
    if (state.auth === 'yes' && !a.auth) return false;
    if (state.auth === 'no' && a.auth) return false;
    if (state.https === 'yes' && !a.https) return false;
    if (state.https === 'no' && a.https) return false;
    if (state.cors === 'yes' && a.cors !== 'yes') return false;
    if (state.cors === 'no' && a.cors !== 'no') return false;
    if (state.cors === 'unknown' && a.cors !== 'unknown') return false;
    if (q) { const hay = (a.name + ' ' + a.description + ' ' + a.category).toLowerCase(); if (hay.indexOf(q) === -1) return false; }
    return true;
  });
}

function applyFilters(resetPage) {
  if (resetPage) state.page = 1;
  const f = getFiltered();
  const totalPages = Math.max(1, Math.ceil(f.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  document.getElementById('resultCount').textContent =
    state.loading ? '加载中…' : fmtNum(f.length) + ' 个 API';
  document.getElementById('empty').hidden = f.length > 0;
  if (!f.length) { renderGrid([]); renderPagination(0); return; }
  renderGrid(f);
  renderPagination(totalPages);
}

function renderGrid(filtered) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const start = (state.page - 1) * PAGE_SIZE;
  filtered.slice(start, start + PAGE_SIZE).forEach((api) => grid.appendChild(buildCard(api)));
}

function buildCard(api) {
  const card = el('article', 'card');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const top = el('div', 'card-top');
  const title = el('div', 'card-title');
  const openBtn = el('button', 'linklike', api.name);
  openBtn.type = 'button';
  openBtn.addEventListener('click', (e) => { e.stopPropagation(); openDetail(api); });
  title.appendChild(openBtn);
  const badges = el('div', 'badges');
  if (api.auth) badges.appendChild(el('span', 'badge badge-warn', '🔑 ' + api.auth));
  else badges.appendChild(el('span', 'badge badge-ok', '免鉴权'));
  if (api.https) badges.appendChild(el('span', 'badge badge-ok', 'HTTPS'));
  else badges.appendChild(el('span', 'badge badge-bad', '无 HTTPS'));
  top.appendChild(title);
  top.appendChild(badges);
  card.appendChild(top);

  const desc = el('p', 'card-desc', api.description);
  card.appendChild(desc);

  const tags = el('div', 'tags');
  tags.appendChild(el('span', 'tag tag-accent', api.category));
  tags.appendChild(el('span', 'tag ' + corsClass(api.cors), 'CORS: ' + api.cors));
  card.appendChild(tags);

  const actions = el('div', 'card-actions');
  const btnDetail = el('button', 'btn btn-primary', '查看 / 调试');
  btnDetail.type = 'button';
  btnDetail.addEventListener('click', (e) => { e.stopPropagation(); openDetail(api); });
  const btnCurl = el('button', 'btn', '复制 cURL');
  btnCurl.type = 'button';
  btnCurl.dataset.curl = api.name + '|' + api.link + '|' + (api.auth ? '1' : '0');
  actions.appendChild(btnDetail);
  actions.appendChild(btnCurl);
  card.appendChild(actions);

  card.addEventListener('click', () => openDetail(api));
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(api); } });
  return card;
}

function corsClass(c) { return c === 'yes' ? 'tag-ok' : c === 'no' ? 'tag-bad' : 'tag-warn'; }

function renderError() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const empty = document.getElementById('empty');
  empty.hidden = false;
  empty.textContent = '数据集加载失败，请稍后重试。';
  document.getElementById('resultCount').textContent = 'Error';
}

/* ---------- 分页 ---------- */
function renderPagination(totalPages) {
  const nav = document.getElementById('pagination');
  nav.innerHTML = '';
  if (!totalPages) return;
  const mk = (label, active, disabled, fn) => {
    const b = el('button', 'page-btn' + (active ? ' active' : ''), label);
    b.type = 'button'; b.disabled = !!disabled; b.addEventListener('click', fn);
    return b;
  };
  nav.appendChild(mk('上一页', false, state.page <= 1, () => { if (state.page > 1) { state.page--; applyFilters(false); } }));
  const win = getPageWindow(state.page, totalPages);
  win.forEach((p) => {
    if (p === '…') nav.appendChild(el('span', 'page-ellipsis', '…'));
    else nav.appendChild(mk(String(p), p === state.page, false, () => { state.page = p; applyFilters(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  });
  nav.appendChild(mk('下一页', false, state.page >= totalPages, () => { if (state.page < totalPages) { state.page++; applyFilters(false); } }));
}
function getPageWindow(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (cur > 3) pages.push('…');
  for (let j = Math.max(2, cur - 1); j <= Math.min(total - 1, cur + 1); j++) pages.push(j);
  if (cur < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

/* ============================================================
   详情弹窗：健康探测 + Playground + 代码生成
   ============================================================ */
let detailApi = null;
function openDetail(api) {
  detailApi = api;
  document.getElementById('detailModal').hidden = false;
  document.body.classList.add('modal-open');
  renderDetail();
  // 自动初始化 Playground/探测
  initPlayground(api);
  void checkHealth(api.link);
}

function closeDetail() {
  document.getElementById('detailModal').hidden = true;
  document.body.classList.remove('modal-open');
}

function renderDetail() {
  const api = detailApi;
  if (!api) return;
  const body = document.getElementById('detailBody');
  const d = new URL(api.link);
  const host = d.hostname;
  body.innerHTML = '';
  body.appendChild(detailHeader(api));
  body.appendChild(el('div', 'tag', api.category));
  body.appendChild(healthBox());
  body.appendChild(el('h3', 'dl-h3', '🔧 在线 Playground'));
  body.appendChild(playgroundBox(api));
  body.appendChild(el('h3', 'dl-h3', '📋 代码片段'));
  body.appendChild(codegenBox(api));
  body.appendChild(el('h3', 'dl-h3', 'ℹ️ 基本信息'));
  body.appendChild(infoGrid(api));
  bindCopyButtons(body);
}

function detailHeader(api) {
  const box = el('div', 'dl-header');
  const title = el('h2', 'dl-title', api.name);
  const link = el('a', 'dl-url', host);
  link.href = api.link; link.target = '_blank'; link.rel = 'noopener noreferrer';
  box.appendChild(title);
  box.appendChild(link);
  box.appendChild(el('p', 'dl-desc', api.description));
  return box;
}

function healthBox() {
  const box = el('div', 'health');
  box.innerHTML = `
    <div class="health-summary">
      <span id="healthStatus" class="health-status">检测中…</span>
      <button id="healthBtn" class="btn" type="button">重新检测</button>
    </div>`;
  return box;
}

function infoGrid(api) {
  const g = el('div', 'info-grid');
  const row = (k, v) => {
    const r = el('div', 'info-row');
    r.appendChild(el('span', 'info-k', k));
    r.appendChild(el('span', 'info-v', v));
    return r;
  };
  g.appendChild(row('分类', api.category || '—'));
  g.appendChild(row('鉴权', api.auth || '无需鉴权'));
  g.appendChild(row('HTTPS', api.https ? 'Yes' : 'No'));
  g.appendChild(row('CORS', api.cors || 'Unknown'));
  g.appendChild(row('官方链接', ''));
  const lk = g.lastChild.querySelector('.info-v');
  const a = el('a', null, api.link); a.href = api.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
  lk.textContent = ''; lk.appendChild(a);
  return g;
}

/* ---------- 健康探测 ---------- */
async function checkHealth(url) {
  const st = document.getElementById('healthStatus');
  if (!st) return;
  st.textContent = '检测中…'; st.className = 'health-status';
  try {
    const r = await fetch('/api/health?url=' + encodeURIComponent(url));
    const data = await r.json();
    if (!data || !data.ok) { st.textContent = '检测失败'; st.className = 'health-status dead'; return; }
    if (data.alive) {
      st.textContent = '🟢 可用 · ' + data.timeMs + 'ms · ' + fmtClock(data.checkedAt);
      st.className = 'health-status alive';
    } else {
      st.textContent = '🔴 不可达' + (data.error ? ' · ' + data.error : '');
      st.className = 'health-status dead';
    }
  } catch (e) {
    st.textContent = '检测失败'; st.className = 'health-status dead';
  }
  const btn = document.getElementById('healthBtn');
  if (btn) btn.disabled = false;
}

function fmtClock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Playground ---------- */
function playgroundBox(api) {
  const box = el('div', 'pg');
  box.innerHTML = `
    <div class="pg-row">
      <select id="pgMethod">
        <option>GET</option><option>POST</option><option>PUT</option>
        <option>PATCH</option><option>DELETE</option><option>HEAD</option>
      </select>
      <input id="pgUrl" class="pg-url" value="${esc(api.link)}" spellcheck="false">
      <button id="pgSend" class="btn btn-primary" type="button">发送</button>
    </div>
    <div class="pg-headers">
      <div class="pg-hd-label">请求头</div>
      <div id="pgHeaderList" class="pg-header-list"></div>
      <button id="pgAddHeader" class="btn btn-sm" type="button">+ 添加请求头</button>
    </div>
    <div class="pg-body">
      <label class="pg-hd-label" for="pgBody">Body (JSON)</label>
      <textarea id="pgBody" class="pg-body-input" rows="4" spellcheck="false" placeholder='{"key":"value"}'></textarea>
    </div>
    <div class="pg-result" hidden>
      <div class="pg-meta" id="pgMeta"></div>
      <pre id="pgOut" class="pg-out"></pre>
    </div>`;
  // 预置一行 Authorization（若需鉴权）
  const list = box.querySelector('#pgHeaderList');
  if (api.auth) {
    addHeaderRow(list);
    const inp = list.querySelector('input[name=hval]');
    if (inp) inp.placeholder = 'Bearer YOUR_KEY';
    const key = list.querySelector('input[name=hkey]');
    if (key) { key.value = 'Authorization'; key.readOnly = true; }
  }
  box.querySelector('.pg-body').style.display = api.auth === '' ? 'none' : 'block';
  box.querySelector('#pgBody').style.display = api.https === false ? 'none' : 'block';
  return box;
}

function addHeaderRow(list, key, val) {
  const row = el('div', 'pg-header-row');
  const k = el('input', 'pg-hk'); k.name = 'hkey'; k.placeholder = 'Header';
  const v = el('input', 'pg-hv'); v.name = 'hval'; v.placeholder = 'Value';
  const rm = el('button', 'btn btn-sm btn-danger', '×'); rm.type = 'button';
  if (key !== undefined) k.value = key;
  if (val !== undefined) v.value = val;
  rm.addEventListener('click', () => row.remove());
  row.appendChild(k); row.appendChild(v); row.appendChild(rm);
  list.appendChild(row);
}

async function sendPlayground() {
  const out = document.getElementById('pgOut');
  const meta = document.getElementById('pgMeta');
  const sendBtn = document.getElementById('pgSend');
  const url = document.getElementById('pgUrl').value.trim();
  const method = document.getElementById('pgMethod').value;
  out.textContent = '发送中…';
  meta.textContent = '';
  document.getElementById('pg-result').hidden = false;
  sendBtn.disabled = true;
  sendBtn.textContent = '发送中…';
  const headers = Array.from(document.querySelectorAll('#pgHeaderList .pg-header-row'))
    .map((r) => ({ key: r.querySelector('input[name=hkey]').value.trim(), value: r.querySelector('input[name=hval]').value.trim() }))
    .filter((h) => h.key);
  const body = document.getElementById('pgBody').value;
  const contentType = dedupeType(getContentType(headers));
  try {
    const resp = await fetch('/api/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, url, headers, body, contentType }),
    });
    const data = await resp.json();
    if (data.ok) {
      meta.textContent = '状态: ' + (data.status || '-') + ' ' + (data.statusText || '') +
        ' · 大小: ' + fmtBytes(data.size);
      out.textContent = data.body || data.error || '(空响应)';
      if (data.error) out.className = 'pg-out err';
    } else {
      meta.textContent = '';
      out.textContent = data.error || '代理错误';
      out.className = 'pg-out err';
    }
  } catch (e) {
    meta.textContent = '';
    out.textContent = '请求失败：' + e.message;
    out.className = 'pg-out err';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '发送';
  }
}
function getContentType(headers) {
  const c = headers.find((h) => h.key.toLowerCase() === 'content-type');
  return c ? c.value : 'application/json';
}
function dedupeType(t) { return t; }
function fmtBytes(n) {
  n = Number(n || 0);
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function initPlayground(api) {
  // 绑定事件（renderDetail 已重建 DOM，这里一次性绑定）
  const box = document.getElementById('detailBody').querySelector('.pg');
  if (!box) return;
  box.querySelector('#pgAddHeader').addEventListener('click', () =>
    addHeaderRow(box.querySelector('#pgHeaderList')));
  box.querySelector('#pgMethod').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPlayground(); });
  box.querySelector('#pgUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPlayground(); });
  box.querySelector('#pgSend').addEventListener('click', sendPlayground);
  box.querySelector('.pg-result').id = 'pg-result'; // 归一化 id（HTML 中已含）
}

/* ---------- 代码生成 ---------- */
function codegenBox(api) {
  const box = el('div', 'codegen');
  const langs = [
    ['curl', 'cURL'],
    ['fetch', 'JavaScript (fetch)'],
    ['axios', 'Node.js (axios)'],
    ['python', 'Python (requests)'],
  ];
  const tabs = el('div', 'code-tabs');
  tabs.innerHTML = langs.map((l, i) => `<button class="code-tab${i === 0 ? ' active' : ''}" data-lang="${l[0]}">${l[1]}</button>`).join('');
  const pre = el('pre', 'code-pre');
  const code = el('code', 'code-sample');
  pre.appendChild(code);
  const copyBtn = el('button', 'btn', '复制');
  copyBtn.type = 'button';
  copyBtn.addEventListener('click', () => copyText(code.textContent).then((ok) => showToast(ok ? '已复制到剪贴板' : '复制失败', !ok)));
  const head = el('div', 'code-head');
  head.appendChild(el('span', 'code-head-label', '多语言代码'));
  head.appendChild(copyBtn);
  box.appendChild(tabs);
  box.appendChild(head);
  box.appendChild(pre);
  box._code = code;
  box._gen = () => generateCode(api, getPgConfig(), box.querySelector('.code-tab.active').dataset.lang);
  refreshCode(box);
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('.code-tab');
    if (!t) return;
    tabs.querySelectorAll('.code-tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    refreshCode(box);
  });
  return box;
}

function getPgConfig() {
  const method = document.getElementById('pgMethod') ? document.getElementById('pgMethod').value : 'GET';
  const url = document.getElementById('pgUrl') ? document.getElementById('pgUrl').value.trim() : '';
  const headers = Array.from(document.querySelectorAll('#pgHeaderList .pg-header-row'))
    .map((r) => ({ key: r.querySelector('input[name=hkey]').value.trim(), value: r.querySelector('input[name=hval]').value.trim() }))
    .filter((h) => h.key);
  const body = document.getElementById('pgBody') ? document.getElementById('pgBody').value : '';
  return { method, url, headers, body };
}

function refreshCode(box) {
  try {
    box._code.textContent = box._gen();
  } catch (e) { box._code.textContent = '// 无法生成: ' + e.message; }
}

function generateCode(api, cfg, lang) {
  const m = cfg.method || 'GET';
  const u = cfg.url || api.link;
  const headers = cfg.headers || [];
  const body = cfg.body || '';
  const hasBody = !!body;
  const hdr = (k, v) => headers.find((h) => h.key.toLowerCase() === k.toLowerCase());
  const contentType = (hdr('content-type') && hdr('content-type').value) || 'application/json';

  const curlHeaders = [];
  if (contentType) curlHeaders.push(`  -H "Content-Type: ${contentType}"`);
  headers.forEach((h) => { curlHeaders.push(`  -H "${h.key}: ${h.value}"`); });

  const axiosHeaders = JSON.stringify(headers.reduce((o, h) => { o[h.key] = h.value; return o; }, /(POST|PUT|PATCH)/.test(m) ? { 'Content-Type': contentType } : {}));

  switch (lang) {
    case 'fetch':
      return `fetch("${u}", {
  method: "${m}",
  headers: ${JSON.stringify(headers.reduce((o,h)=>{o[h.key]=h.value;return o;},{}), null, 2).replace(/\n/g, '\n  ')},
${hasBody ? `  body: JSON.stringify(${body || '{}'}),\n` : ''}).then(r => r.json()).then(console.log);`;
    case 'axios':
      return `const axios = require('axios');
const res = await axios({
  method: "${m}",
  url: "${u}",
  headers: ${axiosHeaders},
${hasBody ? `  data: ${body || '{}'},\n` : ''}});
console.log(res.data);`;
    case 'python':
      return `import requests

url = "${u}"
headers = ${JSON.stringify(headers.reduce((o,h)=>{o[h.key]=h.value;return o;},{}))}
${hasBody ? `payload = ${body || '{}'}
` : ''}r = requests.request("${m}", url, headers=headers${hasBody ? ', json=payload' : ''})
print(r.status_code, r.text)`;
    case 'curl':
    default:
      return `curl -X ${m} "${u}" \\\n${curlHeaders.join(' \\\n')}${hasBody ? ` \\\n  -d '${body.replace(/'/g, "\\'")}'` : ''}`;
  }
}

function bindCopyButtons(body) {
  // 卡片上的复制 cURL 按钮（事件委托在 grid 上，见 wireEvents）
  void body;
}

/* ============================================================
   提交 API
   ============================================================ */
async function submitApi(formData) {
  try {
    const resp = await fetch('/api/submit', { method: 'POST', body: formData });
    const data = await resp.json();
    if (data.ok) {
      showToast(data.duplicate ? '该 API 已在待审队列中，无需重复提交' : '提交成功，将进入人工审核队列', data.duplicate);
      closeSubmit();
    } else {
      showToast(data.error || '提交失败', true);
    }
  } catch (e) {
    showToast('提交失败：' + e.message, true);
  }
}
function closeSubmit() { document.getElementById('submitModal').hidden = true; document.body.classList.remove('modal-open'); }

/* ============================================================
   访客统计（自托管 KV）
   ============================================================ */
function loadVisitorCount() {
  const wrap = document.getElementById('visitorCount');
  fetch('/api/counter', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => {
      if (d && d.ok) {
        wrap.classList.remove('placeholder');
        wrap.textContent = fmtNum(d.total.pv) + ' 次访问 · ' + fmtNum(d.today.pv) + ' 今日';
        if (d.today.uv) wrap.textContent += ' · ' + fmtNum(d.today.uv) + ' 人';
        document.getElementById('statPv').textContent = fmtNum(d.total.pv);
        document.getElementById('statToday').textContent = fmtNum(d.today.pv);
      }
    })
    .catch(() => { wrap.textContent = ''; });
}

/* ---------- 主题 ---------- */
function initTheme() {
  let stored = null;
  try { stored = localStorage.getItem('apis-sendafun-theme'); } catch (e) {}
  const theme = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(theme);
}
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '浅色' : '暗色';
  try { localStorage.setItem('apis-sendafun-theme', theme); } catch (e) {}
}

/* ---------- GA4 ---------- */
function initGA4() {
  if (!GA4_ID) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID);
}
function track(event, params) { if (typeof window.gtag === 'function') window.gtag('event', event, params || {}); }

/* ---------- 联盟链接 ---------- */
function initAffiliate() {
  const c = document.getElementById('affiliateLinks');
  if (!c) return;
  const items = [['云主机', 'vps cloud hosting'], ['技术书籍', 'programming books'], ['机械键盘', 'mechanical keyboard']];
  c.innerHTML = '';
  items.forEach((it, i) => {
    const a = el('a', null, it[0]);
    a.href = 'https://www.amazon.com/s?k=' + encodeURIComponent(it[1]) + '&tag=' + encodeURIComponent(AMAZON_TAG);
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    c.appendChild(a);
    if (i < items.length - 1) c.appendChild(document.createTextNode(' · '));
  });
}

/* ---------- 事件绑定 ---------- */
function wireEvents() {
  const searchInput = document.getElementById('searchInput');
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    const v = searchInput.value;
    debounce = setTimeout(() => { state.query = v; applyFilters(true); }, SEARCH_DEBOUNCE_MS);
  });

  document.getElementById('filterCategory').addEventListener('change', (e) => {
    state.category = e.target.value; renderCategoryChips(); applyFilters(true);
  });
  document.getElementById('filterAuth').addEventListener('change', (e) => { state.auth = e.target.value; applyFilters(true); });
  document.getElementById('filterHttps').addEventListener('change', (e) => { state.https = e.target.value; applyFilters(true); });
  document.getElementById('filterCors').addEventListener('change', (e) => { state.cors = e.target.value; applyFilters(true); });

  document.getElementById('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'light' : 'dark'); track('theme_toggle', { theme: cur });
  });

  // 卡片复制 cURL（事件委托）
  document.getElementById('grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-curl]');
    if (!btn) return;
    const [, url, auth] = btn.dataset.curl.split('|');
    const curl = `curl -X GET "${url}" -H "Accept: application/json"` + (auth === '1' ? ' -H "Authorization: <YOUR_API_KEY>"' : '');
    copyText(curl).then((ok) => { showToast(ok ? 'cURL 已复制' : '复制失败', !ok); if (ok) track('copy_curl', { url }); });
  });

  // 弹窗开关
  document.querySelectorAll('[data-open="submit"]').forEach((b) =>
    b.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('submitModal').hidden = false; document.body.classList.add('modal-open'); }));
  document.querySelectorAll('[data-open="about"]').forEach((b) =>
    b.addEventListener('click', (e) => { e.preventDefault(); const a = document.getElementById('about'); a.hidden = !a.hidden; a.scrollIntoView({ behavior: 'smooth' }); }));
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = b.dataset.close;
      if (t === 'detail') closeDetail();
      if (t === 'submit') closeSubmit();
    }));
  document.querySelectorAll('[data-view="home"]').forEach((b) =>
    b.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); applyFilters(true); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDetail(); closeSubmit(); } });

  // 健康检测按钮
  const body = document.getElementById('detailBody');
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('#healthBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '检测中…';
      const st = document.getElementById('healthStatus');
      st.textContent = '检测中…';
      checkHealth(detailApi.link).then(() => { btn.disabled = false; btn.textContent = '重新检测'; });
    }
  });

  // 提交表单
  document.getElementById('submitForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submitApi(new FormData(e.target));
  });
}

/* ---------- 启动 ---------- */
function boot() {
  initGA4();
  initTheme();
  initAffiliate();
  wireEvents();
  loadData();
  loadVisitorCount();   // 计数 + 读取并展示
  track('page_view', { page_location: window.location.href });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();