# BP-Specialized-Team-Build-Brief.md
## بناء الفريق المتخصص — Specialized Team Agents (Claude Code + n8n + Notion)

> ⚠️ **Reconstructed — 2 July 2026.** The original brief file was authored for a parallel
> Claude Code session and was never committed to this repository. This version was rebuilt
> from the live Notion sources listed in §9 (the same sources the original was built from).
> Treat it as the working brief; flag anything that diverges from what Baher intended.

---

## 1. Background & Objective

Business Partner (بزنس بارتنر سلوشنز) is building its agent ecosystem on four pillars:

- **المكتب (Office)** = Notion — all knowledge and operating databases
- **المخ (Brain)** = n8n — runs the agents 24/7 (triggers, routing, approval gates, logging)
- **المحرّك (Engine)** = Claude (Anthropic)
- **مُعطي الأوامر (Commander)** = Baher, via Claude

This brief covers **Group 1 — the Specialized Team** (فريق الإدارة): five named persona
agents that handle the commercial and internal-operations layer of the business. Each agent
is built **one at a time as a template**, approved by Baher, then the pattern is repeated —
per Baher's own note in the 29 June draft: *"لا نبني 20 ايجنت مرة وحدة"*.

Operating model (V1): **Concierge** — agents receive, qualify, draft, and recommend 100%
automatically; anything outward-facing or official is executed by the BPIC human team after
a Human Approval gate. No agent ever handles OTP, passwords, or government execution.

## 2. Team Roster

| # | Agent | Role per TEAM cards (22 Jun) | Role per Baher draft (29 Jun) | Status |
|---|-------|------------------------------|-------------------------------|--------|
| 1 | **بدر Badr** | TEAM-003: Sales & Proposal Agent | Sales & Business Development Manager (full funnel) | ✅ Aligned — **build first** |
| 2 | **ملاك Malak** | — (no TEAM card) | Admin Manager / Personal Assistant | ✅ No conflict — build second |
| 3 | **أحمد Ahmed** | — (no TEAM card) | Procurement Manager | ✅ No conflict — build third |
| 4 | **محمد Mohammed** | TEAM-004: Legal & Compliance Review Agent | IT Manager (tech, website, APIs, subscriptions) | ⚠️ **CONFLICT — awaiting Baher's decision** |
| 5 | **فرح Farah** | TEAM-005: Operations Manager & Escalation Owner | Marketing Manager (content, channels, broadcasts) | ⚠️ **CONFLICT — awaiting Baher's decision** |

Role details (from sources):

- **Badr — المبيعات وتطوير الأعمال:** receives the client from every channel (social /
  website / email / call / chat), takes and updates requests in the CRM, owns quotations,
  packages, and pricing scope, prepares the draft proposal (and later the draft contract),
  follows up to payment and signature, then hands off to Operations. TEAM-003 guardrails:
  never invents prices, no discounts, no contract/invoice/payment link, no sensitive
  documents before contract, final proposal always reviewed by the team before sending.
- **Malak — المدير الإداري / المساعد الشخصي:** reminders for dates and appointments;
  summarising emails, chats, and meetings; sorting and filtering email; client account
  managers oversight; daily agenda and tasks (for the team and for Baher); dashboard
  updates; ordering each department's outputs; name sorting/filtering. *(OTP/verification
  handling from the draft is explicitly excluded — violates the global sensitive-data rule;
  keep it human-only.)*
- **Ahmed — مدير المشتريات:** researches, contacts, and negotiates with suppliers and third
  parties; feeds Sales (Badr) the supplier service/price lists.
- **Mohammed — conflict:** TEAM-004 = legal & compliance review of sensitive cases (foreign
  licensing, premium residency eligibility, contracts, disputes, official commitments)
  vs. draft = IT manager (agents, website, tech, government/company platforms, API
  integrations, third-party subscriptions).
