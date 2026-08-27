/**
 * الترقيم التسلسلي للمستندات.
 *
 * هيئة الزكاة والضريبة تشترط تسلسلاً متصلاً لأرقام الفواتير: فجوةٌ في
 * التسلسل سؤالٌ في أي فحص. لذلك العدّاد يُزاد ذرّياً في القاعدة عبر
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`، لا بقراءةٍ ثم كتابةٍ
 * يتسابق عليها طلبان فيأخذان الرقم نفسه.
 *
 * تنبيه مقصود: العدّاد يُستهلك داخل معاملة الترحيل. إن فشل الترحيل بعدها
 * تعود المعاملة كاملةً ويعود الرقم — فلا فجوة. أما إصدار الرقم في معاملة
 * مستقلة (كما يفعل بعض الأنظمة لتفادي القفل) فيُحدث الفجوة عينها التي
 * نتجنّبها.
 */
import type { Tx } from '../db.ts';

export type DocType =
  | 'JOURNAL'
  | 'SALES_INVOICE'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'VENDOR_BILL'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'PAYMENT_IN'
  | 'PAYMENT_OUT'
  | 'PAYROLL_RUN'
  | 'PROJECT';

/** البادئة الافتراضية لكل نوع. تُعدَّل من إعدادات المنشأة. */
const PREFIX: Record<DocType, string> = {
  JOURNAL: 'JV',
  SALES_INVOICE: 'INV',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
  VENDOR_BILL: 'BILL',
  PURCHASE_ORDER: 'PO',
  GOODS_RECEIPT: 'GRN',
  PAYMENT_IN: 'RCV',
  PAYMENT_OUT: 'PAY',
  PAYROLL_RUN: 'PR',
  PROJECT: 'PRJ',
};

/**
 * يحجز الرقم التالي ويعيده مصوغاً: `INV-2026-0001`.
 *
 * @param tx معاملة نشطة — الحجز يجب أن يشارك مصير المستند.
 */
export async function nextNumber(
  tx: Tx,
  tenantId: string,
  docType: DocType,
  date = new Date(),
): Promise<string> {
  const year = date.getUTCFullYear();
  const prefix = PREFIX[docType];

  const rows = await tx.$queryRaw<{ value: number; prefix: string; padding: number }[]>`
    INSERT INTO "NumberSeries" ("id", "tenantId", "docType", "year", "prefix", "padding", "value", "updatedAt")
    VALUES (gen_random_uuid()::text, ${tenantId}, ${docType}, ${year}, ${prefix}, 4, 1, now())
    ON CONFLICT ("tenantId", "docType", "year")
    DO UPDATE SET "value" = "NumberSeries"."value" + 1, "updatedAt" = now()
    RETURNING "value", "prefix", "padding"
  `;

  const row = rows[0];
  if (!row) throw new Error(`تعذّر حجز رقم لـ ${docType}`);

  const seq = String(row.value).padStart(row.padding, '0');
  return `${row.prefix}-${year}-${seq}`;
}

/** يقرأ الرقم التالي دون استهلاكه — للعرض في نموذج الإدخال فقط. */
export async function peekNumber(
  tx: Tx,
  tenantId: string,
  docType: DocType,
  date = new Date(),
): Promise<string> {
  const year = date.getUTCFullYear();
  const series = await tx.numberSeries.findUnique({
    where: { tenantId_docType_year: { tenantId, docType, year } },
  });
  const next = (series?.value ?? 0) + 1;
  const padding = series?.padding ?? 4;
  const prefix = series?.prefix || PREFIX[docType];
  return `${prefix}-${year}-${String(next).padStart(padding, '0')}`;
}
