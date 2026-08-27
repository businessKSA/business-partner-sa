// Unit tests for the commission engine behind برنامج السماسرة والإحالات
// (api/_referrals.js). The engine is pure on purpose: every model the owner
// panel offers is settled here, with no database and no network.
import test from "node:test";
import assert from "node:assert/strict";
import { commissionFor, tierRateFor, normalizePlan, totalsFor, planSentence, dedupeKey, normPhone, roundMoney } from "../api/_referrals.js";

const firstInvoice = { model: "first_invoice_pct", rate: 10 };
const recurring = { model: "recurring_pct", rate: 5, recurring_months: 3 };
const forever = { model: "recurring_pct", rate: 5, recurring_months: 0 };
const flat = { model: "flat", flat_amount: 500 };
const tiered = { model: "tiered", tiers: [{ upTo: 10000, rate: 5 }, { upTo: 50000, rate: 8 }, { upTo: null, rate: 12 }] };

/* ----------------------------------------------------------- percentages -- */
test("first-invoice plan pays once, on the first payment only", () => {
  assert.equal(commissionFor(firstInvoice, { dealValue: 12000 }).amount, 1200);
  assert.equal(commissionFor(firstInvoice, { dealValue: 12000 }).kind, "first_invoice");
  assert.equal(commissionFor(firstInvoice, { dealValue: 12000, periodIndex: 1 }), null);
});

test("recurring plan pays every period until the window closes", () => {
  assert.equal(commissionFor(recurring, { dealValue: 1000, periodIndex: 0 }).amount, 50);
  assert.equal(commissionFor(recurring, { dealValue: 1000, periodIndex: 1 }).kind, "recurring");
  assert.equal(commissionFor(recurring, { dealValue: 1000, periodIndex: 2 }).amount, 50);
  assert.equal(commissionFor(recurring, { dealValue: 1000, periodIndex: 3 }), null, "month 4 is outside a 3-month window");
});

test("recurring_months = 0 means for as long as the client stays", () => {
  assert.equal(commissionFor(forever, { dealValue: 999, periodIndex: 40 }).amount, 49.95);
});

/* ------------------------------------------------------------ flat + tier -- */
test("flat plan pays its amount once, whatever the deal size", () => {
  assert.equal(commissionFor(flat, { dealValue: 3000 }).amount, 500);
  assert.equal(commissionFor(flat, { dealValue: 900000 }).amount, 500);
  assert.equal(commissionFor(flat, { dealValue: 3000, periodIndex: 1 }), null);
});

test("tier boundaries are inclusive, and the open tier catches the rest", () => {
  assert.equal(tierRateFor(tiered.tiers, 10000), 5, "exactly at the boundary stays in the lower tier");
  assert.equal(tierRateFor(tiered.tiers, 10001), 8);
  assert.equal(tierRateFor(tiered.tiers, 500000), 12);
  assert.equal(commissionFor(tiered, { dealValue: 40000 }).amount, 3200);
  assert.equal(commissionFor(tiered, { dealValue: 40000 }).kind, "tier");
});

test("an unsorted or open-ended ladder still resolves", () => {
  assert.equal(tierRateFor([{ upTo: null, rate: 12 }, { upTo: 1000, rate: 3 }], 500), 3);
  assert.equal(tierRateFor([], 500), 0);
});

/* -------------------------------------------------------- floors and caps -- */
test("a deal below the floor earns nothing at all", () => {
  assert.equal(commissionFor({ ...firstInvoice, min_deal_value: 5000 }, { dealValue: 4999 }), null);
  assert.equal(commissionFor({ ...firstInvoice, min_deal_value: 5000 }, { dealValue: 5000 }).amount, 500);
});

test("the per-referral cap clips the amount, not the rate", () => {
  const capped = commissionFor({ ...firstInvoice, max_amount: 800 }, { dealValue: 20000 });
  assert.equal(capped.amount, 800);
  assert.equal(capped.rate, 10, "the rate on the voucher is still the agreed rate");
});

