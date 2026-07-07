# Human Approval & Payment-Before-Execution Logic
**بوابة الموافقة البشرية — منطق التشغيل**

The agent may **monitor, recommend, and prepare** freely. It may **never execute** an official/financial/legal/government/payroll/platform action without a matching **Approved** record. This is the core safety guarantee of the Concierge model.

## State machine (per approval request)
```
Not Required ──(action needs approval)──► Pending Approval
Pending Approval ──approve──► Approved ──(payment?)──► [Payment Pending] ──paid──► Execution Allowed ──execute──► Done
Pending Approval ──reject──► Rejected (close + log)
```

## Rules
1. **Trigger:** any action with `human_approval = true` in `rules-engine.json`, or any renewal/transfer/issuance/cancellation/filing/payment/data-submission, or anything needing Nafath/OTP.
2. **Record:** create a Human Approval Matrix row (or Audit-Trail row with approval fields): Company, Action Type, Platform, Requested By Agent, Reason, Risk Level, Required Approver, Approval Status = `Pending Approval`, Payment Required, Payment Status, Execution Allowed = false.
3. **Notify:** internal responsible person (email/WhatsApp/Notion). Client is notified per their notification settings.
4. **Approver identity:** only the authorized company owner/manager. Approval is an explicit action (Notion status change / signed link / owner WhatsApp confirmation) — **never** an OTP or password shared in chat.
5. **Payment gate:** if `Payment Required = true`, `Execution Allowed` stays false until `Payment Status = Paid` (bank transfer + receipt + sender name → verified). Payment-before-execution.
6. **Execution:** only when `Approval Status = Approved` AND (`Payment Required = false` OR `Payment Status = Paid`) → set `Execution Allowed = true` → create execution task. V1 execution is **human/concierge**; V2+ may execute via sanctioned APIs, still gated by this record.
7. **Audit:** every transition is written to the Audit Trail with timestamp, actor, n8n Execution ID, and the agent's reasoning summary. Nothing sensitive proceeds without a matching Approved record.
8. **Security:** authorization sessions (Nafath/OTP) are owner-initiated, out-of-band, and logged as an approval event — their codes are never stored or requested in chat.

## n8n mapping
- Workflow **E (Human Approval Gate)** creates the request, notifies, and waits (Notion status poll or Wait node). On approve+paid → emits an execution task; on reject → closes + logs.
- Workflow **C** sets `Human Approval Required` on register items/alerts; Workflow **D** lists approval-required items in the report.
