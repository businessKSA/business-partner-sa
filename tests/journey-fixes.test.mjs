// رحلة العميل — إصلاحات تدقيق 2026-10-21 (D2 · D3 · D4 · D5 · D8 · D9 · D13 · D14 · D15 · D17 · D20).
//
// الخادم يُقاس على `handleSimple` الحقيقي فوق قاعدة محلية مؤقّتة؛ والواجهة على السكربت الذي يبنيه
// buildSimpleMy فعلاً (لا نسخة منه) — تحليلٌ نحوي، ونصوصٌ بالأربع لغات، وحراسٌ لما أُصلح.
// ما يخصّ التخطيط (D5 · D11) والتبويبات (D2) فُحص بمتصفح حقيقي ولقطاته في صفحة التسليم.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "journey-fixes-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
globalThis.fetch = async (url) => { throw new Error("a local run must not reach the network: " + url); };

const { handleSimple, isPlaceholderName, partyName, fullNameOk } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");
const { buildSimpleMy } = await import("../site/scripts/simple-v1-my.mjs");

// ---- a client whose only "name" is the prefix of the address (what an e-mail link creates)
const EMAIL = "journey1@test.local";
const [u] = await sb("users", { method: "POST", prefer: "return=representation", body: [{ email: EMAIL, full_name: "journey1" }] });
const [org] = await sb("organizations", { method: "POST", body: [{ name_ar: "journey1" }] });
await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: org.id, user_id: u.id, role_id: "owner", status: "active" }] });
const TOKEN = "tok-journey-fixes-aaaaaaaa";
await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(TOKEN), user_id: u.id, organization_id: org.id, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });

async function call(action, body = {}) {
  const out = { status: 200, body: null };
  const isOps = action.startsWith("ops-");
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: { cookie: isOps ? "" : `bp_sid=${TOKEN}` }, socket: {}, query: {}, body: { action, ...(isOps ? { key: "test-ops" } : {}), ...body } }, res);
  return out;
}
const rowOf = async (ref) => (await sb(`requests?ref=eq.${ref}&select=*`))[0];
const SCOPE = [{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }];

test("D3: بادئة البريد ليست اسماً", () => {
  assert.equal(isPlaceholderName("journey1", "journey1@test.local"), true);
  assert.equal(isPlaceholderName("", "a@b.co"), true);
  assert.equal(isPlaceholderName("سارة العتيبي", "journey1@test.local"), false);
  assert.equal(fullNameOk("journey1"), false, "كلمة واحدة");
  assert.equal(fullNameOk("سارة العتيبي"), true);
  assert.equal(fullNameOk("Sara 2 Ali"), false, "أرقام");
  assert.equal(partyName({ company_name: "journey1", client_name: "journey1", client_email: "journey1@test.local" }), "journey1@test.local");
  assert.equal(partyName({ company_name: "journey1", client_name: "سارة العتيبي", client_email: "journey1@test.local" }), "سارة العتيبي");
  assert.equal(partyName({ company_name: "شركة النور", client_name: "سارة العتيبي", client_email: "x@y.co" }), "شركة النور");
});

test("D3: الحساب بلا اسم وجوال يُطلب منه ذلك، ولا يؤكد نطاقاً قبله", async () => {
  const me = await call("me");
  assert.equal(me.body.user.needsProfile, true);
  assert.equal(me.body.user.needsName, true);
  assert.equal(me.body.user.needsPhone, true);
  assert.equal(me.body.user.name, "", "البادئة لا تُعاد على أنها اسم");

  // طلب أُنشئ قبل أي اسم (المحادثة): لا اسم ولا جوال عليه
  const c = await call("request-create", { type: "COMPANY_FORMATION", title: "تأسيس", scope: SCOPE });
  assert.equal(c.body.ok, true);
  const before = await rowOf(c.body.ref);
  assert.equal(before.client_phone, "");
  assert.equal(before.company_name, "", "البادئة لم تعد تُكتب اسماً للمنشأة على الطلب");

  const blocked = await call("scope-confirm", { ref: c.body.ref });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error, "profile_required");
  assert.equal((await rowOf(c.body.ref)).status, "NEW", "لم يتحرك الطلب");
});

