# Weekly publishing calendar

Every service in the catalogue gets its own campaign, on a rotation, across every
platform — and nothing reaches a platform without a person approving it first.

- **Feed:** `site/data/marketing-content.json` (generated, committed, served at
  `businesspartner.sa/data/marketing-content.json`)
- **Generator:** `docs/marketing-agent/generator/feed.mjs`
- **Planner:** n8n `BP — Weekly Content Planner` (`JkXJJMwKqQ7TPMqx`)
- **Calendar:** Notion `📅 Marketing Content Calendar`
  (`d258f8b2-3503-4ff4-adf5-ec15dfd7519a`)

## The week

The Saudi work week runs Sunday–Thursday, and the plan does too. Five services a
week, one per working day, drawn from a rotation that interleaves the nine
service categories so a week never reads as five variations of the same thing.
95 services ÷ 5 = a **19-week cycle**; every service comes round roughly twice a
year.

Each featured service runs on four platforms on its own day:

| Time (Riyadh) | Platform | What it carries |
|---|---|---|
| 09:00 | LinkedIn | the argument — problem first, then what we do |
| 11:00 | WhatsApp Channel | the offer — short, one link |
| 13:30 | X | one line |
| 20:00 | Instagram | the card + caption |

The heavier formats rotate rather than running daily, because a video brief every
day is a queue nobody clears and the calendar stops being believable:

| Day | Extra |
|---|---|
| Sunday | Facebook 19:00 |
| Monday | TikTok 21:00 |
| Tuesday | Snapchat 20:30 |
| Wednesday | TikTok 21:00 |
| Thursday | Facebook 19:00 |

Thursday also gets one post that is **not** about a single service: a Telegram
digest of the week's five, so a follower who missed a day still sees the range.

**26 rows a week.**

## What the planner does, and what it deliberately does not

The planner runs Thursday morning and plans the week starting the coming Sunday,
so there are three days to review before anything is due.

It writes every row at `Status = Ready for Review`. It does not publish, schedule
into a platform, or send anything. That is not a limitation of this design — no
social account is connected yet (LinkedIn has a credential that has never
succeeded; Instagram, TikTok and the WhatsApp channel need Meta/TikTok app review
that takes weeks) — but it would still be the design with the accounts connected.
The last campaign went out unreviewed and the cost of that is documented in
`email-campaign-hygiene.md`.

Each row carries what a human needs to act on it without opening anything else:

| Field | Contents |
|---|---|
| Post Title | service name — platform |
| Caption Arabic | the finished post text for that platform |
| Hashtags | per category, capped at 6 |
| Design Brief | headline, checklist length, price pill, brand tokens, pack path |
| Landing URL | the tracked link for that platform |
| Service Code | `BP-…`, the join key back to the catalogue |
| Notes | WhatsApp deep link, design pack path, and the video script on TikTok rows |
| Plan Week / Slot Key | `2026-08-30` and `week\|code\|platform` |

## Why the copy lives in the repo

The planner fetches the feed instead of building the copy in a Code node. The
rules that decide what a service may claim — Arabic naming from
`service-i18n.json`, "الرسوم الحكومية منفصلة" where the catalogue says fees are
separate, and the distinction between a service's real deliverables and its
category's engagement process — are the difference between an accurate ad and a
false one. In `feed.mjs` a diff shows them. In a Code node nobody reads them
again.

Consequence: **regenerate and commit the feed whenever the catalogue changes.**

```
node docs/marketing-agent/generator/feed.mjs     # → site/data/marketing-content.json
node docs/marketing-agent/generator/build.mjs    # → the design packs + emails
```

## Attribution

Every link in the feed is UTM-tagged with the platform it was published on and
the service code (`utm_content=BP-…`), and every WhatsApp deep link opens with
`[CODE/channel]` inside the first message. Without this a channel that produced
nothing and a channel whose results were never recorded look identical — which is
exactly what happened to the first email campaign: 1,000 sends, no attributable
lead, and no way to tell which of those two it was.

## Re-running

`Plan Now` is a manual trigger for the same chain. The planner first asks Notion
whether any row already carries this `Plan Week`; if one does, it stops without
writing. A second run does not double the week.

## Not yet true

- The feed URL resolves only once this branch merges to `master` — Vercel serves
  `site/` from the default branch. Until then the planner's fetch 404s.
- No platform is connected, so `Approved` is where a row stops. Moving it to
  `Published` is a person doing it by hand.
