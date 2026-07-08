# Business Partner Compliance Agent — Audit, Architecture & Build Plan
**وكيل الامتثال التشغيلي من بزنس بارتنر**

Product: Business Partner Platform 3.0 (BP3) — first product is the Compliance Agent.
Positioning (client promise):

> **AR:** «اشترك معنا، وخلّي عندك فريق امتثال وتشغيل حكومي يتابع شركتك يومياً، ينبهك قبل المخالفات والانتهاءات، ويرتب لك كل إجراء بموافقتك.»
> **EN:** "Subscribe and get a virtual compliance operations team that monitors your company daily, alerts you before expiries or violations, and prepares every required action for your approval."

Architecture principle (already adopted in the workspace):
**Notion = brain/source-of-truth · n8n = orchestration · Claude = reasoning · Website/WhatsApp/Email = client layer · Human Approval = mandatory before any official/financial/government/payroll/platform action.**

---

## 1. Current-State Audit

### 1.1 What already exists (reuse — do NOT recreate)

**Notion databases** (under `🛡️ Governance Compliance Control Center` → `390d108dee5c81da90f7ffc210d547f0`):

| DB | ID | Role |
|---|---|---|
| 🛡️ BP3 Compliance Register | `7258a07449a6444fadc186a61cc3a77e` | Per-establishment obligation items (Qiwa/Muqeem/GOSI/Mudad) — the monitoring source |
| 🚨 BP3 Compliance Alerts — Audit Trail | `6879f59096784a2798574c3777882e67` | Audit trail + human-approval gate |
| 🗂️ BP3 Client Compliance Intake | `5d570a75009b41019857060d0670642f` | Received client files + Drive links (doubles as "Companies") |

**Knowledge pages:** Governance Control Center; Compliance Command Center dashboard (6 views); Compliance Intelligence Hub; Government References & Compliance Library (`391d108dee5c8136aebce153852064e7`); HRSD Source Hub (83 official files); Saudization decisions reference (`444da06d963242b0be1b8d486bafdf74`); Fees & Compliance engine page (`390d108dee5c8182ae1fd2c9efd6868d`); Paid Compliance Platform spec/roadmap (`395d108dee5c81ca960cf5b0325bc377`).

**n8n workflows (compliance-relevant):**

| Workflow | ID | State | Maps to |
|---|---|---|---|
| 🛡️ BP3 Compliance Agent V1 (daily 07:00) | `DXfVlWVFHyU7eoBE` | active | Workflow C (Assessment) + D (Daily Report) |
| 🗂️ Client Intake (Drive form) | `Ei5FY8iiLooTjEm6` | active | Workflow A (Intake) |
| 🌐 Client Intake — Webhook + notifications | `R71kgwaBNw6WzKFI` | active | Workflow A (site form path) |
| 🔗 Client-file analyzer (Nitaqat+costs, daily 07:30) | `OfesoKDnsVO1IdEk` | active | Assessment enrichment |
| 🟢 Nitaqat Calculator (Execute-Workflow callable) | `bklN7C6F08NJ7TJE` | callable | Rules (Saudization) |
| 💰 Fees Calculator (Execute-Workflow callable) | `fUBftwquKyBuRJ0P` | callable | Rules (fees/fines) |
| BPIC Government Updates Monitor v1 | `kaBWVC2iDRhgtCQZ` | active | Regulatory-change feed |
| 🛡️ Compliance Agent — Chat (Groq + GOSI tool) | `qlf0NpE3OxOzN966` | active | Conversational agent |
| 🏦 GOSI Engagement Deduction (DPoP API) | `FlBeLfyjQaSpPAzR` | draft | V2 official-API foundation |

**Website:** Astro marketing/app (`src/pages/ar|en/calculators.astro`, `src/components/Calculators.astro`) on branch `claude/n8n-agents-setup-74frtx`; static marketing site with `compliance-portal` + `compliance-calculators` on branch `claude/bpic-marketing-site-jvrnga`.

### 1.2 What is missing (real gaps → build targets)

1. **Uploaded Documents DB** — a first-class DB per file with `Extracted Fields JSON`, `Confidence Score`, `Needs Human Review`. Today files are only links inside intake. → **GAP**
2. **Workflow B — Document Extraction** — generic OCR/Claude-vision extraction from screenshots/PDF/Excel into structured facts + Compliance Register rows. Only a one-off manual extraction (49 residents) exists. → **GAP**
3. **Modular Rules Engine covering all platforms** — only Qiwa/Muqeem/GOSI/Mudad + fees today. ZATCA, Balady, Salamah, Ejar, National Address, MISA, Chamber, SASO/Saber/SFDA/Fasah are documented as knowledge but not encoded as rules. → **GAP** → `rules-engine.json`.
4. **Full intake schema** — current form lacks investor type, has-employees/expats/location/import/regulated-products, urgency, consent. → **GAP** → `intake-schema.json`.
5. **Compliance Reports DB** — reports are emailed but not stored as records with health score + counts. → **GAP**
6. **Human Approval Matrix** — as a first-class gate incl. payment-before-execution. Partially covered by Audit-Trail approval status. → **GAP (extend)**.
7. **Production Compliance Agent System Prompt** — the live chat agent has a good but non-final prompt. → `system-prompt.md`.
8. **Compliance Health Score** — only expected-Nitaqat band today. → defined in rules engine + report.

