// SHR-HR phase 2: the operations API, end to end on the local JSON db.
// Isolation between tenants, archive-only, activation needs documents,
// whoever enters a worker cannot approve it. Run: npm test
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-api-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
const { default: handler } = await import("../api/shr.js");

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

// A tiny stand-in for the Vercel req/res pair.
async function call(method, payload, cookie = "") {
  const q = method === "GET" ? payload : {};
  const req = { method, body: method === "POST" ? payload : undefined, query: q, cookies: {} };
  if (cookie) req.cookies.shr_session = cookie;
  let status = 200, body = null; const headers = {};
  const res = {
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    status: (c) => { status = c; return res; },
    json: (o) => { body = o; return res; },
  };
  await handler(req, res);
  return { status, body, headers };
}
async function login(slug, email) {
  const r = await call("POST", { action: "session", slug, email });
  const m = /shr_session=([^;]*)/.exec(r.headers["set-cookie"] || "");
  return { r, cookie: m ? m[1] : "" };
}

console.log("\n1. Session: staff roles only, demo-tagged");
const ops = await login("SHR", "ops@shr.invalid");
ok(ops.r.status === 200 && ops.cookie, "operator logs in");
ok(ops.r.body.demo === true, "every response carries demo:true");
const owner = await login("SHR", "owner@shr.invalid");
ok(owner.r.status === 200, "tenant_owner logs in");
const client = await login("SHR", "client@shr.invalid");
ok(client.r.status === 403 && !client.cookie, "client_admin refused in phase 2");
ok((await login("SHR", "nobody@shr.invalid")).r.status === 401, "unknown user refused");
ok((await call("GET", { action: "dashboard" })).status === 401, "no cookie -> 401");
ok((await call("GET", { action: "dashboard" }, ops.cookie + "x")).status === 401, "tampered cookie -> 401");

console.log("\n2. Tenant isolation through the API");
const other = await login("OTHER", "ops@other.invalid");
const wA = (await call("GET", { action: "workers" }, ops.cookie)).body.workers;
const wB = (await call("GET", { action: "workers" }, other.cookie)).body.workers;
ok(wA.length === 8 && wB.length === 3, `each tenant sees only its own workers (${wA.length}/${wB.length})`);
ok(!wA.some((w) => /آخر/.test(w.full_name)) && !wB.some((w) => /عامل تجريبي/.test(w.full_name)), "no names cross over");
const idsA = new Set(wA.map((w) => w.id));
ok(wB.every((w) => !idsA.has(w.id)), "no ids cross over");
const rA = (await call("GET", { action: "requests" }, ops.cookie)).body.requests;
const rB = (await call("GET", { action: "requests" }, other.cookie)).body.requests;
ok(rA.length === 6 && rB.length === 2, "requests isolated");
const dA = (await call("GET", { action: "dashboard" }, ops.cookie)).body.counts;
const dB = (await call("GET", { action: "dashboard" }, other.cookie)).body.counts;
ok(dA.workers !== dB.workers && dA.open_requests === 4, `dashboard counts per tenant (${dA.workers}/${dB.workers}, open ${dA.open_requests})`);
ok(dA.docs_expiring_60d >= 1 && dA.docs_expired >= 1, "expiry counts present");
// Acting on another tenant's row by id finds nothing.
const foreign = wB[0].id;
ok((await call("POST", { action: "worker-archive", id: foreign }, ops.cookie)).status === 404, "archive of foreign worker -> 404");
ok((await call("POST", { action: "worker-activate", id: foreign }, owner.cookie)).status === 404, "activate of foreign worker -> 404");
ok((await call("POST", { action: "request-state", id: rB[0].id, state: "done" }, ops.cookie)).status === 404, "state change on foreign request -> 404");
ok((await call("GET", { action: "workers" }, other.cookie)).body.workers.some((w) => w.id === foreign && w.status !== "archived"), "foreign worker untouched");
// A request cannot name a tenant.
ok((await call("POST", { action: "worker-create", full_name: "x y", tenant_id: "x" }, ops.cookie)).status === 400, "tenant_id in body -> 400");
ok((await call("GET", { action: "workers", tenant_id: "x" }, ops.cookie)).status === 400, "tenant_id in query -> 400");
const exp = (await call("GET", { action: "expiring", days: "60" }, ops.cookie)).body;
ok(exp.items.length > 0 && exp.items.every((i) => !/آخر/.test(i.worker)), "expiring list is tenant-scoped");

