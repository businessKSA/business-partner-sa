// The «sales» role in /ops (owner decision 2026-10-21): the sales team updates the
// stages and the published updates of THEIR clients — and nothing else in the panel.
//
// What must hold:
//   - no SALES_TEAM_EMAILS (unset / empty / garbage) = there is no sales role at all;
//   - a listed e-mail, signed in, may use exactly nine actions; every other ops-* action
//     in the handler is refused 403 and does nothing (all of them are tried here);
//   - he sees and touches only requests tagged for sales (assigned_to = «sales» or his own
//     address); another client, an untagged one, a missing one: 403 — never 404;
//   - what he reads of a request carries no payment, invoice, contract, quote, conversation,
//     internal note or task, and no money event;
//   - every change he makes is in the internal event log under his e-mail, whatever «actor»
//     the browser claims; a draft stays invisible to the customer until he publishes;
//   - an ordinary customer is still refused, the owner is unchanged, and the role does not
//     weaken PANEL_REQUIRE_NAFATH (the owner's session door stays shut, the sales door opens
//     nothing but its nine actions).
//
// Runs the real handler in-process on a throwaway JSON database (LOCAL_DB_DIR).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-sales-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
process.env.SIMPLE_TEST_MODE = "1";
process.env.SIMPLE_OPS_KEY = "test-ops";
process.env.EMAIL_MODE = "preview";
process.env.APP_ENV = "development";
process.env.WHATSAPP_MODE = "mock";
delete process.env.SALES_TEAM_EMAILS;
delete process.env.PANEL_REQUIRE_NAFATH;

const { handleSimple, SALES_ACTIONS, salesTeamEmails } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

const realLog = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith("[outbox")) realLog(...a); };
const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

const mkRes = () => { const r = { statusCode: 200, headers: {}, setHeader(k, v) { r.headers[k] = v; }, end(t) { r.body = t; } }; return r; };
async function call(body, cookie) {
  const res = mkRes();
  await handleSimple({ method: "POST", body, query: {}, headers: { cookie: cookie ? "bp_sid=" + cookie : "", "user-agent": "sales-test" }, socket: {} }, res);
  return { s: res.statusCode, j: JSON.parse(res.body), raw: res.body };
}
const ops = (body) => call({ key: "test-ops", ...body });
async function account(email, name) {
  const [user] = await sb("users?on_conflict=email", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: [{ email, full_name: name }] });
  const [org] = await sb("organizations", { method: "POST", body: [{ name_ar: name }] });
  await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: org.id, user_id: user.id, role_id: "owner", status: "active" }] });
  const raw = crypto.randomBytes(32).toString("base64url");
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ user_id: user.id, token_hash: sha256(raw), organization_id: org.id, expires_at: new Date(Date.now() + 36e5).toISOString() }] });
  return raw;
}
async function openRequest(email, title, assigned) {
  const r = await ops({ action: "ops-manual-intake", text: title, title, email, name: "Test", company: title, type: "COMPANY_FORMATION", source: "MANUAL", scope: [{ title: "ترخيص الاستثمار" }], assigned_to: assigned || undefined });
  return r.j.ref;
}
const rowOf = async (ref) => (await sb(`requests?ref=eq.${ref}&select=*&limit=1`))[0];

// ---- accounts
const SALES = "sales@test.local", SALES2 = "sales2@test.local";
const sCookie = await account(SALES, "Sales One");
const s2Cookie = await account(SALES2, "Sales Two");
const custCookie = await account("al-bir@test.local", "AL-BIR Test");
const stranger = await account("stranger@test.local", "Stranger");
const ownerCookie = await account("dr.baher.magnas@gmail.com", "Owner");

