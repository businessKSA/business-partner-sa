/**
 * التقارير المالية.
 *
 * كلها تُقرأ من `JournalLine` وحده. لا جدول أرصدة موازٍ يُحدَّث مع كل
 * حركة — لأن جدولاً كهذا ينحرف يوماً عن الدفتر، ثم لا يُعرف أيّهما الصادق.
 * التجميع في Postgres سريع بما يكفي لملايين السطور مع الفهارس القائمة،
 * وحين لا يكفي فالحلّ لقطة مؤرَّخة (materialized view) لا رقمٌ يُحدَّث يدوياً.
 *
 * اصطلاح الإشارة: الأصول والمصروفات طبيعتها مدينة (مدين − دائن)، والخصوم
 * وحقوق الملكية والإيرادات طبيعتها دائنة (دائن − مدين). فالرصيد الموجب
 * يعني دائماً «طبيعي» أياً كان الحساب، والسالب يستحق نظرة.
 */
import type { Tx } from '../db.ts';
import { d, money, Decimal } from '../money.ts';
import { Prisma, type AccountType } from '@prisma/client';

const DEBIT_NORMAL: AccountType[] = ['ASSET', 'EXPENSE'];

export function isDebitNormal(type: AccountType): boolean {
  return DEBIT_NORMAL.includes(type);
}

/** يحوّل (مدين، دائن) إلى رصيد بإشارة طبيعة الحساب. */
export function naturalBalance(type: AccountType, debit: Decimal, credit: Decimal): Decimal {
  return isDebitNormal(type) ? debit.minus(credit) : credit.minus(debit);
}

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: AccountType;
  subtype: string | null;
  openingDebit: Decimal;
  openingCredit: Decimal;
  periodDebit: Decimal;
  periodCredit: Decimal;
  closingDebit: Decimal;
  closingCredit: Decimal;
};

/**
 * ميزان المراجعة: رصيد افتتاحي + حركة الفترة = رصيد ختامي، لكل حساب.
 *
 * مجموع المدين الختامي يساوي مجموع الدائن الختامي حتماً — وإن لم يساوِه
 * فالخلل في الدفتر لا في التقرير، و`auditLedgerIntegrity` تقول أين.
 */
