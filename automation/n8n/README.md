# n8n Automations

Version-controlled n8n workflows for Business Partner. This directory mirrors the workflows deployed at `https://businesspartnerai.app.n8n.cloud`.

## candidate-intake.json — بوابة استقبال المرشحين

**Deployed workflow ID:** `jKY98dsZ9EKA8yFj` (active)
**Production webhook:** `POST https://businesspartnerai.app.n8n.cloud/webhook/candidate-intake`
**Site form:** `https://businesspartner.sa/ar/candidates`

Receives a candidate intake form submission, uses Claude to extract a structured profile from the candidate's free-text story, and creates a record in the candidates Notion database (👤 المرشحون).

**Flow:**

1. **استقبال النموذج** — Webhook trigger (`POST /webhook/candidate-intake`)
2. **تجهيز طلب Claude** — Code: trims the free-text `story` (placeholder if empty)
3. **Claude — استخراج الملف** — Anthropic node (`claude-sonnet-4-6`, credential "Anthropic account"): extracts a structured JSON profile
4. **بناء صفحة Notion** — Code: maps profile + form fields to flat values and a formatted profile body (split into ≤1900-char chunks for Notion's rich-text limit)
5. **إنشاء سجل المرشح في Notion** — Notion node (OAuth2 credential "Notion OAuth2 API"): creates the page in database `d3168d6642a942d59e0b21c849a8f46d` with all 11 properties + profile body blocks
6. **رد للنموذج** — Responds `{"status": "ok"}` to the form

### Expected webhook body

```json
{
  "name": "...",
  "email": "...",
  "phone": "...",
  "cities": "...",
  "salary": "...",
  "linkedin": "...",
  "consent": true,
  "story": "free-text career story / CV text"
}
```

### Credentials (already wired in n8n)

| Node | Credential | Type |
|---|---|---|
| Claude — استخراج الملف | Anthropic account | `anthropicApi` |
| إنشاء سجل المرشح في Notion | Notion OAuth2 API | `notionOAuth2Api` |

The Notion integration must be shared with the candidates database, and the Anthropic account needs API credits.

### Notion database properties

الاسم (Title) · البريد (Email) · الجوال (Phone) · المدن، المسميات المستهدفة، نطاق الراتب، الكلمات المفتاحية (Rich text) · لينكدإن (URL) · الحالة (Select: نشط/متوقف) · موافقة على التقديم نيابةً (Checkbox) · تاريخ الموافقة (Date)

### Notes

- If Claude's output can't be parsed as JSON, the record is still created from the raw form fields.
- The site form endpoint is configurable via the `PUBLIC_CANDIDATE_ENDPOINT` env var (falls back to the production webhook URL).
