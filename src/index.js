/**
 * apis-sendafun — Cloudflare Worker 请求处理器
 *
 * 职责：
 *   - /api/counter  访客统计（自托管，彻底解决第三方统计不稳定问题）
 *   - /api/health   健康探测（详情页实时检测 API 可用性）
 *   - /api/playground  Playground 代理（绕过 CORS，含 SSRF 防护 / 超时 / 大小限制）
 *   - /api/submit   用户提交新 API（写入 KV 待审列表，去重）
 *   - /api/community  返回已审核通过的社区 API（公开只读）
 *   - /api/admin/login|pending|review  管理后台（仅管理员，Secret 密码 + 24h session）
 *   - 其余路径      交由静态资源 (ASSETS) 渲染 SPA
 */

const COUNTER_UV_TTL = 365 * 24 * 60 * 60; // 秒
const DAILY_UV_TTL = 3 * 24 * 60 * 60;
const SESSION_TTL = 24 * 60 * 60; // 24h
const HEALTH_TIMEOUT_MS = 8000;
const PLAYGROUND_TIMEOUT_MS = 9500;
const MAX_BODY_BYTES = 1024 * 1024; // 1MB

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const PENDING_KEY = 'submit:pending';
const APPROVED_KEY = 'submit:approved';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function getIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

const cookieHeader = (request, name) => {
  const list = (request.headers.get('Cookie') || '').split(';').map((s) => s.trim());
  const hit = list.find((s) => s.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
};

/* ---------- 私有 IP 判断（SSRF 防护） ---------- */
function isPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '').trim();
  if (!h) return true;
  if (h === 'localhost' || h === 'localtest.me' || h.endsWith('.local')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2], c = +m[3], d = +m[4];
    if (a >= 255 || b >= 255 || c >= 255 || d >= 255) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127 || a === 0) return true;
    if (a >= 224) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

function safeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isPrivateHost(u.hostname)) return null;
  return u;
}

async function clampResponse(res) {
  const cl = Number(res.headers.get('content-length') || 0);
  let size = cl || 0;
  let bodyText = '';
  if (cl > MAX_BODY_BYTES) {
    bodyText = '';
  } else {
    bodyText = await res.text();
    size = new Blob([bodyText]).size;
    if (size > MAX_BODY_BYTES) bodyText = bodyText.slice(0, MAX_BODY_BYTES);
  }
  const headers = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  return { bodyText, size, headers };
}

/* ---------- 访客统计 ---------- */
async function handleCounter(request, env) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const totalKey = 'ct:total';
  const dailyKey = 'ct:d:' + date;

  let uvid = cookieHeader(request, 'uvid');
  const isNewVisit = !uvid;

  const [totRaw, dayRaw] = await Promise.all([
    env.apisKV.get(totalKey, 'json'),
    env.apisKV.get(dailyKey, 'json'),
  ]);
  const total = totRaw || { pv: 0, uv: 0 };
  const today = dayRaw || { pv: 0, uv: 0 };

  total.pv = (total.pv || 0) + 1;
  today.pv = (today.pv || 0) + 1;

  if (isNewVisit) {
    uvid = 'v' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const uvKey = 'uv:' + uvid;
    if (!(await env.apisKV.get(uvKey))) {
      total.uv = (total.uv || 0) + 1;
      await env.apisKV.put(uvKey, '1', { expirationTtl: COUNTER_UV_TTL });
    }
    const dayUvKey = 'uvd:' + date + ':' + uvid;
    if (!(await env.apisKV.get(dayUvKey))) {
      today.uv = (today.uv || 0) + 1;
      await env.apisKV.put(dayUvKey, '1', { expirationTtl: DAILY_UV_TTL });
    }
  }

  await Promise.all([
    env.apisKV.put(totalKey, JSON.stringify(total)),
    env.apisKV.put(dailyKey, JSON.stringify(today)),
  ]);

  const res = json({ ok: true, total, today, visitor: uvid });
  if (isNewVisit) {
    res.headers.append('Set-Cookie',
      `uvid=${uvid}; Path=/; Max-Age=${COUNTER_UV_TTL}; SameSite=Lax; HttpOnly`);
  }
  return res;
}

/* ---------- 简单速率限制（基于 KV 的每 IP 滑动窗口） ---------- */
async function allowRequest(env, prefix, ip, maxReq, windowSec) {
  const key = prefix + ip;
  const now = Date.now();
  const rec = (await env.apisKV.get(key, 'json')) || { t: now, n: 0 };
  if (now - (rec.t || 0) > windowSec * 1000) rec.t = now, rec.n = 0;
  rec.n = (rec.n || 0) + 1;
  if (rec.n > maxReq) return false;
  await env.apisKV.put(key, JSON.stringify(rec), {
    expirationTtl: Math.max(60, windowSec + 60),
  });
  return true;
}

