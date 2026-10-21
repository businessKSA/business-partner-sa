// Stages and team updates on a request (the sales-client section of /my).
//
// What must hold:
//   - only the team can touch them (ops key / owner session), never a customer;
//   - an update is a DRAFT until published: a draft never reaches the customer
//     (not in request-get, not in a notice), and publishing tells them exactly once;
//   - a request with no stages or updates is returned exactly as before, so
//     customers who never had a progress line (every cart order) see nothing new;
//   - the first two sales stages fill themselves from the contract signature and
//     the payment, and the next stage becomes the active one.
//
// Runs the real handler in-process on a throwaway JSON database (LOCAL_DB_DIR).
// Run: npm test   (no dependencies, no browser; lives in tests/, not api/)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-stages-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
process.env.SIMPLE_TEST_MODE = "1";
process.env.SIMPLE_OPS_KEY = "test-ops";
process.env.EMAIL_MODE = "preview";
process.env.APP_ENV = "development"; // the preview outbox is written only in dev mode
process.env.WHATSAPP_MODE = "mock";

const { handleSimple, normStages, autoStages, STAGE_TEMPLATES } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

// The preview outbox echoes every notice it records; the assertions read the file instead.
const realLog = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith("[outbox")) realLog(...a); };

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

const mkRes = () => { const r = { statusCode: 200, headers: {}, setHeader(k, v) { r.headers[k] = v; }, end(t) { r.body = t; } }; return r; };
async function call(body, cookie) {
  const res = mkRes();
  await handleSimple({ method: "POST", body, query: {}, headers: { cookie: cookie ? "bp_sid=" + cookie : "", "user-agent": "stages-test" }, socket: {} }, res);
  return { s: res.statusCode, j: JSON.parse(res.body) };
}
const ops = (body) => call({ key: "test-ops", ...body });
const outboxCount = () => { try { return JSON.parse(fs.readFileSync(path.join(dir, "outbox.json"), "utf8")).length; } catch { return 0; } };

// A signed-in customer, minted the way api/otp.js does it.
async function customer(email, name) {
  const [user] = await sb("users?on_conflict=email", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: [{ email, full_name: name }] });
  const [org] = await sb("organizations", { method: "POST", body: [{ name_ar: name }] });
  await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: org.id, user_id: user.id, role_id: "owner", status: "active" }] });
  const raw = crypto.randomBytes(32).toString("base64url");
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ user_id: user.id, token_hash: sha256(raw), organization_id: org.id, expires_at: new Date(Date.now() + 36e5).toISOString() }] });
  return raw;
}
async function openRequest(email, title) {
  const r = await ops({ action: "ops-manual-intake", text: title, title, email, name: "Test", company: "AL-BIR Test", type: "COMPANY_FORMATION", source: "MANUAL", scope: [{ title: "ترخيص الاستثمار" }] });
  return r.j.ref;
}

// ---- pure helpers
ok(normStages(STAGE_TEMPLATES.sales).length === 5, "sales template has five stages");
ok(normStages(STAGE_TEMPLATES.sales).map((s) => s.key).join() === "sign_quote,first_payment,investment_license,commercial_register,secondary_licenses", "sales stages in the agreed order");
ok(normStages([{ key: "A b", title_ar: "x", status: "weird" }])[0].key === "a_b" && normStages([{ key: "a", title_ar: "x", status: "weird" }])[0].status === "pending", "keys are slugged and an unknown status becomes pending");
ok(normStages([{ key: "a", title_ar: "x" }, { key: "a", title_ar: "dup" }, { key: "", title_ar: "nokey" }, { key: "b" }]).length === 1, "duplicates, keyless and untitled stages are dropped");
ok(autoStages({ stages: [], contract: { status: "SIGNED" } }) === null, "no stages: nothing is derived");

// ---- permissions
const email = "al-bir-stages@test.local";
const cookie = await customer(email, "AL-BIR Test");
const ref = await openRequest(email, "AL-BIR stages");
let r = await call({ action: "ops-stages-init", ref }, cookie);
ok(r.s === 401, "a customer session cannot create stages");
r = await call({ action: "ops-update-add", ref, text_ar: "x" });
ok(r.s === 401, "no key, no session: refused");
r = await call({ key: "wrong", action: "ops-update-add", ref, text_ar: "x" });
ok(r.s === 401, "a wrong key is refused");

// ---- a request with no stages is returned as before
let g = await call({ action: "request-get", ref }, cookie);
ok(g.s === 200 && !("stages" in g.j.request) && !("updates" in g.j.request), "no stages, no updates: the customer's view gains no keys");

