// SHR-HR: بوابة العميل على قاعدة JSON المحلية. عزل عميل أ عن ب وعزل المستأجر (404)، الأدوار في الاتجاهين،
// client_viewer لا يكتب، قائمة بيضاء للـDTO (مسح الرد كله بحثاً عن الحقول الممنوعة)، المسودات لا تظهر،
// حماية الإغراق، انتهاء الجلسة وسريان الإيقاف فوراً، وسجل التدقيق.
// Run: npm test
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-client-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
const { default: handler } = await import("../api/shr.js");
const { ctxFrom, scoped, tenantBySlug, hashIdNo } = await import("../api/_shr.js");

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
const A = await login("SHR", "a-admin@client.invalid");
const V = await login("SHR", "a-viewer@client.invalid");
const B = await login("SHR", "b-admin@client.invalid");
const X = await login("OTHER", "x-admin@client.invalid");
const tA = await tenantBySlug("SHR"), tX = await tenantBySlug("OTHER");
const dbA = scoped(ctxFrom({ tenant_id: tA.id, role: "tenant_owner" }));
const dbX = scoped(ctxFrom({ tenant_id: tX.id, role: "tenant_owner" }));

console.log("\n1. Login: demo-tagged, no tenant echoed, cookie flags");
ok(A.r.status === 200 && A.cookie && A.r.body.demo === true && A.r.body.user.role === "client_admin", "client_admin logs in");
ok(V.r.status === 200 && V.r.body.user.role === "client_viewer" && V.r.body.can_request === false && A.r.body.can_request === true, "client_viewer logs in, cannot request");
ok(A.r.body.tenant === null && A.r.body.client && /عميل تجريبي SHR أ/.test(A.r.body.client.name_ar), "session echoes the company, not the tenant");
ok(/HttpOnly/.test(A.r.headers["set-cookie"]) && /SameSite=Strict/.test(A.r.headers["set-cookie"]) && /Max-Age=\d+/.test(A.r.headers["set-cookie"]), "cookie is HttpOnly, SameSite=Strict, expiring");
const legacy = await login("SHR", "client@shr.invalid");
ok(legacy.r.status === 200 && legacy.r.body.user.role === "client_admin", "the legacy demo client user is linked to client A");
ok((await login("SHR", "nobody@client.invalid")).r.status === 401, "unknown user refused");
ok((await login("OTHER", "a-admin@client.invalid")).r.status === 401, "a user of one tenant cannot log in under another");
ok((await get("client-session", {}, A)).body.client.name_ar === A.r.body.client.name_ar, "client-session returns the same profile");

console.log("\n2. Workers: only the session client's assigned workers");
const wA = (await get("client-workers", {}, A)).body.workers;
const wB = (await get("client-workers", {}, B)).body.workers;
ok(wA.length === 2 && wB.length === 2, `A and B see two workers each (${wA.length}/${wB.length})`);
ok(wA.every((w) => !wB.some((x) => x.id === w.id)), "worker sets are disjoint");
ok(!wA.some((w) => /(٣|٤)$/.test(w.full_name)) && wB.every((w) => /(٣|٤)$/.test(w.full_name)), "workers 3 and 4 moved to client B");
const all8 = await dbA.get("shr_workers?select=id,full_name,status");
const draft = all8.find((w) => /مسودة/.test(w.full_name)), archived = all8.find((w) => /مؤرشف/.test(w.full_name)), pend = all8.find((w) => /٥/.test(w.full_name));
ok([draft, archived, pend].every((w) => w && !wA.some((x) => x.id === w.id) && !wB.some((x) => x.id === w.id)), "draft, archived and draft-assignment workers are not shown");
const w1 = wA.find((w) => /١$/.test(w.full_name)), w2 = wA.find((w) => /٢$/.test(w.full_name));
const D = (w) => Object.fromEntries(w.docs.map((d) => [d.kind, d]));
ok(D(w1).iqama.status === "expiring" && D(w1).medical_insurance.status === "valid" && D(w1).work_contract.status === "no_expiry", "worker 1: iqama expiring, insurance valid, contract has no expiry");
ok(D(w2).iqama.status === "expiring" && D(w2).iqama.days_left === 45, "worker 2: iqama expiring in 45 days");
const w3 = wB.find((w) => /٣$/.test(w.full_name));
ok(D(w3).medical_insurance.status === "expired" && w3.attention === "expired", "worker 3 (client B): insurance expired -> attention");
ok(w1.attention === "expiring", "worker 1 attention = expiring");
const det = (await get("client-worker", { id: w1.id }, A)).body;
ok(det.ok && det.worker.id === w1.id && det.worker.assignment && det.worker.docs.length === 3, "detail returns the worker with assignment and documents");
ok(det.checklists.length === 1 && /للعميل/.test(det.checklists[0].title_ar) && det.checklists[0].items.length === 3, "detail carries only the client-audience checklist");
ok(det.checklists[0].items.filter((i) => i.done).length === 2 && det.checklists[0].complete === false, "checklist ticks come from the worker's latest ticks");
ok((await get("client-worker", { id: w1.id }, V)).status === 200, "viewer reads detail too");

