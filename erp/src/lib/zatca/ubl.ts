/**
 * توليد فاتورة UBL 2.1 بمواصفة هيئة الزكاة والضريبة والدخل.
 *
 * ترتيب العناصر في UBL ليس تجميلاً: مخطط XSD يفرضه، وعنصرٌ في غير موضعه
 * يُرفض من المدقّق قبل أن يصل إلى الهيئة. فالترتيب هنا مقصود سطراً سطراً.
 *
 * رموز نوع الفاتورة (InvoiceTypeCode):
 *   ٣٨٨ فاتورة | ٣٨١ إشعار دائن | ٣٨٣ إشعار مدين
 * والسمة `name` عليها أربعة أرقام تحدّد التصنيف:
 *   ٠١٠٠ فاتورة ضريبية (بين المنشآت) | ٠٢٠٠ فاتورة ضريبية مبسطة (للمستهلك)
 */
import { el, txt, type XmlElement } from './xml.ts';
import { d, money } from '../money.ts';

const NS = {
  xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
};

export type UblParty = {
  nameAr: string;
  vatNumber?: string | null;
  /** نوع المعرّف البديل حين لا رقم ضريبي: CRN | MOM | MLS | SAG | NAT | GCC | IQA | PAS | OTH */
  otherIdType?: string | null;
  otherIdValue?: string | null;
  street?: string | null;
  buildingNo?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
  additionalNo?: string | null;
  countryCode?: string | null;
};

export type UblLine = {
  id: number;
  descAr: string;
  qty: string;
  uomCode: string;
  unitPrice: string;
  /** خصم السطر بالقيمة */
  discount: string;
  /** الصافي بعد الخصم وقبل الضريبة */
  lineNet: string;
  lineVat: string;
  /** الصافي + الضريبة */
  lineTotal: string;
  /** فئة الضريبة: S | Z | E | O */
  taxCategory: string;
  /** النسبة مئويةً: 15 لا 0.15 */
  taxPercent: string;
  exemptionReasonCode?: string | null;
  exemptionReason?: string | null;
};

export type UblInvoiceInput = {
  /** رقم الفاتورة الظاهر */
  number: string;
  /** المعرّف الفريد */
  uuid: string;
  issueDate: string;   // YYYY-MM-DD
  issueTime: string;   // HH:mm:ss
  /** 388 فاتورة | 381 إشعار دائن | 383 إشعار مدين */
  typeCode: '388' | '381' | '383';
  /** 0100 ضريبية | 0200 مبسطة */
  typeName: '0100' | '0200';
  currency: string;

  /** عدّاد الفاتورة في السلسلة */
  icv: number;
  /** تجزئة الفاتورة السابقة */
  pih: string;
  /** رمز QR — يُحقن بعد التوقيع، ويُحذف قبل التجزئة */
  qr?: string;

  seller: UblParty;
  buyer: UblParty;

  lines: UblLine[];

  /** مجموع صافي السطور قبل الخصم العام */
  lineExtensionAmount: string;
  /** الوعاء الخاضع = صافي السطور − الخصم العام */
  taxExclusiveAmount: string;
  /** الوعاء + الضريبة */
  taxInclusiveAmount: string;
  allowanceTotal: string;
  vatTotal: string;
  prepaidAmount: string;
  payableAmount: string;

  /** مجاميع الضريبة بحسب الفئة */
  taxSubtotals: {
    taxableAmount: string;
    taxAmount: string;
    category: string;
    percent: string;
    exemptionReasonCode?: string | null;
    exemptionReason?: string | null;
  }[];

  /** سبب الإشعار الدائن/المدين والفاتورة الأصلية — إلزاميان معه */
  correctionReason?: string | null;
  originalInvoiceNumber?: string | null;

  /** كود وسيلة السداد بمعيار UN/ECE 4461: 10 نقداً، 30 تحويلاً، 42 بنكياً، 48 بطاقة */
  paymentMeansCode?: string;
  dueDate?: string | null;
  notes?: string | null;
};

function partyIdentification(p: UblParty): XmlElement[] {
  // المعرّف البديل يُذكر فقط حين لا يوجد رقم ضريبي — وذكرهما معاً يُرفض.
  if (p.vatNumber) return [];
  if (!p.otherIdType || !p.otherIdValue) return [];
  return [
    el('cac:PartyIdentification', null, [
      txt('cbc:ID', p.otherIdValue, { schemeID: p.otherIdType }),
    ]),
  ];
}

