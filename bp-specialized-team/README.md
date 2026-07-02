# bp-specialized-team/

Build workspace for the **Specialized Team agents** (فريق الإدارة) — Group 1 of the
Business Partner agent ecosystem. Full context, pattern, and rules:
[`../BP-Specialized-Team-Build-Brief.md`](../BP-Specialized-Team-Build-Brief.md).

Stack: **Notion** (knowledge + operating DBs) · **n8n** (24/7 execution) · **Claude** (engine).
Operating model V1: **Concierge** — agents qualify, draft, and recommend; humans approve and
execute. Nothing outward-facing leaves without the «بانتظار الموافقة» Human Approval gate.

## Status Board

| Agent | Role | Prompt | n8n skeleton | Status |
|-------|------|--------|--------------|--------|
| بدر Badr | Sales & Business Development | [`prompts/badr-sales-bd.md`](prompts/badr-sales-bd.md) | [`n8n/badr-workflow.json`](n8n/badr-workflow.json) | 🟡 Built — awaiting Baher's approval |
| ملاك Malak | Admin Manager / PA | — | — | ⏳ Next after Badr approval |
| أحمد Ahmed | Procurement | — | — | ⏳ After Malak |
| محمد Mohammed | ⚠️ IT vs Legal & Compliance | — | — | 🔴 Blocked — role conflict (see docs/conflicts-log.md) |
| فرح Farah | ⚠️ Marketing vs Operations | — | — | 🔴 Blocked — role conflict (see docs/conflicts-log.md) |

## Folder Layout

```
prompts/   # one system-prompt file per agent, GRO Agent pattern (Summary · When to Use ·
           # System Prompt · Process Steps · Human Approval Rule)
n8n/       # one importable n8n workflow skeleton per agent, committed inactive
docs/      # team roster + conflicts/decision log
```

## Using an n8n skeleton

1. n8n → Workflows → **Import from File** → pick the JSON.
2. Replace every `REPLACE_WITH_*` placeholder (Notion database IDs, credential IDs).
   Real IDs and credentials live **only in n8n cloud — never commit them here**.
3. Map the Notion property names (Status, Assigned Agent, Human Required…) to the real
   databases — placeholders note the target state.
4. Run the **Manual Test Trigger** (pinned sample payload) and check the reply and the
   Draft Proposal record.
5. Activate **only after Baher's approval**.

## Rules of the folder

- Blocked/pending agents get **no files** until the decision exists — the folder only
  contains real, buildable content.
- A prompt file is the single source of truth for its agent; the condensed prompt inside
  the workflow JSON must be kept in sync with it.
- All guardrails in brief §7 apply to every agent, always.