console.log("\n3. Isolation between clients of the same tenant: 404, never 403");
ok((await get("client-worker", { id: w3.id }, A)).status === 404, "A reads B's worker by id -> 404");
ok((await get("client-worker", { id: w1.id }, B)).status === 404, "B reads A's worker by id -> 404");
ok((await get("client-worker", { id: draft.id }, A)).status === 404 && (await get("client-worker", { id: archived.id }, A)).status === 404, "draft/archived worker by id -> 404");
ok((await get("client-worker", { id: "not-a-uuid" }, A)).status === 400, "malformed id -> 400");
const kA = (await get("client-contracts", {}, A)).body.contracts, kB = (await get("client-contracts", {}, B)).body.contracts;
ok(kA.length === 1 && kB.length === 1 && kA[0].id !== kB[0].id, "each client sees its one active contract");
ok(kA[0].version === 1 && kA[0].status === "active" && kA[0].workers === 2 && kB[0].workers === 2, "contract summary: version, status, worker count");
const allK = await dbA.get("shr_contracts?select=id,status,client_company_id");
ok(allK.some((k) => k.status === "draft") && allK.some((k) => k.status === "pending_approval") && allK.length === 4, "seed has draft and pending_approval contracts too");
ok(!JSON.stringify([kA, kB]).includes(allK.find((k) => k.status === "draft").id) && !JSON.stringify([kA, kB]).includes(allK.find((k) => k.status === "pending_approval").id), "draft and pending_approval contracts never appear");
const rA = (await get("client-requests", {}, A)).body.requests, rB = (await get("client-requests", {}, B)).body.requests;
ok(rA.length === 3 && rB.length === 3 && rA.every((r) => !rB.some((x) => x.id === r.id)), "requests are per client");
const queryTricks = [["client_company_id", "11111111-1111-4111-8111-111111111111"], ["tenant_id", tX.id]];
for (const [k, v] of queryTricks) ok((await get("client-workers", { [k]: v }, A)).status === 400, `${k} in the query -> 400`);
for (const [k, v] of queryTricks) ok((await post("client-request-create", { kind: "other", note: "اختبار", [k]: v }, A)).status === 400, `${k} in the body -> 400`);
const cliRows = await dbA.get("shr_client_companies?select=id,name_ar&order=created_at.asc");
ok((await post("client-request-create", { kind: "other", note: "اختبار", client_company_id: cliRows[1].id }, A)).body.error === "client_company_id_forbidden", "a request cannot name a client");
ok((await get("client-workers", {}, A)).body.workers.length === 2, "...and A's list is unchanged by the attempts");

console.log("\n4. Isolation between tenants");
const wX = (await get("client-workers", {}, X)).body.workers;
ok(X.r.status === 200 && wX.length === 2 && wX.every((w) => /آخر/.test(w.full_name)), "OTHER's client sees only OTHER workers");
ok((await get("client-worker", { id: w1.id }, X)).status === 404, "OTHER client reads an SHR worker id -> 404");
ok((await get("client-worker", { id: wX[0].id }, A)).status === 404, "SHR client reads an OTHER worker id -> 404");
ok((await get("client-contracts", {}, X)).body.contracts.length === 1, "OTHER client sees its own contract only");
const rX = (await get("client-requests", {}, X)).body.requests;
ok(rX.length === 1 && rX.every((r) => /آخر/.test(r.note)), "OTHER client sees only its own request");
const mixed = forge({ sub: (await dbA.get("shr_users?select=id,email")).find((u) => u.email === "b-admin@client.invalid").id, tenant_id: tX.id, role: "client_admin", email: "b-admin@client.invalid" });
ok((await get("client-workers", {}, mixed)).status === 403, "a client user id replayed under another tenant resolves to nothing -> 403");

