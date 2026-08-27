/**
 * إصدار الفاتورة الضريبية داخلياً — بديل الاشتراك في منصة خارجية.
 *
 * تسلسل واحد للمنشأة (BP-TI-سنة-رقم) وعدّاد ICV متصل وسلسلة تجزئة PIH لا
 * تنقطع، كما تشترط اللائحة. التخصيص كله داخل معاملة واحدة حتى لا يتسابق
 * إصداران على نفس الرقم أو نفس التجزئة السابقة.
 *
 * بلا شهادة ختم: تصدر فاتورة المرحلة الأولى (QR بخمسة حقول) وهي الوضع
 * النظامي لمن لم تشمله موجات الربط. مع الشهادة: توقيع XAdES وإبلاغ/اعتماد.
 */
import { createHash, randomUUID } from 'crypto';
import { prisma } from '../db';
import { round2 } from '../money';
import { audit } from '../timeline';
import {
  sellerProfile, zatcaEnv, zatcaPhase2Ready, zatcaPrivateKeyPem, zatcaCertificateBody,
} from './config';
import { qrPayloadPhase1, qrPayloadPhase2 } from './qr';
import {
  buildUnsignedInvoiceXml, qrAndSignatureBlocks, computeXmlTotals,
  type ZatcaInvoiceData, type ZatcaLine, type ZatcaDocType, type ZatcaTypeCode,
} from './xml';
import {
  invoiceHashBase64, signInvoiceHash, parseCertificate,
  signedPropertiesHashBase64, ublExtensionsXml, assembleSignedXml,
} from './sign';
import { reportSimplifiedInvoice, clearStandardInvoice } from './api';

/** تجزئة «الفاتورة السابقة» لأول فاتورة في السلسلة — ثابت اللائحة. */
export function genesisPih(): string {
  return Buffer.from(createHash('sha256').update('0').digest('hex'), 'utf8').toString('base64');
}

const LAST_HASH_KEY = 'zatca:lastHash';

