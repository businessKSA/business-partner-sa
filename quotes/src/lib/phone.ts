/**
 * تطبيع أرقام الهواتف إلى الصيغة الدولية بأرقام فقط: بلا علامة زائد وبلا صفر
 * محلي. واتساب لا يقبل غيرها — الرقم السعودي المكتوب 05xxxxxxxx يفتح رسالة
 * «This link couldn't be opened» بدل المحادثة، وهو ما يبدو للمستخدم كأن
 * الإرسال معطّل.
 *
 *   0566552055        -> 966566552055
 *   566552055         -> 966566552055
 *   +966 56 655 2055  -> 966566552055
 *   00966566552055    -> 966566552055
 *
 * وحدة مستقلة عن طبقة قاعدة البيانات عمداً، حتى تستعملها بناة الروابط دون
 * أن تجرّ معها Prisma والتخزين.
 */
export function normalizePhone(raw: string, country = 'SA'): string {
  let p = (raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (country === 'SA') {
    if (p.startsWith('0')) p = `966${p.slice(1)}`;
    else if (p.length === 9 && p.startsWith('5')) p = `966${p}`;
  }
  return p;
}
