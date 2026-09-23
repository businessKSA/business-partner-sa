// عقدة Code في n8n — «Agent Gate»
// -----------------------------------------------------------------------
// ضعها في BP-WhatsApp-Main مباشرةً بعد استقبال الرسالة وقبل أي عقدة تردّ.
// تسأل الموقع: هل الوكيل مسموح له أن يردّ على هذا الرقم؟
//
//   لا صفّ في wa_agent_gate            → يردّ (الوضع الطبيعي)
//   الصف '*' موقوف                     → لا يردّ على أحد
//   صفّ الرقم موقوف                    → لا يردّ على هذا العميل وحده
//
// أي عطل — الموقع لا يستجيب، مفتاح خاطئ، شبكة — يعني «يردّ». البوابة تحرس
// المحادثة ولا تُسقط الخدمة: لو أسقطتها لصار عطلٌ في لوحة الإدارة صمتاً
// كاملاً على واتساب.
//
// الإعداد: أضف BP_PANEL_KEY إلى متغيّرات n8n (نفس مفتاح لوحة /ops).
// التوصيل: مخرج هذه العقدة → عقدة IF على {{$json.agentPaused}}
//           true  → لا شيء (يتوقّف المسار، الموظف يردّ من اللوحة)
//           false → بقيّة المسار كما هو.

const BASE = 'https://www.businesspartner.sa';
const KEY = $env.BP_PANEL_KEY || '';

const out = [];
for (const item of $input.all()) {
  const j = item.json || {};
  // رقم المرسِل. الحقول الثلاثة الأولى هي ما يصل بعد عقدة WhatsApp Trigger،
  // والأخير هو شكل Webhook الخام من Meta.
  const raw =
    j.from || j.phone || j.waId ||
    ((((((j.body || j).entry || [])[0] || {}).changes || [])[0] || {})
      .value || {}).messages?.[0]?.from || '';
  const phone = String(raw).replace(/\D/g, '');

  let paused = false, reason = null, scope = null;
  if (phone && KEY) {
    try {
      const r = await this.helpers.httpRequest({
        method: 'POST',
        url: `${BASE}/api/simple`,
        json: true,
        timeout: 4000,
        body: { action: 'ops-wa-check', key: KEY, phone },
      });
      if (r && r.ok) { paused = !!r.paused; reason = r.reason || null; scope = r.scope || null; }
    } catch (e) {
      // صامت عمداً: العطل لا يُسكت الوكيل.
    }
  }
  out.push({ json: { ...j, agentPaused: paused, agentPauseReason: reason, agentPauseScope: scope } });
}
return out;
