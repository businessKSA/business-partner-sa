/**
 * تكامل DocuSign eSignature REST API — معزول تماماً في هذه الوحدة.
 * إذا تعطّلت DocuSign يبقى النظام شغالاً وتظهر رسالة تنبيه للمستخدم.
 *
 * ترتيب التوقيع: 1) العميل  2) باهر مقنص (بزنس بارتنر).
 * مواضع الحقول تُحدَّد بعلامات Anchor مخفية بلون أبيض داخل الـPDF:
 *   /sig_client/ /date_client/ — خانة الطرف الثاني
 *   /sig_bp/     /date_bp/     — خانة الطرف الأول
 */
import { prisma } from './../db';
import { COMPANY } from '../../../config/company';
import { getAccessToken, getConfig, docusignMode, DocuSignNotConfigured } from './jwt';
import { getOrBuildPdf } from '../send';
import { storage, fileKey, clientFolderPath } from '../storage';
import { logEvent, audit } from '../timeline';
import { DOC_STATUS, DOC_TYPE } from '../enums';
import { shortToken } from '../tokens';
import { assertSendable } from '../documents';
import { appBase } from '../base';

const ANCHORS = {
  clientSign: '/sig_client/',
  clientDate: '/date_client/',
  bpSign: '/sig_bp/',
  bpDate: '/date_bp/',
} as const;

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const cfg = getConfig();
  const token = await getAccessToken();
  return fetch(`${cfg.apiBase}/v2.1/accounts/${cfg.accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function anchorTab(anchorString: string, extra: Record<string, unknown> = {}) {
  return {
    anchorString,
    anchorUnits: 'pixels',
    anchorXOffset: '0',
    anchorYOffset: '0',
    anchorIgnoreIfNotPresent: 'false',
    ...extra,
  };
}

export interface SignerInfo {
  name: string;
  email: string;
  clientUserId?: string;
}

function envelopeDefinition(opts: {
  documentNumber: string;
  pdfBase64: string;
  client: SignerInfo;
  bp: SignerInfo;
  webhookUrl: string;
  embedded: boolean;
}) {
  return {
    emailSubject: `Services Agreement ${opts.documentNumber} — Business Partner Solutions Company`,
    emailBlurb:
      'Please review and sign the services agreement. The Arabic and English texts are set out side by side in the document.',
    status: 'sent',
    documents: [
      {
        documentBase64: opts.pdfBase64,
        name: `${opts.documentNumber}.pdf`,
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          // الموقّع الأول: العميل
          email: opts.client.email,
          name: opts.client.name,
          recipientId: '1',
          routingOrder: '1',
          ...(opts.embedded && opts.client.clientUserId ? { clientUserId: opts.client.clientUserId } : {}),
          tabs: {
            signHereTabs: [anchorTab(ANCHORS.clientSign)],
            dateSignedTabs: [anchorTab(ANCHORS.clientDate)],
          },
        },
        {
          // الموقّع الثاني: باهر مقنص — بزنس بارتنر
          email: opts.bp.email,
          name: opts.bp.name,
          recipientId: '2',
          routingOrder: '2',
          ...(opts.embedded && opts.bp.clientUserId ? { clientUserId: opts.bp.clientUserId } : {}),
          tabs: {
            signHereTabs: [anchorTab(ANCHORS.bpSign)],
            dateSignedTabs: [anchorTab(ANCHORS.bpDate)],
          },
        },
      ],
    },
    eventNotification: {
      url: opts.webhookUrl,
      loggingEnabled: 'true',
      requireAcknowledgment: 'true',
      includeDocuments: 'false',
      includeCertificateOfCompletion: 'false',
      envelopeEvents: [
        { envelopeEventStatusCode: 'sent' },
        { envelopeEventStatusCode: 'delivered' },
        { envelopeEventStatusCode: 'completed' },
        { envelopeEventStatusCode: 'declined' },
        { envelopeEventStatusCode: 'voided' },
      ],
      eventData: { version: 'restv2.1', format: 'json', includeData: ['recipients'] },
    },
  };
}

/** إرسال العقد للتوقيع. لا يعمل إلا بعد الاعتماد البشري. */
export async function sendForSignature(documentId: string, actor: string, embedded = true) {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { client: true },
  });
  if (doc.type === DOC_TYPE.QUOTE) {
    throw new Error('التوقيع عبر DocuSign للعقود. عروض الأسعار تُقبل بزر القبول في الصفحة الأونلاين.');
  }
  assertSendable(doc);

  const { buffer } = await getOrBuildPdf(documentId);
  const client: SignerInfo = {
    name: doc.client.repName || doc.client.nameEn || doc.client.nameAr,
    email: doc.client.email,
    clientUserId: embedded ? `client-${doc.clientId}` : undefined,
  };
  const bp: SignerInfo = {
    name: COMPANY.representative.name.en,
    email: COMPANY.representative.email,
    clientUserId: embedded ? `bp-${doc.id}` : undefined,
  };
  const webhookUrl = `${appBase()}/api/docusign/webhook`;

  let envelopeId: string;
  const mode = docusignMode();

  if (mode === 'mock') {
    // محاكاة محلية كاملة لدورة التوقيع — لإثبات المسار بدون حساب DocuSign
    envelopeId = `mock-${shortToken(12)}`;
  } else {
    const res = await api('/envelopes', {
      method: 'POST',
      body: JSON.stringify(
        envelopeDefinition({
          documentNumber: doc.number,
          pdfBase64: buffer.toString('base64'),
          client,
          bp,
          webhookUrl,
          embedded,
        }),
      ),
    });
    const body = (await res.json().catch(() => ({}))) as { envelopeId?: string; message?: string };
    if (!res.ok || !body.envelopeId) {
      throw new Error(`فشل إنشاء الظرف في DocuSign: ${body.message || res.status}`);
    }
    envelopeId = body.envelopeId;
  }

  const envelope = await prisma.envelope.create({
    data: {
      documentId,
      envelopeId,
      status: 'sent',
      demo: mode !== 'production',
      clientEmail: client.email,
      clientName: client.name,
      bpEmail: bp.email,
      bpName: bp.name,
      clientClientUserId: client.clientUserId ?? null,
      bpClientUserId: bp.clientUserId ?? null,
      sentAt: new Date(),
    },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: { status: DOC_STATUS.SIGNING },
  });
  await prisma.delivery.create({
    data: {
      documentId,
      channel: 'DOCUSIGN',
      toName: client.name,
      toAddress: client.email,
      subject: `Services Agreement ${doc.number}`,
      status: 'SENT',
      meta: JSON.stringify({ envelopeId, mode, embedded }),
      actor,
    },
  });
  await logEvent({
    entityType: 'document',
    entityId: documentId,
    clientId: doc.clientId,
    code: 'DOCUSIGN_SENT',
    titleAr: `أُرسل العقد ${doc.number} للتوقيع عبر DocuSign — الظرف ${envelopeId}`,
    titleEn: `Agreement ${doc.number} sent for signature via DocuSign — envelope ${envelopeId}`,
    actor,
    actorKind: 'admin',
    meta: { envelopeId, mode },
  });

  return envelope;
}

/** رابط التوقيع المدمج — يُفتح مباشرة من صفحة العقد عندنا. */
export async function embeddedSigningUrl(
  envelopeDbId: string,
  who: 'client' | 'bp',
  returnUrl: string,
): Promise<string> {
  const env = await prisma.envelope.findUniqueOrThrow({ where: { id: envelopeDbId } });
  const clientUserId = who === 'client' ? env.clientClientUserId : env.bpClientUserId;
  if (!clientUserId) throw new Error('هذا الظرف لم يُنشأ بوضع التوقيع المدمج');

  if (docusignMode() === 'mock') {
    // شاشة توقيع محلية تحاكي واجهة DocuSign
    return `/api/docusign/mock-sign?envelope=${env.id}&who=${who}&returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  const res = await api(`/envelopes/${env.envelopeId}/views/recipient`, {
    method: 'POST',
    body: JSON.stringify({
      returnUrl,
      authenticationMethod: 'none',
      email: who === 'client' ? env.clientEmail : env.bpEmail,
      userName: who === 'client' ? env.clientName : env.bpName,
      clientUserId,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!res.ok || !body.url) throw new Error(`فشل توليد رابط التوقيع المدمج: ${body.message || res.status}`);
  return body.url;
}

/** تنزيل النسخة الموقّعة النهائية وشهادة الإتمام وأرشفتهما في مجلد العميل. */
export async function downloadSignedDocuments(envelopeDbId: string): Promise<{ signedKey: string; certKey: string }> {
  const env = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeDbId },
    include: { document: { include: { client: true } } },
  });
  const doc = env.document;
  const base =
    doc.client.folderPath || clientFolderPath(doc.client.id, doc.client.companyAr || doc.client.nameAr);

  let signed: Buffer;
  let cert: Buffer;

  if (docusignMode() === 'mock') {
    // في وضع المحاكاة: النسخة الموقّعة هي الـPDF نفسه، والشهادة مستند مولَّد محلياً
    const { buffer } = await getOrBuildPdf(doc.id);
    signed = buffer;
    cert = Buffer.from(buildMockCertificate(env), 'utf8');
  } else {
    const [sRes, cRes] = await Promise.all([
      api(`/envelopes/${env.envelopeId}/documents/combined`, { headers: { Accept: 'application/pdf' } }),
      api(`/envelopes/${env.envelopeId}/documents/certificate`, { headers: { Accept: 'application/pdf' } }),
    ]);
    if (!sRes.ok) throw new Error(`فشل تنزيل النسخة الموقّعة: ${sRes.status}`);
    if (!cRes.ok) throw new Error(`فشل تنزيل شهادة الإتمام: ${cRes.status}`);
    signed = Buffer.from(await sRes.arrayBuffer());
    cert = Buffer.from(await cRes.arrayBuffer());
  }

  const ext = docusignMode() === 'mock' ? 'txt' : 'pdf';
  const signedKey = fileKey(base, 'contracts', `${doc.number}-signed.pdf`);
  const certKey = fileKey(base, 'contracts', `${doc.number}-certificate-of-completion.${ext}`);

  await storage().put(signedKey, signed, 'application/pdf');
  await storage().put(certKey, cert, ext === 'pdf' ? 'application/pdf' : 'text/plain');

  await prisma.$transaction([
    prisma.envelope.update({
      where: { id: env.id },
      data: { signedPdfPath: signedKey, certPath: certKey },
    }),
    prisma.document.update({
      where: { id: doc.id },
      data: { signedPdfPath: signedKey, certPath: certKey },
    }),
    prisma.fileAsset.create({
      data: {
        clientId: doc.clientId,
        documentId: doc.id,
        folder: 'contracts',
        name: `${doc.number}-signed.pdf`,
        path: signedKey,
        mime: 'application/pdf',
        size: signed.length,
        source: 'system',
      },
    }),
    prisma.fileAsset.create({
      data: {
        clientId: doc.clientId,
        documentId: doc.id,
        folder: 'contracts',
        name: `${doc.number}-certificate-of-completion.${ext}`,
        path: certKey,
        mime: ext === 'pdf' ? 'application/pdf' : 'text/plain',
        size: cert.length,
        source: 'system',
      },
    }),
  ]);

  return { signedKey, certKey };
}

function buildMockCertificate(env: { envelopeId: string; clientName: string; clientEmail: string; bpName: string; bpEmail: string; sentAt: Date | null }): string {
  return [
    'CERTIFICATE OF COMPLETION (LOCAL SIMULATION)',
    'شهادة الإتمام — محاكاة محلية',
    '',
    `Envelope Id: ${env.envelopeId}`,
    `Sent: ${env.sentAt?.toISOString() ?? ''}`,
    `Completed: ${new Date().toISOString()}`,
    '',
    'Signers in routing order:',
    `1. ${env.clientName} <${env.clientEmail}> — signed`,
    `2. ${env.bpName} <${env.bpEmail}> — signed`,
    '',
    'This file is produced by DOCUSIGN_MODE=mock for local testing only.',
    'هذا الملف مولَّد محلياً لغرض الاختبار فقط، ويُستبدل بشهادة DocuSign الرسمية في وضع demo أو production.',
  ].join('\n');
}

export { DocuSignNotConfigured, ANCHORS };
