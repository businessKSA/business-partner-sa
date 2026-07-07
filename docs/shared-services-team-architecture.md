# Business Partner — Shared Services Team

Operating architecture, current-state audit, and phased build plan for the
Shared Services Team subscription product ("your smart executive team").

> Positioning: the agents are the **client's own AI staff**, not a company
> selling one-off services. Khaled (Chief of Staff) understands a request,
> routes it to the right specialist, they execute and log the work in Notion,
> and only decisions that bind money/signature/government are escalated to a
> human. Available by text and voice from every page of the live site.

---

## 1. Current-state audit

What already exists (reuse — **do not recreate**), what is missing, and what
must never be duplicated.

### 1.1 Live website (project `business-partner-sa-businessksa`, new.businesspartner.sa)

| Asset | Path | State |
| --- | --- | --- |
| Shared Services sales section | `src/components/SharedServices.astro` | ✅ Live, AR+EN, CTA → `/voice` |
| Homepage placement (AR) | `src/pages/ar/index.astro` | ✅ Renders `<SharedServices>` |
| Homepage placement (EN) | `src/pages/en/index.astro` | ✅ Renders `<SharedServices>` |
| Voice/chat page | `src/pages/voice.astro` | ✅ Web Speech STT/TTS, calls `/api/voice` |
| Voice proxy → Khaled | `src/pages/api/voice.ts` | ✅ Forwards to Khaled chat webhook |
| Specialist proxy registry | `src/pages/api/agent.ts` | ✅ 7 agents, `live:true` |
| Floating assistant button | `src/components/AssistantFab.astro` | ✅ On every page via BaseLayout |
| Internal AI-team directory | `src/pages/ai-team/*` | ✅ Hidden (noindex) |
| Client dashboard / account | `src/pages/account.astro`, `dashboard.astro` | ✅ Exists |

**Missing on the site:** a structured **founder intake form** (Stage 1 of the
journey) that captures idea/stage/sector/budget and opens a Client record.

### 1.2 n8n (businesspartnerai.app.n8n.cloud)

| Workflow | ID | Role |
| --- | --- | --- |
| Khaled — Web Chat (orchestrator) | `ZvPryyHTAVNqUtGF` | ✅ Routes to 6 specialists + logs to Notion |
| Farah — Marketing | `vWICtJIGL4Cu7NXy` | ✅ `farah-intake`, Gemini flash-lite |
| Badr — Sales | `nvrh0c3mUctb1EsG` | ⚠️ `badr-intake`, still on Anthropic (0 credits) |
| Malak — Assistant | `7CxR4ecw92hYHIfq` | ✅ `malak-intake` |
| Mohammed — IT | `e9G9S6GG0j7lCiWt` | ✅ `mohammed-intake` |
| Ahmed — Procurement | `8PGiUitiRKDybt3l` | ⚠️ path mismatch (see §5) |
| Abdulaziz — Legal/Compliance | `SL1aYYS2UBsqHFPE` | ✅ `abdulaziz-intake` |
| Mazen | `WZE7oUzCzQGR1u0t` | ✅ `mazen-intake` |
| **Lead Consultant** | `fjXdJCgt1jDbzKkC` | ✅ `consultant-intake`, **Groq** |
| **Market Research** | `5slajhpFDal0SCqi` | ✅ `market-intake`, **Groq** |
| **Business Model** | `IEZoSpEJR5FiSo8L` | ✅ `model-intake`, **Groq** |
| **Finance & Pricing** | `SwrEPSRIz6utN51c` | ✅ `finance-intake`, **Groq** (placeholder pricing, `human_required`) |

All four new agents are wired into Khaled as `ai_tool`s and registered in the
site proxy (`consultant`/`market`/`model`/`finance`).

**Quota solution:** the four new agents run **Groq (llama-3.3-70b)** as the
primary engine — free tier is ~14k requests/day vs Gemini's 20/day, so the old
Gemini cap no longer gates them. Khaled and the original 6 specialists still use
Gemini `2.5-flash` → `2.5-flash-lite`; migrating them to a Groq fallback (as
Ahmed already has) would remove the cap there too.

### 1.3 Notion (mature workspace — heavy reuse)