export async function trialBalance(
  tx: Tx,
  tenantId: string,
  from: Date,
  to: Date,
  opts: { costCenterId?: string; projectId?: string; includeZero?: boolean } = {},
): Promise<{ rows: TrialBalanceRow[]; totals: Record<string, Decimal> }> {
  const ccFilter = opts.costCenterId ?? null;
  const prFilter = opts.projectId ?? null;

  const raw = await tx.$queryRaw<
    {
      accountId: string; code: string; nameAr: string; nameEn: string;
      type: AccountType; subtype: string | null;
      open_debit: string; open_credit: string;
      per_debit: string; per_credit: string;
    }[]
  >`
    SELECT a."id" AS "accountId", a."code", a."nameAr", a."nameEn", a."type", a."subtype",
      COALESCE(SUM(l."debit")  FILTER (WHERE e."date" <  ${from}), 0)::text AS open_debit,
      COALESCE(SUM(l."credit") FILTER (WHERE e."date" <  ${from}), 0)::text AS open_credit,
      COALESCE(SUM(l."debit")  FILTER (WHERE e."date" >= ${from} AND e."date" <= ${to}), 0)::text AS per_debit,
      COALESCE(SUM(l."credit") FILTER (WHERE e."date" >= ${from} AND e."date" <= ${to}), 0)::text AS per_credit
    FROM "Account" a
    LEFT JOIN "JournalLine" l ON l."accountId" = a."id"
    LEFT JOIN "JournalEntry" e
      ON e."id" = l."entryId"
     AND e."status" IN ('POSTED', 'REVERSED')
     AND e."date" <= ${to}
    WHERE a."tenantId" = ${tenantId}
      AND a."isGroup" = false
      AND (${ccFilter}::text IS NULL OR l."costCenterId" = ${ccFilter})
      AND (${prFilter}::text IS NULL OR l."projectId"    = ${prFilter})
    GROUP BY a."id", a."code", a."nameAr", a."nameEn", a."type", a."subtype"
    ORDER BY a."code"
  `;

  const rows: TrialBalanceRow[] = [];
  const totals = {
    openingDebit: new Decimal(0), openingCredit: new Decimal(0),
    periodDebit: new Decimal(0), periodCredit: new Decimal(0),
    closingDebit: new Decimal(0), closingCredit: new Decimal(0),
  };

  for (const r of raw) {
    const openNet = d(r.open_debit).minus(d(r.open_credit));
    const perDebit = money(r.per_debit);
    const perCredit = money(r.per_credit);
    const closeNet = openNet.plus(perDebit).minus(perCredit);

    // الرصيد يُعرض في عمود واحد بحسب إشارته — لا في العمودين معاً.
    const openingDebit = openNet.greaterThan(0) ? money(openNet) : new Decimal(0);
    const openingCredit = openNet.lessThan(0) ? money(openNet.negated()) : new Decimal(0);
    const closingDebit = closeNet.greaterThan(0) ? money(closeNet) : new Decimal(0);
    const closingCredit = closeNet.lessThan(0) ? money(closeNet.negated()) : new Decimal(0);

    const empty =
      openingDebit.isZero() && openingCredit.isZero() &&
      perDebit.isZero() && perCredit.isZero() &&
      closingDebit.isZero() && closingCredit.isZero();
    if (empty && !opts.includeZero) continue;

    rows.push({
      accountId: r.accountId, code: r.code, nameAr: r.nameAr, nameEn: r.nameEn,
      type: r.type, subtype: r.subtype,
      openingDebit, openingCredit, periodDebit: perDebit, periodCredit: perCredit,
      closingDebit, closingCredit,
    });

    totals.openingDebit = totals.openingDebit.plus(openingDebit);
    totals.openingCredit = totals.openingCredit.plus(openingCredit);
    totals.periodDebit = totals.periodDebit.plus(perDebit);
    totals.periodCredit = totals.periodCredit.plus(perCredit);
    totals.closingDebit = totals.closingDebit.plus(closingDebit);
    totals.closingCredit = totals.closingCredit.plus(closingCredit);
  }

  return { rows, totals };
}

export type PnlSection = {
  key: string;
  labelAr: string;
  labelEn: string;
  accounts: { code: string; nameAr: string; amount: Decimal }[];
  total: Decimal;
};

/**
 * قائمة الدخل. الإيراد موجب والمصروف موجب، وصافي الربح = الإيراد − المصروف.
 * تكلفة الإيراد تُفصل عن المصروفات التشغيلية ليظهر مجمل الربح — وهو الرقم
 * الذي يقول إن كان التسعير سليماً أصلاً.
 */
export async function profitAndLoss(tx: Tx, tenantId: string, from: Date, to: Date, opts: { projectId?: string; costCenterId?: string } = {}) {
  const { rows } = await trialBalance(tx, tenantId, from, to, opts);

  const pick = (pred: (r: TrialBalanceRow) => boolean, key: string, ar: string, en: string): PnlSection => {
    const accs = rows.filter(pred).map((r) => ({
      code: r.code,
      nameAr: r.nameAr,
      // حركة الفترة وحدها — قوائم الدخل تخصّ فترة لا رصيداً متراكماً
      amount: naturalBalance(r.type, r.periodDebit, r.periodCredit),
    })).filter((a) => !a.amount.isZero());
    return { key, labelAr: ar, labelEn: en, accounts: accs, total: accs.reduce((s, a) => s.plus(a.amount), new Decimal(0)) };
  };

  const COST_SUBTYPES = ['COGS', 'COST_OF_SERVICE', 'GOV_FEES'];

  const revenue = pick((r) => r.type === 'REVENUE', 'revenue', 'الإيرادات', 'Revenue');
  const cost = pick(
    (r) => r.type === 'EXPENSE' && COST_SUBTYPES.includes(r.subtype ?? ''),
    'cost', 'تكلفة الإيرادات', 'Cost of Revenue',
  );
  const opex = pick(
    (r) => r.type === 'EXPENSE' && !COST_SUBTYPES.includes(r.subtype ?? ''),
    'opex', 'المصروفات التشغيلية والإدارية', 'Operating Expenses',
  );

  const grossProfit = revenue.total.minus(cost.total);
  const netProfit = grossProfit.minus(opex.total);

  return {
    from, to,
    sections: [revenue, cost, opex],
    grossProfit: money(grossProfit),
    netProfit: money(netProfit),
    /** هامش الربح الإجمالي — null حين لا إيراد، لا صفراً مضلّلاً */
    grossMargin: revenue.total.isZero() ? null : grossProfit.dividedBy(revenue.total).times(100).toDecimalPlaces(2),
    netMargin: revenue.total.isZero() ? null : netProfit.dividedBy(revenue.total).times(100).toDecimalPlaces(2),
  };
}

