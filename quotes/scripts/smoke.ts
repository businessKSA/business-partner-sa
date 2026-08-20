/**
 * سيناريو القبول الكامل — يُشغَّل مقابل خادم يعمل على APP_URL.
 * عميل جديد ← مجلده ← عرض بخدمتين ← اعتماد ← إرسال ← قبول أونلاين ← عقد
 * ← توقيع DocuSign ← دفع الدفعة الأولى ← قيد التنفيذ ← طلب توريد كامل
 * ← الخط الزمني ← سلامة سجل التدقيق.
 */
import { PrismaClient } from '@prisma/client';
import { createClient } from '../src/lib/clients';
import { createQuote, generateContractFromQuote, approveDocument, acceptDocument } from '../src/lib/documents';
import { sendDocumentEmail, prepareWhatsApp, buildAndArchivePdf } from '../src/lib/send';
import { sendForSignature } from '../src/lib/docusign/service';
import { applyEnvelopeStatus } from '../src/lib/docusign/webhook';
import { createInvoicesForContract, markInvoicePaid, walletSummary } from '../src/lib/billing';
import {
  createSupplier, createSupplyRequest, addSupplierBid, selectBid,
  createSupplyAgreement, createFundingInvoice, addMilestones, approveMilestone, payMilestone,
} from '../src/lib/suppliers';
import { clientJourney, journeyStatus, verifyAuditChain } from '../src/lib/timeline';
import { storage } from '../src/lib/storage';
import { hasEmoji } from '../src/lib/content-guard';
import { fmtMoney } from '../src/lib/money';
import { closeBrowser } from '../src/lib/pdf';

const prisma = new PrismaClient();
const ADMIN = 'Business@businesspartnerksa.com';

let passed = 0;
let failed = 0;
const fails: string[] = [];

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    fails.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
const step = (n: string) => console.log(`\n=== ${n} ===`);

