// SHR-HR: بوابة المكاتب على قاعدة JSON المحلية. عزل المكتب، الأدوار، pending،
// maker-checker على الاعتماد، إخفاء اسم المكتب عن صاحب العمل، التكرار، الاستيراد الجماعي.
// Run: npm test
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-agency-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
const { default: handler } = await import("../api/shr.js");
const { ctxFrom, scoped, tenantBySlug } = await import("../api/_shr.js");

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

async function call(method, payload, cookie = "") {
  const req = { method, body: method === "POST" ? payload : undefined, query: method === "GET" ? payload : {}, cookies: cookie ? { shr_session: cookie } : {} };
  let status = 200, body = null; const headers = {};
  const res = { setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, status: (c) => { status = c; return res; }, json: (o) => { body = o; return res; } };
  await handler(req, res);
  return { status, body, headers };
}
async function login(slug, email) {
  const r = await call("POST", { action: "session", slug, email });
  const m = /shr_session=([^;]*)/.exec(r.headers["set-cookie"] || "");
  return { r, cookie: m ? m[1] : "" };
}
const get = async (action, q, who) => call("GET", { action, ...q }, who.cookie);
const post = (action, b, who) => call("POST", { action, ...b }, who.cookie);

const ops = await login("SHR", "ops@shr.invalid");
const owner = await login("SHR", "owner@shr.invalid");
const agA = await login("SHR", "agency-a@shr.invalid");
const agB = await login("SHR", "agency-b@shr.invalid");
const agX = await login("OTHER", "agency-x@other.invalid");

console.log("\n1. Seed shape and login");
const agencies = (await get("agencies", {}, ops)).body.agencies;
const orders = (await get("orders", {}, ops)).body.orders;
const subs = (await get("agency-submissions", {}, ops)).body.submissions;
ok(agencies.length === 3 && agencies.filter((a) => a.status === "pending").length === 1, "3 agencies, one pending");
ok(orders.length === 4 && subs.length === 8, `4 orders, 8 agency candidates (${orders.length}/${subs.length})`);
ok(agencies.every((a) => /^DEMO-/.test(a.ref) && /وهمي/.test(a.name_ar)), "agencies are marked demo");
ok(subs.every((s) => /^DEMO-/.test(s.ref) && /وهمي/.test(s.full_name)), "candidates are marked demo");
ok(agA.r.status === 200 && agA.cookie && agA.r.body.user.role === "agency" && agA.r.body.demo === true, "approved agency logs in, demo:true");
ok(agA.r.body.tenant === null, "agency session does not echo the tenant");

console.log("\n2. A pending agency does not get in");
const agC = await login("SHR", "agency-c@shr.invalid");
ok(agC.r.status === 403 && agC.r.body.error === "agency_not_approved" && !agC.cookie, "pending agency refused, no cookie");

