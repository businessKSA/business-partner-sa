/**
 * تنسيق مسار الفاتورة الإلكترونية من أوّله إلى آخره.
 *
 * الترتيب هنا ليس اختيارياً، وكلُّ خطوةٍ تعتمد على ما قبلها:
 *
 *   ١. احجز موضعاً في السلسلة (العدّاد ICV وتجزئة السابقة PIH). الحجز
 *      داخل معاملة، فلو فشل ما بعده تراجَع الموضع ولم تنكسر السلسلة.
 *   ٢. ابنِ XML بلا توقيع وبلا QR.
 *   ٣. جزّئه بعد حذف العناصر الثلاثة.
 *   ٤. وقّع التجزئة.
 *   ٥. ابنِ QR من التجزئة والتوقيع والمفتاح العام.
 *   ٦. احقن التوقيع وQR في الشجرة.
 *   ٧. أرسل للهيئة: إجازةً للفاتورة الضريبية، وإبلاغاً للمبسطة.
 *   ٨. ثبّت التجزئة في إعدادات المنشأة لتأخذها الفاتورة التالية.
 *
 * الخطوة الثامنة لا تُنفَّذ إلا بعد نجاح الإرسال أو قبوله بملاحظات: تثبيتُ
 * التجزئة بعد رفضٍ يعني أن الفاتورة القادمة ستشير إلى فاتورة غير موجودة
 * لدى الهيئة، فتُرفض هي الأخرى، وهكذا حتى يتعطّل الإصدار كلّه.
 */
import { randomUUID, X509Certificate } from 'node:crypto';
import type { Tx } from '../db.ts';
import { d, money, type Num } from '../money.ts';
import { DomainError } from '../errors.ts';
import { decryptSecret } from '../crypto.ts';
import { buildInvoiceXml, amt, type UblInvoiceInput, type UblLine } from './ubl.ts';
import { invoiceHash, INITIAL_PIH } from './hash.ts';
import { signInvoice, injectSignature, injectQr } from './sign.ts';
import { buildQr } from './tlv.ts';
import { serializeDocument, findElement } from './xml.ts';
import { ZatcaClient, type ZatcaEnvironment } from './client.ts';

/** يحجز الموضع التالي في السلسلة ويعيد العدّاد وتجزئة السابقة. */
export async function reserveChainSlot(tx: Tx, tenantId: string) {
  const rows = await tx.$queryRaw<{ lastIcv: number; lastHash: string }[]>`
    UPDATE "ZatcaConfig"
    SET "lastIcv" = "lastIcv" + 1, "updatedAt" = now()
    WHERE "tenantId" = ${tenantId}
    RETURNING "lastIcv", "lastHash"
  `;

  if (!rows.length) {
    throw new DomainError(
      'المنشأة غير مربوطة بمنظومة فاتورة. أكمل الربط من إعدادات الفوترة الإلكترونية قبل إصدار فاتورة.',
      'ZATCA_NOT_ONBOARDED',
    );
  }

  return { icv: rows[0].lastIcv, pih: rows[0].lastHash || INITIAL_PIH };
}

export type BuildOptions = {
  /** لبيئة التطوير: يبني ويوقّع بلا إرسال */
  dryRun?: boolean;
  signingTime?: string;
};

/**
 * يبني فاتورة إلكترونية موقَّعة جاهزة للإرسال.
 *
 * منفصلة عن الإرسال عمداً: الاختبارات تحتاج التوقيع بلا شبكة، والمعاينة
 * قبل الإصدار تحتاجه كذلك.
 */
