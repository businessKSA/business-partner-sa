// Business Partner — Broker & Referral System with Azure Backend
// Exclusively uses Microsoft Azure for database, messaging, and automation
// Replaces Supabase + Notion + Resend + n8n with Azure services

import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import {
  azureBrokerQuery,
  azureBrokerExecute,
  azureSendEmail,
  azureSendSMS,
  azureStoragePut,
  azureStorageGet,
  azureStorageSign,
  azureStorageDelete,
  azureTriggerLogicApp,
  azureAudit,
  AZURE_DB_READY,
  AZURE_COMM_READY,
} from "./_azure.js";

const envFrom = (names) => {
  for (const n of names) {
    if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim();
  }
  return "";
};

const OWNER_KEY = envFrom(["PANEL_KEY", "LEADS_KEY", "DASHBOARD_KEY"]);
const OTP_SECRET = (process.env.OTP_SECRET || "").trim();
const SITE = (process.env.SITE_URL || "https://businesspartner.sa").replace(/\/+$/, "");
const AGREEMENT_VERSION = "2026-08-broker-v1";

/* ------------------------------------------------------------- utilities -- */

const clip = (s, n = 400) => String(s == null ? "" : s).trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const digits = (s) => String(s || "").replace(/\D+/g, "");
const nowIso = () => new Date().toISOString();
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const enc = (v) => encodeURIComponent(String(v));

// Normalize Saudi phone numbers
export function normPhone(v) {
  let d = digits(v);
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("966")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return d ? "966" + d : "";
}

// Dedupe key for referral matching
const COMPANY_STOPWORDS = new Set([
  "شركه", "شركات", "مؤسسه", "موسسه", "مجموعه", "مكتب", "وشركاه",
  "company", "co", "llc", "ltd", "limited", "est", "group", "corp", "inc", "the",
]);

export function dedupeKey({ companyName, companyUrl, contactEmail }) {
  const host = (() => {
    const raw = clip(companyUrl, 300);
    if (!raw) return "";
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw)
        .hostname.replace(/^www\./i, "")
        .toLowerCase();
    } catch {
      return "";
    }
  })();

  if (host) return host;

  const normalized = String(companyName || "")
    .toLowerCase()
    .replace(/ة/g, "ه")
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => !COMPANY_STOPWORDS.has(w) && w.length > 1)
    .slice(0, 5)
    .join(" ");

  return normalized || contactEmail;
}

/* -------------------------------------------------- Broker Operations -- */

// Create broker account with OTP verification
export async function createBrokerAccount(email) {
  if (!isEmail(email)) throw new Error("invalid_email");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  const otp = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  const otp_hash = sha(otp);
  const otp_expires = new Date(Date.now() + 10 * 60000).toISOString();

  const broker_id = crypto.randomUUID();

  try {
    // Create broker record
    await azureBrokerExecute(
      `INSERT INTO brokers (id, email, status, agreement_version, created_at, updated_at)
       VALUES (@param0, @param1, 'pending', @param2, @param3, @param4)`,
      [broker_id, email.toLowerCase(), AGREEMENT_VERSION, nowIso(), nowIso()]
    );

    // Store OTP in broker_sessions
    await azureBrokerExecute(
      `INSERT INTO broker_sessions (id, broker_id, otp_code, otp_expires_at, created_at)
       VALUES (@param0, @param1, @param2, @param3, @param4)`,
      [crypto.randomUUID(), broker_id, otp_hash, otp_expires, nowIso()]
    );

    // Send OTP via Azure Communication Services
    if (AZURE_COMM_READY) {
      await azureSendEmail({
        to: email,
        subject: "Business Partner - Broker Portal - OTP Code",
        html: `<p>Your OTP code is: <strong>${esc(otp)}</strong></p><p>Valid for 10 minutes.</p>`,
      });
    }

    return { broker_id, email, otp_sent: AZURE_COMM_READY };
  } catch (err) {
    console.error("create_broker_account_error", err.message);
    throw new Error("signup_failed");
  }
}