async function main() {
  // تنظيف تشغيل سابق
  const old = await prisma.client.findFirst({ where: { email: 'smoke@example.com' } });
  if (old) await prisma.client.delete({ where: { id: old.id } });
  await prisma.supplier.deleteMany({ where: { crNumber: 'SUP-SMOKE-1' } });
  await prisma.supplier.deleteMany({ where: { crNumber: 'SUP-SMOKE-2' } });

  // ---------------------------------------------------- 1) عميل جديد ومجلده
  step('1) عميل جديد ← مجلده أُنشئ تلقائياً');
  const client = await createClient({
    nameAr: 'خالد بن سعد العتيبي',
    nameEn: 'Khalid bin Saad Al Otaibi',
    companyAr: 'شركة نماء الشرق القابضة',
    companyEn: 'Namaa Al Sharq Holding Company',
    crNumber: '1010777666',
    email: 'smoke@example.com',
    phone: '0501234567',
    country: 'SA',
    city: 'الرياض',
    addressAr: 'حي الملقا، الرياض',
    addressEn: 'Al Malqa District, Riyadh',
    repName: 'خالد العتيبي',
    repTitle: 'الرئيس التنفيذي',
  });
  const s = storage();
  const folders = await Promise.all(
    ['quotes', 'contracts', 'attachments'].map((f) => s.exists(`${client.folderPath}/${f}`)),
  );
  check('مجلد العميل يحتوي المجلدات الفرعية الثلاثة', folders.every(Boolean), client.folderPath ?? '');
  check('رقم الواتساب طُبِّع لصيغة دولية', client.phone === '966501234567', client.phone);

  // ------------------------------------------- 2) عرض بخدمتين والحسابات
  step('2) عرض سعر بخدمتين — استثمار أجنبي 30,000 + سير ذاتية 10×100');
  const fi = await prisma.service.findUniqueOrThrow({ where: { code: 'FI-100' } });
  const cv = await prisma.service.findUniqueOrThrow({ where: { code: 'CV-10' } });
  const quote = await createQuote({
    clientId: client.id,
    titleAr: 'عرض سعر — تأسيس كيان استثمار أجنبي وتوفير سير ذاتية',
    titleEn: 'Quotation — Foreign Investment Setup and Candidate CV Sourcing',
    items: [
      { serviceId: fi.id, nameAr: fi.nameAr, nameEn: fi.nameEn, qty: 1, unitPrice: fi.unitPrice },
      { serviceId: cv.id, nameAr: cv.nameAr, nameEn: cv.nameEn, qty: 10, unitPrice: cv.unitPrice },
    ],
  });
  check('المجموع 31,000', quote.subtotal === 31000, fmtMoney(quote.subtotal));
  check('ضريبة القيمة المضافة 4,650', quote.vatAmount === 4650, fmtMoney(quote.vatAmount));
  check('الإجمالي شامل الضريبة 35,650', quote.total === 35650, fmtMoney(quote.total));
  check('الترقيم بصيغة BP-FI-YYYY-NNN', /^BP-FI-\d{4}-\d{3}$/.test(quote.number), quote.number);
  check('ملحق الرسوم الحكومية مُدرَج تلقائياً', quote.includeGovFees === true);
  check('الحالة مسودة عند الإنشاء', quote.status === 'DRAFT');

  // ------------------------------------------ 3) لا إرسال قبل الاعتماد
  step('3) حارس الاعتماد — لا يُرسَل شيء قبل الضغط على اعتماد');
  let blocked = false;
  try {
    await sendDocumentEmail({ documentId: quote.id, actor: ADMIN, attachPdf: false });
  } catch (e) {
    blocked = String(e).includes('غير معتمد');
  }
  check('البريد مرفوض على المسودة', blocked);

  let waBlocked = false;
  try {
    await prepareWhatsApp(quote.id, 'ar', ADMIN);
  } catch (e) {
    waBlocked = String(e).includes('غير معتمد');
  }
  check('واتساب مرفوض على المسودة', waBlocked);

  const publicDraft = await fetch(`${process.env.APP_URL}/d/${quote.publicToken}`);
  check('الصفحة العامة لا تعرض المسودة', publicDraft.status === 404, `HTTP ${publicDraft.status}`);

  // ------------------------------------------------ 4) الاعتماد والإرسال
  step('4) اعتماد ← توليد PDF ← إرسال بالبريد ← رابط واتساب');
  await approveDocument(quote.id, ADMIN);
  const { buffer, key } = await buildAndArchivePdf(quote.id);
  check('الـPDF مولَّد', buffer.subarray(0, 4).toString() === '%PDF', `${buffer.length} بايت`);
  check('الـPDF مؤرشف في مجلد عروض الأسعار', key.includes('/quotes/'), key);

  const mail = await sendDocumentEmail({ documentId: quote.id, includeArabic: true, attachPdf: true, actor: ADMIN });
  check('أُرسل البريد', mail.ok === true, mail.provider);
  const delivery = await prisma.delivery.findFirst({ where: { documentId: quote.id, channel: 'EMAIL' } });
  check('نص البريد بلا إيموجي', !hasEmoji(delivery?.body ?? ''));
  check('نص البريد يحتوي الرابط العام', (delivery?.body ?? '').includes(quote.publicToken));

  const wa = await prepareWhatsApp(quote.id, 'ar', ADMIN);
  check('رابط واتساب مبني بصيغة wa.me', wa.href.startsWith(`https://wa.me/${client.phone}`));
  check('نص واتساب بلا إيموجي', !hasEmoji(wa.text));

  const afterSend = await prisma.document.findUniqueOrThrow({ where: { id: quote.id } });
  check('الحالة أصبحت مُرسَل', afterSend.status === 'SENT');

  // ------------------------------------------------- 5) القبول الأونلاين
  step('5) الصفحة العامة والقبول الأونلاين');
  const pub = await fetch(`${process.env.APP_URL}/d/${quote.publicToken}`);
  const pubHtml = await pub.text();
  check('الصفحة العامة تفتح بلا تسجيل دخول', pub.status === 200);
  check('الصفحة تعرض العربية والإنجليزية', pubHtml.includes('عرض سعر') && pubHtml.includes('Quotation'));
  check('زر القبول ظاهر', pubHtml.includes('قبول العرض'));

  const pdfRes = await fetch(`${process.env.APP_URL}/d/${quote.publicToken}/pdf`);
  check('تنزيل PDF من الصفحة العامة يعمل', pdfRes.status === 200 && pdfRes.headers.get('content-type') === 'application/pdf');

  const accepted = await acceptDocument(quote.publicToken, 'خالد بن سعد العتيبي', '127.0.0.1');
  check('حالة العرض أصبحت مقبول', accepted.status === 'ACCEPTED');
  check('سُجّل اسم القابل ووقت القبول', Boolean(accepted.acceptedByName && accepted.acceptedAt));

  // ------------------------------------------ 6) توليد العقد من العرض
  step('6) توليد العقد من العرض بنفس البنود والأسعار');
  const contract = await generateContractFromQuote(quote.id, ADMIN);
  const [qItems, cItems] = await Promise.all([
    prisma.documentItem.findMany({ where: { documentId: quote.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.documentItem.findMany({ where: { documentId: contract.id }, orderBy: { sortOrder: 'asc' } }),
  ]);
  check('عدد البنود متطابق', qItems.length === cItems.length, `${cItems.length} بند`);
  check(
    'كل بند متطابق في الاسم والكمية والسعر',
    qItems.every((q, i) => q.nameAr === cItems[i].nameAr && q.qty === cItems[i].qty && q.unitPrice === cItems[i].unitPrice),
  );
  check('الإجماليات متطابقة', contract.subtotal === quote.subtotal && contract.total === quote.total);
  check('العقد مرتبط بالعرض', contract.sourceQuoteId === quote.id);
  check('العقد مسودة عند التوليد', contract.status === 'DRAFT');

  // ------------------------------------------------- 7) دورة DocuSign
  step('7) دورة توقيع DocuSign كاملة');
  await approveDocument(contract.id, ADMIN);
  const cPdf = await buildAndArchivePdf(contract.id);
  check('PDF العقد مؤرشف في مجلد العقود', cPdf.key.includes('/contracts/'), cPdf.key);

  const printHtml = await (await fetch(`${process.env.APP_URL}/d/${contract.publicToken}/print`)).text();
  check('علامات الربط موجودة في العقد', ['/sig_client/', '/date_client/', '/sig_bp/', '/date_bp/'].every((a) => printHtml.includes(a)));

  const envelope = await sendForSignature(contract.id, ADMIN, true);
  check('أُنشئ الظرف وحالة العقد قيد التوقيع', envelope.status === 'sent');
  check('ترتيب التوقيع: العميل أولاً ثم بزنس بارتنر', envelope.clientEmail === client.email && envelope.bpEmail === ADMIN);
  const signing = await prisma.document.findUniqueOrThrow({ where: { id: contract.id } });
  check('حالة العقد أصبحت قيد التوقيع', signing.status === 'SIGNING');

  // العميل يوقّع، ثم أنا — عبر نفس معالج الـwebhook
  await applyEnvelopeStatus(envelope.envelopeId, 'delivered', { signed: ['client'] });
  await applyEnvelopeStatus(envelope.envelopeId, 'completed', { signed: ['client', 'bp'] });

  const signed = await prisma.document.findUniqueOrThrow({ where: { id: contract.id } });
  check('الحالة تحدّثت تلقائياً إلى موقّع', signed.status === 'SIGNED');
  check('النسخة الموقّعة محفوظة', Boolean(signed.signedPdfPath) && signed.signedPdfPath!.includes('/contracts/'));
  check('شهادة الإتمام محفوظة', Boolean(signed.certPath) && signed.certPath!.includes('/contracts/'));
  check('النسخة الموقّعة موجودة فعلياً في التخزين', await s.exists(signed.signedPdfPath!));
  check('شهادة الإتمام موجودة فعلياً في التخزين', await s.exists(signed.certPath!));

  const signedMails = await prisma.delivery.findMany({
    where: { documentId: contract.id, channel: 'EMAIL', meta: { contains: 'signed-copy' } },
  });
  const recipients = new Set(signedMails.map((m) => m.toAddress));
  check('النسخة الموقّعة أُرسلت للطرفين', recipients.has(client.email) && recipients.has(ADMIN), [...recipients].join(', '));

  // ------------------------------------------ 8) الدفع من بوابة العميل
  step('8) جدول الدفعات ← دفع الدفعة الأولى ← قيد التنفيذ');
  const invoices = await createInvoicesForContract(contract.id, ADMIN);
  check('جدول الدفعات مستخرَج من شروط الدفع', invoices.length === 3, `${invoices.length} فواتير`);
  const first = invoices[0];
  check('الدفعة الأولى 15,000 + ضريبة', first.amountExclVat === 15000 && first.total === 17250, fmtMoney(first.total));

  await markInvoicePaid(first.id, { provider: 'mock', ref: 'mock_smoke_1', method: 'mada' });
  const afterPay = await prisma.document.findUniqueOrThrow({ where: { id: contract.id } });
  check('العقد الموقّع + الدفعة الأولى = قيد التنفيذ', afterPay.status === 'IN_PROGRESS');

  const w1 = await walletSummary(client.id);
  check('المحفظة سجّلت الدفعة كأتعاب مدفوعة', w1.paid === first.total, fmtMoney(w1.paid));
  check('الأتعاب المحصّلة لا تدخل العهدة القابلة للصرف', w1.custodyBalance === 0, fmtMoney(w1.custodyBalance));

  // ----------------------------------------------------- 9) فلو الموردين
  step('9) فلو الموردين — عروض ← اختيار ← اتفاقية ثلاثية ← صرف مرحلي');
  const supA = await createSupplier({ nameAr: 'مؤسسة الديار للتجهيزات', nameEn: 'Al Diyar Fit-out Establishment', crNumber: 'SUP-SMOKE-1', activityAr: 'تجهيزات وديكور', iban: 'SA0000000000000000000001' });
  const supB = await createSupplier({ nameAr: 'شركة البناء الحديث للمقاولات', nameEn: 'Modern Build Contracting Company', crNumber: 'SUP-SMOKE-2', activityAr: 'مقاولات', iban: 'SA0000000000000000000002' });

  const req = await createSupplyRequest({
    clientId: client.id,
    titleAr: 'تجهيز وتأثيث المقر الرئيسي',
    titleEn: 'Head office fit-out and furnishing',
    scopeAr: 'تجهيز مساحة 400 متر مربع تشمل الديكور والأثاث والتمديدات.',
    scopeEn: 'Fit-out of 400 square metres including decor, furniture and installations.',
    coordinationFee: 5000,
  });
  const bidA = await addSupplierBid({ supplyRequestId: req.id, supplierId: supA.id, amount: 180000, deliveryAr: '45 يوم عمل' });
  await addSupplierBid({ supplyRequestId: req.id, supplierId: supB.id, amount: 215000, deliveryAr: '30 يوم عمل' });
  const bids = await prisma.supplierBid.findMany({ where: { supplyRequestId: req.id } });
  check('استُقبلت عروض الموردين للمقارنة', bids.length === 2);

  await selectBid(req.id, bidA.id, ADMIN);
  const afterSelect = await prisma.supplyRequest.findUniqueOrThrow({ where: { id: req.id } });
  check('اختير المورد الأوفر', afterSelect.selectedBidId === bidA.id);

  const agreement = await createSupplyAgreement(req.id, ADMIN);
  check('أُنشئت الاتفاقية الثلاثية كمسودة', agreement.type === 'SUPPLY_AGREEMENT' && agreement.status === 'DRAFT', agreement.number);
  check('الاتفاقية تشمل التوريد وأتعاب التنسيق', agreement.subtotal === 185000, fmtMoney(agreement.subtotal));

  await approveDocument(agreement.id, ADMIN);
  await buildAndArchivePdf(agreement.id);
  const supEnv = await sendForSignature(agreement.id, ADMIN, true);
  await applyEnvelopeStatus(supEnv.envelopeId, 'completed', { signed: ['client', 'bp'] });
  const signedAgreement = await prisma.document.findUniqueOrThrow({ where: { id: agreement.id } });
  check('الاتفاقية الثلاثية موقّعة عبر DocuSign', signedAgreement.status === 'SIGNED');

  const funding = await createFundingInvoice(req.id, ADMIN);
  check('فاتورة إيداع التوريد بلا ضريبة (عهدة)', funding.vatAmount === 0 && funding.total === 180000, fmtMoney(funding.total));
  await markInvoicePaid(funding.id, { provider: 'mock', ref: 'mock_smoke_fund', method: 'mada' });
  const wFund = await walletSummary(client.id);
  check('الإيداع صُنّف كإيداع توريد لا كعهدة رسوم حكومية', wFund.supplyDeposited === 180000 && wFund.govFeeDeposited === 0);
  check('العهدة المتاحة للصرف = قيمة التوريد', wFund.custodyBalance === 180000, fmtMoney(wFund.custodyBalance));

  await addMilestones(req.id, [
    { titleAr: 'الدفعة المقدمة عند التوقيع', titleEn: 'Advance payment on signature', amount: 60000 },
    { titleAr: 'إنجاز الديكور والتمديدات', titleEn: 'Completion of decor and installations', amount: 70000 },
    { titleAr: 'التسليم النهائي والتأثيث', titleEn: 'Final handover and furnishing', amount: 50000 },
  ]);
  const milestones = await prisma.milestone.findMany({ where: { supplyRequestId: req.id }, orderBy: { sortOrder: 'asc' } });
  check('حُدّدت ثلاث مراحل إنجاز', milestones.length === 3);

  // لا صرف قبل الاعتماد
  let payBlocked = false;
  try {
    await payMilestone(milestones[0].id, ADMIN);
  } catch (e) {
    payBlocked = String(e).includes('اعتماد');
  }
  check('الصرف مرفوض قبل اعتماد المرحلة', payBlocked);

  await approveMilestone(milestones[0].id, ADMIN);
  await payMilestone(milestones[0].id, ADMIN);
  const w2 = await walletSummary(client.id);
  check('صُرفت المرحلة الأولى من المحفظة', w2.supplierPaid === 60000, fmtMoney(w2.supplierPaid));

  // الصرف يتوقف عند نفاد الرصيد
  await approveMilestone(milestones[1].id, ADMIN);
  await payMilestone(milestones[1].id, ADMIN);
  await approveMilestone(milestones[2].id, ADMIN);
  let overdraft = false;
  const before = await walletSummary(client.id);
  if (before.custodyBalance < milestones[2].amount) {
    try {
      await payMilestone(milestones[2].id, ADMIN);
    } catch (e) {
      overdraft = String(e).includes('غير كافٍ');
    }
    check('العهدة تمنع الصرف بما يتجاوز الرصيد', overdraft, `الرصيد ${fmtMoney(before.custodyBalance)}`);
  } else {
    await payMilestone(milestones[2].id, ADMIN);
    const done = await prisma.supplyRequest.findUniqueOrThrow({ where: { id: req.id } });
    check('اكتمل طلب التوريد بعد صرف كل المراحل', done.status === 'COMPLETED');
  }

  // -------------------------------------- 10) الخط الزمني وسجل التدقيق
  step('10) الخط الزمني وسجل التدقيق');
  const journey = await clientJourney(client.id);
  const codes = new Set(journey.map((e) => e.code));
  for (const c of ['CLIENT_CREATED', 'QUOTE_CREATED', 'APPROVED', 'SENT_EMAIL', 'ACCEPTED', 'CONTRACT_GENERATED', 'DOCUSIGN_SENT', 'DOCUSIGN_COMPLETED', 'PAID', 'IN_PROGRESS', 'BID_SELECTED', 'MILESTONE_APPROVED']) {
    check(`الخط الزمني يسجّل ${c}`, codes.has(c));
  }
  const status = await journeyStatus(client.id);
  check('حالة الرحلة تصف الموقف بدقة', status.ar.includes('موقّع العقد') && status.ar.includes('مدفوعة'), status.ar);

  const chain = await verifyAuditChain();
  check('سلسلة سجل التدقيق سليمة', chain.ok, `${chain.count} قيد`);

  const clientVisible = journey.filter((e) => e.clientVisible);
  check('الخط الزمني للعميل نسخة مبسطة أقصر', clientVisible.length < journey.length, `${clientVisible.length} من ${journey.length}`);

  // النسخة العامة للعقد الموقّع
  const cPub = await fetch(`${process.env.APP_URL}/d/${contract.publicToken}`);
  check('صفحة العقد العامة تعمل', cPub.status === 200);

  console.log(`\n${'='.repeat(60)}\nنجح: ${passed}   فشل: ${failed}`);
  if (fails.length) console.log(`الفاشل:\n - ${fails.join('\n - ')}`);
  console.log('='.repeat(60));
  return failed;
}

main()
  .then(async (f) => {
    await closeBrowser();
    await prisma.$disconnect();
    process.exit(f ? 1 : 0);
  })
  .catch(async (e) => {
    console.error('\nخطأ غير متوقع:', e);
    await closeBrowser();
    await prisma.$disconnect();
    process.exit(1);
  });
