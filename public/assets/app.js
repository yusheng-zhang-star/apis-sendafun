/* ============================================================
   apis-sendafun — Public API Directory (vanilla JS SPA)
   ============================================================ */

/* ---------- Config ---------- */

// Google Analytics 4 Measurement ID. Leave "" to disable GA4.
// Replace with your own ID, e.g. "G-XXXXXXXXXX".
var GA4_ID = '';

// Amazon Associates tag used for the footer text affiliate links.
// Replace with your own tag, e.g. "yourtag-20".
var AMAZON_TAG = 'amazon-tag-placeholder';

var PAGE_SIZE = 12;
var SEARCH_DEBOUNCE_MS = 200;

/* ---------- State ---------- */

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
};

/* ---------- DOM helpers ---------- */

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function escAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}

/* ---------- Toast ---------- */

var toastTimer = null;
function showToast(message, isError) {
  var t = document.getElementById('toast');
  t.textContent = message;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    t.classList.remove('show');
  }, 2200);
}

/* ---------- Clipboard ---------- */

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(
      function () { return true; },
      function () { return fallbackCopy(text); }
    );
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { ta.setSelectionRange(0, text.length); } catch (e) {}
  var ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/* ---------- Data loading ---------- */

function loadData() {
  fetch('data/apis.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      state.all = data.apis || [];
      state.categories = data.categories || [];
      var updated = data.meta && data.meta.updatedAt;
      var updatedEl = document.getElementById('updatedAt');
      if (updated) {
        var d = new Date(updated);
        updatedEl.textContent = 'dataset updated ' + d.toUTCString().replace('GMT', 'UTC');
      }
      populateCategoryFilter();
      state.loading = false;
      applyFilters(true);
    })
    .catch(function (err) {
      state.loading = false;
      state.error = err;
      renderError();
    });
}

function populateCategoryFilter() {
  var sel = document.getElementById('filterCategory');
  sel.innerHTML = '';
  var all = el('option', null, 'All');
  all.value = 'all';
  sel.appendChild(all);
  state.categories.forEach(function (c) {
    var o = el('option', null, c);
    o.value = c;
    sel.appendChild(o);
  });
}

/* ---------- Filtering ---------- */

function getFiltered() {
  var q = state.query.trim().toLowerCase();
  var out = [];
  for (var i = 0; i < state.all.length; i++) {
    var a = state.all[i];
    if (state.category !== 'all' && a.category !== state.category) continue;
    if (state.auth === 'yes' && !a.auth) continue;
    if (state.auth === 'no' && a.auth) continue;
    if (state.https === 'yes' && !a.https) continue;
    if (state.https === 'no' && a.https) continue;
    if (state.cors === 'yes' && a.cors !== 'yes') continue;
    if (state.cors === 'no' && a.cors !== 'no') continue;
    if (state.cors === 'unknown' && a.cors !== 'unknown') continue;
    if (q) {
      var hay = (a.name + ' ' + a.description + ' ' + a.category).toLowerCase();
      if (hay.indexOf(q) === -1) continue;
    }
    out.push(a);
  }
  return out;
}

/* ---------- Rendering ---------- */

function applyFilters(resetPage) {
  if (resetPage) state.page = 1;
  var filtered = getFiltered();
  var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;

  renderResultCount(filtered.length);
  if (!filtered.length) {
    renderEmpty();
    renderPagination(0);
    return;
  }
  renderGrid(filtered);
  renderPagination(totalPages);
}

function renderResultCount(count) {
  var elm = document.getElementById('resultCount');
  if (state.loading) {
    elm.textContent = 'Loading…';
  } else {
    elm.textContent = count.toLocaleString('en-US') + ' API' + (count === 1 ? '' : 's');
  }
}

function renderEmpty() {
  document.getElementById('grid').innerHTML = '';
  document.getElementById('empty').hidden = false;
}

