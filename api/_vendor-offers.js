// Business Partner — عروض المورّدين المؤسسيين على الطلبات المجهولة (ESM).
//
// يملكه وكيل `recruitment-agencies`. ملف مساعد يبدأ بـ`_` فلا يُحتسب دالةً (السقف ١٢). لا يستورد من `_agencies.js`
// (لا دورة استيراد): كل نداء Notion يمرّ بدالة `notion` تُحقن من المستدعي، فيُختبر كله بلا شبكة.
//
// ما هو: المورّد المؤسسي (شركة قوى عاملة كبرى) يرد على كل بند من `vendor-demand` بعرض: سعر شهري للعامل الواحد (ريال)،
// العدد المتاح، زمن التجهيز بالأيام، وملاحظة قصيرة. عرض واحد «مقدَّم» فعّال لكل (مورّد، بند) والتحديث يستبدله.
// المخطط الكامل لقاعدة Notion «BP Vendor Offers» في docs/hr-supplier-model.md قسم «مخطط عروض المورّدين».
//
// القواعد الصلبة:
//   ١) يفشل مغلقاً: بلا VENDOR_OFFERS_DB لا قراءة ولا كتابة (offersDbId() يعود "" والمستدعي يردّ not_configured).
//   ٢) كل صف يحمل معرّف المكتب (صفحة سجلّ المكاتب) لا اسمه؛ والقراءة تُعاد فحصها في الكود بعد الفلتر.
//   ٣) ما يخرج للمورّد قائمة بيضاء (mapVendorOffer): لا ملاحظة مالك، لا مكتب محدَّد، لا من يتقاضى الرسم، لا هامش،
//      لا سعر بيعنا، لا العميل. أسماء المهنة تُبنى من تصنيف المهن بمعرّفها لا من نصٍّ مخزَّن.
//   ٤) المورّد لا يضع إلا «مقدَّم» و«مسحوب». «مرسّى» و«مرفوض» يضعهما المالك لاحقاً، ولا يملك المورّد تعديل صفٍّ بهما.

import { occupationById } from "./_occupations.js";

export const OFFERS_DB_ENV = "VENDOR_OFFERS_DB";

// معرّف القاعدة من البيئة وقت النداء (لا عند تحميل الوحدة). فارغ ⇒ غير مهيّأ ⇒ لا كتابة ولا قراءة.
export function offersDbId(env = process.env) {
  const v = env && env[OFFERS_DB_ENV];
  return typeof v === "string" && /^[0-9a-f-]{32,36}$/i.test(v.trim()) ? v.trim() : "";
}

// حدود الأرقام (ريال/شهر للعامل، عدد، أيام، طول الملاحظة).
export const OFFER_LIMITS = Object.freeze({ priceMax: 100000, availableMax: 5000, prepDaysMax: 365, noteMax: 300 });

// أسماء أعمدة القاعدة — مصدر واحد للكود والمستند والاختبار.
export const OFFER_PROPS = Object.freeze({
  key: "مفتاح العرض",                  // title
  office: "معرّف المكتب",               // rich_text — معرّف صفحة المورّد في سجلّ المكاتب (ثابت)، لا اسمه
  ref: "رقم الطلب",                    // rich_text
  item: "معرّف البند",                 // rich_text — itemId من vendor-demand
  occupationId: "معرّف المهنة",         // rich_text
  occupation: "المهنة",                // rich_text — للقراءة البشرية في Notion فقط
  requested: "العدد المطلوب",          // number — لقطة وقت التقديم
  price: "سعر الشهر للعامل",           // number — ريال
  available: "العدد المتاح",           // number
  prepDays: "زمن التجهيز (أيام)",      // number
  note: "ملاحظة المورّد",              // rich_text
  status: "الحالة",                    // select
  updated: "آخر تحديث",                // date
  // أعمدة يملؤها المالك لاحقاً — لا يكتبها المورّد ولا يقرؤها هذا الملف في أي ناتج للمورّد.
  awardedCount: "العدد المرسّى",        // number
  ownerNote: "ملاحظة المالك",          // rich_text
  designatedOffice: "المكتب المحدَّد",  // rich_text — معرّف مكتب (الحالة ب)، لا اسمه
  feePayer: "من يتقاضى رسم المكتب",    // select: BP | المورّد
});

