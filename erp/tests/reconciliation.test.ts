/**
 * التسوية البنكية.
 *
 * أهمّ ما يُختبر هنا شيئان لا يظهران في التسوية اليدوية أصلاً:
 *
 * الأول: **المعادلة عبر كشفين**. التسوية تُقاس على تاريخ لا على كشف. لو
 * حُسبت على سطور الكشف الجاري وحده، لعادت قيودُ الشهر الماضي — وقد ظهرت في
 * كشف الشهر الماضي — لتُحسب «معلّقة» من جديد، فيخرج فرقٌ وهميّ يساوي حركة
 * الشهر الماضي كلّها. الاختبار الأخير يستورد كشفين متتاليين ويتأكّد أن
 * الفرق في الثاني صفر.
 *
 * والثاني: **رفض المطابقة الملتبسة**. دفعتان متساويتان في اليوم نفسه —
 * وهو شائع في الاشتراكات — تجعلان اختيار المحرّك عشوائياً. المطلوب أن
 * يمتنع، لا أن يخمّن.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import {
  importStatement, parseCsv, matchScore, suggestMatches, autoMatch,
  matchLine, unmatchLine, createAdjustment, reconciliationReport,
  finalizeReconciliation, AUTO_MATCH_THRESHOLD,
} from '../src/lib/treasury/reconciliation.ts';
import { postEntry, accountByRole, auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { trialBalance } from '../src/lib/accounting/reports.ts';
import { money } from '../src/lib/money.ts';

let tenantId: string;
let bankAccountId: string; // BankAccount
let bankGlId: string; // حساب الأستاذ المقابل
const J: Record<string, { id: string; bankLineId: string }> = {};

const Y = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(Y, m - 1, dd));

/** يرحّل قيداً طرفه الأول البنك، ويحفظ معرّف سطر البنك للمطابقة اليدوية. */
async function bankEntry(
  tx: Parameters<typeof postEntry>[0],
  key: string,
  date: Date,
  amount: string,
  counterSubtype: string,
  ref: string,
) {
  const counter = await accountByRole(tx, tenantId, counterSubtype);
  const inbound = !amount.startsWith('-');
  const abs = amount.replace('-', '');
  const entry = await postEntry(tx, tenantId, {
    date,
    ref,
    memoAr: `قيد ${key}`,
    lines: inbound
      ? [
          { accountId: bankGlId, debit: abs },
          { accountId: counter.id, credit: abs },
        ]
      : [
          { accountId: bankGlId, credit: abs },
          { accountId: counter.id, debit: abs },
        ],
  });
  J[key] = {
    id: entry.id,
    bankLineId: entry.lines.find((l) => l.accountId === bankGlId)!.id,
  };
  return entry;
}

before(async () => {
  await purgeTenantBySlug('recon-test');
  const t = await provisionTenant({ slug: 'recon-test', nameAr: 'منشأة اختبار التسوية' });
  tenantId = t.id;

  await withTenant(tenantId, async (tx) => {
    const gl = await accountByRole(tx, tenantId, 'BANK');
    bankGlId = gl.id;
    const ba = await tx.bankAccount.create({
      data: {
        tenantId, nameAr: 'الحساب الجاري — الأهلي', nameEn: 'Current Account',
        bankName: 'SNB', accountId: gl.id, kind: 'BANK',
      },
    });
    bankAccountId = ba.id;

    // حركة مارس على الحساب البنكي
    await bankEntry(tx, 'J1', day(3, 1), '50000', 'CAPITAL', 'CAP-1');
    await bankEntry(tx, 'J2', day(3, 5), '12000', 'OTHER_INCOME', 'TRF-9001');
    await bankEntry(tx, 'J3', day(3, 8), '-3000', 'OPERATING', 'CHQ-1201');
    await bankEntry(tx, 'J5', day(3, 10), '-1000', 'OPERATING', 'SUB-A');
    await bankEntry(tx, 'J6', day(3, 10), '-1000', 'OPERATING', 'SUB-B');
    // شيكٌ صُرف في مارس ولم يُقدَّم للبنك إلا في أبريل
    await bankEntry(tx, 'J4', day(3, 25), '-7500', 'OPERATING', 'CHQ-1202');
  });
});

after(async () => {
  await purgeTenantBySlug('recon-test');
  await prisma.$disconnect();
});

// ── قراءة الملفات ────────────────────────────────────────────────────────

