/**
 * DocuSign Connect (Webhook) — استقبال تحديثات حالة الظرف:
 * sent / delivered / completed / declined / voided
 * ويُحدَّث حالة العقد في النظام تلقائياً ويصلني إشعار بالبريد عند كل تغيير.
 */
import { prisma } from '../db';
import { hmac, safeEqual } from '../tokens';
import { logEvent, audit } from '../timeline';
import { DOC_STATUS, ENVELOPE_STATUS_LABEL } from '../enums';
import { notifyEvent, composeClientMail } from '../send';
import { fmtDateTime } from '../money';
import { sendMail } from '../mailer';
import { storage } from '../storage';
import { downloadSignedDocuments } from './service';
import { queue, JOB } from '../queue';

/** الموقّع كما يصفه DocuSign داخل recipients.signers. */
interface ConnectSigner {
  recipientId?: string;
  name?: string;
  email?: string;
  status?: string;
  sentDateTime?: string;
  deliveredDateTime?: string;
  signedDateTime?: string;
  declinedDateTime?: string;
  ipAddress?: string;
  userAgentString?: string;
  clientUserId?: string;
}

export interface ConnectEvent {
  event?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      recipients?: { signers?: ConnectSigner[] };
    };
  };
  envelopeId?: string;
  status?: string;
}

function asDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * يحفظ أثر كل موقّع على حدة.
 *
 * `recipients` مطلوبة أصلاً في eventNotification وتصل مع كل حدث، وكانت
 * تُرمى في lastEventRaw ولا تُقرأ. الحفظ تراكمي: الحدث اللاحق لا يمحو
 * تاريخاً أثبته حدث سابق — DocuSign قد يرسل الحقل فارغاً في حدث تالٍ.
 */
export async function recordSigners(envelopeDbId: string, payload: ConnectEvent): Promise<number> {
  const signers = payload.data?.envelopeSummary?.recipients?.signers ?? [];
  let saved = 0;

  for (const s of signers) {
    const recipientId = String(s.recipientId ?? '').trim();
    if (!recipientId || !s.email) continue;

    // الترتيب في القالب: «1» العميل و«2» بزنس بارتنر
    const role = recipientId === '2' ? 'bp' : 'client';
    const fresh = {
      sentAt: asDate(s.sentDateTime),
      deliveredAt: asDate(s.deliveredDateTime),
      signedAt: asDate(s.signedDateTime),
      declinedAt: asDate(s.declinedDateTime),
      ipAddress: s.ipAddress || null,
      userAgent: s.userAgentString ? s.userAgentString.slice(0, 500) : null,
    };
    // لا يُكتب فوق قيمة موجودة بقيمة فارغة
    const keep = <T>(next: T | null, prev: T | null | undefined): T | null =>
      next ?? (prev ?? null);

    const existing = await prisma.signature.findUnique({
      where: { envelopeDbId_recipientId: { envelopeDbId, recipientId } },
    });

    const data = {
      role,
      name: s.name || existing?.name || s.email,
      email: s.email,
      status: (s.status || existing?.status || 'sent').toLowerCase(),
      sentAt: keep(fresh.sentAt, existing?.sentAt),
      deliveredAt: keep(fresh.deliveredAt, existing?.deliveredAt),
      signedAt: keep(fresh.signedAt, existing?.signedAt),
      declinedAt: keep(fresh.declinedAt, existing?.declinedAt),
      ipAddress: keep(fresh.ipAddress, existing?.ipAddress),
      userAgent: keep(fresh.userAgent, existing?.userAgent),
    };

    await prisma.signature.upsert({
      where: { envelopeDbId_recipientId: { envelopeDbId, recipientId } },
      create: { envelopeDbId, recipientId, ...data },
      update: data,
    });
    saved += 1;
  }
  return saved;
}

/**
 * التحقق من توقيع DocuSign Connect (HMAC-SHA256, base64) من ترويسة
 * X-DocuSign-Signature-1. يُتخطى فقط عندما لا يكون السر معرّفاً.
 */
export function verifyConnectSignature(rawBody: string, signatureHeader: string | null): boolean {
  const key = process.env.DOCUSIGN_CONNECT_HMAC_KEY;
  if (!key) return true; // لم يُفعَّل التحقق بعد
  if (!signatureHeader) return false;
  const expected = hmac(key, rawBody, 'base64');
  return expected.length === signatureHeader.length && safeEqual(expected, signatureHeader);
}