console.log("\n3. Agency isolation: A never sees B");
const oA = (await get("my-orders", {}, agA)).body.orders;
const oB = (await get("my-orders", {}, agB)).body.orders;
const refsA = oA.map((o) => o.ref), refsB = oB.map((o) => o.ref);
ok(oA.length === 3 && oB.length === 2, `A: 2 directed + 1 open; B: 1 directed + 1 open (${oA.length}/${oB.length})`);
const dirA = oA.filter((o) => o.scope === "directed").map((o) => o.id), dirB = oB.filter((o) => o.scope === "directed").map((o) => o.id);
ok(dirA.length === 2 && dirB.length === 1 && dirA.every((i) => !dirB.includes(i)), "directed orders are disjoint");
const sA = (await get("my-submissions", {}, agA)).body.submissions;
const sB = (await get("my-submissions", {}, agB)).body.submissions;
ok(sA.length === 4 && sB.length === 4 && sA.every((x) => !sB.some((y) => y.id === x.id)), "submissions disjoint");
ok((await get("my-orders", { id: dirB[0] }, agA)).status === 404, "A reads B's order by id -> 404");
ok((await get("my-submissions", { id: sB[0].id }, agA)).status === 404, "A reads B's submission by id -> 404");
ok((await get("my-submissions", { order_id: dirB[0] }, agA)).status === 404, "A lists submissions of B's order -> 404");
ok((await post("submit-candidate", { order_id: dirB[0], full_name: "اختراق (وهمي)" }, agA)).status === 404, "A submits onto B's order -> 404");
const after = (await get("my-submissions", {}, agB)).body.submissions;
ok(after.length === 4, "B's list unchanged by A's attempt");
const iA = (await get("my-interviews", {}, agA)).body.interviews;
const iB = (await get("my-interviews", {}, agB)).body.interviews;
ok(iA.length === 1 && iB.length === 0, "interviews only for the owning agency");
// A request cannot name an agency or a tenant.
ok((await get("my-orders", { tenant_id: "x" }, agA)).status === 400, "tenant_id in query -> 400");
const sneaky = await post("submit-candidate", { order_id: dirA[0], agency_id: "11111111-1111-4111-8111-111111111111", full_name: "اسم تجريبي (وهمي)" }, agA);
const mineAfter = (await get("my-submissions", {}, agA)).body.submissions.find((x) => x.full_name === "اسم تجريبي (وهمي)");
ok(sneaky.status === 200 && mineAfter, "agency_id in body is ignored; row lands on the session's agency");
// Cross-tenant: the OTHER tenant's agency sees only its own.
const oX = (await get("my-orders", {}, agX)).body.orders;
ok(agX.r.status === 200 && oX.length === 1 && oX.every((o) => !refsA.includes(o.ref) && !refsB.includes(o.ref)), "other tenant's agency sees only its tenant's orders");
ok((await get("my-orders", { id: dirA[0] }, agX)).status === 404, "other tenant: order of SHR -> 404");

console.log("\n4. Agency role reaches no operator action");
const opGets = ["agencies", "orders", "order-employer-view", "agency-submissions", "dashboard", "workers", "requests", "jobs", "candidates", "applications", "expiring"];
for (const a of opGets) ok((await get(a, { id: dirA[0] }, agA)).status === 403, `GET ${a} -> 403 for agency`);
const opPosts = ["agency-create", "agency-approve", "agency-suspend", "order-create", "submission-state", "worker-create", "worker-activate", "request-state", "job-create", "application-stage", "match", "worker-delete", "delete", "agency-delete"];
for (const a of opPosts) ok((await post(a, { id: dirA[0] }, agA)).status === 403, `POST ${a} -> 403 for agency`);
ok((await get("session", {}, agA)).status === 200, "agency may read its own session");
ok((await post("my-orders", {}, agA)).status === 403, "POST on a GET-only agency action -> 403");
console.log("   and the operator does not get agency actions");
for (const a of ["my-orders", "my-submissions", "my-interviews"]) ok((await get(a, {}, ops)).status === 403, `operator GET ${a} -> 403`);
for (const a of ["submit-candidate", "bulk-submit"]) ok((await post(a, { order_id: dirA[0] }, ops)).status === 403, `operator POST ${a} -> 403`);
ok((await get("agencies", {}, { cookie: "" })).status === 401, "no cookie -> 401");

