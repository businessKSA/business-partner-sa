# BPOS Enterprise Continuation — Phases 1–6 (2026-07-28)

Continuation of the Business Partner Operating System (BPOS) inside the existing Notion
workspace. Nothing was rebuilt: every change below extends the production architecture
documented on **09 — BPOS Master Architecture & Implementation**
(`3aad108d-ee5c-8114-9eb2-d89f3b0e22f2`), which also carries the same implementation log.

## 1. What was inspected

Full schemas (properties, relations, formulas, rollups, option IDs) of:

| Database | Database ID | Data Source ID |
|---|---|---|
| Network Companies — Master Business Graph | `c79ad460-74c2-45e7-ab84-bc1471081c91` | `a4107b2c-12dc-4140-a235-3b1964f4d94e` |
| Network Contacts — Decision Makers | `728464a5-b614-4d70-8bb2-925bd594b95f` | `b8d26538-8a10-4b42-9ebf-14001f21eb12` |
| Deals, Introductions & Commissions | `77c0873a-4298-4ade-b62f-4dc21bd5af89` | `360e05fd-d4fb-4a8d-b01f-93285915bb30` |
| Mandates — Customer & Supplier Requests | `78e2c191-7709-466b-a55a-afdb041548ab` | `9e0ab631-7a70-4fb8-b5d2-461dafec1f6a` |
| Automation Execution Log | `be45ffbe-0b87-43a6-8752-fb9ca9d2c918` | `7b2f0522-93b9-4243-b6f8-9d8707e561e3` |

Also confirmed (untouched): Match Queue (`e1064d06-…`), Meetings (`e71da8be-…`),
Outreach Campaigns (`439c2367-…`), Supplier Offers (`2a523677-…`), Backlog, Migration Queue,
Operations Dashboard (13), SOPs 09–14.

## 2. What already existed (not rebuilt)

Core 11 databases, canonical relations, commission tracking (Due/Paid/Balance, Payment
Status/Reference/Date), Environment + Production Ready gates, review flags, Automation
Execution Log, pilot acceptance test (PASS), Production Intake SOP.

## 3. What was added

### Phase 1 — Advanced CRM (extensions only, no new databases)

Companies (`a4107b2c`):
- Scores: `Customer Health Score`, `Partner Score`, `Supplier Score`, `Lead Quality Score`,
  `Relationship Score`, `Scores Updated` (all n8n-maintained, 0–100).
- `Lifetime Value` — rollup: sum of `Collected Revenue` over `Client Deals`.
- Graph self-relations: `Referred By` ↔ `Referrals Made`, `Partner Network` ↔ `Partner Of`,
  `Duplicate Of` ↔ `Duplicates`.
- Governance: `Duplicate Check` (Not Checked/Unique/Possible/Confirmed/Merged),
  `Blacklisted` + `Blacklist Reason`, `Conflict Flag` + `Conflict Notes`, `Risk Score`,
  `Risk Level` (formula: Blacklisted→Critical, ≥70 High, ≥40 Medium, >0 Low, else Unscored),
  `Compliance Flags` (KYC/Sanctions/NDA/Disclosure/Regulatory/Consent/Data Expired).
- Sector taxonomy defect from the pilot closed: added `Corporate Services` and `Real Estate`
  options — existing option IDs verified unchanged.

Contacts (`b8d26538`): `Lead Quality Score`, `Relationship Score`, `Duplicate Check`,
`Duplicate Of` ↔ `Duplicates`, `Compliance Flags` (Consent Missing / Do Not Contact
Request / Data Expired).

### Phase 2 — Commercial Engine

| New database | Database ID | Data Source ID |
|---|---|---|
| Commission Rules | `5d935c57-0e8d-4a41-95ee-580edafba92f` | `89c4e24e-7506-487a-b922-41c1795521cb` |
| Commission Splits — Multi-Party & Revenue Share | `11af3e54-9d39-49d0-8282-882daf7327a0` | `8376ee30-80c0-4dd7-a80c-418e632e00ba` |
| Finance Documents — Invoices, Receipts & Credit Notes | `0fb7d3c7-0228-41ea-b2ad-5af9c54c0240` | `a8d90406-1d3d-442b-93ac-6967a963b3e9` |