test("a hybrid is the model plus bonus_flat, on the first payment only", () => {
  const plan = { model: "recurring_pct", rate: 5, bonus_flat: 500, recurring_months: 0 };
  assert.equal(commissionFor(plan, { dealValue: 1000, periodIndex: 0 }).amount, 550);
  assert.equal(commissionFor(plan, { dealValue: 1000, periodIndex: 1 }).amount, 50);
});

test("zero and negative deal values earn nothing (flat is the exception)", () => {
  assert.equal(commissionFor(firstInvoice, { dealValue: 0 }), null);
  assert.equal(commissionFor(firstInvoice, { dealValue: -5000 }), null);
  assert.equal(commissionFor(flat, { dealValue: 0 }).amount, 500);
});

test("money is rounded to halalas, never carried as a float tail", () => {
  assert.equal(commissionFor({ model: "first_invoice_pct", rate: 7.5 }, { dealValue: 1333 }).amount, 99.98);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

/* ---------------------------------------------------------------- plans --- */
test("an unknown or missing model falls back to first-invoice rather than throwing", () => {
  assert.equal(normalizePlan({ model: "moon_rate", rate: 10 }).model, "first_invoice_pct");
  assert.equal(normalizePlan(null).model, "first_invoice_pct");
  assert.equal(normalizePlan(undefined).attributionDays, 90);
});

test("a snapshot written in camelCase computes the same as a DB row", () => {
  const row = { model: "flat", flat_amount: 500, min_deal_value: 100 };
  const snap = normalizePlan(row);
  assert.deepEqual(commissionFor(snap, { dealValue: 900 }), commissionFor(row, { dealValue: 900 }));
});

test("plan sentences describe each model in Arabic", () => {
  assert.match(planSentence(firstInvoice, "ar"), /١٠|10/);
  assert.match(planSentence(recurring, "ar"), /3|٣/);
  assert.match(planSentence(forever, "ar"), /طوال/);
  assert.match(planSentence(flat, "ar"), /500/);
  assert.match(planSentence(tiered, "ar"), /شرائح/);
});

/* --------------------------------------------------------------- totals --- */
test("totals split by status and ignore voided rows", () => {
  const t = totalsFor([
    { amount: 100, status: "pending", currency: "SAR" },
    { amount: 250.5, status: "approved", currency: "SAR" },
    { amount: 400, status: "paid", currency: "SAR" },
    { amount: 999, status: "void", currency: "SAR" },
  ]);
  assert.deepEqual([t.pending, t.approved, t.paid, t.total], [100, 250.5, 400, 750.5]);
  assert.deepEqual(totalsFor([]).total, 0);
});

/* --------------------------------------------------------------- dedupe --- */
test("the same company referred twice produces the same dedupe key", () => {
  const a = dedupeKey({ companyName: "شركة ورك فورس", companyUrl: "https://workforce.sa/en/" });
  const b = dedupeKey({ companyName: "ورك فورس", companyUrl: "http://www.workforce.sa" });
  assert.equal(a, b);
  assert.equal(a, "d:workforce.sa");
});

test("a work e-mail identifies the company, a free inbox does not", () => {
  assert.equal(dedupeKey({ companyName: "X", contactEmail: "m.nowaf@workforcesa.com" }), "d:workforcesa.com");
  assert.notEqual(dedupeKey({ companyName: "مؤسسة الرياض", contactEmail: "a@gmail.com" }), "d:gmail.com");
});

test("Arabic company names normalise past ة/ه, أ/ا and the word شركة", () => {
  assert.equal(dedupeKey({ companyName: "شركة الأمانة" }), dedupeKey({ companyName: "الامانه" }));
  assert.equal(dedupeKey({ companyName: "" }), "");
});

/* ---------------------------------------------------------------- phones -- */
test("Saudi mobiles are stored in one shape however they were typed", () => {
  const want = "966530540231";
  for (const v of ["0530540231", "530540231", "+966530540231", "00966530540231", "966 530 540 231"]) {
    assert.equal(normPhone(v), want, v);
  }
  assert.equal(normPhone(""), "");
});
