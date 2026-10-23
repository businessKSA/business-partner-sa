// SHR-HR: ATS (وظائف · طلبات تقديم · مقابلات · موافقات · مطابقة) على قاعدة JSON المحلية.
// Run: npm test
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-ats-"));
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
const ops = await login("SHR", "ops@shr.invalid");
const owner = await login("SHR", "owner@shr.invalid");
const other = await login("OTHER", "ops@other.invalid");
const get = async (action, q, who = ops) => (await call("GET", { action, ...q }, who.cookie)).body;
const post = (action, b, who = ops) => call("POST", { action, ...b }, who.cookie);

console.log("\n1. Isolation: every ATS table, straight through the gate");
const tenants = { A: await tenantBySlug("SHR"), B: await tenantBySlug("OTHER") };
const dbA = scoped(ctxFrom({ tenant_id: tenants.A.id, role: "tenant_owner" }));
const dbB = scoped(ctxFrom({ tenant_id: tenants.B.id, role: "tenant_owner" }));
for (const t of ["shr_candidates", "shr_candidate_consents", "shr_jobs", "shr_applications", "shr_application_events"]) {
  const ra = await dbA.get(t), rb = await dbB.get(t);
  const idsA = new Set(ra.map((r) => r.id));
  ok(ra.length > 0 && rb.length > 0, `${t}: both tenants seeded (${ra.length}/${rb.length})`);
  ok(ra.every((r) => r.tenant_id === tenants.A.id) && rb.every((r) => r.tenant_id === tenants.B.id), `${t}: rows carry their own tenant_id`);
  ok(rb.every((r) => !idsA.has(r.id)), `${t}: nothing crosses over`);
}
ok((await dbA.get("shr_interviews")).length === 0 && (await dbB.get("shr_interviews")).length === 0, "shr_interviews: empty until used (checked below)");

const jobsA = (await get("jobs")).jobs, jobsB = (await get("jobs", {}, other)).jobs;
ok(jobsA.length === 3 && jobsB.length === 1 && !jobsA.some((j) => /آخر/.test(j.title)), "jobs listed per tenant");
const candA = (await get("candidates")).candidates, candB = (await get("candidates", {}, other)).candidates;
ok(candA.length === 20 && candB.length === 3, `candidates per tenant (${candA.length}/${candB.length})`);
ok(candA.every((c) => c.demo && /وهمي/.test(c.full_name) && /^DEMO-C-/.test(c.ref)), "every seeded candidate is explicitly marked demo");
ok(!candA.some((c) => "phone" in c || "email" in c || "id_no" in c || "id_no_hash" in c), "no identity, phone or email fields exist");
const idsA = new Set(candA.map((c) => c.id));
ok(candB.every((c) => !idsA.has(c.id)), "candidate ids isolated");
// Acting on another tenant's rows by id finds nothing.
const fJob = jobsB[0].id, fCand = candB[0].id;
const fApp = (await get("applications", {}, other)).applications[0];
ok((await post("job-close", { id: fJob })).status === 404, "close foreign job -> 404");
ok((await post("application-stage", { id: fApp.id, stage: "review" })).status === 404, "stage of foreign application -> 404");
ok((await post("application-create", { job_id: fJob, candidate_id: fCand })).status === 404, "application on foreign job/candidate -> 404");
ok((await post("application-create", { job_id: jobsA[0].id, candidate_id: fCand })).status === 404, "own job + foreign candidate -> 404");
ok((await post("interview-request", { application_id: fApp.id })).status === 404, "interview on foreign application -> 404");
ok((await get("candidate", { id: fCand })).error === "not_found", "foreign candidate profile -> not_found");
ok((await post("match", { job_id: fJob })).status === 404, "match on foreign job -> 404");
ok((await post("job-create", { title: "x y", tenant_id: "x" })).status === 400, "tenant_id in body -> 400");
ok((await get("jobs", { tenant_id: "x" })).error === "tenant_id_forbidden", "tenant_id in query refused");
ok((await get("applications", {}, other)).applications.length === 1 && (await get("applications")).applications.length === 7, "applications per tenant");

