/**
 * طلب توقيع الشهادة (CSR) لربط المنشأة بمنظومة فاتورة.
 *
 * أوّل خطوة في المرحلة الثانية: تولّد المنشأة مفتاحاً خاصاً وطلب توقيع،
 * وترسله للهيئة فتعود بشهادة امتثال، ثم بشهادة إنتاج بعد اجتياز الاختبارات.
 * كل فاتورة بعدها تُوقَّع بالمفتاح وتُختم بالشهادة.
 *
 * ما تشترطه المواصفة ولا يقبل اجتهاداً:
 *  ـ المنحنى secp256k1 تحديداً — لا secp256r1 (المسمّى P-256) الشائع.
 *    الخلط بينهما يُنتج طلباً يُرفض برسالةٍ لا تقول السبب.
 *  ـ امتداد باسم القالب (OID 1.3.6.1.4.1.311.20.2) بقيمة تختلف بين بيئة
 *    الاختبار والإنتاج.
 *  ـ امتداد الاسم البديل يحمل خمسة حقول: SN بصيغة «1-الحل|2-الطراز|3-الرقم
 *    التسلسلي»، وUID بالرقم الضريبي، وtitle برمز نوع الفاتورة، والعنوان،
 *    والنشاط.
 *  ـ رمز نوع الفاتورة أربعة أرقام: الأول للفاتورة الضريبية والثاني للمبسطة،
 *    والثالث والرابع محجوزان صفرين. «1100» تعني الاثنتين معاً.
 */
import { createSign, generateKeyPairSync, createPublicKey, type KeyObject } from 'node:crypto';
import * as A from './asn1.ts';

/** معرّفات الكائنات المستعملة في الطلب. */
const OID = {
  /** ecdsa-with-SHA256 */
  ecdsaWithSha256: '1.2.840.10045.4.3.2',
  commonName: '2.5.4.3',
  organizationName: '2.5.4.10',
  organizationalUnit: '2.5.4.11',
  countryName: '2.5.4.6',
  serialNumber: '2.5.4.5',
  title: '2.5.4.12',
  registeredAddress: '2.5.4.26',
  businessCategory: '2.5.4.15',
  /** UID في مخطط الدليل */
  userId: '0.9.2342.19200300.100.1.1',
  /** pkcs-9-at-extensionRequest */
  extensionRequest: '1.2.840.113549.1.9.14',
  /** اسم قالب الشهادة — امتداد مايكروسوفت الذي تعتمده الهيئة */
  certificateTemplateName: '1.3.6.1.4.1.311.20.2',
  subjectAltName: '2.5.29.17',
} as const;

export type ZatcaEnvironment = 'SANDBOX' | 'SIMULATION' | 'PRODUCTION';

/** اسم القالب يختلف بين البيئات — والخطأ فيه يُرفض الطلب. */
export const TEMPLATE_NAME: Record<ZatcaEnvironment, string> = {
  SANDBOX: 'TSTZATCA-Code-Signing',
  SIMULATION: 'PREZATCA-Code-Signing',
  PRODUCTION: 'ZATCA-Code-Signing',
};

export type CsrInput = {
  environment: ZatcaEnvironment;
  /** الاسم الشائع — يُميّز الجهاز داخل المنشأة */
  commonName: string;
  /** الرقم التسلسلي للجهاز/الحل */
  serialNumber: string;
  /** الرقم الضريبي للمنشأة (١٥ رقماً) */
  vatNumber: string;
  /** اسم المنشأة كما في السجل */
  organizationName: string;
  /** اسم الفرع أو الوحدة. مجموعات ضريبة القيمة المضافة تضع هنا رقم الفرع (١٠ أرقام) */
  organizationalUnit: string;
  /** العنوان المسجَّل */
  registeredAddress: string;
  /** النشاط التجاري */
  businessCategory: string;
  /** اسم الحل البرمجي وطرازه — يدخلان في حقل SN */
  solutionName?: string;
  solutionVersion?: string;
  /** رمز نوع الفاتورة: أربعة أرقام. الافتراضي «1100» = ضريبية ومبسطة */
  invoiceType?: string;
  countryCode?: string;
};

function rdn(oidStr: string, value: string, printable = false): Buffer {
  return A.set(
    A.sequence(A.oid(oidStr), printable ? A.printableString(value) : A.utf8String(value)),
  );
}