const STATUS_MAP: Record<string, string> = {
  'envelope-sent': 'sent',
  'envelope-delivered': 'delivered',
  'envelope-completed': 'completed',
  'envelope-declined': 'declined',
  'envelope-voided': 'voided',
};

export function parseEvent(payload: ConnectEvent): { envelopeId: string | null; status: string | null } {
  const envelopeId = payload.data?.envelopeId ?? payload.envelopeId ?? null;
  const raw = payload.event ?? payload.status ?? payload.data?.envelopeSummary?.status ?? null;
  if (!raw) return { envelopeId, status: null };
  const status = STATUS_MAP[raw.toLowerCase()] ?? raw.toLowerCase();
  return { envelopeId, status };
}

/** المعالج الموحّد لكل تحديثات الحالة — يُستخدم من الـwebhook ومن وضع المحاكاة. */
export async function applyEnvelopeStatus(
  envelopeId: string,
  status: string,
  raw?: unknown,
): Promise<{ ok: boolean; message: string }> {
  const env = await prisma.envelope.findUnique({
    where: { envelopeId },
    include: { document: { include: { client: true } } },
  });
  if (!env) return { ok: false, message: `ظرف غير معروف: ${envelopeId}` };
  if (env.status === status && status !== 'completed') {
    return { ok: true, message: 'لا تغيير' };
  }

  const now = new Date();
  const stamps: Record<string, Partial<Record<'sentAt' | 'deliveredAt' | 'completedAt' | 'declinedAt' | 'voidedAt', Date>>> = {
    sent: { sentAt: now },
    delivered: { deliveredAt: now },
    completed: { completedAt: now },
    declined: { declinedAt: now },
    voided: { voidedAt: now },
  };

  await prisma.envelope.update({
    where: { id: env.id },
    data: {
      status,
      ...(stamps[status] ?? {}),
      lastEventRaw: raw ? JSON.stringify(raw).slice(0, 8000) : null,
    },
  });

  // أثر الموقّعين يُحفظ عند كل حدث لا عند الإتمام وحده، فحدث «وقّع الأول»
  // هو الوحيد الذي يحمل توقيته، ولا يعود إن انتُظر به إلى النهاية.
  if (raw) {
    await recordSigners(env.id, raw as ConnectEvent).catch(() => 0);
  }

  const label = ENVELOPE_STATUS_LABEL[status] ?? { ar: status, en: status };
  const doc = env.document;

  // حالة العقد في النظام تتبع حالة الظرف
  let docStatus: string | null = null;
  if (status === 'completed') docStatus = DOC_STATUS.SIGNED;
  else if (status === 'declined') docStatus = DOC_STATUS.REJECTED;
  else if (status === 'voided') docStatus = DOC_STATUS.CANCELLED;
  else if (status === 'sent' || status === 'delivered') docStatus = DOC_STATUS.SIGNING;

  if (docStatus) {
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: docStatus,
        ...(status === 'completed' ? { signedAt: now } : {}),
        ...(status === 'declined' ? { rejectedAt: now } : {}),
      },
    });
  }

  await logEvent({
    entityType: 'document',
    entityId: doc.id,
    clientId: doc.clientId,
    code: `DOCUSIGN_${status.toUpperCase()}`,
    titleAr: `DocuSign — ${label.ar} للعقد ${doc.number}`,
    titleEn: `DocuSign — ${label.en} for agreement ${doc.number}`,
    actor: 'docusign',
    actorKind: 'docusign',
    meta: { envelopeId, status },
  });

  // اكتمال التوقيع: تنزيل النسخة الموقّعة وشهادة الإتمام وإرسالهما للطرفين
  if (status === 'completed') {
    try {
      const { signedKey, certKey } = await downloadSignedDocuments(env.id);
      await audit({
        action: 'CONTRACT_SIGNED',
        entityType: 'document',
        entityId: doc.id,
        actor: 'docusign',
        amount: doc.total,
        payload: { envelopeId, signedKey, certKey },
      });
      await emailSignedCopies(env.id);
      await logEvent({
        entityType: 'document',
        entityId: doc.id,
        clientId: doc.clientId,
        code: 'SIGNED_ARCHIVED',
        titleAr: `حُفظت النسخة الموقّعة وشهادة الإتمام في مجلد العقود وأُرسلتا للطرفين`,
        titleEn: `Signed copy and Certificate of Completion archived in the Contracts folder and emailed to both parties`,
        actor: 'system',
        actorKind: 'system',
      });
    } catch (e) {
      await logEvent({
        entityType: 'document',
        entityId: doc.id,
        clientId: doc.clientId,
        code: 'SIGNED_ARCHIVE_FAILED',
        titleAr: `تعذّر تنزيل النسخة الموقّعة: ${e instanceof Error ? e.message : String(e)}`,
        titleEn: `Could not download the signed copy: ${e instanceof Error ? e.message : String(e)}`,
        actor: 'system',
        actorKind: 'system',
        clientVisible: false,
      });
    }
  }

  await notifyEvent(
    `DocuSign ${label.en}`,
    doc.number,
    doc.client.companyAr || doc.client.nameAr,
    `envelope ${envelopeId} — status ${status}`,
    `${process.env.APP_URL || 'http://localhost:3000'}/admin/documents/${doc.id}`,
  );

  return { ok: true, message: `تم تحديث الظرف ${envelopeId} إلى ${status}` };
}