export async function buildSignedInvoice(
  tx: Tx,
  tenantId: string,
  invoiceId: string,
  opts: BuildOptions = {},
) {
  const invoice = await tx.salesInvoice.findFirstOrThrow({
    where: { id: invoiceId, tenantId },
    include: {
      partner: true,
      lines: { include: { taxCode: true }, orderBy: { sortOrder: 'asc' } },
    },
  });

  if (invoice.status === 'DRAFT') {
    throw new DomainError(
      `الفاتورة ${invoice.number} مسوّدة. تُرحَّل محاسبياً قبل إرسالها للهيئة.`,
      'INVOICE_NOT_POSTED',
    );
  }

  const tenant = await tx.tenant.findFirstOrThrow({ where: { id: tenantId } });
  const config = await tx.zatcaConfig.findUnique({ where: { tenantId } });
  if (!config) {
    throw new DomainError('المنشأة غير مربوطة بمنظومة فاتورة.', 'ZATCA_NOT_ONBOARDED');
  }
  if (!tenant.vatNumber) {
    throw new DomainError(
      'الرقم الضريبي للمنشأة غير مسجَّل، ولا تُقبل فاتورة إلكترونية بدونه.',
      'MISSING_VAT_NUMBER',
    );
  }

  // ١ — الموضع في السلسلة
  const existing = await tx.zatcaDocument.findUnique({ where: { invoiceId } });
  const slot = existing
    ? { icv: existing.icv, pih: existing.pih }
    : await reserveChainSlot(tx, tenantId);
  const uuid = existing?.uuid ?? randomUUID();

  // ٢ — الشجرة بلا توقيع وبلا QR
  const typeCode = invoice.docType === 'CREDIT_NOTE' ? '381' : invoice.docType === 'DEBIT_NOTE' ? '383' : '388';
  const typeName = invoice.kind === 'SIMPLIFIED' ? '0200' : '0100';

  const lines: UblLine[] = invoice.lines.map((l, i) => ({
    id: i + 1,
    descAr: l.descAr,
    qty: d(l.qty).toFixed(6).replace(/0+$/, '').replace(/\.$/, '') || '0',
    uomCode: l.uomCode,
    unitPrice: amt(l.unitPrice),
    discount: amt(l.discount),
    lineNet: amt(l.lineNet),
    lineVat: amt(l.lineVat),
    lineTotal: amt(d(l.lineNet).plus(d(l.lineVat))),
    taxCategory: l.taxCode?.zatcaCategory ?? 'S',
    taxPercent: d(l.taxRate).times(100).toFixed(2),
    exemptionReasonCode: l.taxCode?.exemptionReasonCode ?? null,
    exemptionReason: l.taxCode?.exemptionReasonAr ?? null,
  }));

  const issueDate = invoice.issueDate.toISOString().slice(0, 10);
  const issueTime = invoice.issueTime.toISOString().slice(11, 19);

  const ublInput: UblInvoiceInput = {
    number: invoice.number,
    uuid,
    issueDate,
    issueTime,
    typeCode: typeCode as '388' | '381' | '383',
    typeName: typeName as '0100' | '0200',
    currency: invoice.currency,
    icv: slot.icv,
    pih: slot.pih,
    seller: {
      nameAr: tenant.nameAr,
      vatNumber: tenant.vatNumber,
      street: tenant.street, buildingNo: tenant.buildingNo, district: tenant.district,
      city: tenant.city, postalCode: tenant.postalCode, additionalNo: tenant.additionalNo,
      countryCode: tenant.countryCode,
    },
    buyer: {
      nameAr: invoice.partner.nameAr,
      vatNumber: invoice.partner.vatNumber,
      otherIdType: invoice.partner.otherIdType,
      otherIdValue: invoice.partner.otherIdValue,
      street: invoice.partner.street, buildingNo: invoice.partner.buildingNo,
      district: invoice.partner.district, city: invoice.partner.city,
      postalCode: invoice.partner.postalCode, additionalNo: invoice.partner.additionalNo,
      countryCode: invoice.partner.countryCode,
    },
    lines,
    lineExtensionAmount: amt(invoice.subtotal),
    taxExclusiveAmount: amt(invoice.taxableAmount),
    taxInclusiveAmount: amt(invoice.total),
    allowanceTotal: amt(invoice.discountTotal),
    vatTotal: amt(invoice.vatTotal),
    prepaidAmount: '0.00',
    payableAmount: amt(invoice.total),
    taxSubtotals: buildTaxSubtotals(invoice.lines),
    correctionReason: invoice.correctionReason,
    originalInvoiceNumber: null,
    notes: invoice.notesAr,
  };

  if (invoice.originalInvoiceId) {
    const orig = await tx.salesInvoice.findFirst({
      where: { id: invoice.originalInvoiceId, tenantId },
      select: { number: true },
    });
    ublInput.originalInvoiceNumber = orig?.number ?? null;
  }

  let tree = buildInvoiceXml(ublInput);

  // ٣ — التجزئة
  const { hash } = invoiceHash(tree);

  // ٤ — التوقيع
  const certEnc = config.productionCertEnc || config.complianceCertEnc;
  const keyEnc = config.privateKeyEnc;
  if (!certEnc || !keyEnc) {
    throw new DomainError(
      'الشهادة أو المفتاح الخاص مفقودان. أعد الربط مع منظومة فاتورة.',
      'ZATCA_MISSING_CREDENTIALS',
    );
  }

  const certificateBase64 = decryptSecret(certEnc);
  const privateKeyPem = decryptSecret(keyEnc);

  const signed = signInvoice({
    invoiceHash: hash,
    certificateBase64,
    privateKeyPem,
    issuerName: readIssuerName(certificateBase64),
    serialNumber: readSerialNumber(certificateBase64),
    signingTime: opts.signingTime,
  });

  // ٥ — رمز QR
  const qr = buildQr({
    sellerName: tenant.nameAr,
    vatNumber: tenant.vatNumber,
    timestamp: `${issueDate}T${issueTime}Z`,
    totalWithVat: amt(invoice.total),
    vatTotal: amt(invoice.vatTotal),
    invoiceHash: hash,
    signature: signed.signature,
    publicKey: publicKeyFromCert(certificateBase64),
  });

  // ٦ — الحقن. ترتيب الحقن لا يؤثّر في التجزئة لأنها حُسبت قبله على شجرة
  // محذوفٍ منها هذان العنصران بالضبط.
  tree = injectSignature(tree, signed.extensions);
  tree = injectQr(tree, qr);

  const xml = serializeDocument(tree);

  return {
    uuid, icv: slot.icv, pih: slot.pih, hash, qr, xml,
    signature: signed.signature,
    signedPropsHash: signed.signedPropsHash,
    mode: invoice.kind === 'SIMPLIFIED' ? ('REPORTING' as const) : ('CLEARANCE' as const),
    environment: config.environment as ZatcaEnvironment,
  };
}

