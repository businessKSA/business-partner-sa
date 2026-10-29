// Business Partner — قواعد حجز «الاتصال المرئي — استشارة مجانية» في مكانٍ واحد.
//
// ملفٌ مساعد ببادئة «_» فلا يستهلك دالة من سقف الاثنتي عشرة. يقرؤه من يحجز
// (`api/book.js`) ومن يعيد الجدولة من بوابة العميل (`api/_simple.js`)، فلا
// يعرف أحدهما ساعاتٍ أو أياماً لا يعرفها الآخر — هذا ما جعل نصّ /my يقول
// «الأحد–الخميس» والخادم يقبل السبت.
//
// القرار (المالك 2026-10-29، عبر بدر): الجلسات يومياً من ١٣:٠٠ (١ ظهراً) إلى ٢١:٠٠ (٩ مساءً)
// بتوقيت الرياض عدا الجمعة، بالفيديو عبر Google Meet، مجانية؛ آخر جلسة تبدأ ٢٠:٣٠.
// (كانت ١٥:٠٠–٢٢:٠٠ بقرار 2026-10-16.) المتغيّرات تتجاوز القيم دون تعديل شيفرة:
//   BOOKING_START      بداية الجلسات: «13» أو «13:30»            (الافتراضي 13:00)
//   BOOKING_END        نهاية آخر جلسة: «21» أو «21:00»           (الافتراضي 21:00)
//   BOOKING_SLOT_MIN   مدة الجلسة بالدقائق                         (الافتراضي 30)
//   BOOKING_DAYS       كم يوماً يُعرض للأمام                       (الافتراضي 21)
//   BOOKING_LEAD_MIN   أقل مهلة بين الآن وبداية الجلسة بالدقائق   (الافتراضي 60)
//   BOOKING_OFF_DAYS   أيام العطلة بأرقام JS (0=الأحد … 5=الجمعة)  (الافتراضي 5)
import crypto from "node:crypto";
import { DEV } from "./_mode.js";

export const TZ = "Asia/Riyadh";
export const TZ_OFFSET = "+03:00";                   // الرياض بلا توقيت صيفي

const pad = (n) => String(n).padStart(2, "0");
export const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// «15» أو «15:30» أو «15.5» ← دقائق من منتصف الليل؛ قيمةٌ فاسدة ← الافتراضي.
function parseClock(v, defMin) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return defMin;
  let m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) { const x = Number(m[1]) * 60 + Number(m[2]); return Number(m[2]) < 60 && x <= 1440 ? x : defMin; }
  if (/^\d{1,2}(\.\d+)?$/.test(s)) { const x = Math.round(Number(s) * 60); return x >= 0 && x <= 1440 ? x : defMin; }
  return defMin;
}
const posInt = (v, d, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };

/** الإعداد الفعلي — يُقرأ عند كل نداء كي لا تحتاج الاختبارات إعادة تحميل الوحدة. */
export function bookingConfig() {
  const fromMin = parseClock(process.env.BOOKING_START, 13 * 60);
  let toMin = parseClock(process.env.BOOKING_END, 21 * 60);
  const slotMin = posInt(process.env.BOOKING_SLOT_MIN, 30, 10, 240);
  if (toMin <= fromMin) toMin = Math.min(1440, fromMin + slotMin);
  const off = String(process.env.BOOKING_OFF_DAYS == null || process.env.BOOKING_OFF_DAYS === "" ? "5" : process.env.BOOKING_OFF_DAYS)
    .split(",").map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
  return {
    fromMin, toMin, slotMin,
    horizon: posInt(process.env.BOOKING_DAYS, 21, 1, 60),
    leadMin: posInt(process.env.BOOKING_LEAD_MIN, 60, 0, 24 * 60),
    offDays: [...new Set(off)],
  };
}

export const iso = (date, time) => `${date}T${time}:00${TZ_OFFSET}`;
/** تاريخ اليوم في الرياض (YYYY-MM-DD) لا في UTC — قبل الثالثة فجراً يختلفان. */
export const riyadhToday = (now = Date.now()) => new Date(now + 3 * 3600e3).toISOString().slice(0, 10);
/** يوم الأسبوع (0=الأحد … 5=الجمعة) لتاريخٍ في الرياض. */
export const dayOfWeek = (date) => new Date(`${date}T12:00:00${TZ_OFFSET}`).getUTCDay();
export const isOffDay = (date) => bookingConfig().offDays.includes(dayOfWeek(date));

/** بدايات الجلسات في اليوم: آخر جلسة تنتهي عند BOOKING_END لا بعده. */
export function slotsOfDay() {
  const c = bookingConfig();
  const out = [];
  for (let m = c.fromMin; m + c.slotMin <= c.toMin; m += c.slotMin) out.push(hhmm(m));
  return out;
}

