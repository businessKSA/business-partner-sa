import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney } from '@/lib/money';
import { priceInclVat } from '@/lib/catalog-sync';
import { methodsForService, PAYMENT_METHODS } from '@/lib/payment-methods';
import { VAT_RATE } from '@config/company';
import FixPrices from './FixPrices';

export const dynamic = 'force-dynamic';

const SITE = (process.env.SITE_URL || 'https://businesspartner.sa').replace(/\/+$/, '');
const NOTION = 'https://www.notion.so/';

/**
 * خريطة الكتالوج — الجرد الكامل في شاشة واحدة.
 *
 * سؤال المالك كان: «هذه الخدمة، أين صفحتها في نوشن، وأين على الموقع، وكم سعرها
 * قبل الضريبة وبعدها، وبأي وسيلة تُسدَّد، وهل يصدر عرضها وحده؟». كانت الإجابة
 * موزّعة على ثلاثة أنظمة؛ هنا صارت صفّاً واحداً لكل خدمة.
 *
 * الفجوات ظاهرة عمداً: خدمة بلا صف في نوشن أو بلا صفحة على الموقع تُعلَّم
 * «ناقص» بدل أن تُترك خانة فارغة تُقرأ كأنها سليمة.
 */
export default async function CatalogMapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; gap?: string }>;
}) {
  await guardAdmin();
  const sp = await searchParams;
  const q = (sp.q || '').trim().toLowerCase();
  const onlyGaps = sp.gap === '1';

  const all = await prisma.service.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
  });

  const rows = all
    .map((s) => {
      const methods = methodsForService(s.paymentMethods);
      const gaps: string[] = [];
      if (!s.notionPageId) gaps.push('نوشن');
      if (!s.siteSlug) gaps.push('الموقع');
      if (!s.openPrice && s.unitPrice <= 0) gaps.push('السعر');
      return {
        s,
        methods,
        gaps,
        autoIssue: s.active && !s.openPrice && s.unitPrice > 0,
      };
    })
    .filter((r) => (onlyGaps ? r.gaps.length > 0 : true))
    .filter((r) =>
      q
        ? [r.s.code, r.s.nameAr, r.s.nameEn, r.s.category].some((f) =>
            String(f || '').toLowerCase().includes(q),
          )
        : true,
    );

  const counts = {
    total: all.length,
    active: all.filter((s) => s.active).length,
    autoIssue: all.filter((s) => s.active && !s.openPrice && s.unitPrice > 0).length,
    openPrice: all.filter((s) => s.openPrice).length,
    notion: all.filter((s) => s.notionPageId).length,
    site: all.filter((s) => s.siteSlug).length,
  };
  // خدمات عليها رقم معلن لكنها ما زالت مفتوحة السعر — بقايا استيراد «يبدأ من».
  const pendingFix = all.filter((s) => s.openPrice && s.unitPrice > 0).length;

  return (
    <>
      <h1>خريطة الكتالوج</h1>
      <p className="sub">
        لكل خدمة: صفحتها في نوشن وعلى الموقع وفي بوابة العميل، وسعرها قبل ضريبة
        القيمة المضافة وبعدها، ووسائل سدادها، وهل يصدر عرضها تلقائياً.
      </p>

      <div className="card">
        <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <span>الخدمات <b>{counts.total}</b></span>
          <span>مفعّلة <b>{counts.active}</b></span>
          <span>تُصدر تلقائياً <b>{counts.autoIssue}</b></span>
          <span>سعر مفتوح <b>{counts.openPrice}</b></span>
          <span>مربوطة بنوشن <b>{counts.notion}</b></span>
          <span>مربوطة بالموقع <b>{counts.site}</b></span>
        </div>
        <form className="row" style={{ marginTop: 12, gap: 10 }}>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="بحث بالكود أو الاسم أو التصنيف" />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" name="gap" value="1" defaultChecked={onlyGaps} style={{ width: 'auto' }} />
            الناقص فقط
          </label>
          <button className="btn" type="submit">عرض</button>
          <a className="btn ghost" href="/api/catalog/full" target="_blank" rel="noreferrer">
            تصدير JSON
          </a>
        </form>
        <FixPrices pending={pendingFix} />
      </div>

      <div className="card">
        <h2>الخدمات ({rows.length})</h2>
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>الخدمة</th>
              <th className="num">قبل الضريبة</th>
              <th className="num">شامل {Math.round(VAT_RATE * 100)}%</th>
              <th>الإصدار</th>
              <th>وسائل السداد</th>
              <th>الروابط</th>
              <th>ناقص</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, methods, gaps, autoIssue }) => (
              <tr key={s.id}>
                <td className="mono">{s.code}</td>
                <td>
                  <div>{s.nameAr}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {s.category}
                    {s.govPlatform ? ` · ${s.govPlatform}` : ''}
                  </div>
                </td>
                <td className="num">{s.openPrice ? '—' : fmtMoney(s.unitPrice)}</td>
                <td className="num">{s.openPrice ? '—' : fmtMoney(priceInclVat(s.unitPrice))}</td>
                <td>
                  <span className={autoIssue ? 'pill st-ACCEPTED' : 'pill st-DRAFT'}>
                    {autoIssue ? 'تلقائي' : s.openPrice ? 'تسعّره أنت' : 'موقوفة'}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>
                  {methods.map((m) => PAYMENT_METHODS[m].ar).join(' · ')}
                </td>
                <td style={{ fontSize: 12 }}>
                  <Link href={`/admin/catalog?edit=${s.id}`}>اللوحة</Link>
                  {' · '}
                  <Link href={`/portal/services?code=${encodeURIComponent(s.code)}`}>البوابة</Link>
                  {s.siteSlug ? (
                    <>
                      {' · '}
                      <a href={`${SITE}${s.siteSlug}`} target="_blank" rel="noreferrer">الموقع</a>
                    </>
                  ) : null}
                  {s.notionPageId ? (
                    <>
                      {' · '}
                      <a
                        href={`${NOTION}${String(s.notionPageId).replace(/-/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        نوشن
                      </a>
                    </>
                  ) : null}
                </td>
                <td style={{ fontSize: 12 }}>
                  {gaps.length ? <span className="pill st-DRAFT">{gaps.join(' · ')}</span> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
