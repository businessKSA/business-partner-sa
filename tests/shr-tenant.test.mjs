// SHR-HR: بوابة العزل بين المستأجرين.
// Run: npm test
import fs from "node:fs";
import { ctxFrom, scoped, ROLES } from "../api/_shr.js";

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

console.log("\n7. Every table in the schema goes through the same gate (derived from db/shr-schema.sql, so a new table cannot be forgotten)");
const SQL = fs.readFileSync(new URL("../db/shr-schema.sql", import.meta.url), "utf8");
const blocks = [...SQL.matchAll(/create table if not exists (shr_[a-z0-9_]+) \(([\s\S]*?)\n\);/g)].map((m) => ({ t: m[1], body: m[2] }));
const rls = (/foreach t in array array\[([\s\S]*?)\] loop\n    execute format\('alter table %I enable row level security'/.exec(SQL) || [])[1] || "";
ok(blocks.length === (SQL.match(/create table if not exists shr_/g) || []).length && blocks.length > 30, `schema parsed completely: ${blocks.length} tables`);
for (const { t, body } of blocks.filter((x) => x.t !== "shr_tenants")) {
  ok(/tenant_id uuid not null[^,\n]*references shr_tenants\(id\)/.test(body), `${t}: has tenant_id not null -> shr_tenants`);
  ok(rls.includes(`'${t}'`), `${t}: has the RLS tenant_iso policy`);
  await a.get(`${t}?select=id`);
  ok(calls.at(-1).p === `${t}?tenant_id=eq.${A}&select=id`, `${t}: read pinned`);
  ok(throws(() => a.get(`${t}?tenant_id=eq.${B}`)) && throws(() => a.post(t, { tenant_id: B })) && throws(() => a.patch(t, { x: 1 })) && throws(() => a.del()), `${t}: no tenant override, unfiltered PATCH, or delete`);
  await a.post(t, { x: 1 });
  ok(calls.at(-1).body.tenant_id === A, `${t}: write stamped`);
}
for (const t of ["shr_a33_names", "shr_violations", "shr_import_rows", "shr_establishment_compliance"]) ok(blocks.some((x) => x.t === t), `${t} exists in the schema`);

console.log("\n8. compliance_officer is a staff role in the gate and in the schema");
ok(ROLES.includes("compliance_officer") && ctxFrom({ tenant_id: A, role: "compliance_officer" }).staff === true, "role known to the gate, staff");
ok(/role in \([^)]*'compliance_officer'/.test(SQL), "schema role check includes compliance_officer");
ok(/shr_violations[\s\S]*?check \(reviewed_by is null or reviewed_by <> entered_by\)/.test(SQL) && /check \(estimated_objection_deadline is null or notification_date is not null\)/.test(SQL), "schema: reviewer != enterer; no deadline without a notification date");
ok(/shr_a33_names[\s\S]*?approved_by <> classified_by/.test(SQL) && /shr_worker_transfers[\s\S]*?decided_by <> requested_by/.test(SQL) && /shr_import_batches[\s\S]*?reviewed_by <> uploaded_by/.test(SQL), "schema: classifier != approver; requester != decider; uploader != reviewer");
ok(/shr_no_delete\(\)/.test(SQL) && /shr_append_only\(\)/.test(SQL), "schema: no-delete and append-only triggers present");

console.log("\n9. Client roles are not staff in the gate; their tables are the same gated ones");
for (const role of ["client_admin", "client_viewer"]) ok(ROLES.includes(role) && ctxFrom({ tenant_id: A, role }).staff === false, `${role} is known to the gate and is not staff`);
ok(/shr_users_client_fk/.test(SQL) && /shr_client_companies_tenant_id_id_key/.test(SQL), "schema: client user -> company is a tenant-composite FK");
for (const t of ["shr_client_companies", "shr_contracts", "shr_requests", "shr_assignments", "shr_worker_documents", "shr_invoices"]) {
  await a.get(`${t}?select=id`);
  ok(calls.at(-1).p === `${t}?tenant_id=eq.${A}&select=id` && throws(() => a.get(`${t}?tenant_id=eq.${B}`)), `${t}: pinned to the session tenant`);
}

console.log("\n10. The worker role is not staff in the gate; the tables behind the worker portal are the same gated ones");
ok(ROLES.includes("worker") && ctxFrom({ tenant_id: A, role: "worker" }).staff === false, "worker is known to the gate and is not staff");
ok(/shr_users_worker_fk/.test(SQL) && /shr_users_worker_role/.test(SQL) && /shr_requests_scope/.test(SQL) && /shr_requests_worker_fk/.test(SQL), "schema: worker user -> worker and request -> worker are tenant-composite FKs, with the scope check");
for (const t of ["shr_users", "shr_workers", "shr_assignments", "shr_worker_documents", "shr_requests", "shr_payroll_runs", "shr_checklist_ticks"]) {
  await a.get(`${t}?select=id`);
  ok(calls.at(-1).p === `${t}?tenant_id=eq.${A}&select=id` && throws(() => a.get(`${t}?tenant_id=eq.${B}`)) && throws(() => a.post(t, { tenant_id: B })), `${t}: pinned to the session tenant`);
}

console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