// ---- default stages
r = await ops({ action: "ops-stages-init", ref });
ok(r.s === 200 && r.j.stages.length === 5 && r.j.stages.every((s) => s.status === "pending"), "init creates the five default stages, all pending");
r = await ops({ action: "ops-stages-init", ref });
ok(r.s === 409 && r.j.error === "already_has_stages", "a second init does not overwrite");
r = await ops({ action: "ops-stages-init", ref, template: "nope", replace: true });
ok(r.s === 400, "an unknown template is refused");
g = await call({ action: "request-get", ref }, cookie);
ok(g.j.request.stages.length === 5, "the customer sees the stages");

// ---- editing a stage
r = await ops({ action: "ops-stage-set", ref, stage: "investment_license", status: "weird" });
ok(r.s === 400 && r.j.error === "bad_status", "a bad stage status is refused");
r = await ops({ action: "ops-stage-set", ref, stage: "investment_license", status: "active", note: "قُدّم الطلب" });
ok(r.s === 200 && r.j.stages.find((s) => s.key === "investment_license").status === "active", "a stage can be moved to active with a note");
r = await ops({ action: "ops-stage-set", ref, stage: "extra_step", title_ar: "مرحلة إضافية", after: "commercial_register" });
ok(r.s === 200 && r.j.stages[4].key === "extra_step" && r.j.stages.length === 6, "a custom stage is inserted after a given one");
r = await ops({ action: "ops-stage-set", ref, stage: "ghost" });
ok(r.s === 404, "an unknown stage without a title is not created");
r = await ops({ action: "ops-stage-set", ref, stage: "extra_step", remove: true });
ok(r.s === 200 && r.j.stages.length === 5, "a stage can be removed");

// ---- updates: draft, publish, exactly one notice
const mailBefore = outboxCount();
r = await ops({ action: "ops-update-add", ref, text_ar: "بدأنا في ترخيص الاستثمار.", text_en: "We started the investment license." });
const id = r.j.update && r.j.update.id;
ok(r.s === 200 && id && r.j.update.published === false, "an update starts as a draft");
g = await call({ action: "request-get", ref }, cookie);
ok(!("updates" in g.j.request), "a draft update is not in the customer's view");
ok(!JSON.stringify(g.j).includes("بدأنا في ترخيص"), "a draft's text appears nowhere in the customer's response");
ok(outboxCount() === mailBefore, "adding a draft tells nobody");
r = await ops({ action: "ops-update-edit", ref, id, text_ar: "بدأنا في ترخيص الاستثمار اليوم." });
ok(r.s === 200 && r.j.update.text_ar.endsWith("اليوم."), "a draft can be edited");
r = await ops({ action: "ops-update-publish", ref, id });
ok(r.s === 200 && r.j.update.published === true && r.j.update.published_at, "publishing flags and dates the update");
ok(outboxCount() > mailBefore, "publishing notifies the customer");
const afterPublish = outboxCount();
g = await call({ action: "request-get", ref }, cookie);
const seen = g.j.request.updates;
ok(Array.isArray(seen) && seen.length === 1 && seen[0].text_ar.includes("اليوم") && seen[0].text_en.includes("started"), "the published update reaches the customer in both languages");
ok(!("by" in seen[0]) && !("published" in seen[0]), "the author and the draft flag stay internal");
r = await ops({ action: "ops-update-publish", ref, id });
ok(r.s === 200 && r.j.already === true && outboxCount() === afterPublish, "publishing twice changes nothing and tells nobody twice");
r = await ops({ action: "ops-update-edit", ref, id, text_ar: "تعديل" });
ok(r.s === 409 && r.j.error === "already_published", "a published update cannot be edited in place");
r = await ops({ action: "ops-update-delete", ref, id });
ok(r.s === 409 && r.j.error === "unpublish_first", "a published update cannot be deleted");
r = await ops({ action: "ops-update-unpublish", ref, id });
g = await call({ action: "request-get", ref }, cookie);
ok(r.s === 200 && !("updates" in g.j.request), "unpublishing takes it back out of the customer's view");
r = await ops({ action: "ops-update-delete", ref, id });
ok(r.s === 200, "an unpublished update can be deleted");
r = await ops({ action: "ops-update-add", ref, text_ar: "" });
ok(r.s === 400, "an empty update is refused");
const mail2 = outboxCount();
r = await ops({ action: "ops-update-add", ref, text_ar: "تحديث صامت", publish: true, notify: false });
ok(r.s === 200 && r.j.update.published === true && outboxCount() === mail2, "add-and-publish with notify:false publishes without a notice");