/**
 * قائمة المركز المالي.
 *
 * أرباح العام الجاري لا تُقفل في الأرباح المبقاة إلا عند إقفال السنة، فحتى
 * تُقفل يجب أن تُضاف إلى حقوق الملكية في القائمة — وإلا لم تتوازن، وظنّ
 * القارئ أن في الدفتر خللاً وليس فيه.
 */
export async function balanceSheet(tx: Tx, tenantId: string, asOf: Date, fiscalYearStart?: Date) {
  const beginning = new Date(Date.UTC(1970, 0, 1));
  const { rows } = await trialBalance(tx, tenantId, beginning, asOf);

  const group = (type: AccountType) =>
    rows
      .filter((r) => r.type === type)
      .map((r) => ({
        code: r.code, nameAr: r.nameAr, subtype: r.subtype,
        amount: naturalBalance(r.type, r.closingDebit, r.closingCredit),
      }))
      .filter((a) => !a.amount.isZero());

  const assets = group('ASSET');
  const liabilities = group('LIABILITY');
  const equity = group('EQUITY');

  const yearStart = fiscalYearStart ?? new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
  const pnl = await profitAndLoss(tx, tenantId, yearStart, asOf);

  const totalAssets = assets.reduce((s, a) => s.plus(a.amount), new Decimal(0));
  const totalLiabilities = liabilities.reduce((s, a) => s.plus(a.amount), new Decimal(0));
  const totalEquityBase = equity.reduce((s, a) => s.plus(a.amount), new Decimal(0));
  const totalEquity = totalEquityBase.plus(pnl.netProfit);

  const difference = money(totalAssets.minus(totalLiabilities.plus(totalEquity)));

  return {
    asOf,
    assets, liabilities, equity,
    currentYearProfit: pnl.netProfit,
    totalAssets: money(totalAssets),
    totalLiabilities: money(totalLiabilities),
    totalEquity: money(totalEquity),
    /** يجب أن يكون صفراً. غيرُ الصفر عطبٌ في الدفتر يستوجب الفحص. */
    difference,
    balanced: difference.isZero(),
  };
}

/** الأستاذ المساعد لحساب واحد: كل حركة برصيدٍ جارٍ. */
export async function generalLedger(
  tx: Tx,
  tenantId: string,
  accountId: string,
  from: Date,
  to: Date,
) {
  const account = await tx.account.findFirstOrThrow({ where: { id: accountId, tenantId } });

  const openingRows = await tx.$queryRaw<{ debit: string; credit: string }[]>`
    SELECT COALESCE(SUM(l."debit"),0)::text AS debit, COALESCE(SUM(l."credit"),0)::text AS credit
    FROM "JournalLine" l JOIN "JournalEntry" e ON e."id" = l."entryId"
    WHERE l."accountId" = ${accountId} AND l."tenantId" = ${tenantId}
      AND e."status" IN ('POSTED','REVERSED') AND e."date" < ${from}
  `;
  const openNet = d(openingRows[0]?.debit).minus(d(openingRows[0]?.credit));
  const signedOpening = isDebitNormal(account.type) ? openNet : openNet.negated();

  const lines = await tx.journalLine.findMany({
    where: {
      tenantId, accountId,
      entry: { status: { in: ['POSTED', 'REVERSED'] }, date: { gte: from, lte: to } },
    },
    include: {
      entry: { select: { number: true, date: true, memoAr: true, ref: true, sourceType: true } },
      partner: { select: { nameAr: true } },
    },
    orderBy: [{ entry: { date: 'asc' } }, { entry: { number: 'asc' } }, { sortOrder: 'asc' }],
  });

  let running = signedOpening;
  const movements = lines.map((l) => {
    const debit = money(l.debit);
    const credit = money(l.credit);
    running = running.plus(isDebitNormal(account.type) ? debit.minus(credit) : credit.minus(debit));
    return {
      date: l.entry.date,
      entryNumber: l.entry.number,
      memoAr: l.descAr ?? l.entry.memoAr ?? '',
      ref: l.entry.ref,
      partnerAr: l.partner?.nameAr ?? null,
      sourceType: l.entry.sourceType,
      debit, credit,
      balance: money(running),
    };
  });

  return {
    account,
    opening: money(signedOpening),
    movements,
    closing: money(running),
    totalDebit: money(movements.reduce((s, m) => s.plus(m.debit), new Decimal(0))),
    totalCredit: money(movements.reduce((s, m) => s.plus(m.credit), new Decimal(0))),
  };
}