test("D3: التحقق من الاسم والجوال لا يُضعَّف", async () => {
  assert.equal((await call("profile-set", { name: "journey1", phone: "0501234567" })).body.error, "invalid_name");
  assert.equal((await call("profile-set", { name: "سارة العتيبي", phone: "12345" })).body.error, "invalid_phone");
  assert.equal((await call("profile-set", { name: "سارة العتيبي", phone: "" })).body.error, "invalid_phone");
  assert.equal((await call("profile-set", { name: "سارة <b>", phone: "0501234567" })).body.error, "invalid_name");
  const still = await call("me");
  assert.equal(still.body.user.needsProfile, true, "لم يُحفظ شيء من المحاولات المرفوضة");
});

test("D3: بعد حفظ الاسم والجوال يحملهما كل طلب مفتوح والعرض والعقد والفاتورة", async () => {
  const open = (await call("requests")).body.requests[0].ref;
  const r = await call("profile-set", { name: "سارة  العتيبي", phone: "٠٥٠١٢٣٤٥٦٧" });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.user.phone, "+966501234567");
  assert.equal(r.body.updated >= 1, true);

  const me = await call("me");
  assert.equal(me.body.user.needsProfile, false);
  assert.equal(me.body.user.name, "سارة العتيبي");
  assert.equal(me.body.organization.name_ar, "سارة العتيبي", "اسم المنشأة لم يعد البادئة");

  const row = await rowOf(open);
  assert.equal(row.client_name, "سارة العتيبي");
  assert.equal(row.client_phone, "+966501234567");
  assert.equal(row.company_name, "سارة العتيبي");

  // الطلب الجديد يأخذها من الحساب دون أن يرسلها النموذج
  const c = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "طلب", scope: SCOPE });
  const nr = await rowOf(c.body.ref);
  assert.equal(nr.client_name, "سارة العتيبي");
  assert.equal(nr.client_phone, "+966501234567");

  // تأكيد النطاق يمرّ، والعرض والعقد يحملان الاسم الحقيقي
  const conf = await call("scope-confirm", { ref: c.body.ref });
  assert.equal(conf.body.ok, true, JSON.stringify(conf.body));
  const qv = await call("quote-view", { ref: c.body.ref });
  assert.ok(qv.body.html.includes("سارة العتيبي"), "العرض");
  assert.ok(!qv.body.html.includes(">journey1<"), "ولا بادئة");
  const ap = await call("quote-approve", { ref: c.body.ref });
  assert.equal(ap.body.ok, true);
  const cv = await call("contract-view", { ref: c.body.ref });
  assert.ok(cv.body.html.includes("سارة العتيبي"), "العقد");
  assert.ok(!/journey1/.test(cv.body.html), "العقد بلا البادئة");
});

test("D1: ورقة العقد في البوابة بلا علامات DocuSign قبل التوقيع وبعده، وتحمل التوقيع، والمخزَّن والبصمة لا يتغيّران", async () => {
  const c = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "عقد", scope: SCOPE });
  const ref = c.body.ref;
  await call("ops-quote", { ref, items: [{ code: "BP-SBC-01", title: "خدمة ثابتة", price: 1000, qty: 1 }] });
  assert.equal((await call("quote-approve", { ref })).body.ok, true);

  const stored0 = (await rowOf(ref)).contract.html;
  assert.ok(stored0.includes("/sig1/") && stored0.includes("/date1/"), "المخزَّن يحتفظ بالعلامتين لأن DocuSign يضع توقيعه عليهما");
  const before = await call("contract-view", { ref });
  assert.ok(!before.body.html.includes("/sig1/") && !before.body.html.includes("/date1/"), "قبل التوقيع");
  assert.equal(before.body.needsResign, false);

  const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const sg = await call("contract-sign", { ref, name: "سارة العتيبي", consent: true, signature: PNG });
  assert.equal(sg.body.ok, true);
  const row = await rowOf(ref);
  assert.equal(row.contract.html, stored0, "نص العقد المخزَّن لم يُمسّ (بصمته مأخوذة منه)");
  assert.equal(row.contract.signature.contract_sha256, (await import("node:crypto")).createHash("sha256").update(stored0).digest("hex"));

  const after = await call("contract-view", { ref });
  assert.ok(!after.body.html.includes("/sig1/") && !after.body.html.includes("/date1/"), "بعد التوقيع");
  assert.ok(after.body.html.includes("سارة العتيبي") && after.body.html.includes(PNG), "الاسم ورسم التوقيع");
  assert.equal(after.body.needsResign, false, "عقدٌ موقَّع لا يتحوّل إلى «يلزم توقيع جديد»");
  assert.equal((await rowOf(ref)).contract.needs_resign || false, false);

  const o = await call("ops-contract-html", { ref });
  assert.ok(!o.body.html.includes("/sig1/") && o.body.html.includes("سارة العتيبي"), "اللوحة ترى ما يراه العميل");
});