/**
 * يولّد زوج مفاتيح على المنحنى الذي تشترطه الهيئة.
 *
 * secp256k1 لا P-256. المنحنيان بالطول نفسه ويبدوان متكافئين في أي واجهة،
 * والخطأ بينهما لا يظهر إلا حين ترفض الهيئة الطلب.
 */
export function generateKeyPair() {
  return generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

/** يبني الاسم البديل الذي تقرأ منه الهيئة بيانات المنشأة والجهاز. */
function buildSubjectAltName(input: CsrInput): Buffer {
  const solution = input.solutionName ?? 'BP-ERP';
  const version = input.solutionVersion ?? '1.0';

  // الصيغة حرفية: «1-الحل|2-الطراز|3-الرقم التسلسلي»
  const sn = `1-${solution}|2-${version}|3-${input.serialNumber}`;

  const directoryName = A.sequence(
    rdn(OID.serialNumber, sn),
    rdn(OID.userId, input.vatNumber),
    rdn(OID.title, input.invoiceType ?? '1100'),
    rdn(OID.registeredAddress, input.registeredAddress),
    rdn(OID.businessCategory, input.businessCategory),
  );

  // GeneralName ::= [4] directoryName — بنّاء لأنه يحمل بنية
  const generalName = A.contextTag(4, directoryName);
  const generalNames = A.sequence(generalName);

  return A.sequence(A.oid(OID.subjectAltName), A.octetString(generalNames));
}

function buildExtensions(input: CsrInput): Buffer {
  const templateExt = A.sequence(
    A.oid(OID.certificateTemplateName),
    A.octetString(A.utf8String(TEMPLATE_NAME[input.environment])),
  );

  return A.sequence(templateExt, buildSubjectAltName(input));
}

/**
 * يبني طلب توقيع الشهادة ويوقّعه بالمفتاح الخاص.
 *
 * @returns الطلب بصيغة PEM وبصيغة Base64 (وهي التي تُرسل للهيئة في جسم الطلب)
 */
export function buildCsr(
  input: CsrInput,
  privateKeyPem: string,
  publicKeyDer: Buffer,
): { pem: string; base64: string; der: Buffer } {
  // ── CertificationRequestInfo
  const subject = A.sequence(
    rdn(OID.countryName, input.countryCode ?? 'SA', true),
    rdn(OID.organizationName, input.organizationName),
    rdn(OID.organizationalUnit, input.organizationalUnit),
    rdn(OID.commonName, input.commonName),
  );

  // المفتاح العام يخرج من Node بصيغة SPKI جاهزة، فلا نعيد بناءها.
  const subjectPublicKeyInfo = publicKeyDer;

  // attributes ::= [0] IMPLICIT SET OF Attribute — ضمني لا بنّاء بالمعنى المعتاد
  const attributes = A.contextTag(
    0,
    A.sequence(A.oid(OID.extensionRequest), A.set(buildExtensions(input))),
  );

  const certificationRequestInfo = A.sequence(
    A.integer(0), // الإصدار: صفر
    subject,
    subjectPublicKeyInfo,
    attributes,
  );

  // ── التوقيع على البنية أعلاه
  const signer = createSign('SHA256');
  signer.update(certificationRequestInfo);
  signer.end();
  const signature = signer.sign(privateKeyPem);

  const der = A.sequence(
    certificationRequestInfo,
    A.sequence(A.oid(OID.ecdsaWithSha256)),
    A.bitString(signature),
  );

  const pem = A.toPem(der, 'CERTIFICATE REQUEST');

  return {
    pem,
    // الهيئة تقبل الطلب مُرمَّزاً Base64 لنصّ PEM كاملاً
    base64: Buffer.from(pem, 'utf8').toString('base64'),
    der,
  };
}

/** يولّد المفتاح والطلب معاً — الاستدعاء المعتاد عند ربط منشأة جديدة. */
export function createCsrWithKey(input: CsrInput) {
  const { privateKey, publicKey } = generateKeyPair();
  const csr = buildCsr(input, privateKey, publicKey);
  return {
    privateKeyPem: privateKey,
    publicKeyDer: publicKey,
    csrPem: csr.pem,
    csrBase64: csr.base64,
    csrDer: csr.der,
  };
}

/** يستخرج المفتاح العام الخام (نقطة المنحنى) — الوسم ٨ في رمز QR. */
export function rawPublicKeyFromCert(certPem: string): Buffer {
  const key: KeyObject = createPublicKey(certPem);
  return key.export({ type: 'spki', format: 'der' });
}
