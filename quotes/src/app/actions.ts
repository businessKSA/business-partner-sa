'use server';

/** كل عمليات التعديل تمر من هنا. الاعتماد شرط لكل إرسال. */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin, requireClient, createMagicLink, consumeMagicLink, startAdminSession, startClientSession, endSessions, adminEmail, MAGIC_LINK_TTL_MIN } from '@/lib/auth';
import { createClient, updateClient, normalizePhone } from '@/lib/clients';
import { createQuote, generateContractFromQuote, approveDocument, acceptDocument, autoIssueEligible, type ItemInput } from '@/lib/documents';
import { prepareWhatsApp, queueDocumentBuild, queueDocumentEmail, notifyEvent, publicUrl, payUrl, composeClientMail, vatTotals, sendQuoteRequestAck } from '@/lib/send';
import { sendForSignature } from '@/lib/docusign/service';
import { createInvoicesForContract, createInvoice, markInvoicePaid, walletSpend } from '@/lib/billing';
import { generateQuoteAndContract, promoteAgentServiceToCatalog } from '@/lib/agent';
import { createSupplier, createSupplyRequest, addSupplierBid, selectBid, createSupplyAgreement, createFundingInvoice, addMilestones, approveMilestone, payMilestone } from '@/lib/suppliers';
import { sendMail } from '@/lib/mailer';
import { loadTemplate, render } from '@/lib/templates';
import { storage, fileKey, clientFolderPath, type ClientFolder } from '@/lib/storage';
import { logEvent, audit } from '@/lib/timeline';
import { round2, fmtMoney, fmtDate } from '@/lib/money';
import { notifyCatalogChanged } from '@/lib/catalog-sync';

type State = { error?: string; ok?: string; link?: string };

const s = (fd: FormData, k: string) => (fd.get(k) as string | null)?.trim() || '';
const n = (fd: FormData, k: string) => Number(fd.get(k) || 0);

// ----------------------------------------------------------------- الفواتير
/**
 * فاتورة مستقلة لأي عميل — غير مرتبطة بعقد.
 * تُستخدم للخدمات المباشرة والدفعات الإضافية، وينتج عنها رابط سداد فوري.
 */
export async function actionCreateInvoice(_prev: State, fd: FormData): Promise<State> {
  const actor = await requireAdmin();
  const clientId = s(fd, 'clientId');
  const titleAr = s(fd, 'titleAr');
  const amountExclVat = n(fd, 'amountExclVat');
  if (!clientId) return { error: 'اختر العميل' };
  if (!titleAr) return { error: 'أدخل وصف الفاتورة بالعربي' };
  if (!(amountExclVat > 0)) return { error: 'أدخل مبلغاً أكبر من صفر' };

  const dueRaw = s(fd, 'dueDate');
  const kind = s(fd, 'depositKind');
  const invoice = await createInvoice(
    {
      clientId,
      titleAr,
      titleEn: s(fd, 'titleEn') || titleAr,
      amountExclVat: round2(amountExclVat),
      dueDate: dueRaw ? new Date(dueRaw) : null,
      // العهدة ليست إيراداً ولا تخضع للضريبة — تُصرف للجهات أو للموردين بإيصالاتها
      isGovFeeDeposit: kind === 'GOV_FEE',
      depositKind: kind === 'GOV_FEE' || kind === 'SUPPLY' ? kind : null,
    },
    actor,
  );

  revalidatePath('/admin/invoices');
  redirect(`/admin/invoices?created=${invoice.number}`);
}

