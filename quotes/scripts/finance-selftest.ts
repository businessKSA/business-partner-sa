/**
 * فحص ذاتي للنظام المالي — دوال محضة بلا قاعدة بيانات ولا شبكة:
 *   npx tsx scripts/finance-selftest.ts
 *
 * يتحقق من: بنية TLV وفكّها، صحة أرقام ضريبية، مصفوفة QR، حتمية XML
 * وتجزئته، ثابت PIH الافتتاحي، وجولة توقيع/تحقق ECDSA بمفتاح مولّد،
 * وقراءة شهادة X.509 ذاتية التوقيع عبر openssl إن وُجد.
 */
import assert from 'assert';
import { createVerify, generateKeyPairSync } from 'crypto';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { qrPayloadPhase1, decodeTlv, vatNumberLooksValid } from '../src/lib/zatca/qr';
import { qrMatrix } from '../src/lib/zatca/qrcode';
import { buildUnsignedInvoiceXml, computeXmlTotals, type ZatcaInvoiceData } from '../src/lib/zatca/xml';
import { invoiceHashBase64, signInvoiceHash, parseCertificate } from '../src/lib/zatca/sign';

let passed = 0;
function ok(name: string, fn: () => void) {
  try { fn(); passed += 1; console.log(`✔ ${name}`); }
  catch (e) { console.error(`✘ ${name}:`, e instanceof Error ? e.message : e); process.exitCode = 1; }
}

// ثابت لائحة الفوترة: تجزئة «الفاتورة السابقة» لأول فاتورة
const GENESIS = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

ok('TLV: ترميز وفك بأسماء عربية (الطول بالبايت لا بالحرف)', () => {
  const qr = qrPayloadPhase1({
    sellerName: 'شركة بزنس بارتنر سلوشنز',
    vatNumber: '312079341500003',
    timestamp: '2026-08-27T10:30:00Z',
    total: 115, vat: 15,
  });
  const t = decodeTlv(qr);
  assert.equal(t[1], 'شركة بزنس بارتنر سلوشنز');
  assert.equal(t[2], '312079341500003');
  assert.equal(t[4], '115.00');
  assert.equal(t[5], '15.00');
});

ok('الرقم الضريبي: القبول والرفض', () => {
  assert.equal(vatNumberLooksValid('312079341500003'), true);
  assert.equal(vatNumberLooksValid('212079341500003'), false);
  assert.equal(vatNumberLooksValid('31207934150000'), false);
});

ok('QR: المصفوفة تُبنى لحمولة المرحلتين', () => {
  const small = qrMatrix('A'.repeat(120)); // حمولة المرحلة الأولى
  assert.ok(small.matrix.length >= 21);
  const big = qrMatrix('A'.repeat(550)); // حمولة المرحلة الثانية بتوقيع وشهادة
  assert.ok(big.matrix.length > small.matrix.length);
});

const sample: ZatcaInvoiceData = {
  number: 'BP-TI-2026-0001', uuid: '11111111-2222-3333-4444-555555555555',
  icv: 1, pih: GENESIS,
  issueDate: '2026-08-27', issueTime: '10:30:00',
  docType: 'SIMPLIFIED', typeCode: '388', currency: 'SAR',
  seller: {
    name: 'شركة بزنس بارتنر سلوشنز', vatNumber: '312079341500003', crNumber: '7038825860',
    street: 'ريحانة بنت زيد', building: '5890', city: 'الرياض',
    postalZone: '13331', district: 'العارض', countryCode: 'SA',
  },
  buyer: null,
  lines: [{ nameAr: 'إدارة منصة قوى — شهر', quantity: 1, unitPrice: 999, vatPercent: 15 }],
};

ok('XML: الحسابات — ضريبة سطراً مستقلاً وإجمالي صحيح', () => {
  const t = computeXmlTotals(sample.lines);
  assert.equal(t.net, 999);
  assert.equal(t.vat, 149.85);
  assert.equal(t.total, 1148.85);
});

ok('XML: البناء حتمي والتجزئة ثابتة', () => {
  const a = buildUnsignedInvoiceXml(sample);
  const b = buildUnsignedInvoiceXml(sample);
  assert.equal(a, b);
  assert.equal(invoiceHashBase64(a), invoiceHashBase64(b));
  assert.ok(!a.includes('UBLExtensions'));
  assert.ok(!a.includes('<cac:Signature>'));
  assert.ok(a.includes('<cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>'));
});

ok('التوقيع: جولة توقيع/تحقق ECDSA secp256k1 على تجزئة الفاتورة', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const hash = invoiceHashBase64(buildUnsignedInvoiceXml(sample));
  const sig = signInvoiceHash(hash, privateKey.export({ type: 'sec1', format: 'pem' }).toString());
  const verify = createVerify('sha256');
  verify.update(Buffer.from(hash, 'base64'));
  assert.equal(verify.verify(publicKey, Buffer.from(sig, 'base64')), true);
});

ok('الشهادة: قراءة المُصدر والرقم التسلسلي والمفتاح العام وتوقيع الشهادة', () => {
  let hasOpenssl = true;
  try { execFileSync('openssl', ['version']); } catch { hasOpenssl = false; }
  if (!hasOpenssl) { console.log('  (openssl غير متاح — تُتخطى)'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'zatca-selftest-'));
  const key = join(dir, 'k.pem');
  const crt = join(dir, 'c.pem');
  execFileSync('openssl', ['ecparam', '-name', 'secp256k1', '-genkey', '-noout', '-out', key]);
  execFileSync('openssl', ['req', '-new', '-x509', '-key', key, '-sha256', '-days', '1', '-subj', '/C=SA/O=BP/CN=selftest', '-out', crt]);
  const body = readFileSync(crt, 'utf8').replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
  const info = parseCertificate(body);
  assert.ok(info.issuerName.includes('CN=selftest'));
  assert.ok(/^\d+$/.test(info.serialDecimal));
  assert.ok(info.publicKeyDer.length > 60);
  assert.ok(info.signature.length >= 64);
  writeFileSync(join(dir, 'done'), '1');
});

console.log(`\n${passed} فحوصات ناجحة${process.exitCode ? ' — وثمة إخفاقات أعلاه' : ''}`);
