// SHR-HR: بوابة العامل على قاعدة JSON المحلية. عزل عامل عن عامل وعن مستأجر آخر (404)، الأدوار في الاتجاهين،
// قائمة بيضاء للـDTO (مسح الرد كله بحثاً عن الحقول الممنوعة، ومعرّفات الرد = معرّفات طلبات العامل وحدها)،
// لا قراءة لجداول الرواتب، سقوف الطلبات، العامل غير النشط لا يدخل، انتهاء الجلسة وسريان الإيقاف فوراً، وسجل التدقيق.
// Run: npm test
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-worker-"));
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
const get = (action, q, who) => call("GET", { action, ...q }, who.cookie);
const post = (action, b, who) => call("POST", { action, ...b }, who.cookie);
const SECRET = process.env.SHR_SESSION_SECRET || "shr-local-demo-secret-not-for-production";
const forge = (payload, ttl = 600) => { const p = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttl })).toString("base64url"); return { cookie: `${p}.${crypto.createHmac("sha256", SECRET).update(p).digest("base64url")}` }; };

const ops = await login("SHR", "ops@shr.invalid");
const owner = await login("SHR", "owner@shr.invalid");
const cmpo = await login("SHR", "compliance@shr.invalid");
const agA = await login("SHR", "agency-a@shr.invalid");
const cA = await login("SHR", "a-admin@client.invalid");
const cV = await login("SHR", "a-viewer@client.invalid");
const cB = await login("SHR", "b-admin@client.invalid");
const A = await login("SHR", "a-worker@worker.invalid");
const B = await login("SHR", "b-worker@worker.invalid");
const X = await login("OTHER", "x-worker@worker.invalid");
const tA = await tenantBySlug("SHR"), tX = await tenantBySlug("OTHER");
const dbA = scoped(ctxFrom({ tenant_id: tA.id, role: "tenant_owner" }));
const dbX = scoped(ctxFrom({ tenant_id: tX.id, role: "tenant_owner" }));
const usersA = await dbA.get("shr_users?select=id,email,role,worker_id,client_company_id");
const uid = (email) => usersA.find((u) => u.email === email).id;
const allW = await dbA.get("shr_workers?select=id,full_name,status");
const w1 = allW.find((w) => /١$/.test(w.full_name)), w2 = allW.find((w) => /٢$/.test(w.full_name)), w3 = allW.find((w) => /٣$/.test(w.full_name));
const wX = (await dbX.get("shr_workers?select=id,full_name,status")).find((w) => /١$/.test(w.full_name));

console.log("\n1. Login: demo-tagged, no tenant echoed, cookie flags");
ok(A.r.status === 200 && A.cookie && A.r.body.demo === true && A.r.body.user.role === "worker", "worker logs in");
ok(A.r.body.tenant === null && A.r.body.worker && A.r.body.worker.full_name === w1.full_name, "session echoes the worker, not the tenant");
ok(Object.keys(A.r.body).sort().join() === "can_request,demo,ok,tenant,user,worker", "session keys: " + Object.keys(A.r.body).sort().join());
ok(/HttpOnly/.test(A.r.headers["set-cookie"]) && /SameSite=Strict/.test(A.r.headers["set-cookie"]) && /Max-Age=\d+/.test(A.r.headers["set-cookie"]), "cookie is HttpOnly, SameSite=Strict, expiring");
ok(B.r.status === 200 && X.r.status === 200, "workers of the second client and of the other tenant log in");
ok((await login("SHR", "nobody@worker.invalid")).r.status === 401, "unknown user refused");
ok((await login("OTHER", "a-worker@worker.invalid")).r.status === 401, "a user of one tenant cannot log in under another");
ok((await get("worker-session", {}, A)).body.worker.full_name === w1.full_name && (await get("session", {}, A)).status === 200, "worker-session and session return the same profile");
const seeded = usersA.filter((u) => u.role === "worker");
ok(seeded.length === 2 && seeded.every((u) => /@worker\.invalid$/.test(u.email) && u.worker_id), "the seed has two worker users (*@worker.invalid) linked by worker_id");