console.log("\n5. Roles: the client reaches no operator action, and nobody else reaches the client's");
const opGets = ["dashboard", "workers", "requests", "expiring", "jobs", "applications", "candidates", "candidate", "agencies", "orders", "order-employer-view", "agency-submissions",
  "compliance-dashboard", "compliance-violations", "compliance-establishment", "compliance-checklists", "compliance-alerts", "compliance-a33", "compliance-imports", "compliance-settings", "compliance-ref", "compliance-transfers",
  "my-orders", "my-submissions", "my-interviews"];
for (const a of opGets) ok((await get(a, { id: w1.id }, A)).status === 403, `client GET ${a} -> 403`);
const opPosts = ["worker-create", "worker-activate", "worker-archive", "request-state", "job-create", "application-stage", "match", "agency-create", "order-create", "submission-state", "violation-create",
  "a33-add", "transfer-request", "import-create", "checklist-tick", "compliance-settings-update", "submit-candidate", "bulk-submit", "worker-delete", "delete", "request-delete"];
for (const a of opPosts) ok((await post(a, { id: rA[0].id, state: "done" }, A)).status === 403, `client POST ${a} -> 403`);
ok((await post("client-home", {}, A)).status === 403 && (await get("client-request-create", {}, A)).status === 403, "wrong method on a client action -> 403");
console.log("   and the other roles do not get client actions");
for (const [who, name] of [[ops, "operator"], [owner, "owner"], [cmpo, "compliance_officer"], [agA, "agency"]]) {
  for (const a of ["client-session", "client-home", "client-workers", "client-worker", "client-contracts", "client-requests", "client-invoices"]) ok((await get(a, { id: w1.id }, who)).status === 403, `${name} GET ${a} -> 403`);
  ok((await post("client-request-create", { kind: "other", note: "اختبار" }, who)).status === 403, `${name} POST client-request-create -> 403`);
}
// عميل لا يكون موظفاً: الكوكي بدور عميل وsub لمشغّل لا يمنح شيئاً (الدور من القاعدة).
const opsId = (await dbA.get("shr_users?select=id,email")).find((u) => u.email === "ops@shr.invalid").id;
ok((await get("client-workers", {}, forge({ sub: opsId, tenant_id: tA.id, role: "client_admin", email: "ops@shr.invalid" }))).status === 403, "client cookie carrying an operator's sub -> 403 (role read from the DB)");

console.log("\n6. client_viewer reads but never writes");
const before = (await get("client-requests", {}, A)).body.requests.length;
const vw = await post("client-request-create", { kind: "other", note: "محاولة من المطّلع" }, V);
ok(vw.status === 403 && vw.body.error === "read_only_role", "viewer create -> 403 read_only_role");
ok((await get("client-requests", {}, A)).body.requests.length === before, "nothing was written");
ok((await get("client-requests", {}, V)).status === 200 && (await get("client-home", {}, V)).status === 200, "viewer reads requests and home");

