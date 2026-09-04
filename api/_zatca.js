// Business Partner — the ZATCA fields a simplified tax invoice must carry.
//
// Daftra issues the legal invoice but will not hand its PDF to the API, so the
// client's copy is rendered by us. A copy of a tax invoice is only worth
// sending if it carries what the regulation requires, and the QR payload is
// the part that cannot be approximated: it is a TLV structure, base64-encoded,
// holding exactly five fields in a fixed order.
//
// Underscore-prefixed: a shared module, not a 13th serverless function.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Tag-Length-Value, where the length is the byte length of the UTF-8 value —
// not its character count. Arabic seller names make that distinction load
// bearing: "شركة" is 4 characters and 8 bytes.
function tlv(tag, value) {
  const v = Buffer.from(String(value == null ? "" : value), "utf8");
  return Buffer.concat([Buffer.from([tag, v.length]), v]);
}

/**
 * The five fields ZATCA requires in a simplified invoice's QR, in order.
 *
 * @param {object} f
 * @param {string} f.sellerName   seller's registered name
 * @param {string} f.vatNumber    seller's 15-digit VAT registration number
 * @param {string} f.timestamp    ISO 8601 date-time of issue
 * @param {number|string} f.total invoice total INCLUDING VAT
 * @param {number|string} f.vat   the VAT amount alone
 * @returns {string} base64 of the TLV structure
 */
export function zatcaQrPayload({ sellerName, vatNumber, timestamp, total, vat }) {
  const money = (n) => {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : String(n);
  };
  return Buffer.concat([
    tlv(1, sellerName),
    tlv(2, vatNumber),
    tlv(3, timestamp),
    tlv(4, money(total)),
    tlv(5, money(vat)),
  ]).toString("base64");
}

// A VAT registration number in Saudi Arabia is 15 digits, starts and ends with
// 3. Checking the shape here means a mistyped number is caught before it is
// printed on a document a client keeps.
export function vatNumberLooksValid(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 15 && d.startsWith("3") && d.endsWith("3");
}

// Who the invoice is from. Read from configuration rather than hardcoded: the
// VAT number belongs to the business, not to this repository.
// The registered identity, read from site/data/site.json → legal, the same
// block the public footer prints. Environment variables still win where they
// are set, so a deployment can override without a commit.
//
// One source for both, deliberately: a VAT number that appears on the invoice
// and a different one in the footer is the kind of contradiction a customer
// notices exactly once, and never asks about — they just leave.
function legalFromSite() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const j = JSON.parse(readFileSync(join(here, "..", "site", "data", "site.json"), "utf8"));
    return j.legal || {};
  } catch { return {}; }
}

export function sellerProfile() {
  const L = legalFromSite();
  const name = (process.env.COMPANY_LEGAL_NAME || L.name || "").trim();
  const vat = (process.env.COMPANY_VAT_NUMBER || L.vat || "").replace(/\D/g, "");
  const cr = (process.env.COMPANY_CR_NUMBER || L.cr || L.unified || "").replace(/\D/g, "");
  return {
    name, vatNumber: vat, crNumber: cr,
    vatValid: vatNumberLooksValid(vat),
    ready: !!(name && vatNumberLooksValid(vat)),
    missing: [
      name ? null : "COMPANY_LEGAL_NAME",
      vatNumberLooksValid(vat) ? null : "COMPANY_VAT_NUMBER",
    ].filter(Boolean),
  };
}
