# Events Fabrication Workshop — Client Recruitment Campaign

Date: 2026-07-22
Scope: talent attraction + hiring support for a client building an events
fabrication workshop. The client is a major entertainment and events services
provider in Saudi Arabia; it is kept **anonymous** on the public site, and its
salary scales are **not published** (the application form collects the
candidate's expected salary instead).

## What shipped

- `site/data/workshop-jobs.json` — 23 bilingual (EN/AR) role postings distilled
  from the client's job-description pack, with openings counts from the
  client's workshop hiring plan (May–Dec 2026).
- Campaign hub page at `/jobs/events-workshop` (+ `/ar/...`): hero, stats band
  (150+ openings, 10+ departments, 4 hiring waves), roles grouped by
  department, and a candidate-pool CTA for trades not yet posted.
- One job page per role under `/jobs/workshop-*` with an embedded application
  form scoped to that posting — same flow as existing job pages: application →
  `api/candidate.js` → Notion ATS DB + n8n AI screening
  (`BP — Website ATS Intake → AI Screening`).
- A campaign band on `/careers` (EN/AR) pointing to the hub.
- Sitemap entries for the hub and all role pages.

## Hiring plan summary (client's plan, 20 May 2026 revision)

- **186 total heads**: 22 direct hires (management, engineering, team leaders,
  warehouse) and 164 via third-party manpower supply.
- Hiring waves: **May–Jun 53 · Jul–Aug 59 · Sep–Oct 49 · Nov–Dec 25**.
- The plan gives priority to redeploying the client group's existing employees
  before external sourcing.
- Salary bands range from 3,500 SAR (skilled labor) to 30,000 SAR (plant
  manager) — kept internal; do not publish.

## Posted roles (23)

| Group | Roles (openings) |
|---|---|
| Management | Factory/Plant Manager (1), Production Manager (1), Installation Manager (1), Engineering Manager (1), Quality Manager (1), Maintenance Manager – Mechatronics (1) |
| Engineering & Design | Technical Design Engineer (6) |
| Team Leaders | Installation (5), Carpentry (1), Steel Fabrication (1), Printing (1), Foam (1), Painting (1) |
| Warehouse & Logistics | Warehouse Manager (1), Logistics Supervisor (1), Store Keeper (3) |
| Technicians | Carpenter (35), Steel Fabricator/Welder (6), Printing Operator (6), Tailor/Scenic Stitcher (3), Foam Sculptor (3), Painter (6) |
| Skilled Trades | Skilled Labor — all trades, one combined posting (70) |

Total posted openings: **156**.

## Not posted (and why)

- **Finance / HR–Government Relations / Procurement Officers (3 each)** — the
  client's plan marks these "exclude the sourcing request pending business
  alignment", and no JDs were provided.
- **Production / Quality / Installation Engineers (1 each), Detailing
  Engineers (4), Maintenance Technicians (2), Electrical Team Leader (1),
  Electrical Technicians (5), Installation/Fabric & Branding Technicians (6)**
  — in the plan but no approved JD in the client's JD pack. Post once JDs
  arrive (electrical + installation trades are meanwhile covered by the
  combined Skilled Labor posting for the labor tier).
- **Production Team Leader** — a JD exists but the role is absent from the
  hiring plan and the client's "List of Required Positions"; confirm with the
  client before posting.

## Sourcing strategy by tier

1. **Management & engineering (direct hires)** — LinkedIn outreach + targeted
   search in GCC events/exhibitions/scenic fabrication companies; the JDs
   demand events-industry experience (10–15+ years for managers), so generic
   industrial candidates will fail screening.
2. **Team leaders & technicians** — trade-specific channels and the existing
   BP candidate pool; test practical skills (welding certs, RIP software,
   CAD reading) at interview stage.
3. **Skilled labor (third-party)** — route through manpower suppliers per the
   plan's direct/third-party split; the combined posting also builds a
   walk-in pipeline the suppliers can draw from.
4. **Every application** lands in the Notion ATS tagged with its
   `workshop-*` job id, so per-role pipelines and wave-based reporting come
   for free.

## Follow-ups

- Get JDs for the unposted engineering/electrical/detailing roles and add them
  to `workshop-jobs.json` (the generator picks them up automatically).
- Confirm the workshop's city with the client — postings currently say
  "Saudi Arabia" only.
- Optional: mirror the campaign into the employer-side Notion open-jobs DB so
  it also appears in the dynamic "Jobs from our employer clients" section.
