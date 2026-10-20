/**
 * اختبارات الفوترة الإلكترونية — دوال محضة بلا قاعدة بيانات ولا شبكة.
 * تعمل ضمن `npm test` داخل quotes، فتُفحص مع كل تغيير لا عند التذكّر فقط.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { qrPayloadPhase1, qrPayloadPhase2, decodeTlv, vatNumberLooksValid } from '../src/lib/zatca/qr';
import { qrMatrix } from '../src/lib/zatca/qrcode';
import {
  buildUnsignedInvoiceXml, computeXmlTotals, qrAndSignatureBlocks,
  type ZatcaInvoiceData,
} from '../src/lib/zatca/xml';
import { invoiceHashBase64, signInvoiceHash, parseCertificate, assembleSignedXml } from '../src/lib/zatca/sign';
import { genesisPih, riyadhDateTime } from '../src/lib/zatca/issue';

const SELLER = {
  name: 'شركة بزنس بارتنر سلوشنز — ذات مسؤولية محدودة (شخص واحد)',
  vatNumber: '312079341500003',
  crNumber: '7038825860',
  street: 'ريحانة بنت زيد',
  building: '5890',
  city: 'الرياض',
  postalZone: '13331',
  district: 'العارض',
  countryCode: 'SA',
};

const base = (over: Partial<ZatcaInvoiceData> = {}): ZatcaInvoiceData => ({
  number: 'BP-TI-2026-0001',
  uuid: '11111111-2222-3333-4444-555555555555',
  icv: 1,
  pih: genesisPih(),
  issueDate: '2026-08-27',
  issueTime: '10:30:00',
  docType: 'SIMPLIFIED',
  typeCode: '388',
  currency: 'SAR',
  seller: SELLER,
  buyer: null,
  lines: [{ nameAr: 'إدارة منصة قوى — شهر', quantity: 1, unitPrice: 999, vatPercent: 15 }],
  ...over,
});

// ----------------------------------------------------------------- حمولة QR

test('TLV: الطول بالبايت لا بعدد الحروف — الأسماء العربية تكشف الفرق', () => {
  const qr = qrPayloadPhase1({
    sellerName: 'شركة', vatNumber: SELLER.vatNumber,
    timestamp: '2026-08-27T10:30:00Z', total: 115, vat: 15,
  });
  const buf = Buffer.from(qr, 'base64');
  // الوسم 1، ثم الطول: «شركة» أربعة حروف وثمانية بايتات
  assert.equal(buf[0], 1);
  assert.equal(buf[1], 8);
});

test('TLV: الحقول الخمسة تُفكّ كما كُتبت، والمبالغ بخانتين عشريتين', () => {
  const t = decodeTlv(qrPayloadPhase1({
    sellerName: SELLER.name, vatNumber: SELLER.vatNumber,
    timestamp: '2026-08-27T10:30:00Z', total: 1148.85, vat: 149.85,
  }));
  assert.equal(t[1], SELLER.name);
  assert.equal(t[2], SELLER.vatNumber);
  assert.equal(t[3], '2026-08-27T10:30:00Z');
  assert.equal(t[4], '1148.85');
  assert.equal(t[5], '149.85');
});

test('TLV: المرحلة الثانية تضيف التجزئة والتوقيع والمفتاح وتوقيع الشهادة', () => {
  const qr = qrPayloadPhase2({
    sellerName: SELLER.name, vatNumber: SELLER.vatNumber,
    timestamp: '2026-08-27T10:30:00Z', total: 1148.85, vat: 149.85,
    invoiceHash: 'aGFzaA==', signature: 'c2ln',
    publicKeyDer: Buffer.from('pubkey'), certSignature: Buffer.from('certsig'),
  });
  const t = decodeTlv(qr);
  assert.equal(t[6], 'aGFzaA==');
  assert.equal(t[7], 'c2ln');
  assert.equal(t[8], 'pubkey');
  assert.equal(t[9], 'certsig');
});

test('TLV: الفاتورة المعيارية بلا الوسم 9 — توقيع الشهادة للمبسطة وحدها', () => {
  const t = decodeTlv(qrPayloadPhase2({
    sellerName: SELLER.name, vatNumber: SELLER.vatNumber,
    timestamp: '2026-08-27T10:30:00Z', total: 100, vat: 15,
    invoiceHash: 'aA==', signature: 'cw==',
    publicKeyDer: Buffer.from('k'), certSignature: null,
  }));
  assert.equal(t[8], 'k');
  assert.equal(t[9], undefined);
});

test('الرقم الضريبي: خمس عشرة خانة تبدأ وتنتهي بثلاثة', () => {
  assert.equal(vatNumberLooksValid('312079341500003'), true);
  assert.equal(vatNumberLooksValid('212079341500003'), false, 'لا يبدأ بثلاثة');
  assert.equal(vatNumberLooksValid('312079341500004'), false, 'لا ينتهي بثلاثة');
  assert.equal(vatNumberLooksValid('31207934150000'), false, 'أربع عشرة خانة');
  assert.equal(vatNumberLooksValid(null), false);
});

test('QR: المصفوفة تتسع لحمولتَي المرحلتين وتكبر بكبر الحمولة', () => {
  const p1 = qrMatrix('A'.repeat(120));
  const p2 = qrMatrix('A'.repeat(550));
  assert.ok(p1.matrix.length >= 21);
  assert.ok(p2.matrix.length > p1.matrix.length);
});

// -------------------------------------------------------------- حساب المبالغ

test('المبالغ: الضريبة سطر مستقل والإجمالي مجموعهما', () => {
  const t = computeXmlTotals([{ nameAr: 'خدمة', quantity: 1, unitPrice: 999, vatPercent: 15 }]);
  assert.equal(t.net, 999);
  assert.equal(t.vat, 149.85);
  assert.equal(t.total, 1148.85);
});

test('المبالغ: التقريب لخانتين لكل سطر ثم الجمع', () => {
  const t = computeXmlTotals([
    { nameAr: 'أ', quantity: 3, unitPrice: 33.33, vatPercent: 15 },
    { nameAr: 'ب', quantity: 1, unitPrice: 0.01, vatPercent: 15 },
  ]);
  assert.equal(t.net, 100);
  assert.equal(t.total, Math.round((t.net + t.vat) * 100) / 100);
});

test('المبالغ: العهدة بلا ضريبة', () => {
  const t = computeXmlTotals([{ nameAr: 'عهدة رسوم', quantity: 1, unitPrice: 5000, vatPercent: 0 }]);
  assert.equal(t.vat, 0);
  assert.equal(t.total, 5000);
});

// ---------------------------------------------------------------- بناء الـXML

test('XML: البناء حتمي — نفس المدخلات تعطي نفس النص ونفس التجزئة', () => {
  const a = buildUnsignedInvoiceXml(base());
  const b = buildUnsignedInvoiceXml(base());
  assert.equal(a, b);
  assert.equal(invoiceHashBase64(a), invoiceHashBase64(b));
});

test('XML: غير الموقَّع خالٍ من كتل التوقيع — التجزئة تُحسب عليه', () => {
  const xml = buildUnsignedInvoiceXml(base());
  assert.ok(!xml.includes('UBLExtensions'));
  assert.ok(!xml.includes('<cac:Signature>'));
  assert.ok(!xml.includes("<cbc:ID>QR</cbc:ID>"));
});

test('XML: نوع الفاتورة — 0200000 للمبسطة و0100000 للمعيارية', () => {
  assert.ok(buildUnsignedInvoiceXml(base()).includes('name="0200000">388<'));
  const std = buildUnsignedInvoiceXml(base({
    docType: 'STANDARD',
    buyer: { name: 'مؤسسة الأفق', vatNumber: '310445566700003', crNumber: '1010234567', city: 'الرياض', countryCode: 'SA' },
  }));
  assert.ok(std.includes('name="0100000">388<'));
  assert.ok(std.includes('310445566700003'), 'الرقم الضريبي للمشتري إلزامي في المعيارية');
});

test('XML: الإشعار الدائن يحمل 381 ومرجع الفاتورة الأصل', () => {
  const xml = buildUnsignedInvoiceXml(base({
    typeCode: '381', billingReference: 'BP-TI-2026-0001', instructionNote: 'إلغاء الخدمة',
  }));
  assert.ok(xml.includes('>381<'));
  assert.ok(xml.includes('<cac:BillingReference>'));
  assert.ok(xml.includes('BP-TI-2026-0001'));
});

test('XML: العهدة تحمل فئة O وسبب الاستثناء لا فئة S', () => {
  const xml = buildUnsignedInvoiceXml(base({
    lines: [{ nameAr: 'عهدة رسوم حكومية', quantity: 1, unitPrice: 5000, vatPercent: 0 }],
  }));
  assert.ok(xml.includes('VATEX-SA-OOS'));
  assert.ok(xml.includes('<cbc:ID>O</cbc:ID>'));
});

test('XML: ICV وPIH مدرجان — سلسلة الفواتير تقوم عليهما', () => {
  const xml = buildUnsignedInvoiceXml(base({ icv: 42 }));
  assert.ok(xml.includes('<cbc:ID>ICV</cbc:ID>'));
  assert.ok(xml.includes('<cbc:UUID>42</cbc:UUID>'));
  assert.ok(xml.includes('<cbc:ID>PIH</cbc:ID>'));
  assert.ok(xml.includes(genesisPih()));
});

test('XML: الحقن يضع كتلتي QR والتوقيع قبل بيانات البائع', () => {
  const unsigned = buildUnsignedInvoiceXml(base());
  const out = assembleSignedXml(unsigned, '', qrAndSignatureBlocks('QRPAYLOAD'));
  assert.ok(out.indexOf('<cbc:ID>QR</cbc:ID>') < out.indexOf('<cac:AccountingSupplierParty>'));
  assert.ok(out.includes('QRPAYLOAD'));
});

// ----------------------------------------------------------------- التوقيع

test('التجزئة: تُحسب على النص بلا سطر التصريح، وتتغير بتغير أي حقل', () => {
  const one = invoiceHashBase64(buildUnsignedInvoiceXml(base()));
  const two = invoiceHashBase64(buildUnsignedInvoiceXml(base({ icv: 2 })));
  assert.notEqual(one, two);
  assert.equal(Buffer.from(one, 'base64').length, 32, 'SHA-256 اثنان وثلاثون بايتاً');
});

test('التوقيع: جولة ECDSA على منحنى secp256k1 تُتحقّق بالمفتاح العام', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const hash = invoiceHashBase64(buildUnsignedInvoiceXml(base()));
  const sig = signInvoiceHash(hash, privateKey.export({ type: 'sec1', format: 'pem' }).toString());
  const v = createVerify('sha256');
  v.update(Buffer.from(hash, 'base64'));
  assert.equal(v.verify(publicKey, Buffer.from(sig, 'base64')), true);
});

test('الشهادة: قراءة المُصدر والرقم التسلسلي والمفتاح العام وقيمة التوقيع', (t) => {
  try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); }
  catch { return t.skip('openssl غير متاح'); }
  const dir = mkdtempSync(join(tmpdir(), 'zatca-test-'));
  const key = join(dir, 'k.pem');
  const crt = join(dir, 'c.pem');
  execFileSync('openssl', ['ecparam', '-name', 'secp256k1', '-genkey', '-noout', '-out', key]);
  execFileSync('openssl', ['req', '-new', '-x509', '-key', key, '-sha256', '-days', '1',
    '-subj', '/C=SA/O=BP/CN=selftest', '-out', crt]);
  const body = readFileSync(crt, 'utf8').replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
  const info = parseCertificate(body);
  assert.ok(info.issuerName.includes('CN=selftest'));
  assert.match(info.serialDecimal, /^\d+$/);
  assert.ok(info.publicKeyDer.length > 60);
  assert.ok(info.signature.length >= 64, 'قيمة توقيع ECDSA');
  assert.equal(Buffer.from(info.hashBase64, 'base64').length, 64, 'التجزئة hex في base64');
});

// ------------------------------------------------------------------ التوقيت

test('التوقيت: التاريخ والوقت بتوقيت الرياض بصيغة UBL', () => {
  const t = riyadhDateTime(new Date('2026-08-27T21:30:00Z'));
  assert.match(t.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(t.time, /^\d{2}:\d{2}:\d{2}$/);
  // الرياض +3 فالتاسعة والنصف مساءً عالمياً هي منتصف الليل والنصف بعدها بيوم
  assert.equal(t.date, '2026-08-28');
  assert.equal(t.time, '00:30:00');
});

test('السلسلة: تجزئة الفاتورة الأولى ثابت اللائحة', () => {
  assert.equal(
    genesisPih(),
    'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',
  );
});