/** يجمع الوعاء والضريبة لكل فئة ضريبية — المواصفة توجب تفصيلها. */
function buildTaxSubtotals(
  lines: { lineNet: Num; lineVat: Num; taxRate: Num; taxCode: { zatcaCategory: string; exemptionReasonCode: string | null; exemptionReasonAr: string | null } | null }[],
) {
  const byCategory = new Map<string, { base: ReturnType<typeof d>; vat: ReturnType<typeof d>; percent: string; code: string | null; reason: string | null }>();

  for (const l of lines) {
    const cat = l.taxCode?.zatcaCategory ?? 'S';
    const percent = d(l.taxRate).times(100).toFixed(2);
    const key = `${cat}:${percent}`;
    const cur = byCategory.get(key) ?? {
      base: d(0), vat: d(0), percent,
      code: l.taxCode?.exemptionReasonCode ?? null,
      reason: l.taxCode?.exemptionReasonAr ?? null,
    };
    cur.base = cur.base.plus(d(l.lineNet));
    cur.vat = cur.vat.plus(d(l.lineVat));
    byCategory.set(key, cur);
  }

  return [...byCategory.entries()].map(([key, v]) => ({
    taxableAmount: money(v.base).toFixed(2),
    taxAmount: money(v.vat).toFixed(2),
    category: key.split(':')[0],
    percent: v.percent,
    exemptionReasonCode: v.code,
    exemptionReason: v.reason,
  }));
}