console.log("\n7. Creating a request: limited fields, free text trimmed, state is not the client's");
const mk = (b, who = A) => post("client-request-create", b, who);
let r = await mk({ kind: "new_hire", note: "نحتاج فنيين (تجريبي)", profession: "فني تكييف", quantity: 3, state: "done", id: "x", created_by: "y", extra: { a: 1 } });
ok(r.status === 200 && r.body.request.state === "new" && r.body.request.kind === "new_hire", "created as new; a state from the body is ignored");
const createdId = r.body.request.id;
const row = (await dbA.get(`shr_requests?id=eq.${createdId}`))[0];
ok(row.state === "new" && row.client_company_id === (await dbA.get("shr_client_companies?select=id,name_ar")).find((c) => /SHR أ/.test(c.name_ar)).id, "row lands on the session's client");
ok(Object.keys(row.body).sort().join() === "demo,note,profession,quantity,source,worker_id", "body keeps only the whitelisted keys: " + Object.keys(row.body).join());
const usersAll = await dbA.get("shr_users?select=id,email");
ok(row.created_by === usersAll.find((u) => u.email === "a-admin@client.invalid").id, "created_by is the client user (id)");
const aud = await dbA.get("shr_audit_log?select=action,actor,entity,entity_id");
const au = aud.find((x) => x.entity_id === createdId);
ok(au && au.action === "client_request.create.new_hire" && au.actor === row.created_by && au.entity === "shr_requests", "an audit row is written for the new request, actor = the client user");
ok((await get("client-requests", {}, A)).body.requests.some((x) => x.id === createdId && x.quantity === 3 && x.state === "new"), "it shows in the client's list");
const opsList = (await get("requests", {}, ops)).body.requests;
ok(opsList.some((x) => x.id === createdId && /عميل تجريبي SHR أ/.test(x.client)), "the operator sees it with the client name");
ok((await post("request-state", { id: createdId, state: "in_review" }, ops)).status === 200 && (await get("client-requests", {}, A)).body.requests.find((x) => x.id === createdId).state === "in_review", "only the operator moves the state; the client sees it");
ok((await mk({ kind: "bogus", note: "اختبار" })).body.error === "bad_kind", "bad kind -> 400");
ok((await mk({ kind: "other", note: "ab" })).body.error === "note_required" && (await mk({ kind: "other" })).body.error === "note_required", "note required (3+ chars)");
ok((await mk({ kind: "new_hire", note: "اختبار", quantity: 0 })).body.error === "bad_quantity" && (await mk({ kind: "new_hire", note: "اختبار", quantity: 1000 })).body.error === "bad_quantity" && (await mk({ kind: "new_hire", note: "اختبار", quantity: 1.5 })).body.error === "bad_quantity", "quantity bounds");
const long = await mk({ kind: "other", note: "ن".repeat(5000), profession: "م".repeat(500) });
const lr = (await dbA.get(`shr_requests?id=eq.${long.body.request.id}`))[0];
ok(long.status === 200 && lr.body.note.length === 500 && lr.body.profession.length === 80, "free text is cut to 500 / 80 characters");
ok((await mk({ kind: "termination", note: "إنهاء" })).body.error === "worker_required", "termination needs a worker");
ok((await mk({ kind: "termination", note: "إنهاء", worker_id: w1.id })).status === 200, "termination on the client's own worker is accepted");
ok((await mk({ kind: "transfer", note: "نقل", worker_id: w3.id })).status === 404, "a worker of another client -> 404");
ok((await mk({ kind: "document", note: "شهادة", worker_id: wX[0].id })).status === 404, "a worker of another tenant -> 404");
ok((await mk({ kind: "document", note: "شهادة", worker_id: "zz" })).body.error === "bad_id", "malformed worker id -> 400");
ok((await mk({ kind: "document", note: "شهادة", worker_id: draft.id })).status === 404, "a draft worker -> 404");
const wn = (await get("client-requests", {}, A)).body.requests.find((x) => x.kind === "termination" && x.worker_name);
ok(wn && wn.worker_name === w1.full_name, "the request list names the worker (own workers only)");

console.log("\n8. Flood protection");
let n429 = null, made = 0;
for (let i = 0; i < 15; i++) { const x = await mk({ kind: "other", note: "طلب إغراق " + i }, B); if (x.status === 429) { n429 = x; break; } made++; }
ok(n429 && n429.body.error === "rate_limited" && made === 10 - 3, `hourly cap: B created ${made} more then 429 rate_limited`);
const bId = (await dbA.get("shr_client_companies?select=id,name_ar")).find((c) => /SHR ب/.test(c.name_ar)).id;
const old = new Date(Date.now() - 2 * 86400000).toISOString();
for (let i = 0; i < 20; i++) await dbA.post("shr_requests", { client_company_id: bId, kind: "other", state: "new", body: { note: "قديم" }, created_at: old });
const cap = await mk({ kind: "other", note: "فوق السقف" }, B);
ok(cap.status === 429 && cap.body.error === "too_many_open_requests", "open-request cap -> 429 too_many_open_requests");
ok((await mk({ kind: "other", note: "عميل آخر غير متأثر" }, V)).status === 403 && (await mk({ kind: "other", note: "اختبار عميل أ" }, A)).status === 200, "the cap is per client: A unaffected");

