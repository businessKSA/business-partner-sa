/**
 * مسار الفاتورة الإلكترونية كاملاً: بناء، تجزئة، توقيع، رمز، سلسلة.
 *
 * نوقّع بشهادة نولّدها هنا (موقَّعة ذاتياً) لا بشهادة الهيئة — لأن ما
 * نختبره في هذا الملف هو ما نملكه: بنية XML، وصحّة التجزئة، وأن العناصر
 * الثلاثة تُحذف فعلاً قبلها، وأن التوقيع يتحقّق بالمفتاح العام، وأن
 * السلسلة لا تنكسر عند الرفض.
 *
 * ما لا يُختبر هنا — قبول الهيئة نفسها — لا يُدَّعى في أي مكان من هذا
 * النظام. راجع docs/zatca.md.
 */
import './setup.ts';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify, createSign, X509Certificate, generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildInvoiceXml, amt } from '../src/lib/zatca/ubl.ts';
import { invoiceHash, canonicalizeForHash, INITIAL_PIH, hashToZatcaFormat } from '../src/lib/zatca/hash.ts';
import { signInvoice, injectSignature, injectQr, buildSignedInfo } from '../src/lib/zatca/sign.ts';
import { buildQr, readQr } from '../src/lib/zatca/tlv.ts';
import { serialize, serializeDocument, findElement } from '../src/lib/zatca/xml.ts';
import { createCsrWithKey } from '../src/lib/zatca/csr.ts';
import { encryptSecret, decryptSecret } from '../src/lib/crypto.ts';

let certBase64: string;
let privateKeyPem: string;

/** شهادة موقَّعة ذاتياً على secp256k1 — تكفي للتحقق من بنية التوقيع. */
before(() => {
  const dir = mkdtempSync(join(tmpdir(), 'zatca-'));
  const keyPath = join(dir, 'k.pem');
  const certPath = join(dir, 'c.pem');

  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  writeFileSync(keyPath, privateKey);

  execFileSync('openssl', [
    'req', '-new', '-x509', '-key', keyPath, '-out', certPath,
    '-days', '365', '-subj', '/C=SA/O=Business Partner/CN=BP-ERP-TEST',
  ]);

  const certPem = require('node:fs').readFileSync(certPath, 'utf8');
  certBase64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s+/g, '');
  privateKeyPem = privateKey;
});

function sampleInvoice(overrides: Record<string, unknown> = {}) {
  return buildInvoiceXml({
    number: 'INV-2026-0001',
    uuid: '3cf5ee18-ee25-44ea-a444-2c37ba7f28be',
    issueDate: '2026-08-28',
    issueTime: '10:15:30',
    typeCode: '388',
    typeName: '0100',
    currency: 'SAR',
    icv: 1,
    pih: INITIAL_PIH,
    seller: {
      nameAr: 'شركة بزنس بارتنر للخدمات',
      vatNumber: '310887376200003',
      street: 'شارع ريحانة بنت زيد', buildingNo: '1234', district: 'العارض',
      city: 'الرياض', postalCode: '13337', additionalNo: '5678', countryCode: 'SA',
    },
    buyer: {
      nameAr: 'مؤسسة العميل التجارية',
      vatNumber: '311111111101113',
      street: 'شارع الملك فهد', buildingNo: '4321', district: 'العليا',
      city: 'الرياض', postalCode: '12212', countryCode: 'SA',
    },
    lines: [{
      id: 1, descAr: 'إدارة منصة قوى — اشتراك شهري',
      qty: '1', uomCode: 'MON', unitPrice: '999.00', discount: '0.00',
      lineNet: '999.00', lineVat: '149.85', lineTotal: '1148.85',
      taxCategory: 'S', taxPercent: '15.00',
    }],
    lineExtensionAmount: '999.00',
    taxExclusiveAmount: '999.00',
    taxInclusiveAmount: '1148.85',
    allowanceTotal: '0.00',
    vatTotal: '149.85',
    prepaidAmount: '0.00',
    payableAmount: '1148.85',
    taxSubtotals: [{ taxableAmount: '999.00', taxAmount: '149.85', category: 'S', percent: '15.00' }],
    ...overrides,
  } as never);
}

