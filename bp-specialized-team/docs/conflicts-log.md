# Role Conflicts & Decision Log

## Open — awaiting Baher's decision (blocks TEAM-004/TEAM-005 builds)

### C-001 · محمد Mohammed — Legal & Compliance vs IT

- **Option A — keep TEAM-004 (Legal & Compliance Review).** Approved KB policy; the live
  WhatsApp router (Mazen) already hands legal/sensitive cases to "محمد". Choosing A means
  the draft's IT scope needs a **new named agent** (e.g. from the undefined-roles pool).
- **Option B — draft wins (IT Manager).** Requires rewriting TEAM-004, re-pointing Mazen's
  legal routing (likely to عبدالعزيز — مدير الشؤون القانونية from the draft's pending
  roles), and updating Badr's routing section.
- **Option C — hybrid:** Mohammed keeps Legal & Compliance persona client-side; IT becomes
  an internal (non-client-facing) agent under another name.

### C-002 · فرح Farah — Operations & Escalation vs Marketing

- **Option A — keep TEAM-005 (Operations Manager & Escalation Owner).** Approved KB policy;
  Mazen routes human-contact/escalation to "فرح", and Badr's Draft-Proposal approval path
  targets her. Choosing A means the draft's Marketing scope needs a new named agent.
- **Option B — draft wins (Marketing Manager).** Requires rewriting TEAM-005, moving the
  escalation-owner role (candidate per draft: مازن — مدير العمليات in the pending list),
  and re-pointing Mazen + Badr routing.
- **Option C — hybrid:** Farah keeps escalation ownership (small, well-defined) and gains
  the Marketing build as her main workflow.

**Impact while open:** Badr's prompt references Mohammed/Farah for routing *per the approved
TEAM cards*, each marked "role pending Baher's confirmation". Whatever is decided, only the
routing lines in `prompts/badr-sales-bd.md` need updating.

## Resolved decisions

| ID | Date | Decision | Decided by |
|----|------|----------|------------|
| D-001 | 2026-07-02 | Malak's draft scope item "OTP والتحقق" excluded from the agent — global sensitive-data rule keeps OTP/verification human-only. | Build rule (brief §7) — flag to Baher for confirmation |