export const OFFER_STATUS = Object.freeze({ submitted: "مقدَّم", withdrawn: "مسحوب", awarded: "مرسّى", rejected: "مرفوض" });
const CODE_BY_STATUS = new Map(Object.entries(OFFER_STATUS).map(([code, ar]) => [ar, code]));

const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
const rt = (v) => (v ? [{ text: { content: String(v).slice(0, 1900) } }] : []);
const normId = (v) => String(v == null ? "" : v).replace(/-/g, "").toLowerCase();
const ITEM_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,60}$/;
const PAGE_ID_RE = /^[0-9a-f-]{32,36}$/i;

function plain(p) {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("");
  if (p.type === "select") return p.select ? p.select.name : "";
  return "";
}
const num = (p) => (p && p.type === "number" && typeof p.number === "number" ? p.number : null);

// ٠-٩ و۰-۹ ← 0-9، والفاصلة العشرية العربية (٫) ← نقطة، وفاصلة الآلاف تُحذف.
function asciiDigits(s) {
  return String(s).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".").replace(/[\s,،٬]/g, "");
}

export function isItemId(v) { return typeof v === "string" && ITEM_RE.test(v); }
export function isPageId(v) { return typeof v === "string" && PAGE_ID_RE.test(v); }

// مدخل المورّد (غير موثوق) → قيم نظيفة أو { ok:false, error, field }. لا يُقبل نوعٌ غير رقم/نص.
export function parseOfferInput(b) {
  const o = b && typeof b === "object" ? b : {};
  const scalar = (v) => (typeof v === "number" && Number.isFinite(v)) || typeof v === "string";

  if (!scalar(o.price)) return { ok: false, error: "invalid_price", field: "price" };
  const ps = asciiDigits(o.price);
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(ps)) return { ok: false, error: "invalid_price", field: "price" };
  const price = Math.round(Number(ps) * 100) / 100;
  if (!(price > 0) || price > OFFER_LIMITS.priceMax) return { ok: false, error: "invalid_price", field: "price" };

  if (!scalar(o.available)) return { ok: false, error: "invalid_available", field: "available" };
  const as = asciiDigits(o.available);
  if (!/^\d{1,5}$/.test(as)) return { ok: false, error: "invalid_available", field: "available" };
  const available = Number(as);
  if (available < 1 || available > OFFER_LIMITS.availableMax) return { ok: false, error: "invalid_available", field: "available" };

  if (!scalar(o.prepDays)) return { ok: false, error: "invalid_prep_days", field: "prepDays" };
  const ds = asciiDigits(o.prepDays);
  if (!/^\d{1,3}$/.test(ds)) return { ok: false, error: "invalid_prep_days", field: "prepDays" };
  const prepDays = Number(ds);
  if (prepDays > OFFER_LIMITS.prepDaysMax) return { ok: false, error: "invalid_prep_days", field: "prepDays" };

  let note = "";
  if (o.note !== undefined && o.note !== null && o.note !== "") {
    if (typeof o.note !== "string") return { ok: false, error: "invalid_note", field: "note" };
    note = o.note.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
    if (note.length > OFFER_LIMITS.noteMax) return { ok: false, error: "invalid_note", field: "note" };
  }
  return { ok: true, value: { price, available, prepDays, note } };
}

// خصائص الصفّ عند الإنشاء. `item` من vendor-demand (ref/itemId/occupationId/nameAr/count)، `agency.id` معرّف المكتب.
export function offerProps(agency, item, value, now = new Date()) {
  return {
    [OFFER_PROPS.key]: { title: [{ text: { content: `${item.itemId} · ${normId(agency.id).slice(0, 8)}` } }] },
    [OFFER_PROPS.office]: { rich_text: rt(agency.id) },
    [OFFER_PROPS.ref]: { rich_text: rt(item.ref) },
    [OFFER_PROPS.item]: { rich_text: rt(item.itemId) },
    [OFFER_PROPS.occupationId]: { rich_text: rt(item.occupationId) },
    [OFFER_PROPS.occupation]: { rich_text: rt(item.nameAr) },
    [OFFER_PROPS.requested]: { number: Number.isInteger(item.count) ? item.count : null },
    ...valueProps(value, now),
  };
}

