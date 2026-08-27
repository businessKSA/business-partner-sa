/**
 * خط الإرسال — البوابة الوحيدة لكل ما يصل العميل.
 *
 * لا يمر مستند من هنا قبل اعتماده (assertSendable). الخدمة ذات السعر
 * المنشور تُعتمد تلقائياً لأن رقمها منشور أصلاً ولا شيء فيه يُراجَع؛ وما
 * عداها يبقى موقوفاً على اعتماد بشري.
 *
 * كل رسالة تُبنى عبر composeClientMail: نسخة HTML ونسخة نصية من مصدر
 * واحد، ولا تُرسل قبل اجتيازها حارس المحتوى.
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
import {
  renderMailHtml,
  renderMailText,
  sanitizeMailDoc,
  NOTE_GOV_FEES,
  noteSender,
  SIGNATURE,
  type MailDoc,
  type MailItem,
  type MailTotal,
  type MailRef,
  type MailTable,
} from './mail-layout';
import { PAYMENT_METHODS, type PaymentMethodKey } from './payment-methods';

interface MsgBlock {
  subject: { ar: string; en: string };
  greeting: string;
  intro: string;
  cta?: string;
  notes?: string[];
  enHeading?: string;
  enCta?: string;
  /** الإشعار الداخلي وحده ما زال نصاً طويلاً — لا يصل العميل. */
  bodyEn?: string;
}

interface MsgTpl {
  email: Record<string, MsgBlock>;
  whatsapp: Record<string, { ar: string; en: string }>;
}

type Vars = Record<string, string | number | null | undefined>;

export interface ComposeInput {
  items?: MailItem[];
  itemsHeading?: string;
  totals?: MailTotal[];
  table?: MailTable;
  /** وجهة الزر الوحيد. بلا رابط لا يظهر زر. */
  ctaUrl?: string;
  links?: { label: string; url: string }[];
  refs?: MailRef[];
  /** ملاحظات تُضاف بعد ملاحظات القالب. */
  extraNotes?: string[];
  /** يذيّل الرسالة بملاحظة الرسوم الحكومية — لكل رسالة فيها مبلغ. */
  govFeesNote?: boolean;
  enRows?: MailRef[];
  enUrl?: string;
  signature?: boolean;
}

/**
 * يبني رسالة عميل واحدة من قالبها وبيانات المستند: موضوع ونسخة HTML ونسخة
 * نصية، الثلاثة من مصدر واحد. يرمي إن خالف الناتج قواعد المحتوى — الرفض
 * قبل الإرسال أرخص من رسالة مخالفة عند العميل.
 */
