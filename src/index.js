/**
 * apis-sendafun — Cloudflare Worker 请求处理器
 *
 * 职责：
 *   - /api/counter  访客统计（自托管，彻底解决第三方统计不稳定问题）
 *   - /api/health   健康探测（详情页实时检测 API 可用性）
 *   - /api/playground  Playground 代理（绕过 CORS，含 SSRF 防护 / 超时 / 大小限制）
 *   - /api/submit   用户提交新 API（写入 KV 待审列表，去重）
 *   - 其余路径      交由静态资源 (ASSETS) 渲染 SPA
 */

const COUNTER_UV_TTL = 365 * 24 * 60 * 60; // 秒
const DAILY_UV_TTL = 3 * 24 * 60 * 60;
const HEALTH_TIMEOUT_MS = 8000;
const PLAYGROUND_TIMEOUT_MS = 9500;
const MAX_BODY_BYTES = 1024 * 1024; // 1MB

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function getIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/* ---------- 私有 IP 判断（SSRF 防护） ---------- */
function isPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '').trim();
  if (!h) return true;
  // 本机 / 保留域名
  if (h === 'localhost' || h === 'localtest.me' || h.endsWith('.local')) return true;
  // 若是 IPv4 字面量，检查私有/保留段
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2], c = +m[3], d = +m[4];
    if (a >= 255 || b >= 255 || c >= 255 || d >= 255) return true;
    if (a === 10) return true;                    // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;      // 192.168/16
    if (a === 127 || a === 0) return true;
    if (a >= 224) return true;                    // 组播/保留
    if (a === 169 && b === 254) return true;      // link-local
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
    // 直接读取后若超限则截断展示
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

  let uvid = request.headers.get('Cookie')
    ?.split(';').map((s) => s.trim())
    .filter((s) => s.startsWith('uvid=')).map((s) => s.slice(5))[0] || '';
  const isNewVisit = !uvid;

  // 读取现有计数
  const [totRaw, dayRaw] = await Promise.all([
    env.apisKV.get(totalKey, 'json'),
    env.apisKV.get(dailyKey, 'json'),
  ]);
  const total = totRaw || { pv: 0, uv: 0 };
  const today = dayRaw || { pv: 0, uv: 0 };

  total.pv = (total.pv || 0) + 1;
  today.pv = (today.pv || 0) + 1;

  // 唯一访客识别：无 cookie 时生成一个
  if (isNewVisit) {
    uvid = 'v' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    // 终身唯一（近似）
    const uvKey = 'uv:' + uvid;
    if (!(await env.apisKV.get(uvKey))) {
      total.uv = (total.uv || 0) + 1;
      await env.apisKV.put(uvKey, '1', { expirationTtl: COUNTER_UV_TTL });
    }
    // 当日唯一
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
  // 为新(无 cookie)访客种下 cookie，之后可累计 UV
  if (isNewVisit) {
    res.headers.append('Set-Cookie',
      `uvid=${uvid}; Path=/; Max-Age=${COUNTER_UV_TTL}; SameSite=Lax; HttpOnly`);
  }
  return res;
}

/* ---------- 简单速率限制（基于 KV 的每 IP 滑动窗口） ----------
   注：KV expirationTtl 最小为 60s，窗口 TTL 一律取 Math.max(60, ttl+60)。 */
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
  if (!target) return error('无效或非法的探测地址', 400);

  if (!(await allowRequest(env, 'h:', getIp(request), 3, 10))) {
    return error('探测过于频繁，请稍后再试', 429);
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
  if (request.method !== 'POST') return error('仅支持 POST', 405);
  if (!(await allowRequest(env, 'pg:', getIp(request), 10, 10))) {
    return error('请求过于频繁，请稍后再试', 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return error('请求体必须是合法 JSON', 400);
  }
  const method = String(payload.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) {
    return error('不支持的请求方法', 400);
  }
  const url = safeUrl(payload.url);
  if (!url) return error('无效或非法的目标地址', 400);

  const headers = {};
  let body = null;
  const cType = String(payload.contentType || 'application/json');
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const rawBody = payload.body != null ? String(payload.body) : '';
    if (new Blob([rawBody]).size > MAX_BODY_BYTES) return error('请求体过大', 413);
    if (rawBody) { body = rawBody; headers['content-type'] = cType; }
  }

  // 只透传安全的自定义头，禁止改写 Host / 内容长度等
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
  if (request.method !== 'POST') return error('仅支持 POST', 405);
  if (!(await allowRequest(env, 'sub:', getIp(request), 2, 60))) {
    return error('提交过于频繁，请稍后再试', 429);
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

  if (!name || !link) return error('名称和 URL 为必填项', 400);
  const target = safeUrl(link);
  if (!target) return error('URL 无效或包含禁止访问的地址', 400);

  const listKey = 'submit:pending';
  const list = (await env.apisKV.get(listKey, 'json')) || [];
  // 去重：按 URL 去重
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
    await env.apisKV.put(listKey, JSON.stringify(list));
  }
  return json({ ok: true, duplicate: exists, id: Date.now() });
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
    } catch (e) {
      return error('服务器内部错误: ' + String(e.message || e), 500);
    }

    // 其余交给静态资源（SPA 回退启用）
    return env.ASSETS.fetch(request);
  },
};