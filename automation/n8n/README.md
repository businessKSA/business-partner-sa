# n8n Automations

Version-controlled n8n workflows for Business Partner. Import a `.json` file into n8n via **Workflows → Import from File**.

## candidate-intake.json — بوابة استقبال المرشحين

Receives a candidate intake form submission, uses Claude to extract a structured profile from the candidate's free-text story, and creates a record in the candidates Notion database.

**Flow:** Webhook (`POST /webhook/candidate-intake`) → build Claude request → `POST api.anthropic.com/v1/messages` (model `claude-sonnet-4-6`) → map response + form fields to Notion page properties/blocks → `POST api.notion.com/v1/pages` → respond `{"status": "ok"}` to the form.

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

### Required credentials (n8n → Credentials → Header Auth)

| Node | Header | Value |
|---|---|---|
| Claude — استخراج الملف | `x-api-key` | Anthropic API key |
| إنشاء سجل المرشح في Notion | `Authorization` | `Bearer <Notion integration secret>` |

### Notion database

Target database ID is set in the "بناء صفحة Notion" node (`d3168d6642a942d59e0b21c849a8f46d`). The database must have these properties:

- الاسم (Title), البريد (Email), الجوال (Phone), لينكدإن (URL)
- المدن, المسميات المستهدفة, نطاق الراتب, الكلمات المفتاحية (Rich text)
- الحالة (Select, with option "نشط")
- موافقة على التقديم نيابةً (Checkbox), تاريخ الموافقة (Date)

The Notion integration must be shared with (connected to) this database.

### Notes

- Both HTTP nodes send the incoming item as the JSON body via `{{ JSON.stringify($json) }}`.
- Page body blocks (summary, skills, achievements, experience, education, languages) are capped at 100 blocks — Notion's per-request limit for `children`.
- If Claude's output can't be parsed as JSON, the record is still created from the raw form fields.