test('يقرأ CSV بصيغ البنوك المختلفة: عناوين، وفواصل داخل الاقتباس، وسالبٌ بين قوسين', () => {
  const csv = [
    'Date,Description,Reference,Amount,Balance',
    '2026-03-01,"تحويل من شركة، فرع الرياض",CAP-1,"50,000.00","50,000.00"',
    '05/03/2026,حوالة واردة,TRF-9001,12000,62000.00',
    '2026-03-08,شيك صادر,CHQ-1201,(3000.00),59000.00',
    '2026-03-31,رسوم خدمات,,SAR -25.00,58975.00',
  ].join('\n');

  const lines = parseCsv(csv);
  assert.equal(lines.length, 4, 'صف العناوين يُتخطّى');

  // الفاصلة داخل الاقتباس ليست فاصل حقول، والفاصلة الألفية ليست فاصل حقول
  assert.equal(lines[0].descRaw, 'تحويل من شركة، فرع الرياض');
  assert.equal(lines[0].amount.toFixed(2), '50000.00');
  assert.equal(lines[0].valueDate.toISOString().slice(0, 10), `${Y}-03-01`);

  // DD/MM/YYYY — لا MM/DD/YYYY
  assert.equal(lines[1].valueDate.toISOString().slice(0, 10), `${Y}-03-05`);

  // القوسان علامةُ سالب في كشوف كثيرة
  assert.equal(lines[2].amount.toFixed(2), '-3000.00');
  assert.equal(lines[2].reference, 'CHQ-1201');

  // رمز العملة يُهمَل، والمرجع الفارغ يصير null لا سلسلةً فارغة
  assert.equal(lines[3].amount.toFixed(2), '-25.00');
  assert.equal(lines[3].reference, null);
});

test('يرفض السطر الذي لا يُقرأ تاريخه أو مبلغه بدل أن يبتلعه', () => {
  assert.throws(
    () => parseCsv('التاريخ,الوصف,المرجع,مبلغ\n31-02-2026x,وصف,,100'),
    /تاريخ غير مقروء/,
  );
  assert.throws(
    () => parseCsv('التاريخ,الوصف,المرجع,مبلغ\n2026-03-01,وصف,,لا رقم'),
    /مبلغ غير مقروء/,
  );
});

// ── درجة الثقة ───────────────────────────────────────────────────────────

test('المبلغ المختلف يُلغي المقابلة مهما تطابق ما عداها', () => {
  const s = { valueDate: day(3, 1), amount: '100.00', descRaw: 'CAP-1', reference: 'CAP-1' };
  assert.equal(matchScore(s, { date: day(3, 1), amount: '100.01', reference: 'CAP-1' }), 0);
  // فلسٌ واحد يكفي: المبلغ لا يُقارَب
  assert.equal(matchScore(s, { date: day(3, 1), amount: '100.00', reference: null }), 85);
});

test('الدرجة تتدرّج بفارق التاريخ — والمرجع يقفزها إلى المئة', () => {
  const s = (m: number, dd: number) => ({
    valueDate: day(m, dd), amount: '100', descRaw: 'حوالة TRF-9001', reference: null,
  });
  const l = (m: number, dd: number, ref: string | null = null) => ({
    date: day(m, dd), amount: '100', reference: ref,
  });

  assert.equal(matchScore(s(3, 10), l(3, 10)), 85, 'اليوم نفسه: ٦٠ + ٢٥');
  assert.equal(matchScore(s(3, 11), l(3, 10)), 78, 'يوم واحد: ٦٠ + ١٨');
  assert.equal(matchScore(s(3, 13), l(3, 10)), 70, 'ثلاثة أيام: ٦٠ + ١٠');
  assert.equal(matchScore(s(3, 17), l(3, 10)), 64, 'سبعة أيام: ٦٠ + ٤');
  assert.equal(matchScore(s(3, 30), l(3, 10)), 50, 'عشرون يوماً: ٦٠ − ١٠');

  // المرجع الموجود في وصف الكشف يرفع الدرجة عشرين، بحدٍّ أقصى مئة
  assert.equal(matchScore(s(3, 10), l(3, 10, 'TRF-9001')), 100, '٨٥ + ٢٠ تُقصّ عند ١٠٠');
  assert.equal(matchScore(s(3, 30), l(3, 10, 'TRF-9001')), 70, '٥٠ + ٢٠');
  // مرجعٌ أقصر من أربعة أحرف يُهمَل: «A1» يظهر مصادفةً في أي وصف
  assert.equal(matchScore(s(3, 10), l(3, 10, 'A1')), 85);
});

