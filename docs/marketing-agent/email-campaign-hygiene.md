# Email Campaign Hygiene — قاعدة الشركات

**Status:** live · **Last updated:** 2026-08-06

This document covers the deliverability side of the outbound email campaign that runs
off `BP — Companies Sales DB`. It exists because the first campaign nearly cost us the
sending domain.

---

## 1. What went wrong

The campaign ran twice a day from 2026-07-28 to 2026-08-06, ~100 emails/day, ~1,000 sends
in total. Over the same window Gmail returned roughly **400 bounce notices** — a bounce
rate somewhere in the 25–40% range against a safe ceiling of **5%**.

At that rate, `business@businesspartnerksa.com` was days away from being throttled or
blacklisted by the large receivers (Outlook/EXO, Mimecast, Google). Nothing else in the
funnel matters if the domain stops being able to deliver mail.

The 16 replies received across the whole campaign contained **zero genuine business
leads**: ~11 auto-replies, 1 out-of-office, 2 signature-only, and 1 human reply from
دهانات الجزيرة redirecting us to HR — i.e. the recipient read a B2B services pitch as a
job application.

### Root cause

The list was built by scraping Google Places. Scraping produces four failure modes, and
the database had all four:

| Failure mode | Example | Caught by |
|---|---|---|
| Domain has no mail server at all | `info@square1sa.com` (NXDOMAIN) | MX check |
| Address belongs to a global platform, not the company | `info@booking.com`, `info@apps.apple.com`, `info@vip.com` | domain list |
| Same address on several records | `info@al-jazera.sa` — 4 records, all mailed within 4 seconds | dedupe |
| Placeholder left in a website template | `example@gmail.com`, `info@example.com`, `your@email.com` | domain/local-part list |
| Malformed string | `%20info@fanarmed.com`, `info@savola.com; IR@savola.com` | normalisation (repaired) |
| **Live domain, dead mailbox** | `info@stylishop.com`, `info@nestooffers.com`, `info@garmin.sa` | **only the bounce** |

The last row is the important one. DNS says those domains are healthy and accept mail —
the `info@` mailbox simply does not exist, or the receiving server (Mimecast, Exchange
Online) rejects us outright. **No amount of pre-send validation can detect this.** In a
sample of 28 bounced addresses, 19 had passed every static check.

That is why the bounce handler is not a nice-to-have layered on top of the cleanup. It is
the only mechanism that catches the largest single category of failure.

**Final tally: 337 records suppressed, 10 repaired.** Of those, 166 were confirmed
bounces recovered from 45 days of MAILER-DAEMON history — all of them already mailed.

---

## 2. How addresses are validated

Every domain in the database (1,594 unique) was checked with a live DNS lookup:

```
node docs/marketing-agent/tools/mx-check.mjs domains.txt
```

| Result | Domains | Meaning |
|---|---|---|
| `ok` | 1,371 | Has an MX record — mail can be delivered |
| `a_only` | 116 | No MX, but an A record exists — RFC fallback, risky |
| `nxdomain` | 74 | Domain does not resolve — **guaranteed bounce** |
| `no_mx` | 20 | Resolves but accepts no mail — **guaranteed bounce** |
| `invalid_syntax` | 3 | Not a domain at all |
| `SERVFAIL` | 8 | Broken nameservers — treat as risky |

The `nxdomain` + `no_mx` + `invalid_syntax` domains became the hard-coded `DEAD_DOMAINS`
list used by both the hygiene workflow and the send guard.

**That list is a snapshot and will go stale** — it only knows the domains that existed on
2026-08-06, and Apollo keeps adding more. It is the cheap bulk filter, not the authority.
The authority is the live MX lookup the sender performs on every address at send time
(§3.3), which needs no maintenance. Re-running this script is still worth doing after a
large import, to suppress dead rows in bulk rather than discovering them one at a time.

---

## 3. The pipeline

