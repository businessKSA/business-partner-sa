#!/usr/bin/env node
// Sales Pipeline (Notion) — fill the empty «Phone» column of existing rows.
//
//   node ops/crm-phone-backfill.mjs            # DRY RUN (default): prints, writes NOTHING
//   node ops/crm-phone-backfill.mjs --apply    # PATCHes only the Phone property, only where it is empty
//
// Needs  NOTION_TOKEN  (same integration the site uses; read for dry run, write for --apply)
// Optional  SUPABASE_URL + SUPABASE_SERVICE_KEY  → also use requests.client_phone by ref.
//
// Where a number comes from, in order (first hit wins, never overwrites an existing Phone):
//   1. requests.client_phone for the row's «رقم المرجع»
//   2. the free text «الجوال: 05…» that older writers buried in Notes
//   3. a wa.me/<digits> link in Notes (WhatsApp Web reader rows whose number was resolved)
// Rows with none of these are reported as unrecoverable: WhatsApp groups have no client number,
// and @lid chats hide it — WhatsApp does not expose the number, so it cannot be invented.
//
// Output masks every number (05xx***). Nothing is printed in full, nothing is written to disk.
import { normalizeCrmPhone, phoneFromNotes } from "../api/_phone.js";

const DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
const TOKEN = (process.env.NOTION_TOKEN || "").trim();
const APPLY = process.argv.includes("--apply");
const V = "2022-06-28";
if (!TOKEN) { console.error("NOTION_TOKEN is not set — nothing to do."); process.exit(2); }

const mask = (p) => { const d = String(p).replace(/\D/g, ""); return d.length < 6 ? "***" : `+${d.slice(0, 3)}${d.slice(3, 5)}xxx***`; };
const plain = (rt) => (rt || []).map((t) => t.plain_text || "").join("");

async function notion(path, init = {}) {
  const r = await fetch("https://api.notion.com/v1" + path, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Notion-Version": V, "content-type": "application/json" } });
  if (!r.ok) throw new Error(`Notion ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function emptyPhoneRows() {
  const rows = []; let cursor;
  do {
    const d = await notion(`/databases/${DB}/query`, { method: "POST", body: JSON.stringify({
      page_size: 100, start_cursor: cursor,
      filter: { property: "Phone", phone_number: { is_empty: true } },
    }) });
    rows.push(...d.results); cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function requestPhones() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  const r = await fetch(`${url}/rest/v1/requests?select=ref,client_phone&client_phone=not.is.null`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) { console.error("requests lookup failed:", r.status); return null; }
  return new Map((await r.json()).filter((x) => x.client_phone).map((x) => [x.ref, x.client_phone]));
}

const reqPhones = await requestPhones();
const rows = await emptyPhoneRows();
const plan = []; const none = { group: 0, lid: 0, other: 0 };

for (const pg of rows) {
  const pr = pg.properties || {};
  const ref = plain(pr["رقم المرجع"]?.rich_text);
  const notes = plain(pr["Notes"]?.rich_text);
  let from = "", phone = "";
  if (reqPhones && ref && reqPhones.has(ref)) { phone = normalizeCrmPhone(reqPhones.get(ref)); from = "requests"; }
  if (!phone) { phone = phoneFromNotes(notes); if (phone) from = "notes"; }
  if (!phone) {
    const m = notes.match(/wa\.me\/(\d{9,15})/);
    if (m) { phone = normalizeCrmPhone(m[1]); if (phone) from = "wa.me"; }
  }
  if (phone) plan.push({ id: pg.id, ref: ref || "—", from, phone });
  else if (/@g\.us/.test(notes)) none.group++;
  else if (/@lid/.test(notes)) none.lid++;
  else none.other++;
}

const by = {}; for (const p of plan) by[p.from] = (by[p.from] || 0) + 1;
console.log(`${APPLY ? "APPLY" : "DRY RUN"} — Sales Pipeline ${DB.slice(0, 8)}…`);
console.log(`rows with empty Phone : ${rows.length}`);
console.log(`would fill            : ${plan.length}  ${JSON.stringify(by)}`);
console.log(`unrecoverable         : group=${none.group}  lid=${none.lid}  other(no number anywhere)=${none.other}`);
for (const p of plan) console.log(`  ${p.ref.padEnd(24)} ${p.from.padEnd(9)} → ${mask(p.phone)}`);

if (!APPLY) { console.log("\nNothing was written. Re-run with --apply after the owner approves."); process.exit(0); }

let ok = 0, fail = 0;
for (const p of plan) {
  try { await notion(`/pages/${p.id}`, { method: "PATCH", body: JSON.stringify({ properties: { Phone: { phone_number: p.phone } } }) }); ok++; }
  catch (e) { fail++; console.error("failed", p.ref, String(e).slice(0, 120)); }
}
console.log(`\nwritten ${ok}, failed ${fail}`);