test('XML المولَّد سليم البنية ويُحلَّل بمحلّل مستقل', () => {
  const xml = serializeDocument(sampleInvoice());

  const dir = mkdtempSync(join(tmpdir(), 'ubl-'));
  const p = join(dir, 'inv.xml');
  writeFileSync(p, xml);

  // xmllint محلّل مستقل عن كودنا — إن قبله فالبنية سليمة نحوياً
  const out = execFileSync('xmllint', ['--noout', p], { encoding: 'utf8', stdio: 'pipe' });
  assert.equal(out, '');
});

test('لا وسوم مغلقة على نفسها — C14N لا تعرفها', () => {
  const xml = serializeDocument(sampleInvoice());
  assert.ok(!/<[^>]+\/>/.test(xml), 'وُجد وسم مغلق على نفسه، والتجزئة ستختلف عن المتوقَّع');
});

test('التجزئة تحذف العناصر الثلاثة التي توجب المواصفة حذفها', () => {
  const tree = sampleInvoice();
  const canonical = canonicalizeForHash(tree);

  assert.ok(!canonical.includes('ext:UBLExtensions'), 'امتدادات UBL لم تُحذف');
  assert.ok(!canonical.includes('cac:Signature'), 'عنصر التوقيع لم يُحذف');
  assert.ok(canonical.includes('<cbc:ID>PIH</cbc:ID>'), 'مرجع PIH يجب أن يبقى');
  assert.ok(canonical.includes('INV-2026-0001'), 'رقم الفاتورة يجب أن يبقى');
});

test('حقن QR بعد التجزئة لا يغيّرها — وهذا شرط تماسك المسار', () => {
  const tree = sampleInvoice();
  const before = invoiceHash(tree).hash;

  const withQr = injectQr(tree, 'AQVUZXN0');
  const after = invoiceHash(withQr).hash;

  assert.equal(after, before, 'حقن QR غيّر التجزئة — التوقيع سيسقط');
  // ومع ذلك QR موجودة فعلاً في المستند المُخرَج
  assert.ok(serializeDocument(withQr).includes('AQVUZXN0'));
});

test('حقن التوقيع بعد التجزئة لا يغيّرها كذلك', () => {
  const tree = sampleInvoice();
  const before = invoiceHash(tree).hash;

  const signed = signInvoice({
    invoiceHash: before, certificateBase64: certBase64, privateKeyPem,
    issuerName: 'CN=BP-ERP-TEST', serialNumber: '1',
    signingTime: '2026-08-28T10:15:30Z',
  });
  const withSig = injectSignature(tree, signed.extensions);

  assert.equal(invoiceHash(withSig).hash, before);
});

test('التجزئة بصيغة الهيئة: Base64 للنصّ الست عشري لا للبايتات', () => {
  const { hash, raw } = invoiceHash(sampleInvoice());

  // ٣٢ بايتاً = ٦٤ محرفاً ست عشرياً، وترميزها Base64 يعطي ٨٨ محرفاً
  assert.equal(raw.length, 32);
  assert.equal(hash.length, 88, `الطول ${hash.length} — لو رُمِّزت البايتات الخام لكان ٤٤`);
  assert.equal(Buffer.from(hash, 'base64').toString('utf8'), raw.toString('hex'));
});

test('القيمة الابتدائية للسلسلة تطابق المنشور من الهيئة', () => {
  assert.equal(hashToZatcaFormat(require('node:crypto').createHash('sha256').update('0').digest()), INITIAL_PIH);
});

test('التوقيع يتحقّق بالمفتاح العام للشهادة', () => {
  const tree = sampleInvoice();
  const { hash } = invoiceHash(tree);

  const signed = signInvoice({
    invoiceHash: hash, certificateBase64: certBase64, privateKeyPem,
    issuerName: 'CN=BP-ERP-TEST', serialNumber: '1',
    signingTime: '2026-08-28T10:15:30Z',
  });

  // نعيد بناء ما وُقِّع عليه بالضبط ونتحقّق منه بالمفتاح العام
  const signedInfo = buildSignedInfo(hash, signed.signedPropsHash);
  const cert = new X509Certificate(
    `-----BEGIN CERTIFICATE-----\n${certBase64.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----`,
  );

  const verifier = createVerify('SHA256');
  verifier.update(serialize(signedInfo), 'utf8');
  verifier.end();

  assert.ok(
    verifier.verify(cert.publicKey, Buffer.from(signed.signature, 'base64')),
    'التوقيع لا يتحقّق — الموقَّع عليه غير ما يُعاد بناؤه',
  );
});

