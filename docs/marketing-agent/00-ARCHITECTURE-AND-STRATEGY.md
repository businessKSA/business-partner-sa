# Business Partner Marketing Agent — Architecture, Audit & Strategy
**فريق فرح — وكيل التسويق متعدد المنصات**

Product: internal marketing engine for Business Partner (businesspartner.sa) — Saudi government-platform-management services (Qiwa, GOSI, Muqeem/Absher, Mudad, ZATCA, Balady…).
Positioning (internal brief):

> **AR:** «فرح» هي مديرة التسويق الافتراضية لبزنس بارتنر — توّلد المحتوى والتصاميم لكل منصة، ترتّب خطة نشر أسبوعية، وتجهّز كل منشور **مسودة بانتظار موافقتك** قبل النشر الفعلي.
> **EN:** Farah is Business Partner's virtual marketing manager — she drafts content and designs for every platform, keeps a weekly publishing calendar, and prepares every post **as a draft awaiting your approval** before anything goes live.

Architecture principle (same as the Compliance Agent, reused deliberately):
**Notion = brain/source-of-truth · n8n = orchestration · Claude/LLM = reasoning & copywriting · Canva = design · Platforms (IG/FB/LinkedIn/Snapchat/TikTok/WhatsApp/Telegram) = publish layer · Human Approval = mandatory before anything goes live.**

---

## 1. Current-State Audit

### 1.1 What already exists (reuse — do NOT recreate)

- **Farah — n8n workflow `vWICtJIGL4Cu7NXy`** (`💼 BP Team — Farah (Marketing)`, active): stateless webhook (`POST /webhook/farah-intake`) → `OpenAI gpt-5-mini` chat → JSON reply. She already has a bilingual system prompt covering LinkedIn/Instagram/TikTok/X/Snapchat/Facebook/email conversationally. **This is the front door persona — kept as-is, extended with real pipeline capability, not replaced.**
- **AI Executive Team pattern** (Notion: `🧩 مركز الربط + المحرك الاحتياطي للفريق`): 7 department-head agents (مازن/ملاك/بدر/فرح/أحمد/محمد/عبدالعزيز), each `Webhook → Normalize (system prompt) → primary LLM → IF ok? → fallback LLM → Parse+Fallback → Reply`. Six of the seven run Gemini-primary/Groq-fallback; **Farah currently still runs OpenAI-only** (`gpt-5-mini`, no fallback) — a pre-existing drift, left untouched here since fixing the team-wide LLM standard is out of scope for a marketing build.
- **Notion marketing hub**: `📣 التسويق` (dept page, parent of Email Campaign Engine / Campaign Intelligence / WhatsApp system docs) and `Marketing Agent` spec page under BP3.0 vision — already describe Farah's scope exactly as requested here (content + designs + campaigns across LinkedIn/Instagram/Email/WhatsApp/TikTok/Snapchat/Facebook/X, client approval required before official publish). This build **implements** that existing spec rather than inventing a new one.
- **Email Marketing Campaign Engine** (B2B cold outreach: Notion Companies/Campaigns/Templates/Pipeline + n8n + Gmail) — a **separate system** for lead-gen email, not brand social content. Not touched here.
- **WhatsApp AI Operating Architecture** — an extensive existing system, but it is the **1:1 customer-service bot** (intent routing, CRM). The "WhatsApp channel" requested here is a different surface: **WhatsApp Business "Channel" broadcast** for marketing content, using the existing `whatsAppApi`/`whatsAppTriggerApi` n8n credentials, not the service bot.
- **n8n credentials already present**: LinkedIn OAuth2 (`vgcZC6deAipyh9zR`), WhatsApp (`dPP94SCEPI6Qz1nx`, `TyzjY9mTu6DRiHqv`, others), Anthropic (`mmbdtwapuZXoY91N`), Groq (`dhoBme9q4ESj2pAS`), Notion (`USVPflXCkLXwDvRx` / `eO0S4qfOofuyo6Tq`).
- **Website patterns to reuse**: `src/pages/ar/portal.astro` (standalone dashboard shell: login, tabs, `qgrid`/`qtile` icon tiles, `alert-table`, brand colors `--navy:#0B1B5A` / `--gold:#C79A3A`) — cloned for the new content dashboard. `docs/compliance-agent/templates/email-report.html` pattern reused for a shareable weekly content report.

