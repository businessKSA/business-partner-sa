/**
 * التسوية البنكية.
 *
 * كشفُ البنك والدفترُ لا يتطابقان أبداً في أي لحظة، ولا يُفترض أن يتطابقا:
 * شيكٌ صُرف ولم يُقدَّم، وحوالةٌ وصلت ولم تُقيَّد، ورسومٌ خصمها البنك ولم
 * يخبر أحداً. التسوية ليست إجبار الرقمين على التساوي، بل **تفسير الفرق
 * بينهما بنداً بنداً** حتى لا يبقى منه شيء بلا سبب.
 *
 * ولذلك مخرَج هذا الموديول ليس «مُسوّى / غير مُسوّى» بل كشفٌ يقول:
 * رصيد الدفتر كذا، ورصيد البنك كذا، والفرق يفسّره كذا وكذا.
 *
 * ── محرّك المطابقة ──────────────────────────────────────────────────────
 * يقترح ولا يقرّر. يعطي كل مقابلةٍ درجةَ ثقة من مئة، وما دون العتبة يبقى
 * معلّقاً لعينٍ بشرية. ثلاثة عوامل تصنع الدرجة:
 *
 *   ـ المبلغ: مطابقةٌ تامة أو لا مطابقة. المبلغ لا يُقارَب.
 *   ـ التاريخ: كلّما قرب، ارتفعت الثقة. الفارق يوماً أو يومان طبيعي
 *     (الحوالة تُقيَّد اليوم وتظهر في الكشف غداً).
 *   ـ المرجع: رقم الحوالة في وصف الكشف يرفع الثقة إلى اليقين تقريباً.
 *
 * ولماذا لا يُطابَق آلياً كل ما تطابق مبلغه وتاريخه؟ لأن دفعتين متساويتين
 * في اليوم نفسه — وهو شائع في الاشتراكات الشهرية — تجعل الاختيار بينهما
 * عشوائياً، والعشوائيةُ في التسوية أسوأ من التعليق.
 */
import type { Tx } from '../db.ts';
import { d, money, Decimal, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry } from '../accounting/posting.ts';

/** العتبة التي تُطابَق دونها آلياً — وما دونها يحتاج تأكيداً بشرياً. */
export const AUTO_MATCH_THRESHOLD = 85;

export type StatementLineInput = {
  valueDate: Date;
  descRaw: string;
  reference?: string | null;
  /** موجب وارد، سالب صادر — كما في الكشف */
  amount: Num;
  runningBalance?: Num | null;
};

/** سطرٌ خرج من قارئ الملف: مبلغه محسوم النوع، فلا يحتاج المتصل إلى تحويله. */
export type ParsedStatementLine = StatementLineInput & {
  amount: Decimal;
  runningBalance: Decimal | null;
};

export type ImportInput = {
  bankAccountId: string;
  reference?: string | null;
  fromDate: Date;
  toDate: Date;
  openingBalance: Num;
  closingBalance: Num;
  lines: StatementLineInput[];
  createdBy?: string;
};

/**
 * يستورد كشف حساب.
 *
 * ويتحقّق من صحّته قبل قبوله: الافتتاحي زائد مجموع الحركات يجب أن يساوي
 * الختامي. كشفٌ لا يتزن يعني سطراً ضاع في التحويل أو ملفاً مبتوراً —
 * وقبولُه يعني تسويةً تُبنى على بيانات ناقصة.
 */
