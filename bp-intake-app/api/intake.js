// دالة serverless: النموذج → Claude (استخراج وإعادة صياغة) → Notion (إنشاء سجل)
// تُظهر الخطأ الحقيقي في كل مرحلة بدل الفشل الصامت.
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@notionhq/client';

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
const NOTION_VERSION = '2022-06-28';
const MAX_BLOCK_CHARS = 1900; // حد Notion لكل نص هو 2000

const SYSTEM = `أنت محلل سير ذاتية محترف لصالح "شريك الأعمال".
حوّل مدخلات المرشح (نص حر و/أو سيرة ذاتية مرفقة) إلى JSON صالح فقط، بدون أي شرح أو نص إضافي خارج الـ JSON.
المفاتيح المطلوبة: name, email, phone, cities, target_titles (مصفوفة), salary, level (واحدة من: "مبتدئ" أو "متوسط" أو "خبير"), summary, skills (مصفوفة), achievements (مصفوفة), experience (مصفوفة من كائنات {title, org, period, points: مصفوفة}), education, languages (مصفوفة).
قواعد صارمة:
- لا تختلق أي مهارة أو خبرة أو إنجاز غير وارد في المدخلات. يُسمح فقط بإعادة الصياغة وتقوية عرض المعلومات الحقيقية.
- لا تستخرج ولا تُدرج أرقام الهوية الوطنية أو الإقامة أو أي أرقام تعريف حكومية إطلاقاً.
- إن لم تتوفر معلومة اتركها فارغة ("" أو []).
أعد JSON فقط.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, stage: 'method', error: 'الطريقة غير مسموحة — استخدم POST.' });
  }

  const b = (req.body && typeof req.body === 'object') ? req.body : safeParse(req.body);

  // قاعدة ثابتة: موافقة PDPL قبل أي تقديم نيابةً
  if (b.consent !== true) {
    return res.status(400).json({ ok: false, stage: 'validation', error: 'الموافقة على التقديم نيابةً (PDPL) مطلوبة قبل المتابعة.' });
  }

  const story = (b.story || '').toString().trim();
  const cv = b.cv; // { data: base64, media_type, filename }
  if (!story && !(cv && cv.data)) {
    return res.status(400).json({ ok: false, stage: 'validation', error: 'يرجى كتابة قصتك المهنية أو إرفاق سيرة ذاتية (PDF).' });
  }

  for (const k of ['ANTHROPIC_API_KEY', 'NOTION_TOKEN', 'NOTION_DATABASE_ID']) {
    if (!process.env[k]) {
      return res.status(500).json({ ok: false, stage: 'config', error: `متغيّر البيئة ${k} غير مضبوط في إعدادات Vercel.` });
    }
  }

  // 1) Claude — استخراج وإعادة صياغة (يقرأ الـ PDF مباشرة حتى الممسوح ضوئياً)
  let parsed;
  try {
    const anthropic = new Anthropic(); // يقرأ ANTHROPIC_API_KEY من البيئة
    const content = [];
    if (cv && cv.data) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: cv.media_type || 'application/pdf', data: cv.data },
      });
    }
    content.push({ type: 'text', text: story || 'استخرج الملف المهني من السيرة الذاتية المرفقة.' });

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });

    if (msg.stop_reason === 'refusal') {
      return res.status(422).json({ ok: false, stage: 'claude', error: 'رفض النموذج معالجة هذا المحتوى.' });
    }

    const rawText = (msg.content.find((x) => x.type === 'text') || {}).text || '{}';
    parsed = parseJson(rawText);
  } catch (e) {
    return res.status(502).json({ ok: false, stage: 'claude', error: describeError(e) });
  }

  // 2) Notion — إنشاء سجل المرشح
  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN, notionVersion: NOTION_VERSION });
    const page = await notion.pages.create(buildPage(process.env.NOTION_DATABASE_ID, b, parsed));
    return res.status(200).json({ ok: true, profile: parsed, notionUrl: page.url, id: page.id });
  } catch (e) {
    // الملف استُخرج بنجاح لكن فشل الحفظ — نُعيد الاثنين معاً
    return res.status(502).json({ ok: false, stage: 'notion', error: describeError(e), profile: parsed });
  }
}

// ---------- مساعدات ----------

function safeParse(v) {
  if (!v) return {};
  try { return JSON.parse(v.toString()); } catch { return {}; }
}

function parseJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) {
      try { return JSON.parse(cleaned.slice(s, e + 1)); } catch { /* fallthrough */ }
    }
    return {};
  }
}

function describeError(e) {
  // أخطاء SDK لـ Anthropic/Notion تحمل status و message مفيدة
  const status = e && (e.status || e.statusCode);
  const apiMsg =
    (e && e.error && e.error.error && e.error.error.message) || // Anthropic
    (e && e.body && e.body.message) ||                          // Notion
    (e && e.message) ||
    'خطأ غير معروف';
  return status ? `[${status}] ${apiMsg}` : apiMsg;
}

function rt(s) {
  return { rich_text: [{ text: { content: (s || '').toString().slice(0, MAX_BLOCK_CHARS) } }] };
}

function buildPage(databaseId, b, parsed) {
  const p = parsed || {};
  const today = new Date().toISOString().slice(0, 10);
  const level = ['مبتدئ', 'متوسط', 'خبير'].includes(p.level) ? p.level : null;

  const props = {
    'الاسم': { title: [{ text: { content: (b.name || p.name || 'بدون اسم').toString().slice(0, 200) } }] },
    'البريد': { email: (b.email || p.email || '') || null },
    'الجوال': { phone_number: (b.phone || p.phone || '') || null },
    'المدن': rt(b.cities || p.cities),
    'المسميات المستهدفة': rt(Array.isArray(p.target_titles) ? p.target_titles.join(' · ') : (p.target_titles || '')),
    'نطاق الراتب': rt(b.salary || p.salary),
    'الكلمات المفتاحية': rt(Array.isArray(p.skills) ? p.skills.join(', ') : (p.skills || '')),
    'لينكدإن': { url: (b.linkedin || '') || null },
    'الحالة': { select: { name: 'نشط' } },
    'موافقة على التقديم نيابةً': { checkbox: b.consent === true },
    'تاريخ الموافقة': { date: { start: today } },
  };
  if (level) props['المستوى'] = { select: { name: level } };

  // إزالة الخصائص الفارغة التي قد ترفضها Notion
  if (!props['البريد'].email) delete props['البريد'];
  if (!props['الجوال'].phone_number) delete props['الجوال'];
  if (!props['لينكدإن'].url) delete props['لينكدإن'];

  const children = [];
  const h2 = (t) => children.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ text: { content: t } }] } });
  const para = (t) => {
    const s = (t || '').toString();
    for (let i = 0; i < s.length; i += MAX_BLOCK_CHARS) {
      children.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: s.slice(i, i + MAX_BLOCK_CHARS) } }] } });
    }
  };

  if (p.summary) { h2('الملخص المهني'); para(p.summary); }
  if (Array.isArray(p.skills) && p.skills.length) { h2('المهارات'); para(p.skills.join(' · ')); }
  if (Array.isArray(p.achievements) && p.achievements.length) { h2('أبرز الإنجازات'); for (const a of p.achievements) para('• ' + a); }
  if (Array.isArray(p.experience) && p.experience.length) {
    h2('الخبرات');
    for (const e of p.experience) {
      para([e.title, e.org, e.period].filter(Boolean).join(' — '));
      for (const pt of (e.points || [])) para('• ' + pt);
    }
  }
  if (p.education) { h2('التعليم'); para(p.education); }
  if (p.languages) { h2('اللغات'); para(Array.isArray(p.languages) ? p.languages.join('، ') : p.languages); }

  return {
    parent: { database_id: databaseId },
    properties: props,
    children: children.slice(0, 100), // حد Notion لكل طلب إنشاء
  };
}
