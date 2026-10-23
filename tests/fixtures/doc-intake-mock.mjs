// محاكاة خادم «ارفع كل ملفات شركتك مرة واحدة» لاختبار الواجهة بمتصفح حقيقي قبل أن يجهز
// الخادم الفعلي (api/_doc-intake.js عند وكيل المستندات). تلتزم بالعقد المكتوب في
// tests/fixtures/doc-intake-contract.json حرفياً — فإن تغيّر العقد تغيّر هذا الملف معه.
//
// ما يُحاكى: ردّ doc-intake لكل ملف حسب اسمه، وردّ doc-intake-confirm، ومعهما
// بيانات الشركة ("me") وقائمة الخزانة بحيث تظهر بعد الاعتماد كأن الخادم حفظها.
// لا يُرسَل شيء إلى أي خدمة، ولا يُحفظ شيء في أي قاعدة.

const DAY = 86400000;
export const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

// اسم الملف ← ما «يقرؤه» المستشار الذكي. أسماء الملفات عربية كما يسمّيها عميلٌ حقيقي.
export function readerFor(name) {
  const n = String(name || "");
  if (/(نسخة|copy)/i.test(n)) return { ...CR(), duplicateOf: true };
  if (/(مبهم|blur|unread)/i.test(n)) return { ok: false, error: "unreadable" };
  if (/(سجل|\bcr\b)/i.test(n)) return CR();
  if (/(ضريب|vat)/i.test(n)) return VAT();
  if (/(عنوان|address)/i.test(n)) return ADDRESS();
  if (/(رخصة|licen[cs]e)/i.test(n)) return LICENSE();
  if (/(عقد|contract)/i.test(n)) return CONTRACT();
  return { docType: "other", docTitle: "", confidence: "low", fields: {} };
}
const CR = () => ({ docType: "cr", docTitle: "السجل التجاري", category: "cr", issueDate: iso(-900), expiryDate: iso(420), confidence: "high",
  fields: { companyNameAr: "شركة النخبة للمقاولات", companyNameEn: "Elite Contracting Co.", crNumber: "1010123456", vatNumber: "", address: { city: "الرياض" }, contactName: "", contactPhone: "" },
  fieldConfidence: { companyNameAr: "high", companyNameEn: "medium", crNumber: "high" } });
const VAT = () => ({ docType: "vat_certificate", docTitle: "شهادة تسجيل ضريبة القيمة المضافة", category: "vat", issueDate: iso(-700), expiryDate: "", confidence: "high",
  fields: { companyNameAr: "شركة النخبة للمقاولات", companyNameEn: "", crNumber: "", vatNumber: "300012345600003", address: { city: "الرياض", district: "العليا" }, contactName: "", contactPhone: "" },
  fieldConfidence: { companyNameAr: "high", vatNumber: "high" } });
const ADDRESS = () => ({ docType: "national_address", docTitle: "العنوان الوطني", category: "national_address", issueDate: iso(-120), expiryDate: "", confidence: "medium",
  fields: { companyNameAr: "", companyNameEn: "", crNumber: "", vatNumber: "", address: { buildingNo: "7421", street: "طريق الملك فهد", district: "العليا", city: "الرياض", postalCode: "12214", additionalNo: "3120" }, contactName: "", contactPhone: "" } });
const LICENSE = () => ({ docType: "license", docTitle: "رخصة بلدية", category: "license", issueDate: iso(-345), expiryDate: iso(20), confidence: "medium",
  fields: { companyNameAr: "شركة النخبة للمقاولات", companyNameEn: "", crNumber: "1010123456", vatNumber: "", address: { city: "الرياض" }, contactName: "", contactPhone: "" } });
const CONTRACT = () => ({ docType: "contract", docTitle: "عقد إيجار المقر", category: "contract", issueDate: iso(-400), expiryDate: iso(-35), confidence: "low",
  fields: { companyNameAr: "", companyNameEn: "", crNumber: "", vatNumber: "", address: {}, contactName: "محمد العتيبي", contactPhone: "0551234567" } });

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