- Commission Rules: scope (Global/Sector/Company/Mandate/Deal), basis, Rate % / Fixed
  Amount, deal-value band, priority, effective dates, `Approval Required Above`.
- Commission Splits: per-deal beneficiary allocation (Agency/Partner/Referrer/Supplier/
  Internal), % or fixed, payment lifecycle. Covers split commission, multi-party commission,
  revenue share, partner revenue and agency revenue.
- Finance Documents: one AR ledger for Invoice / Receipt / Credit Note. Formulas: VAT
  Amount, Total Amount, Balance Due. Reconciliation (`Reconciliation Status`, `Bank
  Reference`), collections (`Collection Stage` None→Reminder 1→Reminder 2→Final
  Notice→Escalated→Legal), `Related Document` ↔ `Referenced By` self-relation for credit
  notes. Views: Collections Queue, Reconciliation Queue.
- Deals extended: `Win Probability %`, `Expected Close Date`, `Forecast Category`
  (Pipeline/Best Case/Commit/Closed Won/Closed Lost), `Weighted Pipeline Value` (formula).

### Phase 3 — Marketplace

| New database | Database ID | Data Source ID |
|---|---|---|
| Service Catalog — Marketplace Offerings | `77a15668-7944-433d-82d2-cdc502e01123` | `b0465b74-66d9-4d61-92e8-121c0accca16` |
| Ratings & Reviews — Supplier & Partner Performance | `183ff59c-24a6-434f-b9de-ce3857479d5f` | `e603c46c-ece0-42e4-af5a-2053e0785c53` |

Companies gained: `Capabilities`, `Certifications`, `Languages`, `Preferred Supplier`,
`Preferred Partner`, `Success Rate %`, `Average Rating` (rollup avg of Reviews.Rating),
`Review Count` (rollup count). New Companies views: **Supplier Directory** (Network Role
contains Supplier, sorted by rating) and **Partner Directory** (Network Role contains
Partner, sorted by Partner Score). Verified Supplier = Verification Status Verified +
Network Role Supplier (no duplicate flag added by design).

### Phase 4 — Automation infrastructure (n8n-ready)

| New database | Database ID | Data Source ID |
|---|---|---|
| Notifications & Alerts | `2971f036-8a81-413b-bc2b-5614ece8c928` | `b1ccf3c9-abb3-41cc-a728-234a0fc8876c` |
| Integration Log — Webhooks & API Calls | `2e7b7801-c194-4475-8bb0-5beac6da2126` | `4655efe5-8027-4089-b942-b17d25938e08` |
| Automation Queues — Retry, Approval, Review & DLQ | `091191a0-8085-4343-bc98-a7b80abd1450` | `6d8f0343-812c-4700-9d2f-ceaa814516ce` |

All three relate to the existing Automation Execution Log (execution log + audit trail +
timeline already covered there — Retry Count, Correlation ID, Started/Ended At). The queues
database carries four named views: **Retry Queue**, **Approval Queue**, **Human Review
Queue**, **Dead Letter Queue**.

### Phase 5 — Enterprise governance

| New database | Database ID | Data Source ID |
|---|---|---|
| Org Structure — Units, Territories & Legal Entities | `87798860-8d3b-4d31-90d4-ba6ae6510328` | `059d31c9-bc2a-48b0-90f9-d22cfc616c74` |
| Approval Matrix | `7c1bb99a-54d5-45a5-8b5c-f367b64d0b3a` | `fe46c700-160d-467b-a3ad-ec0410ee032e` |
| Roles & Permissions | `395c5716-4ed7-4bbd-ab5e-c71e0e835bac` | `117374db-470c-46ac-8d67-48ddcfb0cd57` |
| Governance Registers — Risk, Decision & Audit | `e6bdc359-004e-43c0-bd4c-e046006fdfe2` | `e7fac881-24e8-4f7b-a88c-65b9cccbd038` |
| Performance Framework — SLA, KPI & OKR | `26c9592d-1f46-4265-9655-bd11aee23f4d` | `b71d66c0-14b6-44ba-af6c-9a21381a3e0e` |

- Org Structure covers Business Units, Departments, Territories, Countries, Regions and
  Legal Entities in one typed hierarchy (`Parent Unit` ↔ `Child Units`).
