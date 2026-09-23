/**
 * بناء فاتورة UBL 2.1 كما تشترطها لائحة الفوترة الإلكترونية.
 *
 * الـXML يُبنى نصاً بقالب ثابت لا عبر مكتبة DOM، عمداً: تجزئة الفاتورة تُحسب
 * على النص الحرفي بعد إزالة كتل التوقيع، فأي إعادة تسلسل غير حتمية تكسر
 * التحقق. لا عناصر ذاتية الإغلاق في جسم الفاتورة ولا تعليقات — حتى تبقى
 * كنونة C14N11 عند الهيئة مطابقة لما وقّعناه.
 */

export type ZatcaDocType = 'SIMPLIFIED' | 'STANDARD';
export type ZatcaTypeCode = '388' | '381' | '383';

export interface ZatcaLine {
  nameAr: string;
  quantity: number;
  /** سعر الوحدة غير شامل الضريبة */
  unitPrice: number;
  /** نسبة الضريبة كنسبة مئوية: 15 أو 0 */
  vatPercent: number;
}

export interface ZatcaInvoiceData {
  /** الرقم التسلسلي الضريبي للفاتورة */
  number: string;
  uuid: string;
  /** Invoice Counter Value */
  icv: number;
  /** تجزئة الفاتورة السابقة */
  pih: string;
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:MM:SS
  docType: ZatcaDocType;
  typeCode: ZatcaTypeCode;
  /** مرجع الفاتورة الأصل — إلزامي للإشعار الدائن/المدين */
  billingReference?: string | null;
  /** سبب الإشعار الدائن/المدين */
  instructionNote?: string | null;
  currency: string;
  seller: {
    name: string;
    vatNumber: string;
    crNumber: string;
    street: string;
    building: string;
    city: string;
    postalZone: string;
    district: string;
    countryCode: string;
  };
  buyer?: {
    name: string;
    vatNumber?: string | null;
    crNumber?: string | null;
    street?: string | null;
    city?: string | null;
    countryCode?: string | null;
  } | null;
  lines: ZatcaLine[];
  /** 10 نقد | 30 آجل | 42 تحويل بنكي | 48 بطاقة */
  paymentMeansCode?: string;
}

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const m2 = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);

export interface ZatcaTotals {
  net: number;
  vat: number;
  total: number;
}

export function computeXmlTotals(lines: ZatcaLine[]): ZatcaTotals {
  let net = 0;
  let vat = 0;
  for (const l of lines) {
    const ext = Math.round(l.quantity * l.unitPrice * 100) / 100;
    net += ext;
    vat += Math.round(ext * l.vatPercent) / 100;
  }
  net = Math.round(net * 100) / 100;
  vat = Math.round(vat * 100) / 100;
  return { net, vat, total: Math.round((net + vat) * 100) / 100 };
}

/**
 * الفاتورة غير الموقَّعة — بلا UBLExtensions ولا كتلة QR ولا cac:Signature.
 * تجزئة هذا النص (بلا سطر التصريح الأول) هي «تجزئة الفاتورة» المعتمدة،
 * وكتل التوقيع تُحقن لاحقاً في مواضع ثابتة.
 */