- **Farah — conflict:** TEAM-005 = operations & escalation owner (human-intervention owner,
  approvals, document review, team coordination) vs. draft = marketing manager (content
  creation across LinkedIn/Instagram/Email/WhatsApp/TikTok/Snapchat/Facebook/X, regulatory
  news digests, SEO, broadcasts).

**Related but out of scope for this brief:** مازن Mazen (TEAM-001, WhatsApp customer service
& menu router — already live in the WhatsApp system), باهر Baher (TEAM-002, CEO/Advisor),
the Government Platform agents (Group 2), and the Shared Services team (Group 3 — separate
brief: `BP-Shared-Services-Build-Brief.md`).

## 3. Reference Pattern — GRO Agent System Prompt (النمط الموحّد)

Every agent prompt follows the approved **GRO Agent System Prompt** structure
(Notion, Status: Approved). The canonical skeleton:

1. Identity line — `You are {Name}, the {Role} Agent for Business Partner.`
2. **Your role** — one paragraph, plain scope.
3. **Main services** — bulleted commercial/functional scope.
4. **Your goals** — numbered, action-ordered.
5. **You can answer generally about** — safe territory.
6. **You must not** — numbered hard prohibitions.
7. **Qualification questions** — "Ask when needed", numbered; **max one question per message**.
8. **Sensitive data rule** — never request passwords / OTP / full credentials / sensitive
   identity data in chat; secure channel only after internal approval.
9. **Human Approval triggers** — "Escalate if:" bulleted list.
10. **Safe response example** — Arabic then English.
11. **Pricing response** — Arabic then English.
12. **Routing** — `condition → target Agent` lines.
13. Closing line — `End of {Name} Agent Prompt.`

Each prompt file wraps the system prompt in the same page frame as the GRO page:
**Summary · When to Use · System Prompt (copyable block) · Process Steps ·
Human Approval Rule**.

## 4. Project Structure

All work lives in this repository under `bp-specialized-team/`:

```
bp-specialized-team/
├── README.md                     # status board + how to use this folder
├── prompts/                      # one system-prompt file per agent (GRO pattern)
│   ├── badr-sales-bd.md          # 1st — template agent
│   ├── malak-admin-pa.md         # 2nd — after Badr is approved
│   ├── ahmed-procurement.md      # 3rd — after Malak
│   ├── mohammed-TBD.md           # blocked on role decision (IT vs Legal & Compliance)
│   └── farah-TBD.md              # blocked on role decision (Marketing vs Operations)
├── n8n/                          # one importable workflow skeleton per agent
│   ├── badr-workflow.json
│   ├── malak-workflow.json
│   ├── ahmed-workflow.json
│   ├── mohammed-workflow.json    # blocked on role decision
│   └── farah-workflow.json       # blocked on role decision
└── docs/
    ├── team-roster.md            # full roster, sources, per-agent scope
    └── conflicts-log.md          # role conflicts + options + decision log
```

Files marked *blocked* are **not created** until the corresponding decision/approval exists —
the folder only ever contains real, buildable content.

## 5. Build Order & Checkpoints

1. **Badr** — first fully-built template (foundation already exists: TEAM-003 card +
   CRM + Sales Pipeline databases). → **Checkpoint: Baher approves the template.**
2. **Malak** — repeat the pattern. (No TEAM card; source = 29 June draft.)
3. **Ahmed** — repeat the pattern. (No TEAM card; source = 29 June draft.)
4. **Mohammed** and **Farah** — **do not start** until Baher resolves the role conflicts
   in §8. If Baher wants both functions, the answer may be two agents per name-slot
   (e.g. keep TEAM-004/005 personas and add new named agents for IT and Marketing).

## 6. n8n Execution-Layer Conventions

Matches the live Compliance Agent V1 patterns (🛡️ BP3 Compliance Agent V1 — Qiwa & Muqeem):

- **One workflow per agent**, named `💼 BP Team — {Name} ({Role})`. Imported inactive;
  activated only after Baher's approval.
