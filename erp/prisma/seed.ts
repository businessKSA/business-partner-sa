/**
 * بيانات تجريبية.
 *
 * ليست «بيانات وهمية»: منشأةٌ تشبه منشأتك — خدمات حكومية للمنشآت — بدورة
 * كاملة من العميل إلى الفاتورة إلى السداد إلى الرواتب. الغاية أن يفتح
 * المستخدم النظام فيجد تقاريره تعمل بأرقام لها معنى، لا شاشاتٍ فارغة
 * يحتاج أسبوعاً ليملأها قبل أن يحكم على النظام.
 */
import './setup-env.ts';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import { hashPassword } from '../src/lib/auth.ts';
import { withoutTenant } from '../src/lib/db.ts';
import { accountByRole, postEntry } from '../src/lib/accounting/posting.ts';
import { createInvoice, postInvoice } from '../src/lib/sales/invoices.ts';
import { createBill, postBill } from '../src/lib/purchasing/bills.ts';
import { createPayment, postPayment } from '../src/lib/treasury/payments.ts';
import { createProject, logTime, approveTimesheets } from '../src/lib/projects/projects.ts';
import { generatePayrollRun, approvePayrollRun, postPayrollRun } from '../src/lib/hr/payroll.ts';
import { postGoodsReceipt, issueStockForInvoice } from '../src/lib/inventory/costing.ts';
import { nextNumber } from '../src/lib/accounting/numbering.ts';

const SLUG = 'business-partner';

/**
 * حساب مالك المنصة.
 *
 * الثابتان أدناه للتطوير المحلي وحده. وحين تُزرع القاعدة في نشرةٍ لها
 * عنوانٌ على الشبكة، تُقرأ القيم من البيئة — لأن كلمة سرٍّ مكتوبة في
 * المستودع تعني أن كل من قرأ المستودع يملك لوحة المنصة، ولوحةُ المنصة
 * تُنشئ منشآت العملاء وتحذفها.
 *
 * ولا افتراضَ صامتاً للسرّ في الإنتاج: `assertSafeSeedCredentials` أدناه
 * يرفض الزرع بالثابت المعروف متى وُجد `VERCEL` أو `SEED_REQUIRE_ENV`.
 */
const ADMIN_EMAIL = process.env.SEED_OWNER_EMAIL?.trim() || 'admin@businesspartner.sa';
const ADMIN_PASSWORD = process.env.SEED_OWNER_PASSWORD?.trim() || 'BP-erp-2026';
const ACCOUNTANT_EMAIL =
  process.env.SEED_ACCOUNTANT_EMAIL?.trim() || 'accountant@businesspartner.sa';

/** يمنع نشر لوحة المنصة بكلمة سرٍّ يعرفها كل من قرأ المستودع. */
function assertSafeSeedCredentials() {
  const managed = process.env.VERCEL || process.env.SEED_REQUIRE_ENV;
  if (!managed) return;

  const missing = !process.env.SEED_OWNER_EMAIL || !process.env.SEED_OWNER_PASSWORD;
  if (missing) {
    throw new Error(
      'الزرع في بيئةٍ منشورة يشترط SEED_OWNER_EMAIL و SEED_OWNER_PASSWORD. ' +
        'الثابت المكتوب في المستودع يفتح لوحة المنصة لكل من قرأه، ' +
        'ولوحةُ المنصة تُنشئ منشآت العملاء وتحذفها.',
    );
  }
  if (process.env.SEED_OWNER_PASSWORD === 'BP-erp-2026') {
    throw new Error('SEED_OWNER_PASSWORD هي كلمة السر المكتوبة في المستودع. غيّرها.');
  }
}

const Y = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(Y, m - 1, dd));