console.log("\n2. Interviews table isolation");
const appA = (await get("applications")).applications;
const showNew = appA.find((a) => a.stage === "new");
const ir = await post("interview-request", { application_id: showNew.id, mode: "video" });
ok(ir.status === 200 && ir.body.interview.state === "requested", "interview requested");
ok((await dbA.get("shr_interviews")).length === 1 && (await dbB.get("shr_interviews")).length === 0, "shr_interviews row visible only to its tenant");
ok((await post("interview-set", { id: ir.body.interview.id, scheduled_at: "2027-01-05T09:00:00Z" }, other)).status === 404, "foreign tenant cannot schedule it");
ok((await post("interview-set", { id: ir.body.interview.id, scheduled_at: "garbage" })).status === 400, "bad time refused");
ok((await post("interview-set", { id: ir.body.interview.id, scheduled_at: "2027-01-05T09:00:00Z", mode: "onsite", location: "مكتب تجريبي" })).body.interview.state === "scheduled", "interview scheduled (internal record only)");
ok((await post("interview-request", { application_id: showNew.id, mode: "fax" })).status === 400, "bad mode refused");
const rej = appA.find((a) => a.stage === "rejected");
ok((await post("interview-request", { application_id: rej.id })).status === 409, "no interview on a rejected application");

console.log("\n3. Jobs: create and close, no delete");
const mkJob = await post("job-create", { title: "فني سباكة — اختبار", profession: "سباك", city: "الرياض", experience_years: 3, residency_required: "transferable", skills: ["تمديدات صحية"], must_have: ["residency"], headcount: 2 });
ok(mkJob.status === 200 && mkJob.body.job.status === "open", "job created open");
ok((await post("job-create", { title: "" })).status === 400, "title required");
ok((await post("job-create", { title: "x y", residency_required: "maybe" })).status === 400, "bad residency_required refused");
ok((await post("job-create", { title: "x y", skills: "not-a-list" })).status === 400, "skills must be a list");
ok((await post("job-create", { title: "x y", client_company_id: "00000000-0000-4000-8000-000000000000" })).status === 404, "unknown client -> 404");
const cl = await post("job-close", { id: mkJob.body.job.id });
ok(cl.body.job.status === "closed", "job closed");
ok((await post("job-close", { id: mkJob.body.job.id })).body.job.status === "closed", "closing twice is a no-op");
ok((await post("job-delete", { id: mkJob.body.job.id })).status === 403 && (await post("application-delete", { id: fApp.id })).status === 403 && (await post("candidate-delete", { id: fCand })).status === 403, "job/application/candidate delete -> 403 archive_only");
ok((await get("jobs")).jobs.some((j) => j.id === mkJob.body.job.id && j.status === "closed"), "closed job still exists");
const nc = await post("application-create", { job_id: mkJob.body.job.id, candidate_id: candA[0].id });
ok(nc.status === 409 && nc.body.error === "job_closed", "no application on a closed job");

console.log("\n4. Consent gates applications and matching");
const byConsent = (k) => candA.filter((c) => c.consent === k);
ok(byConsent("active").length === 16 && byConsent("withdrawn").length === 2 && byConsent("none").length === 2, "seed has active/withdrawn/none consent");
const jobHvac = jobsA.find((j) => /تكييف/.test(j.title));
const noC = byConsent("none")[0], wd = byConsent("withdrawn")[0];
ok((await post("application-create", { job_id: jobHvac.id, candidate_id: noC.id })).body.error === "no_consent", "no consent record -> no application");
ok((await post("application-create", { job_id: jobHvac.id, candidate_id: wd.id })).body.error === "no_consent", "withdrawn consent -> no application");
const m = (await post("match", { job_id: jobHvac.id })).body;
const matched = new Set(m.results.map((r) => r.candidate.id));
ok(m.results.length === 16 && m.excluded.no_consent === 2 && m.excluded.withdrawn === 2, `match sees only consented candidates (${m.results.length}; excluded ${JSON.stringify(m.excluded)})`);
ok(!matched.has(noC.id) && !matched.has(wd.id), "candidates without active consent never appear in match results");
ok(m.results.every((r) => r.candidate.consent === "active"), "every matched candidate has active consent");
ok(m.results[0].candidate.profession === "فني تكييف" && m.results[0].overall >= 85, "best HVAC candidate first: " + m.results[0].candidate.full_name + " " + m.results[0].overall);
ok(m.results.every((r) => r.explain.length === 7 && r.summary), "every result carries an explanation");
ok(m.results.some((r) => r.unknown.length) && m.results.every((r) => r.category !== "must_have_miss"), "unknown data listed, nobody excluded by it");
const jobDrv = jobsA.find((j) => /سائق/.test(j.title));
const md = (await post("match", { job_id: jobDrv.id })).body;
ok(md.buckets.must_have_miss.length > 0 && md.results.length === 16, "must-have misses form their own bucket and stay listed");
ok(md.results.slice(-md.buckets.must_have_miss.length).every((r) => r.category === "must_have_miss"), "must-have bucket sorted last");
ok((await post("match", { job_id: jobHvac.id, weights: { profession: 50 } })).body.weights.profession === 50, "weights override accepted");
ok((await post("match", { job_id: jobHvac.id, weights: { bogus: 1 } })).status === 400, "unknown weight refused");
const okC = byConsent("active").find((c) => c.full_name.startsWith("مرشح تجريبي 4 "));
const cr = await post("application-create", { job_id: jobHvac.id, candidate_id: okC.id });
ok(cr.status === 200 && cr.body.application.stage === "new", "consented candidate can apply");
ok((await post("application-create", { job_id: jobHvac.id, candidate_id: okC.id })).body.error === "duplicate_application", "duplicate application refused");
const prof = await get("candidate", { id: okC.id });
ok(prof.consents.length === 1 && prof.applications[0].events[0].to_stage === "new", "profile shows consent log and event history");