| Existing asset | ID | Maps to brief concept |
| --- | --- | --- |
| AI Executive Team hub | `392d108d-ee5c-81ea-9e4b-f01fa2bb2f45` | Home / governance |
| Team Tasks DB | `77796c09-9718-4ec0-8f80-1ab02a409070` | **Agent Tasks** (reuse) |
| Shared Services Catalog | `54726500-2d96-497d-9eb3-96e9ed3d4d9d` | Packages/catalog |
| Human Approval Agent prompt | `44dca6fa-ebb6-48c5-bcfb-dac180cfb68e` | **Approval Manager** |
| SOP — Human Approval & Escalation | `387d108d-ee5c-8144-8738-f7067cd656d4` | **Approval rules** |
| SOP — Proposal Generation | `387d108d-ee5c-817d-b58a-d72e0fed68a5` | Proposal flow |
| Proposal Generator Workflow | `382d108d-ee5c-8183-ac5a-fb601320eedb` | Reports/proposals |
| Shared Services Knowledge | `598ca869-f0ac-4bb3-865b-abd0e2b5aa54` | Research & Decisions seed |
| Sales Pipeline / CRM | (existing) | **Clients** (client/lead record) |
| الشركة الافتراضية (Virtual Company) | `390d108d-ee5c-8146-aef3-ceda05abbd01` | **Virtual Teams** (10 depts = agents, TEAM-00x roster) |
| Entrepreneur Journey | `38cd108d-ee5c-813c-aa97-dcb027fe4e2f` | Founder journey (stages) |
| Business opportunities | `395d108d-ee5c-8021-976a-ee742185adde` | **Business Ideas** |

**Audit conclusion — every brief-named DB already has an equivalent, so we
create NONE and reuse instead:**

| Brief DB | Reuse |
| --- | --- |
| Clients | Sales Pipeline / CRM |
| Business Ideas | "Business opportunities" + idea/opportunity pages |
| Virtual Teams | "الشركة الافتراضية / Virtual Company" (TEAM-00x) |
| Agent Tasks | Team Tasks DB `77796c09…` |
| Research & Decisions | Shared Services Knowledge |
| Reports | Proposal Generator workflow |
| Approval Requests | Human Approval Agent + Escalation SOP |

> ⚠️ This workspace was built by several sibling agents and is already mature.
> **Creating new databases here is a hard-to-reverse, duplication-prone action**
> that would fragment the CRM/tasks/approvals. Per the brief's own "do not
> duplicate" rule, no new DBs are created. If a genuinely-absent structure is
> later needed (e.g. a *queryable* Approval Requests log distinct from the SOP),
> add it under the hub `392d108d…` only after confirming the gap.

---

## 2. Target architecture

```
              ┌─────────────── Website (new.businesspartner.sa) ───────────────┐
              │  SharedServices section · Founder intake form · /voice (STT/TTS)│
              └───────────────┬───────────────────────────┬────────────────────┘
                              │ /api/voice · /api/agent    │
                              ▼                            ▼
                    ┌──────────────────┐          ┌──────────────────┐
                    │ Khaled — Chief   │  routes  │ Specialist team  │
                    │ of Staff (Router)│─────────▶│ Farah Badr Malak │
                    └────────┬─────────┘          │ Mohammed Ahmed   │
                             │                     │ Abdulaziz + new: │
                             │                     │ Consultant·Market│
                             │                     │ ·Model·Finance   │
                             ▼                     └────────┬─────────┘
                    ┌──────────────────┐                    │
                    │ Human Approval   │◀───────────────────┘  (escalate binding actions)
                    │ Manager          │
                    └────────┬─────────┘
                             ▼
   Notion: Clients · Business Ideas · Virtual Teams · Agent Tasks ·
           Research & Decisions · Reports · Approval Requests
```

### 2.1 Base agent I/O schema (every specialist returns this)

```json
{
  "agent": "farah|badr|malak|mohammed|ahmed|abdulaziz|consultant|market|model|finance",
  "reply": "human-readable answer in the client's language",
  "task_summary": "one line for the Agent Tasks log",
  "specialty": "marketing|sales|assistant|it|procurement|legal|research|...",
  "priority": "low|medium|high",
  "integrations_touched": ["notion","whatsapp","email","microsoft"],
  "human_required": false,
  "approval_reason": "why a human must approve, if human_required=true",
  "proposal_ready": false,
  "engine_fallback": false
}
```

### 2.2 Routing map (Khaled → specialist)

