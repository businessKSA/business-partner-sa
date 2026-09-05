import { NextResponse } from 'next/server';
import { appBase } from '@/lib/base';
import { prisma } from '@/lib/db';
import { CHANNEL, linkIdentity, resolveClient } from '@/lib/identity';
import { createClient, normalizePhone } from '@/lib/clients';
import { autoIssueEligible, approveDocument, createQuote, type ItemInput } from '@/lib/documents';
import { notifyEvent, publicUrl, queueDocumentBuild, queueDocumentEmail } from '@/lib/send';

export const dynamic = 'force-dynamic';

/**
 * طلب عرض سعر من محادثة واتساب.
 *
 * رحلة العميل كانت تنقطع عند الرسالة: الوكيل يفهم الطلب ثم يَعِد بأن الفريق
 * «يتواصل خلال يومين»، فيخرج العميل من المحادثة بلا رقم ولا عرض ولا رابط.
 * والطريق كله موجود في هذه اللوحة أصلاً — عرض، موافقة، عقد، توقيع، دفع،
 * فاتورة — لكن بابه الوحيد كان بوابة تحتاج تسجيل دخول بالبريد.
 *
 * فهنا الباب نفسه من الواتساب: الرقم هوية (ClientIdentity قناة WHATSAPP)،
 * والخدمة من الكتالوج المتزامن مع الموقع، والقرار قرار اللوحة لا قرار
 * الوكيل — ما كان سعره مثبّتاً في الكتالوج يصدر عرضه فوراً برابطه، وما كان
 * مفتوح السعر ينتظر تسعير المالك ويعود برقمه فقط. فلا يسعّر وكيلٌ شيئاً.
 *
 * الحراسة: PANEL_BRIDGE_TOKEN نفسه، ومقارنة ثابتة الطول. النداء من خادم
 * الموقع (أو n8n بالسرّ نفسه) لا من متصفح العميل.
 */

function authorized(req: Request): boolean {
  const expected = process.env.PANEL_BRIDGE_TOKEN || '';
  if (!expected) return false;
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const phoneRaw = str(body.phone);
  const code = str(body.serviceCode).toUpperCase();
  if (!phoneRaw) return NextResponse.json({ ok: false, error: 'phone_required' }, { status: 400 });
  if (!code) return NextResponse.json({ ok: false, error: 'service_code_required' }, { status: 400 });

  const phone = normalizePhone(phoneRaw);
  const service = await prisma.service.findUnique({ where: { code } });
  if (!service || !service.active) {
    return NextResponse.json({ ok: false, error: 'service_unavailable', code }, { status: 404 });
  }

  // العميل: رقمه هويته. ومن راسلنا من قبل لا يُنشأ له ملف ثانٍ.
  let client = await resolveClient(CHANNEL.WHATSAPP, phone);
  if (!client) {
    const name = str(body.name) || `عميل واتساب ${phone.slice(-4)}`;
    // البريد مطلوب في نموذج العميل، ولا نملكه بعد من الواتساب: عنوان داخلي
    // لا يُرسل إليه شيء حتى يعطينا العميل بريده، فيُحدَّث حينها.
    const email = str(body.email) || `wa-${phone}@whatsapp.businesspartner.sa`;
    client = await createClient({ nameAr: name, email, phone, notes: 'أنشئ من محادثة واتساب' }, 'whatsapp');
    await linkIdentity(client.id, CHANNEL.WHATSAPP, phone, { verified: true, primary: true }).catch(() => null);
  } else if (str(body.email) && client.email.endsWith('@whatsapp.businesspartner.sa')) {
    // أعطانا بريده أخيراً: نستبدل العنوان الداخلي به ليصله العرض والفاتورة.
    client = await prisma.client.update({ where: { id: client.id }, data: { email: str(body.email) } });
    await linkIdentity(client.id, CHANNEL.EMAIL, str(body.email), { verified: false }).catch(() => null);
  }

  const qty = Math.max(service.minQty, Number(body.qty) > 0 ? Math.floor(Number(body.qty)) : service.minQty);
  const scope = str(body.scope); // نطاق العمل كما لخّصه الوكيل مع العميل
  const items: ItemInput[] = [
    {
      serviceId: service.id,
      code: service.code,
      nameAr: service.nameAr,
      nameEn: service.nameEn,
      descAr: scope || service.descAr,
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
      clientId: client.id,
      items,
      notesAr: scope ? `نطاق العمل كما اتفق عليه العميل في واتساب:\n${scope}` : null,
    });

    if (!auto) {
      await notifyEvent(
        'طلب تسعير من واتساب',
        doc.number,
        client.nameAr,
        `${service.nameAr} — الخدمة مفتوحة السعر، تحتاج تسعيرك قبل إرسالها. جوال العميل: ${phone}`,
        `${appBase()}/admin/documents/${doc.id}`,
      );
      return NextResponse.json({
        ok: true,
        status: 'pending_pricing',
        number: doc.number,
        serviceAr: service.nameAr,
        clientId: client.id,
      });
    }

    await approveDocument(doc.id, 'whatsapp', 'system');
    await queueDocumentBuild(doc.id);
    await queueDocumentEmail(doc.id, true, 'whatsapp').catch(() => null);

    return NextResponse.json({
      ok: true,
      status: 'issued',
      number: doc.number,
      serviceAr: service.nameAr,
      total: doc.total,
      link: publicUrl(doc.publicToken),
      clientId: client.id,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
