// The 30-day Business Development trial every registered client gets.
//
// Run: npm test
//
// The point of pinning this: the trial clock is the organization's created_at,
// not anything the browser holds. If that ever moves to localStorage or a
// first-visit stamp, clearing site data hands out a fresh trial forever and
// the trial silently stops being a trial. These cases fail loudly if it does.
import { bdTrial, isPaidBdOrder, BD_TRIAL_DAYS } from "../api/_trial.js";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

const NOW = new Date("2026-08-27T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

console.log("\n1. A client who registered today is on trial");
let t = bdTrial({ created_at: daysAgo(0) }, false, NOW);
ok(t.state === "trial", "state is trial: " + t.state);
ok(t.days === BD_TRIAL_DAYS, `${BD_TRIAL_DAYS} days left: ` + t.days);
ok(!!t.endsAt, "has an end date");

console.log("\n2. The clock runs down and then stops");
// Expressed against BD_TRIAL_DAYS, not against a number typed twice: changing
// the trial length should not silently turn these into assertions about
// nothing. A week in always leaves the length minus seven.
const week = bdTrial({ created_at: daysAgo(7) }, false, NOW);
ok(week.days === BD_TRIAL_DAYS - 7, `day 7 → ${BD_TRIAL_DAYS - 7} left: ` + week.days);
ok(bdTrial({ created_at: daysAgo(BD_TRIAL_DAYS - 0.5) }, false, NOW).days === 1, "last partial day still reads 1, not 0");
const over = bdTrial({ created_at: daysAgo(BD_TRIAL_DAYS + 1) }, false, NOW);
ok(over.state === "expired", `day ${BD_TRIAL_DAYS + 1} → expired: ` + over.state);
ok(over.days === 0, "no negative days: " + over.days);

console.log("\n3. A paying client is never 'on trial'");
const paid = bdTrial({ created_at: daysAgo(2) }, true, NOW);
ok(paid.state === "subscribed", "subscribed beats an unexpired trial: " + paid.state);
const paidLate = bdTrial({ created_at: daysAgo(500) }, true, NOW);
ok(paidLate.state === "subscribed", "and beats an expired one too: " + paidLate.state);

console.log("\n4. No registration date is admitted, not guessed");
// Guessing 'trial' here would give a free month to anyone whose org row is
// incomplete; guessing 'expired' would deny a legitimately new client. Neither
// is honest, so the dashboard is told we do not know.
for (const org of [null, {}, { created_at: "not a date" }]) {
  const u = bdTrial(org, false, NOW);
  ok(u.state === "unknown", "unknown for " + JSON.stringify(org) + ": " + u.state);
}

console.log("\n5. Only a confirmed subscription counts as paid");
const nameNew = "تطوير الأعمال كخدمة — باقة Connect (شهري)";
ok(isPaidBdOrder({ items: nameNew, status: "مؤكد - قيد التنفيذ" }), "confirmed counts");
ok(isPaidBdOrder({ items: nameNew, status: "مكتمل" }), "completed counts");
ok(!isPaidBdOrder({ items: nameNew, status: "قيد المراجعة" }), "under review does NOT — payment is unverified");
ok(!isPaidBdOrder({ items: nameNew, status: "ملغي" }), "cancelled does not");
ok(!isPaidBdOrder({ items: "عضوية الغرفة التجارية ×1", status: "مكتمل" }), "an unrelated service does not");
// Orders placed before the 2026-08 rename must keep counting.
ok(isPaidBdOrder({ items: "Revenue OS — باقة Growth (شهري)", status: "مكتمل" }), "the pre-rename name still counts");
ok(isPaidBdOrder({ subscriptions: [{ name: "BD as a Service — Launch" }], status: "مكتمل" }),
  "matched from the recorded subscription terms too");

console.log(fail.length ? "\nFAILED: " + fail.length : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
