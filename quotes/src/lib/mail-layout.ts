/**
 * قالب الرسائل الموحّد — كل ما يصل العميل بالبريد يُبنى من هنا.
 *
 * الرسالة الواحدة تُوصف مرة واحدة ككائن `MailDoc`، ثم تُشتق منه نسختان:
 * نسخة HTML ونسخة نصية. اشتقاقهما من مصدر واحد يمنع أن يقول أحدهما ما
 * لا يقوله الآخر — وهو ما يحدث حين تُكتب النسختان يدوياً.
 *
 * القواعد المفروضة هنا لا تُخالف في أي رسالة:
 *  - لا إيموجي ولا أيقونات ولا رموز تزيينية. الفواصل خطوط لا رموز.
 *  - الأسعار غير شاملة ضريبة القيمة المضافة، والضريبة سطر مستقل.
 *  - الرسوم الحكومية مستثناة دائماً، وتُذكر في كل رسالة فيها مبلغ.
 *  - إجراء واحد ظاهر: زر واحد. ما عداه روابط نصية ثانوية.
 */
import { COMPANY } from '../../config/company';
import { sanitizeClientText } from './content-guard';

const B = COMPANY.brand;
const FONT = "'Tajawal','Segoe UI',Tahoma,Arial,sans-serif";

export interface MailItem {
  name: string;
  /** الكمية — تُحذف من الجدول كله إن لم يكن لأي بند كمية. */
  qty?: string;
  amount: string;
}

export interface MailTotal {
  label: string;
  value: string;
  /** السطر الحاسم (الإجمالي المستحق) — يظهر بخلفية داكنة. */
  emphasis?: boolean;
}

export interface MailRef {
  label: string;
  value: string;
}

/** جدول عام لما ليس بنوداً ومبالغ — أطراف التوقيع مثلاً. */
export interface MailTable {
  heading: string;
  columns: string[];
  rows: string[][];
}

export interface MailDoc {
  /** عنوان الرسالة داخل المتن، لا موضوع البريد. */
  title: string;
  greeting: string;
  /** فقرة واحدة قصيرة. الشرح الطويل مكانه المستند لا الرسالة. */
  intro: string;
  items?: MailItem[];
  itemsHeading?: string;
  totals?: MailTotal[];
  table?: MailTable;
  /** الإجراء الوحيد. */
  cta?: { label: string; url: string };
  /** روابط ثانوية تظهر كسطور نصية تحت الزر. */
  links?: { label: string; url: string }[];
  refs?: MailRef[];
  refsHeading?: string;
  notes?: string[];
  /** توقيع باسم شخص — يُضاف فوق تذييل الشركة. */
  signature?: { name: string; title: string };
  /**
   * ملخّص إنجليزي مختصر لا ترجمة كاملة للرسالة.
   * المستند المرفق ثنائي اللغة بالكامل، فالرسالة لا تكرّره — تكتفي بما
   * يحتاجه مستلم لا يقرأ العربية: ما هذا، وكم، وأين يفتحه.
   */
  enSummary?: { heading: string; rows: MailRef[]; cta?: { label: string; url: string } };
}

/**
 * ينظّف نصوص الرسالة قبل بناء النسختين: إزالة الإيموجي وتوسيع اختصارات
 * الجهات الحكومية. الروابط لا تُمسّ — رمز الوصول قد يحوي حروفاً تطابق
 * اختصاراً فيُكسر الرابط، وهو خطأ أسوأ من الذي نتّقيه.
 */