- Governance Registers = Risk + Decision + Audit registers in one database with three
  filtered views (Risk Register / Decision Register / Audit Register).
- Performance Framework = SLA + KPI + OKR (Key Results link to Objectives via
  `Parent Objective` ↔ `Key Results`); metrics can attach to an Org Unit.

### Phase 6 — Dashboards (pages 15–21, linked views only, zero data duplication)

| Page | Page ID |
|---|---|
| 15 — Finance & Cash Flow Dashboard | `3abd108d-ee5c-810c-86a0-cf9bcba79e5d` |
| 16 — Sales & Pipeline Dashboard | `3abd108d-ee5c-8133-bb49-f057f7abc8dd` |
| 17 — Partner & Marketplace Dashboard | `3abd108d-ee5c-814b-ab23-dcf8df499649` |
| 18 — Compliance & Risk Dashboard | `3abd108d-ee5c-817a-a8e5-f9f1b76447df` |
| 19 — Automation Dashboard | `3abd108d-ee5c-8173-8c31-e04fd15b0135` |
| 20 — CEO & Executive Dashboard | `3abd108d-ee5c-81ac-bd9c-fefb3ce36529` |
| 21 — Recruitment Dashboard | `3abd108d-ee5c-8194-afe6-d4aaa898a532` |

The existing 13 — Operations Dashboard was not modified. CEO and Executive views are
consolidated on page 20 to respect the no-duplication rule.

## 4. Why it was needed

Moves BPOS from a validated pilot core to enterprise CRM/ERP grade: prioritization via
scores and risk, a rules-driven commission engine with multi-party splits, an AR ledger
with reconciliation and collections, a monetizable supplier/partner marketplace,
queue-based automation with human gates, and the governance registers required before
scaling production outreach.

## 5. Dependencies

- `Lifetime Value` ← Client Deals.Collected Revenue; `Average Rating`/`Review Count` ← Reviews.
- Commission Splits and Finance Documents hang off Deals; a split is payable only after
  the parent deal's revenue is collected.
- Approval Matrix rules materialize as Approval Queue items; DLQ items originate from
  failed Automation Execution Log entries with exhausted retries.
- The existing gate — Environment = Production AND Production Ready = Yes — remains the
  first check before any external communication; the Approval Matrix is the second.

## 6. Future automation opportunities (n8n)

1. Nightly scoring job writes the five scores + `Scores Updated` on Companies.
2. Duplicate detection on company/contact create (normalized name, domain, email) →
   `Duplicate Check` + `Duplicate Of` + Human Review queue item.
3. Commission engine: Deal → Revenue Collected ⇒ resolve highest-priority active
   Commission Rule ⇒ write Commission Due ⇒ generate Commission Splits ⇒ create Invoice.
4. Collections: daily overdue scan ⇒ escalate `Collection Stage` ⇒ Finance notification.
5. Approval flow: matrix match ⇒ Approval Queue ⇒ block action until Approved.
6. `Success Rate %` recompute from won/lost deals per company.
7. SLA/KPI actuals writer into the Performance Framework.

## 7. Risks

- Scores are automation-maintained; stale `Scores Updated` must alert.
- Blacklist/conflict enforcement is workflow convention, not Notion permissions — n8n must
  check `Blacklisted` and `Risk Level` before every outreach step.
- Records without `Environment` set must be treated as Test.
- Notion SQL querying is rate-limited on the current plan; automations should use view
  queries and webhooks rather than polling SQL.

## 8. Rollback strategy

All changes are additive: new properties, new databases, new views, new pages. Rollback =
`DROP COLUMN` on the added properties and trashing the new databases/pages. The only edit
to an existing property was appending two Sector options (removable; existing option IDs
verified unchanged). No production data was created, modified or deleted; no external
communication paths were enabled.

## Operational note discovered during implementation

When adding a **self**-relation pair via DDL, a single `ADD COLUMN … RELATION(self, DUAL
'Reverse' 'reverse')` creates both sides. Issuing a second explicit statement for the
reverse side creates a duplicate pair (suffixed " 1"). This occurred once on Companies and
the six empty duplicate properties were dropped immediately in the same session; all
subsequent self-relations used the single-statement form.
