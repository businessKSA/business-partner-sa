# n8n Workflow Blueprints (A–E) — mapped to existing/new IDs

Credentials (from build log): Notion HTTP `rlcg0SxC5HwxsPez` (Bearer) · Anthropic `mmbdtwapuZXoY91N` · Groq `dhoBme9q4ESj2pAS` · Drive `mHS45s95MuOJo4Ni` · Gmail `hUBmAJLkWouBZjSN` · WhatsApp `dPP94SCEPI6Qz1nx`. Model: `claude-sonnet-4-6`. `$env` is blocked → read config from `$vars` only (guarded). Times: Asia/Riyadh.

---

## Workflow A — Compliance Intake  → EXISTS (consolidate)
- Canonical public path: **`R71kgwaBNw6WzKFI`** (site webhook, CORS/multipart → Drive → Notion client file → team email + client confirmation).
- Internal/manual fallback: **`Ei5FY8iiLooTjEm6`** (n8n-hosted form).
- **TODO:** widen intake fields to `intake-schema.json`; on new file → emit event to Workflow B.
- Steps: receive intake → validate required → upsert Company (`5d570a75…`) → store files in per-company Drive folder → trigger B → acknowledge (email/WhatsApp).

## Workflow B — Document Extraction  → NEW (TODO-N8N)
- Trigger: new uploaded file (from A) or Drive watch.
- Steps: detect type → **Claude vision/OCR** (Anthropic `document/image analyze`) extract dates/IDs/names/certificate numbers/expiry/issue/status/warnings → classify document type → write **Uploaded Documents** row (Extracted Fields JSON + Confidence Score) → upsert **Compliance Register** items → if confidence < threshold or required field missing → set `Needs Human Review` / create "Missing Data" task → trigger C.
- Per-platform parsers (Phase 2): GOSI Excel, Muqeem export, Qiwa PDF.

## Workflow C — Compliance Assessment  → EXISTS (extend)
- Base: **`DXfVlWVFHyU7eoBE`** (daily 07:00). Also trigger on new data + manual.
- Steps: read Company + Compliance Register (`7258a074…`) → apply **`rules-engine.json`** (days_remaining, risk, health score) → call Nitaqat `bklN7C6F08NJ7TJE` / Fees `fUBftwquKyBuRJ0P` / GOSI `FlBeLfyjQaSpPAzR` where relevant → generate alerts → upsert **Audit Trail** (`6879f590…`, status "Pending Approval") → create Missing Data tasks → decide `Human Approval Required` → trigger D.
- **TODO:** load rules from the JSON (currently rules are inline for Qiwa/Muqeem); add platform routing from intake flags.

## Workflow D — Daily Compliance Report  → EXISTS (extend)
- Base: daily report inside `DXfVlWVFHyU7eoBE` (working; emails AR report). 
- Steps: read active subscribed companies → summarize 🔴/🟠/🟡 + health score → render AR+EN report (`templates/email-report.html`) → email internal → **WhatsApp** client if enabled+approved (`templates/whatsapp-report.md`, Meta `bp_compliance_alert`) → store record in **Compliance Reports** DB (TODO-NOTION) with counts + `Email Sent`/`WhatsApp Sent`.

## Workflow E — Human Approval Gate  → NEW (TODO-N8N)
- Trigger: any action requiring approval (from C/agent).
- Steps: create Human Approval Matrix row (`Pending Approval`) → notify responsible person → wait (Notion status poll / Wait) → if Approved & (no payment OR Paid) → `Execution Allowed=true` → emit execution task → if Rejected → close → log every transition to Audit Trail with n8n Execution ID. See `human-approval.md`.

---

### Build order (recommended)
1. Extend intake (A) + fields → 2. Uploaded Documents DB + Extraction (B) → 3. Rules-engine-driven Assessment (C) + Reports DB → 4. Approval Gate (E) + payment gate → 5. WhatsApp live → 6. Per-client dashboard (Phase 2/3).