export function sanitizeMailDoc(doc: MailDoc): MailDoc {
  const t = (s: string) => sanitizeClientText(s, 'ar');
  const e = (s: string) => sanitizeClientText(s, 'en');
  return {
    ...doc,
    title: t(doc.title),
    greeting: t(doc.greeting),
    intro: t(doc.intro),
    itemsHeading: doc.itemsHeading ? t(doc.itemsHeading) : undefined,
    items: doc.items?.map((i) => ({ ...i, name: t(i.name) })),
    totals: doc.totals?.map((x) => ({ ...x, label: t(x.label) })),
    table: doc.table
      ? {
          heading: t(doc.table.heading),
          columns: doc.table.columns.map(t),
          rows: doc.table.rows.map((r) => r.map(t)),
        }
      : undefined,
    cta: doc.cta ? { ...doc.cta, label: t(doc.cta.label) } : undefined,
    links: doc.links?.map((l) => ({ ...l, label: t(l.label) })),
    refsHeading: doc.refsHeading ? t(doc.refsHeading) : undefined,
    refs: doc.refs?.map((r) => ({ label: t(r.label), value: t(r.value) })),
    notes: doc.notes?.map(t),
    enSummary: doc.enSummary
      ? {
          heading: e(doc.enSummary.heading),
          rows: doc.enSummary.rows.map((r) => ({ label: e(r.label), value: e(r.value) })),
          cta: doc.enSummary.cta ? { ...doc.enSummary.cta, label: e(doc.enSummary.cta.label) } : undefined,
        }
      : undefined,
  };
}

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * أرقام المستندات (BP-QT-2026-0184) لاتينية داخل نص عربي، فيقصمها المتصفح
 * عند نهاية السطر ويقلب موضع الشرطة فتُقرأ خطأ. عزلها اتجاهياً ومنع كسرها
 * يُبقيها كما كُتبت. يُطبَّق بعد الترميز لا قبله.
 */
const CODE_RE = /\b[A-Z]{2,}(?:-[A-Za-z0-9]+){1,}\b/g;

function prose(s: string): string {
  return esc(s).replace(
    CODE_RE,
    (m) => `<span dir="ltr" style="white-space:nowrap;unicode-bidi:isolate;">${m}</span>`,
  );
}