// scenario: { delay, serviceDown, failConfirmFor:[names], networkFailFor:[names], org, startDocs, fakeMe }
export async function mockIntake(page, scenario = {}) {
  const S = { delay: 350, serviceDown: false, failConfirmFor: [], networkFailFor: [], org: { name_ar: "business", name_en: "", cr_number: "" }, ...scenario };
  const log = { previews: [], confirms: [], vault: [] };
  let org = { ...S.org };
  const vault = [];
  S.state = { org, vault, log };

  // 'me' الحقيقي، مع بيانات شركةٍ كما في لقطة المالك (الاسم «business» وبقية الحقول فارغة)
  await page.route("**/api/simple", async (route) => {
    const req = route.request();
    let b = {};
    try { b = JSON.parse(req.postData() || "{}"); } catch {}
    if (b.action === "me") {
      // fakeMe: بلا خادم محلّي (اختبار على صفحات مبنيّة فقط) — جلسةٌ جاهزة وطلباتٌ فارغة.
      const res = S.fakeMe ? null : await route.fetch();
      const j = S.fakeMe ? { ok: true, testMode: true, user: { name: "عميل تجريبي", email: "client@test.local", phone: "0512345678" }, organization: { id: "org-demo" }, counts: {}, requests: [] } : await res.json();
      if (j && j.ok) j.organization = { ...(j.organization || { id: "org-demo" }), id: (j.organization && j.organization.id) || "org-demo", ...org };
      return json(route, j);
    }
    if (b.action === "doc-intake") {
      const f = (b.files || [])[0] || {};
      log.previews.push({ id: f.id, name: f.name, hasBase64: !!f.base64 });
      if (S.networkFailFor.some((x) => String(f.name).includes(x))) return route.abort("failed");
      await new Promise((r) => setTimeout(r, S.delay + (f.name || "").length * 7));
      if (S.serviceDown) return json(route, { ok: false, error: "reader_unavailable" }, 503);
      const r = readerFor(f.name);
      const item = r.ok === false ? { id: f.id, ok: false, error: r.error } : { id: f.id, ok: true, ...r, warnings: r.duplicateOf ? [{ code: "duplicate" }] : [] };
      delete item.duplicateOf;
      return json(route, { ok: true, files: [item], company: { current: { ...org, vat_number: org.vat_number || "", city: org.city || "" } } });
    }
    if (b.action === "doc-intake-confirm") {
      const files = b.files || [];
      log.confirms.push({ company: b.company || null, files: files.map((f) => ({ id: f.id, name: f.name, title: f.title, category: f.category, docType: f.docType, expiryDate: f.expiryDate, unread: !!f.unread, hasFields: !!f.fields, hasBase64: !!f.base64 })) });
      await new Promise((r) => setTimeout(r, 300));
      const errors = [], saved = [];
      for (const f of files) {
        if (S.failConfirmFor.some((x) => String(f.name).includes(x))) { errors.push({ id: f.id, error: "storage_failed" }); continue; }
        saved.push({ id: f.id, documentId: "doc-" + f.id, category: f.category, title: f.title, version: 1 });
        vault.push({ id: "doc-" + f.id, title: f.title, category: f.category, expiry_date: f.expiryDate || null, created_at: new Date().toISOString(),
          extracted: f.fields ? { companyNameAr: f.fields.companyNameAr, crNumber: f.fields.crNumber, vatNumber: f.fields.vatNumber } : null, issue_date: f.issueDate || null,
          document_versions: [{ id: "v-" + f.id, file_name: f.name, version_no: 1 }] });
      }
      let company;
      if (b.company && Object.keys(b.company).length) { Object.assign(org, b.company); company = { saved: true, changed: Object.keys(b.company), organization: { ...org } }; }
      return json(route, { ok: true, saved, errors, ...(company ? { company } : {}) });
    }
    return route.continue();
  });
  // قائمة الخزانة: ما حُفظ بالمحاكاة يظهر كما لو أن الخادم حفظه.
  await page.route("**/api/requests?action=my-ops&what=documents*", (route) => json(route, { ok: true, items: [...(S.startDocs || []), ...vault] }));
  return S.state;
}

// ملفات تجريبية صغيرة: المحتوى لا يهم (القراءة محاكاة)، يهم الاسم والنوع.
export function sample(names, mime = "application/pdf") {
  return names.map((name) => ({ name, mimeType: /\.(jpe?g)$/i.test(name) ? "image/jpeg" : mime, buffer: Buffer.from("%PDF-1.4\n% demo " + name + "\n%%EOF") }));
}