- **Triggers:** webhook intake (called by the Router / Mazen flow or the website) **plus**
  a manual test trigger with pinned sample payload.
- **Engine:** Claude (Anthropic) `claude-sonnet-5`. **Resilience rule:** if the Claude call
  fails (e.g. no Anthropic credit), the workflow continues with a pre-written safe fallback
  reply — the flow never dies with the engine.
- **Human Approval gate:** any outward-facing artifact (proposal, contract draft, broadcast,
  official reply) is written to Notion with status **«بانتظار الموافقة»** and is never sent
  automatically. Execution stays with the BPIC team.
- **Logging:** every run writes an audit record to Notion (who/what/recommendation/status),
  consistent with the Governance Compliance Control Center pattern.
- **Notion databases used by this team:** BP Services Catalog - OFFICIAL ·
  BP Proposals - OFFICIAL · CRM · Sales Pipeline · AI Knowledge Base (TEAM cards).
- **Credentials:** placeholders in committed JSON (`REPLACE_WITH_*`) — real IDs and
  credentials are set inside n8n cloud only, never committed.

## 7. Global Guardrails (all agents)

- Use approved Knowledge Base records only.
- Never invent prices; no discounts; no contracts, invoices, or payment links from agents.
- No promises of government outcomes; no fee/timeline confirmation.
- Never request OTP, passwords, credentials, or sensitive identity data in chat.
- No sensitive/operational documents through chat before contract + approval.
- Max one qualification question per message.
- Anything official, legal, financial, or sensitive → Human Approval gate.
- Standard routing targets: consultation → باهر (Advisor) · quotation → بدر · legal &
  compliance review → محمد (per TEAM-004, pending §8) · human contact / escalation /
  proposal approval → فرح (per TEAM-005, pending §8).

## 8. Open Conflicts — Baher's Decision Required

**⚠️ Do not build Mohammed or Farah before this is resolved.**

| Agent | Option A (TEAM cards, 22 Jun — approved KB) | Option B (Baher draft, 29 Jun — newer, marked "مسودة ليست قرارات نهائية") |
|-------|---------------------------------------------|---------------------------------------------------------------------------|
| محمد Mohammed | Legal & Compliance Review Agent | IT Manager |
| فرح Farah | Operations Manager & Escalation Owner | Marketing Manager |

Considerations: TEAM-004/005 are **Approved** KB policies already referenced by the live
WhatsApp routing (Mazen hands legal cases to Mohammed and escalations to Farah). The 29 June
draft is newer but self-labelled as a non-final brain-dump. Possible resolutions: (a) keep
TEAM cards, add *new* agents for IT & Marketing; (b) draft wins, rewrite TEAM-004/005 and
re-point the router; (c) hybrid. Recorded in `docs/conflicts-log.md`.

## 9. Sources (live Notion)

- GRO Agent System Prompt — https://app.notion.com/p/93ac7cf1560641258633d6d7a8a8aac6
- TEAM-001 | Mazen — https://app.notion.com/p/387d108dee5c81f0bd4bcc5965d77a9e
- TEAM-003 | Badr — https://app.notion.com/p/387d108dee5c81d29339e107e2944df6
- TEAM-004 | Mohammed — https://app.notion.com/p/387d108dee5c81b8beedd45a5eac6d07
- TEAM-005 | Farah — https://app.notion.com/p/387d108dee5c81949eb1e5e735fc74ca
- 🧠 Baher Agents — مسودة منظومة الايجنتس (29 Jun) — https://app.notion.com/p/38ed108dee5c8128b09dfa19754fe449
- 🤖 بناء إيجنتات (parent task, 1–2 Jul) — https://app.notion.com/p/390d108dee5c81e1a9c1cf2984517aee
- 00 - AI Agents Map — https://app.notion.com/p/285b9e4a0892486081bc93cf3900abeb
