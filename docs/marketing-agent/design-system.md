# Design System — Marketing Agent
**نظام التصميم — تصميم مباشر بدون أدوات خارجية**

## Why this exists
The first pass used Canva's AI `generate-design` tool. Output quality wasn't acceptable — reviewed and rejected. Designs are now authored directly as HTML/CSS (full control over every pixel: type, color, spacing, layout) and rendered to real PNG image files with a headless browser. No third-party design generator in the loop.

## Token system (`design-templates/brand.css`)
- **Color:** `--navy #0b1b5a` (field) · `--navy-deep #060f38` (depth vignette) · `--gold #c8973b` (accent/anchor rule) · `--gold-soft #e4c687` (secondary highlight) · `--paper #f2f4fa` (light-ground variant, used for the LinkedIn card only, so the 7-piece set has one deliberate tonal shift instead of five identical fields) · `--ink #0b1330` (text on paper).
- **Type:** display = **Noto Kufi Arabic** (geometric, bold, headline voice) · body = **Noto Sans Arabic** (clean, legible small) · Latin utility = **DejaVu Sans**, letter-spaced uppercase, for the fixed wordmark lockup. These are installed system fonts (`apt-get install fonts-noto-core fonts-noto-ui-core`), not web-loaded — required so Arabic renders correctly when screenshotting locally.
- **Layout:** solid navy (or paper) field, one thin gold rule as a fixed structural anchor, one restrained geometric lattice motif (Islamic-grille reference, corner-anchored, ~8% opacity) as the single deliberate flourish, and a fixed wordmark lockup in the same corner on every format — this is what makes the 7 platforms read as one brand system instead of five unrelated generated images.

## Files
- `design-templates/brand.css` — shared tokens + primitives (`.canvas`, `.motif`, `.rule`, `.wordmark`, `.headline`, `.support`).
- `design-templates/instagram-post.html` (1080×1350), `facebook-post.html` (1200×630), `linkedin-card.html` (1200×627, paper variant), `story-vertical.html` (1080×1920 — also the Snapchat/TikTok-cover format), `broadcast-square.html` (1080×1080 — WhatsApp/Telegram Channel).
- `design-templates/render.mjs` — Playwright script that opens each HTML file at its real target resolution (2x device scale factor) and screenshots it to PNG. Run: `node design-templates/render.mjs <output-dir>`.

## First batch — proof-of-pipeline designs (2026-07-09)
Rendered PNGs are committed at `public/marketing-designs/*.png` (so they resolve at `https://businesspartner.sa/marketing-designs/*.png` once this branch is deployed) and linked from the seeded Notion Content Calendar rows.

| Platform(s) | Pillar | File |
|---|---|---|
| Instagram feed | Educational | `instagram-post.png` |
| Facebook feed | Risk & Deadlines | `facebook-post.png` |
| LinkedIn | Educational | `linkedin-card.png` |
| Snapchat / TikTok cover / Story | Risk & Deadlines | `story-vertical.png` |
| WhatsApp Channel / Telegram Channel | Risk & Deadlines | `broadcast-square.png` |

## Workflow (today — direct HTML authoring, no external tool)
1. Content Calendar row reaches `Needs Design` with a filled-in **Design Brief** (subject, format, key message — from Workflow M2).
2. Duplicate the matching template in `design-templates/`, swap in the real headline/support text for that post, run `render.mjs` to get a PNG.
3. Commit the PNG under `public/marketing-designs/` (or, for one-off posts that don't need to live in the repo permanently, export to the scratch directory and attach directly) and paste the resulting URL into **Design Asset URL** on the Notion row; Status moves to `Ready for Review`.
4. This step is manual/Claude-driven today (Workflow M3 in `n8n-workflow-blueprints.md` is documented as a future n8n-automated step, but there is no external API dependency blocking it — it can be scripted in n8n via a headless-render service later without changing the calendar/approval flow).
