/**
 * التوقيع الرقمي XAdES على الفاتورة.
 *
 * البنية التي تشترطها المواصفة: توقيع XML-DSig مُغلَّف داخل امتدادات UBL،
 * بمرجعين — الأول على الفاتورة نفسها (بعد حذف العناصر الثلاثة)، والثاني
 * على «الخصائص الموقَّعة» التي تحمل وقت التوقيع وبصمة الشهادة ومُصدرها.
 * ثم يُوقَّع `ds:SignedInfo` بالمفتاح الخاص توقيعاً ECDSA-SHA256.
 *
 * ما يوقّعه الموقّع ليس الفاتورة مباشرةً بل `SignedInfo` الذي يحوي تجزئتها:
 * ولذلك تغيير حرفٍ في الفاتورة يغيّر تجزئتها فيكسر التوقيع، وتغيير وقت
 * التوقيع يكسره كذلك — وهو المقصود.
 *
 * ── ما تحقّقنا منه وما لم نتحقّق ─────────────────────────────────────────
 * ترميز TLV وسلسلة PIH وبنية CSR تحقّقنا منها تحققاً تاماً: الأولى بحالة
 * الاختبار الرسمية، والثانية بالقيمة الابتدائية المنشورة، والثالثة بفحص
 * OpenSSL مستقلاً. أما قبول الهيئة لهذا التوقيع بعينه فلا يُثبته إلا
 * تشغيله على بيئة الاختبار ببيانات ربط حقيقية — وهي خطوةٌ لا يغني عنها
 * أي اختبار محلي. راجع docs/zatca.md قبل التشغيل على الإنتاج.
 */
import { createSign } from 'node:crypto';
import { el, txt, serialize, type XmlElement } from './xml.ts';
import { sha256Zatca } from './hash.ts';

const DS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES = 'http://uri.etsi.org/01903/v1.3.2#';

export type SignInput = {
  /** تجزئة الفاتورة بصيغة الهيئة */
  invoiceHash: string;
  /** الشهادة بترميز Base64 بلا ترويسة PEM */
  certificateBase64: string;
  /** المفتاح الخاص بصيغة PEM */
  privateKeyPem: string;
  /** اسم مُصدر الشهادة كما يظهر فيها */
  issuerName: string;
  /** الرقم التسلسلي للشهادة عدداً عشرياً */
  serialNumber: string;
  /** وقت التوقيع — يُثبَّت ليتطابق مع ما دخل في التجزئة */
  signingTime?: string;
};

/**
 * يبني عنصر الخصائص الموقَّعة.
 *
 * `Id` عليه ليس زينة: المرجع الثاني في `SignedInfo` يشير إليه بـ`#`، وأي
 * اختلاف في الاسم يجعل المرجع معلّقاً فيُرفض التوقيع.
 */
