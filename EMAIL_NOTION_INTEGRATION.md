# Email → Notion CRM + Drive + Alerts (n8n Integration)

Automation that ingests Gmail into the **live** Notion CRM, archives attachments to
Google Drive + Notion, and alerts the owner on WhatsApp. Built on the existing
`Business Partner AI CRM & Knowledge Base` databases (not the deprecated
`Business Partner OS` archive set).

Two workflows work together:

1. **Ingestion** — `BP — Email → Notion CRM + Drive + Alerts` (id `ess3HEXGMPnZnzLH`)
   pulls Gmail → Emails DB + Attachments DB + Drive, classifies with AI, and alerts on
   WhatsApp.
2. **Router & Linker** — `BP — Email CRM Router & Linker` (id `fzYZhTk5QMUxQ6UX`)
   runs over the ingested rows to link attachments, find-or-create Email Threads, and
   route genuine inbound client mail into the CRM / Real Estate Requests.

- **Status:** both Active (Ingestion: Gmail Trigger every minute; Router: schedule every
  15 minutes + manual `Run Linker` trigger).
- **Instance:** `https://businesspartnerai.app.n8n.cloud`

## Flow

```
New Email (Gmail Trigger, every 1m) ─┐
                                     ├─► Merge ─┬─► Normalize ─► Dedup(msgId) ─► AI classify (gpt-4o-mini)
Run Historical Backfill (manual) ──► │         │        ─► Build ─► Create Email (Notion: Emails) ─► Is New? ─► WhatsApp alert
   Fetch Labeled Emails (getAll) ────┘         │
                                               └─► Spread Attachments ─► Dedup(msgId::file) ─► Upload to Drive ─► Create Attachment (Notion: Attachments)
```

- **Two entry points:** the Gmail Trigger handles new mail continuously; the manual
  "Run Historical Backfill" trigger fetches labeled mail (`has:userlabels`, both read/unread)
  for one-off archiving.
- **AI classification:** OpenAI `gpt-4o-mini` via an AI Agent + Structured Output Parser
  → `classification`, `priority`, `sentiment`, `summary`, `actionRequired`. Values are
  validated against the Emails DB option lists (fallback `Other`/`Medium`/`Neutral`).
- **De-duplication:** `Remove Duplicates` (seen-in-previous-executions) keyed on the Gmail
  Message ID (emails) and `messageId::fileName` (attachments). Safe to re-run.
- **Attachments** are downloaded from Gmail, uploaded to a dedicated Drive folder, and a
  record is written to the Notion Attachments DB with the Drive link. Handles multiple
  attachments per email.
- **WhatsApp alert** fires only for *new* mail (not during historical backfill).

## Target Notion databases (live, under "Business Partner AI CRM & Knowledge Base")

| Role | Database | Database page id | Data source (collection) |
|------|----------|------------------|--------------------------|
| Emails | Emails | `9f7749a7-d9ef-4202-800f-43f078f6b2f8` | `4276a9d4-6c1c-4c57-ba1e-35fedbcc47e2` |
| Attachments | Attachments | `2cb6e4f1-5051-4017-bdef-f616ea45063c` | `323fea5b-a5f2-4207-95b8-3366cf5a8eb6` |
| Email Threads | Email Threads | `9804562f-f121-4e3e-bb1b-95cb28f8b532` | `96086d1f-51ac-45e0-8b5b-aa004191cb5e` |
| CRM (routing target) | Core Operating Databases | `b322a7ec-23a9-4ceb-875e-52c07b00eadf` | `62b0fe02-b076-4543-a6c1-f7c7dc3caa8d` |
| Real Estate Requests | Real Estate Requests | `63afa145-3753-4693-a391-d32fb5224bc0` | `4fbf7c35-5fd2-4288-983c-489572b1f973` |
| Contacts | Contacts | — | `45ad22a5-9a65-4b54-b42f-4e7715158c82` |
| Companies | Companies | — | `059f9b6a-a37e-4cc4-9ceb-c4bae7648ed8` |
| Tasks | Tasks | `8b05d37a-d368-42a7-8c2f-6a1c624ef702` | `92aced7a-95a5-47cb-803d-2ac67b12cfc8` |

### Fields written
**Emails:** Subject (title), Sender Name, Sender Email, Recipient, CC, BCC, Date, Full Body
(≤1900 chars), Summary, Phone Numbers, Gmail Labels, Message ID, Thread ID, Direction,
AI Classification, AI Priority, Sentiment.

**Attachments:** File Name (title), File Type, File Extension, File Size (bytes), Download URL
(Drive), Drive File ID, Source Email Subject, Message ID, Thread ID, Upload Date,
Attachment Status = Downloaded.

