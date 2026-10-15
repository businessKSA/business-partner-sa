/** فحص حمولة QR لفاتورة صادرة — يفكّها ويقارنها بالسجل. */
import { prisma } from '../src/lib/db';
import { decodeTlv } from '../src/lib/zatca/qr';

async function main() {
  const r = await prisma.zatcaRecord.findFirst({ where: { icv: 1 } });
  if (!r) { console.log('لا سجلات'); return; }
  const t = decodeTlv(r.qr);
  console.log('الفاتورة:', r.number);
  console.log(' [1] اسم البائع     :', t[1]);
  console.log(' [2] الرقم الضريبي  :', t[2]);
  console.log(' [3] وقت الإصدار    :', t[3]);
  console.log(' [4] الإجمالي شاملاً :', t[4]);
  console.log(' [5] مبلغ الضريبة   :', t[5]);
  const ok = Number(t[4]) === r.total && Number(t[5]) === r.vatAmount;
  console.log('تطابق الحمولة مع السجل:', ok ? 'نعم ✓' : 'لا ✗');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