console.log("\n3. Delete is archive-only");
ok((await call("POST", { action: "worker-delete", id: wA[0].id }, ops.cookie)).status === 403, "worker-delete refused");
ok((await call("POST", { action: "delete", id: wA[0].id }, ops.cookie)).status === 403, "delete refused");
const arch = await call("POST", { action: "worker-archive", id: wA.find((w) => w.full_name.includes("(مسودة)")).id }, ops.cookie);
ok(arch.status === 200 && arch.body.worker.status === "archived", "archive works");
const after = (await call("GET", { action: "workers" }, ops.cookie)).body.workers;
ok(after.length === 8, "archived row still exists");

console.log("\n4. Drafts only; activation needs documents");
const mk = await call("POST", { action: "worker-create", full_name: "عامل تجريبي جديد", id_kind: "iqama", id_no: "DEMO-NEW-1" }, ops.cookie);
ok(mk.status === 200 && mk.body.worker.status === "draft", "created as draft");
ok((await call("POST", { action: "worker-create", full_name: "x y", status: "active" }, ops.cookie)).status === 400, "create with status=active refused");
ok((await call("POST", { action: "worker-create", full_name: "" }, ops.cookie)).status === 400, "name required");
const stored = (await call("GET", { action: "workers" }, ops.cookie)).body.workers.find((w) => w.id === mk.body.worker.id);
ok(stored && !("id_no_hash" in stored), "id hash is not returned");
const noDocs = await call("POST", { action: "worker-activate", id: mk.body.worker.id }, owner.cookie);
ok(noDocs.status === 409 && noDocs.body.error === "activation_blocked", "activation without documents refused");
ok(["iqama", "work_contract", "establishment"].every((m) => noDocs.body.missing.includes(m)), "names what is missing: " + noDocs.body.missing);
const stillDraft = (await call("GET", { action: "workers" }, ops.cookie)).body.workers.find((w) => w.id === mk.body.worker.id);
ok(stillDraft.status === "draft", "worker stays draft");

console.log("\n5. Whoever enters does not approve");
const ready = wA.find((w) => w.full_name.includes("جاهز للتفعيل"));
const self = await call("POST", { action: "worker-activate", id: ready.id }, ops.cookie);
ok(self.status === 403 && self.body.error === "maker_checker", "creator cannot activate own draft");
const four = await call("POST", { action: "worker-activate", id: ready.id }, owner.cookie);
ok(four.status === 200 && four.body.worker.status === "active", "a different staff user can activate when documents exist");
const done = (await call("GET", { action: "workers" }, ops.cookie)).body.workers.find((w) => w.id === ready.id);
ok(done.activated_by && done.activated_by !== done.created_by, "activated_by differs from created_by");

console.log("\n6. Requests: state changes");
const open = rA.find((r) => r.state === "new");
ok((await call("POST", { action: "request-state", id: open.id, state: "in_review" }, ops.cookie)).status === 200, "new -> in_review");
ok((await call("POST", { action: "request-state", id: open.id, state: "bogus" }, ops.cookie)).status === 400, "unknown state refused");
ok((await call("POST", { action: "request-state", id: "not-a-uuid", state: "done" }, ops.cookie)).status === 400, "bad id refused");
const closed = rA.find((r) => r.state === "done");
ok((await call("POST", { action: "request-state", id: closed.id, state: "new" }, ops.cookie)).status === 409, "closed request cannot reopen");

console.log("\n7. Local only");
process.env.LOCAL_DB = "0";
ok((await call("GET", { action: "dashboard" }, ops.cookie)).status === 503, "refuses outside LOCAL_DB=1");
process.env.LOCAL_DB = "1";

fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
