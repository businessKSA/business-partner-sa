// SHR-HR: المرجع النظامي للامتثال. كل رقم من db/shr-ref وليس من الشيفرة؛ وما verified فيه غير confirmed لا يُفعَّل.
// نقي: لا قاعدة بيانات ولا خادم. Run: npm test
import fs from "node:fs";
import path from "node:path";
import * as R from "../api/_shr_ref.js";
import { NOT_FOUND, policy, redactViolationForClient, checklistVisibleTo, effectiveState } from "../api/_shr_compliance.js";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };
const REF = new URL("../db/shr-ref/", import.meta.url);
const file = (n) => JSON.parse(fs.readFileSync(new URL(n, REF), "utf8"));
const V = file("violations_rules.json"), S = file("objection_settlement_rules.json"), E = file("objection_estimate_rule.json"), N = file("nitaqat_bands.json");
const vrow = (id) => V.rows.find((r) => r.rule_id === id);
const srow = (id) => S.rows.find((r) => r.rule_id === id);
const withRef = (mut, fn) => { const raw = R.rawRefClone(); mut(raw); R.__setRef(raw); try { return fn(); } finally { R.__setRef(null); } };

console.log("\n1. Every reference row carries rule_id, source_url, verified");
for (const [name, rows] of [["violations", V.rows], ["settlement", S.rows], ["nitaqat", N.activities]]) {
  ok(rows.length > 0 && rows.every((r) => r.rule_id && r.source_url && r.verified), `${name}: ${rows.length} rows complete`);
}
ok(fs.readdirSync(new URL(".", REF)).every((f) => f.endsWith(".json")), "db/shr-ref holds JSON only (no src/dl/img/gen)");

console.log("\n2. Fine estimate comes from the table, not from code");
const a33 = vrow("A-33");
const f1 = R.estimateFine("A-33", "medium", 3);
ok(f1.ok && f1.estimate === true && f1.amount_sar === a33.fine_sar.medium * 3 && f1.unit_sar === a33.fine_sar.medium, `A-33 medium x3 = ${f1.amount_sar} (from the file)`);
ok(f1.source_url === a33.source_url && f1.source_ref === a33.source_ref && f1.verified === "confirmed" && f1.rule_id === "A-33", "carries its source");
const flat = vrow("A-28");
ok(R.estimateFine("A-28", "small", 7).amount_sar === flat.fine_sar.small, "flat multiplier ignores the count");
ok(R.estimateFine("A-33", "enormous", 2).reason === "tier_unknown", "tier must be a key of the reference row");
ok(R.estimateFine("A-33", "", 2).reason === "tier_required", "tier is entered by a human, never derived");
ok(R.estimateFine("A-33", "small", 0).reason === "count_required" && R.estimateFine("A-33", "small").reason === "count_required", "per_* needs a count");
ok(R.estimateFine("Z-1", "small", 1).reason === "unknown_rule", "unknown rule refused");
ok(R.estimateFine("A-26", "small", 2).caveats.includes("ambiguous_multiplier"), "ambiguous multiplier is flagged");
const ind = R.estimateFine("I-1", "first", 1);
ok(ind.ok && ind.amount_sar === vrow("I-1").fine_sar.first, "individual-tier rule keys come from the file too");

console.log("\n3. Objection deadline = notification date + days from OBJ-1, never from the violation date");
const days = srow("OBJ-1").days;
const d1 = R.objectionDeadline("2026-03-01");
ok(d1.ok && d1.estimate === true && d1.deadline === R.addDays("2026-03-01", days) && d1.days === days && d1.anchor === "notification_date", `2026-03-01 + ${days} = ${d1.deadline}`);
ok(d1.source_ref === srow("OBJ-1").source_ref && d1.label_ar === E.rule.output_label_ar, "carries source and the estimate label");
ok(R.objectionDeadline("").reason === "notification_date_required" && R.objectionDeadline(null).reason === "notification_date_required", "no notification date, no deadline");
ok(R.objectionDeadline("2026-13-45").reason === "bad_notification_date" && R.objectionDeadline("tomorrow").reason === "bad_notification_date", "malformed date refused");
ok(JSON.stringify(R.forbiddenDeadlineInputs()) === JSON.stringify(E.rule.forbidden_inputs) && R.forbiddenDeadlineInputs().includes("violation_date"), "forbidden inputs are the reference's own list");
ok(R.objectionDeadline.length === 1, "the only input is the notification date");
ok(R.deadlineEstimate("SET-1", "2026-03-01").days === srow("SET-1").days && srow("SET-1").days !== days, "settlement uses its own number (differs from objection)");
ok(R.deadlineEstimate("PAY-1", "2026-03-01").ok, "payment window from PAY-1");
ok(R.deadlineEstimate("SET-2", "2026-03-01").reason === "rule_not_a_window", "the discount rule is not a window and yields no date");
const cv = R.computeViolation({ rule_id: "A-33", size_tier: "medium", persons_count: 2, notification_date: null });
ok(cv.fine.ok && !cv.objection.ok && !cv.settlement.ok && !cv.payment.ok, "no notification date: fine yes, every deadline no");

