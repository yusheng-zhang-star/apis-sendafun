/* ============================================================
   apis-sendafun — 公共 API 索引 + 在线调试 SPA
   功能：多语言(8种)、搜索/筛选/分页、详情(健康探测/
        Playground/代码生成)、提交 API、社区已审 API、
        自托管访客统计、隐藏管理后台(#admin)、明暗主题
   ============================================================ */

/* ---------- 配置 ---------- */
var GA4_ID = '';                 // Google Analytics 4 测量 ID，留空禁用
var AMAZON_TAG = 'amazon-tag-placeholder'; // 亚马逊联盟 tag，仅页脚文本链接
var PAGE_SIZE = 12;
var SEARCH_DEBOUNCE_MS = 200;

/* ============================================================
   多语言 i18n
   说明：字典在 assets/i18n.js（公用共享），此处只做查询与回退
   ============================================================ */
var LOCALE = 'en';
var SUPPORTED_LOCALES = ['en', 'zh', 'zh-Hant', 'hi', 'es', 'pt', 'fr', 'de'];
var LOCALE_NAMES = {
  en: 'English', zh: '简体中文', 'zh-Hant': '繁體中文',
  hi: 'हिन्दी', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch'
};
function localeTag() {
  const map = { en: 'en-US', zh: 'zh-CN', 'zh-Hant': 'zh-HK', hi: 'hi-IN', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE' };
  return map[LOCALE] || 'en-US';
}
function t(key, vars) {
  const ov = (window.I18N_OVERRIDES || {})[LOCALE] || {};
  const base = window.I18N_BASE || {};
  let s = ov[key] !== undefined ? ov[key] : (base[key] !== undefined ? base[key] : key);
  if (vars) { for (const k in vars) s = s.split('{' + k + '}').join(vars[k]); }
  return s;
}
function applyI18n() {
  document.documentElement.lang = LOCALE;
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-title]').forEach((n) => { n.title = t(n.getAttribute('data-i18n-title')); });
  const md = document.querySelector('meta[data-i18n-meta]');
  if (md) md.content = t(md.getAttribute('data-i18n-meta'));
  syncThemeButton();
  document.title = t('meta_title');
}
function initLocale() {
  let stored = null;
  try { stored = localStorage.getItem('apis-sendafun-lang'); } catch (e) {}
  LOCALE = SUPPORTED_LOCALES.indexOf(stored) > -1 ? stored : 'en';
  const sel = document.getElementById('langSelect');
  if (sel) {
    sel.innerHTML = '';
    SUPPORTED_LOCALES.forEach((l) => {
      const o = document.createElement('option');
      o.value = l;
      o.textContent = LOCALE_NAMES[l] || l;
      sel.appendChild(o);
    });
    sel.value = LOCALE;
  }
}
function setLocale(l) {
  if (SUPPORTED_LOCALES.indexOf(l) === -1) l = 'en';
  LOCALE = l;
  try { localStorage.setItem('apis-sendafun-lang', l); } catch (e) {}
  applyI18n();
  // 重新渲染动态部分
  populateCategoryFilter();
  renderCategoryChips();
  applyFilters(true);
  loadVisitorCount();
  loadCommunity();
}