> Columns added by this integration: Emails → `Phone Numbers`, `Gmail Labels`, `Direction`,
> `CRM Lead` (relation), `Real Estate Request` (relation); the existing `Thread` and
> `Attachments` relations are populated by the Router. Attachments → `Message ID`,
> `Thread ID`, `Drive File ID`.

## Storage & credentials

- **Drive folder:** `BP Email Attachments` (id `1JrneNTS2v13cxg4rMgGcjWakP_2NGGoy`)
- **Credentials (auto-bound in n8n):** Gmail OAuth2, Notion OAuth2 API, OpenAI account,
  Google Drive OAuth2 API, WhatsApp (`Business Partner connection 2`,
  phoneNumberId `1216029938250852`).
- **WhatsApp alert recipient:** `966530540231`.

## Running the historical backfill

The "Run Historical Backfill" branch fetches the most recent labeled emails
(`Fetch Labeled Emails`, default limit **25**, `has:userlabels`, read+unread).
De-dup makes re-runs safe. To archive **all** history in one pass, set that node's
**Return All = true** (heavier: one AI call + Notion write per email), or walk history in
date windows via the `Received Before` filter.

## Known limitations / next steps

- **WhatsApp free-form** (per current choice) only delivers inside the 24h customer-service
  window. For guaranteed 24/7 alerts, switch the WhatsApp node to an approved **template**.
- **Phone extraction** is regex-based and can pick up long numeric tracking IDs in
  marketing emails; refine the pattern if noisy.
- A native **Notion notification** can be enabled in the Emails DB (Notion → database →
  Automations → notify on new page) for an in-app alert without extra n8n cost.

## Router & Linker (`BP — Email CRM Router & Linker`, id `fzYZhTk5QMUxQ6UX`)

A second, **idempotent** workflow that reads the Emails DB and wires up relations +
content-based routing. Safe to re-run (manual `Run Linker` trigger or every 15 min); each
branch only writes when the target relation is still empty.

```
Run Linker / Every 15m ─► Get All Attachments ─► Get All Threads ─► Get Emails
                                                                      │
                                            Plan Links & Routing (Code, per email)
                                                                      │
        ┌───────────────┬───────────────┬───────────────┬───────────────┐
   Has Attachments?  Route Real     Route CRM Lead?  Link Existing   Create New
        │            Estate?             │           Thread?          Thread?
  Link Attachments  Create RE Req   Create CRM Lead  Link Email→     Create Email
     to Email                                        Thread          Thread
```

- **Attachment linking:** matches Attachments to their email by **Message ID** and fills the
  Emails `Attachments` relation.
- **Thread find-or-create:** matches the email's **Thread ID** against the Email Threads DB.
  If a thread exists → set the email's `Thread` relation; if not → create the thread (setting
  its `Thread ID` + `Emails` relation). Because a freshly-created thread's back-link is set on
  the *next* pass, thread wiring self-heals across two runs.
- **Content routing (genuine inbound mail only):**
  - `AI Classification = Real Estate` → create a **Real Estate Requests** row (with client
    email/name, subject, Message ID, Date, `Status = New`) linked to the email.
  - Client-intent classes (Company Formation, Foreign Investment, Premium Residency,
    Recruitment, GRO, HR Services, Tourism, Medical Tourism, Government Relations, Business
    Development) → create a **CRM** lead (`Status = New Lead`, `Lead Source = Other`,
    `Service Interest` mapped from the class — consultations map to `Consultation`).
- **Junk guard:** skips automated/newsletter senders (no-reply / notify / newsletter
  addresses, and a domain blocklist incl. github, notion, google, moyasar, tokenizer,
  mailchimp, stripe, paypal, …) and subjects matching `newsletter|weekly|digest|unsubscribe|
  نشرة|رسالة اخبارية`. New leads land as `New Lead` so they can be reviewed before promotion.
- **Design note:** the two lookup nodes (`Get All Attachments`, `Get All Threads`) have
  **Always Output Data** on. They sit ahead of `Get Emails` in the chain, so if either DB is
  empty a 0-item output would otherwise starve the rest of the workflow.

## Category views (Emails DB)

Gmail-label / classification-based views were added to the Emails DB for browsing:

- **📁 By Category** and **By AI Classification** — board grouped by `AI Classification`.
- **By AI Priority** and **🔴 High Priority** — grouped / filtered by `AI Priority`.
- Filtered tables: **🏢 Real Estate**, **🏗️ Company Formation**, **🧾 Invoices**,
  **📣 Marketing** (each filtered on its `AI Classification`).
- **All Emails** / **Recent Emails** — full tables (Recent sorted by Date desc).