export function buildSignedProperties(input: SignInput & { signingTime: string }): XmlElement {
  return el('xades:SignedProperties', { Id: 'xadesSignedProperties' }, [
    el('xades:SignedSignatureProperties', null, [
      txt('xades:SigningTime', input.signingTime),
      el('xades:SigningCertificate', null, [
        el('xades:Cert', null, [
          el('xades:CertDigest', null, [
            el('ds:DigestMethod', { Algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' }, []),
            txt('ds:DigestValue', sha256Zatca(Buffer.from(input.certificateBase64, 'base64'))),
          ]),
          el('xades:IssuerSerial', null, [
            txt('ds:X509IssuerName', input.issuerName),
            txt('ds:X509SerialNumber', input.serialNumber),
          ]),
        ]),
      ]),
    ]),
  ]);
}

/** تحويلات المرجع الأول — هي التي تصف للمدقّق كيف حُذفت العناصر الثلاثة. */
function invoiceTransforms(): XmlElement {
  const xpath = (expr: string) =>
    el('ds:Transform', { Algorithm: 'http://www.w3.org/TR/1999/REC-xpath-19991116' }, [
      txt('ds:XPath', expr),
    ]);

  return el('ds:Transforms', null, [
    xpath('not(//ancestor-or-self::ext:UBLExtensions)'),
    xpath('not(//ancestor-or-self::cac:Signature)'),
    xpath("not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])"),
    el('ds:Transform', { Algorithm: 'http://www.w3.org/2006/12/xml-c14n11' }, []),
  ]);
}

export function buildSignedInfo(invoiceHash: string, signedPropsHash: string): XmlElement {
  return el('ds:SignedInfo', null, [
    el('ds:CanonicalizationMethod', { Algorithm: 'http://www.w3.org/2006/12/xml-c14n11' }, []),
    el('ds:SignatureMethod', {
      Algorithm: 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256',
    }, []),
    el('ds:Reference', { Id: 'invoiceSignedData', URI: '' }, [
      invoiceTransforms(),
      el('ds:DigestMethod', { Algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' }, []),
      txt('ds:DigestValue', invoiceHash),
    ]),
    el('ds:Reference', {
      Type: 'http://www.w3.org/2000/09/xmldsig#SignatureProperties',
      URI: '#xadesSignedProperties',
    }, [
      el('ds:DigestMethod', { Algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' }, []),
      txt('ds:DigestValue', signedPropsHash),
    ]),
  ]);
}

export type SignResult = {
  /** عنصر الامتدادات الجاهز للحقن في الفاتورة */
  extensions: XmlElement;
  /** التوقيع Base64 — يدخل في الوسم ٧ من رمز QR */
  signature: string;
  signedPropsHash: string;
  signingTime: string;
};

/**
 * يوقّع الفاتورة ويعيد امتدادات UBL جاهزة للحقن.
 *
 * الترتيب مقصود: نبني الخصائص الموقَّعة أولاً ونجزّئها، ثم نبني `SignedInfo`
 * حاملاً التجزئتين، ثم نوقّعه. عكس الترتيب يعني التوقيع على شيء ثم تغييره.
 */
export function signInvoice(input: SignInput): SignResult {
  const signingTime = input.signingTime ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const signedProps = buildSignedProperties({ ...input, signingTime });
  const signedPropsHash = sha256Zatca(serialize(signedProps));

  const signedInfo = buildSignedInfo(input.invoiceHash, signedPropsHash);

  const signer = createSign('SHA256');
  signer.update(serialize(signedInfo), 'utf8');
  signer.end();
  const signature = signer.sign(input.privateKeyPem).toString('base64');

  const extensions = el('ext:UBLExtensions', null, [
    el('ext:UBLExtension', null, [
      txt('ext:ExtensionURI', 'urn:oasis:names:specification:ubl:dsig:enveloped:xades'),
      el('ext:ExtensionContent', null, [
        el('sig:UBLDocumentSignatures', {
          'xmlns:sig': 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
          'xmlns:sac': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2',
          'xmlns:sbc': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2',
        }, [
          el('sac:SignatureInformation', null, [
            txt('cbc:ID', 'urn:oasis:names:specification:ubl:signature:1'),
            txt('sbc:ReferencedSignatureID', 'urn:oasis:names:specification:ubl:signature:Invoice'),
            el('ds:Signature', { 'xmlns:ds': DS, Id: 'signature' }, [
              signedInfo,
              txt('ds:SignatureValue', signature),
              el('ds:KeyInfo', null, [
                el('ds:X509Data', null, [txt('ds:X509Certificate', input.certificateBase64)]),
              ]),
              el('ds:Object', null, [
                el('xades:QualifyingProperties', {
                  'xmlns:xades': XADES,
                  Target: 'signature',
                }, [signedProps]),
              ]),
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);

  return { extensions, signature, signedPropsHash, signingTime };
}

/** يستبدل امتدادات الفاتورة الفارغة بالامتدادات الموقَّعة. */
export function injectSignature(invoice: XmlElement, extensions: XmlElement): XmlElement {
  const children = (invoice.children ?? []).map((c) =>
    typeof c !== 'string' && c.name === 'ext:UBLExtensions' ? extensions : c,
  );
  return { ...invoice, children };
}

/** يحقن رمز QR في موضعه — بعد PIH وقبل مرجع التوقيع. */
export function injectQr(invoice: XmlElement, qrBase64: string): XmlElement {
  const qrRef = el('cac:AdditionalDocumentReference', null, [
    txt('cbc:ID', 'QR'),
    el('cac:Attachment', null, [
      txt('cbc:EmbeddedDocumentBinaryObject', qrBase64, { mimeCode: 'text/plain' }),
    ]),
  ]);

  const children = [...(invoice.children ?? [])];
  const sigIdx = children.findIndex(
    (c) => typeof c !== 'string' && c.name === 'cac:Signature',
  );
  if (sigIdx === -1) children.push(qrRef);
  else children.splice(sigIdx, 0, qrRef);

  return { ...invoice, children };
}
