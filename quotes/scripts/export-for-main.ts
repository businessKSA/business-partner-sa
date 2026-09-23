/**
 * تصدير تاريخ لوحة العروض إلى ملف واحد، تمهيداً لطيّها داخل الموقع الرئيسي.
 *
 * قرار المالك (2026-09-16): «bp-quotes يندمج مع الرئيسي وما يستخدم مرة تانية».
 * والخطة في docs/quotes-cutover.md أربع مراحل؛ هذه هي المرحلة ٢.
 *
 * لماذا خطوتان لا واحدة: كتابة سكربت يقرأ من قاعدة اللوحة ويكتب في Supabase
 * الرئيسية تعني أن سرّين يجتمعان في عملية واحدة، وأن خطأً في الخريطة يُفسد
 * قاعدة الإنتاج بلا رجعة. فهذا يقرأ ويكتب ملفاً تراجعه بعينك، و
 * `ops/quotes-import.mjs` يكتبه — وهو جافّ (dry-run) حتى تأمره بغير ذلك.
 *
 * التشغيل:
 *   cd quotes && npm ci && npx prisma generate
 *   npx tsx scripts/export-for-main.ts            # إلى .migrate/quotes-export.json
 *
 * يحتاج DATABASE_URL في quotes/.env.local. لا تلصقه في محادثة.
 *
 * ما لا يُصدَّر عمداً: كلمات المرور والروابط السحرية والجلسات — لا تُنقل
 * أبداً، والعميل يدخل حسابه على الموقع الرئيسي برمز بريد جديد.
 */

import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const prisma = new PrismaClient();

const OUT = resolve(process.cwd(), '.migrate/quotes-export.json');

// خريطة الحالات: حالات اللوحة أدقّ من حالات `requests`، فيُؤخذ أقرب مكافئ
// ولا تُخترع حالة جديدة — جدول `requests` عليه قيد check يرفض ما سواها.
const STATUS: Record<string, string> = {
  DRAFT: 'REVIEWING',
  APPROVED: 'QUOTE_SENT',
  SENT: 'QUOTE_SENT',
  ACCEPTED: 'QUOTE_APPROVED',
  SIGNING: 'CONTRACT_SENT',
  SIGNED: 'SIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  REJECTED: 'CANCELLED',
  EXPIRED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

async function main() {
  const clients = await prisma.client.findMany({
    include: {
      documents: { include: { items: true, invoices: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const requests: any[] = [];
  const links: any[] = [];

  for (const c of clients) {
    for (const d of c.documents) {
      // العقد المولَّد من عرض ليس طلباً ثانياً: هو المرحلة التالية من الطلب
      // نفسه. دمجه هنا يمنع ظهور طلبين للعميل على شيء واحد.
      const isContractOfQuote = d.type === 'CONTRACT' && d.sourceQuoteId;
      if (isContractOfQuote) continue;

      const contract = c.documents.find((x) => x.sourceQuoteId === d.id) || null;
      const inv = (d.invoices || [])[0] || (contract?.invoices || [])[0] || null;

      const items = (d.items || []).map((it: any) => ({
        code: it.serviceCode || it.code || '',
        title: it.titleAr || it.titleEn || '',
        qty: it.qty ?? 1,
        unitPrice: it.unitPrice ?? 0,
        total: it.lineTotal ?? it.total ?? (it.qty ?? 1) * (it.unitPrice ?? 0),
      }));

      const ref = `BP-Q-${d.number}`.slice(0, 64);

      requests.push({
        ref,
        legacy_id: d.id,
        type: 'GOVERNMENT_SERVICE',
        source: 'MANUAL',
        status: STATUS[d.status] || 'REVIEWING',
        lang: 'ar',
        title: d.titleAr || d.titleEn || d.number,
        summary: d.introAr || d.introEn || null,
        client_name: c.nameAr || c.nameEn || null,
        client_email: (c.email || '').toLowerCase() || null,
        client_phone: c.phone || null,
        company_name: c.companyAr || c.companyEn || null,
        scope: items.map((i: any) => ({ code: i.code, title: i.title, qty: i.qty })),
        quote: {
          number: d.number,
          token: d.publicToken,
          status: d.status,
          items,
          net: d.subtotal,
          vat: d.vatAmount,
          total: d.total,
          currency: d.currency,
          valid_until: iso(d.validUntil),
          notes: d.notesAr || d.notesEn || '',
          sent_at: iso(d.sentAt),
          decided_at: iso(d.acceptedAt || d.rejectedAt),
        },
        contract: contract
          ? {
              number: contract.number,
              token: contract.publicToken,
              status: contract.status,
              html: contract.bodyAr || contract.bodyEn || '',
              sent_at: iso(contract.sentAt),
              signed_at: iso(contract.signedAt),
              signature: contract.signedAt
                ? { name: contract.acceptedByName || '', ip: contract.acceptedByIp || '', at: iso(contract.signedAt), mode: 'docusign' }
                : null,
            }
          : null,
        invoice: inv
          ? {
              number: (inv as any).number,
              net: (inv as any).subtotal ?? null,
              vat: (inv as any).vatAmount ?? null,
              total: (inv as any).total ?? null,
              issued_at: iso((inv as any).issuedAt),
              mode: 'legacy',
            }
          : null,
        created_at: iso(d.createdAt),
        updated_at: iso(d.updatedAt),
      });

      // الروابط: هذه هي الغاية كلها. كل `publicToken` أُرسل لعميل يجب أن
      // يبقى قابلاً للفتح بعد حذف اللوحة.
      links.push({ token: d.publicToken, ref, kind: 'QUOTE' });
      if (contract) links.push({ token: contract.publicToken, ref, kind: 'CONTRACT' });
    }
  }

  const out = {
    exportedAt: new Date().toISOString(),
    source: 'bp-quotes',
    counts: { clients: clients.length, requests: requests.length, links: links.length },
    requests,
    links,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log(`✓ ${requests.length} طلباً و${links.length} رابطاً → ${OUT}`);
  console.log('راجع الملف بعينك، ثم: node ops/quotes-import.mjs --file quotes/.migrate/quotes-export.json');
}

main()
  .catch((e) => { console.error('فشل التصدير:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
