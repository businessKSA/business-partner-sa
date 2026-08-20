/**
 * DocuSign Connect (Webhook) — استقبال تحديثات حالة الظرف:
 * sent / delivered / completed / declined / voided
 * ويُحدَّث حالة العقد في النظام تلقائياً ويصلني إشعار بالبريد عند كل تغيير.
 */
import { prisma } from '../db';
import { hmac, safeEqual } from '../tokens';
import { logEvent, audit } from '../timeline';
import { DOC_STATUS, ENVELOPE_STATUS_LABEL } from '../enums';
import { notifyEvent } from '../send';
import { sendMail } from '../mailer';
import { loadTemplate, render } from '../templates';
import { storage } from '../storage';
import { downloadSignedDocuments } from './service';

export interface ConnectEvent {
  event?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: { status?: string; recipients?: unknown };
  };
  envelopeId?: string;
  status?: string;
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

interface MsgTpl {
  email: Record<string, { subject: { ar: string; en: string }; bodyEn?: string; bodyAr?: string }>;
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
    include: { document: { include: { client: true } } },
  });
  if (!env.signedPdfPath) return;
  const doc = env.document;
  const tpl = loadTemplate<MsgTpl>('messages.json');
  const block = tpl.email.signedCopy;

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
    const vars = {
      number: doc.number,
      clientName: isClient ? doc.client.companyEn || doc.client.nameEn || doc.client.nameAr : env.bpName,
    };
    const text = `${render(block.bodyEn || '', vars)}\n\n${'-'.repeat(56)}\n\n${render(block.bodyAr || '', {
      ...vars,
      clientName: isClient ? doc.client.companyAr || doc.client.nameAr : env.bpName,
    })}`;
    const result = await sendMail({ to, subject: render(block.subject.en, vars), text, attachments });
    await prisma.delivery.create({
      data: {
        documentId: doc.id,
        channel: 'EMAIL',
        toAddress: to,
        subject: render(block.subject.en, vars),
        body: text,
        status: result.ok ? 'SENT' : 'FAILED',
        error: result.error ?? null,
        meta: JSON.stringify({ kind: 'signed-copy', provider: result.provider }),
        actor: 'system',
      },
    });
  }
}
