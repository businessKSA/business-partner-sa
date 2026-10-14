// مكتب د. أسامة الرقمي — خادم إثبات المفهوم (POC).
//
// دالة واحدة تخدم رحلة الطلب كاملة لأن `api/` محدود باثنتي عشرة دالة على
// Vercel، وهذه هي الثانية عشرة. الإجراء يأتي في `?action=` بدل أن يأخذ كل
// محطة ملفاً.
//
// ما هو حقيقي هنا وما هو تجريبي — يُقال صراحةً للعميل في الصفحة:
//   حقيقي   : الرقم المرجعي، حساب العرض والضريبة، بصمة التوقيع (HMAC)،
//             ورمز الفاتورة (ZATCA TLV) المولَّد بالمواصفة نفسها.
//   تجريبي  : الأسعار أرقام عيّنة لا أسعار الدكتور، والدفع لا يمسّ بطاقة.
//
// بلا قاعدة بيانات بقصد: الحالة تعيش في متصفح الدكتور، فلا يُكتب شيء في
// جداول الإنتاج، ولا تلزم هجرة قبل العرض.

import crypto from "node:crypto";
import { qrSvg } from "./_qr.js";
import { zatcaQrPayload, sellerProfile } from "./_zatca.js";

const SECRET = process.env.OSAMH_POC_SECRET || process.env.OPS_KEY || "osamh-poc-2026";
const VAT_RATE = 0.15;

// مسارات العرض — أرقام عيّنة للتجربة، لا أسعار الدكتور الحقيقية.
const TRACKS = {
  board: {
    label: "تقييم فاعلية مجلس الإدارة",
    weeks: 8,
    items: [
      { name: "جلسة تأطير مع رئيس المجلس", qty: 1, unit: 6000 },
      { name: "استبانة الأعضاء وتحليلها", qty: 1, unit: 14000 },
      { name: "مقابلات فردية مع الأعضاء", qty: 7, unit: 2500 },
      { name: "تقرير الفاعلية وجلسة العرض", qty: 1, unit: 18000 },
    ],
  },
  legacy: {
    label: "برنامج الإرث القيادي",
    weeks: 18,
    items: [
      { name: "تشخيص الجاهزية القيادية", qty: 1, unit: 12000 },
      { name: "جلسات الإرشاد التنفيذي", qty: 12, unit: 3500 },
      { name: "خطة الخلافة الموثّقة", qty: 1, unit: 22000 },
    ],
  },
  talent: {
    label: "موهبتك — مسار اكتشاف وتطوير",
    weeks: 6,
    items: [
      { name: "قياس الموهبة للمجموعة", qty: 20, unit: 650 },
      { name: "ورشة قراءة النتائج", qty: 2, unit: 7500 },
      { name: "خطط التطوير الفردية", qty: 20, unit: 450 },
    ],
  },
};

const pad = (n, w) => String(n).padStart(w, "0");
const money = (n) => Math.round(n * 100) / 100;
const hmac = (s) => crypto.createHmac("sha256", SECRET).update(String(s)).digest("hex");

// رقم مرجعي مستقرّ: يُشتقّ من الطلب نفسه، فإعادة الإرسال نفسه تعطي الرقم نفسه
// ولا تُنشئ ملفّين لطلب واحد.
function reference(seed) {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
  return `MW-${ymd}-${hmac(seed).slice(0, 5).toUpperCase()}`;
}

function priceTrack(key) {
  const track = TRACKS[key] || TRACKS.board;
  const lines = track.items.map((it) => ({ ...it, total: money(it.qty * it.unit) }));
  const net = money(lines.reduce((s, l) => s + l.total, 0));
  const vat = money(net * VAT_RATE);
  return { key, label: track.label, weeks: track.weeks, lines, net, vat, gross: money(net + vat) };
}