console.log("\n5. Maker-checker on agency approval");
const mk = await post("agency-create", { name_ar: "مكتب جديد (وهمي)", country: "نيبال", contact_email: "agency-n@shr.invalid" }, ops);
ok(mk.status === 200 && mk.body.agency.status === "pending", "agency created pending");
const nid = mk.body.agency.id;
ok((await login("SHR", "agency-n@shr.invalid")).r.status === 403, "new agency cannot log in before approval");
const selfApprove = await post("agency-approve", { id: nid }, ops);
ok(selfApprove.status === 403 && selfApprove.body.error === "maker_checker", "creator cannot approve own agency");
ok((await post("agency-approve", { id: nid }, owner)).status === 200, "a different staff user approves");
ok((await login("SHR", "agency-n@shr.invalid")).r.status === 200, "approved agency now logs in");
ok((await post("agency-approve", { id: nid }, owner)).status === 409, "approving twice -> 409");
ok((await post("agency-create", { name_ar: "حقيقي", contact_email: "real@gmail.com" }, ops)).status === 400, "real email refused in this phase");
ok((await post("agency-create", { name_ar: "مكرر", contact_email: "agency-n@shr.invalid" }, ops)).status === 409, "duplicate login email -> 409");
// pending agency stays out of order creation too
const pendingId = agencies.find((a) => a.status === "pending").id;
ok((await post("order-create", { agency_id: pendingId, profession: "سائق", quantity: 1 }, ops)).status === 409, "order to a pending agency refused");
ok((await post("agency-approve", { id: pendingId }, ops)).status === 403, "seeded pending agency: its creator (ops) cannot approve it");

console.log("\n6. Suspension takes effect on a live session");
const sus = await post("agency-suspend", { id: nid, reason: "اختبار" }, owner);
ok(sus.status === 200 && sus.body.agency.status === "suspended", "suspended");
const newLive = await login("SHR", "agency-n@shr.invalid");
ok(newLive.r.status === 403, "suspended agency cannot log in");
// agency B suspended mid-session
ok((await get("my-orders", {}, agB)).status === 200, "B works before");
const bId = agencies.find((a) => a.ref === "DEMO-AG-SHR-2").id;
ok((await post("agency-suspend", { id: bId }, ops)).status === 200, "B suspended by operator");
ok((await get("my-orders", {}, agB)).status === 403, "B's existing cookie stops working at once");
ok((await post("agency-approve", { id: bId }, ops)).status === 200, "ops re-approves B (B was created by owner)");
ok((await get("my-orders", {}, agB)).status === 200, "B works again");

console.log("\n7. Orders: operator creates, agency sees brief only");
const est = (await scoped(ctxFrom({ tenant_id: (await tenantBySlug("SHR")).id, role: "tenant_owner" })).get("shr_establishments?select=id,restriction_state"));
const clients = (await scoped(ctxFrom({ tenant_id: (await tenantBySlug("SHR")).id, role: "tenant_owner" })).get("shr_client_companies?select=id,name_ar"));
const aId = agencies.find((a) => a.ref === "DEMO-AG-SHR-1").id;
const oc = await post("order-create", { agency_id: aId, profession: "سباك", quantity: 2, client_company_id: clients[0].id, agency_brief: "توجيه خاص", due_on: "2027-01-01" }, ops);
ok(oc.status === 200 && oc.body.order.scope === "directed" && /^DEMO-ORD-/.test(oc.body.order.ref), "directed order created");
ok((await post("order-create", { profession: "سباك", quantity: 1 }, ops)).status === 400, "destination required (agency or open)");
ok((await post("order-create", { agency_id: "open", profession: "سباك", quantity: 0 }, ops)).status === 400, "quantity >= 1");
const oOpen = await post("order-create", { agency_id: "open", profession: "نجّار", quantity: 1 }, ops);
ok(oOpen.status === 200 && oOpen.body.order.scope === "open", "open order created");
ok((await post("order-create", { agency_id: "11111111-1111-4111-8111-111111111111", profession: "سباك" }, ops)).status === 404, "unknown agency -> 404");
const myNew = (await get("my-orders", {}, agA)).body.orders.find((o) => o.id === oc.body.order.id);
ok(myNew && myNew.brief === "توجيه خاص", "agency sees the order and the brief");
ok(!(await get("my-orders", {}, agB)).body.orders.some((o) => o.id === oc.body.order.id), "B does not see A's new order");
ok((await get("my-orders", {}, agB)).body.orders.some((o) => o.id === oOpen.body.order.id), "B sees the open order");
const estRestricted = est.find((e) => e.restriction_state === "unknown");
const warn = await post("order-create", { agency_id: aId, profession: "سباك", establishment_id: estRestricted.id }, ops);
ok(warn.status === 200 && Array.isArray(warn.body.order.warnings), "order-create carries a warnings array (visa restriction check is pending owner decision)");
// الشاشة والرد للمكتب لا يحملان عميلاً ولا سعراً ولا مراحل
const agencyOrdersJson = JSON.stringify((await get("my-orders", {}, agA)).body);
ok(!clients.some((c) => agencyOrdersJson.includes(c.name_ar)), "agency orders never carry a client name");
ok(!/client_company_id|price|amount|request_id|establishment_id|created_by/.test(agencyOrdersJson), "no client id, price or internal fields in agency orders");