console.log("\n9. Invoices: always empty, drafts never read");
const inv = await get("client-invoices", {}, A);
ok(inv.status === 200 && inv.body.invoices.length === 0 && inv.body.available === false && /تصدرها فرق Business Partner بعد الاعتماد/.test(inv.body.note_ar), "explicit empty state with the agreed sentence");
const draftInv = await dbA.get("shr_invoices?select=id,client_company_id,status");
ok(draftInv.length >= 1 && draftInv.every((x) => x.status === "draft"), "a draft invoice exists for the client in the database");
ok(!JSON.stringify(inv.body).includes(draftInv[0].id) && Object.keys(inv.body).sort().join() === "available,demo,invoices,note_ar,ok", "…and nothing of it reaches the client: " + Object.keys(inv.body).sort().join());
const src = fs.readFileSync(new URL("../api/_shr_client.js", import.meta.url), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
ok(!/shr_invoices/.test(src.replace(/\/\/.*$/gm, "")), "the client module never reads shr_invoices");
ok(!/price|margin|amount|total|sar|هامش|سعر/i.test(JSON.stringify(inv.body).replace(/available/g, "")), "no price or margin field");

console.log("\n10. The DTO is a whitelist: the whole reply is scanned for forbidden material");
const FORBIDDEN = /id_no_hash|name_key|restriction|violation|agency|agencies|recruitment|audit|a33|establishment|storage_key|created_by|approved_by|activated_by|reviewed_by|tenant_id|client_company_id|unified_no|cr_number|compliance|fine|deadline|rule_id|source_ref|worker_transfers|transfer_approved/i;
const HEX64 = /[0-9a-f]{64}/i;
const names = (await dbA.get("shr_agencies?select=name_ar")).map((x) => x.name_ar).concat((await dbA.get("shr_a33_names?select=alias")).map((x) => x.alias), (await dbA.get("shr_establishments?select=name_ar")).map((x) => x.name_ar));
async function sweep(who, label, otherClientNames) {
  const ws = (await get("client-workers", {}, who)).body.workers;
  const bodies = [(await get("client-session", {}, who)).body, (await get("client-home", {}, who)).body, { workers: ws }, (await get("client-contracts", {}, who)).body, (await get("client-requests", {}, who)).body, (await get("client-invoices", {}, who)).body];
  for (const w of ws) bodies.push((await get("client-worker", { id: w.id }, who)).body);
  const json = JSON.stringify(bodies);
  ok(!FORBIDDEN.test(json.replace(/"created_at"/g, "").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "ID")), `${label}: no forbidden key or word anywhere (ids masked: a random uuid may spell a33)`);
  ok(!HEX64.test(json), `${label}: no 64-hex fingerprint`);
  ok(!names.some((n) => json.includes(n)), `${label}: no establishment, agency or A33 name`);
  ok(!otherClientNames.some((n) => json.includes(n)), `${label}: no other client's name`);
  return bodies;
}
const aBodies = await sweep(A, "client A", ["عميل تجريبي SHR ب", "عميل تجريبي OTHER"]);
await sweep(B, "client B", ["عميل تجريبي SHR أ", "عميل تجريبي OTHER"]);
await sweep(V, "viewer A", ["عميل تجريبي SHR ب"]);
await sweep(X, "OTHER client", ["عميل تجريبي SHR"]);
const topKeys = (o) => Object.keys(o).sort().join();
ok(topKeys(aBodies[1].counts) === "contracts_active,docs_expired,docs_expiring,open_requests,workers", "home counts: exactly the whitelisted keys: " + topKeys(aBodies[1].counts));
ok(topKeys(wA[0]) === "attention,docs,full_name,id,nationality,profession,status", "worker list item: exactly the whitelisted keys: " + topKeys(wA[0]));
ok(topKeys(aBodies[3].contracts[0]) === "days_left,ends_on,id,starts_on,status,version,workers", "contract item: exactly the whitelisted keys: " + topKeys(aBodies[3].contracts[0]));
ok(topKeys(aBodies[4].requests[0]) === "created_at,id,kind,note,profession,quantity,state,worker_name", "request item: exactly the whitelisted keys: " + topKeys(aBodies[4].requests[0]));
ok(w1.docs.every((d) => topKeys(d) === "days_left,expires_on,kind,status"), "document item: exactly the whitelisted keys");
ok(!w1.docs.some((d) => d.kind === "gosi") && !JSON.stringify(w1).includes("storage"), "no gosi row, no storage key");
// بند قائمة مرجعه غير مؤكد لا يصل عميلاً؛ وقائمة طاقم لا تصله.
const tpl = (await dbA.get("shr_checklist_templates?select=id,key,audience")).find((t) => t.key === "client_worker_docs");
await dbA.post("shr_checklist_items", { template_id: tpl.id, position: 9, text_ar: "بند مرجعه غير مؤكد", required: true, rule_id: "CH-1" });
const det2 = (await get("client-worker", { id: w1.id }, A)).body;
ok(det2.checklists.length === 1 && det2.checklists[0].items.length === 3 && !det2.checklists[0].items.some((i) => /غير مؤكد/.test(i.text_ar)), "a checklist item whose rule is not confirmed never reaches a client; staff lists never do");

