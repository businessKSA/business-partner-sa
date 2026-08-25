import { prisma } from './db';
import { publicToken } from './tokens';
import { clientFolderPath, ensureClientFolders } from './storage';
import { logEvent } from './timeline';
import { seedIdentitiesFor } from './identity';
import { normalizePhone } from './phone';

export { normalizePhone };

export interface NewClient {
  nameAr: string;
  nameEn?: string | null;
  companyAr?: string | null;
  companyEn?: string | null;
  crNumber?: string | null;
  vatNumber?: string | null;
  email: string;
  phone: string;
  country?: string;
  city?: string | null;
  addressAr?: string | null;
  addressEn?: string | null;
  repName?: string | null;
  repTitle?: string | null;
  notes?: string | null;
}

/** رقم واتساب بصيغة دولية بدون + وبدون فواصل. */

/**
 * إنشاء عميل + إنشاء مجلده تلقائياً بثلاثة مجلدات فرعية:
 * عروض الأسعار · العقود · المرفقات
 */
export async function createClient(input: NewClient, actor = 'admin') {
  const client = await prisma.client.create({
    data: {
      nameAr: input.nameAr.trim(),
      nameEn: input.nameEn?.trim() || null,
      companyAr: input.companyAr?.trim() || null,
      companyEn: input.companyEn?.trim() || null,
      crNumber: input.crNumber?.trim() || null,
      vatNumber: input.vatNumber?.trim() || null,
      email: input.email.trim(),
      phone: normalizePhone(input.phone, input.country || 'SA'),
      country: input.country || 'SA',
      city: input.city?.trim() || null,
      addressAr: input.addressAr?.trim() || null,
      addressEn: input.addressEn?.trim() || null,
      repName: input.repName?.trim() || null,
      repTitle: input.repTitle?.trim() || null,
      notes: input.notes?.trim() || null,
      portalToken: publicToken(),
    },
  });

  const folder = clientFolderPath(client.id, client.companyAr || client.nameAr);
  await ensureClientFolders(folder);
  const updated = await prisma.client.update({
    where: { id: client.id },
    data: { folderPath: folder },
  });

  // هويات القناة تُنشأ مع العميل فلا يتفرّع ملفه حين يصل من الواتساب أو البريد
  await seedIdentitiesFor(client.id);

  await logEvent({
    entityType: 'client',
    entityId: client.id,
    clientId: client.id,
    code: 'CLIENT_CREATED',
    titleAr: 'أُنشئ العميل وأُنشئ مجلده تلقائياً (عروض الأسعار · العقود · المرفقات)',
    titleEn: 'Client created; folder created automatically (Quotations, Contracts, Attachments)',
    actor,
    actorKind: 'admin',
    meta: { folder },
  });

  return updated;
}

/** الحقول التي يجوز تعديلها بعد الإنشاء. */
export interface ClientEdit {
  nameAr?: string;
  nameEn?: string | null;
  companyAr?: string | null;
  companyEn?: string | null;
  crNumber?: string | null;
  vatNumber?: string | null;
  email?: string;
  phone?: string;
  country?: string;
  city?: string | null;
  addressAr?: string | null;
  addressEn?: string | null;
  repName?: string | null;
  repTitle?: string | null;
  notes?: string | null;
}

const t = (v: string | null | undefined) => (v ?? '').trim() || null;

/**
 * تعديل بيانات عميل قائم.
 *
 * لا يُلمس مجلد العميل ولا رمز بوابته: المجلد يحمل مستنداته الصادرة فعلاً،
 * وإعادة تسميته تقطع الروابط المرسلة للعميل؛ والرمز هو مفتاح دخوله، وتبديله
 * يطرده من بوابته دون سبب.
 *
 * actorKind يميّز من عدّل: المالك من لوحة التحكم، أم العميل من بوابته.
 */
export async function updateClient(
  id: string,
  input: ClientEdit,
  actor = 'admin',
  actorKind: 'admin' | 'client' = 'admin',
) {
  const before = await prisma.client.findUniqueOrThrow({ where: { id } });

  const data: Record<string, string | null> = {};
  if (input.nameAr !== undefined && input.nameAr.trim()) data.nameAr = input.nameAr.trim();
  if (input.email !== undefined && input.email.trim()) data.email = input.email.trim();
  if (input.phone !== undefined && input.phone.trim()) {
    data.phone = normalizePhone(input.phone, input.country || before.country || 'SA');
  }
  if (input.country !== undefined && input.country.trim()) data.country = input.country.trim();
  for (const k of [
    'nameEn', 'companyAr', 'companyEn', 'crNumber', 'vatNumber',
    'city', 'addressAr', 'addressEn', 'repName', 'repTitle', 'notes',
  ] as const) {
    if (input[k] !== undefined) data[k] = t(input[k]);
  }

  const changed = Object.keys(data).filter(
    (k) => (before as unknown as Record<string, unknown>)[k] !== data[k],
  );
  if (!changed.length) return before;

  const after = await prisma.client.update({ where: { id }, data });

  await logEvent({
    entityType: 'client',
    entityId: id,
    clientId: id,
    code: 'CLIENT_UPDATED',
    titleAr: `عُدّلت بيانات العميل: ${changed.join('، ')}`,
    titleEn: `Client details updated: ${changed.join(', ')}`,
    actor,
    actorKind,
    meta: { changed },
  });

  return after;
}
