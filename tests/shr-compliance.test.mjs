// SHR-HR: وحدة الامتثال على قاعدة JSON المحلية، من طرف إلى طرف.
// الحجب، maker-checker، لا موعد بلا تاريخ تبليغ، verified غير confirmed لا يظهر ولا يُفعَّل،
// عزل المستأجر لكل جدول جديد، رفض الأرقام النظامية غير المرجعية، الأدوار، الاستيراد المُبصَّم.
// Run: npm test
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-compliance-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
const { default: handler } = await import("../api/shr.js");
const { ctxFrom, scoped, tenantBySlug, hashIdNo } = await import("../api/_shr.js");
const R = await import("../api/_shr_ref.js");
const { redactViolationForClient } = await import("../api/_shr_compliance.js");

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REF = new URL("../db/shr-ref/", import.meta.url);
const refFile = (n) => JSON.parse(fs.readFileSync(new URL(n, REF), "utf8"));
const VR = refFile("violations_rules.json").rows, SR = refFile("objection_settlement_rules.json").rows;
const rule = (id) => VR.find((r) => r.rule_id === id);
const OBJ_DAYS = SR.find((r) => r.rule_id === "OBJ-1").days;
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().split("T")[0];
const dayOf = (n) => addDays(new Date().toISOString().split("T")[0], n);

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
const forge = (payload) => { const p = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url"); return { cookie: `${p}.${crypto.createHmac("sha256", SECRET).update(p).digest("base64url")}` }; };

const ops = await login("SHR", "ops@shr.invalid");
const owner = await login("SHR", "owner@shr.invalid");
const cmp = await login("SHR", "compliance@shr.invalid");
const oOps = await login("OTHER", "ops@other.invalid");
const oOwner = await login("OTHER", "owner@other.invalid");
const agA = await login("SHR", "agency-a@shr.invalid");
const tA = await tenantBySlug("SHR"), tB = await tenantBySlug("OTHER");
const dbA = scoped(ctxFrom({ tenant_id: tA.id, role: "tenant_owner" }));
const dbB = scoped(ctxFrom({ tenant_id: tB.id, role: "tenant_owner" }));
const usersA = await dbA.get("shr_users?select=id,email,role");
const uid = (e) => usersA.find((u) => u.email === e).id;
const audits = async () => (await dbA.get("shr_audit_log?select=action,actor,entity")).map((a) => a.action);

console.log("\n1. Seed, roles, and who is turned away");
ok(cmp.r.status === 200 && cmp.r.body.user.role === "compliance_officer" && cmp.r.body.demo === true, "compliance_officer logs in");
const dash = (await get("compliance-dashboard", {}, ops)).body;
const E = Object.fromEntries(dash.establishments.map((e) => [e.name_ar, e]));
const byState = (s) => dash.establishments.find((e) => e.state === s);
ok(dash.establishments.length === 4 && ["unknown", "clear", "restricted", "suspected"].every((s) => byState(s)), "4 establishments with 4 different restriction states");
ok(dash.disclaimer_ar === "لا نضمن إلغاء المخالفة" && dash.totals.blocked === 2, "fixed disclaimer; two blocked");
ok(dash.establishments.every((e) => /وهمي|تجريبية/.test(e.name_ar)), "demo names");
const estClear = byState("clear"), estRestr = byState("restricted"), estSusp = byState("suspected"), estUnk = byState("unknown");
ok(estClear.verified === true && estClear.computed && estClear.computed.estimate === true && estClear.declared_band, "clear establishment: verified, band is an estimate beside the declared one");
for (const a of ["workers", "dashboard", "jobs", "agencies", "orders", "candidates"]) ok((await get(a, {}, cmp)).status === 403, `compliance_officer cannot reach "${a}"`);
ok((await post("worker-create", { full_name: "x y" }, cmp)).status === 403, "compliance_officer cannot create workers");
ok((await get("session", {}, cmp)).status === 200, "...but has a session");
for (const a of ["compliance-dashboard", "compliance-violations", "compliance-alerts", "compliance-a33", "compliance-imports", "compliance-checklists"]) ok((await get(a, {}, agA)).status === 403, `agency refused: ${a}`);
ok((await post("violation-create", { establishment_id: estClear.id, authority: "x y", rule_id: "A-33" }, agA)).status === 403, "agency cannot write violations");
const clientU = usersA.find((u) => u.role === "client_admin");
const cC = forge({ sub: clientU.id, tenant_id: tA.id, role: "client_admin", email: clientU.email });
const cW = forge({ sub: crypto.randomUUID(), tenant_id: tA.id, role: "worker", email: "w@shr.invalid" });
for (const [who, name] of [[cC, "client_admin"], [cW, "worker"]]) {
  let all = true;
  for (const a of ["compliance-dashboard", "compliance-violations", "compliance-alerts", "compliance-establishment", "compliance-a33", "compliance-checklists"]) all = all && (await get(a, { id: estClear.id }, who)).status === 403;
  ok(all, `${name} (a validly signed session) sees no violations, no restriction state, nothing`);
}
ok((await post("violation-create", { establishment_id: estClear.id, authority: "x y", rule_id: "A-33" }, cC)).status === 403, "client cannot write either");
ok((await call("GET", { action: "compliance-dashboard" })).status === 401, "no cookie -> 401");

console.log("\n2. Blocking: restricted/suspected block orders and visa steps; unknown only warns");
const order = (est, who = ops) => post("order-create", { agency_id: "open", profession: "سباك", quantity: 1, establishment_id: est.id }, who);
const b1 = await order(estRestr);
ok(b1.status === 409 && b1.body.error === "establishment_blocked" && b1.body.state === "restricted" && /سبب/.test(b1.body.reason), "restricted -> 409 establishment_blocked with the reason");
const b2 = await order(estSusp);
ok(b2.status === 409 && b2.body.error === "establishment_blocked" && b2.body.state === "suspected" && b2.body.reason, "suspected -> 409 with the reason");
const o1 = await order(estClear);
ok(o1.status === 200 && o1.body.order.warnings.length === 0, "verified clear -> order created, no warning");
const o2 = await order(estUnk);
ok(o2.status === 200 && o2.body.order.warnings.includes("establishment_state_unknown"), "unknown -> order created WITH a warning");
ok((await dbA.get("shr_recruitment_orders?select=id,establishment_id")).filter((o) => o.establishment_id === estRestr.id || o.establishment_id === estSusp.id).length === 0, "no order row exists for the blocked establishments");
ok((await post("compliance-settings-update", { unknown_blocks: true }, ops)).status === 403, "an operator cannot change tenant settings");
ok((await post("compliance-settings-update", { unknown_blocks: true }, cmp)).status === 403, "...nor can the compliance officer");
ok((await post("compliance-settings-update", { unknown_blocks: "yes" }, owner)).status === 400 && (await post("compliance-settings-update", { expiry_alert_days: 0 }, owner)).status === 400 && (await post("compliance-settings-update", { made_up: 1 }, owner)).status === 400, "bad setting values and unknown keys refused");
ok((await post("compliance-settings-update", { unknown_blocks: true }, owner)).status === 200, "tenant_owner turns unknown_blocks on");
const o3 = await order(estUnk);
ok(o3.status === 409 && o3.body.error === "establishment_blocked" && /unknown_state/.test(o3.body.reason), "with the setting on, unknown blocks");
ok((await order(estClear)).status === 200, "clear still passes");
ok((await post("compliance-settings-update", { unknown_blocks: false }, owner)).status === 200 && (await order(estUnk)).status === 200, "back to warn-only");
// خطوات التأشيرة
const workers = await dbA.get("shr_workers?select=id,full_name,status&order=created_at.asc");
const w2 = workers.find((w) => /٢$/.test(w.full_name));
const w1 = workers.find((w) => /١$/.test(w.full_name));
const s0 = await post("procedure-step-create", { worker_id: w2.id, step: "visa" }, ops);
ok(s0.status === 200 && s0.body.step.warnings.includes("establishment_state_unknown"), "visa step for a worker at an unknown establishment: allowed with a warning");
await dbA.patch(`shr_assignments?worker_id=eq.${w2.id}`, { establishment_id: estRestr.id });
const s1 = await post("procedure-step-create", { worker_id: w2.id, step: "visa" }, ops);
ok(s1.status === 409 && s1.body.error === "establishment_blocked" && s1.body.state === "restricted", "visa step at a restricted establishment -> 409");
ok((await post("procedure-step-create", { worker_id: w2.id, step: "medical" }, ops)).status === 200, "a non-visa step is not blocked by default");
ok((await post("compliance-settings-update", { block_steps: ["visa", "medical"] }, owner)).status === 200 && (await post("procedure-step-create", { worker_id: w2.id, step: "medical" }, ops)).status === 409, "the blocked step list is a tenant setting");
ok((await post("compliance-settings-update", { block_steps: ["visa"] }, owner)).status === 200, "restored");
ok((await post("procedure-step-create", { worker_id: w2.id, step: "nonsense" }, ops)).status === 400 && (await post("procedure-step-create", { step: "visa" }, ops)).status === 400, "bad step / no subject refused");
await dbA.patch(`shr_assignments?worker_id=eq.${w2.id}`, { establishment_id: estUnk.id });

console.log("\n3. Snapshots: an unverified 'clear' cannot lift a restriction; whoever enters does not verify");
const snap1 = await post("establishment-compliance-record", { establishment_id: estRestr.id, restriction_state: "clear", source_note: "اختبار", as_of: dayOf(0) }, ops);
ok(snap1.status === 200 && snap1.body.snapshot.verified === false, "clear snapshot recorded, unverified");
const stillB = await order(estRestr);
ok(stillB.status === 409 && stillB.body.pending_clear_verification === true, "still blocked: lifting needs a verified snapshot");
const v1 = await post("establishment-compliance-verify", { snapshot_id: snap1.body.snapshot.id }, ops);
ok(v1.status === 403 && v1.body.error === "maker_checker", "the person who entered the snapshot cannot verify it");
ok((await post("establishment-compliance-verify", { snapshot_id: snap1.body.snapshot.id }, owner)).status === 200, "another user verifies");
ok((await post("establishment-compliance-verify", { snapshot_id: snap1.body.snapshot.id }, cmp)).status === 409, "already verified");
ok((await order(estRestr)).status === 200, "after verification the restriction is lifted");
ok((await post("establishment-compliance-record", { establishment_id: estRestr.id, restriction_state: "restricted", restriction_reason: "", as_of: dayOf(1) }, owner)).status === 400, "restricted needs a reason");
const re = await post("establishment-compliance-record", { establishment_id: estRestr.id, restriction_state: "restricted", restriction_reason: "سبب تجريبي (وهمي) جديد", as_of: dayOf(1) }, owner);
ok(re.status === 200 && (await order(estRestr)).status === 409, "an unverified restriction blocks at once (the safe direction)");
ok((await post("establishment-compliance-record", { establishment_id: estRestr.id, restriction_state: "restricted", restriction_reason: "x", computed_band: "platinum" }, owner)).status === 400, "computed fields cannot be supplied");
const sn = await post("establishment-compliance-record", { establishment_id: estClear.id, restriction_state: "clear", activity_rule_id: "NIT-30", saudi_count: 10, non_saudi_count: 30, declared_band: "platinum", declared_saudization_pct: 25, as_of: dayOf(2) }, owner);
ok(sn.status === 200, "snapshot with nitaqat inputs");
const stored = (await dbA.get(`shr_establishment_compliance?id=eq.${sn.body.snapshot.id}`))[0];
const act30 = refFile("nitaqat_bands.json").activities.find((a) => a.rule_id === "NIT-30");
ok(stored.computed_pct === 25 && stored.computed_basis && stored.computed_basis.estimate === true && stored.computed_basis.source_ref && stored.entered_by === uid("owner@shr.invalid") && stored.verified_by === null, "stored estimate carries its basis; entered_by recorded; unverified");
ok((await post("establishment-compliance-record", { establishment_id: estClear.id, restriction_state: "clear", activity_rule_id: "NIT-99", as_of: dayOf(2) }, owner)).status === 400, "unknown nitaqat activity refused");
const det = (await get("compliance-establishment", { id: estClear.id }, ops)).body;
ok(det.snapshots.length >= 2 && det.snapshots[0].computed && det.snapshots[0].computed.estimate === true && det.snapshots[0].computed.label_ar === "تقديري", "history lists snapshots, computed band labelled تقديري");
const checks = await post("compliance-run-checks", { establishment_id: estClear.id }, owner);
const band = checks.body.runs[0].results.find((r) => r.check_key === "band_consistency");
ok(checks.status === 200 && band.result === "warn" && band.detail.estimate === true && band.rule_ids.includes("NIT-30"), "declared band disagrees with the estimate -> warn (an estimate, with its rule)");
ok((await dbA.get("shr_compliance_checks?select=id")).length >= 5, "check results are stored");

console.log("\n4. Violations: amounts and deadlines only from the reference; no deadline without a notification date");
const cr = await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية (وهمي)", ref_no: "T-1", rule_id: "A-33", size_tier: "medium", persons_count: 2 }, ops);
const V = cr.body.violation;
ok(cr.status === 200 && V.status === "review" && V.fine_estimate.estimate === true && V.fine_estimate.amount_sar === rule("A-33").fine_sar.medium * 2, `fine estimate ${V.fine_estimate.amount_sar} = file value x 2`);
ok(V.fine_estimate.source_ref === rule("A-33").source_ref && V.fine_estimate.source_url === rule("A-33").source_url && V.fine_estimate.label_ar === "تقديري", "estimate carries its source and the label");
ok(V.objection.unavailable === "notification_date_required" && V.settlement.unavailable && V.payment.unavailable, "no notification date -> no objection, settlement or payment date");
let row = (await dbA.get(`shr_violations?id=eq.${V.id}`))[0];
ok(row.estimated_objection_deadline === null && row.objection_basis === null && row.notification_date === null && row.fine_estimate_sar === rule("A-33").fine_sar.medium * 2 && row.fine_source.estimate === true, "stored row: no deadline, but an amount with its source");
for (const f of ["violation_date", "inspection_date", "detection_date", "decision_date"]) {
  const x = await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية", rule_id: "A-33", [f]: "2026-01-01" }, ops);
  ok(x.status === 400 && x.body.error === "forbidden_deadline_input" && x.body.field === f, `${f} cannot drive a deadline`);
}
ok((await post("violation-notify", { id: V.id, decision_date: "2026-01-01", notification_date: dayOf(-5) }, ops)).status === 400, "...also refused on violation-notify");
for (const f of ["fine_sar", "amount_sar", "fine_estimate_sar", "days", "objection_days", "objection_deadline", "estimated_objection_deadline", "reduction_pct", "discount", "deadline", "computed_pct"]) {
  const x = await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية", rule_id: "A-33", [f]: 1 }, ops);
  ok(x.status === 400 && x.body.error === "regulatory_figure_not_allowed", `a client-supplied ${f} is refused`);
}
ok((await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية", rule_id: "A-999" }, ops)).body.error === "unknown_rule", "a rule that is not in the reference is refused");
ok((await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية", rule_id: "A-33", size_tier: "huge" }, ops)).body.error === "tier_unknown", "a tier that is not in the reference row is refused");
ok((await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية", rule_id: "A-33", persons_count: 0 }, ops)).status === 400, "persons_count >= 1");
ok((await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية", rule_id: "A-33", notification_date: "2999-01-01" }, ops)).body.error === "notification_in_future", "a future notification date is refused");
ok((await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية (وهمي)", ref_no: "T-1", rule_id: "A-34" }, ops)).status === 409, "duplicate (authority, ref_no) refused");
const nt = dayOf(-10);
const nr = await post("violation-notify", { id: V.id, notification_date: nt }, ops);
ok(nr.status === 200 && nr.body.violation.objection.deadline === addDays(nt, OBJ_DAYS) && nr.body.violation.objection.estimate === true, `deadline = notification + ${OBJ_DAYS} days (from OBJ-1)`);
ok(nr.body.violation.objection.source_ref === SR.find((r) => r.rule_id === "OBJ-1").source_ref, "the deadline names its source");
ok(nr.body.violation.settlement.deadline === addDays(nt, SR.find((r) => r.rule_id === "SET-1").days) && nr.body.violation.settlement.days !== nr.body.violation.objection.days, "settlement window is a different number");
row = (await dbA.get(`shr_violations?id=eq.${V.id}`))[0];
ok(row.estimated_objection_deadline === addDays(nt, OBJ_DAYS) && row.notification_entered_by === uid("ops@shr.invalid") && row.objection_basis.anchor === "notification_date", "stored: deadline + who entered the notification date");
ok(!JSON.stringify(nr.body).includes("reduction") && !/"80"/.test(JSON.stringify(nr.body)), "no discount is offered as a right");

console.log("\n5. Maker-checker and the five statuses");
const rv0 = await post("violation-status", { id: V.id, status: "objection_eligibility_study" }, owner);
ok(rv0.status === 409 && rv0.body.error === "review_required", "no progress before a second person reviews");
const rv1 = await post("violation-review", { id: V.id }, ops);
ok(rv1.status === 403 && rv1.body.error === "maker_checker", "the person who entered the violation cannot review it");
ok((await post("violation-review", { id: V.id }, owner)).status === 200 && (await post("violation-review", { id: V.id }, cmp)).status === 409, "a different user reviews (once)");
row = (await dbA.get(`shr_violations?id=eq.${V.id}`))[0];
ok(row.reviewed_by === uid("owner@shr.invalid") && row.reviewed_by !== row.entered_by, "reviewed_by differs from entered_by");
ok((await post("violation-status", { id: V.id, status: "preparation" }, owner)).body.error === "bad_transition", "no skipping a status");
ok((await post("violation-status", { id: V.id, status: "cancelled" }, owner)).status === 400 && (await post("violation-status", { id: V.id, status: "raised_successfully" }, owner)).status === 400, "there is no 'cancelled' or 'raised successfully'");
ok((await post("violation-status", { id: V.id, status: "objection_eligibility_study" }, owner)).status === 200, "review -> eligibility study");
ok((await post("violation-status", { id: V.id, status: "preparation" }, ops)).status === 200, "-> preparation");
const sub1 = await post("violation-status", { id: V.id, status: "submission" }, owner);
ok(sub1.status === 403 && sub1.body.error === "compliance_officer_required", "owner cannot move a case to «تقديم»");
ok((await post("violation-status", { id: V.id, status: "submission" }, ops)).status === 403, "nor can an operator");
const sub2 = await post("violation-status", { id: V.id, status: "submission" }, cmp);
ok(sub2.status === 200 && sub2.body.violation.status === "submission", "compliance_officer moves it to «تقديم»");
ok((await post("violation-status", { id: V.id, status: "preparation" }, owner)).status === 403, "and only the officer moves it out of «تقديم»");
ok((await post("violation-status", { id: V.id, status: "follow_up" }, cmp)).status === 200, "-> follow_up (متابعة)");
const act = await audits();
ok(["violation.create:A-33", "violation.review", "violation.status.review->objection_eligibility_study", "violation.status.objection_eligibility_study->preparation", "violation.status.preparation->submission", "violation.status.submission->follow_up", "establishment.compliance.verify:clear"].every((a) => act.includes(a)), "every state change wrote shr_audit_log");
ok((await post("violation-paid", { id: V.id, paid_state: "paid" }, ops)).status === 200 && (await post("violation-paid", { id: V.id, paid_state: "refunded" }, ops)).status === 400 && (await post("violation-paid", { id: V.id, paid_state: "paid" }, ops)).status === 409, "paid_state: known values only, recorded, audited");
ok((await audits()).includes("violation.paid.unknown->paid"), "paid change audited");
const list = (await get("compliance-violations", {}, ops)).body;
ok(list.violations.length >= 6 && list.statuses.map((s) => s.label_ar).join("|") === "مراجعة|دراسة أهلية الاعتراض|تجهيز|تقديم|متابعة", "list serves the five statuses");
ok(!/ملغاة|مرفوعة بنجاح|إلغاء المخالفة مضمون/.test(JSON.stringify(list)) && list.disclaimer_ar === "لا نضمن إلغاء المخالفة", "no cancellation promise anywhere; disclaimer present");
ok(!JSON.stringify(list).includes("id_no_hash"), "no fingerprints in the list");

console.log("\n6. Alerts: thresholds from tenant settings; no deadline alert without a notification date");
const al = (await get("compliance-alerts", {}, ops)).body;
const kinds = new Set(al.alerts.map((a) => a.kind));
ok(["document_expired", "document_expiring", "objection_deadline_near", "objection_deadline_passed", "notification_date_missing", "establishment_blocked", "a33_unresolved"].every((k) => kinds.has(k)), "all alert kinds present in the demo: " + [...kinds].join(","));
ok(al.alerts.filter((a) => a.kind.startsWith("objection_")).every((a) => a.estimated === true && a.label_ar && a.due), "deadline alerts are estimates with a label");
ok(al.alerts.filter((a) => a.kind === "notification_date_missing").every((a) => !a.due), "no date alert for a violation without a notification date");
const days60 = al.alerts.filter((a) => a.kind === "document_expiring").length;
ok((await post("compliance-settings-update", { expiry_alert_days: 400 }, owner)).status === 400, "threshold bounds enforced");
ok((await post("compliance-settings-update", { expiry_alert_days: 10 }, owner)).status === 200, "owner shortens the expiry threshold");
const days10 = (await get("compliance-alerts", {}, ops)).body.alerts.filter((a) => a.kind === "document_expiring").length;
ok(days10 < days60, `fewer expiry alerts with a shorter threshold (${days60} -> ${days10})`);
ok((await post("compliance-settings-update", { expiry_alert_days: 365 }, owner)).status === 200 && (await get("compliance-alerts", {}, ops)).body.alerts.filter((a) => a.kind === "document_expiring").length > days60, "...and more with a longer one");
await post("compliance-settings-update", { expiry_alert_days: 60 }, owner);

console.log("\n7. verified != confirmed: operator sees «غير مؤكد من المصدر»; nothing is enabled; client never");
const probe = await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية (وهمي)", ref_no: "T-UNC", rule_id: "A-34", size_tier: "small", persons_count: 3, notification_date: dayOf(-3) }, ops);
const pid = probe.body.violation.id;
const before = (await get("compliance-violations", {}, ops)).body.violations.find((v) => v.id === pid);
ok(before.fine_estimate.estimate && before.objection.deadline && before.rule.usable, "confirmed: amount and deadline present");
R.__setRef((() => { const raw = R.rawRefClone(); raw.violations.rows.find((r) => r.rule_id === "A-34").verified = "reader_only"; raw.settlement.rows.find((r) => r.rule_id === "OBJ-1").verified = "reader_only"; return raw; })());
try {
  const lv = (await get("compliance-violations", {}, ops)).body.violations.find((v) => v.id === pid);
  ok(lv.rule.usable === false && lv.rule.label_ar === "غير مؤكد من المصدر", "operator sees the «غير مؤكد من المصدر» label");
  ok(lv.fine_estimate.unavailable === "rule_unconfirmed" && lv.fine_estimate.amount_sar === undefined, "the unconfirmed rule yields no amount");
  ok(lv.objection.unavailable === "rule_unconfirmed" && lv.objection.deadline === undefined, "OBJ-1 unconfirmed -> no deadline at all");
  const al2 = (await get("compliance-alerts", {}, ops)).body.alerts;
  ok(!al2.some((a) => a.kind.startsWith("objection_")), "no deadline alert fires from an unconfirmed rule");
  ok((await get("compliance-dashboard", {}, ops)).body.establishments.some((e) => e.unconfirmed_rules >= 1), "dashboard counts unconfirmed rules");
  const mk = await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية (وهمي)", ref_no: "T-UNC2", rule_id: "A-34", size_tier: "small", persons_count: 1, notification_date: dayOf(-3) }, ops);
  const stored2 = (await dbA.get(`shr_violations?id=eq.${mk.body.violation.id}`))[0];
  ok(mk.status === 200 && stored2.fine_estimate_sar === null && stored2.fine_source === null && stored2.estimated_objection_deadline === null && stored2.rule_verified === "reader_only", "recording is allowed; no amount or deadline is stored from an unconfirmed rule");
  const tpl = (await get("compliance-checklists", { subject_kind: "worker", subject_id: w1.id }, ops)).body.checklists.find((c) => c.key === "worker_activation");
  const item = tpl.items.find((i) => i.rule_id === "A-34");
  ok(item.active === false && item.label_ar === "غير مؤكد من المصدر", "a checklist item bound to the rule is disabled and labelled");
  const t = await post("checklist-tick", { item_id: item.id, subject_kind: "worker", subject_id: w1.id, done: true }, ops);
  ok(t.status === 409 && t.body.error === "rule_unconfirmed", "...and cannot be ticked");
  ok(redactViolationForClient(lv) === null, "a client copy of it is never produced");
} finally { R.__setRef(null); }
const back = (await get("compliance-violations", {}, ops)).body.violations.find((v) => v.id === pid);
ok(back.fine_estimate.estimate && back.objection.deadline, "reference restored: the numbers are back");
ok(redactViolationForClient({ ...back, reviewed_by: uid("owner@shr.invalid") }) !== null && redactViolationForClient(back) === null, "a client copy exists only for a confirmed AND reviewed violation");
const stI = (await get("compliance-checklists", { subject_kind: "establishment", subject_id: estClear.id }, ops)).body.checklists.find((c) => c.key === "est_readiness");
ok(stI.items.find((i) => i.rule_id === "CH-1").active === false && stI.items.find((i) => i.rule_id === "A-28").active === true, "CH-1 (reader_only in the shipped file) is inactive; confirmed items are active");
R.__setRef((() => { const raw = R.rawRefClone(); raw.statuses.verified = "unverified"; return raw; })());
try { ok((await post("violation-create", { establishment_id: estClear.id, authority: "جهة تجريبية", rule_id: "A-33" }, ops)).body.error === "statuses_unconfirmed", "statuses unconfirmed -> no case is opened"); } finally { R.__setRef(null); }
R.__setRef((() => { const raw = R.rawRefClone(); raw.nitaqat.activities.find((a) => a.rule_id === "NIT-30").verified = "reader_only"; return raw; })());
try {
  const s2 = await post("establishment-compliance-record", { establishment_id: estClear.id, restriction_state: "clear", activity_rule_id: "NIT-30", saudi_count: 5, non_saudi_count: 5, declared_band: "red", as_of: dayOf(3) }, owner);
  const st2 = (await dbA.get(`shr_establishment_compliance?id=eq.${s2.body.snapshot.id}`))[0];
  ok(s2.status === 200 && st2.computed_pct === null && st2.computed_band === null, "unconfirmed nitaqat activity: no estimate is stored");
} finally { R.__setRef(null); }

console.log("\n8. A33: classification, a second approver, and the activation gate");
const mkA = (b) => post("a33-add", { establishment_id: estRestr.id, list_ref: "T-LIST", ...b }, ops);
const wid = crypto.randomUUID();
const rawId = "DEMO-RAW-ID-777";
ok((await mkA({ alias: "اسم بلا وسم", id_no: rawId })).body.error === "demo_alias_required", "an alias without «(وهمي)» is refused (no real names)");
ok((await mkA({ alias: "اسم (وهمي)", id_no: rawId, full_name: "اسم حقيقي" })).body.error === "field_not_allowed" && (await mkA({ alias: "اسم (وهمي)", id_no: rawId, email: "a@b.c" })).body.error === "field_not_allowed", "name/contact fields refused");
const n1 = await mkA({ alias: "اسم اختبار ١ (وهمي)", id_no: rawId });
ok(n1.status === 200, "name added");
ok((await mkA({ alias: "اسم اختبار ٩ (وهمي)", id_no: rawId })).status === 409, "same fingerprint twice in a list refused");
const n2 = await mkA({ alias: "اسم اختبار ٢ (وهمي)", id_no: "DEMO-RAW-ID-778" });
const rowN = (await dbA.get(`shr_a33_names?id=eq.${n1.body.name.id}`))[0];
ok(rowN.id_no_hash === hashIdNo(tA.id, rawId) && rowN.id_no_hash.length === 64 && !JSON.stringify(rowN).includes(rawId), "identity stored as a fingerprint only");
ok(!JSON.stringify((await get("compliance-a33", {}, ops)).body).includes(rowN.id_no_hash), "fingerprints never leave the server");
ok((await post("a33-approve", { id: n1.body.name.id }, owner)).body.error === "not_classified", "cannot approve an unclassified name");
ok((await post("a33-classify", { id: n1.body.name.id, classification: "maybe" }, ops)).body.error === "bad_classification", "only the three classes");
ok((await post("a33-classify", { id: n1.body.name.id, classification: "actual_worker" }, ops)).status === 200, "classified");
const sa = await post("a33-approve", { id: n1.body.name.id }, ops);
ok(sa.status === 403 && sa.body.error === "maker_checker", "the classifier cannot approve");
ok((await post("a33-approve", { id: n1.body.name.id }, owner)).status === 200, "a second reviewer approves");
ok((await post("a33-classify", { id: n1.body.name.id, classification: "not_a_worker" }, ops)).body.error === "already_approved", "no re-classifying after approval");
// عامل جاهز للتفعيل مرتبط بالقائمة
const wk = (await dbA.post("shr_workers", { full_name: "عامل اختبار A33 (وهمي)", nationality: "الهند", profession: "فني", id_kind: "iqama", id_no_hash: hashIdNo(tA.id, "DEMO-A33-W"), status: "draft", created_by: uid("ops@shr.invalid"), activated_by: null }))[0];
await dbA.post("shr_assignments", { worker_id: wk.id, establishment_id: estClear.id, client_company_id: (await dbA.get("shr_client_companies?select=id"))[0].id, profession: "فني", status: "draft" });
await dbA.post("shr_worker_documents", [{ worker_id: wk.id, kind: "work_contract", storage_key: "demo/x.pdf", expires_on: null }, { worker_id: wk.id, kind: "iqama", storage_key: "demo/y.pdf", expires_on: dayOf(300) }]);
const plain = (await dbA.post("shr_workers", { full_name: "عامل بلا A33 (وهمي)", id_kind: "iqama", id_no_hash: hashIdNo(tA.id, "DEMO-A33-PLAIN"), status: "draft", created_by: uid("ops@shr.invalid"), activated_by: null }))[0];
await dbA.post("shr_assignments", { worker_id: plain.id, establishment_id: estClear.id, client_company_id: (await dbA.get("shr_client_companies?select=id"))[0].id, profession: "فني", status: "draft" });
await dbA.post("shr_worker_documents", [{ worker_id: plain.id, kind: "work_contract", storage_key: "demo/p.pdf", expires_on: null }, { worker_id: plain.id, kind: "iqama", storage_key: "demo/q.pdf", expires_on: dayOf(300) }]);
ok((await post("worker-activate", { id: plain.id }, owner)).status === 200, "a worker with no A33 link activates normally");
const linked = await post("a33-add", { establishment_id: estRestr.id, list_ref: "T-LIST", alias: "اسم مرتبط (وهمي)", id_no: "DEMO-RAW-ID-779", worker_id: wk.id }, ops);
ok(linked.status === 200, "a name linked to the worker");
const blocked = await post("worker-activate", { id: wk.id }, owner);
ok(blocked.status === 409 && blocked.body.error === "a33_blocked" && blocked.body.reasons.some((r) => r.code === "a33_unresolved" && r.pending >= 2), "activation blocked while names in the list are unclassified/unapproved");
ok((await dbA.get(`shr_workers?id=eq.${wk.id}`))[0].status === "draft", "the worker stays draft");
for (const id of [n2.body.name.id, linked.body.name.id]) await post("a33-classify", { id, classification: "not_a_worker" }, ops);
ok((await post("worker-activate", { id: wk.id }, owner)).body.error === "a33_blocked", "classified but not yet approved: still blocked");
await post("a33-approve", { id: n2.body.name.id }, owner);
await post("a33-approve", { id: linked.body.name.id }, owner);
const nw = await post("worker-activate", { id: wk.id }, owner);
ok(nw.status === 409 && nw.body.reasons.some((r) => r.code === "a33_not_a_worker"), "everything approved, but the worker's own row says «not a worker»: still blocked");
await dbA.patch(`shr_a33_names?id=eq.${linked.body.name.id}`, { classification: "works_for_other" });
const okAct = await post("worker-activate", { id: wk.id }, owner);
ok(okAct.status === 200 && okAct.body.worker.status === "active", "classified + approved by a second reviewer + not excluded -> activation allowed");
const lists = (await get("compliance-a33", { list_ref: "T-LIST" }, ops)).body;
ok(lists.lists[0].complete === true && lists.lists[0].total === 3, "the list reports complete");

const wk2 = (await dbA.post("shr_workers", { full_name: "عامل اختبار A33 ب (وهمي)", id_kind: "iqama", id_no_hash: hashIdNo(tA.id, "DEMO-A33-W2"), status: "draft", created_by: uid("ops@shr.invalid"), activated_by: null }))[0];
await dbA.post("shr_assignments", { worker_id: wk2.id, establishment_id: estClear.id, client_company_id: (await dbA.get("shr_client_companies?select=id"))[0].id, profession: "فني", status: "draft" });
await dbA.post("shr_worker_documents", [{ worker_id: wk2.id, kind: "work_contract", storage_key: "demo/z.pdf", expires_on: null }, { worker_id: wk2.id, kind: "iqama", storage_key: "demo/zz.pdf", expires_on: dayOf(300) }]);
await post("a33-add", { establishment_id: estRestr.id, list_ref: "T-LIST-2", alias: "اسم ثانٍ (وهمي)", id_no: "DEMO-RAW-ID-780", worker_id: wk2.id }, ops);
ok((await post("worker-activate", { id: wk2.id }, owner)).body.error === "a33_blocked", "a second worker on a fresh unresolved list is blocked");
ok((await post("compliance-settings-update", { a33_gate: false }, owner)).status === 200 && (await post("worker-activate", { id: wk2.id }, owner)).status === 200, "the gate is a tenant setting (owner can switch it off)");
await post("compliance-settings-update", { a33_gate: true }, owner);
const seedWorker5 = workers.find((w) => /٥$/.test(w.full_name));
const sw = await post("worker-activate", { id: seedWorker5.id }, owner);
ok(sw.status === 409 && sw.body.error === "a33_blocked" && sw.body.reasons.some((r) => r.list_ref === "DEMO-A33-L1" && r.pending === 4 && r.total === 6), "the seeded worker linked to the seeded A33 list cannot be activated (4 of 6 names unresolved)");

console.log("\n9. Transfers: request, approval by someone else, audited");
const tr = (await get("compliance-transfers", {}, ops)).body.transfers;
ok(tr.length === 1 && tr[0].state === "requested", "one pending transfer in the demo");
const tid = tr[0].id;
const td = await post("transfer-decide", { id: tid, decision: "approve" }, ops);
ok(td.status === 403 && td.body.error === "maker_checker", "the requester cannot approve");
ok((await post("transfer-decide", { id: tid, decision: "maybe" }, owner)).status === 400, "bad decision refused");
const ap = await post("transfer-decide", { id: tid, decision: "approve" }, owner);
ok(ap.status === 200 && ap.body.transfer.state === "approved", "another user approves");
const asg1 = (await dbA.get(`shr_assignments?worker_id=eq.${w1.id}`))[0];
ok(asg1.establishment_id === estClear.id && asg1.transfer_approved_by === uid("owner@shr.invalid"), "the assignment moved and records the approver");
ok((await post("transfer-decide", { id: tid, decision: "reject" }, owner)).status === 409, "decided once");
const rq = await post("transfer-request", { worker_id: w1.id, to_establishment_id: estRestr.id, reason: "نقل تجريبي (وهمي)" }, ops);
ok(rq.status === 200 && rq.body.transfer.warnings.includes("destination_establishment_restricted"), "transfer request recorded; a restricted destination is only a warning (the transfer conditions are not in the reference, so nothing is blocked)");
ok((await post("transfer-request", { worker_id: w1.id, to_establishment_id: estUnk.id, reason: "ثانٍ" }, ops)).body.error === "transfer_pending", "one open request per worker");
ok((await post("transfer-request", { worker_id: w2.id, to_establishment_id: estUnk.id, reason: "نفسها" }, ops)).body.error === "same_establishment", "same establishment refused");
ok((await post("transfer-request", { worker_id: w2.id, to_establishment_id: estUnk.id, reason: "" }, ops)).status === 400, "reason required");
ok((await post("transfer-decide", { id: rq.body.transfer.id, decision: "reject", note: "اختبار" }, cmp)).body.transfer.state === "rejected", "rejection recorded");
ok((await dbA.get(`shr_assignments?worker_id=eq.${w1.id}`))[0].establishment_id === estClear.id, "a rejected transfer moves nothing");
const aud = await audits();
ok(["transfer.request", "transfer.approved", "transfer.rejected"].every((a) => aud.includes(a)), "transfer steps are in the audit log");

console.log("\n10. Imports: fingerprints only, uploaded -> matched -> reviewed -> applied");
const raw = "DEMO-PRIVATE-ID-123";
const period = new Date().toISOString().slice(0, 7);
const imp = await post("import-create", { kind: "gosi", label: "اختبار (وهمي)", rows: [
  { id_no: raw, period, status: "registered" }, { id_no: "ID-with-name", period, status: "registered", full_name: "اسم" },
  { id_no: "x", period, status: "registered" }, { id_no: "DEMO-Q-1", period: "bad", status: "registered" }, { id_no: "DEMO-Q-2", period, status: "weird" },
  { id_no: raw, period, status: "registered" }, { id_no: "DEMO-Q-3", period, status: "registered", phone: "0599900011" }] }, ops);
ok(imp.status === 200 && imp.body.batch.rows === 1, "the valid row is kept");
const errs = Object.fromEntries(imp.body.errors.map((e) => [e.line, e.error]));
ok(errs[2] === "row_field_not_allowed" && errs[3] === "id_no_required" && errs[4] === "bad_period" && errs[5] === "bad_status" && errs[6] === "duplicate_in_file" && errs[7] === "row_field_not_allowed", "each bad row is reported with its line; names and phones are refused");
await sleep(150);
const dbText = fs.readFileSync(path.join(dir, "db.json"), "utf8");
ok(!dbText.includes(raw) && !dbText.includes("ID-with-name") && !dbText.includes("0599900011"), "the raw id, the name and the phone appear nowhere in storage");
const irow = (await dbA.get(`shr_import_rows?batch_id=eq.${imp.body.batch.id}`))[0];
ok(irow.id_no_hash === hashIdNo(tA.id, raw) && !("full_name" in irow) && !("id_no" in irow), "the stored row is fingerprint + period + status");
const big = await post("import-create", { kind: "gosi", rows: Array.from({ length: 5000 }, (_, i) => ({ id_no: "DEMO-B-" + i, period, status: "registered" })) }, ops);
ok(big.status === 400 && big.body.error === "too_many_rows", "an oversized file is refused whole");
ok((await post("import-create", { kind: "bogus", rows: [{ id_no: "ab", period, status: "paid" }] }, ops)).status === 400 && (await post("import-create", { kind: "wps", rows: [] }, ops)).status === 400, "bad kind / empty refused");
const batches = (await get("compliance-imports", {}, ops)).body.batches;
const seeded = batches.find((b) => b.label && /تأمينات تجريبية/.test(b.label));
ok(seeded && seeded.state === "uploaded" && seeded.row_count === 6, "the seeded batch waits at «uploaded»");
ok((await post("import-review", { id: seeded.id }, owner)).body.error === "bad_transition", "cannot review before matching");
ok((await post("import-apply", { id: seeded.id }, owner)).body.error === "bad_transition", "cannot apply an unmatched batch");
const m = await post("import-match", { id: seeded.id }, ops);
ok(m.status === 200 && m.body.batch.state === "matched" && m.body.batch.matched === 5 && m.body.batch.unmatched === 1, "matching finds 5 workers by fingerprint, 1 unknown");
ok((await post("import-match", { id: seeded.id }, ops)).body.error === "bad_transition", "matching is not repeatable");
ok((await post("import-apply", { id: seeded.id }, owner)).body.error === "bad_transition", "cannot skip the review");
const rvb = await post("import-review", { id: seeded.id }, ops);
ok(rvb.status === 403 && rvb.body.error === "maker_checker", "the uploader cannot review");
ok((await post("import-review", { id: seeded.id }, owner)).status === 200, "another user reviews");
ok((await post("import-apply", { id: seeded.id }, ops)).status === 403, "the uploader cannot apply");
const gosiBefore = (await dbA.get("shr_worker_documents?kind=eq.gosi&select=id")).length;
const apl = await post("import-apply", { id: seeded.id }, owner);
ok(apl.status === 200 && apl.body.batch.state === "applied" && apl.body.batch.checks_written === 5 && apl.body.batch.documents_added === 4 && apl.body.batch.unmatched_skipped === 1, "applied: 5 checks, 4 documents, the unknown row skipped");
ok((await dbA.get("shr_worker_documents?kind=eq.gosi&select=id")).length === gosiBefore + 4, "gosi documents added");
ok((await post("import-apply", { id: seeded.id }, owner)).status === 409, "applied is final");
const detI = (await get("compliance-import", { id: seeded.id }, ops)).body;
ok(detI.rows.length === 6 && !JSON.stringify(detI).includes("id_no_hash") && detI.rows.filter((r) => r.applied).length === 5, "detail shows rows without fingerprints");
const aud2 = await audits();
ok(["import.state.uploaded->matched", "import.state.matched->reviewed", "import.state.reviewed->applied"].every((a) => aud2.includes(a)), "each import step is audited");

console.log("\n11. Checklists");
const cl = (await get("compliance-checklists", { subject_kind: "establishment", subject_id: estClear.id }, ops)).body.checklists;
ok(cl.length === 1 && cl[0].key === "est_readiness" && cl[0].audience === "staff", "scoped to the subject kind");
const need = cl[0].items.filter((i) => i.active && i.required);
ok(cl[0].required_remaining === need.length && need.length === 4 && cl[0].complete === false, "only active required items count (CH-1 does not)");
for (const i of need) ok((await post("checklist-tick", { item_id: i.id, subject_kind: "establishment", subject_id: estClear.id, done: true }, ops)).status === 200, `ticked: ${i.text_ar.slice(0, 30)}`);
const cl2 = (await get("compliance-checklists", { subject_kind: "establishment", subject_id: estClear.id }, ops)).body.checklists[0];
ok(cl2.complete === true && cl2.required_remaining === 0, "complete when every active required item is done");
await post("checklist-tick", { item_id: need[0].id, subject_kind: "establishment", subject_id: estClear.id, done: false }, owner);
ok((await get("compliance-checklists", { subject_kind: "establishment", subject_id: estClear.id }, ops)).body.checklists[0].complete === false, "the latest tick wins (append-only log)");
ok((await post("checklist-tick", { item_id: need[0].id, subject_kind: "worker", subject_id: w1.id, done: true }, ops)).body.error === "scope_mismatch", "an item cannot be ticked for the wrong kind of subject");
ok((await post("checklist-tick", { item_id: crypto.randomUUID(), subject_kind: "establishment", subject_id: estClear.id, done: true }, ops)).status === 404, "unknown item -> 404");
ok((await get("compliance-checklists", { subject_kind: "worker" }, ops)).body.checklists.map((c) => c.audience).sort().join() === "client,staff,worker", "staff see every audience's lists (including the client-audience one)");

console.log("\n12. Tenant isolation through the API, every new table");
const vA = (await get("compliance-violations", {}, ops)).body.violations, vB = (await get("compliance-violations", {}, oOps)).body.violations;
ok(vB.length === 1 && vA.length > 5 && vB.every((x) => !vA.some((y) => y.id === x.id)), `violations isolated (${vA.length}/${vB.length})`);
const dB = (await get("compliance-dashboard", {}, oOps)).body;
ok(dB.establishments.length === 3 && dB.establishments.every((e) => !/SHR/.test(e.name_ar)), "dashboard isolated");
const foreign = { est: estClear.id, viol: V.id, a33: n1.body.name.id, tr: tid, batch: seeded.id, snap: snap1.body.snapshot.id, item: need[0].id, worker: w1.id };
const fx = async (label, r) => ok(r.status === 404, `foreign ${label} -> 404 (got ${r.status})`);
await fx("establishment detail", await get("compliance-establishment", { id: foreign.est }, oOps));
await fx("violation-review", await post("violation-review", { id: foreign.viol }, oOwner));
await fx("violation-status", await post("violation-status", { id: foreign.viol, status: "objection_eligibility_study" }, oOwner));
await fx("violation-paid", await post("violation-paid", { id: foreign.viol, paid_state: "paid" }, oOps));
await fx("violation-notify", await post("violation-notify", { id: foreign.viol, notification_date: dayOf(-1) }, oOps));
await fx("violation-archive", await post("violation-archive", { id: foreign.viol }, oOps));
await fx("violation-create on a foreign establishment", await post("violation-create", { establishment_id: foreign.est, authority: "جهة", rule_id: "A-33" }, oOps));
await fx("snapshot record on a foreign establishment", await post("establishment-compliance-record", { establishment_id: foreign.est, restriction_state: "clear" }, oOps));
await fx("snapshot verify", await post("establishment-compliance-verify", { snapshot_id: foreign.snap }, oOwner));
await fx("a33-classify", await post("a33-classify", { id: foreign.a33, classification: "actual_worker" }, oOps));
await fx("a33-approve", await post("a33-approve", { id: foreign.a33 }, oOwner));
await fx("a33-add on a foreign establishment", await post("a33-add", { establishment_id: foreign.est, list_ref: "L1", alias: "اسم (وهمي)", id_no: "DEMO-1" }, oOps));
await fx("transfer-decide", await post("transfer-decide", { id: foreign.tr, decision: "approve" }, oOwner));
await fx("transfer-request for a foreign worker", await post("transfer-request", { worker_id: foreign.worker, to_establishment_id: (await dbB.get("shr_establishments?select=id"))[0].id, reason: "اختبار" }, oOps));
await fx("import-match", await post("import-match", { id: foreign.batch }, oOps));
await fx("import detail", await get("compliance-import", { id: foreign.batch }, oOps));
await fx("checklist-tick on a foreign item", await post("checklist-tick", { item_id: foreign.item, subject_kind: "establishment", subject_id: (await dbB.get("shr_establishments?select=id"))[0].id, done: true }, oOps));
await fx("procedure step for a foreign worker", await post("procedure-step-create", { worker_id: foreign.worker, step: "visa" }, oOps));
ok((await get("compliance-checklists", {}, oOps)).body.checklists.length === 2 && (await get("compliance-imports", {}, oOps)).body.batches.length === 0 && (await get("compliance-transfers", {}, oOps)).body.transfers.length === 0, "checklists/imports/transfers of SHR are invisible to the other tenant");
ok((await get("compliance-a33", {}, oOps)).body.names.every((n) => !/اسم تجريبي|اسم اختبار/.test(n.alias)), "A33 names isolated");
ok((await get("compliance-settings", {}, oOps)).body.settings.unknown_blocks === false, "settings are per tenant");
await post("compliance-settings-update", { unknown_blocks: true }, owner);
ok((await get("compliance-settings", {}, oOps)).body.settings.unknown_blocks === false && (await get("compliance-settings", {}, ops)).body.settings.unknown_blocks === true, "SHR's setting does not leak to the other tenant");
await post("compliance-settings-update", { unknown_blocks: false }, owner);
const oEst = (await dbB.get("shr_establishments?select=id,restriction_state,name_ar")).find((e) => e.restriction_state === "restricted");
const ob = await post("order-create", { agency_id: "open", profession: "نجّار", quantity: 1, establishment_id: oEst.id }, oOps);
ok(ob.status === 409 && ob.body.error === "establishment_blocked", "blocking works in the other tenant too");
const TABLES = ["shr_compliance_settings", "shr_establishment_compliance", "shr_violations", "shr_compliance_checks", "shr_checklist_templates", "shr_checklist_items", "shr_checklist_ticks", "shr_a33_names", "shr_worker_transfers", "shr_import_batches", "shr_import_rows", "shr_procedure_steps"];
for (const t of TABLES) {
  const a = await dbA.get(`${t}?select=id,tenant_id`), b = await dbB.get(`${t}?select=id,tenant_id`);
  ok(a.every((r) => r.tenant_id === tA.id) && b.every((r) => r.tenant_id === tB.id) && !a.some((r) => b.some((s) => s.id === r.id)), `${t}: rows pinned to their tenant (${a.length}/${b.length})`);
}

console.log("\n13. No delete: archive only");
for (const a of ["violation-delete", "a33-delete", "transfer-delete", "import-delete", "checklist-delete", "establishment-delete", "delete"]) ok((await post(a, { id: V.id }, ops)).status === 403, `${a} -> 403`);
ok((await post("violation-archive", { id: pid }, ops)).status === 200, "archive works");
ok(!(await get("compliance-violations", {}, ops)).body.violations.some((v) => v.id === pid) && (await dbA.get(`shr_violations?id=eq.${pid}`)).length === 1, "archived: gone from the list, still in the table");
ok((await post("violation-status", { id: pid, status: "objection_eligibility_study" }, owner)).status === 409, "an archived violation cannot move");
ok((await post("compliance-dashboard", {}, ops)).status === 404 && (await get("violation-create", {}, ops)).status === 404, "wrong method -> 404 unknown_action");

console.log("\n14. Local only");
process.env.LOCAL_DB = "0";
ok((await get("compliance-dashboard", {}, ops)).status === 503, "refuses outside LOCAL_DB=1");
process.env.LOCAL_DB = "1";

await sleep(100);
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