console.log("\n11. Session lifetime and live revocation");
const stale = forge({ sub: usersAll.find((u) => u.email === "a-admin@client.invalid").id, tenant_id: tA.id, role: "client_admin", email: "a-admin@client.invalid" }, -10);
ok((await get("client-workers", {}, stale)).status === 401, "an expired cookie -> 401");
ok((await get("client-workers", {}, { cookie: A.cookie + "x" })).status === 401 && (await get("client-workers", {}, { cookie: "" })).status === 401, "tampered or missing cookie -> 401");
const out = await post("session-end", {}, A);
ok(/Max-Age=0/.test(out.headers["set-cookie"]), "session-end clears the cookie");
const aId = (await dbA.get("shr_users?select=id,email,role")).find((u) => u.email === "a-admin@client.invalid").id;
await dbA.patch(`shr_users?id=eq.${aId}`, { role: "client_viewer" });
ok((await mk({ kind: "other", note: "بعد خفض الدور" }, A)).status === 403, "demoting the user takes effect on the live session (role read from the DB)");
await dbA.patch(`shr_users?id=eq.${aId}`, { role: "client_admin" });
await dbA.patch(`shr_users?id=eq.${aId}`, { client_company_id: null });
ok((await get("client-workers", {}, A)).body.error === "client_not_linked" && (await login("SHR", "a-admin@client.invalid")).r.body.error === "client_not_linked", "an unlinked client user: 403 client_not_linked, no new session");
await dbA.patch(`shr_users?id=eq.${aId}`, { client_company_id: cliRows.find((c) => /SHR أ/.test(c.name_ar)).id });
const aCo = cliRows.find((c) => /SHR أ/.test(c.name_ar)).id;
await dbA.patch(`shr_client_companies?id=eq.${aCo}`, { status: "inactive" });
ok((await get("client-workers", {}, A)).body.error === "client_not_active" && (await login("SHR", "a-admin@client.invalid")).r.body.error === "client_not_active", "a deactivated client: 403 at once, no new session");
await dbA.patch(`shr_client_companies?id=eq.${aCo}`, { status: "active" });
ok((await get("client-workers", {}, A)).status === 200, "reactivated -> works again");
// عامل يُؤرشف من المشغّل يختفي من عمال العميل فوراً.
ok((await post("worker-archive", { id: w2.id }, ops)).status === 200, "operator archives worker 2");
ok((await get("client-workers", {}, A)).body.workers.length === 1 && (await get("client-worker", { id: w2.id }, A)).status === 404, "the archived worker disappears from the client's list and detail");

console.log("\n12. Gate and schema");
ok((await post("worker-delete", { id: w1.id }, ops)).status === 403, "delete is still archive-only for staff");
const SQL = fs.readFileSync(new URL("../db/shr-schema.sql", import.meta.url), "utf8");
ok(/shr_users_client_fk[\s\S]*?foreign key \(tenant_id, client_company_id\) references shr_client_companies\(tenant_id, id\)/.test(SQL), "schema: a client user's company is a composite FK (no cross-tenant link)");
ok(/shr_users_client_role[\s\S]*?\(role in \('client_admin','client_viewer'\)\) = \(client_company_id is not null\)/.test(SQL), "schema: client roles need a company, other roles none");
ok(!/create table if not exists shr_client_/.test(SQL.replace(/create table if not exists shr_client_companies/, "")), "no new client table (client_companies is the only one)");

await new Promise((r) => setTimeout(r, 150));   // let the debounced db write land
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
