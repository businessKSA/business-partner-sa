# HR/ATS MVP — Business Partner

Date: 2026-07-13
Scope: HR/ATS only. Packages path is untouched.

## What changed

- Expanded `/careers` and `/ar/careers` from a candidate-pool form into a small ATS-style job board.
- Added single job pages:
  - `/jobs/hr-operations-specialist`
  - `/jobs/recruitment-coordinator`
  - `/ar/jobs/hr-operations-specialist`
  - `/ar/jobs/recruitment-coordinator`
- Added application fields for selected job, application questions, notice period, work authorization, and CV upload metadata.
- Updated `api/candidate.js` to save richer application notes to the existing Notion ATS DB and forward a copy to n8n.
- Created n8n workflow `BP — Website ATS Intake → AI Screening` (`E4DC5bIkRqFaDlhr`) for website ATS intake and AI screening.

## Verification

- `node --check api/candidate.js`
- `ASTRO_TELEMETRY_DISABLED=1 HOME=/workspace/scratch/c074c04914eb npm run build`

## n8n

Default webhook used by the site API:

`https://businesspartnerai.app.n8n.cloud/webhook/bp-ats-application`

Vercel env vars may override this through `N8N_ATS_WEBHOOK`, `N8N_CANDIDATE_WEBHOOK`, or `BP_ATS_WEBHOOK`.