### 1.2 What is missing (real gaps → build targets of this doc)

1. **No platform posting/scheduling exists anywhere.** Farah only *talks about* content; nothing writes to a calendar or publishes.
2. **No Content Calendar database** — no persistent record of what was drafted, approved, scheduled, or published, per platform.
3. **No design generation pipeline** — no Canva integration anywhere in n8n or Notion.
4. **No credentials for Instagram/Facebook (Meta), TikTok, Snapchat, or Telegram** — only LinkedIn and WhatsApp are connectable today. → **GAP, cannot be closed by an agent build alone**; requires the business owner to register developer apps (see `credentials-setup-guide.md`).
5. **No internal content dashboard** — no single place to see this week's posts per platform, status, and what needs approval.
6. **No platform-specific playbooks** — Farah's single system prompt is generic; each platform needs its own tone/format/cadence rules (this doc's `system-prompts/`).

### 1.3 Unsafe / needs attention

- **No secrets in chat or repo.** All platform tokens live in n8n credentials only.
- **No auto-publish without approval.** Every piece of content is created as `Draft` in the Content Calendar; nothing calls a real posting API until a human sets status to `Approved`.
- **Meta/TikTok/Snapchat app review**: these platforms require app review before a business account can publish via API — budget real lead time (days–weeks) once the owner starts the developer-app process.

---

## 2. Brand & Audience

- **Brand colors:** navy `#0B1B5A`, brand blue `#0066cc`, gold `#C79A3A` (matches `email-report.html` / `portal.astro`).
- **Voice:** Saudi business-professional, Arabic-first, practical — not corporate-stiff, not meme-y. Same register as the Compliance Agent's client-facing lines.
- **Core value proposition (all platforms):** «فريق يتابع أعمالك الحكومية يومياً بدل ما تلاحقها بنفسك» — Qiwa, GOSI, Muqeem/Absher, Mudad handled end-to-end so the business runs 24/7.
- **Primary audience (ICP):** Saudi SME owners, HR/admin managers, and finance managers responsible for government-platform compliance and payroll — decision-makers who feel the pain of expiry deadlines, Nitaqat risk, and manual paperwork.
- **Secondary audience:** foreign investors setting up in KSA (MISA/CR/Chamber content), and accountants/consultants who refer clients.

## 3. Content Pillars (apply across platforms, weighted per platform in each playbook)

1. **تعليمي / Educational** — "did you know" explainers on Qiwa/GOSI/Muqeem/Nitaqat rules, deadlines, fees. Builds authority, drives organic reach.
2. **تحذيري / Risk & Deadlines** — real (never fabricated) seasonal reminders: Iqama renewal windows, Nitaqat band changes, VAT filing dates. Urgency-driven.
3. **إثبات / Proof & Trust** — client testimonials (with consent), before/after compliance health scores, team credibility, CR/office proof.
4. **منتج / Product & Offer** — Core Plan (999 SAR/mo) and Mudad add-on (+199 SAR/mo), the Compliance Agent dashboard, clear CTA to `/ar/compliance`.
5. **إنساني / Behind-the-scenes** — team, office, Saudi business culture moments — humanizes the brand, works best on Instagram/Snapchat/TikTok.

## 4. Platform Matrix

| Platform | Primary objective | Format | Cadence (v1 target) | Approval-required action |
|---|---|---|---|---|
| Instagram | Awareness + trust (visual) | Feed post (1080×1350), Story (1080×1920), Reel cover | 3×/week feed, daily story | Publish |
| Facebook | Reach older SME-owner segment, groups | Feed post (1200×630), link posts to site | 3×/week | Publish, ad boost |
| LinkedIn | B2B authority, HR/finance decision-makers | Text + image post (1200×627), articles | 2–3×/week | Publish (real — credential exists) |
| Snapchat | Younger admin-staff reach, behind-the-scenes | Vertical Snap (1080×1920) | 2×/week | Publish |
| TikTok | Educational short-video, discoverability | Vertical video cover + script (1080×1920) | 2×/week | Publish |
| WhatsApp Channel | Direct broadcast to subscribers, deadline alerts | Text + image broadcast | 1–2×/week | Send (real — credential exists) |
| Telegram Channel | Same as WhatsApp Channel, tech-forward audience | Text + image post | 1–2×/week | Send |