function renderGrid(filtered) {
  document.getElementById('empty').hidden = true;
  var start = (state.page - 1) * PAGE_SIZE;
  var slice = filtered.slice(start, start + PAGE_SIZE);

  var grid = document.getElementById('grid');
  grid.innerHTML = '';

  slice.forEach(function (api) {
    grid.appendChild(buildCard(api));
  });
}

function buildCard(api) {
  var card = el('article', 'card');
  card.dataset.index = String(api.name + '|' + api.link);

  // top: title link
  var top = el('div', 'card-top');
  var title = el('div', 'card-title');
  var link = el('a', null, api.name);
  link.href = api.link;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  title.appendChild(link);
  top.appendChild(title);
  card.appendChild(top);

  // description
  var desc = el('p', 'card-desc', api.description);
  card.appendChild(desc);

  // tags
  var tags = el('div', 'tags');
  tags.appendChild(el('span', 'tag tag-accent', api.category));
  tags.appendChild(
    api.auth
      ? el('span', 'tag tag-warn', 'Auth: ' + api.auth)
      : el('span', 'tag tag-ok', 'No auth')
  );
  tags.appendChild(
    api.https
      ? el('span', 'tag tag-ok', 'HTTPS')
      : el('span', 'tag tag-bad', 'No HTTPS')
  );
  var corsClass = api.cors === 'yes' ? 'tag-ok' : api.cors === 'no' ? 'tag-bad' : 'tag-warn';
  tags.appendChild(el('span', 'tag ' + corsClass, 'CORS: ' + api.cors));
  card.appendChild(tags);

  // actions
  var actions = el('div', 'card-actions');
  var btnLink = el('button', 'btn', 'Copy link');
  btnLink.type = 'button';
  btnLink.dataset.action = 'copy-link';
  btnLink.dataset.url = api.link;
  var btnCurl = el('button', 'btn', 'Copy cURL');
  btnCurl.type = 'button';
  btnCurl.dataset.action = 'copy-curl';
  btnCurl.dataset.url = api.link;
  btnCurl.dataset.auth = api.auth ? '1' : '0';
  actions.appendChild(btnLink);
  actions.appendChild(btnCurl);
  card.appendChild(actions);

  return card;
}

function renderError() {
  document.getElementById('grid').innerHTML = '';
  document.getElementById('empty').hidden = false;
  var empty = document.getElementById('empty');
  empty.textContent = 'Failed to load the API dataset. Please try again later.';
  document.getElementById('resultCount').textContent = 'Error';
}

/* ---------- Pagination ---------- */

