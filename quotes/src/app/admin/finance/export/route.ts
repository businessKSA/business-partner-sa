import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { costCenterLabel, expenseCategoryLabel, PAY_METHOD } from '@/lib/finance-enums';

export const dynamic = 'force-dynamic';

/**
 * تصدير الدفتر للمحاسب — CSV لفترة محددة.
 *
 * الملف يبدأ بعلامة ترتيب البايتات (BOM): بدونها يفتح إكسل الملف بترميز
 * النظام فتظهر العربية طلاسم. وهذه أكثر شكوى متكررة عند تسليم ملف لمحاسب.
 *
 * والفاصل فاصلة، والحقول تُقتبس ويُضاعف فيها الاقتباس — فاسم مورّد فيه فاصلة
 * لا يكسر الأعمدة.
 */

const BOM = '﻿';

function csv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return BOM + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: Request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') || 'expenses';
  const now = new Date();
  // الافتراضي: السنة الجارية كاملة
  const from = new Date(url.searchParams.get('from') || `${now.getUTCFullYear()}-01-01`);
  const toRaw = url.searchParams.get('to');
  const to = toRaw ? new Date(toRaw) : new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 });
  }

  let rows: (string | number | null)[][];
  let name: string;

  if (kind === 'revenues') {
    const [entries, invoices] = await Promise.all([
      prisma.revenueEntry.findMany({ where: { date: { gte: from, lt: to } }, orderBy: { date: 'asc' } }),
      prisma.invoice.findMany({
        where: { status: 'PAID', isGovFeeDeposit: false, depositKind: null, paidAt: { gte: from, lt: to } },
        include: { client: true, zatcaRecord: { select: { number: true } } },
        orderBy: { paidAt: 'asc' },
      }),
    ]);
    rows = [[
      'التاريخ', 'المصدر', 'الرقم', 'البيان', 'العميل', 'القسم',
      'غير شامل الضريبة', 'الضريبة', 'الإجمالي', 'الفاتورة الضريبية',
    ]];
    for (const i of invoices) {
      rows.push([
        day(i.paidAt || i.createdAt), 'فاتورة', i.number, i.titleAr,
        i.client.companyAr || i.client.nameAr, costCenterLabel('SALES'),
        i.amountExclVat, i.vatAmount, i.total,
        i.zatcaRecord?.number || i.daftraNumber || '',
      ]);
    }
    for (const r of entries) {
      rows.push([
        day(r.date), 'قيد يدوي', r.number, `${r.source} — ${r.descAr}`, '',
        costCenterLabel(r.costCenter), r.amountExclVat, r.vatAmount, r.total, '',
      ]);
    }
    name = 'revenues';
  } else if (kind === 'tax') {
    const recs = await prisma.zatcaRecord.findMany({
      where: { issueAt: { gte: from, lt: to } },
      orderBy: { icv: 'asc' },
    });
    rows = [[
      'ICV', 'الرقم', 'النوع', 'الصنف', 'المرجع', 'تاريخ الإصدار',
      'المشتري', 'الرقم الضريبي للمشتري', 'غير شامل الضريبة', 'الضريبة',
      'الإجمالي', 'الحالة', 'UUID',
    ]];
    for (const r of recs) {
      rows.push([
        r.icv, r.number,
        r.docType === 'STANDARD' ? 'معيارية' : 'مبسطة',
        r.typeCode === '381' ? 'إشعار دائن' : r.typeCode === '383' ? 'إشعار مدين' : 'فاتورة',
        r.billingRef || '', r.issueAt.toISOString(),
        r.buyerName || '', r.buyerVat || '',
        r.netAmount, r.vatAmount, r.total, r.status, r.uuid,
      ]);
    }
    name = 'tax-documents';
  } else {
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: from, lt: to } },
      orderBy: { date: 'asc' },
    });
    rows = [[
      'التاريخ', 'الرقم', 'القسم', 'التصنيف', 'المورّد',
      'الرقم الضريبي للمورّد', 'البيان', 'غير شامل الضريبة', 'الضريبة',
      'ضريبة قابلة للخصم', 'الإجمالي', 'طريقة الدفع',
    ]];
    for (const e of expenses) {
      rows.push([
        day(e.date), e.number, costCenterLabel(e.costCenter), expenseCategoryLabel(e.category),
        e.vendorName, e.vendorVat || '', e.descAr,
        e.amountExclVat, e.vatAmount,
        // الخصم مشروط بوجود رقم ضريبي للمورّد — يُعرض صريحاً لا محسوباً ذهنياً
        e.vendorVat ? e.vatAmount : 0,
        e.total, PAY_METHOD[e.method] || e.method,
      ]);
    }
    name = 'expenses';
  }

  const file = `bp-${name}-${day(from)}-to-${day(new Date(to.getTime() - 1))}.csv`;
  return new NextResponse(csv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
