// SHR-HR: بوابة العزل بين المستأجرين.
// Run: npm test
import { ctxFrom, scoped } from "../api/_shr.js";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };
const throws = (f) => { try { f(); return false; } catch { return true; } };

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const calls = [];
const send = (p, o = {}) => { calls.push({ p, ...o }); return Promise.resolve([]); };
const a = scoped(ctxFrom({ tenant_id: A, role: "operator" }), send);

console.log("\n1. Reads are pinned to the session tenant");
await a.get("shr_workers?select=id,full_name&order=full_name.asc");
ok(calls.at(-1).p.startsWith(`shr_workers?tenant_id=eq.${A}&`), "tenant filter is first: " + calls.at(-1).p);
await a.get("shr_workers");
ok(calls.at(-1).p === `shr_workers?tenant_id=eq.${A}`, "bare table still filtered");

console.log("\n2. A request cannot name another tenant");
ok(throws(() => a.get(`shr_workers?tenant_id=eq.${B}`)), "tenant_id in query refused");
ok(throws(() => a.post("shr_workers", { tenant_id: B, full_name: "x" })), "tenant_id in body refused");
ok(throws(() => a.post("shr_workers", [{ full_name: "x" }, { tenant_id: B }])), "tenant_id in any row refused");

console.log("\n3. Writes are stamped with the session tenant");
await a.post("shr_workers", { full_name: "عامل تجريبي" });
ok(calls.at(-1).body.tenant_id === A, "POST stamped");
await a.post("shr_workers", [{ full_name: "1" }, { full_name: "2" }]);
ok(calls.at(-1).body.every((r) => r.tenant_id === A), "bulk POST stamped");
await a.patch("shr_workers?id=eq.x", { status: "active" });
ok(calls.at(-1).p === `shr_workers?tenant_id=eq.${A}&id=eq.x`, "PATCH pinned: " + calls.at(-1).p);
ok(throws(() => a.patch("shr_workers", { status: "active" })), "PATCH without filter refused");

console.log("\n4. Nothing else gets through");
ok(throws(() => a.get("orders")), "non-shr table refused");
ok(throws(() => a.get("shr_workers;drop")), "odd table name refused");
ok(throws(() => a.del()), "delete refused (archive only)");
ok(throws(() => ctxFrom({ role: "operator" })), "no tenant → no context");
ok(throws(() => ctxFrom({ tenant_id: "x", role: "operator" })), "malformed tenant refused");
ok(throws(() => ctxFrom({ tenant_id: A, role: "root" })), "unknown role refused");
ok(throws(() => scoped({}, send)), "scoped() without ctx refused");

console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
