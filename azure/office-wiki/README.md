# مساحة المكتب (بديل نوشن خاص) — Outline على Azure

داخلية للفريق فقط. الدخول بحساب Microsoft Entra للمكتب، والبيانات في Postgres وAzure Files عندنا.

## قبل أول نشر (مرة واحدة، يفعلها المالك)
1. Entra ← App registrations ← New: **Single tenant** (حتى لا يدخل إلا حسابات المكتب).
2. أنشئ Client secret.
3. أضف أسرار المستودع: `OFFICE_TENANT_ID` · `OFFICE_CLIENT_ID` · `OFFICE_CLIENT_SECRET` (و`AZURE_CREDENTIALS` موجود).
4. شغّل Actions ← **Deploy Office Wiki to Azure** واكتب `deploy-office`.
5. بعد النشر أضف Redirect URI: `https://<العنوان>/auth/oidc.callback` (يطبعه السكربت).
6. قيّد الوصول من Entra ← Enterprise applications ← Users and groups (Assignment required).

## الحدود
- Outline مساحة وثائق وويكي. **الجداول وقواعد البيانات (CRM/المهام) ليست فيه** — المرحلة الثانية: NocoDB على الأساس نفسه إن أردتها.
- نسخة واحدة دائمة. يحتاج نسخاً احتياطياً لقاعدة Postgres (مفعّل افتراضياً 7 أيام على Flexible Server).
- التكلفة تُحتسب من منحة Azure؛ راقبها في Cost Management.
