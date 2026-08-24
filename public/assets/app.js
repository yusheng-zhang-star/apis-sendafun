/* ============================================================
   apis-sendafun — 公共 API 索引 + 在线调试 SPA
   功能：多语言(en/zh/zh-Hant)、搜索/筛选/分页、详情(健康探测/
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
   ============================================================ */
var I18N = {
  en: {
    meta_title: 'APIS SendAFun — Free Public API Index & Playground',
    meta_desc: 'Search, filter and test 1,600+ free public APIs online with health checks, a built-in playground and multi-language code snippets. Data from public-apis (MIT), updated daily.',
    theme_dark: 'Dark', theme_light: 'Light', close: 'Close',
    nav_home: 'Home', nav_submit: 'Submit API', nav_about: 'About',
    hero_title: 'Free Public API Index & Playground',
    hero_sub1: 'Search, filter, check health and test', hero_sub2: 'free public APIs online. Auto-synced daily.',
    stat_apis: 'APIs', stat_cats: 'Categories', stat_pv: 'Total Visits', stat_today: 'Today',
    search_ph: 'Search API name, description or category…',
    f_all: 'All', f_category: 'Category', f_auth: 'Auth', f_https: 'HTTPS', f_cors: 'CORS',
    f_need: 'Required', f_none: 'No auth', f_yes: 'Yes', f_no: 'No',
    f_supported: 'Supported', f_unsupported: 'Not supported', f_unknown: 'Unknown',
    loading: 'Loading…', result_count: '{n} APIs', data_updated: 'Updated {d}',
    empty_msg: 'No APIs match the current filters. Try clearing the search or adjusting filters.',
    load_error: 'Failed to load dataset, please retry later.',
    about_title: 'About this project',
    about_p1: 'apis.sendafun.com is an open-source index of free public APIs for developers — search, filter, health-check, online playground and multi-language code generation.',
    about_p2: 'Dataset source:', about_p3: 'License: this project is MIT; the API dataset follows the MIT License of public-apis.',
    community_title: 'Community APIs', community_sub: 'Reviewed and approved community submissions.', community_empty: 'No approved community APIs yet.',
    footer_open: 'Open-source project · API dataset from', footer_deps: 'Developer tools:', footer_noreg: 'No sign-up',
    submit_title: 'Submit a new free API',
    submit_name: 'API name', submit_url: 'Official / docs URL', submit_desc: 'Short description',
    submit_cat: 'Category', submit_email: 'Contact email (optional)',
    submit_ph_name: 'e.g. OpenWeather', submit_ph_url: 'https://…', submit_ph_desc: 'One sentence describing what this API does',
    submit_ph_cat: 'e.g. Weather', submit_ph_email: 'to receive review results',
    submit_btn: 'Submit', cancel: 'Cancel',
    badge_noauth: 'No auth', badge_nohttps: 'No HTTPS', tag_community: 'Community',
    btn_view: 'View / Test', btn_copy_curl: 'Copy cURL', btn_copy: 'Copy',
    prev: 'Prev', next: 'Next',
    detail_playground: '🔧 Online Playground', detail_code: '📋 Code Snippets', detail_info: 'ℹ️ Basic Info',
    detail_official: 'Official link', detail_noauth: 'No auth required',
    health_checking: 'Checking…', health_retry: 'Re-check', health_fail: 'Check failed',
    health_alive: '🟢 Online · {ms}ms · {t}', health_dead: '🔴 Unreachable',
    pg_headers: 'Headers', pg_add_header: '+ Add header', pg_body: 'Body (JSON)',
    pg_send: 'Send', pg_sending: 'Sending…', pg_header: 'Header', pg_value: 'Value',
    pg_status: 'Status', pg_size: 'Size', pg_empty: '(empty response)', pg_proxy: 'Proxy error', pg_reqfail: 'Request failed',
    code_label: 'Multi-language', code_copy: 'Copy', code_copied: 'Copied to clipboard', code_failcopy: 'Copy failed', code_gen_fail: 'Unable to generate',
    toast_submit_ok: 'Submitted! It will be reviewed by the moderation queue.', toast_submit_dup: 'This API is already in the queue.', toast_submit_fail: 'Submission failed',
    toast_copy_curl: 'cURL copied', visitor_loading: 'Loading visits…',
    visitor_fmt: '{pv} visits · {today} today', visitor_uv: ' · {n} people',
    aff_vps: 'Cloud hosting', aff_books: 'Programming books', aff_keyboard: 'Mechanical keyboard',
    admin_title: 'Admin — API Review',
    admin_login_label: 'Administrator login', admin_pass_ph: 'Password', admin_login: 'Login',
    admin_wrong: 'Wrong password', admin_pending_title: 'Pending submissions', admin_pending_empty: 'No pending submissions.',
    admin_approved_label: 'Approved', admin_btn_approve: '✅ Approve', admin_btn_reject: '❌ Reject', admin_btn_delete: '🗑 Delete',
    admin_logout: 'Logout', admin_back: 'Back to site', admin_view: 'View',
    admin_source: 'Source', admin_submitted: 'Submitted', admin_category: 'Category'
  },

  zh: {
    meta_title: 'APIS SendAFun — 全球免费公共 API 索引与在线调试平台',
    meta_desc: '在线搜索、筛选、检测并调试 1,600+ 个免费公共 API，支持健康检测、在线 Playground 与多语言代码生成。数据来自 public-apis（MIT），每日自动更新。',
    theme_dark: '暗色', theme_light: '浅色', close: '关闭',
    nav_home: '首页', nav_submit: '提交 API', nav_about: '关于',
    hero_title: '全球免费公共 API 索引与调试平台',
    hero_sub1: '搜索、筛选、检测并在线调试', hero_sub2: '个免费公共 API，每日自动同步更新。',
    stat_apis: 'API 总数', stat_cats: '分类', stat_pv: '累计访问', stat_today: '今日访问',
    search_ph: '搜索 API 名称、描述或分类…',
    f_all: '全部', f_category: '分类', f_auth: '鉴权', f_https: 'HTTPS', f_cors: 'CORS',
    f_need: '需要', f_none: '无需', f_yes: '是', f_no: '否',
    f_supported: '支持', f_unsupported: '不支持', f_unknown: '未知',
    loading: '加载中…', result_count: '{n} 个 API', data_updated: '数据更新于 {d}',
    empty_msg: '没有符合筛选条件的 API，可尝试清空搜索或调整筛选条件。',
    load_error: '数据集加载失败，请稍后重试。',
    about_title: '关于本项目',
    about_p1: 'apis.sendafun.com 是一个开源的免费公共 API 索引平台，面向开发者提供搜索、筛选、健康检测、在线 Playground 调试与多语言代码生成能力。',
    about_p2: '数据集来源：', about_p3: '数据许可：本项目代码 MIT License；API 数据集遵循 public-apis 的 MIT License。',
    community_title: '社区 API', community_sub: '经人工审核通过的社区提交接口。', community_empty: '暂无已审核通过的社区 API。',
    footer_open: '开源项目 · API 数据集来自', footer_deps: '开发者必备工具：', footer_noreg: '无需注册',
    submit_title: '提交新的免费 API',
    submit_name: 'API 名称', submit_url: '官方 / 文档链接', submit_desc: '简要描述',
    submit_cat: '分类', submit_email: '联系邮箱（可选）',
    submit_ph_name: '例如：OpenWeather', submit_ph_url: 'https://…', submit_ph_desc: '用一句话描述这个 API 的用途',
    submit_ph_cat: '例如：Weather', submit_ph_email: '用于接收审核结果',
    submit_btn: '提交', cancel: '取消',
    badge_noauth: '免鉴权', badge_nohttps: '无 HTTPS', tag_community: '社区',
    btn_view: '查看 / 调试', btn_copy_curl: '复制 cURL', btn_copy: '复制',
    prev: '上一页', next: '下一页',
    detail_playground: '🔧 在线 Playground', detail_code: '📋 代码片段', detail_info: 'ℹ️ 基本信息',
    detail_official: '官方链接', detail_noauth: '无需鉴权',
    health_checking: '检测中…', health_retry: '重新检测', health_fail: '检测失败',
    health_alive: '🟢 可用 · {ms}ms · {t}', health_dead: '🔴 不可达',
    pg_headers: '请求头', pg_add_header: '+ 添加请求头', pg_body: 'Body (JSON)',
    pg_send: '发送', pg_sending: '发送中…', pg_header: 'Header', pg_value: 'Value',
    pg_status: '状态', pg_size: '大小', pg_empty: '（空响应）', pg_proxy: '代理错误', pg_reqfail: '请求失败',
    code_label: '多语言代码', code_copy: '复制', code_copied: '已复制到剪贴板', code_failcopy: '复制失败', code_gen_fail: '无法生成',
    toast_submit_ok: '提交成功，将进入人工审核队列', toast_submit_dup: '该 API 已在待审队列中，无需重复提交', toast_submit_fail: '提交失败',
    toast_copy_curl: 'cURL 已复制', visitor_loading: '加载访问量…',
    visitor_fmt: '{pv} 次访问 · {today} 今日', visitor_uv: ' · {n} 人',
    aff_vps: '云主机', aff_books: '技术书籍', aff_keyboard: '机械键盘',
    admin_title: '管理后台 — API 审核',
    admin_login_label: '管理员登录', admin_pass_ph: '密码', admin_login: '登录',
    admin_wrong: '密码错误', admin_pending_title: '待审核提交', admin_pending_empty: '暂无待审核提交。',
    admin_approved_label: '已通过', admin_btn_approve: '✅ 通过', admin_btn_reject: '❌ 拒绝', admin_btn_delete: '🗑 删除',
    admin_logout: '退出登录', admin_back: '返回网站', admin_view: '查看',
    admin_source: '来源', admin_submitted: '提交时间', admin_category: '分类'
  },

  'zh-Hant': {
    meta_title: 'APIS SendAFun — 全球免費公共 API 索引與線上調試平台',
    meta_desc: '線上搜尋、篩選、檢測並調試 1,600+ 個免費公共 API，支援健康檢測、線上 Playground 與多語言程式碼產生。資料來自 public-apis（MIT），每日自動更新。',
    theme_dark: '暗色', theme_light: '淺色', close: '關閉',
    nav_home: '首頁', nav_submit: '提交 API', nav_about: '關於',
    hero_title: '全球免費公共 API 索引與調試平台',
    hero_sub1: '搜尋、篩選、檢測並線上調試', hero_sub2: '個免費公共 API，每日自動同步更新。',
    stat_apis: 'API 總數', stat_cats: '分類', stat_pv: '累計訪問', stat_today: '今日訪問',
    search_ph: '搜尋 API 名稱、描述或分類…',
    f_all: '全部', f_category: '分類', f_auth: '鑑權', f_https: 'HTTPS', f_cors: 'CORS',
    f_need: '需要', f_none: '無需', f_yes: '是', f_no: '否',
    f_supported: '支援', f_unsupported: '不支援', f_unknown: '未知',
    loading: '載入中…', result_count: '{n} 個 API', data_updated: '資料更新於 {d}',
    empty_msg: '沒有符合篩選條件的 API，可嘗試清空搜尋或調整篩選條件。',
    load_error: '資料集載入失敗，請稍後重試。',
    about_title: '關於本專案',
    about_p1: 'apis.sendafun.com 是一個開源的免費公共 API 索引平台，面向開發者提供搜尋、篩選、健康檢測、線上 Playground 調試與多語言程式碼產生能力。',
    about_p2: '資料集來源：', about_p3: '資料許可：本專案程式碼 MIT License；API 資料集遵循 public-apis 的 MIT License。',
    community_title: '社群 API', community_sub: '經人工審核通過的社群提交介面。', community_empty: '暫無已審核通過的社群 API。',
    footer_open: '開源專案 · API 資料集來自', footer_deps: '開發者必備工具：', footer_noreg: '無需註冊',
    submit_title: '提交新的免費 API',
    submit_name: 'API 名稱', submit_url: '官方 / 文件連結', submit_desc: '簡要描述',
    submit_cat: '分類', submit_email: '聯絡信箱（可選）',
    submit_ph_name: '例如：OpenWeather', submit_ph_url: 'https://…', submit_ph_desc: '用一句話描述這個 API 的用途',
    submit_ph_cat: '例如：Weather', submit_ph_email: '用於接收審核結果',
    submit_btn: '提交', cancel: '取消',
    badge_noauth: '免鑑權', badge_nohttps: '無 HTTPS', tag_community: '社群',
    btn_view: '查看 / 調試', btn_copy_curl: '複製 cURL', btn_copy: '複製',
    prev: '上一頁', next: '下一頁',
    detail_playground: '🔧 線上 Playground', detail_code: '📋 程式碼片段', detail_info: 'ℹ️ 基本資訊',
    detail_official: '官方連結', detail_noauth: '無需鑑權',
    health_checking: '檢測中…', health_retry: '重新檢測', health_fail: '檢測失敗',
    health_alive: '🟢 可用 · {ms}ms · {t}', health_dead: '🔴 不可達',
    pg_headers: '請求頭', pg_add_header: '+ 新增請求頭', pg_body: 'Body (JSON)',
    pg_send: '傳送', pg_sending: '傳送中…', pg_header: 'Header', pg_value: 'Value',
    pg_status: '狀態', pg_size: '大小', pg_empty: '（空回應）', pg_proxy: '代理錯誤', pg_reqfail: '請求失敗',
    code_label: '多語言程式碼', code_copy: '複製', code_copied: '已複製到剪貼簿', code_failcopy: '複製失敗', code_gen_fail: '無法產生',
    toast_submit_ok: '提交成功，將進入人工審核佇列', toast_submit_dup: '該 API 已在待審佇列中，無需重複提交', toast_submit_fail: '提交失敗',
    toast_copy_curl: 'cURL 已複製', visitor_loading: '載入訪問量…',
    visitor_fmt: '{pv} 次訪問 · {today} 今日', visitor_uv: ' · {n} 人',
    aff_vps: '雲主機', aff_books: '技術書籍', aff_keyboard: '機械鍵盤',
    admin_title: '管理後台 — API 審核',
    admin_login_label: '管理員登入', admin_pass_ph: '密碼', admin_login: '登入',
    admin_wrong: '密碼錯誤', admin_pending_title: '待審核提交', admin_pending_empty: '暫無待審核提交。',
    admin_approved_label: '已通過', admin_btn_approve: '✅ 通過', admin_btn_reject: '❌ 拒絕', admin_btn_delete: '🗑 刪除',
    admin_logout: '登出', admin_back: '返回網站', admin_view: '查看',
    admin_source: '來源', admin_submitted: '提交時間', admin_category: '分類'
  }
};

var LOCALE = 'en';
function localeTag() { return LOCALE === 'zh' ? 'zh-CN' : LOCALE === 'zh-Hant' ? 'zh-HK' : 'en-US'; }
function t(key, vars) {
  const dict = I18N[LOCALE] || I18N.en;
  let s = dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
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
  LOCALE = ['en', 'zh', 'zh-Hant'].indexOf(stored) > -1 ? stored : 'en';
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = LOCALE;
}
function setLocale(l) {
  if (['en', 'zh', 'zh-Hant'].indexOf(l) === -1) l = 'en';
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
    <div class="pg-result" hidden>
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