test("D1/D3: عقدٌ وُقِّع باسمٍ قديم (بادئة البريد) لا يُوسَم «يلزم توقيع جديد» حين يُملأ الاسم الحقيقي، قديماً كان أو جديداً", async () => {
  const mk = async (mail) => {
    const [uu] = await sb("users", { method: "POST", prefer: "return=representation", body: [{ email: mail, full_name: mail.split("@")[0] }] });
    const [oo] = await sb("organizations", { method: "POST", body: [{ name_ar: mail.split("@")[0] }] });
    await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: oo.id, user_id: uu.id, role_id: "owner", status: "active" }] });
    const tk = "tok-" + mail.split("@")[0] + "-cccccccc";
    await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(tk), user_id: uu.id, organization_id: oo.id, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });
    return async (action, body = {}) => {
      const out = { body: null };
      const res = { statusCode: 200, setHeader() {}, end(b) { out.body = JSON.parse(b); } };
      await handleSimple({ method: "POST", headers: { cookie: action.startsWith("ops-") ? "" : `bp_sid=${tk}` }, socket: {}, query: {}, body: { action, ...(action.startsWith("ops-") ? { key: "test-ops" } : {}), ...body } }, res);
      return out.body;
    };
  };
  // (أ) عقد صدر بعد الإصلاح بلا اسم حقيقي، ووُقِّع، ثم مُلئ الملف الشخصي
  const a = await mk("newer@test.local");
  const ra = (await a("request-create", { type: "CONSULTATION", title: "أ", phone: "0501112233", name: "newer", scope: SCOPE })).ref;
  await a("ops-quote", { ref: ra, items: [{ code: "BP-SBC-01", title: "خدمة ثابتة", price: 500, qty: 1 }] });
  await a("quote-approve", { ref: ra });
  await a("contract-sign", { ref: ra, name: "newer", consent: true, signature: "data:image/png;base64," + "A".repeat(200) });
  await a("profile-set", { name: "نورة الشمري", phone: "0501112233" });
  const va = await a("contract-view", { ref: ra });
  assert.equal(va.needsResign, false, "الاسم يُحفظ في build ويُعاد به البناء");

  // (ب) عقد قديم: بلا build.party، نصّه المخزَّن بُني بالقاعدة القديمة (اسم المنشأة = البادئة)
  const bb = await mk("older@test.local");
  const rb = (await bb("request-create", { type: "CONSULTATION", title: "ب", phone: "0501112244", name: "older", scope: SCOPE })).ref;
  await bb("ops-quote", { ref: rb, items: [{ code: "BP-SBC-01", title: "خدمة ثابتة", price: 500, qty: 1 }] });
  await bb("quote-approve", { ref: rb });
  await bb("contract-sign", { ref: rb, name: "older", consent: true, signature: "data:image/png;base64," + "A".repeat(200) });
  const row = await rowOf(rb);
  const legacyHtml = row.contract.html.split("older@test.local").join("older");
  const { party, ...b0 } = row.contract.build;
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { company_name: "older", client_name: "older", contract: { ...row.contract, html: legacyHtml, build: b0 } } });
  await bb("profile-set", { name: "هدى القحطاني", phone: "0501112244" }); // موقَّع: لا يُلمس
  const vb = await bb("contract-view", { ref: rb });
  assert.equal(vb.needsResign, false, "العقد القديم يُعاد بناؤه بقاعدته القديمة فيطابق ما وُقِّع");
  assert.ok(vb.html.includes("older"), "ويبقى الاسم الذي وُقِّع به");
});