export function composeClientMail(
  kind: string,
  vars: Vars,
  body: ComposeInput,
): { subject: string; text: string; html: string } {
  const tpl = loadTemplate<MsgTpl>('messages.json');
  const block = tpl.email[kind];
  if (!block) throw new Error(`قالب الرسالة غير موجود: ${kind}`);

  const notes = [
    ...(block.notes ?? []).map((n) => render(n, vars)),
    ...(body.extraNotes ?? []),
  ];
  if (body.govFeesNote) notes.push(NOTE_GOV_FEES);
  notes.push(noteSender());

  const doc: MailDoc = sanitizeMailDoc({
    title: render(block.subject.ar, vars).split('—')[0].trim(),
    greeting: render(block.greeting, vars),
    intro: render(block.intro, vars),
    items: body.items,
    itemsHeading: body.itemsHeading,
    totals: body.totals,
    table: body.table,
    cta: body.ctaUrl && block.cta ? { label: render(block.cta, vars), url: body.ctaUrl } : undefined,
    links: body.links,
    refs: body.refs,
    notes,
    signature: body.signature ? SIGNATURE : undefined,
    enSummary:
      body.enRows?.length && block.enHeading
        ? {
            heading: block.enHeading,
            rows: body.enRows,
            cta: body.enUrl && block.enCta ? { label: block.enCta, url: body.enUrl } : undefined,
          }
        : undefined,
  });

  const subject = stripEmoji(render(block.subject.ar, vars));
  const text = renderMailText(doc);
  const html = renderMailHtml(doc);

  const issues = checkContent({ subject, text });
  if (issues.length) {
    throw new Error(
      `مخالفة قواعد المحتوى قبل الإرسال: ${issues.map((i) => `${i.field}/${i.rule}`).join(', ')}`,
    );
  }
  return { subject, text, html };
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

/** سطور المبالغ الثلاثة كما تشترط الفوترة: مجموع، ثم ضريبة، ثم إجمالي. */
export function vatTotals(
  subtotal: number,
  vatAmount: number,
  total: number,
  totalLabel = 'الإجمالي شامل الضريبة',
): MailTotal[] {
  return [
    { label: 'المجموع غير شامل ضريبة القيمة المضافة', value: `${fmtMoney(subtotal)} ريال` },
    { label: 'ضريبة القيمة المضافة 15%', value: `${fmtMoney(vatAmount)} ريال` },
    { label: totalLabel, value: `${fmtMoney(total)} ريال`, emphasis: true },
  ];
}

export interface SendEmailOptions {
  documentId: string;
  /**
   * ملخّص إنجليزي مختصر أسفل الرسالة. المستند المرفق ثنائي اللغة كاملاً،
   * فلا داعي لترجمة الرسالة نفسها.
   */
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

  const kind = doc.type === DOC_TYPE.QUOTE ? 'quote' : 'contract';
  const clientNameAr = doc.client.companyAr || doc.client.nameAr;
  const clientNameEn = doc.client.companyEn || doc.client.nameEn || doc.client.nameAr;
  const link = publicUrl(doc.publicToken);

  const { subject, text, html } = composeClientMail(
    kind,
    {
      number: doc.number,
      clientName: clientNameAr,
      validUntil: fmtDate(doc.validUntil, 'ar'),
    },
    {
      items: doc.items.map((i) => ({
        name: i.nameAr,
        qty: String(i.qty),
        amount: `${fmtMoney(i.lineTotal)} ريال`,
      })),
      totals: vatTotals(doc.subtotal, doc.vatAmount, doc.total),
      ctaUrl: link,
      refs: [
        { label: kind === 'quote' ? 'رقم العرض' : 'رقم العقد', value: doc.number },
        { label: 'العميل', value: clientNameAr },
        ...(doc.validUntil ? [{ label: 'صالح حتى', value: fmtDate(doc.validUntil, 'ar') }] : []),
      ],
      govFeesNote: true,
      signature: true,
      enRows: opts.includeArabic
        ? [
            { label: kind === 'quote' ? 'Quotation number' : 'Agreement number', value: doc.number },
            { label: 'Client', value: clientNameEn },
            { label: 'Total excluding VAT', value: `SAR ${fmtMoney(doc.subtotal)}` },
            { label: 'Value added tax 15%', value: `SAR ${fmtMoney(doc.vatAmount)}` },
            { label: 'Total including VAT', value: `SAR ${fmtMoney(doc.total)}` },
            ...(doc.validUntil
              ? [{ label: 'Valid until', value: fmtDate(doc.validUntil, 'en') }]
              : []),
            { label: 'Government fees', value: 'Excluded, paid directly to the authorities at actual cost' },
          ]
        : undefined,
      enUrl: link,
    },
  );

  const attachments: Attachment[] = [];
  if (opts.attachPdf !== false) {
    const { buffer } = await getOrBuildPdf(doc.id);
    attachments.push({ filename: `${doc.number}.pdf`, content: buffer, contentType: 'application/pdf' });
  }

  const result = await sendMail({
    to: doc.client.email,
    subject,
    text,
    html,
    attachments,
    replyTo: COMPANY.email,
  });

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

/**
 * إشعار استلام طلب تسعير.
 *
 * الخدمة مفتوحة السعر لا يصدر عرضها فوراً، فكان العميل يرى سطراً على الشاشة
 * ثم لا يصله شيء ولا يبقى بيده رقم يسأل به. هذه الرسالة هي ما يبقى: رقم
 * الطلب وما سيحدث بعده. لا تحمل مبلغاً — لا مبلغ بعد.
 */
export async function sendQuoteRequestAck(documentId: string, serviceNameAr: string): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { client: true, items: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  if (!doc || !doc.client.email) return;

  const clientNameAr = doc.client.companyAr || doc.client.nameAr;
  const portal = `${process.env.APP_URL || 'http://localhost:3000'}/portal/quotes`;

  let composed;
  try {
    composed = composeClientMail(
      'quoteRequest',
      { number: doc.number, clientName: clientNameAr, serviceName: serviceNameAr },
      {
        ctaUrl: portal,
        refs: [
          { label: 'رقم الطلب', value: doc.number },
          { label: 'الخدمة المطلوبة', value: serviceNameAr },
          { label: 'تاريخ الطلب', value: fmtDate(doc.createdAt, 'ar') },
          { label: 'الحالة', value: 'قيد إعداد عرض السعر' },
        ],
        signature: true,
        enRows: [
          { label: 'Request number', value: doc.number },
          { label: 'Service', value: doc.items?.[0]?.nameEn || serviceNameAr },
          { label: 'Status', value: 'Quotation being prepared' },
        ],
        enUrl: portal,
      },
    );
  } catch {
    return;
  }

  const result = await sendMail({
    to: doc.client.email,
    subject: composed.subject,
    text: composed.text,
    html: composed.html,
    replyTo: COMPANY.email,
  });

  await prisma.delivery.create({
    data: {
      documentId: doc.id,
      channel: 'EMAIL',
      toName: clientNameAr,
      toAddress: doc.client.email,
      subject: composed.subject,
      body: composed.text,
      status: result.ok ? 'SENT' : 'FAILED',
      error: result.error ?? null,
      meta: JSON.stringify({ provider: result.provider, id: result.id, kind: 'quoteRequest' }),
      actor: 'system',
    },
  });

  await logEvent({
    entityType: 'document',
    entityId: doc.id,
    clientId: doc.clientId,
    code: result.ok ? 'REQUEST_ACK_SENT' : 'SEND_FAILED',
    titleAr: result.ok
      ? `أُرسل إشعار استلام الطلب ${doc.number} إلى ${doc.client.email}`
      : `فشل إرسال إشعار استلام الطلب ${doc.number}: ${result.error}`,
    titleEn: result.ok
      ? `Request acknowledgement ${doc.number} sent to ${doc.client.email}`
      : `Failed to send request acknowledgement ${doc.number}: ${result.error}`,
    actor: 'system',
    actorKind: 'system',
  });
}

function methodLabelAr(method: string | null, provider: string | null): string {
  const key = (method || '').toLowerCase() as PaymentMethodKey;
  if (key && PAYMENT_METHODS[key]) return PAYMENT_METHODS[key].ar;
  if (method) return method;
  return provider || 'سداد إلكتروني';
}

/**
 * إيصال السداد للعميل.
 *
 * كان السداد ينتهي بإشعار للإدارة وحدها: العميل يدفع فلا يصله شيء، ويبقى
 * دليله الوحيد صفحة انصرف عنها. هذه الرسالة هي ما يبقى في بريده — ومعها
 * رقم الفاتورة الضريبية من الدفترة ورابط نسختها حين تكون قد صدرت.
 *
 * لا تُفشل السداد أبداً: المال حُصِّل والحركة قُيِّدت، وتعذّر رسالة لا يُبطل ذلك.
 */
export async function sendPaymentReceipt(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true },
  });
  if (!invoice || invoice.status !== 'PAID') return;
  if (!invoice.client.email) return;

  const clientNameAr = invoice.client.companyAr || invoice.client.nameAr;
  const clientNameEn = invoice.client.companyEn || invoice.client.nameEn || invoice.client.nameAr;
  const portal = `${process.env.APP_URL || 'http://localhost:3000'}/portal/invoices`;
  const method = methodLabelAr(invoice.method, invoice.provider);

  const refs: MailRef[] = [{ label: 'رقم الفاتورة', value: invoice.number }];
  if (invoice.daftraNumber) {
    refs.push({ label: 'رقم الفاتورة الضريبية', value: invoice.daftraNumber });
  }
  refs.push(
    { label: 'تاريخ السداد', value: fmtDate(invoice.paidAt, 'ar') },
    { label: 'طريقة السداد', value: method },
  );
  if (invoice.providerRef) {
    refs.push({ label: 'الرقم المرجعي للعملية', value: invoice.providerRef });
  }

  const links: { label: string; url: string }[] = [];
  if (invoice.daftraPdfUrl) {
    links.push({ label: 'نسخة الفاتورة الضريبية', url: invoice.daftraPdfUrl });
  }

  // العهدة إيداع في محفظة العميل لا إيراد، فلا فاتورة ضريبية لها ولا يُوعد بها
  const isDeposit = invoice.isGovFeeDeposit || Boolean(invoice.depositKind);
  const extraNotes: string[] = [];
  if (isDeposit) {
    extraNotes.push(
      'هذا المبلغ عهدة تُقيَّد في محفظتكم لدينا وتُصرف على الرسوم المستحقة بالتكلفة الفعلية، ويُردّ الفائض منها.',
    );
  } else if (!invoice.daftraNumber) {
    extraNotes.push('الفاتورة الضريبية المعتمدة تصلكم في رسالة منفصلة خلال يوم عمل.');
  }

  let composed;
  try {
    composed = composeClientMail(
      'paymentReceipt',
      { number: invoice.number, clientName: clientNameAr, title: invoice.titleAr },
      {
        items: [{ name: invoice.titleAr, amount: `${fmtMoney(invoice.amountExclVat)} ريال` }],
        // في الإيصال يقع التوكيد على «المدفوع» لا على الإجمالي، فالسؤال هنا
        // «كم دفعتُ وكم بقي» لا «كم المستحق»
        totals: [
          ...vatTotals(invoice.amountExclVat, invoice.vatAmount, invoice.total).map((t) => ({
            ...t,
            emphasis: false,
          })),
          { label: 'المدفوع', value: `${fmtMoney(invoice.total)} ريال`, emphasis: true },
          { label: 'المتبقي', value: `${fmtMoney(0)} ريال` },
        ],
        ctaUrl: portal,
        links,
        refs,
        extraNotes,
        govFeesNote: !isDeposit,
        signature: true,
        enRows: [
          { label: 'Invoice number', value: invoice.number },
          ...(invoice.daftraNumber
            ? [{ label: 'Tax invoice number', value: invoice.daftraNumber }]
            : []),
          { label: 'Client', value: clientNameEn },
          { label: 'Amount excluding VAT', value: `SAR ${fmtMoney(invoice.amountExclVat)}` },
          { label: 'Value added tax 15%', value: `SAR ${fmtMoney(invoice.vatAmount)}` },
          { label: 'Total paid', value: `SAR ${fmtMoney(invoice.total)}` },
          { label: 'Balance due', value: `SAR ${fmtMoney(0)}` },
          { label: 'Paid on', value: fmtDate(invoice.paidAt, 'en') },
        ],
        enUrl: portal,
      },
    );
  } catch {
    return;
  }

  const result = await sendMail({
    to: invoice.client.email,
    subject: composed.subject,
    text: composed.text,
    html: composed.html,
    replyTo: COMPANY.email,
  });

  await prisma.delivery.create({
    data: {
      invoiceId: invoice.id,
      channel: 'EMAIL',
      toName: clientNameAr,
      toAddress: invoice.client.email,
      subject: composed.subject,
      body: composed.text,
      status: result.ok ? 'SENT' : 'FAILED',
      error: result.error ?? null,
      meta: JSON.stringify({ provider: result.provider, id: result.id, kind: 'paymentReceipt' }),
      actor: 'system',
    },
  });

  await logEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    clientId: invoice.clientId,
    code: result.ok ? 'RECEIPT_SENT' : 'SEND_FAILED',
    titleAr: result.ok
      ? `أُرسل إيصال سداد الفاتورة ${invoice.number} إلى ${invoice.client.email}`
      : `فشل إرسال إيصال سداد الفاتورة ${invoice.number}: ${result.error}`,
    titleEn: result.ok
      ? `Payment receipt for invoice ${invoice.number} sent to ${invoice.client.email}`
      : `Failed to send payment receipt for invoice ${invoice.number}: ${result.error}`,
    actor: 'system',
    actorKind: 'system',
  });
}

/** إشعاري بالبريد عند كل حدث مهم. */
export async function notifyEvent(event: string, documentNumber: string, clientName: string, details: string, link: string) {
  const tpl = loadTemplate<MsgTpl>('messages.json');
  const b = tpl.email.adminNotice;
  const vars = { event, number: documentNumber, clientName, time: new Date().toISOString(), details, link };
  return notifyAdmin(render(b.subject.en, vars), render(b.bodyEn || '', vars));
}