// ── الاستيراد ────────────────────────────────────────────────────────────

test('يرفض كشفاً لا يتزن — ويقول كم الفرق بالضبط', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      importStatement(tx, tenantId, {
        bankAccountId, fromDate: day(3, 1), toDate: day(3, 31),
        openingBalance: '0', closingBalance: '200',
        lines: [{ valueDate: day(3, 5), descRaw: 'حركة', amount: '100' }],
      }),
      (e: Error) => /لا يتزن/.test(e.message) && /الفرق 100\.00/.test(e.message),
    );

    await assert.rejects(
      importStatement(tx, tenantId, {
        bankAccountId, fromDate: day(3, 1), toDate: day(3, 31),
        openingBalance: '0', closingBalance: '0', lines: [],
      }),
      /بلا سطور/,
    );

    await assert.rejects(
      importStatement(tx, tenantId, {
        bankAccountId, fromDate: day(3, 31), toDate: day(3, 1),
        openingBalance: '0', closingBalance: '100',
        lines: [{ valueDate: day(3, 5), descRaw: 'حركة', amount: '100' }],
      }),
      /قبل بدايته/,
    );
  });
});

let stmt1Id: string;
let stmt1Lines: { id: string; descRaw: string; amount: string }[] = [];

test('يستورد كشف مارس: افتتاحي + حركات = ختامي', async () => {
  await withTenant(tenantId, async (tx) => {
    const s = await importStatement(tx, tenantId, {
      bankAccountId,
      reference: 'SNB-2026-03',
      fromDate: day(3, 1),
      toDate: day(3, 31),
      openingBalance: '0',
      // ٥٠٬٠٠٠ + ١٢٬٠٠٠ − ٣٬٠٠٠ − ١٬٠٠٠ − ١٬٠٠٠ − ٢٥
      closingBalance: '56975',
      lines: [
        { valueDate: day(3, 1), descRaw: 'تحويل رأس مال CAP-1', amount: '50000' },
        { valueDate: day(3, 6), descRaw: 'حوالة واردة TRF-9001', amount: '12000' },
        { valueDate: day(3, 8), descRaw: 'شيك مقاصة', reference: 'CHQ-1201', amount: '-3000' },
        { valueDate: day(3, 10), descRaw: 'خصم اشتراك', amount: '-1000' },
        { valueDate: day(3, 10), descRaw: 'خصم اشتراك', amount: '-1000' },
        { valueDate: day(3, 31), descRaw: 'رسوم خدمات بنكية', amount: '-25' },
      ],
    });
    stmt1Id = s.id;
    stmt1Lines = s.lines
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({ id: l.id, descRaw: l.descRaw, amount: l.amount.toString() }));

    assert.equal(s.lines.length, 6);
    assert.equal(s.status, 'IMPORTED');
    assert.equal(money(s.closingBalance).toFixed(2), '56975.00');
  });
});

// ── المطابقة ─────────────────────────────────────────────────────────────

test('المطابقة الآلية تأخذ الواضح وتترك الملتبس معلّقاً', async () => {
  await withTenant(tenantId, async (tx) => {
    const { suggestions } = await suggestMatches(tx, tenantId, stmt1Id);
    assert.equal(suggestions.length, 6);

    const byDesc = (d: string) => suggestions.find((s) => s.descRaw === d)!;

    // ٨٥ + ٢٠ للمرجع، مقصوصةً عند ١٠٠
    assert.equal(byDesc('تحويل رأس مال CAP-1').best!.score, 100);
    // يومٌ واحد فارق (٧٨) + ٢٠ للمرجع
    assert.equal(byDesc('حوالة واردة TRF-9001').best!.score, 98);
    assert.equal(byDesc('شيك مقاصة').best!.score, 100);

    // الدفعتان المتساويتان في اليوم نفسه: مرشّحان بالدرجة ٨٥ نفسها
    const sub = suggestions.filter((s) => s.descRaw === 'خصم اشتراك');
    assert.equal(sub.length, 2);
    for (const s of sub) {
      assert.equal(s.candidates.length, 2, 'كلا القيدين مرشّح');
      assert.equal(s.candidates[0].score, 85);
      assert.equal(s.candidates[1].score, 85);
      assert.equal(s.ambiguous, true, 'التعادل يجعلها ملتبسة');
      assert.equal(
        s.autoMatchable, false,
        'الدرجة تجاوزت العتبة لكن التفرّد مفقود — والعشوائية أسوأ من التعليق',
      );
    }

    // رسوم البنك لا يقابلها شيء في الدفتر أصلاً
    const fee = byDesc('رسوم خدمات بنكية');
    assert.equal(fee.candidates.length, 0);
    assert.equal(fee.best, null);
    assert.equal(fee.autoMatchable, false);

    // الشيك المعلّق (J4) لم يظهر في هذا الكشف، فلا سطر يرشّحه
    assert.ok(
      !suggestions.some((s) => s.candidates.some((c) => c.journalLineId === J.J4.bankLineId)),
    );

    const res = await autoMatch(tx, tenantId, stmt1Id, 'tester');
    assert.equal(res.matched, 3, 'ثلاثةٌ واضحة من ستة');
    assert.equal(res.total, 6);

    const s = await tx.bankStatement.findUniqueOrThrow({ where: { id: stmt1Id } });
    assert.equal(s.status, 'RECONCILING');
  });
});