test("D3: طلبٌ عقده موقَّع لا يُغيَّر اسمه بأثر رجعي", async () => {
  const [u2] = await sb("users", { method: "POST", prefer: "return=representation", body: [{ email: "late@test.local", full_name: "late" }] });
  const [o2] = await sb("organizations", { method: "POST", body: [{ name_ar: "late" }] });
  await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: o2.id, user_id: u2.id, role_id: "owner", status: "active" }] });
  const tok = "tok-journey-late-bbbbbbbb";
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(tok), user_id: u2.id, organization_id: o2.id, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });
  const [rq] = await sb("requests", { method: "POST", body: [{ ref: "BP-R-LATE01", organization_id: o2.id, user_id: u2.id, type: "CONSULTATION", source: "WEBSITE", status: "SIGNED", lang: "ar", title: "x", client_name: "late", client_email: "late@test.local", client_phone: "", company_name: "late", contract: { number: "C-1", status: "SIGNED", html: "<p>x</p>" }, scope: [], conversation: [], documents: [] }] });
  const res = { statusCode: 200, setHeader() {}, end(b) { this.out = JSON.parse(b); } };
  await handleSimple({ method: "POST", headers: { cookie: `bp_sid=${tok}` }, socket: {}, query: {}, body: { action: "profile-set", name: "ليلى المطيري", phone: "0555555555" } }, res);
  assert.equal(res.out.ok, true);
  const after = (await sb(`requests?id=eq.${rq.id}&select=client_name,company_name`))[0];
  assert.equal(after.client_name, "late", "ما وُقِّع يبقى كما وُقِّع");
});

test("D4: طلب التعديل يستلزم سبباً، ويصل الفريق نصّه، ويبقى مسجَّلاً على العرض", async () => {
  const c = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "تعديل", scope: SCOPE });
  const ref = c.body.ref;
  assert.equal((await call("ops-quote", { ref, items: [{ code: "BP-SBC-01", title: "خدمة ثابتة", price: 7500, qty: 1 }] })).body.ok, true);

  const empty = await call("quote-reject", { ref, note: "" });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error, "note_required");
  assert.equal((await rowOf(ref)).status, "QUOTE_SENT", "العرض بحاله");
  assert.equal((await call("quote-reject", { ref, note: " ا " })).body.error, "note_required");

  const ok = await call("quote-reject", { ref, note: "أريد إضافة بند الترجمة وخفض الكمية" });
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.quote.status, "REJECTED");
  assert.equal(ok.body.quote.decision_note, "أريد إضافة بند الترجمة وخفض الكمية");
  const row = await rowOf(ref);
  assert.ok(row.conversation.some((m) => m.role === "user" && m.content.includes("بند الترجمة")), "السبب في المحادثة");
});

test("D9: بعد رفض العرض تعود أسعار البنود إلى جدول التسعير في اللوحة", async () => {
  const c = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "أسعار", scope: [{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }, { code: "", title: "بند حر", qty: 2 }] });
  const ref = c.body.ref;
  await call("ops-quote", { ref, items: [{ code: "BP-SBC-01", title: "خدمة ثابتة", price: 7500, qty: 1 }, { code: "", title: "بند حر", price: 300, qty: 2 }] });
  await call("quote-reject", { ref, note: "السعر مرتفع علينا" });
  const g = await call("ops-request", { ref });
  assert.equal(g.body.ok, true);
  const byTitle = Object.fromEntries(g.body.request.scope.map((i) => [i.title, i.price]));
  assert.equal(byTitle["خدمة ثابتة"], 7500);
  assert.equal(byTitle["بند حر"], 300, "بند بلا رمز يُطابَق بعنوانه");
});

