// Business Partner — قياس استهلاك الذكاء وسقفه اليومي لمساعد التوظيف.
//
// لماذا هذا الملف موجود
// ---------------------
// جرد سبتمبر ٢٠٢٦: لا قياس استهلاك ولا سقف ولا تسجيل كلفة لأي نداء ذكاء في
// المنصّة كلها — و/api/hire كان مفتوحاً للإنترنت بلا جلسة ولا رمز، فأي أحد
// يستهلك رصيد Azure. القياس شرطٌ لأي تسعير: الوكلاء الثمانية القادمون يُباعون
// كإضافة مدفوعة، ولا يُسعَّر ما لا يُقاس.
//
// أين يُكتب السجلّ، ولماذا هنا
// ---------------------------
// في `audit_logs` — جدولٌ **قائم** في db/schema.sql، بأعمدة تكفي حرفاً بحرف:
//   action      = "hire.ai"            (مفتاح الاستعلام)
//   actor_label = "hire:<subject>"     (صاحب العمل أو الزائر، مُعمّى)
//   after       = {task, chars_in, chars_out, ms, tokens, company, plan, kind}
//   created_at  = الطابع الزمني (افتراضي العمود)
// فلا جدول جديد ولا ترحيل (migration) — والترحيل قرار مالك، و`db/schema.sql`
// ليس لهذا الوكيل. متى قرّر المالك جدولاً مخصّصاً (`ai_usage` بأعمدة
// tokens/cost ولفّة يومية) فالبديل يُركَّب في `sink` أدناه وحده ولا يُلمس
// api/hire.js.
//
// ما لا يُكتب: **رمز الوصول نفسه لا يُسجَّل أبداً.** هو الرمز الحامل الذي يفتح
// بيانات كل المرشحين الشخصية، وجدول سجلّات لا يجوز أن يصير مخزن رموز حاملة.
// المكتوب بصمة sha256 مقطوعة عند ١٦ خانة — تكفي للفوترة ولا تُعاد إلى رمز.
// وكذلك عنوان الزائر (IP): بصمةٌ لا عنواناً، فهو بيانٌ شخصي.
//
// القاعدة الحاكمة: **القياس لا يُسقط النداء أبداً.** فشل الكتابة أو فشل العدّ
// يُكتب في console.warn ويمضي النداء. خدمةٌ تتعطّل لأن عدّادها تعطّل أسوأ من
// عدّادٍ ناقص.

import { DB_ON, sb, sha256 } from "./_db.js";

export const HIRE_ACTION = "hire.ai";

// يوم الرياض لا يوم UTC: صاحب العمل يقرأ «يتجدّد منتصف الليل» بتوقيته، و«منتصف
// ليل UTC» يعني الثالثة فجراً عنده. السعودية بلا توقيت صيفي، فالإزاحة ثابتة.
const RIYADH_OFFSET_MS = 3 * 3600 * 1000;
export function windowStart(now = Date.now()) {
  const day = Math.floor((now + RIYADH_OFFSET_MS) / 86400000) * 86400000;
  return new Date(day - RIYADH_OFFSET_MS);
}
export const windowEnd = (now = Date.now()) => new Date(windowStart(now).getTime() + 86400000);

// حدودٌ سخيّة افتراضاً: السقف حاجزٌ ضد الاستنزاف، لا تقنينٌ على مشترك يعمل.
const num = (name, dflt) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt;
};
export const limits = () => ({
  employer: num("HIRE_DAILY_LIMIT", 300),          // لكل صاحب عمل في اليوم
  anon: num("HIRE_ANON_DAILY_LIMIT", 150),         // لكل زائر (بصمة عنوانه) في اليوم
  anonTotal: num("HIRE_ANON_TOTAL_DAILY_LIMIT", 1500), // كل المجهولين معاً في اليوم
});