// ---- the ops view keeps drafts; the internal log records every change
await ops({ action: "ops-update-add", ref, text_ar: "مسوّدة داخلية" });
const o = await ops({ action: "ops-request", ref });
ok(o.j.request.updates.some((u) => u.published === false && u.text_ar === "مسوّدة داخلية"), "the panel still sees the draft");
const ev = o.j.request.events.map((e) => e.event);
ok(["stages.init", "stage.set", "update.added", "update.published", "update.unpublished", "update.deleted"].every((e) => ev.includes(e)), "every change is in the event log");
ok(o.j.request.events.filter((e) => /^(stage|stages|update)\./.test(e.event)).every((e) => e.actor_kind === "internal"), "those events are internal (never in the customer's timeline)");
ok(!g.j.request.events.some((e) => /^(stage|stages|update)\./.test(e.event)), "the customer's timeline shows none of them");

// ---- the first two stages fill themselves
const ref2 = await openRequest(email, "AL-BIR auto");
await ops({ action: "ops-stages-init", ref: ref2 });
await ops({ action: "ops-quote", ref: ref2, items: [{ title: "ترخيص الاستثمار", qty: 1, price: 1000 }] });
await call({ action: "me" }, cookie);
await call({ action: "quote-approve", ref: ref2 }, cookie);
r = await call({ action: "contract-sign", ref: ref2, name: "AL-BIR", consent: true }, cookie);
g = await call({ action: "request-get", ref: ref2 }, cookie);
let st = g.j.request.stages;
ok(r.s === 200 && st[0].status === "done" && st[0].at, "signing the contract completes «توقيع العرض»");
ok(st[1].status === "active" && st[2].status === "pending", "and puts the payment stage in progress");
await call({ action: "pay-test", ref: ref2, outcome: "success", provider: "card" }, cookie);
g = await call({ action: "request-get", ref: ref2 }, cookie);
st = g.j.request.stages;
ok(st[0].status === "done" && st[1].status === "done" && st[1].at, "payment completes «الدفعة الأولى»");
ok(st[2].status === "active" && st[3].status === "pending", "and the next stage becomes the active one");

// init on a request already signed and paid derives the first two at once
const ref3 = await openRequest(email, "AL-BIR late init");
await ops({ action: "ops-quote", ref: ref3, items: [{ title: "ترخيص", qty: 1, price: 500 }] });
await call({ action: "quote-approve", ref: ref3 }, cookie);
await call({ action: "contract-sign", ref: ref3, name: "AL-BIR", consent: true }, cookie);
await call({ action: "pay-test", ref: ref3, outcome: "success", provider: "card" }, cookie);
r = await ops({ action: "ops-stages-init", ref: ref3 });
ok(r.j.stages[0].status === "done" && r.j.stages[1].status === "done" && r.j.stages[2].status === "active", "initialising after payment starts from the facts already known");

// ---- a cart-style customer with no stages is untouched
const cart = await openRequest(email, "plain order");
await ops({ action: "ops-quote", ref: cart, items: [{ title: "خدمة", qty: 1, price: 100 }] });
await call({ action: "quote-approve", ref: cart }, cookie);
await call({ action: "contract-sign", ref: cart, name: "AL-BIR", consent: true }, cookie);
await call({ action: "pay-test", ref: cart, outcome: "success", provider: "card" }, cookie);
g = await call({ action: "request-get", ref: cart }, cookie);
ok(g.j.request.status === "PAID" && !("stages" in g.j.request) && !("updates" in g.j.request), "a request that never had stages gains none from signing or paying");

// ---- a cancelled request takes no stage or update changes
await ops({ action: "ops-cancel", ref: cart, note: "test" });
r = await ops({ action: "ops-update-add", ref: cart, text_ar: "x" });
ok(r.s === 409 && r.j.error === "request_closed", "a cancelled request takes no updates");

// ---- the page itself: drawn only when there is something to draw
const my = fs.readFileSync(new URL("../site/scripts/simple-v1-my.mjs", import.meta.url), "utf8");
ok(/function stageLine\(r\)\{var st=r\.stages\|\|\[\];if\(!st\.length\)return null/.test(my), "/my draws no progress line without stages");
ok(/function updatesCard\(r\)\{var up=r\.updates\|\|\[\];if\(!up\.length\)return null/.test(my), "/my draws no updates card without published updates");
ok(/var pl=stageLine\(r\);if\(pl\)box\.appendChild\(pl\)/.test(my) && /var uc=updatesCard\(r\);if\(uc\)right\.appendChild\(uc\)/.test(my), "/my places both only when they exist");

// the JSON database flushes on a short timer; clean up after it has
await new Promise((r) => setTimeout(r, 200));
try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
if (fail.length) { console.log("\nFAILED:", fail.length); process.exit(1); }
console.log("# ALL PASS");
