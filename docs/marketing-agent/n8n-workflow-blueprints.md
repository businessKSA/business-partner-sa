# Marketing n8n Workflow Blueprints — mapped to existing/new IDs

Credentials available today: LinkedIn OAuth2 `vgcZC6deAipyh9zR` · WhatsApp `dPP94SCEPI6Qz1nx` / `TyzjY9mTu6DRiHqv` · Anthropic `mmbdtwapuZXoY91N` · Groq `dhoBme9q4ESj2pAS` · Notion `USVPflXCkLXwDvRx` / `eO0S4qfOofuyo6Tq`. Model for copy generation: `claude-sonnet-4-6` (matches Compliance Agent standard) with Groq fallback, consistent with the AI Executive Team pattern. Times: Asia/Riyadh.

**Missing credentials** (see `credentials-setup-guide.md`): Meta Graph API (Instagram + Facebook), TikTok for Business API, Snapchat Marketing API, Telegram Bot API, Canva Connect API. Workflows below that need them are built as **disabled skeletons** with a clearly labeled placeholder credential — flip active once the real credential is added, no restructuring needed (same pattern as the Compliance Agent's `REPLACE_WITH_...` nodes).

---

## Workflow M1 — Content Ideation → NEW
- Trigger: schedule (weekly, Sunday 07:00 Riyadh) + manual webhook.
- Steps: read `00-ARCHITECTURE-AND-STRATEGY.md` pillar mix (hardcoded in prompt) → Claude generates 7–14 content ideas spanning the 5 pillars × 7 platforms for the coming week → write rows to **Marketing Content Calendar** (Status = `Idea`).

## Workflow M2 — Copy Generation → NEW
- Trigger: manual (from dashboard "Generate Copy" action) or on new `Idea` row.
- Steps: read the row + platform → load that platform's playbook (`system-prompts/<platform>.md`, pasted into the system prompt) → Claude drafts Caption Arabic + Caption English + Hashtags → update row (Status = `Needs Design`).

## Workflow M3 — Design Brief → Design Asset → MANUAL TODAY (Claude-authored HTML/CSS), NEW when automated
- Today: design briefs are fulfilled directly as HTML/CSS against the shared token system (`design-system.md`, `design-templates/brand.css`), rendered to PNG with Playwright (`design-templates/render.mjs`), committed under `public/marketing-designs/`. No third-party design-generation API — full control over brand consistency, no missing-credential blocker.
- Future automation: this render step can run inside n8n via a headless-render service (e.g. an internal endpoint that runs the same Playwright script) — no restructuring of the calendar/approval flow needed.

## Workflow M4 — Marketing Dashboard API → BUILT & DEPLOYED (active)
- Workflow: `🎯 BP Team — Marketing Dashboard & Approvals` — id `x7gmc3bXUGJGZScR` — https://businesspartnerai.app.n8n.cloud/workflow/x7gmc3bXUGJGZScR
- Trigger: webhook `GET /webhook/bp-marketing-dashboard`.
- Steps: query **Marketing Content Calendar** (Notion `d258f8b235034ff4adf5ec15dfd7519a`) → Code node groups by Platform + Status → returns JSON `{ ok, generatedAt, counts, byPlatform, needsReview, thisWeek, posts }`.
- **Live-tested** (execution `7857`, 2026-07-09): correctly returns the 5 seeded rows with accurate counts/grouping.
- Auth: none today (internal-only path, not linked from the public site) — add header auth before wider rollout if needed.
- Note: n8n's Notion node "simple" output flattens each property to `property_<snake_case_name>` (e.g. `property_post_title`, `property_caption_arabic`) — not the raw Notion field name. The Code node accounts for this; keep it in mind for any future workflow reading this database.

## Workflow M5 — Approve / Reject Action → BUILT & DEPLOYED (active, same workflow as M4)
- Trigger: webhook `POST /webhook/bp-marketing-approve` in the same workflow (`x7gmc3bXUGJGZScR`).
- Steps: receive `{ pageId, action: "approve"|"reject", approver, scheduledDate?, rejectionReason? }` → normalize → IF `action == approve` → update Notion row (`Status = Scheduled` if `scheduledDate` given else `Approved`, `Approved By = approver`) else → update Notion row (`Status = Rejected`, `Rejection Reason = rejectionReason`) → respond with the updated page.
- **Structurally validated** (`validate_workflow`, 0 warnings) and uses the same Notion-update pattern as the rest of the workspace, but **not live-tested** — the MCP `execute_workflow` tool only fires a workflow's first trigger, so this second webhook route couldn't be exercised from this session. Smoke-test it via the `/ar/marketing` dashboard's Approve/Reject buttons once deployed.
- Future: on `approve` for LinkedIn or WhatsApp Channel rows, chain an Execute Workflow call to the matching publish workflow (P1/P-WhatsApp) once those are built.

## Workflow P1 — LinkedIn Publish → NEW (real)
- Trigger: Execute Workflow call from M5, or schedule check for `Approved` + `Scheduled Date` = today.
- Steps: read row → LinkedIn node (credential `vgcZC6deAipyh9zR`) → post text + image → update row (Status = `Published`, Published Date = now, store post URL).

## Workflow P-WhatsApp — WhatsApp Channel Publish → NEW (real)
- Trigger: same pattern as P1.
- Steps: read row → WhatsApp node (credential `dPP94SCEPI6Qz1nx`) → send to the Channel (not 1:1 service number) → update row (Status = `Published`).

## Workflow P-Instagram / P-Facebook → NEW (skeleton, disabled)
- Steps once enabled: HTTP Request to Meta Graph API `/{ig-user-id}/media` (create) then `/{ig-user-id}/media_publish` for Instagram; `/{page-id}/photos` or `/{page-id}/feed` for Facebook.
- Placeholder credential: `REPLACE_WITH_META_GRAPH_TOKEN` (httpHeaderAuth, `Authorization: Bearer <token>`).
- Blocked on: Meta Business/Developer App + Instagram Business Account linked to a Facebook Page + app review for `instagram_content_publish` / `pages_manage_posts` scopes.

## Workflow P-TikTok → NEW (skeleton, disabled)
- Steps once enabled: HTTP Request to TikTok Content Posting API (`/v2/post/publish/content/init/`) with the video/script + cover asset.
- Placeholder credential: `REPLACE_WITH_TIKTOK_API_KEY`.
- Blocked on: TikTok for Business Developer account + app approval for Content Posting API (direct/unaudited posting is sandbox-only until approved).

## Workflow P-Snapchat → NEW (skeleton, disabled)
- Steps once enabled: HTTP Request to Snapchat Marketing API media upload + post endpoints.
- Placeholder credential: `REPLACE_WITH_SNAPCHAT_API_TOKEN`.
- Blocked on: Snapchat Business account + Marketing API access approval.

## Workflow P-Telegram → NEW (skeleton, ready to enable fast)
- Steps once enabled: Telegram node, `sendMessage`/`sendPhoto` to the Channel by `@channel_username` or chat ID.
- Placeholder credential: `REPLACE_WITH_TELEGRAM_BOT_TOKEN`.
- Blocked on: creating a bot via **@BotFather** and adding it as admin of the Channel — five minutes, no review wait (see `credentials-setup-guide.md`). Lowest-effort platform to go fully live.

## Workflow M6 — Weekly Content Report → NEW
- Trigger: schedule (weekly, e.g. Thursday 16:00 Riyadh).
- Steps: query Content Calendar for the week → summarize published/scheduled/needs-review counts per platform → render report (reuse `templates/email-report.html` visual style) → email internal team.

---

### Build order (recommended)
1. Notion Content Calendar DB → 2. M1 Ideation + M2 Copy Generation → 3. M4 Dashboard API + `/ar/marketing` page → 4. M5 Approve/Reject + P1 LinkedIn + P-WhatsApp (real, credentials exist) → 5. P-Telegram (fast — just needs a bot token) → 6. M6 Weekly Report → 7. P-Instagram/P-Facebook/P-TikTok/P-Snapchat once the owner completes each platform's developer-app process.
