/**
 * اختبارات الدفتر المالي — حدود الفترات وثوابت الأقسام والتصنيفات.
 * دوال محضة لا تمسّ قاعدة البيانات.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { monthBounds, quarterBounds, yearBounds } from '../src/lib/finance';
import {
  COST_CENTER, EXPENSE_CATEGORY, PAY_METHOD,
  costCenterLabel, expenseCategoryLabel,
} from '../src/lib/finance-enums';

test('حدود الشهر: من أوله إلى أول التالي', () => {
  const b = monthBounds(new Date('2026-08-15T12:00:00Z'));
  assert.equal(b.from.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(b.to.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(b.label, '2026-08');
});

test('حدود الشهر: ديسمبر يعبر إلى السنة التالية', () => {
  const b = monthBounds(new Date('2026-12-31T23:00:00Z'));
  assert.equal(b.to.toISOString(), '2027-01-01T00:00:00.000Z');
});

test('حدود الربع: أغسطس في الربع الثالث', () => {
  const b = quarterBounds(new Date('2026-08-15T00:00:00Z'));
  assert.equal(b.from.toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(b.to.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.ok(b.label.includes('الثالث'));
});

test('حدود الربع: يناير في الأول وديسمبر في الرابع', () => {
  assert.ok(quarterBounds(new Date('2026-01-05T00:00:00Z')).label.includes('الأول'));
  const q4 = quarterBounds(new Date('2026-12-05T00:00:00Z'));
  assert.ok(q4.label.includes('الرابع'));
  assert.equal(q4.to.toISOString(), '2027-01-01T00:00:00.000Z');
});

test('حدود السنة: من أولها إلى أول التالية', () => {
  const b = yearBounds(new Date('2026-06-01T00:00:00Z'));
  assert.equal(b.from.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(b.to.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(b.label, '2026');
});

test('حدود الفترات لا تتداخل ولا تترك فجوة', () => {
  // نهاية الشهر هي بداية التالي تماماً — فلا حركة تُحتسب مرتين ولا تسقط
  const aug = monthBounds(new Date('2026-08-10T00:00:00Z'));
  const sep = monthBounds(new Date('2026-09-10T00:00:00Z'));
  assert.equal(aug.to.getTime(), sep.from.getTime());
});

test('مراكز التكلفة: الأقسام المطلوبة كلها موجودة', () => {
  for (const key of ['HR', 'SALES', 'PURCHASES', 'MARKETING', 'SHARED', 'GOV_SERVICES', 'GENERAL']) {
    assert.ok(COST_CENTER[key], `مركز التكلفة ${key} مفقود`);
    assert.ok(COST_CENTER[key].ar.length > 0);
  }
});

test('مراكز التكلفة: المجهول يقع على «عام» لا على فراغ', () => {
  assert.equal(costCenterLabel('SALES'), COST_CENTER.SALES.ar);
  assert.equal(costCenterLabel('NOT_A_CENTER'), COST_CENTER.GENERAL.ar);
  assert.equal(costCenterLabel(null), COST_CENTER.GENERAL.ar);
});

test('التصنيفات: لكل تصنيف مركز تكلفة افتراضي صالح', () => {
  for (const [key, v] of Object.entries(EXPENSE_CATEGORY)) {
    assert.ok(v.ar.length > 0, `${key} بلا اسم`);
    assert.ok(COST_CENTER[v.defaultCenter], `${key} مركزه الافتراضي غير معروف`);
  }
});

test('التصنيفات: الرواتب على الموارد البشرية والإعلانات على التسويق', () => {
  assert.equal(EXPENSE_CATEGORY.SALARIES.defaultCenter, 'HR');
  assert.equal(EXPENSE_CATEGORY.MARKETING_ADS.defaultCenter, 'MARKETING');
  assert.equal(EXPENSE_CATEGORY.GOV_FEES.defaultCenter, 'GOV_SERVICES');
  assert.equal(EXPENSE_CATEGORY.SUPPLIER_PAYOUT.defaultCenter, 'PURCHASES');
});

test('التصنيف المجهول يقع على «أخرى»', () => {
  assert.equal(expenseCategoryLabel('NOPE'), EXPENSE_CATEGORY.OTHER.ar);
});

test('طرق الدفع: التحويل والنقد والبطاقات', () => {
  for (const k of ['TRANSFER', 'CASH', 'MADA', 'CARD']) {
    assert.ok(PAY_METHOD[k], `طريقة الدفع ${k} مفقودة`);
  }
});
