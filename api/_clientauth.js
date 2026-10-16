// Business Partner — small pure helpers for client sign-in (api/otp.js).
//
// Underscore-prefixed: a shared module, not a 13th serverless function. Nothing
// here touches the network or the database, which is what lets the tests drive
// every rule directly instead of through a handler.

/* --- password strength ------------------------------------------------------
 * A floor, not a policy engine. The password is only ever a second door to a
 * session that an emailed code already proved (api/otp.js), so what matters is
 * that it is not the first thing anyone would try. Rules, in the order they
 * are reported:
 *   short          fewer than 8 characters
 *   long           more than 128 (scrypt is deliberately slow; an unbounded
 *                  input is a way to burn the function's time)
 *   no_letter / no_digit   needs both a letter (any script) and a digit
 *   repetitive     fewer than 4 distinct characters ("aaaa1111")
 *   common         one of the passwords everybody tries first
 *   has_email      contains the part of the address before the @
 * The reason is a code, never prose: the page words it in four languages.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "11111111", "00000000", "87654321", "12341234",
  "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword1",
  "qwerty123", "qwertyui", "qwertyuiop", "1q2w3e4r", "1qaz2wsx", "abc12345", "abcd1234", "abcdefg1",
  "iloveyou", "welcome1", "welcome123", "admin123", "admin1234", "letmein1", "changeme1",
  "saudi123", "saudi1234", "riyadh123", "mohammed1", "mohammed123", "ahmed1234", "business1", "businesspartner1",
]);

export function passwordProblem(pw, email = "") {
  const p = String(pw == null ? "" : pw);
  if (p.length < PASSWORD_MIN) return "short";
  if (p.length > PASSWORD_MAX) return "long";
  if (!/\p{L}/u.test(p)) return "no_letter";
  if (!/\p{N}/u.test(p)) return "no_digit";
  if (new Set(p).size < 4) return "repetitive";
  if (COMMON.has(p.toLowerCase())) return "common";
  const local = String(email || "").split("@")[0].toLowerCase();
  if (local.length >= 4 && p.toLowerCase().includes(local)) return "has_email";
  return null;
}

export const PASSWORD_MESSAGE_AR = {
  short: `كلمة المرور ${PASSWORD_MIN} أحرف على الأقل.`,
  long: `كلمة المرور أطول من ${PASSWORD_MAX} حرفاً.`,
  no_letter: "كلمة المرور تحتاج حرفاً واحداً على الأقل.",
  no_digit: "كلمة المرور تحتاج رقماً واحداً على الأقل.",
  repetitive: "كلمة المرور متكررة الأحرف. اختر غيرها.",
  common: "كلمة المرور شائعة جداً. اختر غيرها.",
  has_email: "لا تضع بريدك داخل كلمة المرور.",
};

/* --- digits ----------------------------------------------------------------
 * A Saudi keyboard types ٠١٢٣٤٥٦٧٨٩ as readily as 0123456789, and JS's \d does
 * not match the first set — so «٠٥٥…» would be stripped to nothing and rejected
 * as "must be 10 digits". Convert before validating, never after.
 */
export function asciiDigits(s) {
  return String(s == null ? "" : s)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
}

/* --- mobile number -----------------------------------------------------------
 * Saudi mobiles are normalised to +9665XXXXXXXX whichever way they were typed
 * (05…, 5…, 9665…, 009665…, +9665…). Anything else is accepted only as a plain
 * international number (+ or 00, then 8-15 digits): a client abroad is still a
 * client, but "12345" is not a phone.
 */
export function normalizePhone(input) {
  const raw = asciiDigits(input).trim();
  if (!raw) return { ok: false, reason: "empty" };
  if (/[^0-9+\s().-]/.test(raw)) return { ok: false, reason: "bad_chars" };
  const plus = raw.startsWith("+") || raw.startsWith("00");
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) d = d.slice(2);
  if (!plus) {
    if (/^05\d{8}$/.test(d)) return { ok: true, value: "+966" + d.slice(1) };
    if (/^5\d{8}$/.test(d)) return { ok: true, value: "+966" + d };
    if (/^9665\d{8}$/.test(d)) return { ok: true, value: "+" + d };
    return { ok: false, reason: "bad_saudi_mobile" };
  }
  if (d.startsWith("966")) {
    return /^9665\d{8}$/.test(d) ? { ok: true, value: "+" + d } : { ok: false, reason: "bad_saudi_mobile" };
  }
  if (d.length < 8 || d.length > 15 || d.startsWith("0")) return { ok: false, reason: "bad_international" };
  return { ok: true, value: "+" + d };
}

/* --- throttle ---------------------------------------------------------------
 * A fixed window per key, kept in the lambda instance. It blunts a casual flood
 * or a guessing run and does nothing against a distributed one — the same
 * honesty as the throttles already in api/otp.js. `hit` counts and answers
 * "still allowed?"; `peek` answers without counting (so a correct password
 * does not use up an attempt that only failures should).
 */
export function createThrottle({ windowMs, max, cap = 2000 }) {
  const m = new Map();
  const fresh = (k, now) => {
    const r = m.get(k);
    return r && now - r.at <= windowMs ? r : null;
  };
  return {
    hit(key, now = Date.now()) {
      const r = fresh(key, now);
      if (!r) { if (m.size >= cap) m.clear(); m.set(key, { at: now, n: 1 }); return true; }
      r.n += 1;
      return r.n <= max;
    },
    peek(key, now = Date.now()) {
      const r = fresh(key, now);
      return !r || r.n < max;
    },
    reset(key) { m.delete(key); },
  };
}