```
   every 30 min ───▶  BP — Google Places Ingest     adds companies (no email)
   continuous ─────▶  BP — Apollo Enrich            adds EMAIL ADDRESSES  ◀── the source of new risk
                                   │
                                   ▼
   03:00 daily ────▶┌──────────────────────────────┐
                    │  BP — Sales DB Hygiene       │──▶ Suppressed / repaired
                    │  311djGhHO9wfV6jy            │    (bulk filter, static list)
                    └──────────────────────────────┘
                                   │
   10:00 daily ────▶┌──────────────────────────────┐
                    │  BP Campaign Sender          │
                    │  d7a9JhgvFRI5LXQh            │
                    │    Notion (filtered)         │
                    │      └▶ Guard: Validate      │
                    │           └▶ MX Lookup ──────┼──▶ live DNS, per address
                    │                └▶ Build ─▶ Gmail   ≤25 emails/day
                    └──────────────────────────────┘
                                   │
                                   ▼ bounces
   every 4h ───────▶┌──────────────────────────────┐
                    │  BP — Bounce Handler         │──▶ Failed + Suppressed
                    │  QXuY39TKC0FNQp9R            │    (catches what DNS cannot)
                    └──────────────────────────────┘
```

The list is not a fixed asset that gets cleaned once. **Apollo Enrich runs continuously and
keeps writing new, unverified email addresses into the database.** Every defence below has
to be continuous for that reason — a one-off cleanup is stale within a day.

(The Places ingest writes no email field, so it adds inert rows. Apollo is what introduces
sendable addresses, and therefore risk.)

### 3.1 `BP — Sales DB Hygiene` (`311djGhHO9wfV6jy`)

Runs nightly at 03:00 Asia/Riyadh, ahead of the 10:00 send, and can also be run by hand.
Loads every record (the whole set is needed to spot duplicates),
normalises each address, and writes back one of two outcomes:

- **Suppress** — sets `Suppressed = true`, `Suppress Reason`, `Last Campaign Status = Skipped`,
  and `Duplicate = true` for the duplicate case.
- **Fix** — writes the normalised address to `Email` and keeps the original in `Email Fixed From`.

Nothing is ever deleted. A suppressed row stays fully auditable.

Duplicate resolution keeps the copy that already received mail (so history is preserved),
falling back to the highest `ICP Score`.

**Run this after every list import.**

### 3.2 `Guard: Validate Before Send` (inside the sender)

A Code node between the Notion read and the email build. It is deliberately redundant with
the hygiene pass — the hygiene pass is a batch job that can go stale, the guard runs on
every single send.

It drops anything that is suppressed, duplicated, already sent, malformed, on a dead
domain, on a global platform, or a placeholder — then caps the run at **25 emails**.

It also fills in `property_company_name_clean` from the record title. The original template
read `property_company_name_clean || property_clean_name || name`, none of which this
database populates, so `{{COMPANY_NAME}}` rendered blank in the emails already sent. A dry
run after the fix confirmed the name now renders (`مكتب أبو طافش للخدمات العامه`, `Protouch`).

### 3.3 `MX Lookup (dns.google)` + `Drop Domains Without MX` (inside the sender)

The dead-domain list is a snapshot. Apollo keeps adding domains nobody has ever checked, so
the sender resolves **every address live, immediately before sending**, via DNS-over-HTTPS
at `https://dns.google/resolve?name=<domain>&type=MX`. No credential and no API key needed.

| DNS result | Action |
|---|---|
| `NXDOMAIN` (Status 3) | drop — the domain does not exist |
| `NOERROR` with no type-15 record | drop — no mail server; 48 confirmed bounces were exactly this |
| `NOERROR` with an MX record | send |
| `SERVFAIL`, timeout, request failed | **send anyway** |

That last row is deliberate. A lookup we could not complete is not evidence against the
address, and silently dropping a good lead is worse than one bounce — the bounce handler
will judge it either way. The check only removes addresses DNS actively condemns.

Results are paired back to leads by position, which is safe because the HTTP node preserves
input order and the batch is capped at 25.

### 3.4 `BP — Bounce Handler` (`QXuY39TKC0FNQp9R`)

Runs every 4 hours. Reads MAILER-DAEMON / postmaster notices from
`business@businesspartnerksa.com`, extracts the failed recipient, finds that record in
Notion and sets `Last Campaign Status = Failed`, `Suppressed = true`,
`Suppress Reason = Bounced`, plus the server's own reason and the date.

Extraction order: `Final-Recipient:` → `Original-Recipient:` → the human-readable
"wasn't delivered to X" phrasing → first non-ours address in the notice.

**A lead is only burned on an unambiguous permanent failure.** These leave the record alone:

- Subject contains `(Delay)` / `Delivery delayed` — the server is still trying.
- `5.2.2`, `552`, "mailbox is full", "over quota" — the address is fine, the inbox is not.
- Any 4.x.x code.
- A reason the parser could not classify.