// ---- requests: the tags decide who sees what
const tagged = await openRequest("al-bir@test.local", "AL-BIR tagged for the team", "sales");
const mine = await openRequest("mine@test.local", "Assigned to sales one", SALES);
const theirs = await openRequest("theirs@test.local", "Assigned to sales two", SALES2);
const cart = await openRequest("cart@test.local", "A cart customer", "");
const other = await openRequest("other@test.local", "Assigned to a person", "Badr");
await sb(`requests?ref=eq.${cart}`, { method: "PATCH", body: { assigned_to: null } });
// money and secrets on the tagged request, to prove none of it leaves through the sales view
await sb(`requests?ref=eq.${tagged}`, { method: "PATCH", body: {
  internal_notes: "SECRET-NOTE-123",
  payment: { status: "PAID", amount: 7777, provider: "moyasar", ref: "PAYREF-999", at: new Date().toISOString() },
  quote: { number: "Q-1", total: 8888, status: "APPROVED" },
  invoice: { number: "INV-1", total: 8888 },
  contract: { number: "C-1", status: "SIGNED", signed_at: new Date().toISOString() },
  conversation: [{ role: "user", content: "CHAT-TEXT-456", at: new Date().toISOString() }],
} });
const trow = await rowOf(tagged);
await sb("request_events", { method: "POST", prefer: "return=minimal", body: [{ request_id: trow.id, actor_kind: "system", actor: "pay", event: "payment.paid", details: { amount: 7777 } }] });
await sb("tasks", { method: "POST", body: [{ organization_id: trow.organization_id, title: "TASK-TITLE-789", assignee: "bp", source: "manual", status: "open", request_id: trow.id }] }).catch(() => {});

// ---- fail-safe: no variable, no role
for (const v of [undefined, "", "  ", "not-an-email, ;"]) {
  if (v === undefined) delete process.env.SALES_TEAM_EMAILS; else process.env.SALES_TEAM_EMAILS = v;
  ok(salesTeamEmails().length === 0, `SALES_TEAM_EMAILS=${JSON.stringify(v)} lists nobody`);
  const a = await call({ action: "ops-requests" }, sCookie), b = await call({ action: "ops-request", ref: tagged }, sCookie), c = await call({ action: "ops-stages-init", ref: tagged }, sCookie);
  ok(a.s === 401 && b.s === 401 && c.s === 401, `with ${JSON.stringify(v)} a would-be sales session is refused 401 on list, read and write`);
}
ok(!(await rowOf(tagged)).stages || !(await rowOf(tagged)).stages.length, "nothing was written while the role was off");

process.env.SALES_TEAM_EMAILS = ` ${SALES.toUpperCase()}, ${SALES2};  `;
ok(salesTeamEmails().join() === `${SALES},${SALES2}`, "the list is split, trimmed and lower-cased");

// ---- who is not sales
let r = await call({ action: "ops-requests" }, custCookie);
ok(r.s === 401, "an ordinary customer is refused 401");
r = await call({ action: "ops-request", ref: tagged }, stranger);
ok(r.s === 401, "a signed-in stranger not on the list is refused 401");
r = await call({ action: "ops-requests" });
ok(r.s === 401, "no session, no key: 401");
r = await call({ action: "ops-stages-init", ref: tagged, role: "sales", actor: SALES }, custCookie);
ok(r.s === 401, "claiming the role in the body does nothing");

// ---- the list: only his clients, and no money in it
r = await call({ action: "ops-requests" }, sCookie);
let refs = (r.j.requests || []).map((x) => x.ref).sort();
ok(r.s === 200 && r.j.role === "sales" && refs.join() === [tagged, mine].sort().join(), "sales one sees the team-tagged request and his own, nothing else");
ok(!refs.includes(theirs) && !refs.includes(cart) && !refs.includes(other), "another member's, an untagged and a person-assigned request are not listed");
ok(!/payment|quote|invoice|contract|internal_notes|conversation/.test(JSON.stringify(r.j.requests[0])), "a list row carries no payment, quote, invoice, contract or notes keys");
r = await call({ action: "ops-requests", status: "PAID", q: "everything" }, sCookie);
ok(r.j.requests.length === 2, "filters in the body cannot widen the list");
r = await call({ action: "ops-requests" }, s2Cookie);
refs = (r.j.requests || []).map((x) => x.ref).sort();
ok(refs.join() === [tagged, theirs].sort().join(), "sales two sees the team-tagged request and his own");

// ---- reading one request
r = await call({ action: "ops-request", ref: tagged }, sCookie);
ok(r.s === 200 && r.j.request.ref === tagged && r.j.request.client_name, "he can read a client of his");
for (const k of ["payment", "quote", "invoice", "contract", "internal_notes", "conversation", "tasks", "attachments", "scope", "documents", "cancel"]) ok(!(k in r.j.request), `the sales view has no «${k}»`);
ok(!/SECRET-NOTE-123|PAYREF-999|7777|8888|CHAT-TEXT-456|TASK-TITLE-789|INV-1|Q-1/.test(r.raw), "no amount, reference, note, chat line or task title appears anywhere in it");
ok(!(r.j.request.events || []).some((e) => e.event === "payment.paid"), "money events are filtered out of the log he sees");
r = await call({ action: "ops-request", ref: mine }, sCookie);
ok(r.s === 200, "…and a request assigned to him by address");