/* ---------- 健康探测 ---------- */
async function handleHealth(request, env) {
  const url = new URL(request.url);
  const target = safeUrl(url.searchParams.get('url') || '');
  if (!target) return error('Invalid or disallowed probe URL', 400);

  if (!(await allowRequest(env, 'h:', getIp(request), 3, 10))) {
    return error('Too many requests, slow down', 429);
  }

  const start = Date.now();
  try {
    const res = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'apis-sendafun-healthbot/1.0', 'Accept': '*/*' },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    const alive = res.status >= 200 && res.status < 400;
    return json({
      ok: true,
      alive,
      status: res.status,
      timeMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: true, alive: false, status: null, timeMs: Date.now() - start,
      error: String(e.message || e), checkedAt: new Date().toISOString() });
  }
}

/* ---------- Playground 代理 ---------- */
async function handlePlayground(request, env) {
  if (request.method !== 'POST') return error('Only POST is supported', 405);
  if (!(await allowRequest(env, 'pg:', getIp(request), 10, 10))) {
    return error('Too many requests, slow down', 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return error('Body must be valid JSON', 400);
  }
  const method = String(payload.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) {
    return error('Unsupported method', 400);
  }
  const url = safeUrl(payload.url);
  if (!url) return error('Invalid or disallowed target URL', 400);

  const headers = {};
  let body = null;
  const cType = String(payload.contentType || 'application/json');
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const rawBody = payload.body != null ? String(payload.body) : '';
    if (new Blob([rawBody]).size > MAX_BODY_BYTES) return error('Request body too large', 413);
    if (rawBody) { body = rawBody; headers['content-type'] = cType; }
  }

  if (Array.isArray(payload.headers)) {
    for (const h of payload.headers) {
      if (!h || !h.key) continue;
      const k = String(h.key).toLowerCase();
      if (['host', 'content-length', 'connection', 'accept-encoding', 'transfer-encoding'].includes(k)) continue;
      if (!/^[a-z0-9-]+$/i.test(h.key)) continue;
      headers[h.key] = String(h.value || '');
    }
  }

  try {
    const upstream = await fetch(url.toString(), {
      method,
      headers: { 'User-Agent': 'apis-sendafun-playground/1.0', Accept: '*/*', ...headers },
      body,
      redirect: 'follow',
      signal: AbortSignal.timeout(PLAYGROUND_TIMEOUT_MS),
    });
    const { bodyText, size, headers: respHeaders } = await clampResponse(upstream);
    return json({
      ok: true,
      status: upstream.status,
      statusText: upstream.statusText,
      timeMs: 0,
      size,
      headers: respHeaders,
      body: bodyText.slice(0, MAX_BODY_BYTES),
    });
  } catch (e) {
    return json({
      ok: true, error: String(e.message || e), status: 0,
      statusText: 'Request failed', timeMs: 0, size: 0, headers: {}, body: '',
    }, 200);
  }
}

/* ---------- 用户提交 ---------- */
async function handleSubmit(request, env) {
  if (request.method !== 'POST') return error('Only POST is supported', 405);
  if (!(await allowRequest(env, 'sub:', getIp(request), 2, 60))) {
    return error('Too many submissions, slow down', 429);
  }

  const ctype = String(request.headers.get('content-type') || '').toLowerCase();
  let form = null;
  if (ctype.includes('multipart/form-data') || ctype.includes('application/x-www-form-urlencoded')) {
    form = await request.formData().catch(() => null);
  } else {
    form = await request.json().catch(() => null);
  }
  const pick = (k) => {
    let v = null;
    if (form && typeof form.get === 'function') v = form.get(k);
    else if (form) v = form[k];
    if (v == null) return '';
    return typeof v === 'string' ? v.trim() : String(v);
  };
  const name = pick('name');
  const description = pick('description');
  const link = pick('url') || pick('link');
  const auth = pick('auth') || 'Unknown';
  const cors = pick('cors') || 'Unknown';
  const https = pick('https') === 'no' ? false : true;
  const category = pick('category') || 'Other';
  const source = 'community';
  const email = pick('email') || '';

  if (!name || !link) return error('Name and URL are required', 400);
  const target = safeUrl(link);
  if (!target) return error('Invalid or disallowed URL', 400);

  const list = (await env.apisKV.get(PENDING_KEY, 'json')) || [];
  const exists = list.some((it) => String(it.url).toLowerCase() === target.toString().toLowerCase());
  if (!exists) {
    list.push({
      name,
      description,
      url: target.toString(),
      auth,
      cors,
      https,
      category,
      source,
      email,
      submittedAt: new Date().toISOString(),
    });
    await env.apisKV.put(PENDING_KEY, JSON.stringify(list));
  }
  return json({ ok: true, duplicate: exists, id: Date.now() });
}

