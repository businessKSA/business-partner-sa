/**
 * محرّك القيد المزدوج.
 *
 * هذا هو المعبر الوحيد الذي يتغيّر عبره رصيدُ حساب. لا الفاتورة ولا سند
 * القبض ولا مسيّر الرواتب يكتب في `JournalLine` مباشرة — كلٌّ منها يبني
 * قيداً ويناوله لـ `postEntry`، فتُفرض عليه القواعد نفسها بلا استثناء.
 *
 * ما يفرضه المحرّك، وكلٌّ منه منع عطبٍ رأيناه في أنظمة تعمل بلا حارس:
 *
 *  ١. التوازن. مجموع المدين = مجموع الدائن بالهللة. الميزان الذي لا يتزن
 *     يجعل كل تقرير بعده بلا معنى.
 *  ٢. الحساب التجميعي لا يقبل قيداً. الترحيل على الأب يجعل مجموع الأبناء
 *     أقلّ من الأب، فتصير الشجرة كاذبة.
 *  ٣. الفترة المفتوحة. لا قيد في فترة أُقرَّت وقُدِّمت.
 *  ٤. لا سالب. الطرف السالب حيلةٌ لإخفاء الاتجاه؛ الاتجاه يُقال بالعمود.
 *  ٥. عدم التكرار. مستندٌ رُحِّل مرّة لا يُرحَّل ثانية ولو ضُغط الزر مرّتين.
 *  ٦. لا تعديل بعد الترحيل. التصحيح بقيدٍ عاكس — أثرٌ ظاهر لا محوٌ صامت.
 */
import type { Tx } from '../db.ts';
import { d, money, sum, Decimal, type Num } from '../money.ts';
import { DomainError, UnbalancedEntryError, ValidationError } from '../errors.ts';
import { requireOpenPeriod } from './periods.ts';
import { nextNumber } from './numbering.ts';

export type LineInput = {
  /** يُحدَّد بالمعرّف أو بالرمز أو بالدور الوظيفي — أيّها توفّر */
  accountId?: string;
  accountCode?: string;
  accountSubtype?: string;

  debit?: Num;
  credit?: Num;

  descAr?: string;
  descEn?: string;

  partnerId?: string | null;
  projectId?: string | null;
  costCenterId?: string | null;
  employeeId?: string | null;

  taxCodeId?: string | null;
  taxBase?: Num;
};

export type EntryInput = {
  date: Date;
  memoAr?: string;
  memoEn?: string;
  ref?: string;
  /** مصدر القيد — به يُمنع التكرار ويُربط القيد بمستنده */
  sourceType?: string;
  sourceId?: string;
  currency?: string;
  lines: LineInput[];
  createdBy?: string;
};

/** يعثر على حساب بدوره الوظيفي — لا برمزه، فالرموز تُعاد ترقيمها. */
export async function accountByRole(tx: Tx, tenantId: string, subtype: string) {
  const acc = await tx.account.findFirst({
    where: { tenantId, subtype, isGroup: false, active: true },
    orderBy: { code: 'asc' },
  });
  if (!acc) {
    throw new DomainError(
      `لا يوجد حساب بالدور «${subtype}» في شجرة الحسابات. أضِفه أو عيّن الدور لحساب قائم.`,
      'MISSING_ROLE_ACCOUNT',
      { subtype },
    );
  }
  return acc;
}

async function resolveAccountId(tx: Tx, tenantId: string, line: LineInput): Promise<string> {
  if (line.accountId) return line.accountId;
  if (line.accountCode) {
    const acc = await tx.account.findUnique({
      where: { tenantId_code: { tenantId, code: line.accountCode } },
    });
    if (!acc) throw new DomainError(`الحساب برمز ${line.accountCode} غير موجود`, 'NOT_FOUND');
    return acc.id;
  }
  if (line.accountSubtype) return (await accountByRole(tx, tenantId, line.accountSubtype)).id;
  throw new ValidationError('سطر القيد بلا حساب: حدّد accountId أو accountCode أو accountSubtype');
}

/**
 * يرحّل قيداً. يعيد القيد المرحَّل بسطوره.
 *
 * العملية كلها داخل معاملة المتصل: إن فشل أي تحقّق تراجع الحجزُ والرقمُ
 * والسطور معاً، ولا يبقى أثرٌ نصفيّ.
 */
