/**
 * الخط الزمني + سجل التدقيق.
 * كل حدث يُسجَّل مرة واحدة ولا يُعدَّل. الحركات المالية تُسلسَل بسلسلة تجزئة
 * (hash chain) بحيث يكشف أي تعديل لاحق نفسه عند التحقق.
 */
import { prisma } from './db';
import { sha256 } from './tokens';

export type EntityType =
  | 'client'
  | 'document'
  | 'invoice'
  | 'supply_request'
  | 'envelope'
  | 'supplier'
  | 'wallet';

export type ActorKind = 'admin' | 'client' | 'system' | 'docusign' | 'payment';

export interface EventInput {
  entityType: EntityType;
  entityId: string;
  clientId?: string | null;
  code: string;
  titleAr: string;
  titleEn: string;
  actor?: string;
  actorKind?: ActorKind;
  meta?: unknown;
  clientVisible?: boolean;
}

export async function logEvent(e: EventInput) {
  return prisma.timelineEvent.create({
    data: {
      entityType: e.entityType,
      entityId: e.entityId,
      clientId: e.clientId ?? null,
      code: e.code,
      titleAr: e.titleAr,
      titleEn: e.titleEn,
      actor: e.actor ?? 'system',
      actorKind: e.actorKind ?? 'system',
      meta: e.meta ? JSON.stringify(e.meta) : null,
      clientVisible: e.clientVisible ?? true,
    },
  });
}

export interface AuditInput {
  action: string;
  entityType: string;
  entityId: string;
  actor?: string;
  amount?: number | null;
  payload?: unknown;
}

/**
 * يُستدعى لكل حركة مالية. الإضافة فقط — لا تحديث ولا حذف.
 *
 * القيد مسلسل بقفل استشاري على مستوى قاعدة البيانات: كل قيد يقرأ تجزئة القيد
 * السابق ثم يبني عليها، فلو كتب نداءان معاً لقرآ نفس السابق وانكسرت السلسلة.
 * وهذا ليس احتمالاً نظرياً — بوابة الدفع ترسل نداء الرجوع وwebhook في اللحظة
 * نفسها. القفل يُحرَّر بانتهاء المعاملة تلقائياً حتى لو فشلت.
 */
const AUDIT_LOCK = 728314159;

export async function audit(a: AuditInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${AUDIT_LOCK})`);
    const last = await tx.auditLog.findFirst({ orderBy: { seq: 'desc' } });
    const prevHash = last?.hash ?? 'GENESIS';
    const payload = a.payload ? JSON.stringify(a.payload) : null;
    const body = [
      a.action,
      a.entityType,
      a.entityId,
      a.actor ?? 'system',
      a.amount ?? '',
      payload ?? '',
      prevHash,
    ].join('|');
    return tx.auditLog.create({
      data: {
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        actor: a.actor ?? 'system',
        amount: a.amount ?? null,
        payload,
        prevHash,
        hash: sha256(body),
      },
    });
  });
}

/** التحقق من سلامة سلسلة التدقيق. */
export async function verifyAuditChain(): Promise<{ ok: boolean; brokenAt?: number; count: number }> {
  const rows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
  let prev = 'GENESIS';
  for (const r of rows) {
    const body = [
      r.action,
      r.entityType,
      r.entityId,
      r.actor,
      r.amount ?? '',
      r.payload ?? '',
      prev,
    ].join('|');
    if (r.prevHash !== prev || sha256(body) !== r.hash) {
      return { ok: false, brokenAt: r.seq, count: rows.length };
    }
    prev = r.hash;
  }
  return { ok: true, count: rows.length };
}

export async function timelineFor(entityType: EntityType, entityId: string) {
  return prisma.timelineEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function clientJourney(clientId: string, onlyClientVisible = false) {
  return prisma.timelineEvent.findMany({
    where: { clientId, ...(onlyClientVisible ? { clientVisible: true } : {}) },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * حالة الرحلة الإجمالية للعميل كجملة واحدة — «أين وصل بالضبط».
 */
export async function journeyStatus(clientId: string): Promise<{ ar: string; en: string }> {
  const [docs, invoices, requests] = await Promise.all([
    prisma.document.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } }),
    prisma.invoice.findMany({ where: { clientId } }),
    prisma.supplyRequest.findMany({ where: { clientId } }),
  ]);

  const parts: { ar: string; en: string }[] = [];
  const contracts = docs.filter((d) => d.type !== 'QUOTE');
  const quotes = docs.filter((d) => d.type === 'QUOTE');

  const signed = contracts.filter((c) => c.status === 'SIGNED' || c.status === 'IN_PROGRESS');
  const signing = contracts.filter((c) => c.status === 'SIGNING');
  const acceptedQuotes = quotes.filter((q) => q.status === 'ACCEPTED');
  const sentQuotes = quotes.filter((q) => q.status === 'SENT');

  if (signed.length) parts.push({ ar: 'موقّع العقد', en: 'contract signed' });
  else if (signing.length) parts.push({ ar: 'العقد قيد التوقيع', en: 'contract out for signature' });
  else if (acceptedQuotes.length) parts.push({ ar: 'قبل عرض السعر', en: 'quotation accepted' });
  else if (sentQuotes.length) parts.push({ ar: 'عرض سعر مُرسَل', en: 'quotation sent' });
  else if (quotes.length) parts.push({ ar: 'عرض سعر مسودة', en: 'draft quotation' });

  const paid = invoices.filter((i) => i.status === 'PAID').sort((a, b) => a.sequence - b.sequence);
  if (paid.length === 1) parts.push({ ar: 'مدفوعة الدفعة الأولى', en: 'first instalment paid' });
  else if (paid.length > 1) parts.push({ ar: `مدفوعة ${paid.length} دفعات`, en: `${paid.length} instalments paid` });

  const due = invoices.filter((i) => i.status === 'DUE');
  if (due.length) parts.push({ ar: `${due.length} فاتورة مستحقة`, en: `${due.length} invoice(s) due` });

  const openReq = requests.filter((r) => !['COMPLETED', 'CANCELLED'].includes(r.status));
  if (openReq.length) parts.push({ ar: `${openReq.length} طلب توريد جارٍ`, en: `${openReq.length} supply request in progress` });

  const govPending = docs.some((d) => d.includeGovFees && (d.status === 'SIGNED' || d.status === 'IN_PROGRESS'));
  if (govPending) parts.push({ ar: 'بانتظار ترخيص وزارة الاستثمار', en: 'awaiting Ministry of Investment licence' });

  if (!parts.length) return { ar: 'عميل جديد — لا توجد مستندات بعد', en: 'New client — no documents yet' };
  return { ar: parts.map((p) => p.ar).join('، '), en: parts.map((p) => p.en).join(', ') };
}