/** الروابط المسموح وضعها في href — لا javascript: ولا data:. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

function itemsTable(doc: MailDoc): string {
  const items = doc.items ?? [];
  if (!items.length) return '';
  const withQty = items.some((i) => i.qty);
  const th = `padding:10px 14px;font-size:12px;font-weight:700;color:${B.muted};text-align:right;border-bottom:1px solid ${B.line};`;
  const td = `padding:12px 14px;font-size:14px;color:${B.ink};border-bottom:1px solid ${B.line};`;

  const head =
    `<tr>` +
    `<th style="${th}">${esc(doc.itemsHeading || 'البند')}</th>` +
    (withQty ? `<th style="${th}text-align:center;width:64px;">الكمية</th>` : '') +
    `<th style="${th}text-align:left;width:120px;">المبلغ</th>` +
    `</tr>`;

  let body = '';
  for (const i of items) {
    body +=
      `<tr>` +
      `<td style="${td}">${prose(i.name)}</td>` +
      (withQty ? `<td style="${td}text-align:center;color:${B.muted};">${esc(i.qty || '1')}</td>` : '') +
      `<td style="${td}text-align:left;white-space:nowrap;">${esc(i.amount)}</td>` +
      `</tr>`;
  }

  const span = withQty ? 3 : 2;
  let totals = '';
  const totalRows = doc.totals ?? [];
  totalRows.forEach((t, idx) => {
    // خط أثقل يفصل البنود عن المجاميع، وإلا قُرئ أول مجموع كأنه بند رابع
    const top = idx === 0 && items.length ? `border-top:2px solid ${B.line};` : '';
    if (t.emphasis) {
      totals +=
        `<tr>` +
        `<td colspan="${span - 1}" style="${top}padding:14px;font-size:14px;font-weight:700;color:${B.paper};background:${B.navy};">${prose(t.label)}</td>` +
        `<td style="${top}padding:14px;font-size:15px;font-weight:700;color:${B.paper};background:${B.navy};text-align:left;white-space:nowrap;">${esc(t.value)}</td>` +
        `</tr>`;
    } else {
      totals +=
        `<tr>` +
        `<td colspan="${span - 1}" style="${top}padding:9px 14px;font-size:13px;color:${B.muted};border-bottom:1px solid ${B.line};">${prose(t.label)}</td>` +
        `<td style="${top}padding:9px 14px;font-size:13px;color:${B.ink};border-bottom:1px solid ${B.line};text-align:left;white-space:nowrap;">${esc(t.value)}</td>` +
        `</tr>`;
    }
  });

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="border-collapse:collapse;border:1px solid ${B.line};border-radius:6px;margin:0 0 22px;">` +
    `<thead style="background:${B.wash};">${head}</thead>` +
    `<tbody>${body}${totals}</tbody></table>`
  );
}

function genericTable(doc: MailDoc): string {
  const t = doc.table;
  if (!t || !t.rows.length) return '';
  const th = `padding:10px 14px;font-size:12px;font-weight:700;color:${B.muted};text-align:right;border-bottom:1px solid ${B.line};`;
  const td = `padding:11px 14px;font-size:13px;color:${B.ink};border-bottom:1px solid ${B.line};text-align:right;`;

  let head = '';
  for (const c of t.columns) head += `<th style="${th}">${esc(c)}</th>`;

  let body = '';
  for (const r of t.rows) {
    body += '<tr>';
    r.forEach((cell, i) => {
      // العمود الأول اسم الطرف فيُبرز، وما بعده بيانات تُقرأ من اليسار.
      // العمود الأخير توقيت، وانقسامه على سطرين يفصل «UTC» عن ساعته.
      const last = i === r.length - 1 && r.length > 1;
      const style =
        i === 0
          ? `${td}font-weight:700;`
          : `${td}direction:ltr;text-align:right;color:${B.muted};${last ? 'white-space:nowrap;' : 'word-break:break-word;'}`;
      body += `<td style="${style}">${prose(cell)}</td>`;
    });
    body += '</tr>';
  }

  return (
    `<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:${B.muted};">${esc(t.heading)}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="border-collapse:collapse;border:1px solid ${B.line};border-radius:6px;margin:0 0 22px;">` +
    `<thead style="background:${B.wash};"><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
  );
}

function ctaBlock(doc: MailDoc): string {
  let out = '';
  if (doc.cta) {
    out +=
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">` +
      `<tr><td style="background:${B.navy};border-radius:6px;">` +
      `<a href="${esc(safeUrl(doc.cta.url))}" style="display:block;padding:14px 34px;font-family:${FONT};` +
      `font-size:15px;font-weight:700;color:${B.paper};text-decoration:none;">${esc(doc.cta.label)}</a>` +
      `</td></tr></table>`;
    // بعض برامج البريد تعطّل الأزرار؛ الرابط الصريح يبقى الضمان الأخير
    out +=
      `<p style="margin:0 0 22px;font-size:12px;color:${B.muted};text-align:center;word-break:break-all;">` +
      `${esc(doc.cta.url)}</p>`;
  }
  for (const l of doc.links ?? []) {
    out +=
      `<p style="margin:0 0 8px;font-size:13px;color:${B.ink};text-align:center;">` +
      `${esc(l.label)}: <a href="${esc(safeUrl(l.url))}" style="color:${B.navy};">${esc(l.url)}</a></p>`;
  }
  return out;
}

function refsBlock(doc: MailDoc): string {
  const refs = doc.refs ?? [];
  if (!refs.length) return '';
  let rows = '';
  for (const r of refs) {
    rows +=
      `<tr>` +
      `<td style="padding:5px 0;font-size:13px;color:${B.muted};width:40%;">${esc(r.label)}</td>` +
      `<td style="padding:5px 0;font-size:13px;color:${B.ink};font-weight:700;">${prose(r.value)}</td>` +
      `</tr>`;
  }
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="border-collapse:collapse;background:${B.wash};border-radius:6px;padding:0;margin:0 0 22px;">` +
    `<tr><td style="padding:16px 18px;">` +
    `<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:${B.muted};">` +
    `${esc(doc.refsHeading || 'بيانات المرجع')}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` +
    `</td></tr></table>`
  );
}

function enSummaryBlock(doc: MailDoc): string {
  const en = doc.enSummary;
  if (!en) return '';
  let rows = '';
  for (const r of en.rows) {
    rows +=
      `<tr>` +
      `<td style="padding:5px 0;font-size:13px;color:${B.muted};width:45%;">${esc(r.label)}</td>` +
      `<td style="padding:5px 0;font-size:13px;color:${B.ink};font-weight:700;">${prose(r.value)}</td>` +
      `</tr>`;
  }
  const cta = en.cta
    ? `<p style="margin:12px 0 0;font-size:13px;">` +
      `<a href="${esc(safeUrl(en.cta.url))}" style="color:${B.navy};font-weight:700;">${esc(en.cta.label)}</a></p>`
    : '';
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="ltr" ` +
    `style="border-collapse:collapse;border-top:1px solid ${B.line};margin:24px 0 0;">` +
    `<tr><td style="padding:18px 0 0;text-align:left;font-family:${B.fontEn};">` +
    `<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:${B.muted};">${esc(en.heading)}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` +
    cta +
    `</td></tr></table>`
  );
}

/** يبني نسخة HTML كاملة قائمة بذاتها — أنماط سطرية فقط بلا ملفات خارجية. */
export function renderMailHtml(doc: MailDoc): string {
  let notes = '';
  for (const n of doc.notes ?? []) {
    notes += `<p style="margin:0 0 8px;font-size:12px;line-height:1.8;color:${B.muted};">${prose(n)}</p>`;
  }

  const signature = doc.signature
    ? `<p style="margin:22px 0 0;font-size:14px;line-height:1.9;color:${B.ink};">` +
      `وتفضلوا بقبول فائق الاحترام،<br>` +
      `<span style="font-weight:700;">${esc(doc.signature.name)}</span><br>` +
      `<span style="color:${B.muted};">${esc(doc.signature.title)}</span></p>`
    : '';

  return (
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(doc.title)}</title></head>` +
    `<body style="margin:0;padding:0;background:${B.wash};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="background:${B.wash};padding:24px 12px;font-family:${FONT};" dir="rtl">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="max-width:620px;background:${B.paper};border:1px solid ${B.line};border-radius:8px;overflow:hidden;">` +

    // الترويسة: اسم الشركة نصاً، بلا شعار مصوّر يُحجب في أكثر برامج البريد
    `<tr><td style="background:${B.navy};padding:22px 28px;">` +
    `<p style="margin:0;font-size:17px;font-weight:700;color:${B.paper};">${esc(COMPANY.legalName.ar.split('—')[0].trim())}</p>` +
    `<p style="margin:4px 0 0;font-size:12px;color:#B9C2E8;" dir="ltr">${esc(COMPANY.legalName.en.split('—')[0].trim())}</p>` +
    `</td></tr>` +

    `<tr><td style="padding:28px;">` +
    `<p style="margin:0 0 4px;font-size:19px;font-weight:700;color:${B.navy};">${prose(doc.title)}</p>` +
    `<p style="margin:18px 0 12px;font-size:14px;color:${B.ink};">${prose(doc.greeting)}</p>` +
    `<p style="margin:0 0 22px;font-size:14px;line-height:1.9;color:${B.ink};">${prose(doc.intro)}</p>` +
    itemsTable(doc) +
    genericTable(doc) +
    ctaBlock(doc) +
    refsBlock(doc) +
    notes +
    signature +
    enSummaryBlock(doc) +
    `</td></tr>` +

    `<tr><td style="background:${B.wash};border-top:1px solid ${B.line};padding:18px 28px;">` +
    `<p style="margin:0 0 4px;font-size:12px;color:${B.muted};">` +
    `السجل التجاري ${esc(COMPANY.crNumber)} — الرقم الضريبي ${esc(COMPANY.vatNumber)}</p>` +
    `<p style="margin:0 0 4px;font-size:12px;color:${B.muted};">${esc(COMPANY.address.ar)}</p>` +
    `<p style="margin:0;font-size:12px;color:${B.muted};">` +
    `<span dir="ltr">${esc(COMPANY.phoneDisplay)}</span> — ` +
    `<a href="mailto:${esc(COMPANY.email)}" style="color:${B.navy};">${esc(COMPANY.email)}</a> — ` +
    `<a href="https://${esc(COMPANY.website)}" style="color:${B.navy};">${esc(COMPANY.website)}</a></p>` +
    `</td></tr>` +

    `</table></td></tr></table></body></html>`
  );
}