// ما يتغير عند التحديث: القيم والحالة وتاريخ التعديل. المفتاح والمعرّفات لا تُلمس.
function valueProps(value, now = new Date()) {
  return {
    [OFFER_PROPS.price]: { number: value.price },
    [OFFER_PROPS.available]: { number: value.available },
    [OFFER_PROPS.prepDays]: { number: value.prepDays },
    [OFFER_PROPS.note]: { rich_text: rt(value.note) },
    [OFFER_PROPS.status]: { select: { name: OFFER_STATUS.submitted } },
    [OFFER_PROPS.updated]: { date: { start: now.toISOString() } },
  };
}

// ما يراه المورّد من عرضه: قائمة بيضاء حقلاً حقلاً. لا يمرّ شيء آخر من الصفّ.
export const VENDOR_OFFER_FIELDS = Object.freeze(["id", "ref", "itemId", "occupationId", "nameAr", "nameEn", "count", "price", "available", "prepDays", "note", "status", "submitted", "updated"]);
export function mapVendorOffer(pg) {
  const p = (pg && pg.properties) || {};
  const occId = clip(plain(p[OFFER_PROPS.occupationId]), 60);
  const occ = occupationById(occId);
  const upd = p[OFFER_PROPS.updated] && p[OFFER_PROPS.updated].date ? p[OFFER_PROPS.updated].date.start : "";
  return {
    id: pg.id,
    ref: clip(plain(p[OFFER_PROPS.ref]), 60),
    itemId: clip(plain(p[OFFER_PROPS.item]), 70),
    occupationId: occ ? occ.id : "",
    nameAr: occ ? occ.nameAr : "",
    nameEn: occ ? occ.nameEn : "",
    count: num(p[OFFER_PROPS.requested]),
    price: num(p[OFFER_PROPS.price]),
    available: num(p[OFFER_PROPS.available]),
    prepDays: num(p[OFFER_PROPS.prepDays]),
    note: clip(plain(p[OFFER_PROPS.note]), OFFER_LIMITS.noteMax),
    status: CODE_BY_STATUS.get(plain(p[OFFER_PROPS.status])) || "",
    submitted: (pg && pg.created_time) || "",
    updated: upd || "",
  };
}

const statusOf = (pg) => CODE_BY_STATUS.get(plain(((pg && pg.properties) || {})[OFFER_PROPS.status])) || "";
const ownedBy = (pg, agency) => !!agency && !!agency.id && normId(plain(((pg && pg.properties) || {})[OFFER_PROPS.office])) === normId(agency.id);
const itemOf = (pg) => plain(((pg && pg.properties) || {})[OFFER_PROPS.item]);
const newest = (a, b) => (String(b.created_time || "") > String(a.created_time || "") ? 1 : String(b.created_time || "") < String(a.created_time || "") ? -1 : String(b.id) > String(a.id) ? 1 : -1);

// صفوف هذا المورّد لهذا البند، بعد إعادة التحقق في الكود (الفلتر وحده لا يُعتمد).
async function rowsForItem(notion, dbId, agency, itemId) {
  const r = await notion(`databases/${dbId}/query`, "POST", {
    page_size: 50,
    filter: { and: [
      { property: OFFER_PROPS.office, rich_text: { equals: agency.id } },
      { property: OFFER_PROPS.item, rich_text: { equals: itemId } },
    ] },
  });
  if (!r.ok) return { ok: false };
  const rows = (((r.json || {}).results) || []).filter((pg) => ownedBy(pg, agency) && itemOf(pg) === itemId);
  return { ok: true, rows };
}

const withdrawProps = (now) => ({ [OFFER_PROPS.status]: { select: { name: OFFER_STATUS.withdrawn } }, [OFFER_PROPS.updated]: { date: { start: now.toISOString() } } });