console.log("\n2. Own data: the two workers belong to different clients");
const pA = (await get("worker-profile", {}, A)).body, pB = (await get("worker-profile", {}, B)).body;
ok(pA.worker.full_name === w1.full_name && pB.worker.full_name === w3.full_name, "each worker reads their own profile");
ok(/عميل تجريبي SHR أ/.test(pA.assignment.client_name) && /عميل تجريبي SHR ب/.test(pB.assignment.client_name), "the beneficiary client differs: A vs B");
ok(pA.assignment.profession === "فني تكييف" && /^\d{4}-\d{2}-\d{2}$/.test(pA.assignment.starts_on), "profession and start date from the active assignment");
ok(pA.worker.id_kind === "iqama" && pA.worker.status === "active" && pA.attention === "expiring" && pB.attention === "expired", "id kind (no number), status, attention: expiring / expired");
const dA = (await get("worker-documents", {}, A)).body, dB = (await get("worker-documents", {}, B)).body;
const D = (o) => Object.fromEntries(o.documents.map((d) => [d.kind, d]));
ok(D(dA).iqama.status === "expiring" && D(dA).iqama.days_left === 20 && D(dA).medical_insurance.status === "valid" && D(dA).work_contract.status === "no_expiry", "worker 1: iqama expiring in 20 days, insurance valid, contract has no expiry");
ok(D(dB).medical_insurance.status === "expired" && D(dB).medical_insurance.days_left === -5 && D(dB).iqama.status === "valid", "worker 3: insurance expired, iqama valid");
ok(dA.documents.length === 3 && dA.documents.map((d) => d.kind).join() === "work_contract,iqama,medical_insurance", "three documents only: contract, iqama, insurance (no passport, no gosi)");
ok(dA.checklists.length === 1 && /مستنداتي/.test(dA.checklists[0].title_ar) && dA.checklists[0].items.length === 2, "the worker-audience checklist only (no staff/client list)");
const kA = (await get("worker-contract", {}, A)).body;
ok(kA.available === true && kA.contract.type === "work_contract" && kA.contract.status === "active" && Object.keys(kA.contract).sort().join() === "starts_on,status,type", "contract: type, status, start date only");
const sal = (await get("worker-salary", {}, A)).body;
ok(sal.available === false && Array.isArray(sal.statements) && sal.statements.length === 0 && sal.note_ar === "يصدر كشف الراتب من فرق Business Partner بعد الاعتماد", "salary: explicit empty state with the agreed sentence");
ok(Object.keys(sal).sort().join() === "available,demo,note_ar,ok,statements", "salary keys: " + Object.keys(sal).sort().join());

console.log("\n3. Isolation: another worker's id is 404, never 403; identity keys in the request are 400");
for (const a of ["worker-profile", "worker-contract", "worker-documents", "worker-salary"]) {
  ok((await get(a, { id: w3.id }, A)).status === 404 && (await get(a, { id: w1.id }, B)).status === 404, `${a}: another worker's id -> 404 (both directions)`);
  ok((await get(a, { id: w2.id }, A)).status === 404, `${a}: a same-client colleague's id -> 404`);
  ok((await get(a, { id: wX.id }, A)).status === 404 && (await get(a, { id: w1.id }, X)).status === 404, `${a}: another tenant's worker id -> 404 (both directions)`);
  ok((await get(a, { id: "not-a-uuid" }, A)).status === 400, `${a}: malformed id -> 400`);
  ok((await get(a, { id: w1.id }, A)).status === 200, `${a}: the worker's own id is accepted`);
}
const keyTricks = [["worker_id", w3.id, "worker_id_forbidden"], ["tenant_id", tX.id, "tenant_id_forbidden"], ["client_company_id", "11111111-1111-4111-8111-111111111111", "client_company_id_forbidden"]];
for (const [k, v, code] of keyTricks) {
  const g = await get("worker-profile", { [k]: v }, A), p = await post("worker-request-create", { kind: "worker_inquiry", note: "اختبار", [k]: v }, A);
  ok(g.status === 400 && g.body.error === code && p.status === 400 && p.body.error === code, `${k} in the query or the body -> 400 ${code}`);
}
ok((await get("worker-profile", {}, A)).body.worker.full_name === w1.full_name, "...and the profile is unchanged by the attempts");
const reqA0 = (await get("worker-requests", {}, A)).body.requests, reqB0 = (await get("worker-requests", {}, B)).body.requests, reqX0 = (await get("worker-requests", {}, X)).body.requests;
ok(reqA0.length === 2 && reqB0.length === 0 && reqX0.length === 0, `requests are per worker (${reqA0.length}/${reqB0.length}/${reqX0.length})`);
const mixed = forge({ sub: uid("b-worker@worker.invalid"), tenant_id: tX.id, role: "worker", email: "b-worker@worker.invalid" });
ok((await get("worker-profile", {}, mixed)).status === 403, "a worker user id replayed under another tenant resolves to nothing -> 403");