console.log("\n4. verified != confirmed is never enabled");
withRef((raw) => { raw.violations.rows.find((r) => r.rule_id === "A-33").verified = "reader_only"; }, () => {
  const f = R.estimateFine("A-33", "medium", 3);
  ok(!f.ok && f.reason === "rule_unconfirmed" && f.label_ar === "غير مؤكد من المصدر", "unconfirmed fine row gives no amount");
  ok(R.ruleUsable("A-33") === false && R.describeRule("A-33").usable === false && R.describeRule("A-33").label_ar === R.UNCONFIRMED_LABEL_AR, "describeRule labels it for the operator");
  ok(R.estimateFine("A-34", "small", 1).ok, "other rows are unaffected");
});
withRef((raw) => { raw.settlement.rows.find((r) => r.rule_id === "OBJ-1").verified = "unverified"; }, () => {
  ok(R.objectionDeadline("2026-03-01").reason === "rule_unconfirmed", "OBJ-1 unconfirmed -> the estimate formula is not enabled");
  ok(!R.computeViolation({ rule_id: "A-33", size_tier: "small", persons_count: 1, notification_date: "2026-03-01" }).objection.ok, "computeViolation gives no deadline");
});
withRef((raw) => { raw.estimate.rule.enabled = false; }, () => ok(R.objectionDeadline("2026-03-01").reason === "rule_unconfirmed", "estimate rule enabled:false stays disabled"));
withRef((raw) => { raw.estimate.rule.verified = "reader_only"; }, () => ok(!R.objectionDeadline("2026-03-01").ok, "estimate rule itself unconfirmed -> disabled"));
withRef((raw) => { raw.violations.rows.find((r) => r.rule_id === "A-34").verified = "confirmed (partly, per researcher)"; }, () => ok(R.ruleUsable("A-34") === false, "a verified string that merely starts with 'confirmed' is NOT confirmed"));
withRef((raw) => { raw.statuses.verified = "unverified"; }, () => ok(R.caseStatuses().length === 0 && R.caseStatusKeys().length === 0, "statuses doc unconfirmed -> no statuses are served"));
withRef((raw) => { raw.nitaqat.activities.find((a) => a.rule_id === "NIT-30").verified = "reader_only"; }, () => ok(R.nitaqatEstimate({ activity_rule_id: "NIT-30", saudi: 10, non_saudi: 30, year: "2026" }).reason === "rule_unconfirmed", "unconfirmed activity gives no band"));
withRef((raw) => { raw.nitaqat._meta.formula.verified = "reader_only"; }, () => ok(R.nitaqatEstimate({ activity_rule_id: "NIT-30", saudi: 10, non_saudi: 30, year: "2026" }).reason === "rule_unconfirmed", "unconfirmed formula gives no band"));
ok(R.ruleUsable("CH-1") === false && R.describeRule("CH-1").label_ar === "غير مؤكد من المصدر", "CH-1 (reader_only in the file) is unconfirmed as shipped");
ok(R.ruleUsable("A-33") === true, "back to normal after the overrides");