// ---- somebody else's, untagged, missing: 403, never 404
for (const [name, ref] of [["another member's", theirs], ["an untagged cart customer's", cart], ["one assigned to a person", other], ["a non-existent", "BP-R-NOPE00"]]) {
  r = await call({ action: "ops-request", ref }, sCookie);
  ok(r.s === 403 && r.j.error === "forbidden_scope", `reading ${name} request: 403 forbidden_scope`);
  for (const a of ["ops-stages-init", "ops-stage-set", "ops-update-add", "ops-update-edit", "ops-update-publish", "ops-update-unpublish", "ops-update-delete"]) {
    const w = await call({ action: a, ref, stage: "sign_quote", status: "done", text_ar: "x", id: "x" }, sCookie);
    ok(w.s === 403, `${a} on ${name} request: 403`);
  }
}
for (const ref of [theirs, cart, other]) {
  const row = await rowOf(ref);
  ok(!(row.stages || []).length && !(row.updates || []).length, `nothing was written to ${ref}`);
}

// ---- every other action is refused and does nothing
const src = fs.readFileSync(new URL("../api/_simple.js", import.meta.url), "utf8");
const all = [...new Set([...src.matchAll(/action === "(ops-[a-z0-9-]+)"/g)].map((m) => m[1]))];
const refused = all.filter((a) => !SALES_ACTIONS.has(a));
ok(refused.length >= 25, `${refused.length} other ops-* actions found in the handler to try`);
ok(SALES_ACTIONS.size === 9, "the allowlist has exactly nine actions");
const before = JSON.stringify(await rowOf(tagged));
const tasksBefore = (await sb("tasks?select=id")).length;
for (const a of [...refused, "ops-made-up", "ops-doc-upload", "ops-"]) {
  const x = await call({ action: a, ref: tagged, status: "CANCELLED", title: "hacked", assigned_to: SALES, text: "x", content: "x", reason: "x", phone: "966500000000", paused: true, id: "x" }, sCookie);
  ok(x.s === 403 && x.j.error === "forbidden_role", `${a}: 403 forbidden_role`);
}
ok(JSON.stringify(await rowOf(tagged)) === before, "the request is byte-for-byte unchanged after every refused action");
ok((await sb("tasks?select=id")).length === tasksBefore, "no task was created");

// ---- what he may do: stages and updates, as himself
r = await call({ action: "ops-stages-init", ref: tagged, actor: "المالك" }, sCookie);
ok(r.s === 200 && r.j.stages.length === 5, "he creates the default stages");
r = await call({ action: "ops-stage-set", ref: tagged, stage: "investment_license", status: "active", note: "قُدّم الطلب", assigned_to: SALES }, sCookie);
ok(r.s === 200 && r.j.stages.find((s) => s.key === "investment_license").status === "active", "he moves a stage");
ok((await rowOf(tagged)).assigned_to === "sales", "…and cannot re-tag a client through a stage call");
r = await call({ action: "ops-update-add", ref: tagged, text_ar: "مسوّدة للعميل", text_en: "A draft" }, sCookie);
const uid = r.j.update && r.j.update.id;
ok(r.s === 200 && uid && r.j.update.published === false, "his update is a draft");
let g = await call({ action: "request-get", ref: tagged }, custCookie);
ok(g.s === 200 && !JSON.stringify(g.j).includes("مسوّدة للعميل"), "the customer does not see the draft");
r = await call({ action: "ops-update-edit", ref: tagged, id: uid, text_ar: "مسوّدة معدّلة" }, sCookie);
ok(r.s === 200 && r.j.update.text_ar === "مسوّدة معدّلة", "he edits his draft");
r = await call({ action: "ops-update-publish", ref: tagged, id: uid }, sCookie);
g = await call({ action: "request-get", ref: tagged }, custCookie);
ok(r.s === 200 && g.j.request.updates && g.j.request.updates[0].text_ar === "مسوّدة معدّلة", "after he publishes, the customer sees it");
r = await call({ action: "ops-update-unpublish", ref: tagged, id: uid }, sCookie);
g = await call({ action: "request-get", ref: tagged }, custCookie);
ok(r.s === 200 && !("updates" in g.j.request), "he withdraws it and it leaves the customer's page");
r = await call({ action: "ops-update-delete", ref: tagged, id: uid }, sCookie);
ok(r.s === 200, "he deletes the draft");
r = await call({ action: "ops-stage-set", ref: tagged, stage: "ghost", title_ar: "مرحلة أضافها", after: "sign_quote" }, sCookie);
ok(r.s === 200 && r.j.stages[1].key === "ghost", "he adds a stage");
r = await call({ action: "ops-stage-set", ref: tagged, stage: "ghost", remove: true }, sCookie);
ok(r.s === 200 && r.j.stages.length === 5, "…and removes it");
r = await call({ action: "ops-stages-init", ref: mine }, s2Cookie);
ok(r.s === 403, "sales two cannot touch sales one's client");