export async function postEntry(tx: Tx, tenantId: string, input: EntryInput) {
  const lines = input.lines ?? [];

  if (lines.length < 2) {
    throw new ValidationError('القيد يحتاج سطرين على الأقل — طرفاً مديناً وطرفاً دائناً.');
  }

  // منع التكرار: مستندٌ له قيد مرحَّل لا يُرحَّل ثانية.
  if (input.sourceType && input.sourceId) {
    const existing = await tx.journalEntry.findFirst({
      where: {
        tenantId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: { in: ['POSTED', 'REVERSED'] },
      },
      select: { id: true, number: true },
    });
    if (existing) {
      throw new DomainError(
        `هذا المستند مُرحَّل مسبقاً بالقيد ${existing.number}. لا يُرحَّل مرّتين.`,
        'ALREADY_POSTED',
        { entryId: existing.id, number: existing.number },
      );
    }
  }

  const period = await requireOpenPeriod(tx, tenantId, input.date);

  // ── تحقّق السطور ──────────────────────────────────────────────────────
  type Resolved = LineInput & { accountId: string; debit: Decimal; credit: Decimal };
  const resolved: Resolved[] = [];

  for (const [i, line] of lines.entries()) {
    const at = `السطر ${i + 1}`;
    const accountId = await resolveAccountId(tx, tenantId, line);

    const account = await tx.account.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new DomainError(`${at}: الحساب غير موجود في هذه المنشأة`, 'NOT_FOUND');
    if (account.isGroup) {
      throw new ValidationError(
        `${at}: «${account.nameAr}» حساب تجميعي ولا يقبل قيداً. رحّل على أحد أبنائه.`,
      );
    }
    if (!account.active) {
      throw new ValidationError(`${at}: الحساب «${account.nameAr}» مقفل.`);
    }

    const debit = money(line.debit);
    const credit = money(line.credit);

    if (debit.isNegative() || credit.isNegative()) {
      throw new ValidationError(
        `${at}: لا يُقبل مبلغ سالب. الاتجاه يُقال بعمود المدين أو الدائن، لا بالإشارة.`,
      );
    }
    if (debit.isZero() && credit.isZero()) {
      throw new ValidationError(`${at}: مبلغ السطر صفر — احذف السطر أو أدخل مبلغاً.`);
    }
    if (!debit.isZero() && !credit.isZero()) {
      throw new ValidationError(
        `${at}: السطر مدين ودائن معاً. افصله إلى سطرين.`,
      );
    }

    // الأبعاد التحليلية يجب أن تخصّ المنشأة نفسها — RLS يمنع غيرها،
    // لكن رسالة واضحة خير من صفٍّ غير موجود.
    if (line.costCenterId) {
      const cc = await tx.costCenter.findFirst({ where: { id: line.costCenterId, tenantId } });
      if (!cc) throw new DomainError(`${at}: مركز التكلفة غير موجود`, 'NOT_FOUND');
    }

    resolved.push({ ...line, accountId, debit, credit });
  }

  const totalDebit = money(sum(resolved.map((l) => l.debit)));
  const totalCredit = money(sum(resolved.map((l) => l.credit)));

  if (!totalDebit.equals(totalCredit)) {
    throw new UnbalancedEntryError(totalDebit.toFixed(2), totalCredit.toFixed(2));
  }
  if (totalDebit.isZero()) {
    throw new ValidationError('القيد بمجموع صفر — لا أثر له.');
  }

  const number = await nextNumber(tx, tenantId, 'JOURNAL', input.date);

  const entry = await tx.journalEntry.create({
    data: {
      tenantId,
      number,
      date: input.date,
      periodId: period.id,
      sourceType: input.sourceType ?? 'MANUAL',
      sourceId: input.sourceId ?? null,
      memoAr: input.memoAr ?? null,
      memoEn: input.memoEn ?? null,
      ref: input.ref ?? null,
      status: 'POSTED',
      currency: input.currency ?? 'SAR',
      totalDebit: totalDebit.toFixed(6),
      totalCredit: totalCredit.toFixed(6),
      postedAt: new Date(),
      postedBy: input.createdBy ?? null,
      createdBy: input.createdBy ?? null,
      lines: {
        create: resolved.map((l, idx) => ({
          tenantId,
          accountId: l.accountId,
          debit: l.debit.toFixed(6),
          credit: l.credit.toFixed(6),
          descAr: l.descAr ?? null,
          descEn: l.descEn ?? null,
          partnerId: l.partnerId ?? null,
          projectId: l.projectId ?? null,
          costCenterId: l.costCenterId ?? null,
          employeeId: l.employeeId ?? null,
          taxCodeId: l.taxCodeId ?? null,
          taxBase: l.taxBase !== undefined && l.taxBase !== null ? money(l.taxBase).toFixed(6) : null,
          sortOrder: idx,
        })),
      },
    },
    include: { lines: true },
  });

  return entry;
}

