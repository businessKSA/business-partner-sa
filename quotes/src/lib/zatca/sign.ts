/**
 * توقيع فاتورة المرحلة الثانية — XAdES B-B بمنحنى secp256k1 كما في حزمة
 * أدوات الهيئة الرسمية:
 *
 *   1. تجزئة الفاتورة: SHA-256 للنص غير الموقَّع (بلا سطر التصريح) → base64.
 *   2. التوقيع الرقمي: ECDSA-SHA256 على بايتات التجزئة بالمفتاح الخاص.
 *   3. تجزئة الشهادة: SHA-256 لنص base64 للشهادة → hex → base64.
 *   4. تجزئة SignedProperties: قالب ثابت المسافات — الهيئة تعيد حسابه حرفياً
 *      بنفس القالب، فأي مسافة زائدة تكسر التحقق. لا تُعد تنسيقه.
 *   5. حقن الكتل في الفاتورة وبناء حمولة QR الموسّعة (الوسوم 6–9).
 */
import { createHash, createSign, X509Certificate } from 'crypto';

export interface SignResult {
  signedXml: string;
  invoiceHash: string;
  digitalSignature: string;
  publicKeyDer: Buffer;
  certSignature: Buffer;
}

/** تجزئة الفاتورة: النص غير الموقَّع بلا سطر `<?xml ...?>` الأول. */
export function invoiceHashBase64(unsignedXml: string): string {
  const body = unsignedXml.replace(/^<\?xml[^>]*\?>\s*/,'');
  return createHash('sha256').update(body, 'utf8').digest('base64');
}

/** توقيع ECDSA على بايتات تجزئة الفاتورة. */
export function signInvoiceHash(invoiceHash: string, privateKeyPem: string): string {
  const sign = createSign('sha256');
  sign.update(Buffer.from(invoiceHash, 'base64'));
  return sign.sign(privateKeyPem).toString('base64');
}

/** تجزئة الشهادة كما تحسبها حزمة الهيئة: sha256(نص base64) → hex → base64. */
export function certificateHashBase64(certBodyBase64: string): string {
  const hex = createHash('sha256').update(certBodyBase64, 'utf8').digest('hex');
  return Buffer.from(hex, 'utf8').toString('base64');
}

/** استخراج قيمة توقيع الشهادة (BIT STRING الأخير في بنية X.509). */
export function certificateSignatureBytes(certDer: Buffer): Buffer {
  // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue BIT STRING }
  const readLen = (buf: Buffer, at: number): { len: number; next: number } => {
    let len = buf[at];
    let next = at + 1;
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let i = 0; i < n; i++) len = (len << 8) | buf[next + i];
      next += n;
    }
    return { len, next };
  };
  let at = 0;
  if (certDer[at] !== 0x30) throw new Error('zatca_cert_not_der');
  const outer = readLen(certDer, at + 1);
  at = outer.next;
  const children: { tag: number; start: number; end: number }[] = [];
  while (at < certDer.length && children.length < 3) {
    const tag = certDer[at];
    const { len, next } = readLen(certDer, at + 1);
    children.push({ tag, start: next, end: next + len });
    at = next + len;
  }
  const sig = children[2];
  if (!sig || sig.tag !== 0x03) throw new Error('zatca_cert_signature_not_found');
  // أول بايت في BIT STRING هو عدد البتات غير المستخدمة — يُتجاوز
  return certDer.subarray(sig.start + 1, sig.end);
}

export interface CertificateInfo {
  /** جسم base64 كما يوضع في X509Certificate داخل الـXML */
  body: string;
  issuerName: string;
  serialDecimal: string;
  publicKeyDer: Buffer;
  signature: Buffer;
  hashBase64: string;
}

export function parseCertificate(certBodyBase64: string): CertificateInfo {
  const der = Buffer.from(certBodyBase64, 'base64');
  const x509 = new X509Certificate(der);
  // ترتيب RFC 2253: من الأخص إلى الأعم — عكس ترتيب أسطر Node
  const issuerName = x509.issuer.split('\n').filter(Boolean).reverse().join(', ');
  const serialDecimal = BigInt('0x' + x509.serialNumber).toString(10);
  const publicKeyDer = x509.publicKey.export({ type: 'spki', format: 'der' });
  return {
    body: certBodyBase64,
    issuerName,
    serialDecimal,
    publicKeyDer,
    signature: certificateSignatureBytes(der),
    hashBase64: certificateHashBase64(certBodyBase64),
  };
}

/**
 * قالب SignedProperties — المسافات جزء من العقد مع الهيئة، لا تُنسَّق.
 * التجزئة تُحسب على هذا النص كما هو ثم يُدرج نفسه داخل الـXML.
 */
function signedPropertiesXml(signingTime: string, cert: CertificateInfo): string {
  return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>${signingTime}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${cert.hashBase64}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${cert.issuerName}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${cert.serialDecimal}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:SigningCertificate>
                                        </xades:SignedSignatureProperties>
                                    </xades:SignedProperties>`;
}

export function signedPropertiesHashBase64(signingTime: string, cert: CertificateInfo): string {
  const hex = createHash('sha256').update(signedPropertiesXml(signingTime, cert), 'utf8').digest('hex');
  return Buffer.from(hex, 'utf8').toString('base64');
}

/** كتلة UBLExtensions كاملة بعد ملء القيم. */
export function ublExtensionsXml(args: {
  invoiceHash: string;
  signedPropsHash: string;
  digitalSignature: string;
  cert: CertificateInfo;
  signingTime: string;
}): string {
  const sp = signedPropertiesXml(args.signingTime, args.cert)
    // داخل المستند يرث xades من QualifyingProperties — التصريح يبقى في نسخة
    // التجزئة المستقلة فقط، كما تفعل حزمة الهيئة
    .replace(' xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"', '');
  return `<ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
            <ext:ExtensionContent>
                <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
                    <sac:SignatureInformation>
                        <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                        <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
                            <ds:SignedInfo>
                                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                                <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                                <ds:Reference Id="invoiceSignedData" URI="">
                                    <ds:Transforms>
                                        <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                                    </ds:Transforms>
                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                    <ds:DigestValue>${args.invoiceHash}</ds:DigestValue>
                                </ds:Reference>
                                <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                    <ds:DigestValue>${args.signedPropsHash}</ds:DigestValue>
                                </ds:Reference>
                            </ds:SignedInfo>
                            <ds:SignatureValue>${args.digitalSignature}</ds:SignatureValue>
                            <ds:KeyInfo>
                                <ds:X509Data>
                                    <ds:X509Certificate>${args.cert.body}</ds:X509Certificate>
                                </ds:X509Data>
                            </ds:KeyInfo>
                            <ds:Object>
                                <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
                                    ${sp}
                                </xades:QualifyingProperties>
                            </ds:Object>
                        </ds:Signature>
                    </sac:SignatureInformation>
                </sig:UBLDocumentSignatures>
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    `;
}

/**
 * التجميع النهائي: UBLExtensions بعد سطر التصريح مباشرة، وكتلتا QR
 * وSignature قبل AccountingSupplierParty — مواضع ثابتة يعرفها محلل الهيئة.
 */
export function assembleSignedXml(unsignedXml: string, extensions: string, qrBlocks: string): string {
  let out = unsignedXml.replace(
    /(<Invoice [^>]+>)\n/,
    (m, tag) => `${tag}\n    ${extensions}\n`,
  );
  out = out.replace('    <cac:AccountingSupplierParty>', `${qrBlocks}    <cac:AccountingSupplierParty>`);
  return out;
}