// ---- audit: every one of those is in the internal log under his address
const ev = (await call({ action: "ops-request", ref: tagged }, ownerCookie).then(() => ops({ action: "ops-request", ref: tagged }))).j.request.events;
const wanted = ["stages.init", "stage.set", "update.added", "update.edited", "update.published", "update.unpublished", "update.deleted", "stage.removed"];
for (const w of wanted) ok(ev.some((e) => e.event === w && e.actor === SALES && e.actor_kind === "internal"), `the log has «${w}» by ${SALES}`);
ok(!ev.some((e) => /^(stages?|update)\./.test(e.event) && e.actor !== SALES), "no stage or update event carries the claimed «المالك»");
r = await call({ action: "ops-request", ref: tagged }, sCookie);
ok(r.j.request.events.length >= wanted.length && r.j.request.events.every((e) => /^(stages?|update)\./.test(e.event)), "he reads his own trail, and only that");

// ---- the owner is unchanged
r = await ops({ action: "ops-summary" });
ok(r.s === 200 && r.j.counts && r.j.revenue, "the panel key still opens ops-summary");
r = await ops({ action: "ops-requests" });
ok(r.s === 200 && r.j.requests.length >= 5 && "payment" in r.j.requests[0], "the owner still lists every request, with payments");
r = await ops({ action: "ops-request", ref: tagged });
ok(r.s === 200 && r.j.request.payment && r.j.request.payment.status === "PAID" && r.j.request.internal_notes === "SECRET-NOTE-123", "the owner still reads the full request");
r = await call({ action: "ops-summary" }, ownerCookie);
ok(r.s === 200, "the owner's e-mail session still opens the panel");
r = await call({ action: "ops-request", ref: cart }, ownerCookie);
ok(r.s === 200, "…and any client");
r = await call({ action: "ops-request-update", ref: other, assigned_to: "sales" }, ownerCookie);
ok(r.s === 200, "the owner tags a client for sales");
r = await call({ action: "ops-requests" }, sCookie);
ok(r.j.requests.some((x) => x.ref === other), "…and it appears on the sales list at once");
await call({ action: "ops-request-update", ref: other, assigned_to: "Badr" }, ownerCookie);
r = await call({ action: "ops-request", ref: other }, sCookie);
ok(r.s === 403, "…and leaves it when the tag is removed");

// ---- PANEL_REQUIRE_NAFATH: the owner's doors stay shut, the sales door opens only its nine
process.env.PANEL_REQUIRE_NAFATH = "1";
r = await ops({ action: "ops-summary" });
ok(r.s === 401 && r.j.nafath === true, "Nafath required: the panel key is refused");
r = await call({ action: "ops-summary" }, ownerCookie);
ok(r.s === 401 && r.j.nafath === true, "Nafath required: the owner's e-mail session is refused");
r = await call({ action: "ops-requests" }, custCookie);
ok(r.s === 401 && r.j.nafath === true, "Nafath required: an ordinary customer is refused");
r = await call({ action: "ops-summary" }, sCookie);
ok(r.s === 403 && r.j.error === "forbidden_role", "Nafath required: sales still gets nothing outside his nine");
r = await call({ action: "ops-mark-paid", ref: tagged }, sCookie);
ok(r.s === 403, "Nafath required: sales cannot mark a payment");
r = await call({ action: "ops-request", ref: tagged }, sCookie);
ok(r.s === 200, "Nafath required: sales still reads his own client");
delete process.env.SALES_TEAM_EMAILS;
r = await call({ action: "ops-request", ref: tagged }, sCookie);
ok(r.s === 401 && r.j.nafath === true, "Nafath required and no list: exactly the old answer");
delete process.env.PANEL_REQUIRE_NAFATH;

// the JSON database flushes on a short timer; clean up after it has
await new Promise((r) => setTimeout(r, 200));
try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall sales-role checks passed");
if (fail.length) { console.error(fail.join("\n")); process.exit(1); }