/** وقت الرياض مفصولاً لتاريخ ووقت كما يطلبهما قالب UBL. */
export function riyadhDateTime(at = new Date()): { date: string; time: string; iso: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}`;
  return { date, time, iso: `${date}T${time}Z` };
}

export interface IssueInput {
  /** فاتورة اللوحة المرتبطة إن وجدت */
  invoiceId?: string | null;
  buyer?: {
    name: string;
    vatNumber?: string | null;
    crNumber?: string | null;
    city?: string | null;
  } | null;
  lines: ZatcaLine[];
  /** 388 فاتورة | 381 إشعار دائن | 383 إشعار مدين */
  typeCode?: ZatcaTypeCode;
  /** رقم الفاتورة الأصل للإشعارات */
  billingReference?: string | null;
  instructionNote?: string | null;
  /** 10 نقد | 30 آجل | 42 تحويل | 48 بطاقة */
  paymentMeansCode?: string;
  actor?: string;
}

export interface IssueResult {
  ok: boolean;
  recordId?: string;
  number?: string;
  qr?: string;
  status?: string;
  warnings?: string[];
  error?: string;
}

/**
 * إصدار مستند ضريبي وتسجيله في السلسلة. لا يرمي عند فشل الإبلاغ — الفاتورة
 * الصادرة تبقى صادرة، والفشل يُسجَّل على السجل ليُعاد الإبلاغ لاحقاً.
 */
export async function issueTaxDocument(input: IssueInput): Promise<IssueResult> {
  const seller = sellerProfile();
  if (!seller.ready) {
    return { ok: false, error: `بيانات البائع غير مكتملة: ${seller.missing.join(', ')}` };
  }
  if (!input.lines.length) return { ok: false, error: 'لا بنود في الفاتورة' };

  const typeCode: ZatcaTypeCode = input.typeCode || '388';
  // المعيارية لمشترٍ له رقم ضريبي، والمبسطة لسواه
  const docType: ZatcaDocType = input.buyer?.vatNumber ? 'STANDARD' : 'SIMPLIFIED';
  const now = riyadhDateTime();
  const totals = computeXmlTotals(input.lines);
  const phase2 = zatcaPhase2Ready();

  try {
    const record = await prisma.$transaction(async (tx) => {
      const year = new Date().getUTCFullYear();
      const icvRow = await tx.counter.upsert({
        where: { id: 'ZATCA:ICV' },
        create: { id: 'ZATCA:ICV', value: 1 },
        update: { value: { increment: 1 } },
      });
      const numRow = await tx.counter.upsert({
        where: { id: `TAXINV:${year}` },
        create: { id: `TAXINV:${year}`, value: 1 },
        update: { value: { increment: 1 } },
      });
      const number = `BP-TI-${year}-${String(numRow.value).padStart(4, '0')}`;
      const prev = await tx.setting.findUnique({ where: { key: LAST_HASH_KEY } });
      const pih = prev?.value || genesisPih();
      const uuid = randomUUID();

      const data: ZatcaInvoiceData = {
        number, uuid, icv: icvRow.value, pih,
        issueDate: now.date, issueTime: now.time,
        docType, typeCode,
        billingReference: input.billingReference ?? null,
        instructionNote: input.instructionNote ?? null,
        currency: 'SAR',
        seller,
        buyer: input.buyer
          ? {
              name: input.buyer.name,
              vatNumber: input.buyer.vatNumber || null,
              crNumber: input.buyer.crNumber || null,
              city: input.buyer.city || null,
              countryCode: 'SA',
            }
          : null,
        lines: input.lines,
        paymentMeansCode: input.paymentMeansCode,
      };

      const unsignedXml = buildUnsignedInvoiceXml(data);
      const hash = invoiceHashBase64(unsignedXml);

      let qr: string;
      let xml: string;
      if (phase2) {
        const cert = parseCertificate(zatcaCertificateBody()!);
        const signature = signInvoiceHash(hash, zatcaPrivateKeyPem()!);
        const signingTime = `${now.date}T${now.time}`;
        const spHash = signedPropertiesHashBase64(signingTime, cert);
        qr = qrPayloadPhase2({
          sellerName: seller.name,
          vatNumber: seller.vatNumber,
          timestamp: now.iso,
          total: totals.total,
          vat: totals.vat,
          invoiceHash: hash,
          signature,
          publicKeyDer: cert.publicKeyDer,
          certSignature: docType === 'SIMPLIFIED' ? cert.signature : null,
        });
        const ext = ublExtensionsXml({
          invoiceHash: hash, signedPropsHash: spHash,
          digitalSignature: signature, cert, signingTime,
        });
        xml = assembleSignedXml(unsignedXml, ext, qrAndSignatureBlocks(qr));
      } else {
        qr = qrPayloadPhase1({
          sellerName: seller.name,
          vatNumber: seller.vatNumber,
          timestamp: now.iso,
          total: totals.total,
          vat: totals.vat,
        });
        xml = assembleSignedXml(unsignedXml, '', qrAndSignatureBlocks(qr));
      }

      const rec = await tx.zatcaRecord.create({
        data: {
          invoiceId: input.invoiceId ?? null,
          number, uuid, icv: icvRow.value,
          docType, typeCode,
          issueAt: new Date(),
          sellerName: seller.name, sellerVat: seller.vatNumber,
          buyerName: input.buyer?.name ?? null,
          buyerVat: input.buyer?.vatNumber ?? null,
          netAmount: round2(totals.net), vatAmount: round2(totals.vat), total: round2(totals.total),
          hash, pih, qr, xml,
          status: 'ISSUED',
          zatcaMode: phase2 ? zatcaEnv() : null,
        },
      });
      await tx.setting.upsert({
        where: { key: LAST_HASH_KEY },
        create: { key: LAST_HASH_KEY, value: hash },
        update: { value: hash },
      });
      return rec;
    });

    await audit({
      action: 'zatca.issue',
      entityType: 'ZatcaRecord',
      entityId: record.id,
      actor: input.actor || 'system',
      amount: record.total,
      payload: { number: record.number, docType, typeCode, phase2 },
    });

    // الإبلاغ خارج المعاملة: فشل الشبكة لا يلغي فاتورة صدرت
    let status = record.status;
    let warnings: string[] = [];
    if (phase2) {
      const payload = {
        uuid: record.uuid,
        invoiceHash: record.hash,
        signedXmlBase64: Buffer.from(record.xml, 'utf8').toString('base64'),
      };
      try {
        const res = docType === 'SIMPLIFIED'
          ? await reportSimplifiedInvoice(payload)
          : await clearStandardInvoice(payload);
        warnings = res.warnings;
        status = res.ok
          ? (docType === 'SIMPLIFIED' ? 'REPORTED' : 'CLEARED')
          : (res.errors.length ? 'REJECTED' : 'FAILED');
        await prisma.zatcaRecord.update({
          where: { id: record.id },
          data: {
            status,
            reportedAt: res.ok ? new Date() : null,
            zatcaWarnings: res.warnings.length ? res.warnings.join(' | ') : null,
            zatcaError: res.ok ? null : (res.errors.join(' | ') || `HTTP ${res.status}`),
          },
        });
      } catch (e) {
        status = 'FAILED';
        await prisma.zatcaRecord.update({
          where: { id: record.id },
          data: { status, zatcaError: e instanceof Error ? e.message : String(e) },
        });
      }
    }

    return { ok: true, recordId: record.id, number: record.number, qr: record.qr, status, warnings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** إعادة إبلاغ سجل فشل إبلاغه — نفس الـXML الموقَّع، لا إصدار جديد. */
export async function retryReport(recordId: string): Promise<IssueResult> {
  const rec = await prisma.zatcaRecord.findUnique({ where: { id: recordId } });
  if (!rec) return { ok: false, error: 'السجل غير موجود' };
  if (!zatcaPhase2Ready()) return { ok: false, error: 'شهادة الختم غير مهيأة' };
  if (rec.status === 'REPORTED' || rec.status === 'CLEARED') {
    return { ok: true, recordId: rec.id, number: rec.number, status: rec.status };
  }
  const payload = {
    uuid: rec.uuid,
    invoiceHash: rec.hash,
    signedXmlBase64: Buffer.from(rec.xml, 'utf8').toString('base64'),
  };
  const res = rec.docType === 'SIMPLIFIED'
    ? await reportSimplifiedInvoice(payload)
    : await clearStandardInvoice(payload);
  const status = res.ok
    ? (rec.docType === 'SIMPLIFIED' ? 'REPORTED' : 'CLEARED')
    : (res.errors.length ? 'REJECTED' : 'FAILED');
  await prisma.zatcaRecord.update({
    where: { id: rec.id },
    data: {
      status,
      reportedAt: res.ok ? new Date() : rec.reportedAt,
      zatcaWarnings: res.warnings.length ? res.warnings.join(' | ') : null,
      zatcaError: res.ok ? null : (res.errors.join(' | ') || `HTTP ${res.status}`),
    },
  });
  return { ok: res.ok, recordId: rec.id, number: rec.number, status, warnings: res.warnings, error: res.ok ? undefined : res.errors.join(' | ') };
}