test('العتبة معلَنة ومطبَّقة: ما دونها لا يُطابَق آلياً', async () => {
  assert.equal(AUTO_MATCH_THRESHOLD, 85);
  await withTenant(tenantId, async (tx) => {
    const { suggestions } = await suggestMatches(tx, tenantId, stmt1Id);
    for (const s of suggestions) {
      if (s.autoMatchable) assert.ok(s.best!.score >= AUTO_MATCH_THRESHOLD);
    }
  });
});

test('المطابقة اليدوية تشترط تساوي المبلغ، ولا تُعيد استعمال سطر دفترٍ مأخوذ', async () => {
  await withTenant(tenantId, async (tx) => {
    const subLine = stmt1Lines.find((l) => l.descRaw === 'خصم اشتراك')!;

    // مبلغٌ مختلف: مرفوض. (J4 حرٌّ غير مأخوذ، فيصل الفحص إلى المبلغ.)
    await assert.rejects(
      matchLine(tx, tenantId, subLine.id, J.J4.bankLineId, 'tester'),
      /المبلغان مختلفان/,
    );

    // سطر دفترٍ مطابَقٌ سلفاً بسطر كشفٍ آخر. وهذا الفحص يسبق فحص المبلغ
    // عمداً: «مأخوذ» جوابٌ أدقّ من «مبلغان مختلفان» حين يكون كلاهما صحيحاً.
    await assert.rejects(
      matchLine(tx, tenantId, subLine.id, J.J3.bankLineId, 'tester'),
      /مطابَقٌ بسطر كشفٍ آخر/,
    );

    // سطر كشفٍ مطابَقٌ سلفاً
    const capLine = stmt1Lines.find((l) => l.descRaw === 'تحويل رأس مال CAP-1')!;
    await assert.rejects(
      matchLine(tx, tenantId, capLine.id, J.J4.bankLineId, 'tester'),
      /مطابَق سلفاً/,
    );
  });
});

test('يفكّ المطابقة فيعود السطر معلّقاً بلا أثر', async () => {
  await withTenant(tenantId, async (tx) => {
    const capLine = stmt1Lines.find((l) => l.descRaw === 'تحويل رأس مال CAP-1')!;
    const un = await unmatchLine(tx, tenantId, capLine.id);
    assert.equal(un.status, 'UNMATCHED');
    assert.equal(un.journalLineId, null);
    assert.equal(un.matchScore, null);
    assert.equal(un.matchedAt, null);

    // ثم يُعاد يدوياً
    const re = await matchLine(tx, tenantId, capLine.id, J.J1.bankLineId, 'tester');
    assert.equal(re.status, 'MATCHED');
    assert.equal(re.matchScore, 100);
    assert.equal(re.matchedBy, 'tester');
  });
});

test('الالتباس يُحسم يدوياً — والمحرّك لا يعترض على اختيار الإنسان', async () => {
  await withTenant(tenantId, async (tx) => {
    const subs = stmt1Lines.filter((l) => l.descRaw === 'خصم اشتراك');
    const a = await matchLine(tx, tenantId, subs[0].id, J.J5.bankLineId, 'tester');
    const b = await matchLine(tx, tenantId, subs[1].id, J.J6.bankLineId, 'tester');
    assert.equal(a.matchScore, 85);
    assert.equal(b.matchScore, 85);
  });
});