console.log("\n8. Candidates: specs only, no identity, duplicates");
const OA = dirA[0];
const c1 = await post("submit-candidate", { order_id: OA, full_name: "مرشح جديد تجريبي (وهمي)", profession: "فني تكييف", nationality: "الهند", years_experience: 3, id_no: "DEMO-NEW-77" }, agA);
ok(c1.status === 200 && c1.body.submission.status === "received" && /^DEMO-A-/.test(c1.body.submission.ref), "submitted, agency-visible status is 'received'");
ok((await post("submit-candidate", { order_id: OA, full_name: "مرشح جديد تجريبي (وهمي)", profession: "فني تكييف", nationality: "الهند" }, agA)).status === 409, "same name/nationality/profession -> duplicate_candidate");
ok((await post("submit-candidate", { order_id: OA, full_name: "اسم آخر تماماً (وهمي)", id_no: "DEMO-NEW-77" }, agA)).status === 409, "same id fingerprint -> duplicate_candidate");
for (const k of ["phone", "email", "mobile", "iqama"]) ok((await post("submit-candidate", { order_id: OA, full_name: "x y z", [k]: "123" }, agA)).status === 400, `${k} field refused`);
ok((await post("submit-candidate", { order_id: OA, full_name: "" }, agA)).status === 400, "name required");
ok((await post("submit-candidate", { order_id: OA, full_name: "عمر خبرة (وهمي)", years_experience: -2 }, agA)).status === 400, "bad years refused");
const mine = (await get("my-submissions", {}, agA)).body.submissions;
const row = mine.find((x) => x.ref === c1.body.submission.ref);
ok(row && !("id_no_hash" in row) && !("name_key" in row) && !("id_no" in row), "fingerprints and raw id never returned to the agency");
// تُكتب في shr_agency_candidates وحدها، لا في مرشحي ATS
const dbA = scoped(ctxFrom({ tenant_id: (await tenantBySlug("SHR")).id, role: "tenant_owner" }));
ok((await dbA.get("shr_candidates?select=id")).length === 20, "shr_candidates (ATS) untouched by agency submissions");
const raw = (await dbA.get("shr_agency_candidates")).find((x) => x.ref === c1.body.submission.ref);
ok(raw && raw.id_no_hash && raw.id_no_hash !== "DEMO-NEW-77" && !JSON.stringify(raw).includes("DEMO-NEW-77"), "stored as a hash only");
// تكرار بين المكاتب: المشغّل يراه، المكتب لا
const opSubs = (await get("agency-submissions", {}, ops)).body.submissions;
const crossed = opSubs.filter((s) => s.cross_agency_duplicate);
ok(crossed.length === 2 && crossed.every((s) => s.duplicates.length === 1 && !s.duplicates[0].same_agency), "operator sees the cross-agency duplicate pair");
const agView = JSON.stringify((await get("my-submissions", {}, agA)).body);
ok(!/duplicate|cross_agency/.test(agView) && !agView.includes("مكتب استقدام تجريبي ب"), "agency is not told about another agency's duplicate");

