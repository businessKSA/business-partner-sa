// أدوات اختبار «ارفع كل ملفات شركتك مرة واحدة» بمتصفح حقيقي على الخادم المحلي الحقيقي.
//
// لا محاكاة للخادم هنا: ملفات demo-* يقرؤها api/_doc-intake.js في وضع التطوير وحده (راجع demoRead فيه)،
// وملفٌّ حقيقي الشكل بلا demo في اسمه يمرّ بالقارئ الفعلي فيعيد reader_not_configured محلياً — أي
// حالة «خدمة القراءة غير متاحة» الحقيقية. المحاكاة الوحيدة هي إفساد ردٍّ بعينه لاختبار رسائل الخطأ
// (انقطاع شبكة، رفض الحفظ، رقم غير صالح) مما لا يمكن إنتاجه من خادمٍ سليم.

const PDF = (tag) => Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% " + tag + "\n%%EOF\n");
const JPG = (tag) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]), Buffer.from(tag), Buffer.from([0xff, 0xd9])]);

// ملفات تجريبية: المحتوى مميَّز لكل اسم (بصمة sha مختلفة) ما لم يُطلب تكرار صريح.
export function sample(names, { same = {} } = {}) {
  return names.map((name) => {
    const tag = same[name] || name;
    const jpg = /\.(jpe?g)$/i.test(name);
    return { name, mimeType: jpg ? "image/jpeg" : "application/pdf", buffer: jpg ? JPG(tag) : PDF(tag) };
  });
}
export const bigFile = (name, bytes) => ({ name, mimeType: "application/pdf", buffer: Buffer.concat([PDF(name), Buffer.alloc(bytes)]) });

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

// opts: { previewFail: 'network'|'rate'|'unavailable'|null, confirmSkip:{ substr: reason }, factErrors:[{field,error}], slow:ms }
// يمرّ كل شيء إلى الخادم الحقيقي، ثم يُفسد الردّ المطلوب فقط. يعيد كائناً فيه سجلّ الطلبات التي مرّت.
export async function interceptFailures(page, opts = {}) {
  const log = { previews: [], confirms: [] };
  await page.route("**/api/simple", async (route) => {
    let b = {};
    try { b = JSON.parse(route.request().postData() || "{}"); } catch {}
    if (b.action === "doc-intake") {
      log.previews.push({ files: (b.files || []).map((f) => f.name), prior: (b.prior || []).length });
      if (opts.slow) await new Promise((r) => setTimeout(r, opts.slow));
      if (opts.previewFail === "network") return route.abort("failed");
      if (opts.previewFail === "rate") return json(route, { ok: false, error: "rate_limited" }, 429);
      if (opts.previewFail === "unavailable") return json(route, { ok: false, error: "unknown_action" }, 404);
      return route.continue();
    }
    if (b.action === "doc-intake-confirm") {
      const f = (b.files || [])[0] || {};
      log.confirms.push({ name: f.name, hasFacts: !!b.facts, facts: b.facts || null, hasBase64: !!f.base64, category: f.category, title: f.title, expiry: f.expiry, fieldKeys: f.fields ? Object.keys(f.fields) : null });
      if (opts.slow) await new Promise((r) => setTimeout(r, opts.slow));
      for (const [substr, reason] of Object.entries(opts.confirmSkip || {})) {
        if (String(f.name).includes(substr)) return json(route, { ok: true, saved: [], skipped: [{ id: f.id, reason }], organization: null, factsApplied: [], factErrors: [], createdOrg: false });
      }
      if (opts.factErrors) {
        const res = await route.fetch();
        const j = await res.json();
        return json(route, { ...j, factsApplied: [], factErrors: opts.factErrors });
      }
    }
    return route.continue();
  });
  return log;
}