function postalAddress(p: UblParty): XmlElement {
  const kids: XmlElement[] = [];
  if (p.street) kids.push(txt('cbc:StreetName', p.street));
  if (p.additionalNo) kids.push(txt('cbc:AdditionalStreetName', p.additionalNo));
  if (p.buildingNo) kids.push(txt('cbc:BuildingNumber', p.buildingNo));
  if (p.district) kids.push(txt('cbc:CitySubdivisionName', p.district));
  if (p.city) kids.push(txt('cbc:CityName', p.city));
  if (p.postalCode) kids.push(txt('cbc:PostalZone', p.postalCode));
  kids.push(
    el('cac:Country', null, [txt('cbc:IdentificationCode', p.countryCode ?? 'SA')]),
  );
  return el('cac:PostalAddress', null, kids);
}

function party(p: UblParty): XmlElement {
  const kids: XmlElement[] = [
    ...partyIdentification(p),
    postalAddress(p),
  ];

  // التسجيل الضريبي: الرقم إن وُجد، والاسم القانوني دائماً.
  const taxScheme = el('cac:PartyTaxScheme', null, [
    ...(p.vatNumber ? [txt('cbc:CompanyID', p.vatNumber)] : []),
    el('cac:TaxScheme', null, [txt('cbc:ID', 'VAT')]),
  ]);
  kids.push(taxScheme);

  kids.push(el('cac:PartyLegalEntity', null, [txt('cbc:RegistrationName', p.nameAr)]));

  return el('cac:Party', null, kids);
}

function invoiceLine(l: UblLine, currency: string): XmlElement {
  const taxCategory = el('cac:ClassifiedTaxCategory', null, [
    txt('cbc:ID', l.taxCategory),
    txt('cbc:Percent', l.taxPercent),
    el('cac:TaxScheme', null, [txt('cbc:ID', 'VAT')]),
  ]);

  const priceKids: XmlElement[] = [
    txt('cbc:PriceAmount', l.unitPrice, { currencyID: currency }),
  ];
  if (d(l.discount).greaterThan(0)) {
    priceKids.push(
      el('cac:AllowanceCharge', null, [
        txt('cbc:ChargeIndicator', 'false'),
        txt('cbc:AllowanceChargeReason', 'discount'),
        txt('cbc:Amount', l.discount, { currencyID: currency }),
      ]),
    );
  }

  return el('cac:InvoiceLine', null, [
    txt('cbc:ID', l.id),
    txt('cbc:InvoicedQuantity', l.qty, { unitCode: l.uomCode }),
    txt('cbc:LineExtensionAmount', l.lineNet, { currencyID: currency }),
    el('cac:TaxTotal', null, [
      txt('cbc:TaxAmount', l.lineVat, { currencyID: currency }),
      txt('cbc:RoundingAmount', l.lineTotal, { currencyID: currency }),
    ]),
    el('cac:Item', null, [
      txt('cbc:Name', l.descAr),
      taxCategory,
    ]),
    el('cac:Price', null, priceKids),
  ]);
}

/**
 * يبني شجرة الفاتورة.
 *
 * `ext:UBLExtensions` يُترك فارغاً هنا ويُملأ بالتوقيع لاحقاً — وهو أحد
 * ثلاثة عناصر تُحذف قبل حساب التجزئة.
 */