console.log("\n9. Bulk import: per-row report");
const dirB0 = dirB[0];
const bulk = await post("bulk-submit", { order_id: dirB0, rows: [
  { full_name: "دفعة ١ (وهمي)", profession: "سائق", nationality: "الفلبين", years_experience: 4 },
  { full_name: "", profession: "سائق" },
  { full_name: "دفعة ١ (وهمي)", profession: "سائق", nationality: "الفلبين" },
  { full_name: "دفعة ٣ (وهمي)", email: "a@b.invalid" },
  { full_name: "دفعة ٤ (وهمي)", profession: "سائق", id_no: "DEMO-BULK-4", line: 40 },
  { full_name: "دفعة ٥ (وهمي)", order_id: dirA[0] },
  { full_name: "دفعة ٦ (وهمي)", years_experience: "abc" },
] }, agB);
ok(bulk.status === 200 && bulk.body.created === 2 && bulk.body.skipped === 5, `2 created, 5 reported (${bulk.body.created}/${bulk.body.skipped})`);
const E = Object.fromEntries((bulk.body.errors || []).map((e) => [e.line, e.error]));
ok(E[2] === "full_name_required" && E[3] === "duplicate_in_file" && E[4] === "contact_fields_not_allowed" && E[6] === "order_not_found" && E[7] === "bad_years_experience", "each bad row names its line and reason: " + JSON.stringify(E));
ok((await post("bulk-submit", { order_id: dirB0, rows: [] }, agB)).status === 400, "empty import refused");
ok((await post("bulk-submit", { order_id: dirB0, rows: Array.from({ length: 61 }, (_, i) => ({ full_name: `صف ${i} (وهمي)` })) }, agB)).status === 400, "over 60 rows refused (no silent truncation)");
const rerun = await post("bulk-submit", { order_id: dirB0, rows: [{ full_name: "دفعة ١ (وهمي)", profession: "سائق", nationality: "الفلبين" }] }, agB);
ok(rerun.body.created === 0 && rerun.body.errors[0].error === "duplicate_candidate", "re-importing an existing candidate is a duplicate, not a second row");
ok((await get("my-submissions", {}, agA)).body.submissions.length === mine.length, "A's list unaffected by B's import");

console.log("\n10. Operator review: states, interview, agency sees coarse status only");
const target = opSubs.find((s) => s.state === "submitted" && s.agency === "مكتب استقدام تجريبي أ (وهمي)" && s.order_ref);
ok((await post("submission-state", { id: target.id, state: "accepted" }, ops)).status === 409, "submitted -> accepted skips stages -> 409");
ok((await post("submission-state", { id: target.id, state: "bogus" }, ops)).status === 400, "unknown state -> 400");
ok((await post("submission-state", { id: target.id, state: "under_review" }, ops)).status === 200, "submitted -> under_review");
ok((await get("my-submissions", { id: target.id }, agA)).body.submission.status === "received", "agency still sees only 'received'");
ok((await post("submission-state", { id: target.id, state: "shortlisted" }, ops)).status === 200, "-> shortlisted");
ok((await get("my-submissions", { id: target.id }, agA)).body.submission.status === "received", "shortlist is not exposed to the agency");
const iv = await post("submission-state", { id: target.id, state: "interview", mode: "video", scheduled_at: "2027-02-01T09:00:00Z", agency_note: "حضور قبل الموعد بعشر دقائق", note: "داخلي" }, ops);
ok(iv.status === 200, "-> interview with a date");
const ivs = (await get("my-interviews", {}, agA)).body.interviews;
const mi = ivs.find((i) => i.candidate && i.candidate.full_name === target.full_name);
ok(mi && mi.state === "scheduled" && mi.mode === "video" && mi.note === "حضور قبل الموعد بعشر دقائق", "agency sees its interview");
ok(!(await get("my-interviews", {}, agB)).body.interviews.some((i) => i.id === mi.id), "B does not see A's interview");
ok(!JSON.stringify((await get("my-submissions", { id: target.id }, agA)).body).includes("داخلي"), "internal review note never reaches the agency");
ok((await post("submission-state", { id: target.id, state: "accepted" }, owner)).status === 200, "-> accepted");
ok((await post("submission-state", { id: target.id, state: "rejected" }, ops)).status === 409, "accepted is final");
ok((await get("my-submissions", { id: target.id }, agA)).body.submission.status === "accepted", "agency sees 'accepted'");
const bRow = opSubs.find((s) => s.state === "submitted" && s.agency === "مكتب استقدام تجريبي ب (وهمي)");
ok((await post("submission-state", { id: bRow.id, state: "under_review" }, ops)).status === 200, "operator can review any agency's row");
ok((await post("submission-state", { id: "not-a-uuid", state: "rejected" }, ops)).status === 400, "bad id refused");
ok((await post("submission-state", { id: "11111111-1111-4111-8111-111111111111", state: "rejected" }, ops)).status === 404, "unknown id -> 404");
// المشغّل من مستأجر آخر لا يصل لمرشح SHR
const opsX = await login("OTHER", "ops@other.invalid");
ok((await post("submission-state", { id: target.id, state: "rejected" }, opsX)).status === 404, "other tenant's operator -> 404");
ok((await get("agency-submissions", {}, opsX)).body.submissions.length === 1, "other tenant's operator sees only its own candidate");