### 1.3 Duplicated / to consolidate

- **Two intake paths** (`Ei5FY8i...` n8n-hosted form + `R71kg...` site webhook) both write client files. Keep the **site webhook** (`R71kg...`) as the canonical public path (matches the site form) and treat the n8n-hosted form as internal/manual fallback. Do not add a third.
- Archived intake copies noted in the build log (`76LEwbHMU1tspbca`, `8d8zQu3hWA8muKt1`, `SJy1StLTISjn1eQv`) — leave archived.
- The two website branches each carry a calculators page — consolidation is a website task, tracked separately (not part of this compliance build).

### 1.4 Unsafe / needs attention

- **Secrets hygiene:** a GOSI API private key was pasted into chat earlier and must be regenerated; all secrets belong in n8n credentials/variables, never in chat or repo. (See `human-approval.md` + security section of `system-prompt.md`.)
- **`$env` is blocked** on this n8n instance — Code nodes must read config from `$vars` (guarded) only.
- **Government portals block automated scraping (403)** — V1 must rely on client-supplied uploads/screenshots, not scraping. Official data only via sanctioned APIs (GOSI/Masdr) with authorization (V2).
- **No password/OTP in public chat** — Nafath/OTP/authorization is a secure, owner-initiated approval step, logged in the audit trail. Enforced in the system prompt.

---

## 2. Target Architecture (consolidated)

```
                 ┌─────────────────────────────────────────────────────────┐
  CLIENT LAYER   │ Website form · WhatsApp · Email · Manual admin entry      │
                 └───────────────┬─────────────────────────────────────────┘
                                 │ intake (intake-schema.json)
                 ┌───────────────▼──────────────┐
  INTAKE (A)     │ WF A: validate → upsert       │  Notion: Client Intake / Companies
                 │ Company → store files (Drive)  │  Drive: per-company folder
                 └───────────────┬──────────────┘
                                 │ new file event
                 ┌───────────────▼──────────────┐
  EXTRACTION (B) │ WF B: classify doc → Claude    │  Notion: Uploaded Documents (NEW)
                 │ vision/OCR → fields+confidence │  low-confidence → Needs Human Review
                 └───────────────┬──────────────┘
                                 │ upsert obligation items
                 ┌───────────────▼──────────────┐
  ASSESSMENT (C) │ WF C: read Register → Rules    │  Notion: Compliance Register
                 │ Engine → risk/expiry/health →  │  rules-engine.json + Nitaqat/Fees calcs
                 │ alerts → approval decision     │  → Alerts / Audit Trail
                 └───────────────┬──────────────┘
                                 │
                 ┌───────────────▼──────────────┐
  REPORT (D)     │ WF D: daily 07:00 Riyadh →     │  Notion: Compliance Reports (NEW)
                 │ AR+EN report → email + WhatsApp│  Email + WhatsApp templates
                 └───────────────┬──────────────┘
                                 │ high-risk / action needed
                 ┌───────────────▼──────────────┐
  APPROVAL (E)   │ WF E: create approval request  │  Notion: Human Approval Matrix
                 │ → notify → wait → (paid?) →     │  payment-before-execution gate
                 │ execution task / close → log   │  Audit Trail
                 └──────────────────────────────┘

  REASONING: Claude (claude-sonnet-4-6) everywhere reasoning is needed.
  CONVERSATION: WF qlf0NpE3OxOzN966 (chat agent) reads Register/knowledge, calls tools.
```

### 2.1 Notion data-model mapping (required → actual)

See `notion-mapping.json` for the machine-readable version. Summary:

| Required DB | Action | Target |
|---|---|---|
| Companies | **Extend** existing Client Intake DB with: Investor Type, Subscription Plan, Compliance Health Score, Risk Level, Last Report Date, Main Contact | `5d570a75…` |
| Compliance Register | **Reuse** | `7258a074…` |
| Compliance Alerts / Audit Trail | **Reuse** | `6879f590…` |
| Uploaded Documents | **Create** | NEW (child of Control Center) |
| Compliance Reports | **Create** | NEW (child of Control Center) |
| Human Approval Matrix | **Create or extend Audit Trail** with payment/execution fields | NEW or `6879f590…` |