function renderPagination(totalPages) {
  var nav = document.getElementById('pagination');
  nav.innerHTML = '';
  if (!totalPages) return;

  var prev = el('button', 'page-btn', 'Prev');
  prev.type = 'button';
  prev.disabled = state.page <= 1;
  prev.addEventListener('click', function () {
    if (state.page > 1) { state.page--; applyFilters(false); track('pagination', { page: state.page }); }
  });
  nav.appendChild(prev);

  var pageNums = getPageWindow(state.page, totalPages);
  pageNums.forEach(function (p) {
    if (p === '…') {
      nav.appendChild(el('span', 'page-ellipsis', '…'));
    } else {
      var btn = el('button', 'page-btn', String(p));
      btn.type = 'button';
      if (p === state.page) btn.classList.add('active');
      btn.addEventListener('click', function () {
        state.page = p;
        applyFilters(false);
        track('pagination', { page: p });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      nav.appendChild(btn);
    }
  });

  var next = el('button', 'page-btn', 'Next');
  next.type = 'button';
  next.disabled = state.page >= totalPages;
  next.addEventListener('click', function () {
    if (state.page < totalPages) { state.page++; applyFilters(false); track('pagination', { page: state.page }); }
  });
  nav.appendChild(next);
}

function getPageWindow(current, total) {
  var pages = [];
  if (total <= 7) {
    for (var i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (current > 3) pages.push('…');
  for (var j = Math.max(2, current - 1); j <= Math.min(total - 1, current + 1); j++) pages.push(j);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

/* ---------- Theme ---------- */

function initTheme() {
  var stored = null;
  try { stored = localStorage.getItem('apis-sendafun-theme'); } catch (e) {}
  var theme = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(theme, false);
}

function setTheme(theme, trackEvent) {
  document.documentElement.setAttribute('data-theme', theme);
  var btn = document.getElementById('themeToggle');
  btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
  try { localStorage.setItem('apis-sendafun-theme', theme); } catch (e) {}
  if (trackEvent) track('theme_toggle', { theme: theme });
}

/* ---------- GA4 ---------- */

function initGA4() {
  if (!GA4_ID) return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID);
}

function track(event, params) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, params || {});
  }
}

/* ---------- Affiliate links ---------- */

function initAffiliate() {
  var container = document.getElementById('affiliateLinks');
  if (!container) return;
  var items = [
    ['VPS hosting', 'vps cloud hosting'],
    ['Programming books', 'programming books'],
    ['Mechanical keyboards', 'mechanical keyboard'],
  ];
  container.innerHTML = '';
  items.forEach(function (item, i) {
    var a = el('a', null, item[0]);
    a.href = 'https://www.amazon.com/s?k=' + encodeURIComponent(item[1]) + '&tag=' + encodeURIComponent(AMAZON_TAG);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    container.appendChild(a);
    if (i < items.length - 1) {
      var sep = document.createTextNode(' · ');
      container.appendChild(sep);
    }
  });
}

/* ---------- Event wiring ---------- */

function wireEvents() {
  var searchInput = document.getElementById('searchInput');
  var debounce;
  searchInput.addEventListener('input', function () {
    clearTimeout(debounce);
    var v = searchInput.value;
    debounce = setTimeout(function () {
      state.query = v;
      applyFilters(true);
    }, SEARCH_DEBOUNCE_MS);
  });

  document.getElementById('filterCategory').addEventListener('change', function (e) {
    state.category = e.target.value;
    applyFilters(true);
  });
  document.getElementById('filterAuth').addEventListener('change', function (e) {
    state.auth = e.target.value;
    applyFilters(true);
  });
  document.getElementById('filterHttps').addEventListener('change', function (e) {
    state.https = e.target.value;
    applyFilters(true);
  });
  document.getElementById('filterCors').addEventListener('change', function (e) {
    state.cors = e.target.value;
    applyFilters(true);
  });

  document.getElementById('themeToggle').addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark', true);
  });

  // click delegation: expand card + copy actions
  document.getElementById('grid').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (btn) {
      var url = btn.dataset.url;
      if (btn.dataset.action === 'copy-link') {
        copyText(url).then(function (ok) {
          showToast(ok ? 'Link copied to clipboard' : 'Copy failed', !ok);
          if (ok) track('copy_link', { url: url });
        });
      } else if (btn.dataset.action === 'copy-curl') {
        var hasAuth = btn.dataset.auth === '1';
        var curl = buildCurl(url, hasAuth);
        copyText(curl).then(function (ok) {
          showToast(ok ? 'cURL snippet copied' : 'Copy failed', !ok);
          if (ok) track('copy_curl', { url: url });
        });
      }
      e.stopPropagation();
      return;
    }
    var card = e.target.closest('.card');
    if (card) card.classList.toggle('expanded');
  });
}

function buildCurl(url, hasAuth) {
  var cmd = 'curl -X GET "' + url + '" -H "Accept: application/json"';
  if (hasAuth) cmd += ' -H "Authorization: <YOUR_API_KEY>"';
  return cmd;
}

/* ---------- Boot ---------- */

function boot() {
  initGA4();
  initTheme();
  initAffiliate();
  wireEvents();
  loadData();
  track('page_view', { page_location: window.location.href });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