const clean = (v, max = 160) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const action = String((req.query && req.query.action) || "").toLowerCase();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  const body = await readBody(req);

  // ١ — استقبال الطلب
  if (action === "intake") {
    const name = clean(body.name, 80);
    const org = clean(body.org, 120);
    const role = clean(body.role, 80);
    const need = clean(body.need, 600);
    if (!name || !need) return res.status(400).json({ ok: false, error: "الاسم ووصف الحاجة مطلوبان" });
    const ref = reference(`${name}|${org}|${need}`);
    return res.status(200).json({
      ok: true,
      ref,
      receivedAt: new Date().toISOString(),
      summary: {
        who: org ? `${name} — ${role || "جهة الاتصال"} في ${org}` : name,
        need,
      },
      tracks: Object.entries(TRACKS).map(([k, t]) => ({ key: k, label: t.label, weeks: t.weeks })),
    });
  }

  // ٢ — نطاق العمل وعرض السعر
  if (action === "quote") {
    const ref = clean(body.ref, 32);
    if (!ref) return res.status(400).json({ ok: false, error: "الرقم المرجعي مطلوب" });
    const q = priceTrack(clean(body.track, 24));
    const number = `Q-${ref.slice(3)}`;
    return res.status(200).json({
      ok: true, ref, number, issuedAt: new Date().toISOString(),
      validDays: 30, vatRate: VAT_RATE, ...q,
    });
  }

  // ٣ — العقد
  if (action === "contract") {
    const ref = clean(body.ref, 32);
    const number = clean(body.number, 32);
    const client = clean(body.client, 120);
    if (!ref || !number) return res.status(400).json({ ok: false, error: "الطلب والعرض مطلوبان" });
    const q = priceTrack(clean(body.track, 24));
    const terms = [
      `نطاق العمل: ${q.label}، ينفَّذ خلال ${q.weeks} أسابيع من تاريخ التوقيع.`,
      `الأتعاب: ${q.net.toLocaleString("en-US")} ريال قبل الضريبة، و${q.gross.toLocaleString("en-US")} ريال شاملة ضريبة القيمة المضافة.`,
      "الدفعات: 50% عند التوقيع، و50% عند تسليم المخرج النهائي واعتماده.",
      "السرية: كل ما يصل من الطرف الثاني يبقى سرياً، ولا يُنشر اسمه ولا شعاره إلا بموافقة خطية.",
      "الملكية الفكرية: المنهجيات والأدوات تبقى ملكاً للطرف الأول، والمخرجات المسلَّمة ملكاً للطرف الثاني.",
      "الإنهاء: لأي طرف إنهاء التعاقد بإشعار خطي قبل خمسة عشر يوماً، ويُحتسب المنجز حتى تاريخه.",
    ];
    const text = terms.join("\n");
    return res.status(200).json({
      ok: true, ref, quote: number, client,
      number: `C-${ref.slice(3)}`,
      terms,
      hash: hmac(`${ref}|${number}|${text}`).slice(0, 16).toUpperCase(),
    });
  }

  // ٤ — التوقيع: بصمة حقيقية يمكن التحقق منها لاحقاً
  if (action === "sign") {
    const contract = clean(body.contract, 32);
    const hash = clean(body.hash, 64);
    const signer = clean(body.signer, 120);
    if (!contract || !hash || !signer) return res.status(400).json({ ok: false, error: "بيانات التوقيع ناقصة" });
    const at = new Date().toISOString();
    return res.status(200).json({
      ok: true, contract, signer, at,
      stamp: hmac(`${contract}|${hash}|${signer}|${at}`).slice(0, 24).toUpperCase(),
      note: "بصمة التوقيع مشتقّة من نص العقد واسم الموقّع ووقته — أي تعديل لاحق على العقد يُبطلها.",
    });
  }

  // ٥ — الدفع (وضع اختبار، لا بطاقة تُخصم)
  if (action === "pay") {
    const ref = clean(body.ref, 32);
    const amount = Number(body.amount) || 0;
    if (!ref || amount <= 0) return res.status(400).json({ ok: false, error: "الطلب والمبلغ مطلوبان" });
    return res.status(200).json({
      ok: true, ref, amount: money(amount), currency: "SAR",
      mode: "test",
      payId: `TEST-${hmac(`${ref}|${amount}`).slice(0, 10).toUpperCase()}`,
      paidAt: new Date().toISOString(),
      note: "وضع اختبار — لا بطاقة تُخصم ولا مبلغ يتحرك.",
    });
  }

  // ٦ — الفاتورة: رمز ZATCA مولَّد بالمواصفة نفسها
  if (action === "invoice") {
    const ref = clean(body.ref, 32);
    const net = Number(body.net) || 0;
    if (!ref || net <= 0) return res.status(400).json({ ok: false, error: "الطلب والمبلغ مطلوبان" });
    const vat = money(net * VAT_RATE);
    const gross = money(net + vat);
    // البائع هنا هو مكتب الدكتور لا Business Partner. اسم ورقم ضريبي عيّنة
    // بقصد: الفاتورة فاتورته، ورقمه الحقيقي يُسجَّل عند التعاقد لا في عرض.
    // (`sellerProfile` تُقرأ لمعرفة هل بيانات الجهة مكتملة، ولا يُطبع منها شيء.)
    const configured = sellerProfile();
    const seller = {
      name: "مكتب د. أسامة الملا للاستشارات",
      vatNumber: "300000000000003",
      sample: true,
      hostReady: configured.ready,
    };
    const timestamp = new Date().toISOString();
    const payload = zatcaQrPayload({
      sellerName: seller.name,
      vatNumber: seller.vatNumber,
      timestamp, total: gross, vat,
    });
    return res.status(200).json({
      ok: true, ref,
      number: `INV-${ref.slice(3)}`,
      issuedAt: timestamp,
      seller,
      net: money(net), vat, gross, vatRate: VAT_RATE,
      qrSvg: qrSvg(payload, 150),
      note: "الرمز مولَّد بمواصفة هيئة الزكاة والضريبة والجمارك (TLV). بيانات البائع عيّنة حتى تُسجَّل بيانات المكتب.",
    });
  }

  return res.status(400).json({ ok: false, error: "إجراء غير معروف" });
}