/* ============================================================
   管理后台（仅管理员）
   ============================================================ */

/** 校验当前请求是否持有有效管理 session（读 HttpOnly cookie -> KV） */
async function requireAdmin(request, env) {
  const token = cookieHeader(request, 'apis_admin');
  if (!token) return false;
  const rec = await env.apisKV.get('adm:' + token, 'json');
  if (!rec) return false;
  // ttl 已在 KV 层自动过期，这里再兜底判断
  if (rec.exp < Date.now()) { await env.apisKV.delete('adm:' + token); return false; }
  return true;
}

async function handleAdminLogin(request, env) {
  if (request.method !== 'POST') return error('Only POST is supported', 405);
  if (!(await allowRequest(env, 'al:', getIp(request), 5, 60))) {
    return error('Too many attempts, slow down', 429);
  }
  const secret = String(env.ADMIN_PASSWORD || '');
  let body;
  try { body = await request.json(); } catch (e) { return error('Body must be valid JSON', 400); }
  if (!secret) return error('Admin password not configured', 500);
  if (String(body.password || '') !== secret) return error('Wrong password', 401);

  const token = crypto.randomUUID().replace(/-/g, '');
  const exp = Date.now() + SESSION_TTL * 1000;
  await env.apisKV.put('adm:' + token, JSON.stringify({ exp }), { expirationTtl: SESSION_TTL });

  const res = json({ ok: true });
  res.headers.append('Set-Cookie',
    `apis_admin=${token}; Path=/; Max-Age=${SESSION_TTL}; SameSite=Lax; HttpOnly`);
  return res;
}

async function handleAdminPending(request, env) {
  if (request.method !== 'GET') return error('Only GET is supported', 405);
  if (!(await requireAdmin(request, env))) return error('Unauthorized', 401);
  const list = (await env.apisKV.get(PENDING_KEY, 'json')) || [];
  return json({ ok: true, items: list });
}

async function handleAdminReview(request, env) {
  if (request.method !== 'POST') return error('Only POST is supported', 405);
  if (!(await requireAdmin(request, env))) return error('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch (e) { return error('Body must be valid JSON', 400); }
  const action = String(body.action || '');
  const index = Number(body.index);
  const idle = Number.isInteger(index) && index >= 0;

  const list = (await env.apisKV.get(PENDING_KEY, 'json')) || [];
  if (idle && index >= list.length) return error('Item not found', 404);
  const item = idle ? list.splice(index, 1)[0] : null;

  if (action === 'approve' && item) {
    item.approvedAt = new Date().toISOString();
    const approved = (await env.apisKV.get(APPROVED_KEY, 'json')) || [];
    // 按 URL 去重，避免重复入库
    if (!approved.some((it) => String(it.url).toLowerCase() === String(item.url).toLowerCase())) {
      approved.unshift(item);
    }
    await env.apisKV.put(APPROVED_KEY, JSON.stringify(approved));
  } else if (action === 'reject' || action === 'delete') {
    // 丢弃该条（不入库）
  } else {
    return error('Invalid action', 400);
  }

  if (idle) await env.apisKV.put(PENDING_KEY, JSON.stringify(list));
  return json({ ok: true, remaining: list.length });
}

/** 公开只读：返回已审核通过的社区 API（限 100 条） */
async function handleCommunity(request, env) {
  const list = (await env.apisKV.get(APPROVED_KEY, 'json')) || [];
  return json({ ok: true, items: list.slice(0, 100) });
}

/* ---------- 路由 ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response('', { status: 204 });
    }

    try {
      if (path === '/api/counter') return await handleCounter(request, env);
      if (path === '/api/health') return await handleHealth(request, env);
      if (path === '/api/playground') return await handlePlayground(request, env);
      if (path === '/api/submit') return await handleSubmit(request, env);
      if (path === '/api/community') return await handleCommunity(request, env);
      if (path === '/api/admin/login') return await handleAdminLogin(request, env);
      if (path === '/api/admin/pending') return await handleAdminPending(request, env);
      if (path === '/api/admin/review') return await handleAdminReview(request, env);
    } catch (e) {
      return error('Internal error: ' + String(e.message || e), 500);
    }

    return env.ASSETS.fetch(request);
  },
};