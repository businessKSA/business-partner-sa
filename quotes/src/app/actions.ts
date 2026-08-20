'use server';

/** كل عمليات التعديل تمر من هنا. الاعتماد شرط لكل إرسال. */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin, createMagicLink, consumeMagicLink, startAdminSession, startClientSession, endSessions, adminEmail, MAGIC_LINK_TTL_MIN } from '@/lib/auth';
import { createClient, normalizePhone } from '@/lib/clients';
import { createQuote, generateContractFromQuote, approveDocument, acceptDocument, type ItemInput } from '@/lib/documents';
import { sendDocumentEmail, prepareWhatsApp, buildAndArchivePdf, notifyEvent, publicUrl } from '@/lib/send';
import { sendForSignature } from '@/lib/docusign/service';
import { createInvoicesForContract, createInvoice, markInvoicePaid, walletSpend } from '@/lib/billing';
import { generateQuoteAndContract, promoteAgentServiceToCatalog } from '@/lib/agent';
import { createSupplier, createSupplyRequest, addSupplierBid, selectBid, createSupplyAgreement, createFundingInvoice, addMilestones, approveMilestone, payMilestone } from '@/lib/suppliers';
import { sendMail } from '@/lib/mailer';
import { loadTemplate, render } from '@/lib/templates';
import { storage, fileKey, clientFolderPath, type ClientFolder } from '@/lib/storage';
import { logEvent } from '@/lib/timeline';
import { round2 } from '@/lib/money';

type State = { error?: string; ok?: string; link?: string };

const s = (fd: FormData, k: string) => (fd.get(k) as string | null)?.trim() || '';
const n = (fd: FormData, k: string) => Number(fd.get(k) || 0);

// ------------------------------------------------------------------- الدخول
export async function requestAdminLink(_prev: State, fd: FormData): Promise<State> {
  const email = s(fd, 'email').toLowerCase();
  if (!email) return { error: 'أدخل البريد الإلكتروني' };
  if (email !== adminEmail()) {
    // رد موحّد حتى لا يكشف أي بريد مقبول
    return { ok: 'إن كان هذا البريد مصرّحاً له فسيصلك رابط الدخول خلال دقائق.' };
  }
  const link = await createMagicLink(email, 'ADMIN');
  const showInline = process.env.DEV_SHOW_MAGIC_LINK === '1';
  await sendMail({
    to: email,
    subject: 'رابط الدخول إلى لوحة التحكم — Business Partner',
    text: `رابط الدخول صالح لمدة ${MAGIC_LINK_TTL_MIN} دقيقة:\n${link}`,
  });
  return {
    ok: 'إن كان هذا البريد مصرّحاً له فسيصلك رابط الدخول خلال دقائق.',
    link: showInline ? link : undefined,
  };
}

export async function consumeAdminLink(token: string): Promise<boolean> {
  const link = await consumeMagicLink(token);
  if (!link || link.purpose !== 'ADMIN' || link.email !== adminEmail()) return false;
  await startAdminSession(link.email);
  return true;
}

export async function requestClientLink(_prev: State, fd: FormData): Promise<State> {
  const email = s(fd, 'email').toLowerCase();
  if (!email) return { error: 'أدخل البريد الإلكتروني' };
  const client = await prisma.client.findFirst({ where: { email: { equals: email } } });
  const generic = { ok: 'إن كان هذا البريد مسجلاً لدينا فسيصلك رابط الدخول خلال دقائق.' };
  if (!client) return generic;

  const link = await createMagicLink(email, 'CLIENT', client.id);
  const tpl = loadTemplate<{ email: Record<string, { subject: { ar: string; en: string }; bodyEn?: string; bodyAr?: string }> }>('messages.json');
  const b = tpl.email.portalInvite;
  const vars = { clientName: client.companyAr || client.nameAr, link, validMinutes: MAGIC_LINK_TTL_MIN };
  await sendMail({
    to: email,
    subject: render(b.subject.en, vars),
    text: `${render(b.bodyEn || '', vars)}\n\n${'-'.repeat(56)}\n\n${render(b.bodyAr || '', vars)}`,
  });
  return { ...generic, link: process.env.DEV_SHOW_MAGIC_LINK === '1' ? link : undefined };
}

