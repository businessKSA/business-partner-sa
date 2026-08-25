/**
 * هوية العميل الموحّدة.
 * نفس الشخص يصل من الواتساب برقمه، ومن البريد بعنوانه، ومن الموقع بجلسته.
 * كل هذه هويات قناة تشير إلى ملف عميل واحد — تُبنى الآن قبل أي قناة جديدة،
 * لأن ربطها بعد وجود ثلاث قنوات يعني ترحيل بيانات كاملاً.
 */
import { prisma } from './db';
import { normalizePhone } from './clients';

export const CHANNEL = {
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  PORTAL: 'PORTAL',
  NAFATH: 'NAFATH',
} as const;

export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

/** يوحّد صيغة القيمة قبل الحفظ أو البحث حتى لا تتكرر الهوية بصيغتين. */
export function normalizeIdentity(channel: Channel, value: string): string {
  const v = (value || '').trim();
  if (channel === CHANNEL.WHATSAPP) return normalizePhone(v);
  return v.toLowerCase();
}

export async function linkIdentity(
  clientId: string,
  channel: Channel,
  value: string,
  opts: { verified?: boolean; primary?: boolean } = {},
) {
  const normalized = normalizeIdentity(channel, value);
  if (!normalized) throw new Error('قيمة الهوية فارغة');

  const existing = await prisma.clientIdentity.findUnique({
    where: { channel_value: { channel, value: normalized } },
  });
  if (existing && existing.clientId !== clientId) {
    throw new Error(`هذه الهوية مرتبطة بعميل آخر بالفعل: ${channel}/${normalized}`);
  }

  if (opts.primary) {
    await prisma.clientIdentity.updateMany({
      where: { clientId, channel },
      data: { primary: false },
    });
  }

  return prisma.clientIdentity.upsert({
    where: { channel_value: { channel, value: normalized } },
    create: {
      clientId,
      channel,
      value: normalized,
      primary: opts.primary ?? false,
      verifiedAt: opts.verified ? new Date() : null,
    },
    update: {
      primary: opts.primary ?? undefined,
      verifiedAt: opts.verified ? new Date() : undefined,
    },
  });
}

/** يجد العميل من أي قناة. يعود بـnull إن كانت الهوية غير معروفة. */
export async function resolveClient(channel: Channel, value: string) {
  const normalized = normalizeIdentity(channel, value);
  if (!normalized) return null;

  const identity = await prisma.clientIdentity.findUnique({
    where: { channel_value: { channel, value: normalized } },
    include: { client: true },
  });
  if (identity) return identity.client;

  // احتياط للعملاء الذين أُنشئوا قبل تفعيل الهويات: نبحث في الحقول المباشرة
  const legacy =
    channel === CHANNEL.WHATSAPP
      ? await prisma.client.findFirst({ where: { phone: normalized } })
      : await prisma.client.findFirst({ where: { email: normalized } });

  if (legacy) {
    await linkIdentity(legacy.id, channel, normalized).catch(() => null);
    return legacy;
  }
  return null;
}

/** ينشئ هويات القناة الافتراضية لعميل من بريده وجواله. */
export async function seedIdentitiesFor(clientId: string) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  const made = [];
  if (client.email) {
    made.push(await linkIdentity(clientId, CHANNEL.EMAIL, client.email, { primary: true }).catch(() => null));
  }
  if (client.phone) {
    made.push(await linkIdentity(clientId, CHANNEL.WHATSAPP, client.phone, { primary: true }).catch(() => null));
  }
  return made.filter(Boolean);
}

export async function identitiesOf(clientId: string) {
  return prisma.clientIdentity.findMany({ where: { clientId }, orderBy: { createdAt: 'asc' } });
}