test("D20: المدفوع الذي يُلغى أو يُطلب إلغاؤه: رسالة صادقة بلا وعد بمبلغ ولا مدة", async () => {
  const c = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "مدفوع", scope: SCOPE });
  const ref = c.body.ref;
  await call("ops-quote", { ref, items: [{ code: "BP-SBC-01", title: "خدمة ثابتة", price: 1000, qty: 1 }] });
  await call("quote-approve", { ref });
  await call("contract-sign", { ref, name: "سارة العتيبي", consent: true, signature: "data:image/png;base64," + "A".repeat(200) });
  assert.equal((await call("pay-test", { ref, outcome: "success" })).body.ok, true);

  const rq = await call("request-cancel", { ref, note: "غيّرت رأيي" });
  assert.equal(rq.body.requested, true);
  const ob = JSON.parse(fs.readFileSync(path.join(process.env.LOCAL_DB_DIR, "outbox.json"), "utf8"));
  const mail = ob.find((m) => /طلب إلغاء/.test(m.subject || "") && String(m.to || "").includes("journey1@test.local"));
  assert.ok(mail, "بريد العميل");
  assert.ok(/الطلب مدفوع/.test(mail.body) && /لا نَعِد/.test(mail.body), "يقول إن المراجعة تشمل الدفعة ولا يعد");
  assert.ok(!/IN_PROGRESS|PAID\b/.test(mail.body), "بلا رموز تقنية");

  const oc = await call("ops-cancel", { ref, note: "بطلب العميل" });
  assert.equal(oc.body.wasPaid, true);
  const row = await rowOf(ref);
  assert.equal(row.cancel.was_paid, true, "الواجهة تقرؤها لتشرح للعميل");
});

test("D14: الأسطر التي يكتبها الخادم للفريق تسمّي المرحلة بالعربية لا برمزها", async () => {
  const src = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../api/_simple.js"), "utf8");
  assert.ok(!/في مرحلة \$\{row\.status\}/.test(src) && !/من مرحلة \$\{row\.status\}/.test(src), "لا مرحلة خام في نصٍّ مكتوب");
  assert.ok(/stageAr\(row\.status\)/.test(src));
});

// ------------------------------------------------------------------- the page
const LANGS = ["ar", "en", "fr", "zh"];
function build(lang) {
  let out = { css: "", script: "" };
  const sv1 = { href: (p) => p, header: () => "", footer: () => "", shell: (o) => { out = { css: o.body, script: o.script }; return o.script; } };
  buildSimpleMy(sv1, { lang: () => lang });
  return out;
}
const PAGES = Object.fromEntries(LANGS.map((l) => [l, build(l)]));
const inner = (s) => s.replace(/<\/script>\s*<script>/g, "\n").replace(/^<script>/, "").replace(/<\/script>$/, "");

test("الصفحة: تُحلَّل نحوياً بالأربع لغات وفيها كل نصوص الإصلاحات بلا عربية في غير العربية", () => {
  const KEYS = ["pfTitle", "pfText", "pfName", "pfSave", "pfBadName", "pfLater", "resumeNote", "revTitle", "revText", "revNeed", "revGo", "revSentTitle", "revSentText", "payFailedMsg", "payCancelledMsg", "payPendingMsg", "cxPaidDone", "cxPendPaid"];
  for (const l of LANGS) {
    assert.doesNotThrow(() => new vm.Script(inner(PAGES[l].script)), `lang ${l}`);
    const tx = JSON.parse(/TX=(\{.*?\}),ST=/s.exec(PAGES[l].script)[1]);
    for (const k of KEYS) {
      assert.ok(tx[k] && tx[k].length > 1, `${l}.${k}`);
      if (l !== "ar") assert.ok(!/[؀-ۿ]/.test(tx[k]), `${l}.${k} بلا حروف عربية`);
    }
  }
});

test("الصفحة: خطوة الاسم والجوال تسبق التوجيه، وتأكيد النطاق يعيد إليها", () => {
  const s = inner(PAGES.ar.script);
  assert.ok(/needsProfile&&!profileLater\(o\)\)\{state\.me=o;renderProfile\(o\);return\}\s*var nx=nextPath\(\)/.test(s), "قبل nextPath");
  assert.ok(s.includes("api('profile-set'"));
  assert.ok(s.includes("o.error==='profile_required'"), "تأكيد النطاق يعيد إلى الخطوة");
  assert.ok(s.includes("sv1_profile_later"), "المتعاقد لا يُحجب عن الدفع");
});

