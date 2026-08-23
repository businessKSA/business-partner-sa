# Per-service marketing content generator

Turns any service in `site/data/services.json` into a complete, ready-to-review
content pack. One service per pack — never a service list.

```bash
node docs/marketing-agent/generator/build.mjs            # all 95 services
node docs/marketing-agent/generator/build.mjs --sample   # one per category (9)
node docs/marketing-agent/generator/build.mjs BP-HR-01   # specific codes
node docs/marketing-agent/generator/build.mjs --no-images # copy only, fast
```

Output per service → `docs/marketing-agent/content-packs/<slug>/`

| File | What it is |
|---|---|
| `email.html` | Focused marketing email, RTL, table-based, inline-styled |
| `posts.json` | WhatsApp · LinkedIn · Instagram · TikTok script · X |
| `instagram.png` | 1080×1350 @2x |
| `story.png` | 1080×1920 @2x (Stories / Reels cover / WhatsApp status) |
| `linkedin.png` | 1200×627 @2x |

## Where the words come from

- **Arabic service name** — `site/data/service-i18n.json`, keyed by service code.
  The catalogue itself stores English names; Arabic copy never falls back to them.
- **Checklist** — the service's own `deliverables` when the catalogue has them
  (20 of 95), translated via `deliverables-ar.mjs`. Otherwise the category's
  *process* steps from `playbooks.mjs`.
- **Angle** (pain / outcome / proof) — the category playbook.
- **Price** — `service.price`, spelled out in words.

### Why the fallback is process, not deliverables

75 services carry no deliverables. If they inherited the category's deliverables,
"Chamber of Commerce membership" would advertise "issue your Commercial Registration"
— a promise for a different service. The fallback describes how the engagement runs,
which is true for every service in the family.

## Two deliberate choices

**Emails carry no images.** Most clients block remote images by default; a blocked
hero leaves the reader with an empty rectangle instead of the offer. The layout is
typographic so it always renders.

**Social cards carry no photography.** The identity is navy + one gold rule + a
lattice motif, so all 95 services look like one brand without sourcing 95 photos.

## Adding a category

Add an entry to `PLAYBOOKS` in `playbooks.mjs`. Without one, a service falls back to
`DEFAULT_PLAYBOOK`, which is safe but generic.