/** التاريخ حقيقيٌّ في التقويم؟ («2026-02-31» يمرّ من التعبير النمطي وليس يوماً). */
function realDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00${TZ_OFFSET}`);
  return !Number.isNaN(d.getTime()) && new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 10) === date;
}

/**
 * هل (التاريخ، الوقت) موعدٌ يُقبل؟ هذا الفحص يجري في الخادم لا في الصفحة:
 * الواجهة تعرض الفترات الصالحة فقط، لكن أي طلبٍ يُرسَل مباشرةً لا تحرسه الواجهة.
 * @returns {{ok:true,startMs:number,endMs:number}|{ok:false,error:string}}
 *   error ∈ bad_datetime · off_day · out_of_hours · past · too_soon · too_far
 */
export function validateSlot(date, time, now = Date.now()) {
  date = String(date || "").trim(); time = String(time || "").trim();
  if (!realDate(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "bad_datetime" };
  const c = bookingConfig();
  if (c.offDays.includes(dayOfWeek(date))) return { ok: false, error: "off_day" };
  if (!slotsOfDay().includes(time)) return { ok: false, error: "out_of_hours" };
  const startMs = new Date(iso(date, time)).getTime();
  if (startMs <= now) return { ok: false, error: "past" };
  if (startMs < now + c.leadMin * 60000) return { ok: false, error: "too_soon" };
  if (date > riyadhToday(now + c.horizon * 86400000)) return { ok: false, error: "too_far" };
  return { ok: true, startMs, endMs: startMs + c.slotMin * 60000 };
}

const MSG = {
  bad_datetime: { ar: "اختر تاريخاً ووقتاً صحيحين.", en: "Pick a valid date and time." },
  off_day: { ar: "لا جلسات في هذا اليوم. اختر يوماً آخر.", en: "No sessions on this day. Pick another day." },
  out_of_hours: { ar: "هذا الوقت خارج ساعات الجلسات. اختر وقتاً من الأوقات المعروضة.", en: "That time is outside session hours. Pick one of the listed times." },
  past: { ar: "هذا الموعد مضى. اختر وقتاً قادماً.", en: "That time has already passed. Pick a later one." },
  too_soon: { ar: "لا نقبل حجزاً قبل الموعد بأقل من ساعة. اختر وقتاً أبعد.", en: "Bookings need at least one hour of notice. Pick a later time." },
  too_far: { ar: "هذا التاريخ أبعد من المدى المفتوح للحجز.", en: "That date is beyond the booking window." },
  slot_taken: { ar: "حُجزت هذه الفترة قبل قليل. اختر فترة أخرى.", en: "That slot was just taken. Please pick another." },
  invalid_fields: { ar: "أكمل الاسم والجوال والبريد واختر موعداً.", en: "Fill in name, mobile and e-mail, and pick a time." },
  rate_limited: { ar: "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.", en: "Too many attempts. Please wait a little and try again." },
  too_many_active: { ar: "لديك موعدان قادمان بالفعل. ألغِ أحدهما أو انتظر حتى يمضي لتحجز موعداً جديداً.", en: "You already have two upcoming sessions. Cancel one or wait for it to pass before booking another." },
  signin_required: { ar: "هذا البريد أو الجوال مرتبط بحساب مسجّل لدينا. سجّل دخولك أولاً ثم احجز من حسابك — حمايةً لحسابك.", en: "This e-mail or mobile belongs to a registered account. Please sign in first and book from your account." },
  email_mismatch: { ar: "أنت مسجّل الدخول ببريدٍ آخر. استعمل بريد حسابك نفسه في الحجز.", en: "You are signed in with a different e-mail. Use your account e-mail for the booking." },
  not_found: { ar: "لم نجد هذا الحجز.", en: "We could not find this booking." },
  bad_token: { ar: "رابط الإدارة غير صالح أو منتهٍ.", en: "This management link is invalid." },
  same_slot: { ar: "هذا هو موعدك الحالي نفسه. اختر وقتاً مختلفاً.", en: "That is your current time. Pick a different one." },
  already_cancelled: { ar: "هذا الموعد ملغى أصلاً.", en: "This appointment is already cancelled." },
  started: { ar: "بدأ الموعد أو مضى، فلا يُغيَّر من هنا.", en: "This appointment has started or passed and cannot be changed here." },
  server_error: { ar: "تعذّر إتمام الطلب. حاول مرة أخرى أو راسلنا على واتساب.", en: "Could not complete the request. Try again or message us on WhatsApp." },
};
/** رسالة صادقة بلغة الزائر (العربية أو الإنجليزية؛ ما سواهما إنجليزية). */
export const bookingMessage = (code, lang) => { const m = MSG[code] || MSG.server_error; return lang === "ar" || !lang ? m.ar : m.en; };

// ---- رابط تغيير/إلغاء الموعد --------------------------------------------
// الضيف بلا حساب، فالرابط نفسه هو المفتاح: توقيعٌ على (المرجع، البريد) بسرٍّ
// من الخادم. بلا السرّ (OTP_SECRET) لا يُنشأ رابطٌ أصلاً فتُحذف الأزرار من
// البريد بدل أن تُرسَل روابطُ يستطيع أيٌّ أن يخمّنها. محلياً سرٌّ ثابتٌ للتجربة.
const secret = () => String(process.env.OTP_SECRET || "").trim() || (DEV ? "dev-booking-secret" : "");
export function manageToken(ref, email) {
  const s = secret();
  if (!s || !ref || !email) return "";
  return crypto.createHmac("sha256", s).update(`book|${ref}|${String(email).trim().toLowerCase()}`).digest("base64url").slice(0, 32);
}
export function checkManageToken(ref, email, token) {
  const want = manageToken(ref, email);
  const got = String(token || "");
  if (!want || want.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}
