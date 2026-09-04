// Business Partner — run-mode switches for local development.
//
// One place decides whether an integration is allowed to touch the outside
// world. Localhost defaults every one of them to a safe value so that no
// card is charged, no customer is emailed, no WhatsApp message is sent and
// no legal contract leaves the machine while we iterate.
//
// Production is unaffected: APP_ENV is unset there, so DEV stays false and
// every mode falls back to "live".

const env = (k, d) => String(process.env[k] || d || "").trim().toLowerCase();

export const APP_ENV = env("APP_ENV", process.env.VERCEL_ENV || "production");
export const DEV = APP_ENV === "development" || APP_ENV === "local";
export const PREVIEW = process.env.VERCEL_ENV === "preview";

const safe = (k, devDefault) => env(k, DEV || PREVIEW ? devDefault : "live");

export const PAYMENTS_MODE = safe("PAYMENTS_MODE", "test");     // test | live
export const MOYASAR_MODE = safe("MOYASAR_MODE", "test");       // test | live
export const TAMARA_MODE = safe("TAMARA_MODE", "sandbox");      // sandbox | live
export const WHATSAPP_MODE = safe("WHATSAPP_MODE", "mock");     // mock | draft | live
export const EMAIL_MODE = safe("EMAIL_MODE", "preview");        // preview | draft | live
export const CONTRACT_MODE = safe("CONTRACT_MODE", "test");     // test | live
export const CALENDAR_MODE = safe("CALENDAR_MODE", "test");     // test | live

export const EMAIL_LIVE = EMAIL_MODE === "live";
export const WHATSAPP_LIVE = WHATSAPP_MODE === "live";
export const PAYMENTS_LIVE = PAYMENTS_MODE === "live";

// Everything that would have gone out is recorded instead, so the dashboard
// can show it and nothing is silently swallowed.
const OUTBOX_LIMIT = 200;
export async function outbox(entry) {
  const row = { at: new Date().toISOString(), ...entry };
  if (!DEV) return row;
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = process.env.LOCAL_DB_DIR || path.join(process.cwd(), ".localdb");
    const file = path.join(dir, "outbox.json");
    fs.mkdirSync(dir, { recursive: true });
    let all = [];
    try { all = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
    all.unshift(row);
    fs.writeFileSync(file, JSON.stringify(all.slice(0, OUTBOX_LIMIT), null, 2));
  } catch {}
  console.log(`[outbox:${entry.kind}] → ${entry.to || "-"} · ${entry.subject || entry.body || ""}`.slice(0, 200));
  return row;
}

export async function outboxList(limit = 50) {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = process.env.LOCAL_DB_DIR || path.join(process.cwd(), ".localdb");
    return JSON.parse(fs.readFileSync(path.join(dir, "outbox.json"), "utf8")).slice(0, limit);
  } catch { return []; }
}

// ---------------------------------------------------------------- payments --
// A local run must never reach a live gateway. Two rules:
//   1. live keys are refused outright while APP_ENV=development;
//   2. with no keys at all, the checkout falls back to a local mock gateway so
//      the whole path — cart → payment → invoice — is still walkable offline.
const isLive = (k) => /^(pk|sk)_live_/.test(String(k || "").trim());
export function payGuard() {
  if (!DEV) return { ok: true };
  const pk = process.env.MOYASAR_PUBLISHABLE_KEY || "";
  const sk = process.env.MOYASAR_SECRET_KEY || "";
  if (isLive(pk) || isLive(sk)) {
    return { ok: false, error: "live_keys_in_development",
      message: "مفتاح مُيسّر مباشر (live) داخل بيئة تطوير — الدفع موقوف. استعمل مفاتيح pk_test_/sk_test_ في .env.local." };
  }
  return { ok: true };
}
export const PAY_MOCK = () => DEV && !(process.env.MOYASAR_PUBLISHABLE_KEY || "").trim();
// Tamara: in development the sandbox host is the default, so a sandbox token
// pasted without its base cannot reach the production gateway by accident.
export const TAMARA_BASE_DEFAULT = () =>
  (DEV || TAMARA_MODE === "sandbox") ? "https://api-sandbox.tamara.co" : "https://api.tamara.co";
export const TAMARA_MOCK = () => DEV && !(process.env.TAMARA_API_TOKEN || "").trim();

export const MODES = () => ({
  app_env: APP_ENV, dev: DEV,
  payments: PAYMENTS_MODE, moyasar: MOYASAR_MODE, tamara: TAMARA_MODE,
  whatsapp: WHATSAPP_MODE, email: EMAIL_MODE, contract: CONTRACT_MODE, calendar: CALENDAR_MODE,
});