export function buildUnsignedInvoiceXml(d: ZatcaInvoiceData): string {
  const t = computeXmlTotals(d.lines);
  const cur = d.currency;
  // 01 فاتورة ضريبية (معيارية) · 02 فاتورة مبسطة — والخانة الثالثة للطرف الثالث/التصدير..
  const subtype = d.docType === 'STANDARD' ? '0100000' : '0200000';

  const vatPercent = d.lines.some((l) => l.vatPercent > 0) ? 15 : 0;
  const taxCategory = vatPercent > 0 ? 'S' : 'O';

  const billingRef = d.billingReference
    ? `
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>${esc(d.billingReference)}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>`
    : '';

  const note = d.instructionNote
    ? `
    <cbc:Note languageID="ar">${esc(d.instructionNote)}</cbc:Note>`
    : '';

  const buyerParty = d.buyer
    ? `
        <cac:Party>
            ${d.buyer.crNumber ? `<cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${esc(d.buyer.crNumber)}</cbc:ID>
            </cac:PartyIdentification>` : `<cac:PartyIdentification>
                <cbc:ID schemeID="OTH">${esc(d.buyer.name)}</cbc:ID>
            </cac:PartyIdentification>`}
            <cac:PostalAddress>
                <cbc:StreetName>${esc(d.buyer.street || 'غير محدد')}</cbc:StreetName>
                <cbc:CityName>${esc(d.buyer.city || 'الرياض')}</cbc:CityName>
                <cac:Country>
                    <cbc:IdentificationCode>${esc(d.buyer.countryCode || 'SA')}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            ${d.buyer.vatNumber ? `<cac:PartyTaxScheme>
                <cbc:CompanyID>${esc(d.buyer.vatNumber)}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>` : `<cac:PartyTaxScheme>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>`}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${esc(d.buyer.name)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>`
    : '';

  const linesXml = d.lines
    .map((l, i) => {
      const ext = m2(l.quantity * l.unitPrice);
      const lineVat = m2((Number(ext) * l.vatPercent) / 100);
      const rounding = m2(Number(ext) + Number(lineVat));
      const cat = l.vatPercent > 0 ? 'S' : 'O';
      return `
    <cac:InvoiceLine>
        <cbc:ID>${i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${l.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${cur}">${ext}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${cur}">${lineVat}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="${cur}">${rounding}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${esc(l.nameAr)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${cat}</cbc:ID>
                <cbc:Percent>${m2(l.vatPercent)}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${cur}">${m2(l.unitPrice)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join('');

  const exemptionReason =
    taxCategory === 'O'
      ? `
                    <cbc:TaxExemptionReasonCode>VATEX-SA-OOS</cbc:TaxExemptionReasonCode>
                    <cbc:TaxExemptionReason>خارج نطاق ضريبة القيمة المضافة — عهدة رسوم حكومية</cbc:TaxExemptionReason>`
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${esc(d.number)}</cbc:ID>
    <cbc:UUID>${d.uuid}</cbc:UUID>
    <cbc:IssueDate>${d.issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${d.issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="${subtype}">${d.typeCode}</cbc:InvoiceTypeCode>${note}
    <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>${billingRef}
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${d.icv}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${d.pih}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${esc(d.seller.crNumber)}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>${esc(d.seller.street)}</cbc:StreetName>
                <cbc:BuildingNumber>${esc(d.seller.building)}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${esc(d.seller.district)}</cbc:CitySubdivisionName>
                <cbc:CityName>${esc(d.seller.city)}</cbc:CityName>
                <cbc:PostalZone>${esc(d.seller.postalZone)}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${esc(d.seller.countryCode)}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${esc(d.seller.vatNumber)}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${esc(d.seller.name)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>${buyerParty}
    </cac:AccountingCustomerParty>
    <cac:Delivery>
        <cbc:ActualDeliveryDate>${d.issueDate}</cbc:ActualDeliveryDate>
    </cac:Delivery>
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>${esc(d.paymentMeansCode || '42')}</cbc:PaymentMeansCode>${d.typeCode !== '388' && d.instructionNote ? `
        <cbc:InstructionNote>${esc(d.instructionNote)}</cbc:InstructionNote>` : ''}
    </cac:PaymentMeans>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${cur}">${m2(t.vat)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${cur}">${m2(t.net)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${cur}">${m2(t.vat)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${taxCategory}</cbc:ID>
                <cbc:Percent>${m2(vatPercent)}</cbc:Percent>${exemptionReason}
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${cur}">${m2(t.vat)}</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${cur}">${m2(t.net)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${cur}">${m2(t.net)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${cur}">${m2(t.total)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="${cur}">0.00</cbc:AllowanceTotalAmount>
        <cbc:PrepaidAmount currencyID="${cur}">0.00</cbc:PrepaidAmount>
        <cbc:PayableAmount currencyID="${cur}">${m2(t.total)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>${linesXml}
</Invoice>`;
}

/** كتلة QR و cac:Signature اللتان تُحقنان بعد التوقيع (المرحلة الثانية). */
export function qrAndSignatureBlocks(qrBase64: string): string {
  return `    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrBase64}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>
`;
}
