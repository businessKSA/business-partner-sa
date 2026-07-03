# Email → Notion CRM + Drive + Alerts (n8n Integration)

Automation that ingests Gmail into the **live** Notion CRM, archives attachments to
Google Drive + Notion, and alerts the owner on WhatsApp. Built on the existing
`Business Partner AI CRM & Knowledge Base` databases (not the deprecated
`Business Partner OS` archive set).

- **n8n workflow:** `BP — Email → Notion CRM + Drive + Alerts` (id `ess3HEXGMPnZnzLH`)
- **Status:** Active (Gmail Trigger polls every minute)
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
| Contacts | Contacts | `503e58f2-e03d-420f-92bd-644133b913ef` | `45ad22a5-9a65-4b54-b42f-4e7715158c82` |
| Companies | Companies | `5e02269e-432e-480c-bdb6-8dc9178960e0` | `059f9b6a-a37e-4cc4-9ceb-c4bae7648ed8` |
| Leads CRM | Leads CRM | `60c3f89a-4f47-4206-9669-ff1c05ce043f` | `6c598a7c-86bf-4d2d-b6bf-3ae0a6e07f18` |
| Tasks | Tasks | `8b05d37a-d368-42a7-8c2f-6a1c624ef702` | `92aced7a-95a5-47cb-803d-2ac67b12cfc8` |

### Fields written
**Emails:** Subject (title), Sender Name, Sender Email, Recipient, CC, BCC, Date, Full Body
(≤1900 chars), Summary, Phone Numbers, Gmail Labels, Message ID, Thread ID, Direction,
AI Classification, AI Priority, Sentiment.

**Attachments:** File Name (title), File Type, File Extension, File Size (bytes), Download URL
(Drive), Drive File ID, Source Email Subject, Message ID, Thread ID, Upload Date,
Attachment Status = Downloaded.

> Columns added by this integration: Emails → `Phone Numbers`, `Gmail Labels`, `Direction`;
> Attachments → `Message ID`, `Thread ID`, `Drive File ID`.

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
- **Relations not yet auto-linked:** Emails/Attachments are joinable to Contacts, Companies,
  Leads, and Threads via Message ID / Thread ID text, but the Notion *relation* properties
  are left empty in v1. A follow-up "linker" pass (find-or-create Thread/Contact/Company/Lead)
  can populate them.
- A native **Notion notification** can be enabled in the Emails DB (Notion → database →
  Automations → notify on new page) for an in-app alert without extra n8n cost.
