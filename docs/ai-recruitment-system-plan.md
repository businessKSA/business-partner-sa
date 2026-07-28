# Integrated AI Recruitment System — Build Plan

Date: 2026-07-28
Owner deliverable turning the recruitment-system audit into an actionable,
phased build. Scope: unify the recruitment stack (site → API → Notion → n8n)
into one coherent AI-driven hiring system. This doc is a plan to approve
before mutating any live data or workflows.

## Where we are today (as-built)

Working, but fragmented across three candidate stores and two job stores:

- **Candidate pools (3, disjoint):**
  - Website applications → Notion ATS `71792742…` (via `api/candidate.js`).
  - Recruitment-agent pipeline (headhunt, job-board email, screening) → Notion
    `c4346abd…` (n8n only).
  - Outlook 20k-CV processor → a third store (n8n, unverified id).
- **Job sources (2, disjoint):**
  - Static `site/data/workshop-jobs.json` (campaign roles, salaries hidden).
  - Notion employer-postings `260d76…` (self-service, `?openJobs=1`).
- **AI:** `api/hire.js` (match/summary/interview/outreach, ephemeral) + n8n
  agents (extract, score, JD-writer, matcher) on a different model stack.
- **Live n8n workflows:** Job Posting & Screening, Headhunter, Candidate↔Job
  Matcher, Website ATS Intake, Outlook→ATS.

### The core weakness
The ATS keeps **one row per person** (dedup collapses multi-job applicants),
so there is **no Application entity** and **no Candidate↔Job relation** — a
job's `jobId` survives only as free text in `Notes`. Per-role/per-wave
reporting, stored AI scores, and a real pipeline are therefore not queryable.

## Target data model

Five related Notion data sources (or one Supabase schema if we outgrow
Notion). Additive — built alongside the live DBs, then backfilled.

| Entity | Key fields | Relations |
|---|---|---|
| **Candidates** (unify the 3 pools) | name, phone, email, nationality/iqama, field, skills, CV links, source, dedup-key | ← Applications |
| **Jobs** (unify workshop JSON + employer postings) | title (en/ar), department, openings, wave, employer/client, status, salary band (internal) | ← Applications |
| **Applications** *(new — the missing spine)* | stage, AI fit-score, AI reason, applied-at, source | → Candidate, → Job |
| **Interviews** *(new)* | datetime, mode, panel, outcome | → Application |
| **Offers** *(new)* | status, package (internal), start date | → Application |

One person → many Applications; one Job → many Applications. Stage, score,
and history live on the Application, not the person.

## Phased build order

**Phase 0 — Security (in progress).** ✅ Code holes closed on the deploy
branch (PR #149: owner-email auto-activation removed, 12-char CSPRNG access
codes, env-name leak + salary self-view + un-hide/notes-clobber fixed).
Remaining: gate `/api/hire`, OTP on candidate self-view, rate-limiting,
per-DB Notion tokens, a nightly Notion→cold-storage export, `.env.example`.
Operational: rotate/retire the guessable hand-made active codes
(`BP-…-2026`, demo codes).

**Phase 1 — Unify the data model (foundation).**
1. Create the `Applications` data source with Candidate + Job relations.
2. Unify the job sources under one `Jobs` schema (workshop JSON + employer
   postings), so the board, screening, and reporting all read one shape.
3. Point `api/candidate.js` and the n8n intakes at one Candidates DB; write an
   Application row per submission (relation, not `Notes` text).
4. Backfill: migrate `c4346abd…` + Outlook rows into the unified Candidates
   DB with fuzzy dedup (name + CV + phone/email), collapsing duplicates.

**Phase 2 — Sourcing.** Wire the already-available connectors: Apollo
(headhunt/outreach for the senior roles), the Indeed XML feed (built in #117),
and the Outlook drain — all into the unified Candidates DB.

**Phase 3 — Screening & ranking.** Structured knock-out criteria per Job,
semantic match (embeddings) instead of substring keywords, and **persist the
AI score on the Application** so ranking is stored, comparable, and improvable.

**Phase 4 — Automation.** Interview scheduling via Google Calendar (connector
present, unused), event-driven stage transitions, and a "hired → onboarding"
handoff into the core BP government-ops product (Qiwa/GOSI/Muqeem) — the
missing bridge between the two halves of the business.

**Phase 5 — Analytics.** Funnel, time-to-hire, source attribution, and the
per-wave rollups the workshop plan promised — computed from the Application
entity.

## Guardrails
- Additive first: build new schemas beside the live ones, backfill, then cut
  over — never mutate the running ATS in place.
- Coordinate with concurrent login/ops-center work already on the deploy
  branch to avoid conflicting edits.
- No candidate PII to third-party LLMs without a consent gate; add an
  audit log of who unlocked/viewed contacts.

## Open decisions for the owner
1. Retire the guessable active employer codes now? (`BP-…-2026`, demo rows.)
2. Stay on Notion for the unified model, or move to Supabase (schema already
   scaffolded in `api/_db.js`) for real relations + row-level security?
3. Phase 1 start: unify candidates first, or jobs first?