// عرض واحد «مقدَّم» لكل (مورّد، بند): الجديد يستبدل الفعّال، وما زاد (سباق طلبين متزامنين) يُسحب.
// → { ok:true, offer, replaced } | { ok:false, status, error }
export async function submitOffer({ notion, dbId, agency, item, value, now = new Date() }) {
  if (!dbId) return { ok: false, status: 503, error: "not_configured" };
  const found = await rowsForItem(notion, dbId, agency, item.itemId);
  if (!found.ok) return { ok: false, status: 502, error: "notion_failed" };
  if (found.rows.some((pg) => statusOf(pg) === "awarded")) return { ok: false, status: 409, error: "already_awarded" };

  const active = found.rows.filter((pg) => statusOf(pg) === "submitted").sort(newest);
  let kept = null, replaced = false;
  if (active.length) {
    const r = await notion(`pages/${active[0].id}`, "PATCH", { properties: valueProps(value, now) });
    if (!r.ok) return { ok: false, status: 502, error: "notion_failed" };
    kept = r.json || active[0]; replaced = true;
    for (const extra of active.slice(1)) await notion(`pages/${extra.id}`, "PATCH", { properties: withdrawProps(now) });
  } else {
    const r = await notion("pages", "POST", { parent: { database_id: dbId }, properties: offerProps(agency, item, value, now) });
    if (!r.ok) return { ok: false, status: 502, error: "notion_failed" };
    kept = r.json;
    // سباق: طلبان متزامنان بلا صفٍّ فعّال أنشآ صفّين؛ نُبقي الأحدث ونسحب الباقي.
    const again = await rowsForItem(notion, dbId, agency, item.itemId);
    if (again.ok) {
      const live = again.rows.filter((pg) => statusOf(pg) === "submitted").sort(newest);
      if (live.length > 1) {
        for (const extra of live.slice(1)) await notion(`pages/${extra.id}`, "PATCH", { properties: withdrawProps(now) });
        if (live[0].id !== (kept && kept.id)) kept = live[0];
      }
    }
  }
  if (!kept || !kept.id) return { ok: false, status: 502, error: "notion_failed" };
  return { ok: true, offer: mapVendorOffer(kept), replaced };
}

// سحب عرض. غير الموجود وغير المملوك وغير القادم من هذه القاعدة كلّها «not_found» بلا تمييز (لا تعداد لمعرّفات).
export async function withdrawOffer({ notion, dbId, agency, offerId, now = new Date() }) {
  if (!dbId) return { ok: false, status: 503, error: "not_configured" };
  if (!isPageId(offerId)) return { ok: false, status: 400, error: "invalid_offer" };
  const g = await notion(`pages/${encodeURIComponent(offerId)}`, "GET");
  if (!g.ok) return g.status === 404 ? { ok: false, status: 404, error: "not_found" } : { ok: false, status: 502, error: "notion_failed" };
  const pg = g.json || {};
  const parent = pg.parent && pg.parent.database_id;
  if (!parent || normId(parent) !== normId(dbId) || pg.archived || pg.in_trash || !ownedBy(pg, agency)) return { ok: false, status: 404, error: "not_found" };
  const st = statusOf(pg);
  if (st === "withdrawn") return { ok: true, offer: mapVendorOffer(pg), already: true };
  if (st !== "submitted") return { ok: false, status: 409, error: "offer_locked" };
  const r = await notion(`pages/${encodeURIComponent(offerId)}`, "PATCH", { properties: withdrawProps(now) });
  if (!r.ok) return { ok: false, status: 502, error: "notion_failed" };
  const after = r.json && r.json.id ? r.json : { ...pg, properties: { ...pg.properties, [OFFER_PROPS.status]: { type: "select", select: { name: OFFER_STATUS.withdrawn } } } };
  return { ok: true, offer: mapVendorOffer(after) };
}

// كل عروض هذا المورّد وحده (بمعرّف المكتب)، الأحدث تعديلاً أولاً.
export async function listOffers({ notion, dbId, agency }) {
  if (!dbId) return { ok: false, status: 503, error: "not_configured" };
  const r = await notion(`databases/${dbId}/query`, "POST", {
    page_size: 100,
    filter: { property: OFFER_PROPS.office, rich_text: { equals: agency.id } },
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
  });
  if (!r.ok) return { ok: false, status: 502, error: "notion_failed" };
  const rows = (((r.json || {}).results) || []).filter((pg) => ownedBy(pg, agency));
  return { ok: true, offers: rows.map(mapVendorOffer), more: !!(r.json && r.json.has_more) };
}