/** إرسال النسخة الموقّعة وشهادة الإتمام للعميل ولي. */
export async function emailSignedCopies(envelopeDbId: string) {
  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeDbId },
    include: {
      document: { include: { client: true } },
      signatures: { orderBy: { recipientId: 'asc' } },
    },
  });
  if (!env.signedPdfPath) return;
  const doc = env.document;
  const portal = `${process.env.APP_URL || 'http://localhost:3000'}/portal/contracts`;

  // من وقّع، بأي بريد، ومتى بالضبط — هذا ما يُسأل عنه عند أي نزاع، فيصل
  // في الرسالة نفسها لا في مرفق يحتاج فتحاً. التوقيت بـUTC بلا تحويل:
  // منطقة زمنية محلية تجعل الطرفين يقرآن ساعتين مختلفتين للحدث نفسه.
  const signedParties = env.signatures.filter((s) => s.signedAt);
  const partyTable = signedParties.length
    ? {
        heading: 'أطراف التوقيع',
        columns: ['الطرف', 'البريد الإلكتروني', 'وقت التوقيع'],
        rows: signedParties.map((s) => [s.name, s.email, fmtDateTime(s.signedAt, 'ar')]),
      }
    : undefined;

  const s = storage();
  const attachments = [
    {
      filename: `${doc.number}-signed.pdf`,
      content: await s.get(env.signedPdfPath),
      contentType: 'application/pdf',
    },
  ];
  if (env.certPath && (await s.exists(env.certPath))) {
    attachments.push({
      filename: env.certPath.split('/').pop() || 'certificate-of-completion.pdf',
      content: await s.get(env.certPath),
      contentType: env.certPath.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
    });
  }

  for (const to of [doc.client.email, env.bpEmail]) {
    const isClient = to === doc.client.email;
    const nameAr = isClient ? doc.client.companyAr || doc.client.nameAr : env.bpName;
    const nameEn = isClient
      ? doc.client.companyEn || doc.client.nameEn || doc.client.nameAr
      : env.bpName;
    const composed = composeClientMail(
      'signedCopy',
      { number: doc.number, clientName: nameAr },
      {
        // نسخة الطرف الآخر تفتح البوابة أيضاً، ومرفقاتها هي نفسها
        ctaUrl: isClient ? portal : undefined,
        table: partyTable,
        refs: [
          { label: 'رقم العقد', value: doc.number },
          { label: 'الطرف المتعاقد', value: nameAr },
          { label: 'حالة التوقيع', value: 'موقّع من الطرفين' },
          { label: 'معرّف الظرف', value: env.envelopeId },
        ],
        extraNotes: [
          'شهادة الإتمام المرفقة تحمل الأثر الكامل لكل حدث: من أرسل ومن وقّع ومتى ومن أي عنوان.',
        ],
        enRows: [
          { label: 'Agreement number', value: doc.number },
          { label: 'Party', value: nameEn },
          { label: 'Signature status', value: 'Signed by both parties' },
          ...signedParties.map((s) => ({
            label: `Signed by ${s.name}`,
            value: `${s.email} — ${fmtDateTime(s.signedAt, 'en')}`,
          })),
        ],
        enUrl: isClient ? portal : undefined,
      },
    );
    const result = await sendMail({
      to,
      subject: composed.subject,
      text: composed.text,
      html: composed.html,
      attachments,
    });
    await prisma.delivery.create({
      data: {
        documentId: doc.id,
        channel: 'EMAIL',
        toAddress: to,
        subject: composed.subject,
        body: composed.text,
        status: result.ok ? 'SENT' : 'FAILED',
        error: result.error ?? null,
        meta: JSON.stringify({ kind: 'signed-copy', provider: result.provider }),
        actor: 'system',
      },
    });
  }
}