| Intent signal | Route to |
| --- | --- |
| Idea unclear / "where do I start" | **Lead Consultant** (4–6 questions) |
| Market size, competitors, demand | **Market Research** |
| Revenue model, unit economics | **Business Model** |
| Pricing, costs, budget | **Finance/Pricing** (never hard-codes price) |
| CR, license, tax, compliance | **Abdulaziz — Legal/Compliance** |
| Leads, outreach, CRM, deals | **Badr — Sales** |
| Content, brand, campaigns | **Farah — Marketing** |
| Systems, e-commerce, IT | **Mohammed — IT** |
| Vendors, quotes, purchase | **Ahmed — Procurement** |
| Scheduling, docs, admin | **Malak — Assistant** |
| Anything binding → | **Human Approval Manager** first |

---

## 3. Human Approval rules (non-negotiable)

A human must approve **before**: price commitment · contract/invoice ·
government-platform action · vendor purchase order · payment · legal/tax/
compliance decision · official letter · use of client authorization ·
publishing a website/payment/campaign as final · any external communication
that binds Business Partner or the client.

Guardrails: never request passwords or OTPs in public chat · never store
credentials · authorization flows must be secure, explicit, logged, and
initiated by the authorized person · always **separate recommendation from
execution** · keep an audit trail of recommendations, approvals, and actions.
Pricing stays **placeholder-only** until a human sets it.

---

## 4. Phased build plan

| Phase | Deliverable | Depends on |
| --- | --- | --- |
| **1 — Advisory MVP** *(mostly done)* | Khaled + 6 specialists live, voice, site section | ✅ shipped |
| **1b — Founder intake** | Website intake form → Client record + Khaled kickoff | site only |
| **2 — Orchestration + reports** | Lead Consultant + Market/Model/Finance agents; task logging → Reports | new n8n workflows |
| **3 — Client dashboard + packages** | Per-client view of tasks/approvals; Starter/Growth/Operate/Custom (placeholder pricing) | Notion DBs + auth |
| **4 — Deeper automation** | WhatsApp/email report delivery, Microsoft/Notion client-side connect | connectors |

**Reasonable assumptions (mark as TODO to confirm):**
- Packages Starter/Growth/Operate/Custom exist as tiers with **no** hard-coded
  price — pricing is a placeholder resolved by a human. *(TODO: confirm tier names)*
- All seven brief DBs map to existing structures (see §1.3 audit conclusion) —
  **no new databases are created**; the operating layer reuses them.

---

## 5. Known issue — Ahmed webhook path mismatch

- `src/pages/api/agent.ts` registry → `ahmed-procurement`
- Khaled orchestrator tool (`ZvPryyHTAVNqUtGF`) → `ahmed-intake`

Only one matches Ahmed's real webhook (`8PGiUitiRKDybt3l`). **Do not blind-edit
either consumer** — the wrong change breaks a currently-working path. Resolution
requires reading the live workflow in n8n (n8n MCP was erroring at audit time).
Fix: read Ahmed's Webhook node path, then align the *other* consumer to it. TODO.

---

## 6. Website founder intake form (Phase 1b spec)

Minimal, non-duplicative front door (the existing `Contact` form is generic).

Fields: `full_name` · `phone` (no OTP) · `email` · `company_or_idea` ·
`stage` (idea | validating | licensed | operating) · `sector` ·
`goal` (free text) · `budget_band` (placeholder bands, no committed price) ·
`preferred_channel` (whatsapp | email | call).

On submit → `POST /api/agent` with `agent:"khaled"` seeding a kickoff message,
create a Client/lead row in the CRM, and reply with the next 4–6 consultant
questions. Never binds anything; anything sensitive routes to Human Approval.

---

## 7. Test scenarios

1. "عندي فكرة مطعم، من وين أبدأ؟" → Lead Consultant asks 4–6 questions, logs task.
2. "أبغى دراسة سوق لتطبيق توصيل بالرياض" → Market Research summary + sources.
3. "كم أسعّر اشتراكي الشهري؟" → Finance returns a *placeholder* model, escalates final price to Human Approval.
4. "سجّل لي سجل تجاري" → Abdulaziz outlines steps; execution/gov action → Human Approval.
5. "اكتب لي بوست لينكدإن عن إطلاق منتجنا" → Farah drafts, logs to Notion.
6. "أحتاج عروض أسعار من موردين" → Ahmed gathers; any purchase order → Human Approval.
7. "رتّب لي اجتماع الأسبوع الجاي وابعث تذكير" → Malak schedules/reminds; external send → confirm first.

Expectation for all: correct routing · base JSON schema returned · task logged ·
binding actions blocked behind Human Approval · placeholder-only pricing.
