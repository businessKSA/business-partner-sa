// قاعدة بيانات وهمية في الذاكرة + مسارٌ يستدعي منطق الخادم الحقيقي (api/_doc-intake.js) كما
// يفعل معالج doc-intake وdoc-intake-confirm في api/_simple.js بالضبط. تُستعمل في اختبارات
// الواجهة حتى تُختبر على الردود الفعلية للخادم لا على نسخةٍ مكتوبةٍ بيد.
import crypto from "node:crypto";
import { intakeBatch, confirmIntake, loadVaultIndex } from "../../api/_doc-intake.js";

export function makeHarness({ org = { id: "org1", name_ar: "business", name_en: "", cr_number: "" }, hasOrg = true } = {}) {
  const db = { org: hasOrg ? { ...org } : null, documents: [], versions: [], stored: [] };
  const verOf = (id) => db.versions.filter((v) => v.document_id === id);
  async function sb(path, opts = {}) {
    const method = opts.method || "GET";
    const body = Array.isArray(opts.body) ? opts.body[0] : opts.body;
    if (path === "organizations" && method === "POST") { db.org = { id: "org-new", ...body }; return [{ ...db.org }]; }
    if (path.startsWith("organizations?id=eq.")) {
      if (method === "PATCH") { Object.assign(db.org, body); return [{ ...db.org }]; }
      return db.org ? [{ ...db.org }] : [];
    }
    if (path === "organization_members" || path.startsWith("user_sessions?")) return [];
    if (path.startsWith("documents?organization_id=")) {
      return db.documents.map((d) => ({ id: d.id, category: d.category, title: d.title, expiry_date: d.expiry_date || null, document_versions: verOf(d.id).map((v) => ({ sha256: v.sha256, version_no: v.version_no })) }));
    }
    if (path === "documents" && method === "POST") { const d = { id: "d" + (db.documents.length + 1), created_at: new Date().toISOString(), ...body }; db.documents.push(d); return [d]; }
    if (path.startsWith("document_versions?document_id=")) {
      const id = /document_id=eq\.([^&]+)/.exec(path)[1];
      return verOf(id).sort((a, b) => b.version_no - a.version_no).slice(0, 1).map((v) => ({ version_no: v.version_no }));
    }
    if (path === "document_versions" && method === "POST") { const v = { id: "v" + (db.versions.length + 1), ...body }; db.versions.push(v); return [v]; }
    if (path.startsWith("documents?id=eq.") && method === "PATCH") {
      const id = /id=eq\.([^&]+)/.exec(path)[1];
      Object.assign(db.documents.find((d) => d.id === id) || {}, body);
      return [];
    }
    return [];
  }
  const deps = { sb, storagePut: async (key, buf, mime) => { db.stored.push({ key, size: buf.length, mime }); }, audit: async () => {}, notify: async () => {} };
  const sess = () => ({ sessionId: "s1", user: { id: "u1", email: "client@test.local" }, organization: db.org ? { id: db.org.id } : null });

  const log = { previews: [], confirms: [] };
  // يعيد { status, body } كما يفعل api/_simple.js
  async function handle(b) {
    if (b.action === "doc-intake") {
      const files = Array.isArray(b.files) ? b.files : [];
      log.previews.push({ files: files.length, prior: Array.isArray(b.prior) ? b.prior.length : 0 });
      const existingDocs = db.org ? await loadVaultIndex(sb, db.org.id) : [];
      const r = await intakeBatch({ files, org: db.org, existingDocs, prior: b.prior, demo: true });
      return { status: r.ok ? 200 : (r.error === "too_large" ? 413 : 400), body: r };
    }
    if (b.action === "doc-intake-confirm") {
      const files = Array.isArray(b.files) ? b.files : [];
      log.confirms.push({ files: files.map((f) => ({ id: f.id, name: f.name, title: f.title, category: f.category, expiry: f.expiry, fields: f.fields ? Object.keys(f.fields) : null })), facts: b.facts || null });
      const r = await confirmIntake({ files, facts: b.facts, sess: sess(), deps });
      return { status: r.status || (r.ok ? 200 : 400), body: r.ok ? { ok: true, saved: r.saved, skipped: r.skipped, organization: r.organization, factsApplied: r.factsApplied, factErrors: r.factErrors, createdOrg: r.createdOrg } : { ok: false, error: r.error } };
    }
    return null;
  }
  const meBody = () => ({ ok: true, testMode: true, user: { name: "عميل تجريبي", email: "client@test.local", phone: "0512345678" }, organization: db.org ? { id: db.org.id, name_ar: db.org.name_ar, name_en: db.org.name_en || "", cr_number: db.org.cr_number || "" } : null, counts: {}, requests: [] });
  const vaultItems = () => db.documents.map((d) => ({ id: d.id, title: d.title, category: d.category, expiry_date: d.expiry_date || null, created_at: d.created_at, extracted: d.extracted || null, issue_date: d.issue_date || null,
    document_versions: verOf(d.id).map((v) => ({ id: v.id, file_name: v.file_name, version_no: v.version_no })) }));
  return { db, log, handle, meBody, vaultItems, sha: (buf) => crypto.createHash("sha256").update(buf).digest("hex") };
}

// يربط مسارات المتصفح بالمنصّة الوهمية. `hook(b)` اختياري: يعيد {status,body} ليُفسد ردّاً بعينه أو null ليمرّ.
export async function attachHarness(page, h, hook) {
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/simple", async (route) => {
    let b = {};
    try { b = JSON.parse(route.request().postData() || "{}"); } catch {}
    if (b.action === "me") return json(route, h.meBody());
    const bad = hook ? await hook(b, route) : null;
    if (bad === "abort") return route.abort("failed");
    if (bad) return json(route, bad.body, bad.status);
    const r = await h.handle(b);
    if (r) return json(route, r.body, r.status);
    return json(route, { ok: false, error: "unknown_action" }, 404);
  });
  // Playwright يطابق آخر مسارٍ سُجّل أولاً: العامّ أولاً ثم المحدَّد
  await page.route("**/api/requests*", (route) => (route.request().method() === "POST" ? json(route, { ok: false, error: "unavailable" }, 503) : json(route, { ok: true, items: [] })));
  await page.route("**/api/requests?action=my-ops&what=documents*", (route) => json(route, { ok: true, items: h.vaultItems() }));
  await page.route("**/api/otp", (route) => json(route, { ok: true, password: true, passwordSignup: true }));
  await page.route("**/api/book*", (route) => json(route, { ok: true, days: [] }));
}