// Verify OTP and create session
export async function verifyBrokerOTP(email, otp) {
  if (!isEmail(email) || !otp) throw new Error("invalid_input");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    const otp_hash = sha(otp);

    // Find session with valid OTP
    const sessions = await azureBrokerQuery(
      `SELECT bs.id, bs.broker_id, bs.otp_expires_at FROM broker_sessions bs
       JOIN brokers b ON bs.broker_id = b.id
       WHERE b.email = @param0 AND bs.otp_code = @param1 AND bs.otp_expires_at > GETUTCDATE()`,
      [email.toLowerCase(), otp_hash]
    );

    if (!sessions.length) throw new Error("invalid_otp");

    const session = sessions[0];
    const token = crypto.randomBytes(32).toString("hex");
    const token_hash = sha(token);
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60000).toISOString(); // 30 days

    // Create authenticated session
    await azureBrokerExecute(
      `INSERT INTO broker_sessions (id, broker_id, session_token_hash, expires_at, created_at)
       VALUES (@param0, @param1, @param2, @param3, @param4)`,
      [crypto.randomUUID(), session.broker_id, token_hash, expires_at, nowIso()]
    );

    // Audit
    await azureAudit({ action: "broker_login", broker_id: session.broker_id, timestamp: nowIso() });

    return { token, broker_id: session.broker_id, email };
  } catch (err) {
    console.error("verify_otp_error", err.message);
    throw new Error("verification_failed");
  }
}

// Get broker profile
export async function getBrokerProfile(email, token) {
  if (!isEmail(email) || !token) throw new Error("invalid_input");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    const token_hash = sha(token);

    // Verify session
    const sessions = await azureBrokerQuery(
      `SELECT b.* FROM brokers b
       JOIN broker_sessions bs ON b.id = bs.broker_id
       WHERE b.email = @param0 AND bs.session_token_hash = @param1
       AND bs.expires_at > GETUTCDATE() AND bs.revoked_at IS NULL`,
      [email.toLowerCase(), token_hash]
    );

    if (!sessions.length) throw new Error("unauthorized");

    const broker = sessions[0];

    // Get commission stats
    const stats = await azureBrokerQuery(
      `SELECT
        COUNT(DISTINCT r.id) as total_referrals,
        COUNT(DISTINCT CASE WHEN r.company_became_customer = 1 THEN r.id END) as customers,
        SUM(rc.net_commission) as total_earned,
        COUNT(DISTINCT CASE WHEN rc.status = 'pending' THEN rc.id END) as pending_commissions
       FROM referrals r
       LEFT JOIN referral_commissions rc ON r.id = rc.referral_id
       WHERE r.broker_id = @param0`,
      [broker.id]
    );

    return {
      ...broker,
      stats: stats[0] || { total_referrals: 0, customers: 0, total_earned: 0, pending_commissions: 0 },
    };
  } catch (err) {
    console.error("get_broker_profile_error", err.message);
    throw new Error("profile_fetch_failed");
  }
}

/* ------------------------------------------------- Referral Operations -- */

// Submit a new referral
export async function submitReferral({
  brokerEmail,
  companyName,
  companyUrl,
  companyIndustry,
  contactName,
  contactEmail,
  contactPhone,
  referralMessage,
}) {
  if (!isEmail(contactEmail)) throw new Error("invalid_email");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    const referralId = crypto.randomUUID();
    const key = dedupeKey({ companyName, companyUrl, contactEmail });

    // Find or create broker
    let brokers = [];
    if (isEmail(brokerEmail)) {
      brokers = await azureBrokerQuery(`SELECT id FROM brokers WHERE email = @param0`, [brokerEmail.toLowerCase()]);
    }

    const brokerId = brokers.length ? brokers[0].id : null;

    // Check for duplicates
    const dupes = await azureBrokerQuery(`SELECT id FROM referrals WHERE dedupe_key = @param0 LIMIT 1`, [key]);

    // Create referral record
    await azureBrokerExecute(
      `INSERT INTO referrals (
        id, broker_id, company_name, company_url, company_domain, company_industry,
        contact_name, contact_email, contact_phone, referral_message,
        dedupe_key, status, stage, created_at, updated_at
      ) VALUES (
        @param0, @param1, @param2, @param3, @param4, @param5,
        @param6, @param7, @param8, @param9,
        @param10, 'new', 'lead', @param11, @param12
      )`,
      [
        referralId,
        brokerId,
        clip(companyName, 255),
        clip(companyUrl, 500),
        (() => {
          try {
            return new URL(/^https?:\/\//i.test(companyUrl) ? companyUrl : "https://" + companyUrl).hostname;
          } catch {
            return null;
          }
        })(),
        clip(companyIndustry, 100),
        clip(contactName, 255),
        contactEmail.toLowerCase(),
        normPhone(contactPhone),
        clip(referralMessage, 2000),
        key,
        nowIso(),
        nowIso(),
      ]
    );

    // Log event
    await logReferralEvent(referralId, brokerId, "created", { source: "form" });

    // Notify broker if linked
    if (brokerId && AZURE_COMM_READY) {
      const brokers = await azureBrokerQuery(`SELECT email FROM brokers WHERE id = @param0`, [brokerId]);
      if (brokers.length) {
        await azureSendEmail({
          to: brokers[0].email,
          subject: "New Referral Received",
          html: `<p>New referral from ${esc(companyName)}</p><p>Contact: ${esc(contactName)} (${esc(contactEmail)})</p>`,
        });
      }
    }

    // Trigger Azure Logic App for follow-up automation
    await azureTriggerLogicApp("referral-submitted", {
      referral_id: referralId,
      broker_id: brokerId,
      company_name: companyName,
      contact_email: contactEmail,
    });

    return { referral_id: referralId, status: "submitted" };
  } catch (err) {
    console.error("submit_referral_error", err.message);
    throw new Error("referral_submission_failed");
  }
}