/**
 * يعكس قيداً مرحَّلاً بقيدٍ مضادّ.
 *
 * لا يُحذف الأصل ولا يُعدَّل: يبقى في الدفتر ومعه عاكسُه، فيقرأ المدقّق
 * القصّة كاملة — ماذا قيل أولاً، ومتى صُحِّح، وبأي مبلغ.
 */
export async function reverseEntry(
  tx: Tx,
  tenantId: string,
  entryId: string,
  opts: { date?: Date; memoAr?: string; actor?: string } = {},
) {
  const original = await tx.journalEntry.findFirst({
    where: { id: entryId, tenantId },
    include: { lines: true },
  });
  if (!original) throw new DomainError('القيد غير موجود', 'NOT_FOUND');

  if (original.status !== 'POSTED') {
    throw new DomainError(
      `القيد ${original.number} حالته «${original.status}» — لا يُعكس إلا المرحَّل.`,
      'NOT_POSTED',
    );
  }

  const already = await tx.journalEntry.findFirst({ where: { tenantId, reversalOfId: entryId } });
  if (already) {
    throw new DomainError(
      `القيد ${original.number} معكوسٌ سلفاً بالقيد ${already.number}.`,
      'ALREADY_REVERSED',
    );
  }

  const date = opts.date ?? new Date();
  const period = await requireOpenPeriod(tx, tenantId, date);
  const number = await nextNumber(tx, tenantId, 'JOURNAL', date);

  const reversal = await tx.journalEntry.create({
    data: {
      tenantId,
      number,
      date,
      periodId: period.id,
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      memoAr: opts.memoAr ?? `عكس القيد ${original.number}`,
      ref: original.ref,
      status: 'POSTED',
      currency: original.currency,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      reversalOfId: original.id,
      postedAt: new Date(),
      postedBy: opts.actor ?? null,
      createdBy: opts.actor ?? null,
      lines: {
        // القلب: ما كان مديناً يصير دائناً بالمبلغ نفسه.
        create: original.lines.map((l, idx) => ({
          tenantId,
          accountId: l.accountId,
          debit: l.credit,
          credit: l.debit,
          descAr: `عكس: ${l.descAr ?? ''}`.trim(),
          partnerId: l.partnerId,
          projectId: l.projectId,
          costCenterId: l.costCenterId,
          employeeId: l.employeeId,
          taxCodeId: l.taxCodeId,
          taxBase: l.taxBase ? d(l.taxBase).negated().toFixed(6) : null,
          sortOrder: idx,
        })),
      },
    },
    include: { lines: true },
  });

  await tx.journalEntry.update({ where: { id: original.id }, data: { status: 'REVERSED' } });

  return reversal;
}

/**
 * فحص سلامة الدفتر: هل كل قيد مرحَّل متزن فعلاً في سطوره؟
 *
 * المجاميع المخزَّنة في رأس القيد قد تكذب لو كُتبت السطور من مسار آخر،
 * فهذا الفحص يقرأ السطور نفسها. يُشغَّل مجدولاً وقبل إقفال السنة.
 */
export async function auditLedgerIntegrity(tx: Tx, tenantId: string) {
  const rows = await tx.$queryRaw<
    { id: string; number: string; debit: string; credit: string }[]
  >`
    SELECT e."id", e."number",
           COALESCE(SUM(l."debit"), 0)::text  AS debit,
           COALESCE(SUM(l."credit"), 0)::text AS credit
    FROM "JournalEntry" e
    LEFT JOIN "JournalLine" l ON l."entryId" = e."id"
    WHERE e."tenantId" = ${tenantId} AND e."status" IN ('POSTED', 'REVERSED')
    GROUP BY e."id", e."number"
    HAVING COALESCE(SUM(l."debit"), 0) <> COALESCE(SUM(l."credit"), 0)
  `;

  return rows.map((r) => ({
    entryId: r.id,
    number: r.number,
    debit: d(r.debit).toFixed(2),
    credit: d(r.credit).toFixed(2),
    difference: d(r.debit).minus(d(r.credit)).toFixed(2),
  }));
}
