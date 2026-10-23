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

console.log("\n5. ATS tables go through the same gate");
for (const t of ["shr_candidates", "shr_candidate_consents", "shr_jobs", "shr_applications", "shr_application_events", "shr_interviews"]) {
  await a.get(`${t}?select=id`);
  ok(calls.at(-1).p === `${t}?tenant_id=eq.${A}&select=id`, `${t}: read pinned`);
  ok(throws(() => a.get(`${t}?tenant_id=eq.${B}`)), `${t}: tenant_id in query refused`);
  ok(throws(() => a.post(t, { tenant_id: B })), `${t}: tenant_id in body refused`);
  await a.post(t, { x: 1 });
  ok(calls.at(-1).body.tenant_id === A, `${t}: write stamped`);
  ok(throws(() => a.patch(t, { x: 1 })), `${t}: PATCH without filter refused`);
}

console.log("\n6. Agency tables go through the same gate");
for (const t of ["shr_agencies", "shr_recruitment_orders", "shr_agency_candidates", "shr_agency_candidate_events", "shr_agency_interviews"]) {
  await a.get(`${t}?select=id`);
  ok(calls.at(-1).p === `${t}?tenant_id=eq.${A}&select=id`, `${t}: read pinned`);
  ok(throws(() => a.get(`${t}?tenant_id=eq.${B}`)), `${t}: tenant_id in query refused`);
  ok(throws(() => a.post(t, { tenant_id: B })), `${t}: tenant_id in body refused`);
  await a.post(t, { x: 1 });
  ok(calls.at(-1).body.tenant_id === A, `${t}: write stamped`);
  ok(throws(() => a.patch(t, { x: 1 })), `${t}: PATCH without filter refused`);
}
ok(throws(() => ctxFrom({ tenant_id: A, role: "agency" }) && a.del()), "delete stays archive-only for the agency tables");
const ag = ctxFrom({ tenant_id: A, role: "agency" });
ok(ag.staff === false, "role agency is not staff in the gate");

console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