/** يرسل رابط السداد للعميل بالبريد، ويجهّز نص واتساب جاهزاً للإرسال. */
export async function actionSendInvoiceLink(_prev: State, fd: FormData): Promise<State> {
  const actor = await requireAdmin();
  const invoiceId = s(fd, 'invoiceId');
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } });
  if (!invoice) return { error: 'الفاتورة غير موجودة' };
  if (invoice.status === 'PAID') return { error: 'الفاتورة مسددة — لا داعي لإرسال رابط سداد' };

  const link = payUrl(invoice.payToken);
  const clientNameAr = invoice.client.companyAr || invoice.client.nameAr;
  const vars = {
    clientName: clientNameAr,
    number: invoice.number,
    title: invoice.titleAr,
    amount: fmtMoney(invoice.amountExclVat),
    vat: fmtMoney(invoice.vatAmount),
    total: fmtMoney(invoice.total),
    link,
  };

  const tpl = loadTemplate<{ whatsapp: Record<string, { ar: string; en: string }> }>('messages.json');

  const composed = composeClientMail('invoice', vars, {
    items: [{ name: invoice.titleAr, amount: `${fmtMoney(invoice.amountExclVat)} ريال` }],
    totals: vatTotals(invoice.amountExclVat, invoice.vatAmount, invoice.total, 'الإجمالي المستحق'),
    ctaUrl: link,
    refs: [
      { label: 'رقم الفاتورة', value: invoice.number },
      { label: 'العميل', value: clientNameAr },
      ...(invoice.dueDate ? [{ label: 'تاريخ الاستحقاق', value: fmtDate(invoice.dueDate, 'ar') }] : []),
    ],
    govFeesNote: !invoice.isGovFeeDeposit && !invoice.depositKind,
    signature: true,
    enRows: [
      { label: 'Invoice number', value: invoice.number },
      { label: 'Amount excluding VAT', value: `SAR ${fmtMoney(invoice.amountExclVat)}` },
      { label: 'Value added tax 15%', value: `SAR ${fmtMoney(invoice.vatAmount)}` },
      { label: 'Total due', value: `SAR ${fmtMoney(invoice.total)}` },
    ],
    enUrl: link,
  });

  const mail = await sendMail({
    to: invoice.client.email,
    subject: composed.subject,
    text: composed.text,
    html: composed.html,
  });

  await prisma.delivery.create({
    data: {
      invoiceId: invoice.id,
      channel: 'EMAIL',
      toName: invoice.client.nameAr,
      toAddress: invoice.client.email,
      subject: composed.subject,
      body: composed.text,
      status: mail.ok ? 'SENT' : 'FAILED',
      error: mail.error ?? null,
      actor,
    },
  });

  await logEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    clientId: invoice.clientId,
    code: 'INVOICE_LINK_SENT',
    titleAr: `أُرسل رابط سداد الفاتورة ${invoice.number} إلى ${invoice.client.email}`,
    titleEn: `Payment link for invoice ${invoice.number} sent to ${invoice.client.email}`,
    actor,
    actorKind: 'admin',
  });

  const wa = render(tpl.whatsapp.invoice.ar, vars);
  const phone = normalizePhone(invoice.client.phone).replace(/^\+/, '');
  revalidatePath('/admin/invoices');
  return {
    ok: `أُرسل رابط السداد إلى ${invoice.client.email}`,
    link: `https://wa.me/${phone}?text=${encodeURIComponent(wa)}`,
  };
}

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
  const composed = composeClientMail(
    'portalInvite',
    { clientName: client.companyAr || client.nameAr, link, validMinutes: MAGIC_LINK_TTL_MIN },
    {
      ctaUrl: link,
      enRows: [
        { label: 'Link validity', value: `${MAGIC_LINK_TTL_MIN} minutes` },
        { label: 'Password', value: 'Not required — the link opens the portal directly' },
      ],
      enUrl: link,
    },
  );
  await sendMail({
    to: email,
    subject: composed.subject,
    text: composed.text,
    html: composed.html,
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

/** تعديل بيانات عميل من لوحة التحكم. */
export async function actionUpdateClient(_prev: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const id = s(fd, 'id');
  if (!id) return { error: 'معرّف العميل مفقود.' };
  try {
    await updateClient(
      id,
      {
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
        notes: s(fd, 'notes'),
      },
      admin,
      'admin',
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${id}`);
  redirect(`/admin/clients/${id}`);
}

/**
 * العميل يكتب بياناته بنفسه من بوابته.
 *
 * المعرّف يؤخذ من الجلسة لا من النموذج: لو قُرئ من حقل مرسل لأمكن لعميل أن
 * يعدّل بيانات عميل آخر بتغيير قيمة في المتصفح. ولا يُسمح له بتعديل بريده،
 * لأنه مفتاح دخوله إلى البوابة — تغييره من هنا يطرده من حسابه.
 */
export async function actionUpdateOwnProfile(_prev: State, fd: FormData): Promise<State> {
  const clientId = await requireClient();
  try {
    await updateClient(
      clientId,
      {
        nameAr: s(fd, 'nameAr'),
        nameEn: s(fd, 'nameEn'),
        companyAr: s(fd, 'companyAr'),
        companyEn: s(fd, 'companyEn'),
        crNumber: s(fd, 'crNumber'),
        vatNumber: s(fd, 'vatNumber'),
        phone: s(fd, 'phone'),
        city: s(fd, 'city'),
        addressAr: s(fd, 'addressAr'),
        addressEn: s(fd, 'addressEn'),
        repName: s(fd, 'repName'),
        repTitle: s(fd, 'repTitle'),
      },
      'client',
      'client',
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath('/portal');
  revalidatePath('/portal/profile');
  return { ok: 'حُفظت بياناتك. تُستخدم في عروض الأسعار والعقود والفواتير الصادرة لك.' };
}

/**
 * العميل يطلب خدمة من بوابته.
 *
 * إن كانت الخدمة بسعر كتالوج منشور فالعرض يصدر ويصله فوراً بلا تدخّل — لا شيء
 * يُراجَع حين يكون الرقم في العرض هو الرقم المعلن على الموقع. وإن كانت مفتوحة
 * السعر فلا رقم بعد، فيبقى المستند مسودة ويصلك أنت لتسعّره.
 */
export async function actionRequestQuote(_prev: State, fd: FormData): Promise<State> {
  const clientId = await requireClient();
  const serviceId = s(fd, 'serviceId');
  if (!serviceId) return { error: 'اختر الخدمة أولاً.' };

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) return { error: 'هذه الخدمة غير متاحة حالياً.' };

  const qty = Math.max(service.minQty, n(fd, 'qty') || service.minQty);
  const items: ItemInput[] = [
    {
      serviceId,
      code: service.code,
      nameAr: service.nameAr,
      nameEn: service.nameEn,
      descAr: service.descAr,
      descEn: service.descEn,
      qty,
      unitPrice: service.unitPrice,
      unitAr: service.unitAr,
      unitEn: service.unitEn,
      paymentTermsAr: service.paymentTermsAr,
      paymentTermsEn: service.paymentTermsEn,
      deliveryAr: service.deliveryAr,
      deliveryEn: service.deliveryEn,
    },
  ];

  try {
    const auto = await autoIssueEligible(items);
    const doc = await createQuote({
      clientId,
      items,
      notesAr: s(fd, 'noteAr') || null,
    });

    if (!auto) {
      await notifyEvent(
        'طلب تسعير',
        doc.number,
        service.nameAr,
        'الخدمة مفتوحة السعر — يحتاج العرض تسعيراً منك قبل إرساله.',
        `${process.env.APP_URL || ''}/admin/documents/${doc.id}`,
      );
      // العميل يخرج بيده برقم يسأل به، لا بجملة على الشاشة وحدها
      await sendQuoteRequestAck(doc.id, service.nameAr).catch(() => {});
      return {
        ok: `وصلنا طلبك برقم ${doc.number}، ووصلك إشعار الاستلام على بريدك. هذه الخدمة تُسعَّر حسب الحالة، وسيصلك العرض بعد إعداده.`,
      };
    }

    await approveDocument(doc.id, 'auto', 'system');
    await queueDocumentBuild(doc.id);
    await queueDocumentEmail(doc.id, true, 'auto');

    revalidatePath('/portal');
    return {
      ok: `صدر عرض السعر ${doc.number} ووصلك على بريدك.`,
      link: publicUrl(doc.publicToken),
    };
  } catch (e) {
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
    // روابط المصادر الأخرى — تُحرَّر هنا فتصير خريطة الكتالوج كاملة.
    paymentMethods: s(fd, 'paymentMethods'),
    notionPageId: s(fd, 'notionPageId') || null,
    siteSlug: s(fd, 'siteSlug') || null,
    govPlatform: s(fd, 'govPlatform') || null,
    syncSource: 'panel',
    syncedAt: new Date(),
  };
  if (!data.code || !data.nameAr || !data.nameEn) return { error: 'الكود والاسم بالعربي والإنجليزي حقول مطلوبة' };
  try {
    if (id) await prisma.service.update({ where: { id }, data });
    else await prisma.service.create({ data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  // إشعار n8n ليحدّث صف نوشن ويعيد نشر الموقع. لا يُفشِل الحفظ عند تعذّره —
  // السعر استقرّ في مخزن الحقيقة، وتراجعُه لأن سير عمل خارجي متوقف أسوأ.
  const hook = await notifyCatalogChanged({ codes: [data.code], source: 'panel', actor: 'admin' });
  revalidatePath('/admin/catalog');
  revalidatePath('/admin/catalog/map');
  return { ok: hook.sent ? 'حُفظت الخدمة وأُبلغت المصادر الأخرى' : 'حُفظت الخدمة' };
}

/**
 * تثبيت الأسعار المعلنة: كل خدمة عليها رقم فعلي يتوقف عندها «السعر المفتوح».
 *
 * كانت خدمات «يبدأ من» تُستورد كسعر مفتوح، فيصل طلب العميل إلى المالك ليسعّره
 * رغم أن الرقم منشور على الموقع أصلاً. بقرار المالك (٢٥ أغسطس ٢٠٢٦) صار الرقم
 * المنشور سعراً نهائياً، والزيادة — إن وُجدت — بنداً مستقلاً في العرض.
 *
 * لا يلمس خدمة بلا رقم: تلك تبقى مفتوحة لأن لا سعر لها يُثبَّت.
 */
export async function actionFixOpenPrices(): Promise<State> {
  await requireAdmin();
  // خدمة بلا رقم لكنها ليست «سعراً مفتوحاً» بيانات متناقضة: لا سعر لها تُصدره
  // ولا هي معلَّمة بأنك تسعّرها. تُفتح هنا فتصل إليك بدل أن تسقط في الفراغ.
  const contradictory = await prisma.service.updateMany({
    where: { openPrice: false, unitPrice: { lte: 0 } },
    data: { openPrice: true, syncSource: 'panel', syncedAt: new Date() },
  });

  const targets = await prisma.service.findMany({
    where: { openPrice: true, unitPrice: { gt: 0 } },
    select: { id: true, code: true, unitPrice: true },
  });
  const opened = contradictory.count ? ` وفُتح سعر ${contradictory.count} خدمة بلا رقم.` : '';
  if (!targets.length) {
    return { ok: `لا توجد أسعار معلّقة — كل خدمة مسعّرة صارت ثابتة.${opened}` };
  }

  await prisma.service.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { openPrice: false, syncSource: 'panel', syncedAt: new Date() },
  });
  await audit({
    action: 'CATALOG_PRICES_FIXED',
    entityType: 'Service',
    entityId: 'catalog',
    actor: 'admin',
    payload: { count: targets.length, codes: targets.map((t) => t.code) },
  });
  await notifyCatalogChanged({
    codes: targets.map((t) => t.code),
    source: 'panel',
    actor: 'admin',
  });
  revalidatePath('/admin/catalog');
  revalidatePath('/admin/catalog/map');
  return { ok: `ثُبِّت سعر ${targets.length} خدمة: ${targets.map((t) => t.code).join('، ')}.${opened}` };
}

/**
 * اعتماد أسعار الموقع المنشورة في اللوحة — مرة واحدة، بقرار المالك.
 *
 * كانت اللوحة تحمل لتسع باقات سعراً أعلى ٢٥٪ من المنشور على الموقع، لأن ملف
 * الموقع كان يحمل قائمتَي أسعار وأُخذت القديمة. قرار المالك (٢٥ أغسطس ٢٠٢٦):
 * **الرقم المنشور على الموقع هو الصحيح.** هذا الإجراء يجعل اللوحة تطابقه،
 * وبعدها تصير اللوحة هي المصدر ويقرأ منها الموقع.
 *
 * لا يُغيّر إلا ما اختلف فعلاً، ويعيد قائمة كل تعديل بالرقمين — فلا يُبتلع شيء.
 * والخدمات التي لا وجود لها في الموقع لا تُمسّ.
 */
export async function actionAdoptSitePrices(): Promise<State> {
  await requireAdmin();
  const base = (process.env.SITE_URL || 'https://businesspartner.sa').replace(/\/+$/, '');

  type SiteRow = { code?: string; key?: string; amount?: number | null; pricingModel?: string };
  let cat: { services?: SiteRow[]; packages?: SiteRow[] };
  try {
    const res = await fetch(`${base}/assets/data/catalog.json`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cat = await res.json();
  } catch (e) {
    return { error: `تعذّر قراءة كتالوج الموقع من ${base}: ${e instanceof Error ? e.message : String(e)}` };
  }

  const published = new Map<string, number>();
  for (const r of cat.services || []) {
    const code = String(r.code || '').trim().toUpperCase();
    if (code && Number(r.amount) > 0) published.set(code, round2(Number(r.amount)));
  }
  for (const r of cat.packages || []) {
    const key = String(r.key || '').trim().toUpperCase();
    if (key && Number(r.amount) > 0) published.set(`PKG-${key}`, round2(Number(r.amount)));
  }
  if (!published.size) return { error: 'كتالوج الموقع لم يُرجع أي سعر — لم يُغيَّر شيء.' };

  const rows = await prisma.service.findMany({
    where: { code: { in: [...published.keys()] } },
    select: { id: true, code: true, unitPrice: true },
  });

  const changes = rows
    .map((r) => ({ ...r, to: published.get(r.code)! }))
    .filter((r) => Math.abs(r.unitPrice - r.to) > 0.005);

  if (!changes.length) {
    return { ok: `اللوحة مطابقة للموقع بالفعل — ${rows.length} خدمة مقارَنة، بلا فرق.` };
  }

  for (const c of changes) {
    await prisma.service.update({
      where: { id: c.id },
      data: { unitPrice: c.to, syncSource: 'site', syncedAt: new Date() },
    });
  }
  await audit({
    action: 'CATALOG_ADOPTED_SITE_PRICES',
    entityType: 'Service',
    entityId: 'catalog',
    actor: 'admin',
    payload: { source: base, changes: changes.map((c) => ({ code: c.code, from: c.unitPrice, to: c.to })) },
  });
  await notifyCatalogChanged({ codes: changes.map((c) => c.code), source: 'panel', actor: 'admin' });
  revalidatePath('/admin/catalog');
  revalidatePath('/admin/catalog/map');

  const list = changes.map((c) => `${c.code}: ${fmtMoney(c.unitPrice)} ← ${fmtMoney(c.to)}`).join('، ');
  return { ok: `اعتُمد سعر الموقع في ${changes.length} خدمة — ${list}` };
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
  // المستندات تُولَّد في الخلفية فور الاعتماد، فيجدها العميل جاهزة عند الفتح
  await queueDocumentBuild(id);
  revalidatePath(`/admin/documents/${id}`);
}

/** يعيد تشغيل مهمة خلفية فاشلة من صفحة المستند. */
export async function actionRetryJob(jobId: string, documentId: string) {
  await requireAdmin();
  const { retryJob } = await import('@/lib/queue');
  await retryJob(jobId);
  revalidatePath(`/admin/documents/${documentId}`);
}

export async function actionGenerateContract(quoteId: string) {
  const admin = await requireAdmin();
  const contract = await generateContractFromQuote(quoteId, admin);
  revalidatePath(`/admin/documents/${quoteId}`);
  redirect(`/admin/documents/${contract.id}`);
}

export async function actionBuildDocuments(id: string) {
  await requireAdmin();
  await queueDocumentBuild(id);
  revalidatePath(`/admin/documents/${id}`);
}

export async function actionSendEmail(id: string, includeArabic: boolean) {
  const admin = await requireAdmin();
  await queueDocumentEmail(id, includeArabic, admin);
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
