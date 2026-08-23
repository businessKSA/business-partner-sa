# The funnel — Business Partner

**Status:** design + build in progress · **Last updated:** 2026-08-23

A big funnel is not a big content plan. It is many tracked entry points, one place
where leads land, and something that happens to a lead at every stage without a human
remembering to do it. This document starts from what the pipeline actually shows today.

---

## 1. What the pipeline says right now

`Sales Pipeline` (`d9a342be24774be3b4095d439d21fc90`) — 52 opportunities:

| Stage | Count |
|---|---|
| New (unworked) | 23 |
| Qualified | 12 |
| مهتم | 7 |
| Won | 3 |
| Lost | 3 |
| Meeting | 1 |

**Every lead is attributed to the website.** Not one is attributed to the email
campaign, WhatsApp, or any social platform — after ~1,000 outbound emails.

Three conclusions, and they set the whole build order:

1. **The site converts. Outbound does not.** The site is the only working entry
   point, and it is currently a single point of entry.
2. **23 of 52 leads — 44% — are sitting in `New`.** The largest leak is not at the
   top of the funnel. It is the first follow-up that never happens.
3. **A channel with no tracking is invisible, not ineffective**, and the two look
   identical from here. Nothing outbound carried a tagged link, so "zero leads from
   email" cannot yet be separated from "leads we could not see".

Fixing 3 is a precondition for trusting any number that follows.

---

## 2. Shape of the funnel

```
REACH        95 service pages · 6 calculators · weekly posts ×6 platforms
             WhatsApp channel · newsletter · lead magnets
                      │
CAPTURE      every entry point carries a tagged link and an ask
                      │        utm_source / utm_content=<service code>
                      ▼
LAND         Sales Pipeline (Notion) — one destination, no second CRM
                      │
QUALIFY      score: service value × company fit × engagement
                      │
NURTURE      per-category sequence — the stage that does not exist yet
                      │
CONVERT      Proposal → Negotiation → Won        (already built)
                      │
EXPAND       adjacent services, renewals, referrals
```

### The one-destination rule

Two CRMs are in use today: `api/requests.js` writes to **Sales Pipeline**
(`d9a342be…`), while the n8n *Email CRM Router* writes to a different **CRM**
database (`b322a7ec…`). A lead's stage therefore depends on which door it came
through, and no single view shows the funnel. **Sales Pipeline is the destination**
— it has the stages, the value, the probability, and the service relation. The
router needs repointing before any channel is scaled up.

---

## 3. Entry points

Existing assets, and what each still needs:

| Entry point | Exists | Missing |
|---|---|---|
| 95 service pages | ✅ | tagged inbound links, one clear ask |
| 6 calculators (GOSI, end-of-service, overtime, annual leave, government cost, profession checker) | ✅ | **email capture on the result** — highest-intent traffic on the site, currently anonymous |
| Weekly per-service posts, 6 platforms | ✅ generator | scheduling + publishing |
| WhatsApp channel | ⚠️ | content queue (news + offers) |
| Newsletter | ✅ `api/newsletter.js` | per-category segmentation |
| Lead magnets (platform one-pagers) | ⚠️ skill exists | produce + gate behind email |
| Outbound email | ⏸️ paused | tagged links, per-service targeting |

**The calculators are the biggest untapped asset.** Someone calculating an
end-of-service settlement has a live HR problem right now. That is higher intent
than anything outbound can buy, and today it produces no lead.

---

## 4. Scoring

Score on what the catalogue and behaviour already provide, not on guesses:

| Signal | Weight |
|---|---|
| Service price band (`price.amount`) | value of the opportunity |
| `requiresProposal` | complexity — routes to a human sooner |
| Entry point (calculator > service page > social) | intent |
| Repeat visits / multiple services viewed | interest |
| Company size / sector, when known | fit |

Score decides route: self-serve checkout · nurture sequence · straight to a consultant.

---

## 5. Nurture — the missing middle

One sequence per category (9 total), triggered on `Stage = New`, stopping the moment
a human replies or the stage advances.

Shape, day 0 → 14:

| Day | Message |
|---|---|
| 0 | What they asked about — the service pack for that service |
| 2 | The relevant calculator or one-pager (useful, not a pitch) |
| 5 | A specific risk or deadline in their category |
| 9 | Price and what is included, plainly |
| 14 | One direct ask, then stop |

Every send is suppression-aware: it reuses the `Suppressed` flag and the bounce
handler from `email-campaign-hygiene.md`, so a bounced or opted-out address can
never re-enter a sequence.

---

## 6. Build order

Ordered by what the pipeline data says is costing the most.

1. **Attribution** — tagged links on everything the generator emits. ✅ done
2. **Work the 23 `New` leads** — the nurture sequence, pointed at existing leads first.
3. **Capture on the calculators** — email-gate the full result.
4. **One CRM** — repoint the Email CRM Router at Sales Pipeline.
5. **Scheduling** — the weekly per-service calendar across platforms.
6. **Publishing** — LinkedIn first (credential exists); the rest as ready-to-post packs
   until their APIs are connected.
7. **Replies** — auto-answer the common questions, hand off the rest.

Note on 6: **no social platform is connected yet.** Instagram, TikTok, and the
WhatsApp channel need API access that takes weeks to obtain (Meta review). Generation,
scheduling, and approval are automatic today; publishing to those three is not, and
nothing in this document should be read as claiming otherwise.
