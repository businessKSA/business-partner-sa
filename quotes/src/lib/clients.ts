import { prisma } from './db';
import { publicToken } from './tokens';
import { clientFolderPath, ensureClientFolders } from './storage';
import { logEvent } from './timeline';

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
