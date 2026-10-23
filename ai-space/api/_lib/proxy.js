'use strict';
/* BP AI Space — الوسيط بين المتصفح وn8n على Azure.
 *
 * لا أسرار هنا: كل مسار ويبهوك ومفتاح يُقرأ من إعدادات التطبيق (App settings)
 * في Azure Portal، ولا يُكتب في git ولا يصل المتصفح. الملف دالة نقية
 * (طلب، بيئة، fetch) -> ردّ، فيُختبر محلياً بلا Azure. */

var MAX_BODY = { stt: 8 * 1024 * 1024, default: 64 * 1024 };

// op -> { method, setting: اسم إعداد المسار (للتوثيق وللخطأ فقط), sendKey, timeout }
// المهلة القصوى لـSWA المُدارة 45 ث، فكل مهلة هنا أقل منها.
var OPS = {
  data:       { method: 'GET',  setting: 'BP_PATH_DATA',        sendKey: false, timeout: 30000 },
  pulse:      { method: 'GET',  setting: 'BP_PATH_PULSE',       sendKey: false, timeout: 30000 },
  health:     { method: 'GET',  setting: 'BP_PATH_HEALTH',      sendKey: true,  timeout: 30000 },
  chat:       { method: 'POST', setting: 'BP_PATH_CHAT',        sendKey: true,  timeout: 42000 },
  chatresult: { method: 'GET',  setting: 'BP_PATH_CHAT_RESULT', sendKey: true,  timeout: 30000, query: ['job'] },
  voice:      { method: 'POST', setting: 'BP_PATH_VOICE',       sendKey: false, timeout: 42000, binary: true },
  stt:        { method: 'POST', setting: 'BP_PATH_STT',         sendKey: false, timeout: 42000 },
  action:     { method: 'POST', setting: 'BP_PATH_ACTION',      sendKey: true,  timeout: 30000 },
  minutes:    { method: 'POST', setting: 'BP_PATH_MINUTES',     sendKey: true,  timeout: 42000 }
};

function json(status, obj) {
  return { status: status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}

/* x-ms-client-principal يضعه SWA بعد تسجيل الدخول؛ المتصفح لا يستطيع تزويره
 * لأن الحافة تستبدله. نتحقق هنا من الدور owner مرة ثانية (دفاع بعمق)
 * مع قاعدة allowedRoles في staticwebapp.config.json. */
function isOwner(headers, env) {
  if (env.BP_LOCAL_ALLOW_ANON === '1') return true;
  var raw = headers['x-ms-client-principal'];
  if (!raw) return false;
  try {
    var p = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    return Array.isArray(p.userRoles) && p.userRoles.indexOf('owner') !== -1;
  } catch (e) { return false; }
}

function baseFor(op, env) {
  var own = env['BP_BASE_' + op.toUpperCase()];
  return { base: String(own || env.BP_N8N_BASE || '').replace(/\/+$/, ''), isDefault: !own };
}

async function handle(req, env, fetchImpl) {
  var op = String(req.op || '').toLowerCase();
  var spec = OPS[op];
  if (!spec) return json(404, { error: 'unknown_op' });
  if (!isOwner(req.headers || {}, env)) return json(403, { error: 'owner_only' });
  if (req.method !== spec.method) return json(405, { error: 'method_not_allowed' });

  var path = env[spec.setting];
  var b = baseFor(op, env);
  if (!path || !b.base) return json(503, { error: 'not_configured', setting: spec.setting + (b.base ? '' : ' / BP_N8N_BASE') });
  if (!/^\/[A-Za-z0-9._~\/-]+$/.test(path) || /\/\/|\.\./.test(path)) return json(503, { error: 'bad_setting', setting: spec.setting });

  var url = b.base + path;
  if (spec.query) {
    var qs = [];
    spec.query.forEach(function (k) {
      var v = req.query && req.query[k];
      if (v == null) return;
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(v))) return;
      qs.push(k + '=' + encodeURIComponent(v));
    });
    if (qs.length) url += '?' + qs.join('&');
  }

  var headers = {};
  if (spec.method === 'POST') headers['Content-Type'] = 'application/json';
  // المفتاح يُرسل فقط إلى n8n على Azure؛ لو وُجّهت العملية إلى Cloud مؤقتاً لا يخرج المفتاح.
  if (spec.sendKey && b.isDefault && env.BP_FARAH_KEY) headers['X-BP-Farah-Key'] = env.BP_FARAH_KEY;

  var body;
  if (spec.method === 'POST') {
    body = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
    var max = MAX_BODY[op] || MAX_BODY.default;
    if (Buffer.byteLength(body) > max) return json(413, { error: 'too_large' });
  }

  var ctl = new AbortController();
  var tm = setTimeout(function () { ctl.abort(); }, spec.timeout);
  try {
    var r = await fetchImpl(url, { method: spec.method, headers: headers, body: body, signal: ctl.signal, redirect: 'manual' });
    var ct = r.headers.get('content-type') || 'application/json';
    var buf = Buffer.from(await r.arrayBuffer());
    // لا نمرّر نص أخطاء n8n الخام (قد يحمل مساراً داخلياً)، فقط الرمز.
    if (!r.ok) return json(r.status === 401 || r.status === 403 ? 502 : r.status, { error: 'upstream_' + r.status, upstream_status: r.status });
    return { status: 200, headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' }, body: spec.binary ? buf : buf.toString('utf8'), binary: !!spec.binary };
  } catch (e) {
    if (e && e.name === 'AbortError') return json(504, { error: 'upstream_timeout', seconds: Math.round(spec.timeout / 1000) });
    // رمز الشبكة فقط (ENOTFOUND, ECONNREFUSED, ERR_INVALID_URL…) — لا نص الخطأ ولا العنوان.
    var code = (e && e.cause && e.cause.code) || (e && e.code) || (e && e.name) || 'error';
    return json(502, { error: 'upstream_unreachable', detail: String(code).replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) });
  } finally { clearTimeout(tm); }
}

module.exports = { handle: handle, OPS: OPS, isOwner: isOwner };
