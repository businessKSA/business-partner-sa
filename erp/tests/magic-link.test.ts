/**
 * الدخول برابطٍ بلا كلمة مرور.
 *
 * ما يُختبر هنا ليس «هل يعمل الرابط» — بل الخصائص التي إن سقطت واحدةٌ
 * منها صار الرابط باباً مفتوحاً:
 *
 *   ـ الرمز نفسه لا يُخزَّن، فمن قرأ الجدول لا يملك دخولاً.
 *   ـ الرابط يعمل مرّةً واحدة، ولو ضُغط مرّتين في اللحظة نفسها.
 *   ـ الفحص لا يستهلك — وإلّا حرقت برامجُ البريد الرابطَ قبل وصوله.
 *   ـ الطلب لا يفرّق بين بريدٍ مسجَّل وآخر ليس كذلك في شيءٍ يراه الزائر.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prisma, withoutTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import { hashPassword } from '../src/lib/auth.ts';
import {
  requestMagicLink, inspectMagicLink, consumeMagicLink, purgeExpiredMagicLinks,
  tokenMatchesHash, MAGIC_TTL_MS, MAX_REQUESTS_PER_WINDOW,
} from '../src/lib/magic-link.ts';

const EMAIL = 'magic-user@example.test';
const STRANGER = 'nobody-here@example.test';
let tenantId: string;
let userId: string;

/** يقرأ الرمز من آخر رابط أُنشئ — البريد في الاختبار يذهب إلى السجلّ. */
async function latestLinkRow(email: string) {
  return withoutTenant('اختبار: قراءة آخر رابط', (tx) =>
    tx.magicLink.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } }),
  );
}

before(async () => {
  process.env.MAIL_PROVIDER = 'log';
  await purgeTenantBySlug('magic-test');
  const t = await provisionTenant({ slug: 'magic-test', nameAr: 'منشأة اختبار الرابط' });
  tenantId = t.id;

  await withoutTenant('اختبار: إنشاء مستخدم', async (tx) => {
    const user = await tx.user.upsert({
      where: { email: EMAIL },
      create: { email: EMAIL, name: 'مستخدم الرابط', passwordHash: await hashPassword('x') },
      update: { active: true },
    });
    userId = user.id;
    const role = await tx.role.findFirstOrThrow({ where: { tenantId, code: 'OWNER' } });
    await tx.membership.create({ data: { userId: user.id, tenantId, roleId: role.id } });
  });
});