console.log("\n5. Stage moves: events, unknown stages, maker-checker");
ok((await post("application-stage", { id: cr.body.application.id, stage: "bogus" })).status === 400, "unknown stage refused");
ok((await post("application-stage", { id: cr.body.application.id, stage: "new" })).body.error === "same_stage", "same stage refused");
ok((await post("application-stage", { id: "nope", stage: "review" })).status === 400, "bad id refused");
const s1 = await post("application-stage", { id: cr.body.application.id, stage: "shortlist", note: "ملاحظة" });
ok(s1.status === 200 && s1.body.application.from === "new", "new -> shortlist");
const ev = (await get("candidate", { id: okC.id })).applications[0].events;
ok(ev.length === 2 && ev[1].from_stage === "new" && ev[1].to_stage === "shortlist" && ev[1].note === "ملاحظة", "stage move wrote an event");
ok((await post("application-stage", { id: cr.body.application.id, stage: "hired" })).body.error === "offer_required", "cannot hire without an offer");
for (const st of ["interview", "offer"]) await post("application-stage", { id: cr.body.application.id, stage: st });
const self = await post("application-stage", { id: cr.body.application.id, stage: "hired" });
ok(self.status === 403 && self.body.error === "maker_checker", "who entered/proposed cannot approve the offer");
const appr = await post("application-stage", { id: cr.body.application.id, stage: "hired" }, owner);
ok(appr.status === 200 && appr.body.application.stage === "hired", "a different user approves the offer");
const rows = await dbA.get(`shr_applications?id=eq.${cr.body.application.id}`);
ok(rows[0].offer_approved_by && rows[0].offer_approved_by !== rows[0].created_by && rows[0].offer_approved_by !== rows[0].offer_proposed_by, "offer_approved_by differs from creator and proposer");
ok((await post("application-stage", { id: cr.body.application.id, stage: "review" }, owner)).body.error === "terminal_stage", "hired is terminal");
const log = await dbA.get(`shr_application_events?application_id=eq.${cr.body.application.id}`);
ok(log.length === 5 && log.every((e) => e.tenant_id === tenants.A.id), "full history kept (5 events)");
// owner proposes the offer; ops (a different user) approves
const seededOffer = appA.find((a) => a.stage === "offer");
ok((await post("application-stage", { id: seededOffer.id, stage: "hired" })).body.error === "maker_checker", "seeded offer entered by ops: ops cannot approve it");
ok((await post("application-stage", { id: seededOffer.id, stage: "hired" }, owner)).status === 200, "owner approves it");
const aud = await dbA.get("shr_audit_log?select=action");
ok(aud.some((x) => x.action === "application.stage.new->shortlist") && aud.some((x) => x.action === "job.create"), "writes are audited");

console.log("\n6. Roles and local-only");
ok((await call("GET", { action: "jobs" })).status === 401, "no session -> 401");
const client = await login("SHR", "client@shr.invalid");
ok(client.r.status === 403, "client_admin still refused");
process.env.LOCAL_DB = "0";
ok((await call("GET", { action: "jobs" }, ops.cookie)).status === 503, "refuses outside LOCAL_DB=1");
process.env.LOCAL_DB = "1";

await new Promise((r) => setTimeout(r, 150));   // let the debounced db write land
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