// ── الكشف والقفل ─────────────────────────────────────────────────────────

test('الكشف يفسّر الفرق: البنك + المعلّق في الدفتر − غير المقيَّد = الدفتر', async () => {
  await withTenant(tenantId, async (tx) => {
    const r = await reconciliationReport(tx, tenantId, stmt1Id);

    assert.equal(r.bankBalance.toFixed(2), '56975.00');
    // ٥٠٬٠٠٠ + ١٢٬٠٠٠ − ٣٬٠٠٠ − ١٬٠٠٠ − ١٬٠٠٠ − ٧٬٥٠٠
    assert.equal(r.bookBalance.toFixed(2), '49500.00');

    // الشيك المعلّق وحده: صُرف في الدفتر ولم يظهر في الكشف
    assert.equal(r.unmatchedLedger.length, 1);
    assert.equal(r.unmatchedLedger[0].id, J.J4.bankLineId);
    assert.equal(r.outstandingLedger.toFixed(2), '-7500.00');

    // رسوم البنك: في الكشف ولم تُقيَّد
    assert.equal(r.unmatchedStatement.length, 1);
    assert.equal(r.unmatchedStatement[0].descRaw, 'رسوم خدمات بنكية');
    assert.equal(r.unrecordedStatement.toFixed(2), '-25.00');

    // ٥٦٬٩٧٥ + (−٧٬٥٠٠) − (−٢٥) = ٤٩٬٥٠٠
    assert.equal(r.adjustedBank.toFixed(2), '49500.00');
    assert.equal(r.difference.toFixed(2), '0.00');
    assert.equal(r.explained, true, 'كل ريال في الفرق له تفسير — وإن بقي بندٌ بلا قيد');
    assert.equal(r.matchedCount, 5);
    assert.equal(r.totalLines, 6);
  });
});

test('لا تُقفل تسويةٌ فيها بندٌ بلا تفسير — ولو اتزنت المعادلة', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      finalizeReconciliation(tx, tenantId, stmt1Id, 'tester'),
      (e: Error & { code?: string }) =>
        e.code === 'UNEXPLAINED_LINES' && /1 سطراً بلا تفسير/.test(e.message),
    );
  });
});

test('قيد التسوية يُثبت رسوم البنك ويطابق السطر بنفسه', async () => {
  await withTenant(tenantId, async (tx) => {
    const feeLine = stmt1Lines.find((l) => l.descRaw === 'رسوم خدمات بنكية')!;
    const charges = await accountByRole(tx, tenantId, 'BANK_CHARGES');

    const entry = await createAdjustment(tx, tenantId, feeLine.id, {
      counterAccountId: charges.id,
      actor: 'tester',
    });

    assert.equal(entry.sourceType, 'BANK_ADJUSTMENT');
    assert.equal(entry.sourceId, feeLine.id);
    assert.equal(money(entry.totalDebit).toFixed(2), '25.00');

    // السطر سالب: البنك دائن والمصروف مدين
    const bankLine = entry.lines.find((l) => l.accountId === bankGlId)!;
    const chargeLine = entry.lines.find((l) => l.accountId === charges.id)!;
    assert.equal(money(bankLine.credit).toFixed(2), '25.00');
    assert.equal(money(bankLine.debit).toFixed(2), '0.00');
    assert.equal(money(chargeLine.debit).toFixed(2), '25.00');

    const updated = await tx.bankStatementLine.findUniqueOrThrow({ where: { id: feeLine.id } });
    assert.equal(updated.status, 'MATCHED');
    assert.equal(updated.journalLineId, bankLine.id);
    assert.equal(updated.matchScore, 100);
    assert.equal(updated.adjustmentEntryId, entry.id);
  });
});

test('بعد تفسير كل بند تُقفل التسوية', async () => {
  await withTenant(tenantId, async (tx) => {
    const before = await reconciliationReport(tx, tenantId, stmt1Id);
    // الرسوم قُيِّدت، فنقص رصيد الدفتر ٢٥ ولم يعد في الكشف بندٌ غير مقيَّد
    assert.equal(before.bookBalance.toFixed(2), '49475.00');
    assert.equal(before.unrecordedStatement.toFixed(2), '0.00');
    assert.equal(before.unmatchedStatement.length, 0);
    // ٥٦٬٩٧٥ + (−٧٬٥٠٠) − ٠ = ٤٩٬٤٧٥
    assert.equal(before.adjustedBank.toFixed(2), '49475.00');
    assert.equal(before.difference.toFixed(2), '0.00');

    const s = await finalizeReconciliation(tx, tenantId, stmt1Id, 'tester');
    assert.equal(s.status, 'RECONCILED');
    assert.equal(s.reconciledBy, 'tester');
    assert.ok(s.reconciledAt);
  });
});