after(async () => {
  await withoutTenant('اختبار: تنظيف', async (tx) => {
    await tx.magicLink.deleteMany({ where: { email: { in: [EMAIL, STRANGER] } } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.membership.deleteMany({ where: { userId } });
    await tx.user.deleteMany({ where: { email: { in: [EMAIL, STRANGER] } } });
  });
  await purgeTenantBySlug('magic-test');
  await prisma.$disconnect();
});

// ── التخزين ──────────────────────────────────────────────────────────────

test('الرمز لا يُخزَّن — تجزئتُه وحدها، فمن قرأ الجدول لا يملك دخولاً', async () => {
  const out = await requestMagicLink(EMAIL);
  assert.equal(out.sent, true);

  const row = await latestLinkRow(EMAIL);
  assert.ok(row);

  // العمود المخزَّن تجزئةٌ ستّينية لا رمزاً
  assert.match(row.tokenHash, /^[0-9a-f]{64}$/);

  // ولا يمكن اشتقاق رمزٍ صالح منه: التجزئة لا تُعكَس. نتحقّق عملياً بأن
  // استعمال التجزئة نفسها رمزاً يُرفض.
  const asToken = await inspectMagicLink(row.tokenHash);
  assert.equal(asToken.valid, false);
});

test('المقارنة تقع على التجزئة، ورمزٌ يخالف حرفاً واحداً يُرفض', () => {
  const token = 'a'.repeat(64);
  const hash = createHash('sha256').update(token).digest('hex');
  assert.equal(tokenMatchesHash(token, hash), true);
  assert.equal(tokenMatchesHash('b' + 'a'.repeat(63), hash), false);
});

// ── دورة الحياة ──────────────────────────────────────────────────────────

test('الفحص لا يستهلك الرابط — وإلّا حرقته برامج البريد قبل وصوله', async () => {
  await prisma.magicLink.deleteMany({ where: { email: EMAIL } });
  await requestMagicLink(EMAIL);
  const row = await latestLinkRow(EMAIL);
  const token = await tokenFor(row!.id);

  // فحصٌ ثلاث مرّات — كما يفعل فاحصٌ آلي — ثم يبقى صالحاً
  for (let i = 0; i < 3; i++) {
    const s = await inspectMagicLink(token);
    assert.equal(s.valid, true, `الفحص ${i + 1} أبطل الرابط`);
  }
  const after = await latestLinkRow(EMAIL);
  assert.equal(after!.usedAt, null, 'الفحص وسم الرابط مستعمَلاً');

  // ثم يُستهلك بالتأكيد وحده
  const consumed = await consumeMagicLink(token);
  assert.equal(consumed.ok, true);
  assert.equal(consumed.ok && consumed.tenantId, tenantId);
});

test('الرابط يعمل مرّةً واحدة', async () => {
  await prisma.magicLink.deleteMany({ where: { email: EMAIL } });
  await requestMagicLink(EMAIL);
  const token = await tokenFor((await latestLinkRow(EMAIL))!.id);

  assert.equal((await consumeMagicLink(token)).ok, true);

  const second = await consumeMagicLink(token);
  assert.equal(second.ok, false);
  assert.equal(second.ok === false && second.reason, 'USED');
});

test('ضغطتان متزامنتان تُنتجان جلسةً واحدة لا جلستين', async () => {
  await prisma.magicLink.deleteMany({ where: { email: EMAIL } });
  await requestMagicLink(EMAIL);
  const token = await tokenFor((await latestLinkRow(EMAIL))!.id);

  // التحديث مشروط بـ`usedAt: null` في استعلامٍ واحد، فإحدى المحاولتين
  // تُحدِّث صفراً من الصفوف مهما تقاربتا.
  const [a, b] = await Promise.all([consumeMagicLink(token), consumeMagicLink(token)]);
  const succeeded = [a, b].filter((r) => r.ok).length;
  assert.equal(succeeded, 1, `نجحت ${succeeded} محاولة — الرابط الواحد جلسةٌ واحدة`);
});

test('الرابط المنتهي يُرفض، والمدّة ربع ساعة', async () => {
  assert.equal(MAGIC_TTL_MS, 15 * 60 * 1000);

  await prisma.magicLink.deleteMany({ where: { email: EMAIL } });
  await requestMagicLink(EMAIL);
  const row = await latestLinkRow(EMAIL);
  const token = await tokenFor(row!.id);

  // يُقدَّم تاريخ الانتهاء دقيقةً إلى الوراء
  await prisma.magicLink.update({
    where: { id: row!.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  const state = await inspectMagicLink(token);
  assert.equal(state.valid, false);
  assert.equal(state.valid === false && state.reason, 'EXPIRED');
  assert.equal((await consumeMagicLink(token)).ok, false);
});

test('طلبٌ جديد يُبطل ما سبقه، فلا يبقى رابطان صالحان في علبة البريد', async () => {
  await prisma.magicLink.deleteMany({ where: { email: EMAIL } });

  await requestMagicLink(EMAIL);
  const first = await tokenFor((await latestLinkRow(EMAIL))!.id);

  await requestMagicLink(EMAIL);
  const second = await tokenFor((await latestLinkRow(EMAIL))!.id);
  assert.notEqual(first, second);

  assert.equal((await inspectMagicLink(first)).valid, false, 'الأول بقي صالحاً');
  assert.equal((await inspectMagicLink(second)).valid, true);
});

// ── ما لا يجوز أن يُكشف ──────────────────────────────────────────────────

test('بريدٌ غير مسجَّل لا يُنشئ رابطاً ولا يترك أثراً يميّزه', async () => {
  const out = await requestMagicLink(STRANGER);
  assert.equal(out.sent, false);
  assert.equal(out.sent === false && out.reason, 'UNKNOWN_EMAIL');

  // ولا صفّ يُنشأ له: من يقيس زمن الردّ أو يقرأ الجدول لا يجد ما يفرّق
  const row = await latestLinkRow(STRANGER);
  assert.equal(row, null);
});

test('حسابٌ موقوف لا يُرسل له رابط ولا يُستهلك رابطه القديم', async () => {
  await prisma.magicLink.deleteMany({ where: { email: EMAIL } });
  await requestMagicLink(EMAIL);
  const token = await tokenFor((await latestLinkRow(EMAIL))!.id);

  await withoutTenant('اختبار: إيقاف الحساب', (tx) =>
    tx.user.update({ where: { id: userId }, data: { active: false } }),
  );

  const blocked = await requestMagicLink(EMAIL);
  assert.equal(blocked.sent, false);
  assert.equal(blocked.sent === false && blocked.reason, 'INACTIVE');

  // والرابط الذي صدر قبل الإيقاف لا يفتح الباب
  const consumed = await consumeMagicLink(token);
  assert.equal(consumed.ok, false);
  assert.equal(consumed.ok === false && consumed.reason, 'INACTIVE');

  await withoutTenant('اختبار: إعادة التفعيل', (tx) =>
    tx.user.update({ where: { id: userId }, data: { active: true } }),
  );
});

test('الطلب المتكرّر يُحدّ، فلا تُغرَق علبة بريد أحد', async () => {
  await prisma.magicLink.deleteMany({ where: { email: EMAIL } });

  for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
    const out = await requestMagicLink(EMAIL);
    assert.equal(out.sent, true, `الطلب ${i + 1} رُفض قبل بلوغ الحدّ`);
  }

  const over = await requestMagicLink(EMAIL);
  assert.equal(over.sent, false);
  assert.equal(over.sent === false && over.reason, 'RATE_LIMITED');
});

// ── النظافة ──────────────────────────────────────────────────────────────

test('يُنظَّف المنتهي والمستعمَل ويبقى الصالح', async () => {
  await prisma.magicLink.deleteMany({ where: { email: EMAIL } });

  await requestMagicLink(EMAIL);
  const live = await tokenFor((await latestLinkRow(EMAIL))!.id);

  // رابطٌ منتهٍ مصطنع
  await prisma.magicLink.create({
    data: {
      userId, email: EMAIL,
      tokenHash: createHash('sha256').update('stale').digest('hex'),
      expiresAt: new Date(Date.now() - 3600_000),
    },
  });

  const removed = await purgeExpiredMagicLinks();
  assert.ok(removed >= 1, 'لم يُحذف المنتهي');
  assert.equal((await inspectMagicLink(live)).valid, true, 'حُذف الصالح');
});

/**
 * الرمز لا يُقرأ من القاعدة — التجزئة وحدها هناك. فنعيد بناءه بالطريقة
 * الوحيدة الممكنة في اختبار: نلتقطه من السجلّ الذي طبعه مزوّد `log`.
 */
const printed: string[] = [];
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  printed.push(args.map(String).join(' '));
  originalLog(...args);
};

async function tokenFor(linkId: string): Promise<string> {
  const row = await withoutTenant('اختبار: مطابقة الرمز بتجزئته', (tx) =>
    tx.magicLink.findUniqueOrThrow({ where: { id: linkId } }),
  );

  // نبحث في ما طُبع عن رمزٍ تُطابق تجزئتُه الصفَّ المطلوب
  for (let i = printed.length - 1; i >= 0; i--) {
    for (const m of printed[i].matchAll(/token=([0-9a-f]{64})/g)) {
      if (createHash('sha256').update(m[1]).digest('hex') === row.tokenHash) return m[1];
    }
  }
  throw new Error(`لم يُعثر على رمز الرابط ${linkId} في مخرجات البريد`);
}
