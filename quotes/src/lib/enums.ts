/** الحالات المسموح بها — SQLite لا تدعم enums فتُفرض هنا. */

export const DOC_TYPE = {
  QUOTE: 'QUOTE',
  CONTRACT: 'CONTRACT',
  SUPPLY_AGREEMENT: 'SUPPLY_AGREEMENT',
} as const;
export type DocType = (typeof DOC_TYPE)[keyof typeof DOC_TYPE];

export const DOC_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  SIGNING: 'SIGNING',
  SIGNED: 'SIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type DocStatus = (typeof DOC_STATUS)[keyof typeof DOC_STATUS];

export const STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: 'مسودة', en: 'Draft' },
  APPROVED: { ar: 'معتمد', en: 'Approved' },
  SENT: { ar: 'مُرسَل', en: 'Sent' },
  ACCEPTED: { ar: 'مقبول', en: 'Accepted' },
  SIGNING: { ar: 'قيد التوقيع', en: 'Out for signature' },
  SIGNED: { ar: 'موقّع', en: 'Signed' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In progress' },
  REJECTED: { ar: 'مرفوض', en: 'Declined' },
  EXPIRED: { ar: 'منتهي الصلاحية', en: 'Expired' },
  CANCELLED: { ar: 'ملغى', en: 'Cancelled' },
};

/** لا يُسمح بأي إرسال قبل الاعتماد البشري. */
export const SENDABLE_STATUSES: string[] = [
  DOC_STATUS.APPROVED,
  DOC_STATUS.SENT,
  DOC_STATUS.ACCEPTED,
  DOC_STATUS.SIGNING,
  DOC_STATUS.SIGNED,
  DOC_STATUS.IN_PROGRESS,
];

export function isSendable(status: string): boolean {
  return SENDABLE_STATUSES.includes(status);
}

export const INVOICE_STATUS = {
  DUE: 'DUE',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

export const INVOICE_STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  DUE: { ar: 'مستحقة', en: 'Due' },
  PAID: { ar: 'مدفوعة', en: 'Paid' },
  CANCELLED: { ar: 'ملغاة', en: 'Cancelled' },
  REFUNDED: { ar: 'مستردة', en: 'Refunded' },
};

export const SUPPLY_STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: 'مسودة', en: 'Draft' },
  QUOTING: { ar: 'استقبال عروض الموردين', en: 'Collecting supplier bids' },
  SELECTED: { ar: 'تم اختيار المورد', en: 'Supplier selected' },
  AGREEMENT: { ar: 'اتفاقية قيد التوقيع', en: 'Agreement out for signature' },
  FUNDED: { ar: 'مموّلة في المحفظة', en: 'Funded in wallet' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In progress' },
  COMPLETED: { ar: 'مكتملة', en: 'Completed' },
  CANCELLED: { ar: 'ملغاة', en: 'Cancelled' },
};

export const ENVELOPE_STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  created: { ar: 'أُنشئ', en: 'Created' },
  sent: { ar: 'أُرسل للتوقيع', en: 'Sent' },
  delivered: { ar: 'وصل للموقّع', en: 'Delivered' },
  completed: { ar: 'اكتمل التوقيع', en: 'Completed' },
  declined: { ar: 'رُفض', en: 'Declined' },
  voided: { ar: 'أُلغي', en: 'Voided' },
};

export const WALLET_KIND_LABEL: Record<string, { ar: string; en: string }> = {
  PAYMENT: { ar: 'دفعة أتعاب', en: 'Fee payment' },
  GOV_FEE_DEPOSIT: { ar: 'إيداع عهدة رسوم حكومية', en: 'Government fee deposit' },
  SUPPLY_DEPOSIT: { ar: 'إيداع قيمة توريد', en: 'Supply value deposit' },
  GOV_FEE_SPEND: { ar: 'صرف رسوم حكومية', en: 'Government fee disbursement' },
  SUPPLIER_PAYOUT: { ar: 'صرف لمورد', en: 'Supplier payout' },
  REFUND: { ar: 'استرداد', en: 'Refund' },
  ADJUSTMENT: { ar: 'تسوية', en: 'Adjustment' },
};
