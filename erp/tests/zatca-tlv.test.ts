/**
 * ترميز TLV: اختبارات على قيم معلومة الناتج سلفاً.
 *
 * هذا الجزء من زاتكا يمكن التحقق منه تحققاً تاماً بلا اتصال بأي خادم،
 * لأن ناتجه محدَّد بالكامل بالمواصفة. وقد اخترنا حالة الاختبار الرسمية
 * المنشورة في وثيقة الهيئة ليكون القياس على مرجعٍ لا على اجتهادنا.
 */
import './setup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTlv, decodeTlv, buildQr, readQr } from '../src/lib/zatca/tlv.ts';

test('الترميز يضع الوسم ثم الطول ثم القيمة', () => {
  const buf = encodeTlv([{ tag: 1, value: 'AB' }]);
  assert.deepEqual([...buf], [0x01, 0x02, 0x41, 0x42]);
});

test('الطول يُحسب بالبايتات لا بالمحارف — والعربية بايتان للحرف', () => {
  const buf = encodeTlv([{ tag: 1, value: 'الرياض' }]);
  assert.equal(buf[0], 1);
  assert.equal(buf[1], 12, 'ستة محارف عربية = اثنا عشر بايتاً');
  assert.equal(buf.length, 14);
});

test('قيمة تتجاوز ٢٥٥ بايتاً تُرفض ولا تُقتطع', () => {
  assert.throws(
    () => encodeTlv([{ tag: 1, value: 'x'.repeat(256) }]),
    /لا يسع أكثر من/,
  );
});

test('حالة الاختبار الرسمية لهيئة الزكاة والضريبة تُنتج الرمز المنشور', () => {
  // المثال المرجعي في وثيقة مواصفات الفاتورة الإلكترونية (المرحلة الأولى)
  const qr = buildQr({
    sellerName: 'Salla',
    vatNumber: '311111111101113',
    timestamp: '2022-04-25T15:30:00Z',
    totalWithVat: '1000.00',
    vatTotal: '150.00',
  });

  assert.equal(
    qr,
    'AQVTYWxsYQIPMzExMTExMTExMTAxMTEzAxQyMDIyLTA0LTI1VDE1OjMwOjAwWgQHMTAwMC4wMAUGMTUwLjAw',
  );
});

test('الفكّ يعيد ما رُمِّز — ذهاباً وإياباً', () => {
  const original = {
    sellerName: 'شركة بزنس بارتنر',
    vatNumber: '310887376200003',
    timestamp: '2026-08-27T10:15:30Z',
    totalWithVat: '1150.00',
    vatTotal: '150.00',
  };
  const read = readQr(buildQr(original));

  assert.equal(read[1], original.sellerName);
  assert.equal(read[2], original.vatNumber);
  assert.equal(read[3], original.timestamp);
  assert.equal(read[4], original.totalWithVat);
  assert.equal(read[5], original.vatTotal);
});

test('المرحلة الثانية تضيف الوسوم ٦ و٧ و٨', () => {
  const qr = buildQr({
    sellerName: 'BP',
    vatNumber: '310887376200003',
    timestamp: '2026-08-27T10:15:30Z',
    totalWithVat: '1150.00',
    vatTotal: '150.00',
    invoiceHash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzk=',
    signature: 'MEUCIQDaBcD',
    publicKey: Buffer.from([0x30, 0x59, 0x30, 0x13]),
  });

  const read = readQr(qr);
  assert.equal(read[6], 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzk=');
  assert.equal(read[7], 'MEUCIQDaBcD');
  assert.equal(read[8], Buffer.from([0x30, 0x59, 0x30, 0x13]).toString('base64'));
  assert.equal(read[9], undefined, 'الوسم ٩ لا يظهر إلا للفواتير المبسطة');
});

test('سلسلة مبتورة تُرفض بدل أن تُقرأ خطأً', () => {
  assert.throws(() => decodeTlv(Buffer.from([0x01, 0x05, 0x41])), /مبتورة/);
});