console.log("\n4. Roles: the worker reaches no other role's action, and nobody else reaches the worker's");
const idA = { id: w1.id };
const opGets = ["dashboard", "workers", "requests", "expiring", "jobs", "applications", "candidates", "candidate", "posts", "agencies", "orders", "order-employer-view", "agency-submissions",
  "compliance-dashboard", "compliance-violations", "compliance-establishment", "compliance-checklists", "compliance-alerts", "compliance-a33", "compliance-imports", "compliance-settings", "compliance-ref", "compliance-transfers",
  "my-orders", "my-submissions", "my-interviews", "client-home", "client-workers", "client-worker", "client-contracts", "client-requests", "client-invoices"];
for (const a of opGets) ok((await get(a, idA, A)).status === 403, `worker GET ${a} -> 403`);
const opPosts = ["worker-create", "worker-activate", "worker-archive", "request-state", "job-create", "post-approve", "application-stage", "match", "agency-create", "order-create", "submission-state", "violation-create",
  "a33-add", "transfer-request", "import-create", "checklist-tick", "compliance-settings-update", "submit-candidate", "bulk-submit", "client-request-create", "worker-delete", "delete", "request-delete"];
for (const a of opPosts) ok((await post(a, { id: reqA0[0].id, state: "done" }, A)).status === 403, `worker POST ${a} -> 403`);
ok((await post("worker-profile", {}, A)).status === 403 && (await get("worker-request-create", {}, A)).status === 403, "wrong method on a worker action -> 403");
ok((await post("request-state", { id: reqA0[0].id, state: "done" }, A)).status === 403 && (await get("worker-requests", {}, A)).body.requests.find((r) => r.id === reqA0[0].id).state === reqA0[0].state, "the worker cannot change a request's state");
console.log("   and the other roles do not get worker actions");
for (const [who, name] of [[ops, "operator"], [owner, "owner"], [cmpo, "compliance_officer"], [agA, "agency"], [cA, "client_admin"], [cV, "client_viewer"]]) {
  for (const a of ["worker-session", "worker-profile", "worker-contract", "worker-documents", "worker-salary", "worker-requests"]) ok((await get(a, idA, who)).status === 403, `${name} GET ${a} -> 403`);
  ok((await post("worker-request-create", { kind: "worker_inquiry", note: "اختبار" }, who)).status === 403, `${name} POST worker-request-create -> 403`);
}
// عامل لا يكون موظفاً: الكوكي بدور عامل وsub لمشغّل لا يمنح شيئاً (الدور من القاعدة).
ok((await get("worker-profile", {}, forge({ sub: uid("ops@shr.invalid"), tenant_id: tA.id, role: "worker", email: "ops@shr.invalid" }))).status === 403, "worker cookie carrying an operator's sub -> 403 (role read from the DB)");
ok((await get("worker-profile", {}, forge({ sub: uid("a-admin@client.invalid"), tenant_id: tA.id, role: "worker", email: "a-admin@client.invalid" }))).status === 403, "worker cookie carrying a client user's sub -> 403");