// Get broker referrals
export async function getBrokerReferrals(brokerId, token) {
  if (!brokerId || !token) throw new Error("invalid_input");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    // Verify session
    const sessions = await azureBrokerQuery(
      `SELECT broker_id FROM broker_sessions
       WHERE broker_id = @param0 AND session_token_hash = @param1
       AND expires_at > GETUTCDATE() AND revoked_at IS NULL`,
      [brokerId, sha(token)]
    );

    if (!sessions.length) throw new Error("unauthorized");

    // Get referrals
    const referrals = await azureBrokerQuery(
      `SELECT r.*,
        SUM(rc.commission_amount) as total_commissions,
        COUNT(rc.id) as commission_count
       FROM referrals r
       LEFT JOIN referral_commissions rc ON r.id = rc.referral_id
       WHERE r.broker_id = @param0
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [brokerId]
    );

    return referrals;
  } catch (err) {
    console.error("get_broker_referrals_error", err.message);
    throw new Error("referrals_fetch_failed");
  }
}

// Get commission plans
export async function getCommissionPlans() {
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    const plans = await azureBrokerQuery(
      `SELECT * FROM commission_plans WHERE is_active = 1 ORDER BY tier_level ASC`
    );
    return plans;
  } catch (err) {
    console.error("get_commission_plans_error", err.message);
    return [];
  }
}

/* ------------------------------------------------ Commission Operations -- */

// Calculate commissions for a referral
export async function calculateCommission(referralId, invoiceAmount, invoiceDate) {
  if (!referralId || !invoiceAmount) throw new Error("invalid_input");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    // Get referral with broker info
    const referrals = await azureBrokerQuery(
      `SELECT r.*, b.commission_plan_id FROM referrals r
       JOIN brokers b ON r.broker_id = b.id
       WHERE r.id = @param0`,
      [referralId]
    );

    if (!referrals.length) throw new Error("referral_not_found");

    const referral = referrals[0];

    // Get commission plan
    const plans = await azureBrokerQuery(
      `SELECT first_invoice_rate FROM commission_plans WHERE id = @param0 OR tier_level = 0`,
      [referral.commission_plan_id]
    );

    const rate = plans.length ? plans[0].first_invoice_rate : 10.0;
    const commissionAmount = (invoiceAmount * rate) / 100;

    // Create commission record
    const commissionId = crypto.randomUUID();
    const periodStart = new Date(invoiceDate);
    periodStart.setDate(1);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(0);

    await azureBrokerExecute(
      `INSERT INTO referral_commissions (
        id, referral_id, broker_id, period_start_date, period_end_date,
        invoice_date, invoice_amount, commission_rate, commission_amount,
        net_commission, status, created_at, updated_at
      ) VALUES (
        @param0, @param1, @param2, @param3, @param4,
        @param5, @param6, @param7, @param8,
        @param9, 'pending', @param10, @param11
      )`,
      [
        commissionId,
        referralId,
        referral.broker_id,
        periodStart.toISOString().split("T")[0],
        periodEnd.toISOString().split("T")[0],
        new Date(invoiceDate).toISOString().split("T")[0],
        invoiceAmount,
        rate,
        commissionAmount,
        commissionAmount,
        nowIso(),
        nowIso(),
      ]
    );

    // Trigger notification
    await azureTriggerLogicApp("commission-calculated", {
      commission_id: commissionId,
      broker_id: referral.broker_id,
      amount: commissionAmount,
    });

    return { commission_id: commissionId, commission_amount: commissionAmount };
  } catch (err) {
    console.error("calculate_commission_error", err.message);
    throw new Error("commission_calculation_failed");
  }
}

/* ------------------------------------------------- Admin Operations -- */

// Admin: Get all referrals and statistics
export async function adminGetReferrals(adminKey) {
  if (!adminKey || adminKey !== OWNER_KEY) throw new Error("unauthorized");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    const referrals = await azureBrokerQuery(
      `SELECT
        r.*,
        b.email as broker_email,
        COUNT(DISTINCT rc.id) as commission_count,
        SUM(rc.net_commission) as total_commissions
       FROM referrals r
       LEFT JOIN brokers b ON r.broker_id = b.id
       LEFT JOIN referral_commissions rc ON r.id = rc.referral_id
       GROUP BY r.id, b.email
       ORDER BY r.created_at DESC`
    );

    return referrals;
  } catch (err) {
    console.error("admin_get_referrals_error", err.message);
    throw new Error("admin_fetch_failed");
  }
}

// Admin: Approve commission
export async function adminApproveCommission(adminKey, commissionId) {
  if (!adminKey || adminKey !== OWNER_KEY) throw new Error("unauthorized");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    await azureBrokerExecute(
      `UPDATE referral_commissions SET status = 'approved', decision_date = GETUTCDATE()
       WHERE id = @param0`,
      [commissionId]
    );

    // Trigger payout workflow
    await azureTriggerLogicApp("commission-approved", { commission_id: commissionId });

    // Audit
    await azureAudit({
      action: "commission_approved",
      resource_type: "commission",
      resource_id: commissionId,
      performed_by: "admin",
      timestamp: nowIso(),
    });

    return { success: true };
  } catch (err) {
    console.error("admin_approve_commission_error", err.message);
    throw new Error("approval_failed");
  }
}

// Admin: Process payout
export async function adminProcessPayout(adminKey, brokerId, commissionIds) {
  if (!adminKey || adminKey !== OWNER_KEY) throw new Error("unauthorized");
  if (!AZURE_DB_READY) throw new Error("database_not_configured");

  try {
    // Calculate total
    const commissions = await azureBrokerQuery(
      `SELECT SUM(net_commission) as total FROM referral_commissions
       WHERE id IN (${commissionIds.map(() => "?").join(",")}) AND status = 'approved'`,
      commissionIds
    );

    if (!commissions.length) throw new Error("no_commissions");

    const total = commissions[0].total || 0;
    const payoutId = crypto.randomUUID();

    // Create payout record
    await azureBrokerExecute(
      `INSERT INTO broker_payouts (
        id, broker_id, payout_date, total_net, currency, commission_count,
        status, created_at, updated_at
      ) VALUES (@param0, @param1, @param2, @param3, 'SAR', @param4, 'pending', @param5, @param6)`,
      [payoutId, brokerId, new Date().toISOString().split("T")[0], total, commissionIds.length, nowIso(), nowIso()]
    );

    // Update commissions
    await azureBrokerExecute(
      `UPDATE referral_commissions SET payout_id = @param0, status = 'paid'
       WHERE id IN (${commissionIds.map(() => "?").join(",")})`,
      [payoutId, ...commissionIds]
    );

    // Trigger payout workflow
    await azureTriggerLogicApp("payout-initiated", {
      payout_id: payoutId,
      broker_id: brokerId,
      amount: total,
    });

    return { payout_id: payoutId, amount: total };
  } catch (err) {
    console.error("admin_process_payout_error", err.message);
    throw new Error("payout_failed");
  }
}

/* ------------------------------------------------ Helper Functions -- */

async function logReferralEvent(referralId, brokerId, eventType, eventData) {
  if (!AZURE_DB_READY) return;

  try {
    await azureBrokerExecute(
      `INSERT INTO referral_events (id, referral_id, broker_id, event_type, event_data, created_at)
       VALUES (@param0, @param1, @param2, @param3, @param4, @param5)`,
      [crypto.randomUUID(), referralId, brokerId, eventType, JSON.stringify(eventData), nowIso()]
    );
  } catch (err) {
    console.error("log_referral_event_error", err.message);
  }
}
