// Business Development as a Service — the 14-day trial every registered client
// gets without buying anything.
//
// The clock is anchored to the organization's created_at, i.e. the moment they
// registered in the client portal. That matters: anchoring it to anything the
// browser holds (localStorage, a cookie, a first-visit stamp) means clearing
// site data hands out a fresh fortnight forever, so the trial would never
// actually end. The server owns the dates and the browser only renders them.
//
// Underscore-prefixed on purpose: Vercel turns every other file in api/ into a
// serverless function and the plan caps a deployment at 12. See api/README.md.

export const BD_TRIAL_DAYS = 14;

const DAY = 86400000;

/**
 * @param {{created_at?: string}|null} org  the organization from getSession
 * @param {boolean} hasPaidPlan            true when a confirmed subscription exists
 * @param {Date} [now]
 * @returns {{state: 'subscribed'|'trial'|'expired'|'unknown', days: number,
 *            startedAt: string|null, endsAt: string|null, totalDays: number}}
 */
export function bdTrial(org, hasPaidPlan, now = new Date()) {
  // A paying client is not on trial, whatever the dates say.
  if (hasPaidPlan) {
    return { state: "subscribed", days: 0, startedAt: null, endsAt: null, totalDays: BD_TRIAL_DAYS };
  }
  const startedAt = org && org.created_at ? new Date(org.created_at) : null;
  // No registration date means we cannot honestly claim a trial is running or
  // that it expired. Say so rather than guessing in either direction.
  if (!startedAt || isNaN(startedAt)) {
    return { state: "unknown", days: 0, startedAt: null, endsAt: null, totalDays: BD_TRIAL_DAYS };
  }
  const endsAt = new Date(startedAt.getTime() + BD_TRIAL_DAYS * DAY);
  const msLeft = endsAt.getTime() - now.getTime();
  // Ceil, so the final partial day still reads as "1 day left" rather than 0.
  const days = Math.max(0, Math.ceil(msLeft / DAY));
  return {
    state: msLeft > 0 ? "trial" : "expired",
    days,
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    totalDays: BD_TRIAL_DAYS,
  };
}

// The service was renamed to Business Development as a Service in 2026-08.
// Orders placed under the old name must keep counting as a paid plan, and the
// internal "revos-" product codes never changed.
export const BD_PLAN_NAME =
  /revenue\s*os|revos|bd\s*as\s*a\s*service|bdaas|business development as a service|تطوير الأعمال كخدمة/i;

/** Does this order represent a live paid subscription (not a trial)? */
export function isPaidBdOrder(o) {
  if (!o) return false;
  const hay = [o.title, o.ref, o.items, (o.subscriptions || []).map((s) => s.name).join(" ")].join(" ");
  if (!BD_PLAN_NAME.test(hay)) return false;
  return o.status === "مؤكد - قيد التنفيذ" || o.status === "مكتمل";
}
