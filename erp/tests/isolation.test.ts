/**
 * العزل بين المنشآت — الاختبار الذي يبرّر بيع النظام.
 *
 * لا يكفي أن نقول «الكود يرشّح بـ tenantId». هنا نكتب عمداً استعلاماتٍ
 * بلا شرط منشأة، ونتوقّع ألّا ترى شيئاً. إن رأت، فالنظام غير صالح للبيع
 * وهذا الاختبار هو الذي يمنع شحنه.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant, withoutTenant, currentTenant } from '../src/lib/db.ts';

async function setup() {
  return withoutTenant('تهيئة بيانات اختبار العزل', async (tx) => {
    await tx.journalLine.deleteMany({ where: { tenantId: { in: ['t_alpha', 't_beta'] } } });
    await tx.journalEntry.deleteMany({ where: { tenantId: { in: ['t_alpha', 't_beta'] } } });
    await tx.account.deleteMany({ where: { tenantId: { in: ['t_alpha', 't_beta'] } } });
    await tx.partner.deleteMany({ where: { tenantId: { in: ['t_alpha', 't_beta'] } } });
    await tx.tenant.deleteMany({ where: { id: { in: ['t_alpha', 't_beta'] } } });

    for (const [id, slug, name] of [
      ['t_alpha', 'alpha-co', 'شركة ألفا'],
      ['t_beta', 'beta-co', 'شركة بيتا'],
    ]) {
      await tx.tenant.create({ data: { id, slug, nameAr: name } });
      await tx.partner.create({
        data: { tenantId: id, code: 'C-001', nameAr: `عميل ${name}` },
      });
    }
  });
}

test('سياق المنشأة يُضبط داخل المعاملة ويُقرأ', async () => {
  await setup();
  const seen = await withTenant('t_alpha', (tx) => currentTenant(tx));
  assert.equal(seen, 't_alpha');
});

test('منشأة لا ترى أطراف منشأة أخرى — حتى بلا شرط ترشيح', async () => {
  await setup();

  const alphaSees = await withTenant('t_alpha', (tx) => tx.partner.findMany());
  assert.equal(alphaSees.length, 1, 'ألفا يجب أن ترى طرفاً واحداً هو طرفها');
  assert.equal(alphaSees[0].tenantId, 't_alpha');

  const betaSees = await withTenant('t_beta', (tx) => tx.partner.findMany());
  assert.equal(betaSees.length, 1);
  assert.equal(betaSees[0].tenantId, 't_beta');
});

test('لا يمكن قراءة صفّ منشأة أخرى ولو عُرف معرّفه', async () => {
  await setup();
  const betaPartner = await withTenant('t_beta', (tx) => tx.partner.findFirstOrThrow());

  // ألفا تعرف المعرّف وتطلبه صراحةً — ويجب أن تعود بلا شيء.
  const stolen = await withTenant('t_alpha', (tx) =>
    tx.partner.findUnique({ where: { id: betaPartner.id } }),
  );
  assert.equal(stolen, null, 'تسريب: ألفا قرأت صفّ بيتا بالمعرّف');
});

test('لا يمكن الكتابة في منشأة أخرى — WITH CHECK يرفض', async () => {
  await setup();
  await assert.rejects(
    () =>
      withTenant('t_alpha', (tx) =>
        tx.partner.create({ data: { tenantId: 't_beta', code: 'X-1', nameAr: 'دخيل' } }),
      ),
    /row-level security|new row violates/i,
    'كتابة عابرة للمنشآت يجب أن تُرفض من القاعدة لا من الكود',
  );
});

test('لا يمكن تعديل صفّ منشأة أخرى', async () => {
  await setup();
  const betaPartner = await withTenant('t_beta', (tx) => tx.partner.findFirstOrThrow());

  const res = await withTenant('t_alpha', (tx) =>
    tx.partner.updateMany({ where: { id: betaPartner.id }, data: { nameAr: 'مُختطف' } }),
  );
  assert.equal(res.count, 0, 'تسريب: ألفا عدّلت صفّ بيتا');

  const after = await withTenant('t_beta', (tx) =>
    tx.partner.findUniqueOrThrow({ where: { id: betaPartner.id } }),
  );
  assert.notEqual(after.nameAr, 'مُختطف');
});

test('لا يمكن حذف صفّ منشأة أخرى', async () => {
  await setup();
  const betaPartner = await withTenant('t_beta', (tx) => tx.partner.findFirstOrThrow());

  const res = await withTenant('t_alpha', (tx) =>
    tx.partner.deleteMany({ where: { id: betaPartner.id } }),
  );
  assert.equal(res.count, 0, 'تسريب: ألفا حذفت صفّ بيتا');

  const still = await withTenant('t_beta', (tx) =>
    tx.partner.findUnique({ where: { id: betaPartner.id } }),
  );
  assert.ok(still, 'صفّ بيتا اختفى بفعل ألفا');
});

test('بلا سياق منشأة: لا صفوف — الإغفال يُغلق لا يفتح', async () => {
  await setup();
  // استعلام مباشر بلا withTenant: `app.tenant_id` غير مضبوط.
  const rows = await prisma.partner.findMany({ where: { code: 'C-001' } });
  assert.equal(rows.length, 0, 'خطر: استعلام بلا سياق منشأة أعاد صفوفاً');
});

test('جدول المنشآت نفسه معزول: ألفا لا ترى سجلّ بيتا', async () => {
  await setup();
  const list = await withTenant('t_alpha', (tx) => tx.tenant.findMany());
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 't_alpha');
});

test('withoutTenant يتخطّى العزل — وهو المنفذ الوحيد', async () => {
  await setup();
  const all = await withoutTenant('اختبار: التحقق من منفذ التجاوز', (tx) =>
    tx.tenant.findMany({ where: { id: { in: ['t_alpha', 't_beta'] } } }),
  );
  assert.equal(all.length, 2);
});

test.after(async () => {
  await withoutTenant('تنظيف بيانات الاختبار', async (tx) => {
    await tx.partner.deleteMany({ where: { tenantId: { in: ['t_alpha', 't_beta'] } } });
    await tx.tenant.deleteMany({ where: { id: { in: ['t_alpha', 't_beta'] } } });
  });
  await prisma.$disconnect();
});