console.log("\n5. Creating a request: three kinds, limited fields, free text trimmed, state is not the worker's");
const mk = (b, who = A) => post("worker-request-create", b, who);
let r = await mk({ kind: "worker_update", note: "أريد تحديث بيانات التواصل (تجريبي)", topic: "contact", state: "done", id: "x", created_by: "y", extra: { a: 1 } });
ok(r.status === 200 && r.body.request.state === "new" && r.body.request.kind === "worker_update" && Object.keys(r.body.request).sort().join() === "created_at,id,kind,state", "created as new; a state from the body is ignored; the reply carries four keys");
const createdId = r.body.request.id;
const row = (await dbA.get(`shr_requests?id=eq.${createdId}`))[0];
ok(row.state === "new" && row.worker_id === w1.id && row.client_company_id === null && row.kind === "worker_update", "row lands on the session's worker, with no client");
ok(Object.keys(row.body).sort().join() === "demo,note,source,topic", "body keeps only the whitelisted keys: " + Object.keys(row.body).join());
ok(row.created_by === uid("a-worker@worker.invalid"), "created_by is the worker user (id)");
const au = (await dbA.get("shr_audit_log?select=action,actor,entity,entity_id")).find((x) => x.entity_id === createdId);
ok(au && au.action === "worker_request.create.worker_update" && au.actor === row.created_by && au.entity === "shr_requests", "an audit row is written for the new request, actor = the worker user");
const listA = (await get("worker-requests", {}, A)).body;
ok(listA.requests.some((x) => x.id === createdId && x.topic === "contact" && x.state === "new") && listA.requests.length === 3, "it shows in the worker's list");
ok(Object.keys(listA.requests[0]).sort().join() === "created_at,id,kind,note,state,topic", "request item: exactly the whitelisted keys: " + Object.keys(listA.requests[0]).sort().join());
ok(!(await get("worker-requests", {}, B)).body.requests.some((x) => x.id === createdId), "another worker never sees it");
const opsList = (await get("requests", {}, ops)).body.requests;
const seen = opsList.find((x) => x.id === createdId);
ok(seen && seen.worker === w1.full_name && seen.client === null && seen.kind === "worker_update", "the operator sees it in the existing requests screen with the worker's name and the new kind");
ok(opsList.filter((x) => x.client).length === 6 && opsList.filter((x) => x.worker).length === 3, "client requests are untouched (6) beside the worker ones (3)");
ok((await post("request-state", { id: createdId, state: "in_review" }, ops)).status === 200 && (await get("worker-requests", {}, A)).body.requests.find((x) => x.id === createdId).state === "in_review", "only the operator moves the state; the worker sees it");
ok((await get("client-requests", {}, cA)).body.requests.every((x) => !/تحديث بيانات التواصل/.test(x.note || "")) && (await get("client-requests", {}, cA)).body.requests.length === 3, "the client never sees a worker's request, and its count is unchanged");
ok((await get("client-home", {}, cA)).body.counts.open_requests === 2, "the client's open-request counter ignores worker requests");
ok((await mk({ kind: "bogus", note: "اختبار" })).body.error === "bad_kind" && (await mk({ kind: "new_hire", note: "اختبار" })).body.error === "bad_kind" && (await mk({ kind: "document", note: "اختبار" })).body.error === "bad_kind", "only the three worker kinds (client kinds are refused)");
ok((await mk({ kind: "worker_inquiry", note: "ab" })).body.error === "note_required" && (await mk({ kind: "worker_inquiry" })).body.error === "note_required", "note required (3+ chars)");
ok((await mk({ kind: "worker_inquiry", note: "اختبار", topic: "iqama" })).body.error === "bad_topic" && (await mk({ kind: "worker_document", note: "اختبار", topic: "pay_statement" })).body.error === "bad_topic", "a topic outside the kind's list -> 400 bad_topic");
const long = await mk({ kind: "worker_inquiry", note: "ن".repeat(5000), topic: "documents" });
const lr = (await dbA.get(`shr_requests?id=eq.${long.body.request.id}`))[0];
ok(long.status === 200 && lr.body.note.length === 500, "free text is cut to 500 characters");

console.log("\n6. Flood protection (per worker)");
let n429 = null, made = 0;
for (let i = 0; i < 8; i++) { const x = await mk({ kind: "worker_inquiry", note: "طلب إغراق " + i }, B); if (x.status === 429) { n429 = x; break; } made++; }
ok(n429 && n429.body.error === "too_many_open_requests" && n429.body.max === 5 && made === 5, `open-request cap: B created ${made} then 429 too_many_open_requests`);
const old = new Date(Date.now() - 2 * 86400000).toISOString();
for (let i = 0; i < 6; i++) await dbA.post("shr_requests", { worker_id: w1.id, client_company_id: null, kind: "worker_inquiry", state: "new", body: { note: "قديم" }, created_at: old });
const cap = await mk({ kind: "worker_inquiry", note: "فوق السقف" }, A);
ok(cap.status === 429 && cap.body.error === "too_many_open_requests", "A is over the open cap too -> 429");
ok((await mk({ kind: "worker_inquiry", note: "عامل آخر غير متأثر" }, X)).status === 200, "the caps are per worker: the other tenant's worker is unaffected");
for (let i = 0; i < 4; i++) await dbX.post("shr_requests", { worker_id: wX.id, client_company_id: null, kind: "worker_inquiry", state: "done", body: { note: "مكتمل" } });
const hr = await mk({ kind: "worker_inquiry", note: "فوق سقف الساعة" }, X);
ok(hr.status === 429 && hr.body.error === "rate_limited" && hr.body.max === 5, "hourly cap: five requests within the hour (closed ones count) -> 429 rate_limited");