> Rationale for not auto-creating DBs in this pass: the workspace already has a curated Control Center hierarchy; creating DBs without confirming the parent/relations risks orphan duplicates. The mapping file + field lists are the exact spec to create them under the Control Center. Marked **TODO-NOTION** in the plan.

---

## 3. Implementation Plan (phased)

### Phase 1 — Working V1 Concierge MVP (no expensive integrations)
- [x] Daily monitoring + AR report + team email (exists: `DXfVlWVFHyU7eoBE`).
- [x] Client intake form + Drive + Notion (exists: `R71kg…`, `Ei5FY8…`).
- [ ] **Upgrade intake** to full `intake-schema.json` (add investor/employees/expats/location/import/regulated/urgency/consent). — *website + WF A*
- [ ] **Uploaded Documents DB** + **Workflow B (extraction)** — Claude vision on uploaded PDFs/screenshots → fields + confidence → Register rows; low confidence → "Missing Data" task. **[TODO-NOTION + TODO-N8N]**
- [ ] **Rules Engine v1** (`rules-engine.json`) loaded by Workflow C — extend beyond Qiwa/Muqeem to CR/ZATCA/Balady/Salamah/Ejar/National Address/Chamber/MISA routing.
- [ ] **Health Score** + report counts stored in **Compliance Reports DB**. **[TODO-NOTION]**
- [ ] **WhatsApp report** live (Meta template `bp_compliance_alert` — already drafted; needs Meta approval).
- [x] **Production system prompt** applied to chat agent (this pass).

### Phase 2 — Better extraction & reporting
- Higher-accuracy extraction (per-platform parsers: GOSI Excel, Muqeem export, Qiwa PDF), confidence thresholds, human-review queue UI in Notion.
- Bilingual PDF/HTML report artifact stored + linked; per-client dashboard (Vercel).
- Subscription/payment-before-execution gate wired into Approval (WF E).

### Phase 3 — Integrations / API-ready
- Official APIs where sanctioned: **GOSI/Masdr** (foundation built: `FlBeLfyjQaSpPAzR`), then others as access is granted.
- Secure authorization sessions (Nafath/OTP) as owner-initiated, audited approval steps — never in public chat.
- Periodic sync, full audit logs, multi-client subscriptions, role-based access, per-client dashboard.
- Do not hard-code assumptions blocking V2/V3 (rules engine + schema are data-driven and platform-modular by design).

---

## 4. Test Scenarios (for QA of Workflow C + rules engine)

Each scenario = a Company + Register/Uploaded rows → expected alerts. Encoded in `test-scenarios.json`.

1. **Expired Muqeem item** — Iqama expiry in the past → **Critical**, human approval required (renewal), evidence = Muqeem export.
2. **Qiwa issue** — work permit expiry within 7 days / profession mismatch → **High**, action = renew/correct via Qiwa, approval required.
3. **GOSI/Mudad missing data** — no GOSI Excel / no Mudad WPS status → **Medium** "Missing Data" tasks, no approval (data request only).
4. **Foreign investor → MISA** — Investor Type = foreign and no MISA license on file → **High**, route to MISA license check + expiry.
5. **Physical location → Balady/Salamah/Ejar** — Has location = yes and missing municipal license / Civil Defense cert / Ejar contract → **Medium/High** per item.
6. **Import / regulated product → SASO/Saber/SFDA/Fasah** — Has import or regulated products = yes → routing tasks to the relevant authority.
7. **Incomplete uploads** — required doc types missing → "Missing Documents" list + low health score, no false "compliant".

---

## 5. Files in this bundle

| File | Purpose |
|---|---|
| `00-AUDIT-AND-ARCHITECTURE.md` | This document |
| `system-prompt.md` | Production Compliance Agent system prompt (bilingual, full structure) |
| `rules-engine.json` | Modular rules engine (platforms, risk, approval, evidence, AR/EN messages) |
| `intake-schema.json` | Full intake schema (all required fields) |
| `notion-mapping.json` | Required DB → existing/NEW Notion mapping + field specs |
| `templates/email-report.html` | Bilingual daily email report template |
| `templates/whatsapp-report.md` | Bilingual WhatsApp summary + Meta template shape |
| `human-approval.md` | Human approval + payment-before-execution logic |
| `test-scenarios.json` | QA scenarios for the rules engine |
| `n8n-workflow-blueprints.md` | Blueprints A–E mapped to existing/new workflow IDs |

> Everything here is **bilingual-ready** and **platform-modular**: adding a platform = adding rows to `rules-engine.json` + (optionally) an extraction parser; no code changes required to the assessment loop.