/** النسخة النصية — مشتقة من الكائن نفسه، فلا تفترق عن نسخة HTML. */
export function renderMailText(doc: MailDoc): string {
  const parts: string[] = [doc.title, '', doc.greeting, '', doc.intro, ''];

  if (doc.items?.length) {
    parts.push(doc.itemsHeading || 'البنود');
    doc.items.forEach((i, n) => {
      const qty = i.qty ? ` — الكمية ${i.qty}` : '';
      parts.push(`${n + 1}. ${i.name}${qty} — ${i.amount}`);
    });
    parts.push('');
  }
  if (doc.totals?.length) {
    for (const t of doc.totals) parts.push(`${t.label}: ${t.value}`);
    parts.push('');
  }
  if (doc.table?.rows.length) {
    parts.push(doc.table.heading);
    for (const r of doc.table.rows) parts.push(r.filter(Boolean).join(' — '));
    parts.push('');
  }
  if (doc.cta) {
    parts.push(`${doc.cta.label}:`, doc.cta.url, '');
  }
  for (const l of doc.links ?? []) parts.push(`${l.label}: ${l.url}`);
  if (doc.links?.length) parts.push('');

  if (doc.refs?.length) {
    parts.push(doc.refsHeading || 'بيانات المرجع');
    for (const r of doc.refs) parts.push(`${r.label}: ${r.value}`);
    parts.push('');
  }
  for (const n of doc.notes ?? []) parts.push(n);
  if (doc.notes?.length) parts.push('');

  if (doc.signature) {
    parts.push('وتفضلوا بقبول فائق الاحترام،', doc.signature.name, doc.signature.title, '');
  }
  if (doc.enSummary) {
    parts.push('—', doc.enSummary.heading);
    for (const r of doc.enSummary.rows) parts.push(`${r.label}: ${r.value}`);
    if (doc.enSummary.cta) parts.push(`${doc.enSummary.cta.label}: ${doc.enSummary.cta.url}`);
    parts.push('');
  }

  parts.push(
    '—',
    COMPANY.legalName.ar,
    `السجل التجاري ${COMPANY.crNumber} — الرقم الضريبي ${COMPANY.vatNumber}`,
    COMPANY.address.ar,
    `${COMPANY.phoneDisplay} — ${COMPANY.email}`,
    COMPANY.website,
  );

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** الملاحظة التي تلزم كل رسالة فيها مبلغ. */
export const NOTE_GOV_FEES =
  'الرسوم الحكومية مستثناة من المبالغ أعلاه، وتُسدَّد للجهات المختصة مباشرة بالتكلفة الفعلية.';

/** ملاحظة المرسل — حتى لا تسقط الرسائل في البريد غير المرغوب فيه. */
export function noteSender(): string {
  const from = process.env.MAIL_FROM || 'no-reply@businesspartner.sa';
  const addr = from.includes('<') ? from.slice(from.indexOf('<') + 1, from.indexOf('>')) : from;
  return `لضمان وصول رسائلنا إليكم، يرجى إضافة العنوان ${addr} إلى قائمة المرسلين الموثوقين لديكم.`;
}

export const SIGNATURE = {
  name: COMPANY.representative.name.ar,
  title: COMPANY.representative.title.ar,
};
