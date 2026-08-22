/**
 * خط الإرسال — البوابة الوحيدة لكل ما يصل العميل.
 * لا يمر أي شيء من هنا قبل الاعتماد البشري (assertSendable).
 */
import { prisma } from './db';
import { COMPANY } from '../../config/company';
import { loadTemplate, render } from './templates';
import { fmtMoney, fmtDate } from './money';
import { sendMail, notifyAdmin, type Attachment } from './mailer';
import { buildWhatsAppMessage } from './whatsapp';
import { assertSendable, archiveDocumentPdf } from './documents';
import { renderPdf, printUrl } from './pdf';
import { logEvent } from './timeline';
import { DOC_STATUS, DOC_TYPE } from './enums';
import { stripEmoji, checkContent } from './content-guard';
import { storage } from './storage';
import { queue, JOB } from './queue';

interface MsgTpl {
  email: Record<
    string,
    { subject: { ar: string; en: string }; bodyEn?: string; bodyAr?: string }
  >;
}

export function publicUrl(token: string): string {
  return `${process.env.APP_URL || 'http://localhost:3000'}/d/${token}`;
}

/** رابط سداد الفاتورة — يُفتح برمز الفاتورة وحده بلا تسجيل دخول. */
export function payUrl(payToken: string): string {
  return `${process.env.APP_URL || 'http://localhost:3000'}/portal/pay/${payToken}`;
}

/** يولّد الـPDF ويؤرشفه في مجلد العميل الصحيح، ويعيد المحتوى. */
export async function buildAndArchivePdf(documentId: string): Promise<{ buffer: Buffer; key: string }> {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  const buffer = await renderPdf({ url: printUrl(doc.publicToken) });
  const key = await archiveDocumentPdf(documentId, buffer);
  return { buffer, key };
}

/** يعيد استخدام الـPDF المؤرشف إن وُجد، وإلا يولّده. */
export async function getOrBuildPdf(documentId: string): Promise<{ buffer: Buffer; key: string }> {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  if (doc.pdfPath && (await storage().exists(doc.pdfPath))) {
    return { buffer: await storage().get(doc.pdfPath), key: doc.pdfPath };
  }
  return buildAndArchivePdf(documentId);
}

/**
 * يطلب توليد المستند في الخلفية بدل انتظاره داخل الطلب.
 * هذه هي النقطة التي تجعل الاعتماد والإرسال يرجعان فوراً مهما كان حجم العقد.
 */
export async function queueDocumentBuild(documentId: string) {
  const q = queue();
  const [pdf, docx] = await Promise.all([
    q.enqueue(JOB.DOCUMENT_PDF, { documentId }, {
      dedupeKey: `pdf:${documentId}`, entityType: 'document', entityId: documentId,
    }),
    q.enqueue(JOB.DOCUMENT_DOCX, { documentId }, {
      dedupeKey: `docx:${documentId}`, entityType: 'document', entityId: documentId,
    }),
  ]);
  return { pdfJobId: pdf.jobId, docxJobId: docx.jobId, ranInline: pdf.ranInline };
}

/** يطلب إرسال البريد في الخلفية بعد التحقق من الاعتماد فوراً. */
export async function queueDocumentEmail(documentId: string, includeArabic: boolean, actor: string) {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  // الحارس يعمل قبل وضع المهمة في الطابور لا بعده، حتى يظهر الرفض للمستخدم فوراً
  assertSendable(doc);
  return queue().enqueue(
    JOB.DOCUMENT_EMAIL,
    { documentId, includeArabic, actor },
    { entityType: 'document', entityId: documentId },
  );
}

function templateVars(doc: {
  number: string;
  total: number;
  subtotal: number;
  vatAmount: number;
  validUntil: Date | null;
}, clientName: string, link: string, itemsPlain: string, itemsPlainAr: string) {
  return {
    number: doc.number,
    clientName,
    link,
    subtotal: fmtMoney(doc.subtotal),
    vatAmount: fmtMoney(doc.vatAmount),
    total: fmtMoney(doc.total),
    validUntil: fmtDate(doc.validUntil, 'en'),
    itemsPlain,
    itemsPlainAr,
    repNameEn: COMPANY.representative.name.en,
    repTitleEn: COMPANY.representative.title.en,
    repNameAr: COMPANY.representative.name.ar,
    repTitleAr: COMPANY.representative.title.ar,
    phone: COMPANY.phoneDisplay,
    email: COMPANY.email,
    website: COMPANY.website,
  };
}

export interface SendEmailOptions {
  documentId: string;
  /** en فقط، أو en+ar (النسخة العربية اختيارية كما في المواصفة). */
  includeArabic?: boolean;
  attachPdf?: boolean;
  actor: string;
}