export async function importStatement(tx: Tx, tenantId: string, input: ImportInput) {
  if (!input.lines.length) throw new ValidationError('الكشف بلا سطور.');
  if (input.toDate < input.fromDate) {
    throw new ValidationError('تاريخ نهاية الكشف قبل بدايته.');
  }

  const bank = await tx.bankAccount.findFirst({
    where: { id: input.bankAccountId, tenantId },
  });
  if (!bank) throw new DomainError('الحساب البنكي غير موجود', 'NOT_FOUND');

  const opening = money(input.openingBalance);
  const closing = money(input.closingBalance);
  const movement = money(input.lines.reduce((s, l) => s.plus(d(l.amount)), new Decimal(0)));
  const expected = money(opening.plus(movement));

  if (!expected.equals(closing)) {
    throw new ValidationError(
      `الكشف لا يتزن: الافتتاحي ${opening.toFixed(2)} + الحركات ${movement.toFixed(2)} ` +
        `= ${expected.toFixed(2)}، والختامي المذكور ${closing.toFixed(2)}. ` +
        `الفرق ${money(closing.minus(expected)).toFixed(2)} — راجِع الملف قبل الاستيراد.`,
    );
  }

  return tx.bankStatement.create({
    data: {
      tenantId,
      bankAccountId: input.bankAccountId,
      reference: input.reference ?? null,
      fromDate: input.fromDate,
      toDate: input.toDate,
      openingBalance: opening.toFixed(6),
      closingBalance: closing.toFixed(6),
      createdBy: input.createdBy ?? null,
      lines: {
        create: input.lines.map((l, i) => ({
          tenantId,
          valueDate: l.valueDate,
          descRaw: l.descRaw,
          reference: l.reference ?? null,
          amount: money(l.amount).toFixed(6),
          runningBalance: l.runningBalance != null ? money(l.runningBalance).toFixed(6) : null,
          sortOrder: i,
        })),
      },
    },
    include: { lines: true },
  });
}

/**
 * يقرأ كشفاً بصيغة CSV.
 *
 * الأعمدة المتوقَّعة: التاريخ، الوصف، المرجع، المبلغ، الرصيد.
 * والتاريخ يُقبل بصيغتَي `YYYY-MM-DD` و`DD/MM/YYYY` لأن البنوك تختلف.
 */
export function parseCsv(csv: string): ParsedStatementLine[] {
  const rows = csv.split(/\r?\n/).filter((r) => r.trim());
  if (!rows.length) throw new ValidationError('الملف فارغ.');

  // يُتخطّى صف العناوين إن وُجد
  const first = rows[0].toLowerCase();
  const start = /date|تاريخ|amount|مبلغ/.test(first) ? 1 : 0;

  const out: ParsedStatementLine[] = [];
  for (let i = start; i < rows.length; i++) {
    const cells = splitCsvRow(rows[i]);
    if (cells.length < 3) continue;

    const [dateRaw, desc, ref, amountRaw, balanceRaw] = cells;
    const valueDate = parseDate(dateRaw);
    if (!valueDate) {
      throw new ValidationError(`السطر ${i + 1}: تاريخ غير مقروء «${dateRaw}».`);
    }

    const amount = parseAmount(amountRaw ?? '');
    if (amount === null) {
      throw new ValidationError(`السطر ${i + 1}: مبلغ غير مقروء «${amountRaw}».`);
    }

    out.push({
      valueDate,
      descRaw: (desc ?? '').trim(),
      reference: (ref ?? '').trim() || null,
      amount,
      runningBalance: balanceRaw ? parseAmount(balanceRaw) : null,
    });
  }

  if (!out.length) throw new ValidationError('لم يُقرأ أي سطر من الملف.');
  return out;
}