Re-running is harmless; writing `Failed` twice changes nothing.

A one-off backfill over 45 days of history recorded **166 bounced addresses**. When
backfilling, note that `simple: false` makes Gmail download and parse every message in
full — a 45-day window takes about 11 minutes, and no writes appear until every lookup
has finished, because n8n completes each node for all items before moving on. If a wider
window is ever needed, slice it with `after:`/`before:` rather than one large fetch.

---

## 4. New Notion fields

Added to `BP — Companies Sales DB` (`26faca27-6188-4b6a-b584-924c374f2d22`):

| Field | Type | Purpose |
|---|---|---|
| `Suppressed` | checkbox | The one flag the sender filters on. |
| `Suppress Reason` | select | `Invalid Syntax` · `Undeliverable Domain` · `Global Platform` · `Placeholder` · `Duplicate` · `Bounced` · `Unsubscribed` · `Manual` |
| `Email Fixed From` | text | The original value, before normalisation. |
| `Bounce Detail` | text | The receiving server's verbatim reason. |
| `Bounce Date` | date | When the bounce was recorded. |

---

## 5. Where the list stands

| | Records |
|---|---|
| Total | 2,603 |
| No email address at all | 904 |
| Suppressed | 337 |
| Already mailed, address clean | 781 |
| **Still sendable** | **581** |

Suppressed breaks down as: `Bounced` 166 · `Duplicate` 60 · `Undeliverable Domain` 51 ·
`Global Platform` 47 · `Placeholder` 12 · `Invalid Syntax` 1. (`Bounced` takes precedence
where a record qualified under more than one reason — a confirmed bounce is stronger
evidence than an inferred one.)

At 25/day the remaining pool is about **23 days** of sending.

**166 confirmed bounces against ~1,000 sends is a 16.6% bounce rate** — and that counts
only what the parser could attribute to a record in this database. The real figure is
higher. Against a 5% ceiling, the earlier decision to pause was not precautionary.

### The domain has not been blocked

Classifying all 166 bounce reasons by what the receiving server actually said:

| What the server said | Count |
|---|---|
| Address does not exist | 80 |
| Domain has no mail server | 48 |
| Other / unclassified | 25 |
| Server refuses mail from outside | 10 |
| **Policy or reputation rejection** | **3** |

**Only 3 of 166 are the receiving side rejecting us on reputation** (all three Mimecast
`554 security policies`). The other 163 are bad data — addresses that were never real.

This is the difference between two very different problems. If most bounces had been
policy rejections, `businesspartnerksa.com` would already be filtered at the large
receivers and would need a warm-up or a fresh sending domain. They are not. The domain is
still in good standing; the list was the problem, and the list has been fixed.

The pause caught this in time. Had the campaign continued at 100/day, the ratio would have
inverted.

---

## 6. Operating rules

1. **Never send without running the hygiene pass first** on a freshly imported list.
2. **Keep the daily cap low while the domain recovers.** 25/day for the first two weeks.
   Only raise it once the bounce rate over a rolling 7 days is under 3%.
3. **Watch the bounce rate, not the send count.** If `Bounced` grows faster than 1 in 20
   sends, pause the sender and re-run the MX check — the list has gone stale.
4. **Re-run the MX check on every import.** Domains that resolved last quarter die.
5. **A reply is not a lead.** Auto-replies and out-of-office messages must not be counted
   as engagement.

---

## 7. Still open

- ~~The 116 `a_only` domains (A record, no MX) are still in the sendable pool.~~
  **Closed.** The live MX lookup in the sender now drops them at send time, so they never
  reach Gmail. No bulk suppression was needed and no record was lost — if one of those
  domains adds an MX record later, it simply starts passing again.
- 33 addresses are personal Gmail accounts and 2 are Yahoo. They are deliverable and some
  are genuine KSA small-business contacts, so they were left in — but they belong in a
  separate, more personal campaign, not the corporate one.
- The generic "we do everything" email is what produced the HR misread. Per-company,
  per-service offers are the next piece of work.
- Two records were suppressed as `Global Platform` in error and restored by hand: **Bayut
  KSA** and **Yaschools**. Both *are* the platform, so `info@bayut.sa` and
  `info@yaschools.com` are their own inboxes. Worth re-checking that list by eye after any
  future import — the rule cannot distinguish "scraped from a platform" from "is the
  platform".