async function main() {
  assertSafeSeedCredentials();
  console.log('▸ حذف البيانات التجريبية السابقة…');
  await purgeTenantBySlug(SLUG);

  console.log('▸ إنشاء المنشأة وشجرة حساباتها…');
  const tenant = await provisionTenant({
    slug: SLUG,
    nameAr: 'شركة بزنس بارتنر للخدمات التجارية',
    nameEn: 'Business Partner Commercial Services',
    crNumber: '1009008634',
    vatNumber: '310887376200003',
    city: 'الرياض',
    district: 'العارض',
    street: 'شارع ريحانة بنت زيد',
    buildingNo: '3153',
    postalCode: '13337',
    email: 'business@businesspartner.sa',
    phone: '0503793356',
  });

  console.log('▸ إنشاء المستخدمين…');
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  await withoutTenant('بذور: إنشاء المستخدمين وربطهم بالمنشأة', async (tx) => {
    const owner = await tx.user.upsert({
      where: { email: ADMIN_EMAIL },
      create: {
        email: ADMIN_EMAIL, name: 'مالك المنشأة',
        passwordHash, platformRole: 'PLATFORM_ADMIN',
      },
      update: { passwordHash, platformRole: 'PLATFORM_ADMIN' },
    });
    const ownerRole = await tx.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: 'OWNER' },
    });
    await tx.membership.create({
      data: { userId: owner.id, tenantId: tenant.id, roleId: ownerRole.id },
    });

    // محاسب بصلاحيات أضيق — ليُرى أثر الأدوار في الواجهة
    const accountant = await tx.user.upsert({
      where: { email: ACCOUNTANT_EMAIL },
      create: { email: ACCOUNTANT_EMAIL, name: 'المحاسب', passwordHash },
      update: { passwordHash },
    });
    const accRole = await tx.role.findFirstOrThrow({
      where: { tenantId: tenant.id, code: 'ACCOUNTANT' },
    });
    await tx.membership.create({
      data: { userId: accountant.id, tenantId: tenant.id, roleId: accRole.id },
    });
  });

  await withTenant(tenant.id, async (tx) => {
    const T = tenant.id;

    console.log('▸ مراكز التكلفة والحسابات البنكية…');
    for (const [code, nameAr, nameEn] of [
      ['ADM', 'الإدارة', 'Administration'],
      ['OPS', 'العمليات', 'Operations'],
      ['SLS', 'المبيعات والتسويق', 'Sales & Marketing'],
    ]) {
      await tx.costCenter.create({ data: { tenantId: T, code, nameAr, nameEn } });
    }

    const bankAcc = await accountByRole(tx, T, 'BANK');
    const bank = await tx.bankAccount.create({
      data: {
        tenantId: T, nameAr: 'مصرف الراجحي — الجاري', nameEn: 'Al Rajhi Current',
        bankName: 'مصرف الراجحي', iban: 'SA0380000000608010167519',
        accountId: bankAcc.id, kind: 'BANK',
      },
    });

    console.log('▸ العملاء والموردون…');

    // العملاء المتعاقدون شهرياً — هذا هو عمود إيراد منشأة خدمات حكومية:
    // اشتراكاتٌ صغيرة متكرّرة، لا صفقاتٌ كبيرة متفرّقة.
    const RETAINERS: [string, string, string | null, number, string][] = [
      ['C-0001', 'مؤسسة الأفق للمقاولات', '311111111101113', 1198, 'الرياض'],
      ['C-0002', 'شركة نماء الطبية', '312222222202224', 1997, 'جدة'],
      ['C-0003', 'مصنع الرواد للبلاستيك', '313333333303335', 2396, 'الدمام'],
      ['C-0005', 'مؤسسة درب الشمال للنقل', '314111111101114', 999, 'حائل'],
      ['C-0006', 'شركة بوابة الخليج التجارية', '314222222202225', 3594, 'الخبر'],
      ['C-0007', 'مطاعم الذواقة', '314333333303336', 1198, 'الرياض'],
      ['C-0008', 'مؤسسة البناء الحديث', '314444444404447', 999, 'بريدة'],
      ['C-0009', 'شركة تقنيات المستقبل', '314555555505558', 2396, 'الرياض'],
      ['C-0010', 'مجموعة الواحة الغذائية', '314666666606669', 4792, 'جدة'],
      ['C-0011', 'مؤسسة الصفوة للصيانة', '314777777707771', 1198, 'الطائف'],
      ['C-0012', 'شركة المسار اللوجستي', '314888888808882', 2995, 'الدمام'],
      ['C-0013', 'عيادات النخبة الطبية', '314999999909993', 1997, 'الرياض'],
      ['C-0014', 'مؤسسة الإتقان للديكور', '315111111101115', 999, 'مكة'],
      ['C-0015', 'شركة الرؤية للاستشارات', '315222222202226', 1997, 'الرياض'],
      ['C-0016', 'مصنع النور للتعبئة', '315333333303337', 3594, 'الأحساء'],
    ];

    const retainerClients = [];
    for (const [code, nameAr, vatNumber, monthly, city] of RETAINERS) {
      const p = await tx.partner.create({
        data: {
          tenantId: T, code, nameAr, isCustomer: true, vatNumber, city,
          paymentTermDays: 30, email: `${code.toLowerCase()}@example.sa`,
        },
      });
      retainerClients.push({ partner: p, monthly });
    }

    // عميل فرد — يوضّح الفاتورة المبسطة والمعرّف البديل
    const walkIn = await tx.partner.create({
      data: {
        tenantId: T, code: 'C-0004', nameAr: 'عبدالرحمن الشمري', isCustomer: true,
        entityKind: 'INDIVIDUAL', otherIdType: 'NAT', otherIdValue: '1054321098',
        city: 'الرياض', phone: '0551234567',
      },
    });

    const vendors = await Promise.all([
      tx.partner.create({ data: {
        tenantId: T, code: 'V-0001', nameAr: 'شركة التقنية المتقدمة للبرمجيات',
        isCustomer: false, isVendor: true, vatNumber: '314444444404446', paymentTermDays: 30,
      }}),
      tx.partner.create({ data: {
        tenantId: T, code: 'V-0002', nameAr: 'مكتب الرياض للمحاماة',
        isCustomer: false, isVendor: true, vatNumber: '315555555505557',
      }}),
      tx.partner.create({ data: {
        tenantId: T, code: 'V-0003', nameAr: 'مؤسسة الإمداد للتوريدات المكتبية',
        isCustomer: false, isVendor: true, vatNumber: '316666666606668',
      }}),
    ]);

    console.log('▸ الأصناف والمخزون…');
    const salesAcc = await accountByRole(tx, T, 'SALES');
    const serviceAcc = await accountByRole(tx, T, 'SERVICE_REVENUE');
    const invAcc = await accountByRole(tx, T, 'INVENTORY');
    const cogsAcc = await accountByRole(tx, T, 'COGS');
    const vat15 = await tx.taxCode.findFirstOrThrow({ where: { tenantId: T, code: 'S15' } });

    const services = await Promise.all([
      tx.item.create({ data: {
        tenantId: T, sku: 'QW-MGMT', nameAr: 'إدارة المنصات الحكومية — اشتراك شهري',
        kind: 'SERVICE', uomCode: 'MON', salesPrice: '999',
        incomeAccountId: serviceAcc.id, taxCodeId: vat15.id,
      }}),
      tx.item.create({ data: {
        tenantId: T, sku: 'MD-ADD', nameAr: 'إضافة مدد — معالجة الرواتب',
        kind: 'SERVICE', uomCode: 'MON', salesPrice: '199',
        incomeAccountId: serviceAcc.id, taxCodeId: vat15.id,
      }}),
      tx.item.create({ data: {
        tenantId: T, sku: 'FI-100', nameAr: 'تأسيس منشأة باستثمار أجنبي',
        kind: 'SERVICE', uomCode: 'PCE', salesPrice: '35000',
        incomeAccountId: serviceAcc.id, taxCodeId: vat15.id,
      }}),
      tx.item.create({ data: {
        tenantId: T, sku: 'CONSULT', nameAr: 'استشارة إدارية — بالساعة',
        kind: 'SERVICE', uomCode: 'HUR', salesPrice: '350',
        incomeAccountId: serviceAcc.id, taxCodeId: vat15.id,
      }}),
    ]);

    const goods = await Promise.all([
      tx.item.create({ data: {
        tenantId: T, sku: 'PRN-001', nameAr: 'طابعة ليزر مكتبية', kind: 'STOCK',
        uomCode: 'PCE', salesPrice: '1800', purchasePrice: '1200', reorderPoint: '3',
        inventoryAccountId: invAcc.id, incomeAccountId: salesAcc.id,
        expenseAccountId: cogsAcc.id, taxCodeId: vat15.id,
      }}),
      tx.item.create({ data: {
        tenantId: T, sku: 'SCN-001', nameAr: 'ماسح ضوئي للمستندات', kind: 'STOCK',
        uomCode: 'PCE', salesPrice: '2400', purchasePrice: '1600', reorderPoint: '2',
        inventoryAccountId: invAcc.id, incomeAccountId: salesAcc.id,
        expenseAccountId: cogsAcc.id, taxCodeId: vat15.id,
      }}),
    ]);

    const warehouse = await tx.warehouse.findFirstOrThrow({ where: { tenantId: T, code: 'MAIN' } });

    console.log('▸ رأس المال الافتتاحي…');
    await postEntry(tx, T, {
      date: day(1, 2),
      memoAr: 'إيداع رأس المال المدفوع',
      sourceType: 'OPENING',
      lines: [
        { accountId: bankAcc.id, debit: 500_000, descAr: 'إيداع بنكي' },
        { accountCode: '3101', credit: 500_000, descAr: 'رأس المال' },
      ],
    });

    console.log('▸ استلام بضاعة…');
    const grnNumber = await nextNumber(tx, T, 'GOODS_RECEIPT', day(1, 20));
    const receipt = await tx.goodsReceipt.create({
      data: {
        tenantId: T, number: grnNumber, partnerId: vendors[2].id,
        warehouseId: warehouse.id, receiptDate: day(1, 20),
        lines: { create: [
          { tenantId: T, itemId: goods[0].id, qty: '24', unitCost: '1200' },
          { tenantId: T, itemId: goods[1].id, qty: '16', unitCost: '1600' },
        ]},
      },
    });
    await postGoodsReceipt(tx, T, receipt.id, ADMIN_EMAIL);

    console.log('▸ الموظفون…');
    const dept = await tx.department.create({
      data: { tenantId: T, code: 'OPS', nameAr: 'العمليات', nameEn: 'Operations' },
    });
    const employees = await Promise.all([
      tx.employee.create({ data: {
        tenantId: T, code: 'EMP-001', nameAr: 'خالد بن عبدالله العتيبي',
        nationality: 'SA', isSaudi: true, nationalId: '1045678901',
        departmentId: dept.id, hireDate: new Date(Date.UTC(Y - 4, 1, 15)),
        contractType: 'UNLIMITED',
        basicSalary: '15000', housingAllowance: '3750', transportAllowance: '1000',
        iban: 'SA1180000000608010167001', email: 'khalid@businesspartner.sa',
      }}),
      tx.employee.create({ data: {
        tenantId: T, code: 'EMP-002', nameAr: 'نورة بنت محمد القحطاني',
        nationality: 'SA', isSaudi: true, nationalId: '1098765432',
        departmentId: dept.id, hireDate: new Date(Date.UTC(Y - 2, 8, 1)),
        contractType: 'UNLIMITED',
        basicSalary: '11000', housingAllowance: '2750', transportAllowance: '800',
        iban: 'SA1180000000608010167002',
      }}),
      tx.employee.create({ data: {
        tenantId: T, code: 'EMP-003', nameAr: 'محمد أشرف حسين',
        nationality: 'EG', isSaudi: false, nationalId: '2456789012',
        departmentId: dept.id, hireDate: new Date(Date.UTC(Y - 1, 3, 10)),
        contractType: 'FIXED', contractEndDate: new Date(Date.UTC(Y + 1, 3, 9)),
        basicSalary: '7500', housingAllowance: '1875', transportAllowance: '500',
        iban: 'SA1180000000608010167003',
      }}),
    ]);

    console.log('▸ المشاريع…');
    const project = await createProject(tx, T, {
      nameAr: 'تأسيس منشأة أجنبية — مؤسسة الأفق',
      partnerId: retainerClients[0].partner.id,
      startDate: day(2, 1),
      budget: 12_000,
      contractValue: 35_000,
      billableByHour: true,
      hourlyRate: 350,
    });
    await tx.project.update({ where: { id: project.id }, data: { status: 'ACTIVE' } });

    for (const [taskTitle, status] of [
      ['جمع مستندات المستثمر وتصديقها', 'DONE'],
      ['تقديم طلب الترخيص لوزارة الاستثمار', 'DONE'],
      ['استخراج السجل التجاري', 'IN_PROGRESS'],
      ['فتح ملف المنشأة في قوى والتأمينات', 'TODO'],
      ['تسجيل المنشأة في الفوترة الإلكترونية', 'TODO'],
    ] as const) {
      await tx.projectTask.create({
        data: {
          tenantId: T, projectId: project.id, title: taskTitle, status,
          assigneeId: employees[0].id, estimatedHours: '8',
          ...(status === 'DONE' ? { completedAt: day(3, 1) } : {}),
        },
      });
    }

    // ── الدورة الشهرية ──────────────────────────────────────────────────
    // كل شهرٍ منقضٍ من السنة يأخذ دورته كاملة: اشتراكات العملاء، ومشروعاً
    // أو اثنين، ومصروفات، ورواتب، وتحصيلاً. هكذا تكون التقارير في أي شهر
    // يفتحه المستخدم مملوءةً بأرقام لها معنى — لا شاشةً فارغة يظنّها عطلاً.
    const today = new Date();
    const lastMonth = today.getUTCFullYear() === Y ? today.getUTCMonth() + 1 : 12;

    console.log(`▸ توليد الدورة الشهرية (${lastMonth} أشهر)…`);

    const openInvoices: { id: string; total: number; month: number }[] = [];

    for (let m = 1; m <= lastMonth; m++) {
      // اشتراكات العملاء الشهرية
      for (const { partner, monthly } of retainerClients) {
        // العميل الواحد يحمل عدّة اشتراكات (منشآت متعدّدة، أو خدمات إضافية):
        // منشأةٌ بثلاثة موظفين تخدم عشرات الملفات لا خمسة عشر.
        const months = (Math.round(monthly / 999) || 1) * 2;
        const inv = await createInvoice(tx, T, {
          partnerId: partner.id,
          issueDate: day(m, 1),
          lines: [{
            itemId: services[0].id,
            descAr: `إدارة المنصات الحكومية — شهر ${m}/${Y}`,
            qty: months, unitPrice: 999, taxCodeId: vat15.id,
          }],
        });
        await postInvoice(tx, T, inv.id, ADMIN_EMAIL);
        openInvoices.push({ id: inv.id, total: Number(inv.total), month: m });
      }

      // مشروع تأسيس شهرياً — وهو الإيراد الأعلى هامشاً
      {
        const client = retainerClients[(m * 3) % retainerClients.length].partner;
        const inv = await createInvoice(tx, T, {
          partnerId: client.id,
          issueDate: day(m, 12),
          projectId: m === 3 ? project.id : null,
          lines: [{
            itemId: services[2].id,
            descAr: 'تأسيس منشأة باستثمار أجنبي — أتعاب',
            qty: 1, unitPrice: 22_000, taxCodeId: vat15.id,
          }],
        });
        await postInvoice(tx, T, inv.id, ADMIN_EMAIL);
        openInvoices.push({ id: inv.id, total: Number(inv.total), month: m });
      }

      // بيع أجهزة كل ثلاثة أشهر — ليتحرّك المخزون وتظهر تكلفة البضاعة
      if (m % 3 === 0) {
        const inv = await createInvoice(tx, T, {
          partnerId: retainerClients[2].partner.id,
          issueDate: day(m, 18),
          lines: [
            { itemId: goods[0].id, descAr: 'طابعة ليزر مكتبية', qty: 2, unitPrice: 1800, taxCodeId: vat15.id },
            { itemId: goods[1].id, descAr: 'ماسح ضوئي للمستندات', qty: 1, unitPrice: 2400, taxCodeId: vat15.id },
          ],
        });
        await postInvoice(tx, T, inv.id, ADMIN_EMAIL);
        await issueStockForInvoice(tx, T, inv.id, warehouse.id, ADMIN_EMAIL);
        openInvoices.push({ id: inv.id, total: Number(inv.total), month: m });
      }

      // فاتورة مبسطة لعميل فرد
      if (m % 2 === 0) {
        const inv = await createInvoice(tx, T, {
          partnerId: walkIn.id, issueDate: day(m, 22), kind: 'SIMPLIFIED',
          lines: [{ itemId: services[3].id, descAr: 'استشارة إدارية', qty: 4, unitPrice: 350, taxCodeId: vat15.id }],
        });
        await postInvoice(tx, T, inv.id, ADMIN_EMAIL);
      }

      // المصروفات التشغيلية الشهرية
      for (const [dd, code, amount, desc] of [
        [3, '5210', 9_000, `إيجار المكتب — شهر ${m}`],
        [7, '5220', 1_400, 'اتصالات وإنترنت'],
        [14, '5215', 850, 'كهرباء ومياه'],
        [21, '5260', 1_100, 'اشتراكات وبرمجيات'],
      ] as const) {
        await postEntry(tx, T, {
          date: day(m, dd),
          memoAr: desc,
          lines: [
            { accountCode: code, debit: amount, descAr: desc },
            { accountId: bankAcc.id, credit: amount, descAr: desc },
          ],
        });
      }

      // مسيّر الرواتب. تاريخ الصرف السابع والعشرون لا آخر الشهر: الاستحقاق
      // يسبق الصرف دائماً، وإلا ظهر حساب «رواتب مستحقة» برصيد مدين — أي
      // أن المنشأة دفعت ما لم يُستحقّ بعد.
      const run = await generatePayrollRun(tx, T, {
        year: Y, month: m, payDate: day(m, 27),
        adjustments: m === 3
          ? [{ employeeId: employees[1].id, absentDays: 2, notes: 'غياب بلا إشعار' }]
          : m === 6
            ? [{ employeeId: employees[0].id, overtimeHours: 12, bonus: 2000, notes: 'مكافأة إنجاز مشروع' }]
            : [],
        createdBy: ADMIN_EMAIL,
      });
      await approvePayrollRun(tx, T, run.id, ADMIN_EMAIL);
      await postPayrollRun(tx, T, run.id, ADMIN_EMAIL);

      // صرف الرواتب من البنك
      const salaryPayable = await accountByRole(tx, T, 'SALARY_PAYABLE');
      await postEntry(tx, T, {
        date: day(m === 12 ? 12 : m, 28),
        memoAr: `صرف رواتب شهر ${m}/${Y}`,
        lines: [
          { accountId: salaryPayable.id, debit: run.totalNet, descAr: 'تحويل رواتب' },
          { accountId: bankAcc.id, credit: run.totalNet, descAr: 'تحويل رواتب' },
        ],
      });
    }

    console.log('▸ التحصيل…');
    // تُحصَّل فواتير الأشهر الماضية إلا آخر شهرين — ليبقى في الذمم
    // رصيدٌ حقيقي وفواتيرُ متأخّرة تظهر على اللوحة.
    for (const inv of openInvoices) {
      if (inv.month > lastMonth - 2) continue;
      const pay = await createPayment(tx, T, {
        direction: 'IN',
        paymentDate: day(Math.min(inv.month + 1, 12), 10),
        amount: inv.total, bankAccountId: bank.id, method: 'TRANSFER',
        ref: `TRF-${inv.month}${String(openInvoices.indexOf(inv)).padStart(3, '0')}`,
        allocations: [{ salesInvoiceId: inv.id, amount: inv.total }],
      });
      await postPayment(tx, T, pay.id, ADMIN_EMAIL);
    }

    console.log('▸ فواتير الموردين وساعات العمل…');
    const bill1 = await createBill(tx, T, {
      partnerId: vendors[0].id, vendorRef: 'ADV-2026-0442', issueDate: day(1, 25),
      lines: [{ descAr: 'اشتراك نظام إدارة المستندات — سنوي', qty: 1, unitPrice: 18_000, taxCodeId: vat15.id }],
    });
    await postBill(tx, T, bill1.id, ADMIN_EMAIL);

    const bill2 = await createBill(tx, T, {
      partnerId: vendors[1].id, vendorRef: 'LAW-889', issueDate: day(2, 20), projectId: project.id,
      lines: [{ descAr: 'أتعاب صياغة عقد التأسيس', qty: 1, unitPrice: 6_000, taxCodeId: vat15.id }],
    });
    await postBill(tx, T, bill2.id, ADMIN_EMAIL);

    const payOut = await createPayment(tx, T, {
      direction: 'OUT', partnerId: vendors[0].id, paymentDate: day(2, 28),
      amount: 20_700, bankAccountId: bank.id, method: 'TRANSFER', ref: 'OUT-1120',
      allocations: [{ vendorBillId: bill1.id, amount: 20_700 }],
    });
    await postPayment(tx, T, payOut.id, ADMIN_EMAIL);

    for (const [d1, hrs, desc] of [
      [day(2, 5), 6, 'مراجعة مستندات المستثمر'],
      [day(2, 8), 7, 'إعداد ملف وزارة الاستثمار'],
      [day(2, 15), 5, 'متابعة الطلب ومراسلات'],
      [day(3, 3), 8, 'استكمال إجراءات السجل التجاري'],
      [day(3, 17), 6, 'مراجعة قانونية مع المكتب'],
    ] as const) {
      await logTime(tx, T, {
        employeeId: employees[0].id, projectId: project.id,
        date: d1 as Date, hours: hrs, descAr: desc,
      });
    }
    const sheets = await tx.timesheet.findMany({ where: { tenantId: T, projectId: project.id } });
    await approveTimesheets(tx, T, sheets.map((s) => s.id), ADMIN_EMAIL);

    // فاتورة مسوّدة — لتظهر في «ما يحتاج إجراءً» على اللوحة
    await createInvoice(tx, T, {
      partnerId: retainerClients[0].partner.id,
      issueDate: day(lastMonth, 25), projectId: project.id,
      lines: [{ descAr: 'تأسيس منشأة أجنبية — الدفعة الثانية', qty: 1, unitPrice: 15_000, taxCodeId: vat15.id }],
    });

    console.log('▸ الإجازات…');
    const annual = await tx.leaveType.findFirstOrThrow({ where: { tenantId: T, code: 'ANNUAL' } });
    await tx.leaveRequest.create({
      data: {
        tenantId: T, employeeId: employees[1].id, leaveTypeId: annual.id,
        startDate: day(Math.min(lastMonth + 1, 12), 1), endDate: day(Math.min(lastMonth + 1, 12), 10),
        days: '10', reason: 'إجازة سنوية', status: 'PENDING',
      },
    });
    await tx.leaveRequest.create({
      data: {
        tenantId: T, employeeId: employees[2].id, leaveTypeId: annual.id,
        startDate: day(4, 5), endDate: day(4, 12), days: '8',
        reason: 'سفر عائلي', status: 'APPROVED',
        approvedBy: ADMIN_EMAIL, approvedAt: day(3, 25),
      },
    });
  }, { timeout: 600_000 });

  console.log('▸ ربط المنشأة بباقة اشتراك…');
  await withoutTenant('بذور: ربط المنشأة التجريبية بباقة', async (tx) => {
    const plan = await tx.plan.findUnique({ where: { code: 'ENTERPRISE' } });
    if (!plan) return; // الباقات تُبذَر بأمر مستقل — غيابها لا يمنع بقية البذور
    await tx.subscription.create({
      data: {
        tenantId: tenant.id, planId: plan.id,
        status: 'ACTIVE', cycle: 'YEARLY',
        currentPeriodEnd: new Date(Date.UTC(Y + 1, 0, 1)),
      },
    });
    await tx.tenant.update({ where: { id: tenant.id }, data: { status: 'ACTIVE' } });
  });

  console.log('\n✓ اكتملت البذور.\n');
  console.log(`  الرابط        http://localhost:3100`);
  console.log(`  البريد        ${ADMIN_EMAIL}`);
  console.log(
    process.env.SEED_OWNER_PASSWORD
      ? '  كلمة المرور   (من متغيّر البيئة SEED_OWNER_PASSWORD)'
      : `  كلمة المرور   ${ADMIN_PASSWORD}`,
  );
  console.log(`  محاسب         accountant@businesspartner.sa (نفس كلمة المرور)\n`);
}

main()
  .catch((e) => {
    console.error('✗ فشلت البذور:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