export async function consumeClientLink(token: string): Promise<boolean> {
  const link = await consumeMagicLink(token);
  if (!link || link.purpose !== 'CLIENT' || !link.clientId) return false;
  await startClientSession(link.clientId);
  return true;
}

export async function logout() {
  await endSessions();
  redirect('/admin/login');
}

// ------------------------------------------------------------------ العملاء
export async function actionCreateClient(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  try {
    const client = await createClient({
      nameAr: s(fd, 'nameAr'),
      nameEn: s(fd, 'nameEn'),
      companyAr: s(fd, 'companyAr'),
      companyEn: s(fd, 'companyEn'),
      crNumber: s(fd, 'crNumber'),
      vatNumber: s(fd, 'vatNumber'),
      email: s(fd, 'email'),
      phone: s(fd, 'phone'),
      country: s(fd, 'country') || 'SA',
      city: s(fd, 'city'),
      addressAr: s(fd, 'addressAr'),
      addressEn: s(fd, 'addressEn'),
      repName: s(fd, 'repName'),
      repTitle: s(fd, 'repTitle'),
    });
    revalidatePath('/admin/clients');
    redirect(`/admin/clients/${client.id}`);
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e;
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ------------------------------------------------------------------ الكتالوج
export async function actionSaveService(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const id = s(fd, 'id');
  const data = {
    code: s(fd, 'code').toUpperCase(),
    category: s(fd, 'category') || 'general',
    nameAr: s(fd, 'nameAr'),
    nameEn: s(fd, 'nameEn'),
    descAr: s(fd, 'descAr') || null,
    descEn: s(fd, 'descEn') || null,
    unitPrice: round2(n(fd, 'unitPrice')),
    unitAr: s(fd, 'unitAr') || 'خدمة',
    unitEn: s(fd, 'unitEn') || 'service',
    minQty: Math.max(1, n(fd, 'minQty') || 1),
    openPrice: fd.get('openPrice') === 'on',
    paymentTermsAr: s(fd, 'paymentTermsAr'),
    paymentTermsEn: s(fd, 'paymentTermsEn'),
    deliveryAr: s(fd, 'deliveryAr'),
    deliveryEn: s(fd, 'deliveryEn'),
    attachGovFees: fd.get('attachGovFees') === 'on',
    govFeeGroup: fd.get('attachGovFees') === 'on' ? 'foreign-investment' : null,
    validityDays: n(fd, 'validityDays') || null,
    active: fd.get('active') === 'on',
  };
  if (!data.code || !data.nameAr || !data.nameEn) return { error: 'الكود والاسم بالعربي والإنجليزي حقول مطلوبة' };
  try {
    if (id) await prisma.service.update({ where: { id }, data });
    else await prisma.service.create({ data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath('/admin/catalog');
  return { ok: 'حُفظت الخدمة' };
}

export async function actionToggleService(id: string, active: boolean) {
  await requireAdmin();
  await prisma.service.update({ where: { id }, data: { active } });
  revalidatePath('/admin/catalog');
}

// ------------------------------------------------------- العروض والعقود
export async function actionCreateQuote(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const clientId = s(fd, 'clientId');
  if (!clientId) return { error: 'اختر عميلاً' };

  const rows = Number(fd.get('rowCount') || 0);
  const items: ItemInput[] = [];
  for (let i = 0; i < rows; i++) {
    const nameAr = s(fd, `item_${i}_nameAr`);
    const nameEn = s(fd, `item_${i}_nameEn`);
    const qty = Number(fd.get(`item_${i}_qty`) || 0);
    if (!nameAr || qty <= 0) continue;
    items.push({
      serviceId: s(fd, `item_${i}_serviceId`) || null,
      code: s(fd, `item_${i}_code`) || 'CUSTOM',
      nameAr,
      nameEn: nameEn || nameAr,
      descAr: s(fd, `item_${i}_descAr`) || null,
      descEn: s(fd, `item_${i}_descEn`) || null,
      qty,
      unitPrice: Number(fd.get(`item_${i}_unitPrice`) || 0),
      unitAr: s(fd, `item_${i}_unitAr`) || 'خدمة',
      unitEn: s(fd, `item_${i}_unitEn`) || 'service',
      paymentTermsAr: s(fd, `item_${i}_paymentTermsAr`),
      paymentTermsEn: s(fd, `item_${i}_paymentTermsEn`),
      deliveryAr: s(fd, `item_${i}_deliveryAr`),
      deliveryEn: s(fd, `item_${i}_deliveryEn`),
    });
  }
  if (!items.length) return { error: 'أضف بنداً واحداً على الأقل بكمية أكبر من صفر' };

  try {
    const quote = await createQuote({
      clientId,
      titleAr: s(fd, 'titleAr'),
      titleEn: s(fd, 'titleEn'),
      introAr: s(fd, 'introAr') || null,
      introEn: s(fd, 'introEn') || null,
      notesAr: s(fd, 'notesAr') || null,
      notesEn: s(fd, 'notesEn') || null,
      validityDays: n(fd, 'validityDays') || undefined,
      items,
    });
    revalidatePath('/admin');
    redirect(`/admin/documents/${quote.id}`);
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e;
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionApprove(id: string) {
  const admin = await requireAdmin();
  await approveDocument(id, admin);
  await promoteAgentServiceToCatalog(id, admin).catch(() => null);
  revalidatePath(`/admin/documents/${id}`);
}

export async function actionGenerateContract(quoteId: string) {
  const admin = await requireAdmin();
  const contract = await generateContractFromQuote(quoteId, admin);
  revalidatePath(`/admin/documents/${quoteId}`);
  redirect(`/admin/documents/${contract.id}`);
}

export async function actionBuildPdf(id: string) {
  await requireAdmin();
  await buildAndArchivePdf(id);
  revalidatePath(`/admin/documents/${id}`);
}

export async function actionSendEmail(id: string, includeArabic: boolean) {
  const admin = await requireAdmin();
  const r = await sendDocumentEmail({ documentId: id, includeArabic, attachPdf: true, actor: admin });
  if (!r.ok) throw new Error(r.error || 'فشل الإرسال');
  revalidatePath(`/admin/documents/${id}`);
}

export async function actionPrepareWhatsApp(id: string, lang: 'ar' | 'en') {
  const admin = await requireAdmin();
  const msg = await prepareWhatsApp(id, lang, admin);
  revalidatePath(`/admin/documents/${id}`);
  redirect(msg.href);
}

export async function actionSendForSignature(id: string) {
  const admin = await requireAdmin();
  await sendForSignature(id, admin, true);
  await createInvoicesForContract(id, admin).catch(() => null);
  revalidatePath(`/admin/documents/${id}`);
}

export async function actionCreateInvoices(id: string) {
  const admin = await requireAdmin();
  await createInvoicesForContract(id, admin);
  revalidatePath(`/admin/documents/${id}`);
}

// -------------------------------------------------------------- القبول العام
export async function actionAcceptQuote(_prev: State, fd: FormData): Promise<State> {
  const token = s(fd, 'token');
  const name = s(fd, 'name');
  if (!name) return { error: 'اكتب اسمك الكامل للقبول' };
  try {
    const doc = await acceptDocument(token, name, s(fd, 'ip') || null);
    const client = await prisma.client.findUnique({ where: { id: doc.clientId } });
    await notifyEvent(
      'Quotation accepted',
      doc.number,
      client?.companyAr || client?.nameAr || '',
      `accepted by ${name}`,
      publicUrl(token),
    );
    revalidatePath(`/d/${token}`);
    return { ok: 'شكراً لك. سُجّل قبولك للعرض وسنتواصل معك لاستكمال التعاقد.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------- المرفقات
export async function actionUploadAttachment(_prev: State, fd: FormData): Promise<State> {
  const clientId = s(fd, 'clientId');
  const folder = (s(fd, 'folder') || 'attachments') as ClientFolder;
  const file = fd.get('file') as File | null;
  const source = s(fd, 'source') || 'admin';
  if (source === 'admin') await requireAdmin();
  if (!file || !file.size) return { error: 'اختر ملفاً' };
  if (file.size > 20 * 1024 * 1024) return { error: 'الحد الأقصى لحجم الملف 20 ميجابايت' };

  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  const base = client.folderPath || clientFolderPath(client.id, client.companyAr || client.nameAr);
  const name = `${Date.now()}-${file.name}`;
  const key = fileKey(base, folder, name);
  await storage().put(key, Buffer.from(await file.arrayBuffer()), file.type);
  await prisma.fileAsset.create({
    data: {
      clientId,
      folder,
      name: file.name,
      path: key,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      source,
      uploadedBy: source,
    },
  });
  await logEvent({
    entityType: 'client',
    entityId: clientId,
    clientId,
    code: 'FILE_UPLOADED',
    titleAr: `رُفع الملف ${file.name} إلى مجلد ${folder}`,
    titleEn: `File ${file.name} uploaded to the ${folder} folder`,
    actor: source,
    actorKind: source === 'admin' ? 'admin' : 'client',
  });
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath('/portal');
  return { ok: 'رُفع الملف وأُرشف في مجلده.' };
}

// -------------------------------------------------------------- الوكيل الذكي
export async function actionRunAgent(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const clientId = s(fd, 'clientId');
  if (!clientId) return { error: 'اختر عميلاً' };
  try {
    const { quote } = await generateQuoteAndContract({
      clientId,
      nameAr: s(fd, 'nameAr'),
      nameEn: s(fd, 'nameEn'),
      summaryAr: s(fd, 'summaryAr'),
      summaryEn: s(fd, 'summaryEn') || undefined,
      price: n(fd, 'price'),
      qty: n(fd, 'qty') || 1,
      paymentTermsAr: s(fd, 'paymentTermsAr'),
      paymentTermsEn: s(fd, 'paymentTermsEn') || undefined,
      deliveryAr: s(fd, 'deliveryAr'),
      deliveryEn: s(fd, 'deliveryEn') || undefined,
    });
    redirect(`/admin/documents/${quote.id}`);
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e;
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// -------------------------------------------------------------- الموردون
export async function actionCreateSupplier(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  try {
    await createSupplier({
      nameAr: s(fd, 'nameAr'),
      nameEn: s(fd, 'nameEn') || null,
      crNumber: s(fd, 'crNumber') || null,
      activityAr: s(fd, 'activityAr') || null,
      activityEn: s(fd, 'activityEn') || null,
      iban: s(fd, 'iban') || null,
      bankName: s(fd, 'bankName') || null,
      email: s(fd, 'email') || null,
      phone: s(fd, 'phone') ? normalizePhone(s(fd, 'phone')) : null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath('/admin/suppliers');
  return { ok: 'سُجّل المورد' };
}

export async function actionCreateSupplyRequest(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  try {
    const req = await createSupplyRequest({
      clientId: s(fd, 'clientId'),
      titleAr: s(fd, 'titleAr'),
      titleEn: s(fd, 'titleEn'),
      scopeAr: s(fd, 'scopeAr') || null,
      scopeEn: s(fd, 'scopeEn') || null,
      coordinationFee: n(fd, 'coordinationFee'),
    });
    redirect(`/admin/supply/${req.id}`);
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e;
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionAddBid(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const id = s(fd, 'supplyRequestId');
  try {
    await addSupplierBid({
      supplyRequestId: id,
      supplierId: s(fd, 'supplierId'),
      amount: n(fd, 'amount'),
      deliveryAr: s(fd, 'deliveryAr') || null,
      deliveryEn: s(fd, 'deliveryEn') || null,
      notesAr: s(fd, 'notesAr') || null,
      notesEn: s(fd, 'notesEn') || null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath(`/admin/supply/${id}`);
  return { ok: 'أُضيف عرض المورد' };
}

export async function actionSelectBid(requestId: string, bidId: string) {
  const admin = await requireAdmin();
  await selectBid(requestId, bidId, admin);
  revalidatePath(`/admin/supply/${requestId}`);
}

export async function actionCreateSupplyAgreement(requestId: string) {
  const admin = await requireAdmin();
  const doc = await createSupplyAgreement(requestId, admin);
  redirect(`/admin/documents/${doc.id}`);
}

export async function actionFundSupply(requestId: string) {
  const admin = await requireAdmin();
  await createFundingInvoice(requestId, admin);
  revalidatePath(`/admin/supply/${requestId}`);
}

export async function actionAddMilestones(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const id = s(fd, 'supplyRequestId');
  const rows = Number(fd.get('rowCount') || 0);
  const ms = [];
  for (let i = 0; i < rows; i++) {
    const titleAr = s(fd, `ms_${i}_titleAr`);
    const amount = Number(fd.get(`ms_${i}_amount`) || 0);
    if (!titleAr || amount <= 0) continue;
    ms.push({ titleAr, titleEn: s(fd, `ms_${i}_titleEn`) || titleAr, amount });
  }
  if (!ms.length) return { error: 'أضف مرحلة واحدة على الأقل' };
  await addMilestones(id, ms);
  revalidatePath(`/admin/supply/${id}`);
  return { ok: 'حُدّدت مراحل الإنجاز' };
}

export async function actionApproveMilestone(milestoneId: string, requestId: string) {
  const admin = await requireAdmin();
  await approveMilestone(milestoneId, admin);
  revalidatePath(`/admin/supply/${requestId}`);
}

export async function actionPayMilestone(milestoneId: string, requestId: string) {
  const admin = await requireAdmin();
  await payMilestone(milestoneId, admin);
  revalidatePath(`/admin/supply/${requestId}`);
}

// -------------------------------------------------------- الفواتير والمحفظة
export async function actionCreateGovFeeInvoice(_prev: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const clientId = s(fd, 'clientId');
  try {
    await createInvoice(
      {
        clientId,
        titleAr: s(fd, 'titleAr') || 'إيداع عهدة رسوم حكومية',
        titleEn: s(fd, 'titleEn') || 'Government fees deposit',
        amountExclVat: n(fd, 'amount'),
        isGovFeeDeposit: true,
        depositKind: 'GOV_FEE',
      },
      admin,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: 'أُصدرت فاتورة العهدة' };
}

export async function actionSpendGovFee(_prev: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const clientId = s(fd, 'clientId');
  try {
    await walletSpend({
      clientId,
      kind: 'GOV_FEE_SPEND',
      amount: n(fd, 'amount'),
      descAr: s(fd, 'descAr') || 'صرف رسوم حكومية',
      descEn: s(fd, 'descEn') || 'Government fee disbursement',
      actor: admin,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: 'سُجّلت حركة الصرف' };
}

export async function actionMarkPaidManually(invoiceId: string) {
  const admin = await requireAdmin();
  await markInvoicePaid(invoiceId, { provider: 'manual', ref: `manual-${Date.now()}`, method: 'transfer' });
  await logEvent({
    entityType: 'invoice',
    entityId: invoiceId,
    code: 'MANUAL_PAYMENT',
    titleAr: 'سُجّل السداد يدوياً من لوحة التحكم (تحويل بنكي)',
    titleEn: 'Payment recorded manually from the dashboard (bank transfer)',
    actor: admin,
    actorKind: 'admin',
  });
  revalidatePath('/admin');
}
