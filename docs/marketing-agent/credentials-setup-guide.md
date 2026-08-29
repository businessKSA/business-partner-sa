# Credentials Setup Guide — Marketing Agent
**دليل ربط الحسابات — لتفعيل النشر الفعلي على كل منصة**

None of these steps can be done by the agent on your behalf — each platform requires the Business Partner account owner to register a developer/business app and grant access. Once you complete a platform below, add the resulting token as an n8n credential and tell the team to flip the matching publish workflow (`docs/marketing-agent/n8n-workflow-blueprints.md`) from disabled to active — no rebuild needed.

## ✅ Already connected (no action needed)
- **LinkedIn** — OAuth2 credential exists (`vgcZC6deAipyh9zR`). Real posting is already wired (Workflow P1).
- **WhatsApp Channel** — API credential exists (`dPP94SCEPI6Qz1nx` / `TyzjY9mTu6DRiHqv`). Real broadcast is already wired (Workflow P-WhatsApp). Confirm with Khaled/Malak that the Channel (not the 1:1 service-bot number) is the one used here.

## 🟢 Fastest to unlock — Telegram (~5 minutes, no review)
1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, choose a name and a unique username (e.g. `BusinessPartnerSA_bot`).
3. BotFather returns a **Bot Token** — copy it.
4. Create (or use an existing) Telegram **Channel**, add the bot as an **admin** with "Post Messages" permission.
5. Add the token to n8n as a `telegramApi` credential, name it `Business Partner Telegram Bot`.
6. Tell the team — Workflow P-Telegram flips active immediately.

## 🟡 Medium effort — Meta (Instagram + Facebook), days to ~1 week
1. Create a **Meta Business Account** at business.facebook.com if not already present (Business Partner likely already has a Facebook Page — link it here).
2. Go to developers.facebook.com → create a **Meta App** (type: Business).
3. Add the **Instagram Graph API** and **Facebook Pages API** products.
4. Convert/confirm the Instagram account is a **Business or Creator account**, linked to the Facebook Page.
5. Request the scopes: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
6. Submit for **App Review** (Meta requires a screencast + business verification for these scopes on a live app) — this is the step that takes the longest.
7. Once approved, generate a long-lived Page Access Token, add it to n8n as `httpHeaderAuth` (`Authorization: Bearer <token>`).
8. Tell the team — Workflows P-Instagram and P-Facebook flip active.

## 🟡 Medium effort — TikTok for Business, days to weeks
1. Register at business.tiktok.com → create a **TikTok for Business** account.
2. Go to developers.tiktok.com → create an app, request the **Content Posting API** product.
3. TikTok requires app review before direct (unaudited) posting is allowed outside a small creator sandbox.
4. Once approved, add the access token to n8n.
5. Tell the team — Workflow P-TikTok flips active.

## 🟡 Medium effort — Snapchat Marketing API, days to weeks
1. Register at business.snapchat.com.
2. Apply for **Snapchat Marketing API** access (ads.snapchat.com/developers).
3. Once approved, generate an API token/OAuth credential and add it to n8n.
4. Tell the team — Workflow P-Snapchat flips active.

## 🎨 Design generation
- No external design tool in the loop. Designs are authored directly as HTML/CSS against a shared brand token system and rendered to PNG locally (see `design-system.md`) — nothing to connect or wait on approval for. Canva's AI generator was tried first and dropped on quality/control grounds.
- If real production logo artwork exists (vector/SVG), drop it in and swap the CSS `.wordmark` placeholder mark for it — the only "brand asset" currently missing is the actual logo file, everything else (colors, type) is already encoded in `design-templates/brand.css`.

## Priority recommendation
Telegram first (today, zero friction) → Meta (Instagram+Facebook, highest audience value) → TikTok → Snapchat, based on effort vs. reach for Business Partner's B2B/SME audience. Design generation needs no setup — it's already working end-to-end.
