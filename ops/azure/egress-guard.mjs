// Business Partner — حارس الخروج: لا طلب من العملية إلى *.vercel.app بعد القطع.
//
// بعد نقل الموقع ولوحة العروض إلى Azure لا يجوز أن يخرج أي نداء إلى نطاق Vercel: خروجه يعني أن شيئاً ما زال
// يعتمد على مشروعٍ سيُحذف (مثلاً QUOTES_PANEL_URL الافتراضي في api/requests.js الذي يشير إلى
// bp-quotes-three.vercel.app إن لم يُضبط المتغيّر). فبدل أن ينكشف الاعتماد يوم حذف المشروع، يُكشف أول يوم:
// يُسجَّل `egress_blocked` باسم المضيف، ويعود للمتّصل 502 (ردّ فشل عادي لا استثناء).
//
// يُفعَّل بـBP_BLOCK_VERCEL_ORIGINS=1 في ops/azure/server.mjs. يعترض `fetch` العام فقط (ما تستعمله دوال api/)؛
// أما وكيل `/quotes` فيحرسه الخادم نفسه (الشرط نفسه في dispatch).

const DEFAULT_PATTERNS = [/(^|\.)vercel\.app$/i];

export function installEgressGuard({ target = globalThis, patterns = DEFAULT_PATTERNS, log = () => {} } = {}) {
  const realFetch = target.fetch.bind(target);
  const guard = { blocked: 0, onBlock: null, restore() { target.fetch = realFetch; } };
  target.fetch = async function guardedFetch(input, init) {
    let host = "";
    try { host = new URL(typeof input === "string" ? input : input && input.url ? input.url : String(input)).hostname; } catch { /* ليس عنواناً مطلقاً: يمرّ لفشله الطبيعي */ }
    if (host && patterns.some((p) => p.test(host))) {
      guard.blocked++;
      if (guard.onBlock) guard.onBlock(host);
      log({ level: "error", msg: "egress_blocked", host });
      return new Response(JSON.stringify({ error: "egress_blocked", host }), { status: 502, headers: { "content-type": "application/json" } });
    }
    return realFetch(input, init);
  };
  return guard;
}