console.log("\n5. Nitaqat: formula and thresholds from the file; wage weights stay off");
const act = N.activities.find((a) => a.rule_id === "NIT-30");
const est = R.nitaqatEstimate({ activity_rule_id: "NIT-30", saudi: 14, non_saudi: 36, year: "2026" });
const tot = 50, ln = Math.log(tot);
const want = (b) => Math.round((act.bands[b].m * ln + act.bands[b].c_2026) * 100) / 100;
ok(est.ok && est.estimate === true && est.total === tot && est.pct === 28, `pct = 14/50 = ${est.pct}`);
ok(["green_low", "green_mid", "green_high", "platinum"].every((b) => est.thresholds[b] === want(b)), "every threshold = m*ln(total)+c from the file");
const exp = (() => { let b = "red"; for (const k of ["green_low", "green_mid", "green_high", "platinum"]) if (est.pct >= want(k)) b = k; return b; })();
ok(est.band === exp, `band ${est.band} matches an independent computation`);
ok(est.caveats.includes("wage_weights_disabled") && N.counting_rules.enabled === false, "NIT-CNT-1 (enabled:false) is not applied: headcount only");
ok(est.band_ar === N._meta.band_names_ar[R.BAND_KEYS.indexOf(est.band)], "band name from the file");
ok(R.nitaqatEstimate({ activity_rule_id: "NIT-30", saudi: 14, non_saudi: 36, year: "2031" }).reason === "year_unknown", "a year the file lacks gives no band");
ok(R.nitaqatEstimate({ activity_rule_id: "NIT-30", saudi: 0, non_saudi: 0, year: "2026" }).reason === "no_workforce", "no workforce -> no estimate");
ok(R.nitaqatEstimate({ activity_rule_id: "NIT-999", saudi: 1, non_saudi: 1, year: "2026" }).reason === "unknown_activity", "unknown activity refused");
const odd = R.nitaqatEstimate({ activity_rule_id: "NIT-03", saudi: 1, non_saudi: 1, year: "2026" });
ok(odd.ok && odd.band === null && odd.caveats.includes("non_monotonic_thresholds"), "non-ascending source table: no band is invented");

console.log("\n6. Case statuses: exactly the five, none forbidden");
const keys = R.caseStatusKeys();
ok(JSON.stringify(keys) === JSON.stringify(["review", "objection_eligibility_study", "preparation", "submission", "follow_up"]), "five statuses in order: " + keys.join(","));
ok(R.caseStatuses().map((x) => x.label_ar).join("|") === "مراجعة|دراسة أهلية الاعتراض|تجهيز|تقديم|متابعة", "labels: مراجعة / دراسة أهلية الاعتراض / تجهيز / تقديم / متابعة");
ok(R.caseStatuses().find((x) => x.key === "submission").human_task === true, "submission is flagged as a human task");
const labels = R.caseStatuses().map((x) => x.label_ar).concat(R.caseStatuses().map((x) => x.meaning_ar)).join(" ");
ok(R.forbiddenStatusLabels().length > 0 && R.forbiddenStatusLabels().every((l) => !labels.includes(l)) && !/ملغاة|مرفوعة بنجاح/.test(labels), "no 'cancelled' or 'raised successfully' status");

console.log("\n7. What the UI may show");
const sum = R.refSummary();
const js = JSON.stringify(sum);
ok(!js.includes("SET-2") && !/reduction/i.test(js), "the 80% reduction is never exposed");
ok(sum.windows.map((w) => w.rule_id).join(",") === "OBJ-1,PAY-1,SET-1" && sum.windows.find((w) => w.rule_id === "SET-1").days !== sum.windows.find((w) => w.rule_id === "OBJ-1").days, "objection 60 and settlement 90 stay separate numbers");
ok(sum.disclaimer_ar === "لا نضمن إلغاء المخالفة", "fixed disclaimer");
ok(sum.not_found.length === file("not_found.json").items.length && sum.not_found.every((x) => x.item_ar && x.status), "not_found items are listed as not found, none filled in");
ok(Object.values(NOT_FOUND).every((v) => v === null || (Array.isArray(v) && v.length === 0)), "not_found constants stay empty (suspicion, transfer conditions, ajeer, wage ratio, day count)");

console.log("\n8. Policy: who sees what");
ok(policy("tenant_owner", {}, "compliance-violations") === "full" && policy("compliance_officer", {}, "compliance-alerts") === "full", "staff full");
for (const role of ["client_admin", "client_viewer", "worker", "agency"]) ok(policy(role, { client_visibility: false }, "compliance-violations") === "deny", `${role}: denied by default`);
ok(policy("client_admin", { client_visibility: true }, "compliance-violations") === "client", "client sees a redacted list only if the tenant opts in");
ok(policy("client_admin", { client_visibility: true }, "compliance-dashboard") === "deny", "...and never the dashboard or the establishment state");
ok(policy("worker", { client_visibility: true }, "compliance-violations") === "deny" && policy("agency", { client_visibility: true }, "compliance-violations") === "deny", "worker and agency never");
const good = { id: "x", kind_ar: "k", authority: "a", status: "review", status_label_ar: "مراجعة", paid_state: "unknown", reviewed_by: "u", entered_by: "e", rule: { usable: true }, fine_estimate: { estimate: true, amount_sar: 5, source_ref: "r" } };
ok(redactViolationForClient(good) && !("entered_by" in redactViolationForClient(good)) && !("reviewed_by" in redactViolationForClient(good)), "client copy carries no internal ids");
ok(redactViolationForClient({ ...good, rule: { usable: false } }) === null, "unconfirmed rule never reaches a client");
ok(redactViolationForClient({ ...good, reviewed_by: null }) === null, "unreviewed never reaches a client");
ok(checklistVisibleTo("worker", { audience: "worker" }) && !checklistVisibleTo("worker", { audience: "staff" }) && !checklistVisibleTo("agency", { audience: "client" }) && checklistVisibleTo("operator", { audience: "worker" }), "checklists: each role only its own audience; staff all");