function splitCsvRow(row: string): string[] {
  const cells: string[] = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') {
      if (inQuotes && row[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseDate(s: string): Date | null {
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}

function parseAmount(s: string): Decimal | null {
  // تُزال الفواصل الألفية ورموز العملة، ويُقبل السالب بين قوسين
  const t = s.trim().replace(/[,\s]/g, '').replace(/[^\d.()\-+]/g, '');
  if (!t) return null;
  const negated = /^\(.*\)$/.test(t);
  const clean = t.replace(/[()]/g, '');
  if (!/^[+-]?\d*\.?\d+$/.test(clean)) return null;
  const v = new Decimal(clean);
  return negated ? v.negated() : v;
}

/** درجة ثقة مقابلةٍ بين سطر كشف وسطر دفتر. */
export function matchScore(
  statement: { valueDate: Date; amount: Num; descRaw: string; reference?: string | null },
  ledger: { date: Date; amount: Num; reference?: string | null },
): number {
  // المبلغ لا يُقارَب: اختلافه يعني أنهما ليسا الحركة نفسها.
  if (!money(statement.amount).equals(money(ledger.amount))) return 0;

  let score = 60; // المبلغ وحده يعطي الأساس

  const days = Math.abs(
    Math.round((statement.valueDate.getTime() - ledger.date.getTime()) / 86_400_000),
  );
  if (days === 0) score += 25;
  else if (days <= 2) score += 18;
  else if (days <= 5) score += 10;
  else if (days <= 10) score += 4;
  else score -= 10; // فارقٌ كبير يُضعف الترجيح ولا يُلغيه

  // المرجع في وصف الكشف — أقوى إشارة بعد المبلغ
  const ref = ledger.reference?.trim();
  if (ref && ref.length >= 4) {
    const hay = `${statement.descRaw} ${statement.reference ?? ''}`.toLowerCase();
    if (hay.includes(ref.toLowerCase())) score += 20;
  }

  return Math.max(0, Math.min(100, score));
}

type Candidate = {
  journalLineId: string;
  entryNumber: string;
  date: Date;
  amount: Decimal;
  descAr: string;
  reference: string | null;
  score: number;
};

/**
 * يقترح مقابلات لكل سطر غير مطابق.
 *
 * يقرأ سطور الدفتر على حساب البنك التي لم تُطابَق بعد، ويرتّب المرشّحين
 * بالدرجة. المرشّح الأعلى يُطابَق آلياً بشرطين: أن يتجاوز العتبة، وأن يكون
 * **متفرّداً** — فوجود مرشّحين بالدرجة نفسها يعني أن الاختيار عشوائي.
 */
export async function suggestMatches(tx: Tx, tenantId: string, statementId: string) {
  const statement = await tx.bankStatement.findFirst({
    where: { id: statementId, tenantId },
    include: {
      bankAccount: true,
      lines: { where: { status: 'UNMATCHED' }, orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!statement) throw new DomainError('الكشف غير موجود', 'NOT_FOUND');

  // سطور الدفتر على حساب البنك في المدى، غير المطابَقة بعد
  const matched = await tx.bankStatementLine.findMany({
    where: { tenantId, journalLineId: { not: null } },
    select: { journalLineId: true },
  });
  const usedIds = new Set(matched.map((m) => m.journalLineId!));

  const from = new Date(statement.fromDate);
  from.setUTCDate(from.getUTCDate() - 10); // هامش: قيدٌ سابق يظهر في هذا الكشف
  const to = new Date(statement.toDate);
  to.setUTCDate(to.getUTCDate() + 10);

  const ledgerLines = await tx.journalLine.findMany({
    where: {
      tenantId,
      accountId: statement.bankAccount.accountId,
      entry: { status: { in: ['POSTED', 'REVERSED'] }, date: { gte: from, lte: to } },
    },
    include: { entry: { select: { number: true, date: true, ref: true, memoAr: true } } },
  });

  const available = ledgerLines
    .filter((l) => !usedIds.has(l.id))
    .map((l) => ({
      id: l.id,
      entryNumber: l.entry.number,
      date: l.entry.date,
      // المدين وارد والدائن صادر — بإشارة الكشف نفسها
      amount: money(d(l.debit).minus(d(l.credit))),
      descAr: l.descAr ?? l.entry.memoAr ?? '',
      reference: l.entry.ref,
    }));

  const suggestions = statement.lines.map((line) => {
    const candidates: Candidate[] = available
      .map((c) => ({
        journalLineId: c.id,
        entryNumber: c.entryNumber,
        date: c.date,
        amount: c.amount,
        descAr: c.descAr,
        reference: c.reference,
        score: matchScore(
          { valueDate: line.valueDate, amount: line.amount, descRaw: line.descRaw, reference: line.reference },
          { date: c.date, amount: c.amount, reference: c.reference },
        ),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const runnerUp = candidates[1];
    // التفرّد شرطٌ للمطابقة الآلية: مرشّحان بالدرجة نفسها يجعلان الاختيار
    // عشوائياً، والعشوائية في التسوية أسوأ من التعليق.
    const unique = !!best && (!runnerUp || runnerUp.score < best.score);
    const autoMatchable = !!best && best.score >= AUTO_MATCH_THRESHOLD && unique;

    return {
      lineId: line.id,
      valueDate: line.valueDate,
      descRaw: line.descRaw,
      amount: money(line.amount),
      candidates: candidates.slice(0, 5),
      best: best ?? null,
      autoMatchable,
      ambiguous: !!best && !unique,
    };
  });

  return { statement, suggestions };
}

/** يطبّق المقابلات التي تجاوزت العتبة وكانت متفرّدة. */
export async function autoMatch(tx: Tx, tenantId: string, statementId: string, actor?: string) {
  const { suggestions } = await suggestMatches(tx, tenantId, statementId);

  let matched = 0;
  const used = new Set<string>();

  for (const s of suggestions) {
    if (!s.autoMatchable || !s.best) continue;
    // سطر دفترٍ واحد لا يُطابَق سطرَي كشف
    if (used.has(s.best.journalLineId)) continue;

    await tx.bankStatementLine.update({
      where: { id: s.lineId },
      data: {
        status: 'MATCHED',
        journalLineId: s.best.journalLineId,
        matchScore: s.best.score,
        matchedBy: actor ?? 'auto',
        matchedAt: new Date(),
      },
    });
    used.add(s.best.journalLineId);
    matched++;
  }

  await tx.bankStatement.update({
    where: { id: statementId },
    data: { status: 'RECONCILING' },
  });

  return { matched, total: suggestions.length };
}

/** مطابقة يدوية — يؤكّدها المستخدم لما لم تبلغ العتبة أو كان ملتبساً. */
export async function matchLine(
  tx: Tx,
  tenantId: string,
  lineId: string,
  journalLineId: string,
  actor?: string,
) {
  const line = await tx.bankStatementLine.findFirst({ where: { id: lineId, tenantId } });
  if (!line) throw new DomainError('سطر الكشف غير موجود', 'NOT_FOUND');
  if (line.status === 'MATCHED') {
    throw new DomainError('السطر مطابَق سلفاً. ألغِ المطابقة أولاً.', 'ALREADY_MATCHED');
  }

  const taken = await tx.bankStatementLine.findFirst({
    where: { tenantId, journalLineId },
  });
  if (taken) {
    throw new DomainError(
      'سطر الدفتر هذا مطابَقٌ بسطر كشفٍ آخر — لا يُطابَق مرّتين.',
      'LEDGER_LINE_TAKEN',
    );
  }

  const ledger = await tx.journalLine.findFirst({
    where: { id: journalLineId, tenantId },
    include: { entry: { select: { date: true, ref: true } } },
  });
  if (!ledger) throw new DomainError('سطر الدفتر غير موجود', 'NOT_FOUND');

  const ledgerAmount = money(d(ledger.debit).minus(d(ledger.credit)));
  if (!ledgerAmount.equals(money(line.amount))) {
    throw new ValidationError(
      `المبلغان مختلفان: الكشف ${money(line.amount).toFixed(2)} والدفتر ${ledgerAmount.toFixed(2)}. ` +
        `المطابقة تشترط تساوي المبلغ.`,
    );
  }

  return tx.bankStatementLine.update({
    where: { id: lineId },
    data: {
      status: 'MATCHED',
      journalLineId,
      matchScore: matchScore(
        { valueDate: line.valueDate, amount: line.amount, descRaw: line.descRaw, reference: line.reference },
        { date: ledger.entry.date, amount: ledgerAmount, reference: ledger.entry.ref },
      ),
      matchedBy: actor ?? null,
      matchedAt: new Date(),
    },
  });
}

export async function unmatchLine(tx: Tx, tenantId: string, lineId: string) {
  const line = await tx.bankStatementLine.findFirst({ where: { id: lineId, tenantId } });
  if (!line) throw new DomainError('سطر الكشف غير موجود', 'NOT_FOUND');

  return tx.bankStatementLine.update({
    where: { id: lineId },
    data: { status: 'UNMATCHED', journalLineId: null, matchScore: null, matchedBy: null, matchedAt: null },
  });
}

/**
 * يُنشئ قيد تسوية لسطرٍ لا يقابله شيء في الدفتر.
 *
 * الحالة الشائعة: رسومٌ بنكية، أو فائدة، أو خصمٌ لم يُبلَّغ. القيد يُثبتها
 * ثم يُطابَق السطر بالسطر الناتج — فلا يبقى بندٌ في الكشف بلا تفسير.
 */
export async function createAdjustment(
  tx: Tx,
  tenantId: string,
  lineId: string,
  input: { counterAccountId: string; descAr?: string; actor?: string },
) {
  const line = await tx.bankStatementLine.findFirst({
    where: { id: lineId, tenantId },
    include: { statement: { include: { bankAccount: true } } },
  });
  if (!line) throw new DomainError('سطر الكشف غير موجود', 'NOT_FOUND');
  if (line.status === 'MATCHED') {
    throw new DomainError('السطر مطابَق سلفاً.', 'ALREADY_MATCHED');
  }

  const amount = money(line.amount);
  const inbound = amount.greaterThan(0);
  const bankAccountId = line.statement.bankAccount.accountId;
  const desc = input.descAr ?? line.descRaw;

  const entry = await postEntry(tx, tenantId, {
    date: line.valueDate,
    memoAr: `تسوية بنكية — ${desc}`,
    ref: line.reference ?? undefined,
    sourceType: 'BANK_ADJUSTMENT',
    sourceId: line.id,
    createdBy: input.actor,
    lines: inbound
      ? [
          { accountId: bankAccountId, debit: amount.abs(), descAr: desc },
          { accountId: input.counterAccountId, credit: amount.abs(), descAr: desc },
        ]
      : [
          { accountId: bankAccountId, credit: amount.abs(), descAr: desc },
          { accountId: input.counterAccountId, debit: amount.abs(), descAr: desc },
        ],
  });

  // يُطابَق السطر بسطر البنك في القيد الجديد
  const bankLine = entry.lines.find((l) => l.accountId === bankAccountId)!;

  await tx.bankStatementLine.update({
    where: { id: lineId },
    data: {
      status: 'MATCHED',
      journalLineId: bankLine.id,
      matchScore: 100,
      matchedBy: input.actor ?? null,
      matchedAt: new Date(),
      adjustmentEntryId: entry.id,
    },
  });

  return entry;
}

/**
 * كشف التسوية.
 *
 * لا يقول «مُسوّى» أو «غير مُسوّى» فحسب، بل **يفسّر الفرق**: رصيد البنك،
 * زائداً ما في الدفتر ولم يظهر في الكشف، ناقصاً ما في الكشف ولم يُقيَّد،
 * يساوي رصيد الدفتر. وهذا هو الشكل الذي يُقدَّم للمدقّق.
 */
export async function reconciliationReport(tx: Tx, tenantId: string, statementId: string) {
  const statement = await tx.bankStatement.findFirst({
    where: { id: statementId, tenantId },
    include: {
      bankAccount: true,
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!statement) throw new DomainError('الكشف غير موجود', 'NOT_FOUND');

  // رصيد الدفتر حتى نهاية الكشف
  const agg = await tx.$queryRaw<{ debit: string; credit: string }[]>`
    SELECT COALESCE(SUM(l."debit"),0)::text AS debit, COALESCE(SUM(l."credit"),0)::text AS credit
    FROM "JournalLine" l JOIN "JournalEntry" e ON e."id" = l."entryId"
    WHERE l."tenantId" = ${tenantId}
      AND l."accountId" = ${statement.bankAccount.accountId}
      AND e."status" IN ('POSTED','REVERSED')
      AND e."date" <= ${statement.toDate}
  `;
  const bookBalance = money(d(agg[0]?.debit).minus(d(agg[0]?.credit)));

  // المعادلة تُقاس على تاريخٍ لا على كشف: كل ما ورد في كشوف هذا الحساب حتى
  // نهاية هذا الكشف يدخل فيها. لو قِسناها على سطور هذا الكشف وحده، لعادت
  // قيودُ الشهر الماضي — وقد ظهرت في كشف الشهر الماضي ودخلت في رصيد البنك —
  // لتُحسب «معلّقة» من جديد، فيخرج فرقٌ وهميّ يساوي حركةَ الشهر الماضي كلّها.
  const priorLines = await tx.bankStatementLine.findMany({
    where: {
      tenantId,
      statement: { bankAccountId: statement.bankAccountId, toDate: { lte: statement.toDate } },
    },
    select: { id: true, valueDate: true, descRaw: true, amount: true, status: true, journalLineId: true },
  });

  // بنودٌ في هذا الكشف لم تُقيَّد بعد — وهي ما يمنع القفل
  const unmatchedStatement = statement.lines
    .filter((l) => l.status === 'UNMATCHED')
    .map((l) => ({
      id: l.id, valueDate: l.valueDate, descRaw: l.descRaw,
      amount: money(l.amount),
    }));

  // وهذه كلُّ البنود غير المقيَّدة حتى التاريخ — بها تُحسب المعادلة
  const unrecordedLines = priorLines
    .filter((l) => l.status === 'UNMATCHED')
    .map((l) => ({
      id: l.id, valueDate: l.valueDate, descRaw: l.descRaw,
      amount: money(l.amount),
    }));

  // بنودٌ في الدفتر لم تظهر في أي كشف حتى الآن
  const matchedIds = new Set(
    priorLines.filter((l) => l.journalLineId).map((l) => l.journalLineId!),
  );

  const ledgerLines = await tx.journalLine.findMany({
    where: {
      tenantId,
      accountId: statement.bankAccount.accountId,
      entry: { status: { in: ['POSTED', 'REVERSED'] }, date: { lte: statement.toDate } },
    },
    include: { entry: { select: { number: true, date: true, memoAr: true } } },
  });

  const unmatchedLedger = ledgerLines
    .filter((l) => !matchedIds.has(l.id))
    .map((l) => ({
      id: l.id,
      entryNumber: l.entry.number,
      date: l.entry.date,
      descAr: l.descAr ?? l.entry.memoAr ?? '',
      amount: money(d(l.debit).minus(d(l.credit))),
    }))
    .filter((l) => !l.amount.isZero());

  const outstandingLedger = money(
    unmatchedLedger.reduce((s, l) => s.plus(l.amount), new Decimal(0)),
  );
  const unrecordedStatement = money(
    unrecordedLines.reduce((s, l) => s.plus(l.amount), new Decimal(0)),
  );

  // المعادلة: رصيد البنك + ما في الدفتر ولم يظهر في الكشف − ما في الكشف ولم
  // يُقيَّد = رصيد الدفتر.
  //
  // والجمع والطرح هنا معكوسان عمّا في كتب المحاسبة، وذلك مقصود: الكتب تقول
  // «ناقصاً الشيكات المعلّقة زائداً الإيداعات في الطريق» لأنها تتعامل مع
  // مبالغ موجبة وتحمل الاتجاه في الكلام. أمّا هنا فالمبالغ موصوفة بإشارتها
  // أصلاً — الشيك المعلّق سالبٌ في الدفتر — فطرحُه ثانيةً يضاعفه بدل أن
  // يلغيه. الإشارة تُقرأ من الرقم لا من اسم البند.
  const adjustedBank = money(
    money(statement.closingBalance).plus(outstandingLedger).minus(unrecordedStatement),
  );
  const difference = money(bookBalance.minus(adjustedBank));

  return {
    statement,
    bankBalance: money(statement.closingBalance),
    bookBalance,
    outstandingLedger,
    unrecordedStatement,
    adjustedBank,
    difference,
    /** صفرٌ يعني أن كل ريال في الفرق له تفسير */
    explained: difference.isZero(),
    unmatchedStatement,
    unrecordedLines,
    unmatchedLedger,
    matchedCount: statement.lines.filter((l) => l.status === 'MATCHED').length,
    totalLines: statement.lines.length,
  };
}

/**
 * يقفل التسوية.
 *
 * لا تُقفل ما دام في الكشف سطرٌ غير مفسَّر: القفل إقرارٌ بأن الفرق كلّه
 * مفهوم، وإقرارٌ على بندٍ مجهول لا معنى له.
 */
export async function finalizeReconciliation(
  tx: Tx,
  tenantId: string,
  statementId: string,
  actor?: string,
) {
  const report = await reconciliationReport(tx, tenantId, statementId);

  const pending = report.unmatchedStatement.length;
  if (pending > 0) {
    throw new DomainError(
      `في الكشف ${pending} سطراً بلا تفسير. طابِقها أو أنشئ لها قيود تسوية قبل القفل.`,
      'UNEXPLAINED_LINES',
      { pending },
    );
  }

  if (!report.explained) {
    throw new DomainError(
      `الفرق ${report.difference.toFixed(2)} ريالاً لا يفسّره شيء. راجِع البنود المعلّقة.`,
      'UNEXPLAINED_DIFFERENCE',
      { difference: report.difference.toFixed(2) },
    );
  }

  return tx.bankStatement.update({
    where: { id: statementId },
    data: {
      status: 'RECONCILED',
      reconciledAt: new Date(),
      reconciledBy: actor ?? null,
    },
  });
}