export async function sendDocumentEmail(opts: SendEmailOptions) {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: opts.documentId },
    include: { client: true, items: { orderBy: { sortOrder: 'asc' } } },
  });
  assertSendable(doc);

  const tpl = loadTemplate<MsgTpl>('messages.json');
  const kind = doc.type === DOC_TYPE.QUOTE ? 'quote' : 'contract';
  const block = tpl.email[kind];
  const clientName = doc.client.companyEn || doc.client.nameEn || doc.client.nameAr;
  const clientNameAr = doc.client.companyAr || doc.client.nameAr;
  const link = publicUrl(doc.publicToken);

  const itemsPlain = doc.items
    .map((i, n) => `${n + 1}. ${i.nameEn} — ${i.qty} x SAR ${fmtMoney(i.unitPrice)} = SAR ${fmtMoney(i.lineTotal)}`)
    .join('\n');
  const itemsPlainAr = doc.items
    .map((i, n) => `${n + 1}. ${i.nameAr} — ${i.qty} × ${fmtMoney(i.unitPrice)} ريال = ${fmtMoney(i.lineTotal)} ريال`)
    .join('\n');

  const varsEn = templateVars(doc, clientName, link, itemsPlain, itemsPlainAr);
  const varsAr = { ...varsEn, clientName: clientNameAr, validUntil: fmtDate(doc.validUntil, 'ar') };

  let text = render(block.bodyEn || '', varsEn);
  if (opts.includeArabic && block.bodyAr) {
    text = `${text}\n\n${'-'.repeat(56)}\n\n${render(block.bodyAr, varsAr)}`;
  }
  text = stripEmoji(text);
  const subject = stripEmoji(render(block.subject.en, varsEn));

  // فحص أخير: لا إيموجي ولا اختصارات حكومية فيما يصل العميل
  const issues = checkContent({ subject, text });
  if (issues.length) {
    throw new Error(`مخالفة قواعد المحتوى قبل الإرسال: ${issues.map((i) => `${i.field}/${i.rule}`).join(', ')}`);
  }

  const attachments: Attachment[] = [];
  if (opts.attachPdf !== false) {
    const { buffer } = await getOrBuildPdf(doc.id);
    attachments.push({ filename: `${doc.number}.pdf`, content: buffer, contentType: 'application/pdf' });
  }

  const result = await sendMail({ to: doc.client.email, subject, text, attachments, replyTo: COMPANY.email });

  await prisma.delivery.create({
    data: {
      documentId: doc.id,
      channel: 'EMAIL',
      toName: clientNameAr,
      toAddress: doc.client.email,
      subject,
      body: text,
      status: result.ok ? 'SENT' : 'FAILED',
      error: result.error ?? null,
      meta: JSON.stringify({ provider: result.provider, id: result.id, attachedPdf: attachments.length > 0 }),
      actor: opts.actor,
    },
  });

  if (result.ok && doc.status === DOC_STATUS.APPROVED) {
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: DOC_STATUS.SENT, sentAt: new Date() },
    });
  }

  await logEvent({
    entityType: 'document',
    entityId: doc.id,
    clientId: doc.clientId,
    code: result.ok ? 'SENT_EMAIL' : 'SEND_FAILED',
    titleAr: result.ok
      ? `أُرسل المستند ${doc.number} بالبريد إلى ${doc.client.email}`
      : `فشل إرسال ${doc.number} بالبريد: ${result.error}`,
    titleEn: result.ok
      ? `Document ${doc.number} sent by email to ${doc.client.email}`
      : `Failed to send ${doc.number} by email: ${result.error}`,
    actor: opts.actor,
    actorKind: 'admin',
  });

  return result;
}

/** يجهّز رابط واتساب — لا يُرسل شيئاً بنفسه، بل يسجّل ويعيد الرابط. */
export async function prepareWhatsApp(documentId: string, lang: 'ar' | 'en', actor: string) {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { client: true },
  });
  assertSendable(doc);

  const msg = buildWhatsAppMessage(doc.type === DOC_TYPE.QUOTE ? 'quote' : 'contract', lang, doc.client.phone, {
    number: doc.number,
    clientName: lang === 'ar' ? doc.client.companyAr || doc.client.nameAr : doc.client.companyEn || doc.client.nameEn || doc.client.nameAr,
    total: fmtMoney(doc.total),
    link: publicUrl(doc.publicToken),
  });

  await prisma.delivery.create({
    data: {
      documentId: doc.id,
      channel: 'WHATSAPP',
      toName: doc.client.nameAr,
      toAddress: doc.client.phone,
      body: msg.text,
      status: 'PREPARED',
      meta: JSON.stringify({ mode: process.env.WHATSAPP_MODE || 'link', lang }),
      actor,
    },
  });

  if (doc.status === DOC_STATUS.APPROVED) {
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: DOC_STATUS.SENT, sentAt: new Date() },
    });
  }

  await logEvent({
    entityType: 'document',
    entityId: doc.id,
    clientId: doc.clientId,
    code: 'SENT_WHATSAPP',
    titleAr: `جُهّزت رسالة واتساب للمستند ${doc.number} إلى ${doc.client.phone}`,
    titleEn: `WhatsApp message prepared for document ${doc.number} to ${doc.client.phone}`,
    actor,
    actorKind: 'admin',
  });

  return msg;
}

/** إشعاري بالبريد عند كل حدث مهم. */
export async function notifyEvent(event: string, documentNumber: string, clientName: string, details: string, link: string) {
  const tpl = loadTemplate<MsgTpl>('messages.json');
  const b = tpl.email.adminNotice;
  const vars = { event, number: documentNumber, clientName, time: new Date().toISOString(), details, link };
  return notifyAdmin(render(b.subject.en, vars), render(b.bodyEn || '', vars));
}