// ── الكشف الثاني ─────────────────────────────────────────────────────────

test('كشف أبريل: قيود مارس المطابَقة لا تعود «معلّقة» فيخرج فرقٌ وهمي', async () => {
  await withTenant(tenantId, async (tx) => {
    await bankEntry(tx, 'J7', day(4, 3), '5000', 'OTHER_INCOME', 'TRF-9100');

    const s2 = await importStatement(tx, tenantId, {
      bankAccountId,
      reference: 'SNB-2026-04',
      fromDate: day(4, 1),
      toDate: day(4, 30),
      openingBalance: '56975',
      closingBalance: '54475', // ٥٦٬٩٧٥ − ٧٬٥٠٠ + ٥٬٠٠٠
      lines: [
        // الشيك المصروف في ٢٥ مارس قُدِّم للبنك في ٢ أبريل
        { valueDate: day(4, 2), descRaw: 'شيك مقاصة CHQ-1202', amount: '-7500' },
        { valueDate: day(4, 3), descRaw: 'حوالة واردة TRF-9100', amount: '5000' },
      ],
    });

    const { suggestions } = await suggestMatches(tx, tenantId, s2.id);

    // الشيك: ثمانية أيام فارقاً (٦٤) + ٢٠ للمرجع = ٨٤ — دون العتبة بدرجة
    const chq = suggestions.find((x) => x.descRaw.startsWith('شيك'))!;
    assert.equal(chq.best!.journalLineId, J.J4.bankLineId);
    assert.equal(chq.best!.score, 84);
    assert.equal(chq.autoMatchable, false, 'درجةٌ واحدة دون العتبة تكفي للتعليق');

    // الحوالة: اليوم نفسه + المرجع = ١٠٠
    const trf = suggestions.find((x) => x.descRaw.startsWith('حوالة'))!;
    assert.equal(trf.best!.score, 100);
    assert.equal(trf.autoMatchable, true);

    // قيود مارس المطابَقة لا تظهر مرشّحةً هنا
    const allCandidates = suggestions.flatMap((x) => x.candidates.map((c) => c.journalLineId));
    assert.ok(!allCandidates.includes(J.J5.bankLineId));
    assert.ok(!allCandidates.includes(J.J6.bankLineId));

    const auto = await autoMatch(tx, tenantId, s2.id, 'tester');
    assert.equal(auto.matched, 1);
    await matchLine(tx, tenantId, chq.lineId, J.J4.bankLineId, 'tester');

    const r = await reconciliationReport(tx, tenantId, s2.id);
    assert.equal(r.bankBalance.toFixed(2), '54475.00');
    assert.equal(r.bookBalance.toFixed(2), '54475.00');
    // لا معلّق ولا غير مقيَّد: كل حركة مارس دخلت كشف مارس
    assert.equal(
      r.outstandingLedger.toFixed(2), '0.00',
      'لو قِيست المعادلة على سطور هذا الكشف وحده لعادت حركة مارس كلها معلّقة',
    );
    assert.equal(r.unrecordedStatement.toFixed(2), '0.00');
    assert.equal(r.difference.toFixed(2), '0.00');
    assert.equal(r.explained, true);

    const s = await finalizeReconciliation(tx, tenantId, s2.id, 'tester');
    assert.equal(s.status, 'RECONCILED');
  });
});

// ── سلامة الدفتر ─────────────────────────────────────────────────────────

test('الدفتر بعد التسوية ما زال متوازناً وسليماً', async () => {
  await withTenant(tenantId, async (tx) => {
    const tb = await trialBalance(tx, tenantId, day(1, 1), day(12, 31));
    assert.equal(
      tb.totals.closingDebit.toFixed(2), tb.totals.closingCredit.toFixed(2),
      'ميزان المراجعة لا يتزن',
    );

    const issues = await auditLedgerIntegrity(tx, tenantId);
    assert.deepEqual(issues, []);
  });
});