console.log("\n7. Salary: drafts never read, nothing invented");
await dbA.post("shr_payroll_runs", { establishment_id: (await dbA.get("shr_establishments?select=id&limit=1"))[0].id, period: "2026-10", status: "draft" });
const draftRun = (await dbA.get("shr_payroll_runs?select=id,period"))[0];
const sal2 = await get("worker-salary", {}, A);
ok(draftRun && !JSON.stringify(sal2.body).includes(draftRun.id) && !JSON.stringify(sal2.body).includes("2026-10") && sal2.body.statements.length === 0, "a draft payroll run exists in the database and nothing of it reaches the worker");
const wsrc = fs.readFileSync(new URL("../api/_shr_worker.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
ok(!/shr_payroll_runs/.test(wsrc), "the worker module never reads the payroll runs table");
ok(!/shr_invoices|shr_violations|shr_a33_names|shr_agencies|shr_agency_|shr_recruitment_orders|shr_establishment|shr_contracts|shr_audit_log|shr_import_|shr_candidate|shr_job/.test(wsrc), "...nor invoices, violations, A33, agencies, orders, establishments, contracts, the audit log, imports or ATS tables");
ok(!/id_no_hash|name_key/.test(wsrc), "the module never touches the identity fingerprint");
ok(!/\bsb\s*\(/.test(wsrc) && !/from "\.\/_db\.js"/.test(wsrc), "no direct sb() access: everything goes through the scoped db handed in");
// كل قراءة لجداول العامل تحمل مرشّح العامل نفسه: حذفه يعني تسريب غير العامل.
const reads = [...wsrc.matchAll(/db\.get\(`(shr_(?:workers|assignments|worker_documents|requests|checklist_ticks)\?[^`]*)`/g)].map((m) => m[1]);
ok(reads.length >= 6 && reads.every((q) => /(id|worker_id|subject_id)=eq\.\$\{(u\.worker_id|w\.id|wx\.workerId)\}/.test(q)), `every read of a worker-owned table carries the worker filter (${reads.length} reads)`);

console.log("\n8. The DTO is a whitelist: the whole reply is scanned for forbidden material");
const FORBIDDEN = /id_no_hash|name_key|restriction|violation|agency|agencies|recruitment|audit|a33|establishment|storage_key|created_by|approved_by|activated_by|reviewed_by|tenant_id|client_company_id|worker_id|unified_no|cr_number|compliance|fine|deadline|rule_id|source_ref|worker_transfers|transfer_approved|payroll|price|margin|amount|salary|invoice|gosi|passport/i;
const HEX64 = /[0-9a-f]{64}/i;
const UUID_G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const protectedNames = (await dbA.get("shr_agencies?select=name_ar")).map((x) => x.name_ar).concat((await dbA.get("shr_a33_names?select=alias")).map((x) => x.alias), (await dbA.get("shr_establishments?select=name_ar")).map((x) => x.name_ar));
async function sweep(who, label, me, otherClients) {
  const bodies = [];
  for (const a of ["worker-session", "worker-profile", "worker-contract", "worker-documents", "worker-salary", "worker-requests"]) bodies.push((await get(a, {}, who)).body);
  const json = JSON.stringify(bodies);
  ok(!FORBIDDEN.test(json.replace(/"created_at"/g, "").replace(UUID_G, "ID")), `${label}: no forbidden key or word anywhere (ids masked: a random uuid may spell a33)`);
  ok(!HEX64.test(json), `${label}: no 64-hex fingerprint`);
  ok(!protectedNames.some((n) => json.includes(n)), `${label}: no establishment, agency or A33 name`);
  ok(!allW.filter((w) => w.id !== me).some((w) => json.includes(w.full_name)), `${label}: no other worker's name`);
  ok(!otherClients.some((n) => json.includes(n)), `${label}: no other client's name`);
  const reqIds = new Set(bodies[5].requests.map((x) => x.id));
  const ids = json.match(UUID_G) || [];
  ok(ids.every((i) => reqIds.has(i)), `${label}: the only ids in any reply are the worker's own request ids (${ids.length})`);
  return bodies;
}
const aBodies = await sweep(A, "worker A", w1.id, ["عميل تجريبي SHR ب", "عميل تجريبي OTHER"]);
await sweep(B, "worker B", w3.id, ["عميل تجريبي SHR أ", "عميل تجريبي OTHER"]);
await sweep(X, "OTHER worker", wX.id, ["عميل تجريبي SHR"]);
const topKeys = (o) => Object.keys(o).sort().join();
ok(topKeys(aBodies[1].worker) === "full_name,id_kind,nationality,profession,status", "profile.worker: exactly the whitelisted keys: " + topKeys(aBodies[1].worker));
ok(topKeys(aBodies[1].assignment) === "client_name,profession,starts_on", "profile.assignment: client name, profession, start date only: " + topKeys(aBodies[1].assignment));
ok(topKeys(aBodies[1]) === "assignment,attention,demo,ok,worker", "profile top-level keys: " + topKeys(aBodies[1]));
ok(aBodies[3].documents.every((d) => topKeys(d) === "days_left,expires_on,kind,status") && topKeys(aBodies[3]) === "checklists,demo,documents,expiry_alert_days,ok", "documents: exactly the whitelisted keys");
ok(topKeys(aBodies[3].checklists[0]) === "complete,items,title_ar" && aBodies[3].checklists[0].items.every((i) => topKeys(i) === "done,required,text_ar"), "checklist: titles, item texts and ticks only");
ok(topKeys(aBodies[2]) === "available,contract,demo,ok", "contract top-level keys: " + topKeys(aBodies[2]));
ok(topKeys(aBodies[5]) === "can_request,demo,kinds,ok,requests,topics", "requests top-level keys: " + topKeys(aBodies[5]));
// بند قائمة مرجعه غير مؤكد لا يصل عاملاً؛ وقائمة الطاقم لا تصله.
const tpl = (await dbA.get("shr_checklist_templates?select=id,key,audience")).find((t) => t.audience === "worker");
await dbA.post("shr_checklist_items", { template_id: tpl.id, position: 9, text_ar: "بند مرجعه غير مؤكد", required: true, rule_id: "CH-1" });
const dd = (await get("worker-documents", {}, A)).body;
ok(dd.checklists.length === 1 && dd.checklists[0].items.length === 2 && !dd.checklists[0].items.some((i) => /غير مؤكد/.test(i.text_ar)), "a checklist item whose rule is not confirmed never reaches a worker; staff lists never do");

console.log("\n9. The contract summary is the active one only");
const assignW1 = (await dbA.get(`shr_assignments?worker_id=eq.${w1.id}&select=id,status`))[0];
await dbA.patch(`shr_assignments?id=eq.${assignW1.id}`, { status: "draft" });
const k2 = (await get("worker-contract", {}, A)).body, p2 = (await get("worker-profile", {}, A)).body;
ok(k2.contract === null && k2.available === false && p2.assignment === null, "a draft assignment: no contract summary, no beneficiary client");
await dbA.patch(`shr_assignments?id=eq.${assignW1.id}`, { status: "active" });
const docRow = (await dbA.get(`shr_worker_documents?worker_id=eq.${w1.id}&kind=eq.work_contract&select=id,storage_key`))[0];
await dbA.patch(`shr_worker_documents?id=eq.${docRow.id}`, { storage_key: null });
ok((await get("worker-contract", {}, A)).body.contract === null && D((await get("worker-documents", {}, A)).body).work_contract.status === "missing", "a work contract that is not on file: no summary, and the document shows 'missing'");
await dbA.patch(`shr_worker_documents?id=eq.${docRow.id}`, { storage_key: docRow.storage_key });
ok((await get("worker-contract", {}, A)).body.available === true, "restored -> shown again");
const contractsAll = await dbA.get("shr_contracts?select=id,status");
ok(contractsAll.some((k) => k.status === "draft") && contractsAll.some((k) => k.status === "pending_approval"), "(the database has draft and pending client contracts; none can reach the worker: ids are checked above)");

console.log("\n10. Session lifetime and live revocation");
const stale = forge({ sub: uid("a-worker@worker.invalid"), tenant_id: tA.id, role: "worker", email: "a-worker@worker.invalid" }, -10);
ok((await get("worker-profile", {}, stale)).status === 401, "an expired cookie -> 401");
ok((await get("worker-profile", {}, { cookie: A.cookie + "x" })).status === 401 && (await get("worker-profile", {}, { cookie: "" })).status === 401, "tampered or missing cookie -> 401");
ok(/Max-Age=0/.test((await post("session-end", {}, A)).headers["set-cookie"]), "session-end clears the cookie");
const aId = uid("a-worker@worker.invalid");
for (const st of ["draft", "pending_docs", "archived"]) {
  await dbA.patch(`shr_workers?id=eq.${w1.id}`, { status: st });
  const live = await get("worker-profile", {}, A), again = await login("SHR", "a-worker@worker.invalid");
  ok(live.status === 403 && live.body.error === "worker_not_active" && again.r.status === 403 && again.r.body.error === "worker_not_active" && !again.cookie, `worker status ${st}: 403 worker_not_active on the live session and no new session`);
}
await dbA.patch(`shr_workers?id=eq.${w1.id}`, { status: "active" });
ok((await get("worker-profile", {}, A)).status === 200 && (await login("SHR", "a-worker@worker.invalid")).r.status === 200, "reactivated -> works again");
await dbA.patch(`shr_users?id=eq.${aId}`, { worker_id: null });
ok((await get("worker-profile", {}, A)).body.error === "worker_not_linked" && (await login("SHR", "a-worker@worker.invalid")).r.body.error === "worker_not_linked", "an unlinked worker user: 403 worker_not_linked, no new session");
await dbA.patch(`shr_users?id=eq.${aId}`, { worker_id: w1.id });
await dbA.patch(`shr_users?id=eq.${aId}`, { role: "client_viewer" });
ok((await get("worker-profile", {}, A)).status === 403, "re-roling the user takes effect on the live session (role read from the DB)");
await dbA.patch(`shr_users?id=eq.${aId}`, { role: "worker" });
ok((await get("worker-profile", {}, A)).status === 200, "restored");
// عامل يُؤرشف من المشغّل يفقد الدخول فوراً.
ok((await post("worker-archive", { id: w3.id }, ops)).status === 200, "the operator archives worker 3");
ok((await get("worker-profile", {}, B)).body.error === "worker_not_active" && (await get("worker-requests", {}, B)).status === 403, "the archived worker is locked out of every page at once");

console.log("\n11. Gate and schema");
ok((await post("worker-delete", { id: w1.id }, ops)).status === 403 && (await post("worker-delete", { id: w1.id }, ops)).body.error === "archive_only", "delete is still archive-only for staff");
const SQL = fs.readFileSync(new URL("../db/shr-schema.sql", import.meta.url), "utf8");
ok(/shr_users_worker_fk[\s\S]*?foreign key \(tenant_id, worker_id\) references shr_workers\(tenant_id, id\)/.test(SQL), "schema: a worker user's worker is a composite FK (no cross-tenant link)");
ok(/shr_users_worker_role[\s\S]*?check \(\(role = 'worker'\) = \(worker_id is not null\)\)/.test(SQL), "schema: the worker role needs a worker, other roles none");
ok(/shr_requests_scope[\s\S]*?worker_id is not null and client_company_id is null[\s\S]*?worker_id is null and client_company_id is not null/.test(SQL), "schema: a request belongs to a worker or to a client, never both or neither");
ok(/shr_requests_worker_fk[\s\S]*?foreign key \(tenant_id, worker_id\) references shr_workers\(tenant_id, id\)/.test(SQL), "schema: a request's worker is a composite FK");
ok(/kind text not null check \(kind in \('new_hire','termination','transfer','document','other','worker_document','worker_update','worker_inquiry'\)\)/.test(SQL) && /shr_requests_kind_check[\s\S]*?not like '%worker_inquiry%'/.test(SQL), "schema: the request kind check carries the worker kinds, and old databases are upgraded");
ok(!/create table if not exists shr_worker_(requests|portal)/.test(SQL), "no new table (worker requests live in shr_requests)");
const created = (await dbX.get("shr_requests?select=id,worker_id,client_company_id")).filter((q) => q.worker_id);
ok(created.length >= 1 && created.every((q) => q.client_company_id === null && q.worker_id === wX.id), "the other tenant's worker request carries that tenant's worker only");

await new Promise((r) => setTimeout(r, 150));   // let the debounced db write land
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