test("الصفحة: رابط البريد يكمل طلب المحادثة المحفوظ بدل أن يُضيّعه (D2)", () => {
  const s = inner(PAGES.ar.script);
  assert.ok(s.includes("sv1_pending_quote") && s.includes("sv1_link_resume"));
  // يُعلَّم عند نجاح الرابط قبل التسلسل الحرفي الذي يعيد له sv1-quote-auth-flow.mjs كتابته بإعادة تحميل
  assert.ok(/sv1_link_resume','1'\)\}catch\(x\)\{\}try\{localStorage\.setItem\('bp_session','1'\)\}catch\(x\)\{\}boot\(\)/.test(s));
  assert.ok(s.includes("HOME+'?resume=quote#advisor'"));
});

test("الصفحة: «طلب تعديل» نافذة بسبب مطلوب وتأكيد، لا رفضٌ فوري (D4)", () => {
  const s = inner(PAGES.ar.script);
  assert.ok(s.includes("function reviseSheet(") && s.includes("onclick:function(){qerr.textContent='';reviseSheet("));
  assert.ok(!/api\('quote-reject',\{ref:r\.ref,note:rn\.value\}\)/.test(s), "لا زرّ يرفض مباشرة");
  assert.ok(s.includes("sv1ReviseState"), "حالة بعد الإرسال تشرح ما يجري");
});

test("الصفحة: حالة الدفع الفاشل تُشرح لا تُطبع بحروفها (D8) وسطر الإلغاء بعد الدفع (D20)", () => {
  const s = inner(PAGES.ar.script);
  assert.ok(!s.includes("TX.payment+': '+r.payment.status"));
  assert.ok(s.includes("TX.payFailedMsg") && s.includes("TX.cxPaidDone") && s.includes("TX.cxPendPaid"));
  assert.ok(s.includes("r.status==='CANCELLED'?null:stageLine(r)"), "لا مراحل «جارية» على طلب ملغى");
});

test("الصفحة: أخطاء التوقيع تُمحى بالتعبئة (D13) وسطر الفاتورة لا يختلط اتجاهه (D15) والخط الزمني بلا تكرار (D17)", () => {
  const s = inner(PAGES.ar.script);
  assert.ok(s.includes("nm.addEventListener('input',function(){err.textContent=''})"));
  assert.ok(s.includes('<bdi dir="ltr">'));
  assert.ok(s.includes("function tlEvents(r)"));
  const m = /function tlEvents\(r\)\{.*?\}\n/s.exec(s)[0];
  const tl = new vm.Script("(" + m.replace(/^function tlEvents/, "function") + ")").runInNewContext({});
  const out = tl({ events: [{ event: "attachment.added", details: { doc: "الجواز" } }, { event: "document.received", details: { title: "الجواز" } }, { event: "document.received", details: { title: "غيره" } }, { event: "scope.confirmed" }] });
  assert.deepEqual(out.map((e) => e.event), ["attachment.added", "document.received", "scope.confirmed"], "حدث واحد للمستند الواحد");
});

test("الصفحة: صف أزرار النطاق يلتفّ على الجوال (D5) والخط الزمني لا يقطع سطوره (D17)", () => {
  const css = PAGES.ar.css;
  assert.ok(/\.msgform\{display:flex;flex-wrap:wrap/.test(css));
  assert.ok(/\.msgform input,\.inp\{flex:1 1 150px;min-width:0/.test(css));
  assert.ok(/\.tl li\{flex-wrap:wrap/.test(css));
  assert.ok(/\.my-main\{padding:16px 14px 120px\}/.test(css), "مساحة تحت المحتوى لزرّي إتاحة وتواصل (D11)");
  assert.ok(css.includes("body:has(.docovl) .bps-fab"), "الزرّان العائمان يتنحّيان عن العقد بالحجم الكامل");
});

test("D2: الصفحة الرئيسية تترك نسخة من مسوّدة المحادثة تعبر تبويب الرابط، وتُمحى عند إنشاء الطلب ولا تُنشئ طلبين", () => {
  const src = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../site/scripts/sv1-quote-auth-flow.mjs"), "utf8");
  assert.ok(src.includes("localStorage.setItem('sv1_pending_quote'"), "تُحفظ عند ضغط «أنشئ عرض السعر» للزائر");
  assert.ok(src.includes("36e5"), "ساعة واحدة فقط");
  assert.ok(src.includes("localStorage.removeItem('sv1_pending_quote')"), "تُمحى بعد إنشاء الطلب");
  assert.ok(src.includes("sv1_pending_done") && src.includes("alreadyCreated()"), "لا طلبان من مسوّدة واحدة");
  assert.ok(src.includes("function draft(fromLink)"), "التبويب الذي فتحه الرابط يفضّل النسخة على مسوّدة الصفحة الافتراضية");
});