/**
 * يرسل الفاتورة للهيئة ويحفظ الأثر.
 *
 * تثبيت التجزئة في السلسلة يقع بعد القبول فقط — وهو الشرط الذي يمنع
 * انهيار السلسلة كلها بعد رفضٍ واحد.
 */
export async function submitInvoice(
  tx: Tx,
  tenantId: string,
  invoiceId: string,
  fetchImpl?: typeof fetch,
) {
  const built = await buildSignedInvoice(tx, tenantId, invoiceId);
  const config = await tx.zatcaConfig.findUniqueOrThrow({ where: { tenantId } });

  const token = decryptSecret(config.productionCertEnc || config.complianceCertEnc || '');
  const secret = decryptSecret(config.productionSecretEnc || config.complianceSecretEnc || '');

  const client = new ZatcaClient(built.environment, fetchImpl);
  const payload = {
    invoiceHash: built.hash,
    uuid: built.uuid,
    invoice: Buffer.from(built.xml, 'utf8').toString('base64'),
  };

  const result =
    built.mode === 'CLEARANCE'
      ? await client.clearInvoice(token, secret, payload)
      : await client.reportInvoice(token, secret, payload);

  const status = result.outcome === 'ACCEPTED'
    ? built.mode === 'CLEARANCE' ? 'CLEARED' : 'REPORTED'
    : result.outcome === 'ACCEPTED_WITH_WARNINGS'
      ? 'WARNING'
      : 'FAILED';

  const clearedXml =
    typeof (result.body as Record<string, unknown>)?.clearedInvoice === 'string'
      ? Buffer.from(String((result.body as Record<string, unknown>).clearedInvoice), 'base64').toString('utf8')
      : null;

  const doc = await tx.zatcaDocument.upsert({
    where: { invoiceId },
    create: {
      invoiceId, tenantId,
      uuid: built.uuid, icv: built.icv, pih: built.pih, hash: built.hash,
      xml: built.xml, qr: built.qr, signature: built.signature,
      signedPropsHash: built.signedPropsHash,
      mode: built.mode, status,
      requestPayload: { invoiceHash: built.hash, uuid: built.uuid },
      responsePayload: result.body as never,
      warnings: result.warnings as never,
      errors: result.errors as never,
      attempts: 1,
      submittedAt: new Date(),
      clearedAt: result.ok ? new Date() : null,
      clearedXml,
    },
    update: {
      status,
      responsePayload: result.body as never,
      warnings: result.warnings as never,
      errors: result.errors as never,
      attempts: { increment: 1 },
      submittedAt: new Date(),
      clearedAt: result.ok ? new Date() : null,
      clearedXml,
    },
  });

  // ٨ — تثبيت السلسلة بعد القبول لا قبله
  if (result.ok) {
    await tx.zatcaConfig.update({
      where: { tenantId },
      data: { lastHash: built.hash, lastError: null },
    });
  } else {
    await tx.zatcaConfig.update({
      where: { tenantId },
      data: { lastError: result.message },
    });
  }

  return { document: doc, result };
}

// ── قراءة بيانات الشهادة ───────────────────────────────────────────────
// نقرأها بأدوات Node القياسية بدل مكتبة X.509 كاملة: كل ما نحتاجه ثلاثة
// حقول، والباقي وزن زائد في مسارٍ حسّاس.

function certToPem(base64: string): string {
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

export function readIssuerName(certBase64: string): string {
  const cert = new X509Certificate(certToPem(certBase64));
  // Node يعطي الاسم بأسطر، والمواصفة تنتظره بفواصل بالترتيب المعكوس
  return cert.issuer.split('\n').reverse().join(', ');
}

export function readSerialNumber(certBase64: string): string {
  const cert = new X509Certificate(certToPem(certBase64));
  return BigInt(`0x${cert.serialNumber}`).toString(10);
}

export function publicKeyFromCert(certBase64: string): Buffer {
  const cert = new X509Certificate(certToPem(certBase64));
  return cert.publicKey.export({ type: 'spki', format: 'der' });
}