Each platform's full playbook (tone, hashtags, examples, forbidden actions) lives in `system-prompts/<platform>.md`.

## 5. Content Pipeline (target workflow, human approval always in the loop)

```
IDEATION      → Farah/n8n generates a week's content ideas from the 5 pillars × 7 platforms
                 → writes rows to Notion "📅 Marketing Content Calendar" (Status = Idea)
                                  │
COPY          → LLM drafts platform-tuned caption (AR + EN) + hashtags per idea
                                  │ Status = Needs Design
DESIGN        → Design brief handed to Canva (generate-design) → asset URL stored on the row
                                  │ Status = Ready for Review
HUMAN REVIEW  → Internal team reviews in the /ar/marketing dashboard, edits/approves
                                  │ Status = Approved → Scheduled Date set
PUBLISH       → Platform-specific publish workflow fires on schedule (LinkedIn/WhatsApp real today;
                 Instagram/Facebook/TikTok/Snapchat/Telegram wait on credentials — see setup guide)
                                  │ Status = Published
REPORT        → Weekly report (engagement, what shipped, what's queued) → Notion + email/WhatsApp
```

## 6. Target Architecture

```
                 ┌───────────────────────────────────────────────────────────┐
  BRAIN           │ Notion: 📅 Marketing Content Calendar (NEW)                │
                 │ + existing 📣 التسويق hub (Email Engine, WhatsApp arch)     │
                 └───────────────┬───────────────────────────────────────────┘
                                 │
                 ┌───────────────▼──────────────┐
  IDEATION (M1)  │ WF: Content Ideation           │  reads content pillars +
                 │ (schedule weekly + manual)     │  platform matrix (this doc)
                 └───────────────┬──────────────┘
                                 │ writes Idea rows
                 ┌───────────────▼──────────────┐
  COPY (M2)      │ WF: Copy Generation            │  Claude/LLM, per-platform
                 │ (per Notion row, on demand)    │  system prompt from playbook
                 └───────────────┬──────────────┘
                                 │
                 ┌───────────────▼──────────────┐
  DESIGN (M3)    │ Canva generate-design           │  brand navy/gold, per-platform
                 │ (manual today, MCP-driven)      │  canvas size from matrix
                 └───────────────┬──────────────┘
                                 │
                 ┌───────────────▼──────────────┐
  DASHBOARD (M4) │ /ar/marketing (Astro)           │  reads WF: Marketing Dashboard API
                 │ review + approve                │  (n8n webhook → Notion query)
                 └───────────────┬──────────────┘
                                 │ Status = Approved
                 ┌───────────────▼──────────────┐
  PUBLISH (M5)   │ Per-platform publish workflows  │  LinkedIn + WhatsApp: real
                 │                                  │  IG/FB/TikTok/Snapchat/Telegram: skeleton,
                 │                                  │  disabled pending credentials
                 └───────────────┬──────────────┘
                                 │
                 ┌───────────────▼──────────────┐
  REPORT (M6)    │ Weekly report → Notion + email  │
                 └──────────────────────────────┘
```

## 7. Build Order

1. `system-prompts/` — Farah orchestrator prompt + one playbook per platform (this build).
2. `content-calendar-schema.json` + create the Notion database.
3. n8n: Ideation + Copy Generation workflows, writing to Notion.
4. n8n: LinkedIn + WhatsApp Channel publish workflows (real, credentials exist).
5. n8n: Instagram/Facebook/TikTok/Snapchat/Telegram publish workflow **skeletons** (HTTP Request nodes, disabled, `REPLACE_WITH_...` credential placeholders) + `credentials-setup-guide.md`.
6. n8n: Marketing Dashboard API webhook (reads Notion, returns JSON like `bp3-portal-9kq4z` does for compliance).
7. First Canva design batch (one template per platform format) to prove the pipeline end-to-end.
8. `/ar/marketing` dashboard page.
9. Once the owner completes each platform's developer-app registration (`credentials-setup-guide.md`), swap the placeholder credential in n8n and flip the workflow active — no restructuring needed, same pattern as the Compliance Agent's disabled-node approach.