/* ---------- 状态 ---------- */
var state = {
  all: [], categories: [], community: [],
  query: '', category: 'all', auth: 'all', https: 'all', cors: 'all',
  page: 1, loading: true, error: null, current: null,
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
  const tCur = document.getElementById('toast');
  tCur.textContent = msg;
  tCur.classList.toggle('error', !!isError);
  tCur.classList.toggle('success', !isError);
  tCur.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => tCur.classList.remove('show'), 2600);
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
      if (m.updatedAt) { const d = new Date(m.updatedAt); upd.textContent = t('data_updated', { d: d.toLocaleDateString(localeTag()) }); }
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
  if (!sel) return;
  sel.innerHTML = '';
  const all = el('option', null, t('f_all')); all.value = 'all'; sel.appendChild(all);
  state.categories.forEach((c) => { const o = el('option', null, c); o.value = c; sel.appendChild(o); });
}
function renderCategoryChips() {
  const wrap = document.getElementById('categoryChips');
  if (!wrap) return;
  wrap.innerHTML = '';
  state.categories.forEach((c) => {
    const chip = el('button', 'chip' + (state.category === c ? ' active' : ''), c);
    chip.type = 'button';
    chip.dataset.cat = c;
    chip.addEventListener('click', () => {
      state.category = state.category === c ? 'all' : c;
      const sel = document.getElementById('filterCategory');
      if (sel) sel.value = state.category;
      renderCategoryChips();
      applyFilters(true);
    });
    wrap.appendChild(chip);
  });
}
function fillCategoryDatalist() {
  const dl = document.getElementById('catlist');
  if (!dl) return;
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
    state.loading ? t('loading') : t('result_count', { n: fmtNum(f.length) });
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
  else badges.appendChild(el('span', 'badge badge-ok', t('badge_noauth')));
  if (api.https) badges.appendChild(el('span', 'badge badge-ok', 'HTTPS'));
  else badges.appendChild(el('span', 'badge badge-bad', t('badge_nohttps')));
  top.appendChild(title);
  top.appendChild(badges);
  card.appendChild(top);

  const desc = el('p', 'card-desc', api.description || '');
  card.appendChild(desc);

  const tags = el('div', 'tags');
  tags.appendChild(el('span', 'tag tag-accent', api.category || 'Other'));
  tags.appendChild(el('span', 'tag ' + corsClass(api.cors), 'CORS: ' + (api.cors || 'unknown')));
  if (api.source === 'community') tags.appendChild(el('span', 'tag tag-warn', t('tag_community')));
  card.appendChild(tags);

  const actions = el('div', 'card-actions');
  const btnDetail = el('button', 'btn btn-primary', t('btn_view'));
  btnDetail.type = 'button';
  btnDetail.addEventListener('click', (e) => { e.stopPropagation(); openDetail(api); });
  const btnCurl = el('button', 'btn', t('btn_copy_curl'));
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
  if (!grid) return;
  grid.innerHTML = '';
  const empty = document.getElementById('empty');
  empty.hidden = false;
  empty.textContent = t('load_error');
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
  nav.appendChild(mk(t('prev'), false, state.page <= 1, () => { if (state.page > 1) { state.page--; applyFilters(false); } }));
  const win = getPageWindow(state.page, totalPages);
  win.forEach((p) => {
    if (p === '…') nav.appendChild(el('span', 'page-ellipsis', '…'));
    else nav.appendChild(mk(String(p), p === state.page, false, () => { state.page = p; applyFilters(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  });
  nav.appendChild(mk(t('next'), false, state.page >= totalPages, () => { if (state.page < totalPages) { state.page++; applyFilters(false); } }));
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
  let d; try { d = new URL(api.link); } catch (e) { d = null; }
  const host = d ? d.hostname : api.link;
  body.innerHTML = '';
  body.appendChild(detailHeader(api, host));
  body.appendChild(el('div', 'tag', api.category || 'Other'));
  body.appendChild(healthBox());
  body.appendChild(el('h3', 'dl-h3', t('detail_playground')));
  body.appendChild(playgroundBox(api));
  body.appendChild(el('h3', 'dl-h3', t('detail_code')));
  body.appendChild(codegenBox(api));
  body.appendChild(el('h3', 'dl-h3', t('detail_info')));
  body.appendChild(infoGrid(api));
  bindCopyButtons(body);
}
function detailHeader(api, host) {
  const box = el('div', 'dl-header');
  const title = el('h2', 'dl-title', api.name);
  const link = el('a', 'dl-url', host);
  link.href = api.link; link.target = '_blank'; link.rel = 'noopener noreferrer';
  box.appendChild(title);
  box.appendChild(link);
  box.appendChild(el('p', 'dl-desc', api.description || ''));
  return box;
}
function healthBox() {
  const box = el('div', 'health');
  box.innerHTML = `
    <div class="health-summary">
      <span id="healthStatus" class="health-status">${esc(t('health_checking'))}</span>
      <button id="healthBtn" class="btn" type="button">${esc(t('health_retry'))}</button>
    </div>`;
  return box;
}
function infoGrid(api) {
  const g = el('div', 'info-grid');
  const row = (k, v) => { const r = el('div', 'info-row'); r.appendChild(el('span', 'info-k', k)); r.appendChild(el('span', 'info-v', v)); return r; };
  g.appendChild(row(t('f_category'), api.category || '—'));
  g.appendChild(row(t('f_auth'), api.auth || t('detail_noauth')));
  g.appendChild(row('HTTPS', api.https ? 'Yes' : 'No'));
  g.appendChild(row('CORS', api.cors || 'Unknown'));
  g.appendChild(row(t('detail_official'), ''));
  const lk = g.lastChild.querySelector('.info-v');
  const a = el('a', null, api.link); a.href = api.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
  lk.textContent = ''; lk.appendChild(a);
  return g;
}

/* ---------- 健康探测 ---------- */
async function checkHealth(url) {
  const st = document.getElementById('healthStatus');
  if (!st) return;
  st.textContent = t('health_checking'); st.className = 'health-status';
  try {
    const r = await fetch('/api/health?url=' + encodeURIComponent(url));
    const data = await r.json();
    if (!data || !data.ok) { st.textContent = t('health_fail'); st.className = 'health-status dead'; return; }
    if (data.alive) {
      st.textContent = t('health_alive', { ms: data.timeMs, t: fmtClock(data.checkedAt) });
      st.className = 'health-status alive';
    } else {
      st.textContent = t('health_dead') + (data.error ? ' · ' + data.error : '');
      st.className = 'health-status dead';
    }
  } catch (e) {
    st.textContent = t('health_fail'); st.className = 'health-status dead';
  }
  const btn = document.getElementById('healthBtn');
  if (btn) { btn.disabled = false; btn.textContent = t('health_retry'); }
}
function fmtClock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' });
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
      <button id="pgSend" class="btn btn-primary" type="button">${esc(t('pg_send'))}</button>
    </div>
    <div class="pg-headers">
      <div class="pg-hd-label">${esc(t('pg_headers'))}</div>
      <div id="pgHeaderList" class="pg-header-list"></div>
      <button id="pgAddHeader" class="btn btn-sm" type="button">${esc(t('pg_add_header'))}</button>
    </div>
    <div class="pg-body">
      <label class="pg-hd-label" for="pgBody">${esc(t('pg_body'))}</label>
      <textarea id="pgBody" class="pg-body-input" rows="4" spellcheck="false" placeholder='{"key":"value"}'></textarea>
    </div>
    <div id="pg-result" class="pg-result" hidden>
      <div class="pg-meta" id="pgMeta"></div>
      <pre id="pgOut" class="pg-out"></pre>
    </div>`;
  const list = box.querySelector('#pgHeaderList');
  if (api.auth) {
    addHeaderRow(list);
    const inp = list.querySelector('input[name=hval]');
    if (inp) inp.placeholder = 'Bearer YOUR_KEY';
    const key = list.querySelector('input[name=hkey]');
    if (key) { key.value = 'Authorization'; key.readOnly = true; }
  }
  const bodyEl = box.querySelector('.pg-body');
  if (bodyEl) bodyEl.style.display = api.auth === '' ? 'none' : 'block';
  const pgBody = box.querySelector('#pgBody');
  if (pgBody) pgBody.style.display = api.https === false ? 'none' : 'block';
  return box;
}
function addHeaderRow(list, key, val) {
  const row = el('div', 'pg-header-row');
  const k = el('input', 'pg-hk'); k.name = 'hkey'; k.placeholder = t('pg_header');
  const v = el('input', 'pg-hv'); v.name = 'hval'; v.placeholder = t('pg_value');
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
  out.textContent = t('pg_sending');
  meta.textContent = '';
  document.getElementById('pg-result').hidden = false;
  sendBtn.disabled = true;
  sendBtn.textContent = t('pg_sending');
  const headers = Array.from(document.querySelectorAll('#pgHeaderList .pg-header-row'))
    .map((r) => ({ key: r.querySelector('input[name=hkey]').value.trim(), value: r.querySelector('input[name=hval]').value.trim() }))
    .filter((h) => h.key);
  const body = document.getElementById('pgBody').value;
  const contentType = getContentType(headers);
  try {
    const resp = await fetch('/api/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, url, headers, body, contentType }),
    });
    const data = await resp.json();
    if (data.ok) {
      meta.textContent = t('pg_status') + ': ' + (data.status || '-') + ' ' + (data.statusText || '') +
        ' · ' + t('pg_size') + ': ' + fmtBytes(data.size);
      out.textContent = data.body || data.error || t('pg_empty');
      out.className = data.error ? 'pg-out err' : 'pg-out';
    } else {
      meta.textContent = '';
      out.textContent = data.error || t('pg_proxy');
      out.className = 'pg-out err';
    }
  } catch (e) {
    meta.textContent = '';
    out.textContent = t('pg_reqfail') + ': ' + e.message;
    out.className = 'pg-out err';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = t('pg_send');
  }
}
function getContentType(headers) {
  const c = headers.find((h) => h.key.toLowerCase() === 'content-type');
  return c ? c.value : 'application/json';
}
function fmtBytes(n) {
  n = Number(n || 0);
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}
function initPlayground(api) {
  const box = document.getElementById('detailBody').querySelector('.pg');
  if (!box) return;
  box.querySelector('#pgAddHeader').addEventListener('click', () => addHeaderRow(box.querySelector('#pgHeaderList')));
  box.querySelector('#pgSend').addEventListener('click', sendPlayground);
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
  const copyBtn = el('button', 'btn', t('code_copy'));
  copyBtn.type = 'button';
  copyBtn.addEventListener('click', () => copyText(code.textContent).then((ok) => showToast(ok ? t('code_copied') : t('code_failcopy'), !ok)));
  const head = el('div', 'code-head');
  head.appendChild(el('span', 'code-head-label', t('code_label')));
  head.appendChild(copyBtn);
  box.appendChild(tabs);
  box.appendChild(head);
  box.appendChild(pre);
  box._code = code;
  box._gen = () => generateCode(api, getPgConfig(), box.querySelector('.code-tab.active').dataset.lang);
  refreshCode(box);
  tabs.addEventListener('click', (e) => {
    const target = e.target.closest('.code-tab');
    if (!target) return;
    tabs.querySelectorAll('.code-tab').forEach((x) => x.classList.remove('active'));
    target.classList.add('active');
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
  try { box._code.textContent = box._gen(); }
  catch (e) { box._code.textContent = '// ' + t('code_gen_fail') + ': ' + e.message; }
}
function generateCode(api, cfg, lang) {
  const m = cfg.method || 'GET';
  const u = cfg.url || api.link;
  const headers = cfg.headers || [];
  const body = cfg.body || '';
  const hasBody = !!body;
  const contentType = (() => { const c = headers.find((h) => h.key.toLowerCase() === 'content-type'); return (c && c.value) || 'application/json'; })();
  const curlHeaders = [];
  if (contentType) curlHeaders.push(`  -H "Content-Type: ${contentType}"`);
  headers.forEach((h) => { curlHeaders.push(`  -H "${h.key}: ${h.value}"`); });
  const axiosHeaders = JSON.stringify(headers.reduce((o, h) => { o[h.key] = h.value; return o; }, /(POST|PUT|PATCH)/.test(m) ? { 'Content-Type': contentType } : {}));
  switch (lang) {
    case 'fetch':
      return `fetch("${u}", {\n  method: "${m}",\n  headers: ${JSON.stringify(headers.reduce((o,h)=>{o[h.key]=h.value;return o;},{}), null, 2).replace(/\n/g, '\n  ')},\n${hasBody ? `  body: JSON.stringify(${body || '{}'}),\n` : ''}).then(r => r.json()).then(console.log);`;
    case 'axios':
      return `const axios = require('axios');\nconst res = await axios({\n  method: "${m}",\n  url: "${u}",\n  headers: ${axiosHeaders},\n${hasBody ? `  data: ${body || '{}'},\n` : ''}});\nconsole.log(res.data);`;
    case 'python':
      return `import requests\n\nurl = "${u}"\nheaders = ${JSON.stringify(headers.reduce((o,h)=>{o[h.key]=h.value;return o;},{}))}\n${hasBody ? `payload = ${body || '{}'}\n` : ''}r = requests.request("${m}", url, headers=headers${hasBody ? ', json=payload' : ''})\nprint(r.status_code, r.text)`;
    case 'curl':
    default:
      return `curl -X ${m} "${u}" \\\n${curlHeaders.join(' \\\n')}${hasBody ? ` \\\n  -d '${body.replace(/'/g, "\\'")}'` : ''}`;
  }
}
function bindCopyButtons(body) { void body; }

/* ============================================================
   提交 API
   ============================================================ */
async function submitApi(formData) {
  try {
    const resp = await fetch('/api/submit', { method: 'POST', body: formData });
    const data = await resp.json();
    if (data.ok) {
      showToast(data.duplicate ? t('toast_submit_dup') : t('toast_submit_ok'), data.duplicate);
      closeSubmit();
    } else {
      showToast(data.error || t('toast_submit_fail'), true);
    }
  } catch (e) {
    showToast(t('toast_submit_fail') + ': ' + e.message, true);
  }
}
function closeSubmit() { document.getElementById('submitModal').hidden = true; document.body.classList.remove('modal-open'); }

/* ============================================================
   访客统计（自托管 KV）
   ============================================================ */
function loadVisitorCount() {
  const wrap = document.getElementById('visitorCount');
  if (!wrap) return;
  fetch('/api/counter', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => {
      if (d && d.ok) {
        wrap.classList.remove('placeholder');
        wrap.textContent = t('visitor_fmt', { pv: fmtNum(d.total.pv), today: fmtNum(d.today.pv) });
        if (d.today.uv) wrap.textContent += t('visitor_uv', { n: fmtNum(d.today.uv) });
        document.getElementById('statPv').textContent = fmtNum(d.total.pv);
        document.getElementById('statToday').textContent = fmtNum(d.today.pv);
      }
    })
    .catch(() => { wrap.textContent = ''; });
}

/* ============================================================
   社区已审 API
   ============================================================ */
function loadCommunity() {
  fetch('/api/community', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => { state.community = d && d.ok ? (d.items || []) : []; renderCommunity(); })
    .catch(() => { state.community = []; renderCommunity(); });
}
function renderCommunity() {
  const sec = document.getElementById('community');
  const grid = document.getElementById('communityGrid');
  const empty = document.getElementById('communityEmpty');
  if (!sec || !grid) return;
  grid.innerHTML = '';
  if (!state.community.length) { sec.hidden = true; return; }
  sec.hidden = false;
  empty.hidden = state.community.length > 0;
  state.community.forEach((a) => {
    if (!a || !a.name || !a.url) return;
    const card = el('article', 'card');
    const top = el('div', 'card-top');
    const title = el('div', 'card-title');
    const link = el('a', 'linklike', a.name);
    link.href = a.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    title.appendChild(link);
    top.appendChild(title);
    const badges = el('div', 'badges');
    badges.appendChild(el('span', 'badge badge-warn', t('tag_community')));
    if (a.auth) badges.appendChild(el('span', 'badge badge-warn', '🔑 ' + a.auth));
    else badges.appendChild(el('span', 'badge badge-ok', t('badge_noauth')));
    top.appendChild(badges);
    card.appendChild(top);
    card.appendChild(el('p', 'card-desc', a.description || ''));
    const tags = el('div', 'tags');
    tags.appendChild(el('span', 'tag tag-accent', a.category || 'Other'));
    card.appendChild(tags);
    const actions = el('div', 'card-actions');
    const btn = el('button', 'btn btn-primary', t('btn_copy_curl'));
    btn.type = 'button';
    btn.dataset.curl = a.name + '|' + a.url + '|' + (a.auth ? '1' : '0');
    actions.appendChild(btn);
    card.appendChild(actions);
    grid.appendChild(card);
  });
}

/* ============================================================
   主题
   ============================================================ */
function syncThemeButton() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? t('theme_light') : t('theme_dark');
}
function initTheme() {
  let stored = null;
  try { stored = localStorage.getItem('apis-sendafun-theme'); } catch (e) {}
  const theme = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(theme);
}
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  syncThemeButton();
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
  const items = [[t('aff_vps'), 'vps cloud hosting'], [t('aff_books'), 'programming books'], [t('aff_keyboard'), 'mechanical keyboard']];
  c.innerHTML = '';
  items.forEach((it, i) => {
    const a = el('a', null, it[0]);
    a.href = 'https://www.amazon.com/s?k=' + encodeURIComponent(it[1]) + '&tag=' + encodeURIComponent(AMAZON_TAG);
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    c.appendChild(a);
    if (i < items.length - 1) c.appendChild(document.createTextNode(' · '));
  });
}

/* ============================================================
   隐藏管理后台（#admin，无公开入口，需密码登录）
   ============================================================ */
function isAdminRoute() { return window.location.hash === '#admin'; }

function handleRoute() {
  const home = document.getElementById('view-home');
  const c = document.getElementById('community');
  let adm = document.getElementById('admin');
  if (isAdminRoute()) {
    if (c) c.hidden = true;
    home.style.display = 'none';
    if (!adm) { ensureAdmin(); adm = document.getElementById('admin'); }
    adminAuth();
  } else {
    if (adm) adm.remove();
    home.style.display = '';
  }
}

function ensureAdmin() {
  const sec = document.createElement('section');
  sec.id = 'admin';
  sec.className = 'admin';
  sec.innerHTML = '<div class="admin-card"><div id="adminContent"></div></div>';
  const container = document.querySelector('.container');
  container.appendChild(sec);
}

function adminAuth() {
  const content = document.getElementById('adminContent');
  if (!content) return;
  content.innerHTML = '<div class="admin-loading">…</div>';
  fetch('/api/admin/pending', { credentials: 'include' })
    .then((r) => r.json())
    .then((d) => { d && d.ok ? renderAdminPanel(d.items || []) : renderAdminLogin(); })
    .catch(() => renderAdminLogin());
}

function renderAdminLogin() {
  const content = document.getElementById('adminContent');
  if (!content) return;
  content.innerHTML = `
    <div class="admin-head">
      <h2 class="admin-title">🔒 ${esc(t('admin_login_label'))}</h2>
      <button type="button" class="admin-btn admin-back" id="adminBack">← ${esc(t('admin_back'))}</button>
    </div>
    <form id="adminLoginForm" class="admin-form">
      <input id="adminPass" type="password" class="admin-input" placeholder="${esc(t('admin_pass_ph'))}" autocomplete="current-password">
      <button type="submit" class="btn btn-primary" id="adminLoginBtn">${esc(t('admin_login'))}</button>
    </form>
    <p id="adminLoginErr" class="admin-error" hidden></p>`;
  const back = content.querySelector('#adminBack');
  if (back) back.addEventListener('click', () => { location.hash = ''; });
  content.querySelector('#adminLoginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = content.querySelector('#adminPass').value;
    adminLoginSubmit(pw, content);
  });
}
function adminLoginSubmit(pw, content) {
  const err = content.querySelector('#adminLoginErr');
  const btn = content.querySelector('#adminLoginBtn');
  if (err) err.hidden = true;
  if (btn) btn.disabled = true;
  fetch('/api/admin/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (d && d.ok) { adminAuth(); }
      else { if (err) { err.hidden = false; err.textContent = t('admin_wrong'); } if (btn) btn.disabled = false; }
    })
    .catch(() => { if (err) { err.hidden = false; err.textContent = t('admin_wrong'); } if (btn) btn.disabled = false; });
}

function renderAdminPanel(pending) {
  const content = document.getElementById('adminContent');
  if (!content) return;
  const head = el('div', 'admin-head');
  head.appendChild(el('h2', 'admin-title', '🛠 ' + t('admin_title')));
  const logout = el('button', 'admin-btn admin-back', t('admin_logout') + ' · ' + t('admin_back'));
  logout.type = 'button';
  logout.addEventListener('click', () => { location.hash = ''; });
  head.appendChild(logout);
  content.appendChild(head);

  const sub = el('p', 'admin-sub', t('admin_pending_title') + ' (' + pending.length + ')');
  content.appendChild(sub);

  const listWrap = el('div', 'admin-pending-list');
  if (!pending.length) {
    const nada = el('p', 'admin-empty', t('admin_pending_empty'));
    listWrap.appendChild(nada);
  } else {
    pending.forEach((item, idx) => listWrap.appendChild(adminItem(item, idx)));
  }
  content.appendChild(listWrap);
}

function adminItem(item, idx) {
  const row = el('div', 'admin-card-item');
  const info = el('div', 'admin-item-info');
  info.appendChild(el('div', 'admin-item-name', item.name || '(no name)'));
  if (item.description) info.appendChild(el('div', 'admin-item-desc', item.description));
  const meta = el('div', 'admin-item-meta');
  const cat = item.category || 'Other';
  meta.appendChild(el('span', 'tag tag-accent', cat));
  if (item.auth) meta.appendChild(el('span', 'tag tag-warn', '🔑 ' + item.auth));
  meta.appendChild(el('span', 'tag tag-ok', 'CORS: ' + (item.cors || 'unknown')));
  if (item.submittedAt) meta.appendChild(el('span', 'tag tag-warn', t('admin_submitted') + ': ' + new Date(item.submittedAt).toLocaleString(localeTag())));
  info.appendChild(meta);
  const link = el('a', 'admin-item-link', item.url);
  link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.textContent = item.url;
  info.appendChild(link);
  row.appendChild(info);

  const actions = el('div', 'admin-item-actions');
  actions.appendChild(adminActionBtn(t('admin_btn_approve'), 'approve', idx));
  actions.appendChild(adminActionBtn(t('admin_btn_reject'), 'reject', idx));
  actions.appendChild(adminActionBtn(t('admin_btn_delete'), 'delete', idx));
  row.appendChild(actions);
  return row;
}

function adminActionBtn(text, action, index) {
  const b = el('button', 'btn btn-sm ' + (action === 'approve' ? 'btn-primary' : action === 'reject' ? 'btn-warn' : 'btn-danger'), text);
  b.type = 'button';
  b.addEventListener('click', () => reviewAction(action, index));
  return b;
}

function reviewAction(action, index) {
  fetch('/api/admin/review', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, index }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (d && d.ok) { adminAuth(); loadCommunity(); }
      else { showToast(d && d.error ? d.error : action + ' failed', true); }
    })
    .catch(() => showToast(action + ' failed', true));
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

  document.getElementById('filterCategory').addEventListener('change', (e) => { state.category = e.target.value; renderCategoryChips(); applyFilters(true); });
  document.getElementById('filterAuth').addEventListener('change', (e) => { state.auth = e.target.value; applyFilters(true); });
  document.getElementById('filterHttps').addEventListener('change', (e) => { state.https = e.target.value; applyFilters(true); });
  document.getElementById('filterCors').addEventListener('change', (e) => { state.cors = e.target.value; applyFilters(true); });

  document.getElementById('langSelect').addEventListener('change', (e) => setLocale(e.target.value));

  document.getElementById('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'light' : 'dark'); track('theme_toggle', { theme: cur });
  });

  document.getElementById('grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-curl]');
    if (!btn) return;
    const [, url, auth] = btn.dataset.curl.split('|');
    const curl = `curl -X GET "${url}" -H "Accept: application/json"` + (auth === '1' ? ' -H "Authorization: <YOUR_API_KEY>"' : '');
    copyText(curl).then((ok) => { if (ok) { showToast(t('toast_copy_curl'), false); track('copy_curl', { url }); } else showToast(t('code_failcopy'), true); });
  });

  document.querySelectorAll('[data-open="submit"]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault(); document.getElementById('submitModal').hidden = false; document.body.classList.add('modal-open');
  }));
  document.querySelectorAll('[data-open="about"]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault(); const a = document.getElementById('about'); a.hidden = !a.hidden; a.scrollIntoView({ behavior: 'smooth' });
  }));
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
    const type = b.dataset.close;
    if (type === 'detail') closeDetail();
    if (type === 'submit') closeSubmit();
  }));
  document.querySelectorAll('[data-view="home"]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault(); window.location.hash = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); applyFilters(true);
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDetail(); closeSubmit(); } });

  document.getElementById('detailBody').addEventListener('click', (e) => {
    const btn = e.target.closest('#healthBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('health_checking');
      const st = document.getElementById('healthStatus');
      st.textContent = t('health_checking');
      checkHealth(detailApi.link).then(() => { btn.disabled = false; btn.textContent = t('health_retry'); });
    }
  });

  document.getElementById('submitForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submitApi(new FormData(e.target));
  });

  window.addEventListener('hashchange', handleRoute);
}

/* ---------- 启动 ---------- */
function boot() {
  initLocale();
  applyI18n();
  initGA4();
  initTheme();
  initAffiliate();
  wireEvents();
  handleRoute();
  loadData();
  loadVisitorCount();
  loadCommunity();
  track('page_view', { page_location: window.location.href });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();