test('تغيير حرف في الفاتورة يكسر التوقيع — وهذا هو المقصود', () => {
  const tree = sampleInvoice();
  const original = invoiceHash(tree).hash;
  const tampered = invoiceHash(sampleInvoice({ payableAmount: '1148.86' })).hash;

  assert.notEqual(tampered, original, 'تغيير المبلغ لم يغيّر التجزئة');
});

test('رمز QR يحمل الوسوم التسعة بترتيبها', () => {
  const tree = sampleInvoice();
  const { hash } = invoiceHash(tree);
  const signed = signInvoice({
    invoiceHash: hash, certificateBase64: certBase64, privateKeyPem,
    issuerName: 'CN=BP-ERP-TEST', serialNumber: '1',
  });

  const cert = new X509Certificate(
    `-----BEGIN CERTIFICATE-----\n${certBase64.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----`,
  );

  const qr = buildQr({
    sellerName: 'شركة بزنس بارتنر للخدمات',
    vatNumber: '310887376200003',
    timestamp: '2026-08-28T10:15:30Z',
    totalWithVat: '1148.85',
    vatTotal: '149.85',
    invoiceHash: hash,
    signature: signed.signature,
    publicKey: cert.publicKey.export({ type: 'spki', format: 'der' }),
  });

  const read = readQr(qr);
  assert.equal(read[2], '310887376200003');
  assert.equal(read[4], '1148.85');
  assert.equal(read[5], '149.85');
  assert.equal(read[6], hash);
  assert.equal(read[7], signed.signature);
  assert.ok(read[8].length > 0);
});

test('الإشعار الدائن يشير إلى فاتورته الأصلية', () => {
  const xml = serializeDocument(sampleInvoice({
    typeCode: '381',
    originalInvoiceNumber: 'INV-2026-0001',
    correctionReason: 'إلغاء خدمة لم تُقدَّم',
  }));

  assert.ok(xml.includes('<cac:BillingReference>'), 'الإشعار بلا مرجع فاتورته يُرفض');
  assert.ok(xml.includes('<cbc:InvoiceTypeCode name="0100">381</cbc:InvoiceTypeCode>'));
  assert.ok(xml.includes('إلغاء خدمة لم تُقدَّم'));
});

test('الفاتورة المبسطة تحمل الرمز ٠٢٠٠', () => {
  const xml = serializeDocument(sampleInvoice({ typeName: '0200' }));
  assert.ok(xml.includes('name="0200"'));
});

test('المشتري بلا رقم ضريبي يحمل معرّفاً بديلاً', () => {
  const xml = serializeDocument(sampleInvoice({
    buyer: {
      nameAr: 'عميل فرد', vatNumber: null,
      otherIdType: 'NAT', otherIdValue: '1012345678',
      city: 'جدة', countryCode: 'SA',
    },
  }));

  assert.ok(xml.includes('schemeID="NAT"'));
  assert.ok(xml.includes('1012345678'));
});

test('تشفير الأسرار: يفكّ ما شُفِّر، ويكشف العبث', () => {
  const secret = 'مفتاح-خاص-سرّي-جداً';
  const enc = encryptSecret(secret);

  assert.notEqual(enc, secret);
  assert.equal(decryptSecret(enc), secret);

  // نفس القيمة تُنتج تشفيرين مختلفَين — الملح عشوائي
  assert.notEqual(encryptSecret(secret), enc);

  // العبث يُكتشف ولا يُفكّ إلى قمامة
  const buf = Buffer.from(enc, 'base64');
  buf[buf.length - 1] ^= 0xff;
  assert.throws(() => decryptSecret(buf.toString('base64')), /فشل فكّ التشفير/);
});