console.log("\n9. Establishment state: an unverified 'clear' cannot lift a verified restriction");
const snap = (o) => ({ id: Math.random().toString(36), created_at: "2026-01-01T00:00:00.000Z", verified_by: null, verified_on: null, restriction_reason: null, ...o });
ok(effectiveState([]).state === "unknown" && effectiveState([], "clear").state === "unknown" && effectiveState([], "restricted").state === "restricted", "no snapshot: unknown (a legacy 'clear' is not trusted; a legacy restriction still blocks)");
ok(effectiveState([snap({ as_of: "2026-02-01", restriction_state: "clear" })]).state === "unknown", "unverified clear -> unknown");
ok(effectiveState([snap({ as_of: "2026-02-01", restriction_state: "clear", verified_by: "v", verified_on: "2026-02-02" })]).state === "clear", "verified clear -> clear");
ok(effectiveState([snap({ as_of: "2026-02-01", restriction_state: "restricted", restriction_reason: "r" })]).state === "restricted", "unverified restriction still blocks (safe direction)");
const lift = effectiveState([snap({ as_of: "2026-01-01", restriction_state: "restricted", restriction_reason: "r", verified_by: "v", verified_on: "2026-01-02" }), snap({ as_of: "2026-03-01", restriction_state: "clear" })]);
ok(lift.state === "restricted" && lift.pending_clear_verification === true, "newer unverified clear does not lift a verified restriction");
const lifted = effectiveState([snap({ as_of: "2026-01-01", restriction_state: "restricted", restriction_reason: "r", verified_by: "v", verified_on: "2026-01-02" }), snap({ as_of: "2026-03-01", restriction_state: "clear", verified_by: "w", verified_on: "2026-03-02" })]);
ok(lifted.state === "clear", "a verified clear lifts it");

console.log("\n10. No regulatory number in the logic (scanner proves itself on a planted fine)");
function numbersIn(v, out = new Set()) {
  if (typeof v === "number") out.add(v);
  else if (Array.isArray(v)) v.forEach((x) => numbersIn(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => numbersIn(x, out));
  return out;
}
const refNums = new Set();
for (const f of fs.readdirSync(new URL(".", REF))) numbersIn(file(f), refNums);
const stripCode = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1")
  .replace(/`(?:\\.|[^`\\])*`/g, "``").replace(/"(?:\\.|[^"\\\n])*"/g, '""').replace(/'(?:\\.|[^'\\\n])*'/g, "''")
  .replace(/(?<=[(=,:!&|?;{]\s*)\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\n\\\[])+\/[a-z]*/g, "/re/");
function regulatoryLiterals(src) {
  const hits = [];
  src.split("\n").forEach((line, i) => {
    if (/operational-default/.test(line)) return;                       // افتراض تشغيلي معلَن
    for (const m of stripCode(line).matchAll(/(?<![\w.$])\d+(?:\.\d+)?(?:e\d+)?(?![\w$])/g)) {
      const n = Number(m[0]);
      if (refNums.has(n) && (n >= 10 || !Number.isInteger(n))) hits.push(`${i + 1}: ${m[0]}`);
    }
  });
  return hits;
}
ok(refNums.has(8000) && refNums.has(60) && refNums.has(90) && refNums.has(0.58), "the scanner knows the reference numbers");
ok(regulatoryLiterals("const FINE = 8000;\nconst WINDOW = 60;").length === 2, "planted fine and window are caught");
ok(regulatoryLiterals("const FINE = 8000; // operational-default").length === 0, "the explicit operational marker is honoured");
ok(regulatoryLiterals('const s = "8000"; // 60\nconst r = /\\d{4}-\\d{2}/;').length === 0, "strings, comments and regex are not numbers");
const ROOT = new URL("..", import.meta.url).pathname;
for (const rel of ["api/_shr_ref.js", "api/_shr_compliance.js", "site/scripts/simple-v1-shr-compliance.mjs"]) {
  const hits = regulatoryLiterals(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  ok(hits.length === 0, `${rel}: no regulatory number literal` + (hits.length ? " -> " + hits.join(", ") : ""));
}

console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
