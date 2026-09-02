/**
 * تأهيل جهاز الفوترة لدى زاتكا — يُشغَّل محلياً مرة واحدة لكل بيئة.
 *
 *   npx tsx scripts/zatca-onboard.ts --otp 123456 [--env sandbox|simulation|production]
 *
 * الخطوات كما ترسمها الهيئة:
 *   1. مفتاح secp256k1 وطلب توقيع شهادة CSR (عبر openssl المثبّت محلياً).
 *   2. شهادة الالتزام المؤقتة CCSID برمز التحقق OTP من بوابة فاتورة
 *      (فاتورة ← الفوترة الإلكترونية ← إلحاق جهاز جديد).
 *   3. ست وثائق فحص التزام: مبسطة ومعيارية × فاتورة وإشعار دائن ومدين.
 *   4. شهادة الإنتاج PCSID.
 *   5. طباعة متغيرات البيئة الجاهزة للنسخ إلى Vercel أو .env.
 *
 * لا يكتب السكربت أي سر إلى قاعدة البيانات أو المستودع — المخرجات للبيئة فقط.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { COMPANY } from '../config/company';
import { requestComplianceCsid, requestProductionCsid, complianceCheckInvoice } from '../src/lib/zatca/api';
import { buildUnsignedInvoiceXml, qrAndSignatureBlocks, computeXmlTotals, type ZatcaInvoiceData, type ZatcaTypeCode } from '../src/lib/zatca/xml';
import { invoiceHashBase64, signInvoiceHash, parseCertificate, signedPropertiesHashBase64, ublExtensionsXml, assembleSignedXml } from '../src/lib/zatca/sign';
import { qrPayloadPhase2 } from '../src/lib/zatca/qr';
import { genesisPih, riyadhDateTime } from '../src/lib/zatca/issue';
import { sellerProfile } from '../src/lib/zatca/config';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] || null : null;
}

const pick = (obj: unknown, key: string): string => {
  const walk = (o: unknown, depth: number): string | undefined => {
    if (!o || typeof o !== 'object' || depth > 5) return undefined;
    const r = o as Record<string, unknown>;
    if (typeof r[key] === 'string' && r[key]) return r[key] as string;
    if (typeof r[key] === 'number') return String(r[key]);
    for (const v of Object.values(r)) {
      const hit = walk(v, depth + 1);
      if (hit) return hit;
    }
    return undefined;
  };
  return walk(obj, 0) || '';
};

async function main() {
  const otp = arg('otp');
  const env = arg('env') || 'sandbox';
  process.env.ZATCA_ENV = env;
  if (!otp) {
    console.error('الاستخدام: npx tsx scripts/zatca-onboard.ts --otp <رمز من بوابة فاتورة> [--env sandbox|simulation|production]');
    process.exit(1);
  }
  const seller = sellerProfile();
  if (!seller.ready) {
    console.error(`بيانات البائع غير مكتملة: ${seller.missing.join(', ')}`);
    process.exit(1);
  }

  // 1) المفتاح والـCSR — openssl لأن Node لا يبني CSR بملحقات زاتكا
  const dir = mkdtempSync(join(tmpdir(), 'zatca-'));
  const keyPath = join(dir, 'ec.key');
  const csrPath = join(dir, 'req.csr');
  const cnfPath = join(dir, 'req.cnf');
  const template = env === 'production' ? 'ZATCA-Code-Signing' : env === 'simulation' ? 'PREZATCA-Code-Signing' : 'TSTZATCA-Code-Signing';
  writeFileSync(cnfPath, `oid_section = OIDs
[OIDs]
certificateTemplateName = 1.3.6.1.4.1.311.20.2
[req]
prompt = no
utf8 = yes
default_md = sha256
req_extensions = req_ext
distinguished_name = dn
[dn]
C = SA
OU = Riyadh
O = ${COMPANY.shortName.en}
CN = BP-Internal-Invoicing
[req_ext]
certificateTemplateName = ASN1:PRINTABLESTRING:${template}
subjectAltName = dirName:alt_names
[alt_names]
SN = 1-BP|2-InternalInvoicing|3-${randomUUID()}
UID = ${seller.vatNumber}
title = 1100
registeredAddress = ${seller.city}
businessCategory = Business Services
`);
  execFileSync('openssl', ['ecparam', '-name', 'secp256k1', '-genkey', '-noout', '-out', keyPath]);
  execFileSync('openssl', ['req', '-new', '-sha256', '-key', keyPath, '-config', cnfPath, '-out', csrPath]);
  const privateKeyPem = readFileSync(keyPath, 'utf8');
  const csrBase64 = readFileSync(csrPath, 'utf8')
    .replace(/-----(BEGIN|END) CERTIFICATE REQUEST-----/g, '')
    .replace(/\s+/g, '');
  console.log('✔ المفتاح والـCSR جاهزان');

  // 2) شهادة الالتزام CCSID
  const ccsid = await requestComplianceCsid(Buffer.from(`-----BEGIN CERTIFICATE REQUEST-----\n${csrBase64}\n-----END CERTIFICATE REQUEST-----`, 'utf8').toString('base64'), otp);
  if (ccsid.status !== 200) {
    console.error(`✘ رفض طلب CCSID (HTTP ${ccsid.status})`, JSON.stringify(ccsid.raw, null, 2));
    process.exit(1);
  }
  const ccsidToken = pick(ccsid.raw, 'binarySecurityToken');
  const ccsidSecret = pick(ccsid.raw, 'secret');
  const requestId = pick(ccsid.raw, 'requestID') || pick(ccsid.raw, 'requestId');
  console.log('✔ صدرت شهادة الالتزام المؤقتة CCSID');

  // 3) وثائق فحص الالتزام الست
  const certBody = Buffer.from(ccsidToken, 'base64').toString('utf8').replace(/\s+/g, '');
  const cert = parseCertificate(certBody);
  const cases: { docType: 'SIMPLIFIED' | 'STANDARD'; typeCode: ZatcaTypeCode; label: string }[] = [
    { docType: 'SIMPLIFIED', typeCode: '388', label: 'مبسطة — فاتورة' },
    { docType: 'SIMPLIFIED', typeCode: '381', label: 'مبسطة — إشعار دائن' },
    { docType: 'SIMPLIFIED', typeCode: '383', label: 'مبسطة — إشعار مدين' },
    { docType: 'STANDARD', typeCode: '388', label: 'معيارية — فاتورة' },
    { docType: 'STANDARD', typeCode: '381', label: 'معيارية — إشعار دائن' },
    { docType: 'STANDARD', typeCode: '383', label: 'معيارية — إشعار مدين' },
  ];
  let pih = genesisPih();
  let icv = 0;
  let allPassed = true;
  for (const c of cases) {
    icv += 1;
    const now = riyadhDateTime();
    const uuid = randomUUID();
    const lines = [{ nameAr: 'خدمة تجريبية لفحص الالتزام', quantity: 1, unitPrice: 100, vatPercent: 15 }];
    const data: ZatcaInvoiceData = {
      number: `COMP-${icv}`, uuid, icv, pih,
      issueDate: now.date, issueTime: now.time,
      docType: c.docType, typeCode: c.typeCode,
      billingReference: c.typeCode === '388' ? null : 'COMP-1',
      instructionNote: c.typeCode === '388' ? null : 'فحص التزام',
      currency: 'SAR', seller,
      buyer: c.docType === 'STANDARD'
        ? { name: 'شركة تجريبية للفحص', vatNumber: '399999999900003', crNumber: '1010101010', city: 'الرياض', countryCode: 'SA' }
        : null,
      lines,
    };
    const unsigned = buildUnsignedInvoiceXml(data);
    const hash = invoiceHashBase64(unsigned);
    const signature = signInvoiceHash(hash, privateKeyPem);
    const signingTime = `${now.date}T${now.time}`;
    const spHash = signedPropertiesHashBase64(signingTime, cert);
    const totals = computeXmlTotals(lines);
    const qr = qrPayloadPhase2({
      sellerName: seller.name, vatNumber: seller.vatNumber, timestamp: now.iso,
      total: totals.total, vat: totals.vat,
      invoiceHash: hash, signature, publicKeyDer: cert.publicKeyDer,
      certSignature: c.docType === 'SIMPLIFIED' ? cert.signature : null,
    });
    const ext = ublExtensionsXml({ invoiceHash: hash, signedPropsHash: spHash, digitalSignature: signature, cert, signingTime });
    const signedXml = assembleSignedXml(unsigned, ext, qrAndSignatureBlocks(qr));
    const res = await complianceCheckInvoice({
      uuid, invoiceHash: hash,
      signedXmlBase64: Buffer.from(signedXml, 'utf8').toString('base64'),
      ccsidToken, ccsidSecret,
    });
    const passed = res.ok && !res.errors.length;
    allPassed = allPassed && passed;
    console.log(`${passed ? '✔' : '✘'} ${c.label} — ${res.disposition || `HTTP ${res.status}`}`);
    if (res.warnings.length) console.log('   تحذيرات:', res.warnings.join(' | '));
    if (res.errors.length) console.log('   أخطاء:', res.errors.join(' | '));
    pih = hash;
  }
  if (!allPassed) {
    console.error('\n✘ لم تجتز كل وثائق الفحص — راجع الأخطاء أعلاه قبل طلب شهادة الإنتاج.');
    process.exit(1);
  }

  // 4) شهادة الإنتاج PCSID
  const pcsid = await requestProductionCsid({ complianceRequestId: requestId, ccsidToken, ccsidSecret });
  if (pcsid.status !== 200) {
    console.error(`✘ رفض طلب PCSID (HTTP ${pcsid.status})`, JSON.stringify(pcsid.raw, null, 2));
    process.exit(1);
  }
  const prodToken = pick(pcsid.raw, 'binarySecurityToken');
  const prodSecret = pick(pcsid.raw, 'secret');
  console.log('✔ صدرت شهادة الإنتاج PCSID\n');

  // 5) المتغيرات الجاهزة
  console.log('انسخ هذه المتغيرات إلى بيئة التشغيل (Vercel → Environment Variables):\n');
  console.log(`ZATCA_ENV=${env}`);
  console.log(`ZATCA_PRIVATE_KEY=${privateKeyPem.replace(/-----(BEGIN|END) EC PRIVATE KEY-----/g, '').replace(/\s+/g, '')}`);
  console.log(`ZATCA_CERTIFICATE=${prodToken}`);
  console.log(`ZATCA_SECRET=${prodSecret}`);
  console.log('\nثم أعد النشر — وستصدر الفواتير موقَّعة ومُبلَّغة آلياً.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