export function buildInvoiceXml(input: UblInvoiceInput): XmlElement {
  const cur = input.currency;
  const kids: XmlElement[] = [];

  // امتدادات UBL — وعاء التوقيع. يبقى فارغاً حتى لحظة التوقيع.
  kids.push(el('ext:UBLExtensions', null, []));

  kids.push(txt('cbc:ProfileID', 'reporting:1.0'));
  kids.push(txt('cbc:ID', input.number));
  kids.push(txt('cbc:UUID', input.uuid));
  kids.push(txt('cbc:IssueDate', input.issueDate));
  kids.push(txt('cbc:IssueTime', input.issueTime));
  kids.push(txt('cbc:InvoiceTypeCode', input.typeCode, { name: input.typeName }));
  if (input.notes) kids.push(txt('cbc:Note', input.notes, { languageID: 'ar' }));
  kids.push(txt('cbc:DocumentCurrencyCode', cur));
  kids.push(txt('cbc:TaxCurrencyCode', cur));

  // الإشعار الدائن/المدين يشير إلى فاتورته الأصلية — وبدونه يُرفض.
  if (input.typeCode !== '388' && input.originalInvoiceNumber) {
    kids.push(
      el('cac:BillingReference', null, [
        el('cac:InvoiceDocumentReference', null, [txt('cbc:ID', input.originalInvoiceNumber)]),
      ]),
    );
  }

  // عدّاد الفاتورة في السلسلة
  kids.push(
    el('cac:AdditionalDocumentReference', null, [
      txt('cbc:ID', 'ICV'),
      txt('cbc:UUID', String(input.icv)),
    ]),
  );

  // تجزئة الفاتورة السابقة — بها تُربط السلسلة فلا تُحذف فاتورة بلا أثر
  kids.push(
    el('cac:AdditionalDocumentReference', null, [
      txt('cbc:ID', 'PIH'),
      el('cac:Attachment', null, [
        txt('cbc:EmbeddedDocumentBinaryObject', input.pih, {
          mimeCode: 'text/plain',
        }),
      ]),
    ]),
  );

  // رمز QR — يُحقن بعد التوقيع ويُحذف قبل التجزئة
  if (input.qr) {
    kids.push(
      el('cac:AdditionalDocumentReference', null, [
        txt('cbc:ID', 'QR'),
        el('cac:Attachment', null, [
          txt('cbc:EmbeddedDocumentBinaryObject', input.qr, { mimeCode: 'text/plain' }),
        ]),
      ]),
    );
  }

  // مرجع التوقيع — يُحذف قبل التجزئة كذلك
  kids.push(
    el('cac:Signature', null, [
      txt('cbc:ID', 'urn:oasis:names:specification:ubl:signature:Invoice'),
      txt('cbc:SignatureMethod', 'urn:oasis:names:specification:ubl:dsig:enveloped:xades'),
    ]),
  );

  kids.push(el('cac:AccountingSupplierParty', null, [party(input.seller)]));
  kids.push(el('cac:AccountingCustomerParty', null, [party(input.buyer)]));

  kids.push(
    el('cac:Delivery', null, [txt('cbc:ActualDeliveryDate', input.issueDate)]),
  );

  kids.push(
    el('cac:PaymentMeans', null, [
      txt('cbc:PaymentMeansCode', input.paymentMeansCode ?? '30'),
      ...(input.typeCode !== '388' && input.correctionReason
        ? [txt('cbc:InstructionNote', input.correctionReason)]
        : []),
    ]),
  );

  if (d(input.allowanceTotal).greaterThan(0)) {
    kids.push(
      el('cac:AllowanceCharge', null, [
        txt('cbc:ChargeIndicator', 'false'),
        txt('cbc:AllowanceChargeReason', 'discount'),
        txt('cbc:Amount', input.allowanceTotal, { currencyID: cur }),
        el('cac:TaxCategory', null, [
          txt('cbc:ID', 'S'),
          txt('cbc:Percent', '15'),
          el('cac:TaxScheme', null, [txt('cbc:ID', 'VAT')]),
        ]),
      ]),
    );
  }

  // مجاميع الضريبة: الأولى بتفصيل الفئات، والثانية بالمجموع وحده —
  // المواصفة توجب الاثنتين بهذا الترتيب.
  kids.push(
    el('cac:TaxTotal', null, [
      txt('cbc:TaxAmount', input.vatTotal, { currencyID: cur }),
      ...input.taxSubtotals.map((s) =>
        el('cac:TaxSubtotal', null, [
          txt('cbc:TaxableAmount', s.taxableAmount, { currencyID: cur }),
          txt('cbc:TaxAmount', s.taxAmount, { currencyID: cur }),
          el('cac:TaxCategory', null, [
            txt('cbc:ID', s.category),
            txt('cbc:Percent', s.percent),
            ...(s.category !== 'S' && s.exemptionReasonCode
              ? [
                  txt('cbc:TaxExemptionReasonCode', s.exemptionReasonCode),
                  txt('cbc:TaxExemptionReason', s.exemptionReason ?? ''),
                ]
              : []),
            el('cac:TaxScheme', null, [txt('cbc:ID', 'VAT')]),
          ]),
        ]),
      ),
    ]),
  );
  kids.push(
    el('cac:TaxTotal', null, [txt('cbc:TaxAmount', input.vatTotal, { currencyID: cur })]),
  );

  kids.push(
    el('cac:LegalMonetaryTotal', null, [
      txt('cbc:LineExtensionAmount', input.lineExtensionAmount, { currencyID: cur }),
      txt('cbc:TaxExclusiveAmount', input.taxExclusiveAmount, { currencyID: cur }),
      txt('cbc:TaxInclusiveAmount', input.taxInclusiveAmount, { currencyID: cur }),
      txt('cbc:AllowanceTotalAmount', input.allowanceTotal, { currencyID: cur }),
      txt('cbc:PrepaidAmount', input.prepaidAmount, { currencyID: cur }),
      txt('cbc:PayableAmount', input.payableAmount, { currencyID: cur }),
    ]),
  );

  for (const line of input.lines) kids.push(invoiceLine(line, cur));

  return el('Invoice', NS, kids);
}

/** يصوغ مبلغاً بمنزلتين — الصيغة التي تقبلها المواصفة في كل حقل نقدي. */
export function amt(v: unknown): string {
  return money(v as never).toFixed(2);
}
