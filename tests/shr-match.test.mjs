// SHR-HR: محرك المطابقة (api/_shr_match.js) — وحدة نقية.
// Run: npm test
import fs from "node:fs";
import { matchComponents, scoreOne, runMatch, matchCategory, normalizeWeights, WEIGHT_DEFS, COMPONENT_KEYS, nz } from "../api/_shr_match.js";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };
const throws = (f) => { try { f(); return false; } catch { return true; } };

console.log("\n0. Pure module");
const src = fs.readFileSync(new URL("../api/_shr_match.js", import.meta.url), "utf8");
ok(!/^\s*import\s/m.test(src) && !/require\(/.test(src), "no imports");
ok(WEIGHT_DEFS.reduce((a, w) => a + w[2], 0) === 100, "default weights sum to 100");

const job = { profession: "فني تكييف", city: "الرياض", experience_years: 5, residency_required: "transferable", nationality_pref: [], skills: ["تركيب سبليت"], must_have: [] };
const full = { id: "c1", profession: "فني تكييف", nationality: "الهند", city: "الرياض", years_experience: 8, residency_transferable: "yes", notice_days: 10, skills: ["تركيب سبليت"] };

console.log("\n1. A fully matching candidate");
const a = scoreOne(job, full);
ok(a.overall >= 95 && a.category === "strong", "strong match: " + a.overall);
ok(a.components.nationality.status === "NA", "no nationality preference -> NA, not a signal");
ok(a.unknown.length === 0, "nothing unknown");
ok(Math.abs(a.explain.reduce((s, x) => s + x.contribution, 0) - a.overall) <= 1, "contributions add up to the score (±1 rounding)");
ok(a.explain.length === WEIGHT_DEFS.length && a.explain.every((x) => x.note), "every component explained");
ok(/الدرجة \d+ من 100/.test(a.summary), "summary sentence: " + a.summary);

console.log("\n2. UNKNOWN never disqualifies");
const sparse = { id: "c2", profession: "فني تكييف", nationality: "نيبال", city: "الرياض" };   // no years, residency, notice, skills
const b = scoreOne(job, sparse);
ok(b.overall != null && b.overall >= 90, "sparse but matching candidate still scores high: " + b.overall);
ok(b.category !== "must_have_miss" && b.category !== "weak", "not excluded: " + b.category);
ok(["قابلية نقل الإقامة", "الخبرة", "التوفر", "المهارات"].every((x) => b.unknown.includes(x)), "names what is unknown: " + b.unknown.join("، "));
ok(b.coverage < 100 && b.coverage > 0, "coverage reported: " + b.coverage);
ok(b.explain.filter((x) => x.status === "UNKNOWN").every((x) => !x.counted && x.contribution === 0), "unknown components carry no weight");
const empty = scoreOne(job, { id: "c3" });
ok(empty.overall === null && empty.category === "unscored", "all unknown -> unscored, still returned");
ok(scoreOne({}, {}).overall === null, "empty job and candidate do not throw");

console.log("\n3. Components");
const wrongTrade = matchComponents(job, { ...full, profession: "سائق" });
ok(wrongTrade.profession.status === "NO_MATCH" && wrongTrade.profession.score === 0, "different trade -> NO_MATCH");
ok(matchComponents(job, { ...full, residency_transferable: "no" }).residency.status === "NO_MATCH", "non-transferable residency -> NO_MATCH");
ok(matchComponents(job, { ...full, residency_transferable: "unknown" }).residency.status === "UNKNOWN", "unknown residency -> UNKNOWN");
ok(matchComponents({ ...job, residency_required: "any" }, { ...full, residency_transferable: "no" }).residency.status === "NA", "residency not required -> NA");
ok(matchComponents({ ...job, nationality_pref: ["باكستان"] }, full).nationality.status === "NO_MATCH", "outside nationality preference -> NO_MATCH");
ok(matchComponents({ ...job, nationality_pref: ["الهند"] }, full).nationality.status === "MATCH", "inside nationality preference -> MATCH");
ok(matchComponents(job, { ...full, city: "جدة" }).location.status === "PARTIAL_MATCH", "other city -> PARTIAL");
ok(matchComponents(job, { ...full, city: "جدة", willing_to_relocate: false }).location.status === "NO_MATCH", "refuses relocation -> NO_MATCH");
ok(matchComponents(job, { ...full, years_experience: 4 }).experience.status === "PARTIAL_MATCH", "1 year short -> PARTIAL");
ok(matchComponents(job, { ...full, years_experience: 1 }).experience.status === "NO_MATCH", "4 years short -> NO_MATCH");
ok(matchComponents({ ...job, start_within_days: 7 }, { ...full, notice_days: 30 }).availability.status === "PARTIAL_MATCH", "slower than needed start -> PARTIAL");
ok(nz("الرِّياض") === nz("الرياض") && nz("محاسبة") === nz("محاسبه"), "Arabic normalization");
ok(matchComponents({ ...job, city: "الريـاض" }, full).location.status === "MATCH", "tatweel does not split a city");

console.log("\n4. MUST_HAVE goes to its own bucket");
const must = { ...job, must_have: ["residency", "لحام أرجون"] };
const pool = [
  full,
  { ...full, id: "c4", residency_transferable: "no" },                                   // fails residency
  { ...full, id: "c5", skills: ["أعمال خشب"] },                                          // fails the skill must-have
  { ...full, id: "c6", residency_transferable: null, skills: [] },                       // unknown -> never excluded
  { ...full, id: "c7", skills: ["لحام أرجون"], residency_transferable: "yes" },          // satisfies both
];
const run = runMatch(must, pool);
ok(run.buckets.must_have_miss.sort().join() === "c1,c4,c5", "must-have failures: " + run.buckets.must_have_miss);
ok(!run.buckets.must_have_miss.includes("c6"), "unknown must-have data does not exclude");
ok(run.results.length === pool.length, "nobody is dropped");
const last = run.results.slice(-run.buckets.must_have_miss.length).map((r) => r.category);
ok(last.every((c) => c === "must_have_miss"), "separate category sorted after the rest");
const c4 = run.results.find((r) => r.candidate_id === "c4");
ok(c4.must_have_missing.includes("قابلية نقل الإقامة") && /شرط إلزامي/.test(c4.summary), "explains the missing must-have");
ok(run.results.find((r) => r.candidate_id === "c6").must_have_unknown.length > 0, "unknown must-have is noted, not punished");

console.log("\n5. Ranking and weights");
const ranked = runMatch(job, [{ ...full, id: "lo", years_experience: 1, city: "جدة" }, full, sparse]).results;
ok(ranked[0].candidate_id === "c1" && ranked.every((r, i) => i === 0 || (ranked[i - 1].overall ?? -1) >= (r.overall ?? -1)), "sorted by score descending");
const hv = scoreOne(job, { ...full, profession: "سائق" }, { profession: 0 });
ok(hv.overall > scoreOne(job, { ...full, profession: "سائق" }).overall, "zero weight removes a component from the score");
ok(throws(() => normalizeWeights({ nope: 5 })) && throws(() => normalizeWeights({ profession: -1 })) && throws(() => normalizeWeights({ profession: "x" })), "bad weights throw");
ok(matchCategory(90) === "strong" && matchCategory(75) === "good" && matchCategory(55) === "review" && matchCategory(10) === "weak" && matchCategory(null) === "unscored" && matchCategory(99, ["x"]) === "must_have_miss", "category thresholds");
ok(COMPONENT_KEYS.length === 7, "seven EOR components");
ok(JSON.stringify(runMatch(job, pool)) === JSON.stringify(runMatch(job, pool)), "deterministic");

console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