console.log("\n11. The employer never learns the agency");
const names = [...agencies.map((a) => a.name_ar), "مكتب جديد (وهمي)"];
const allOrders = (await get("orders", {}, ops)).body.orders;
let leaked = 0, viewed = 0;
for (const o of allOrders) {
  const v = await get("order-employer-view", { id: o.id }, ops);
  viewed++;
  const j = JSON.stringify(v.body);
  if (names.some((n) => j.includes(n)) || /agency|country|"name_ar"/.test(j)) leaked++;
  if (v.body.order.source !== "عبر شريك") leaked++;
}
ok(viewed >= 4 && leaked === 0, `employer view of ${viewed} orders never carries an agency name, id or country`);
const ev = (await get("order-employer-view", { id: dirA[0] }, ops)).body;
ok(ev.candidates.length > 0 && ev.candidates.every((c) => c.source === "عبر شريك" && !("agency_id" in c) && !("id_no_hash" in c)), "candidates shown as 'عبر شريك' only");
const reqs = JSON.stringify((await get("requests", {}, ops)).body);
ok(!names.some((n) => reqs.includes(n)), "client request list never mentions an agency");
ok((await get("order-employer-view", { id: "11111111-1111-4111-8111-111111111111" }, ops)).status === 404, "unknown order -> 404");

console.log("\n12. Archive only");
for (const a of ["agency-delete", "order-delete", "submission-delete"]) ok((await post(a, { id: nid }, ops)).status === 403 && (await post(a, { id: nid }, ops)).body.error === "archive_only", `${a} -> archive_only`);

console.log("\n13. Every agency table sits behind the tenant gate");
const T = { A: await tenantBySlug("SHR"), B: await tenantBySlug("OTHER") };
const gA = scoped(ctxFrom({ tenant_id: T.A.id, role: "tenant_owner" })), gB = scoped(ctxFrom({ tenant_id: T.B.id, role: "tenant_owner" }));
for (const t of ["shr_agencies", "shr_recruitment_orders", "shr_agency_candidates", "shr_agency_candidate_events", "shr_agency_interviews"]) {
  const ra = await gA.get(t), rb = await gB.get(t);
  ok(ra.length > 0 && ra.every((r) => r.tenant_id === T.A.id) && rb.every((r) => r.tenant_id === T.B.id) && rb.every((r) => !ra.some((x) => x.id === r.id)), `${t}: rows isolated (${ra.length}/${rb.length})`);
}
const ags = await gA.get("shr_agencies");
ok(ags.every((a) => !a.approved_by || a.approved_by !== a.created_by), "no agency approved by its creator");

fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
