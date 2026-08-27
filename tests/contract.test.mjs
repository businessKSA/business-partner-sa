// The contract a Business-Development-as-a-Service client signs must state the
// renewal price and the success fee. A one-off services contract for a monthly
// subscription is the wrong agreement, however well it renders — and the
// clause numbering is hand-written inside the clause bodies, so inserting a
// clause is exactly the kind of change that silently produces two "سابعاً" in
// a signed document. Both are pinned here.
//
// Run: npm test   (no dependencies, no browser)
//
// It lives in tests/, NOT api/: Vercel turns every non-underscore file under
// api/ into a serverless function, and the plan caps a deployment at 12 — which
// api/ is exactly at. A test file there fails the whole deploy.
import { contractHtml } from "../api/_docusign.js";
import { parseSubsFromNotes } from "../api/_suppliers.js";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

const base = {
  ref: "BP-1", clientName: "شركة تجريبية", service: "خدمة",
  lines: [{ name: "بند", qty: 1, price: 249 }],
  net: 249, vat: 37.35, total: 286.35, today: "2026-08-25",
};

console.log("\n1. The note written at checkout parses back into terms");
// Regression: this note is what the order handler writes. The parser used to
// slice it at the first "·" — but the terms themselves contain a "·", so every
// value came back cut in half and the parse silently returned nothing.
const notes =
  "طلب · تطوير الأعمال كخدمة — باقة Connect (أول شهر) ×1 · إجمالي 286.35 · " +
  "اشتراك شهري: تطوير الأعمال كخدمة — باقة Connect (أول شهر) (يتجدد 499 ﷼/شهر · عمولة 12%) · " +
  "المنشأة: شركة تجريبية";
const subs = parseSubsFromNotes(notes);
ok(subs.length === 1, "one subscription parsed");
ok(subs[0]?.renewsAt === 499, "renewal 499: " + subs[0]?.renewsAt);
ok(subs[0]?.commissionPercent === 12, "commission 12: " + subs[0]?.commissionPercent);

console.log("\n2. Subscription contract states renewal, fee and attribution");
const sub = contractHtml({ ...base, subscription: subs[0] });
ok(/مدة الاشتراك وتجديده وإنهاؤه/.test(sub), "has the subscription-term clause");
ok(/يتجدد الاشتراك تلقائياً/.test(sub) && /499 ﷼<\/b> شهرياً/.test(sub), "states the renewal price");
ok(/عمولة النجاح/.test(sub) && /12%<\/b>/.test(sub), "states the 12% success fee");
ok(/الصفقات المشمولة/.test(sub), "has the attribution clause");
ok(/لا تستحق العمولة على عقد موقّع لم يُحصّل/.test(sub), "excludes uncollected revenue");
ok(!/مدة التنفيذ/.test(sub), "drops the one-off delivery clause");

console.log("\n3. Clause ordinals stay correct and unique");
const ords = [...sub.matchAll(/<h2>([^:]+):/g)].map((m) => m[1]);
ok(new Set(ords).size === ords.length, "no duplicated ordinal: " + ords.join(" / "));
ok(ords[0] === "أولاً" && ords[3] === "رابعاً", "ordinals run in order");

console.log("\n4. Zero-commission package says so plainly");
const free = contractHtml({ ...base, subscription: { renewsAt: 5000, commissionPercent: 0 } });
ok(/لا تستحق على هذا الاشتراك أي عمولة/.test(free), "states no commission is ever due");
ok(!/الصفقات المشمولة/.test(free), "and omits the attribution clause it does not need");

console.log("\n5. A one-off service contract is unchanged");
const once = contractHtml({ ...base, leadTime: "5 أيام عمل" });
ok(/مدة التنفيذ/.test(once) && /5 أيام عمل/.test(once), "still has the delivery clause");
ok(!/عمولة النجاح/.test(once) && !/يتجدد الاشتراك/.test(once), "no subscription language leaks in");
const o2 = [...once.matchAll(/<h2>([^:]+):/g)].map((m) => m[1]);
ok(new Set(o2).size === o2.length && o2[o2.length - 1] === "تاسعاً",
  "nine clauses, last is تاسعاً: " + o2.join(" / "));

console.log(fail.length ? "\nFAILED: " + fail.length : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