/**
 * أعمار الذمم — مدينة أو دائنة — على شرائح ٣٠ يوماً.
 *
 * تُبنى من سطور الدفتر الحاملة `partnerId` على حسابات الذمم، لا من جدول
 * الفواتير: هكذا تدخل التسويات اليدوية والدفعات المقدمة في الحساب، وهي
 * التي تُنسى عادةً فيُطالَب عميلٌ سدَّد.
 */
export async function partnerAging(
  tx: Tx,
  tenantId: string,
  kind: 'RECEIVABLE' | 'PAYABLE',
  asOf: Date,
) {
  const accounts = await tx.account.findMany({
    where: { tenantId, subtype: kind, isGroup: false },
    select: { id: true },
  });
  if (accounts.length === 0) return [];
  const ids = accounts.map((a) => a.id);

  const rows = await tx.$queryRaw<
    {
      partnerId: string; code: string; nameAr: string;
      b0: string; b30: string; b60: string; b90: string; b120: string; total: string;
    }[]
  >`
    SELECT p."id" AS "partnerId", p."code", p."nameAr",
      COALESCE(SUM(CASE WHEN (${asOf}::date - e."date") <=  30 THEN sign_amt END),0)::text AS b0,
      COALESCE(SUM(CASE WHEN (${asOf}::date - e."date") BETWEEN  31 AND  60 THEN sign_amt END),0)::text AS b30,
      COALESCE(SUM(CASE WHEN (${asOf}::date - e."date") BETWEEN  61 AND  90 THEN sign_amt END),0)::text AS b60,
      COALESCE(SUM(CASE WHEN (${asOf}::date - e."date") BETWEEN  91 AND 120 THEN sign_amt END),0)::text AS b90,
      COALESCE(SUM(CASE WHEN (${asOf}::date - e."date") >  120 THEN sign_amt END),0)::text AS b120,
      COALESCE(SUM(sign_amt),0)::text AS total
    FROM (
      SELECT l."partnerId", l."entryId",
             CASE WHEN ${kind} = 'RECEIVABLE'
                  THEN l."debit" - l."credit"
                  ELSE l."credit" - l."debit" END AS sign_amt
      FROM "JournalLine" l
      WHERE l."tenantId" = ${tenantId}
        AND l."accountId" IN (${Prisma.join(ids)})
        AND l."partnerId" IS NOT NULL
    ) x
    JOIN "JournalEntry" e ON e."id" = x."entryId"
    JOIN "Partner" p ON p."id" = x."partnerId"
    WHERE e."status" IN ('POSTED','REVERSED') AND e."date" <= ${asOf}
    GROUP BY p."id", p."code", p."nameAr"
    HAVING COALESCE(SUM(sign_amt),0) <> 0
    ORDER BY 6 DESC
  `;

  return rows.map((r) => ({
    partnerId: r.partnerId, code: r.code, nameAr: r.nameAr,
    current: money(r.b0), days30: money(r.b30), days60: money(r.b60),
    days90: money(r.b90), days120Plus: money(r.b120), total: money(r.total),
  }));
}