const ANON_PREFIX = "anon:";
export const employerSubject = (code) => "emp:" + sha256("hire-emp:" + String(code || "")).slice(0, 16);
export const anonSubject = (ip) => ANON_PREFIX + sha256("hire-ip:" + String(ip || "")).slice(0, 16);
const labelOf = (subject) => "hire:" + subject;

// المنفذ إلى قاعدة البيانات في موضعٍ واحد: هنا يُستبدل `audit_logs` بجدول
// مخصّص إن قرّره المالك، وهنا يُعطَّل في الاختبار ليُقاس أن فشله لا يُسقط
// النداء — وهو أصل القاعدة ولا يُصدَّق بلا اختبار.
export const sink = {
  async write(row) { await sb("audit_logs", { method: "POST", prefer: "return=minimal", body: [row] }); },
  async count(query) { return sb(`audit_logs?${query}`); },
};

// عدّ نداءات اليوم لهذا الصاحب/الزائر. يعيد null حين يتعذّر العدّ — وnull
// تعني «لا أعرف» لا «صفر»، وهي تفتح النداء عمداً (انظر hire.js).
export async function countToday(subject, cap, now = Date.now()) {
  if (!DB_ON) return null;
  const since = windowStart(now).toISOString();
  try {
    const rows = await sink.count(
      `action=eq.${HIRE_ACTION}&actor_label=eq.${encodeURIComponent(labelOf(subject))}` +
      `&created_at=gte.${since}&select=id&limit=${Math.max(1, cap) + 1}`,
    );
    return Array.isArray(rows) ? rows.length : null;
  } catch (e) {
    console.warn("hire meter count failed", String(e).slice(0, 160));
    return null;
  }
}

// السقف الجماعي للمجهولين: نداءٌ عامٌّ واحد (ترجمة إعلان، مطابقة في صفحة
// /hiring) يظل مفتوحاً للإنترنت عمداً، فيلزمه حاجزٌ كلّي لا حاجز عنوانٍ واحد —
// وإلا كفى ألفُ عنوانٍ لاستنزاف الرصيد وكلٌّ منها تحت سقفه.
export async function countAnonToday(cap, now = Date.now()) {
  if (!DB_ON) return null;
  const since = windowStart(now).toISOString();
  try {
    const rows = await sink.count(
      `action=eq.${HIRE_ACTION}&actor_label=like.${encodeURIComponent("hire:" + ANON_PREFIX + "*")}` +
      `&created_at=gte.${since}&select=id&limit=${Math.max(1, cap) + 1}`,
    );
    return Array.isArray(rows) ? rows.length : null;
  } catch (e) {
    console.warn("hire meter anon count failed", String(e).slice(0, 160));
    return null;
  }
}

// تسجيل نداءٍ ناجح. لا يرمي بحال.
// tokens: عدد الرموز إن أعاده المزوّد. Azure يعيده في `usage` لكن
// api/_azure.js يطرح كل شيء غير النص (azureChat → string)، وذاك الملف ليس
// لهذا الوكيل — فحتى يُمرَّر `usage` يُسجَّل حجم المدخل والمخرج بالأحرف،
// و`tokens: null` تقول صراحةً «لم يُعِده المزوّد» بدل رقمٍ مُقدَّر يُفوتَر.
export async function logCall({ subject, task, charsIn, charsOut, ms, tokens = null, kind, company = "", plan = "", model = "" }) {
  if (!DB_ON) return false;
  try {
    await sink.write({
      action: HIRE_ACTION,
      actor_label: labelOf(subject),
      entity_type: "hire_task",
      after: {
        task, kind, tokens,
        chars_in: Number(charsIn) || 0,
        chars_out: Number(charsOut) || 0,
        ms: Number(ms) || 0,
        company: String(company || "").slice(0, 120),
        plan: String(plan || "").slice(0, 60),
        model: String(model || "").slice(0, 60),
      },
    });
    return true;
  } catch (e) {
    console.warn("hire meter write failed", String(e).slice(0, 160));
    return false;
  }
}
