# Business Partner — الوكيل الذكي للمستندات (AI Document Agent)

> الفكرة في سطر: العميل يرفع مستندات **تحتوي** معلومات ونماذج **تحتاج** معلومات،
> والوكيل يقرأ ويستخرج ويطابق ويعبّئ ويسأل عن الناقص فقط ويسلّم الحزمة النهائية.
> القاعدة الذهبية: أي مستند يحتوي معلومة يمكن أن يصبح مصدراً، وأي مستند يحتاج
> معلومة يمكن أن يصبح هدفاً — والوكيل مسؤول عن ربط الاثنين.

هذه الوثيقة تصف ما بُني فعلاً في هذا الفرع، وما صُمِّم له مكانه وينتظر مرحلته.
المبدأ الحاكم: **إعادة استخدام القائم — لا إعادة بناء**. لا موقع جديد، لا نظام
حسابات جديد، لا خزنة جديدة.

---

## 1) أين تعيش الميزة في النظام القائم

| الطبقة | الموضع | ملاحظة |
|---|---|---|
| الصفحة | `/ai-document-agent` (ar/en) — `buildDocAgent()` في `site/scripts/generate.mjs` | Chat-first: محادثة + رفع، لا نماذج طويلة |
| الـAPI | `POST/GET /api/doc-agent` → rewrite إلى `api/requests.js?__route=doc-agent` → `api/_docagent.js` | خطة Vercel محدودة بـ12 دالة؛ النمط نفسه المتبع مع `suppliers` و`agencies` |
| القراءة الذكية | `api/_docread.js` — أضيف `readDocumentRaw()` (برومت مُعامَل) و`askModel()` (نص فقط) | سلسلة المزودين نفسها: Gemini ← Anthropic ← OpenAI |
| تحرير DOCX والضغط | `api/_zip.js` — قارئ/كاتب ZIP على `node:zlib` بلا أي اعتمادية npm | الـDOCX ملف ZIP؛ نرقّع `word/document.xml` فقط |
| تحرير XLSX | `api/_xlsx.js` — على `_zip.js` نفسه | خلايا inline string بخط أزرق؛ ما عداها لا يُمَس |
| تعبئة PDF | `api/_pdfform.js` — AcroForm بتحديث تزايدي | `/V` بـUTF-16BE + NeedAppearances؛ يقرأ ObjStm |
| التخزين | خزنة Supabase Storage القائمة (`documents` bucket) عبر `storagePut/storageGet/storageSign` | روابط موقّعة قصيرة العمر فقط، لا URL عام أبداً |
| الجلسات | كوكي `bp_sid` نفسه عبر `getSession()` — نفس حساب `/account` | `organization_id` يؤخذ من الجلسة، لا من الطلب أبداً |
| قاعدة البيانات | خمسة جداول جديدة في `db/schema.sql` (قسم مؤرخ 2026-08-27) مع RLS | انظر §3 |
| واتساب | `ops/n8n/doc-agent-whatsapp.workflow.js` + مدخل `whatsappIntake` بمفتاح `DOC_AGENT_HOOK_KEY` | n8n ناقل فقط؛ التحليل كله في المحرك |

## 2) دورة الطلب

```text
NEW → UPLOADING → ANALYZING → EXTRACTING → MAPPING → WAITING_FOR_CLIENT
    → READY_TO_GENERATE → GENERATING → QA → READY → DELIVERED → REVISION → COMPLETED
```

كل ملف مرفوع يُصنَّف تلقائياً إلى واحد من:
`source` / `target_form` / `supporting` / `signature_asset` / `stamp_asset` /
`requirement` / `unknown` — والتصنيف يقرره النموذج من محتوى الملف نفسه، لا من
اسمه ولا من نوعه.

## 3) نموذج البيانات — ملف العميل الموحّد

خمسة جداول (كلها بـRLS على عضوية المنشأة):

- **`doc_agent_requests`** — الطلب = محادثة واحدة عبر القنوات (`ref` بصيغة
  `DOC-######`، قناة، حالة، لون التعبئة، وضع التوقيع، checklist، تقرير QA،
  مفتاح الحزمة النهائية).
- **`doc_agent_files`** — كل ملف بدوره ونوعه ولغته وحالة صلاحيته
  (`VALID / EXPIRING_SOON / EXPIRED / UNKNOWN`) وخريطة حقوله إن كان نموذجاً.
- **`doc_agent_facts`** — قلب النظام: كل معلومة صف واحد يحمل
  **القيمة + المصدر (ملف/صفحة/تاريخ) + درجة الثقة + الحالة**:

  | الحالة | معناها |
  |---|---|
  | `VERIFIED` | ظاهرة بوضوح في مستند رسمي |
  | `CLIENT_CONFIRMED` | أكدها العميل صراحةً (مع القناة والوقت) |
  | `INFERRED` | استنتاج لا يدخل نموذجاً قبل تأكيد |
  | `CONFLICT` | مصدران بقيمتين مختلفتين — تُعرض القيمتان ويُسأل العميل |
  | `MISSING` | مطلوبة وغير موجودة |

- **`doc_agent_messages`** — نص المحادثة نفسها أياً كانت القناة
  (web/portal/whatsapp/consultant) مع الـactions المطبقة — وهذا هو Audit Trail
  التفصيلي لكل سؤال وجواب.
- **`doc_agent_outputs`** — المخرجات بإصدارات لا تُستبدل (append-only مثل
  `document_versions`)، مع `fill_summary` وحالة QA ونتائجها.

### قواعد المطابقة بين المستندات (مُنفَّذة في الكود لا في البرومت)

1. الأحدث أولاً (بتاريخ المستند)، والرسمي أولاً.
2. التعارض لا يُحسم تلقائياً أبداً: الحالة تصير `CONFLICT` ويُسأل العميل.
3. الإقرارات القانونية (PEP، عقوبات، تضارب مصالح، رشوة، ملاحقة ضريبية، مصدر
   أموال/ثروة، موافقات) **محمية بتعبير `SENSITIVE_KEY` في الكود**: أي محاولة
   من النموذج لكتابتها عبر `set_fact` تُرفَض؛ لا تدخل إلا عبر
   `confirm_declaration` المستند إلى رسالة صريحة من العميل.
4. الأسماء الرسمية لا تُترجم — الاسم العربي للحقل العربي والإنجليزي للإنجليزي.
5. «خلي تاريخ اليوم» تعني تواريخ التعبئة/التوقيع/الإقرار فقط — تواريخ إصدار
   المستندات الرسمية لا تُمَس (قاعدة مكتوبة في برومت التعبئة نفسه).

## 4) التعبئة — كيف نحافظ على النموذج الأصلي

نموذج DOCX لا يُعاد توليده: نفك الـZIP، نفهرس عقد النص `<w:t>` بأرقامها،
والنموذج اللغوي يعيد **خطة عمليات** لا مستنداً:

```json
{"ops": [
  {"node": 41, "op": "append",  "text": "Work Force Trading Co."},
  {"node": 52, "op": "replace", "text": "1010757593"},
  {"node": 63, "op": "check"}
]}
```

- `append`: قيمة بعد "Label:" — تُدرَج **كـrun جديد ملوّن** بعد `</w:r>` الأصلي.
- `replace`: عقدة placeholder (شرطات/نقاط) تُفرَّغ وتوضع القيمة الملونة بعدها.
- `check`: قلب `☐` إلى `☒` في العقدة نفسها.

كل ما يضيفه الوكيل يظهر بالأزرق (`1F4ED8`) افتراضياً — `fill_color` تقبل
`blue / black / original`. الخط والجداول والهوامش والهيدر والفوتر تبقى كما هي
لأننا لا نلمس إلا عقد النص المستهدفة.

نموذج Excel يُعامل بالمبدأ نفسه (`api/_xlsx.js`): الخلايا تُعرض للنموذج
اللغوي معنونة `[Sheet!Ref]`، وخطة العمليات `{sheet, ref, text}` تُكتب كـinline
strings بخط أزرق يُضاف إلى `styles.xml` — الصيغ والدمج وكل خلية لم تُمَس تبقى
حرفياً كما كانت، لأننا نرقّع عنصر `<c>` الواحد لا الورقة.

وملف PDF القابل للتعبئة (AcroForm) يُعبَّأ أصلياً (`api/_pdfform.js`): الحقول
تُكتشف حتى داخل Object Streams المضغوطة، والقيم تُكتب في `/V` بترميز UTF-16BE
(آمن للعربية) مع رفع `NeedAppearances`، وكل ذلك **تحديثاً تزايدياً** يُلحق
بنهاية الملف — بايتات النموذج الأصلي لا تُلمس إطلاقاً، وخانات الاختيار تُقلب
إلى حالة `On` المعرفة في النموذج نفسه.

النماذج غير القابلة للتحرير في مكانها (PDF ممسوح بلا حقول، صور): يخرج لها
**Fill Sheet** — ملف DOCX مرتب بكل حقل وقيمته بترتيب النموذج — إلى أن تصل
مرحلة Document Editor البصرية في n8n (§7). لا شيء يُتجاهل بصمت، ولا يُرسم
شيء على ظن فوق مستند ممسوح.

بعد التعبئة يمر كل مخرج بـ**QA نصي**: تمريرة ثانية تقارن الخطة بالنص النهائي
(هل كل قيمة انكتبت؟ هل بقي placeholder؟ هل التواريخ في مكانها الصحيح فقط؟)
وتسجل النتيجة في `qa_status/qa_findings`. الـQA البصري صفحةً صفحة مرحلة n8n
لاحقة.

## 5) المحادثة — Chat-first بكل القنوات

الواجهة محادثة واحدة: الرسالة الافتتاحية هي نص الخدمة المعتمد («ارفع المستندات
التي تحتوي على البيانات…»)، والرد على كل رفعٍ سردٌ لما فُهم (التصنيف، عدد
الحقائق المضافة، التعارضات، انتهاء الصلاحية). المنسّق (`askModel` بنظام
`chatSystem`) يعيد `reply + actions` منظّمة:

`set_fact` · `confirm_declaration` · `resolve_conflict` · `set_fill_color` ·
`set_signature_mode` · `ready_to_generate`

فأوامر مثل «Section 9 كله No» و«حط الختم» و«خلي كل اللي عبيته أزرق» تتحول
إلى أفعال مسجلة في `doc_agent_messages.actions`، والكود هو من يطبقها بحُرّاسه
(الإقرارات الحساسة، القيم المقصوصة، الحالات المسموحة) لا النموذج.

**Conversation ID واحد عبر القنوات:** الموقع والبوابة يلتقطان الطلب بالجلسة،
وواتساب يلتقطه بـ`contact` (رقم الجوال) — نفس الصف في `doc_agent_requests`،
نفس الرسائل، نفس الحقائق.

## 6) التوقيع والختم

- التوقيع لا يُصطنع أبداً. `signature_mode`:
  `leave_blank` (الافتراضي — «الملف جاهز، باقي توقيعك فقط») /
  `typed_electronic` (بتصريح صريح) / `external_esign` (تكامل DocuSign لاحقاً —
  الأساس موجود في `api/_docusign.js`).
- الختم: يُرفع مرة واحدة (`stamp_asset`)، يُحفظ في الخزنة ويُربط بـ
  `stamp_document_id`. إزالة الخلفية وتحويله PNG شفافاً وتركيبه في خانة
  Company Stamp حصراً — ضمن مرحلة Stamp Engine في n8n (§7)، والعمود جاهز.

## 7) توزيع الأدوار مع n8n

القاعدة: **المحرك في `_docagent.js` هو مصدر الحقيقة؛ n8n قنوات وأتمتة حول
المحرك، لا منطق موازٍ.** سير `doc-agent-whatsapp` محفوظ مصدرياً في
`ops/n8n/doc-agent-whatsapp.workflow.js` (انظر README هناك للتفعيل).

| Workflow من القائمة المقترحة | أين يعيش |
|---|---|
| AI Gateway / Intake / Classification / Extraction / Reconciliation / Form Understanding / Field Mapping / Gap Analysis / Conversation Manager / Checkbox Engine / Naming & Packaging | **منفَّذة داخل `_docagent.js`** — استدعاء واحد أرخص وأسرع من 11 سيراً متزامناً على Vercel |
| WhatsApp Channel | ✅ `doc-agent-whatsapp.workflow.js` |
| Vault Mirror (Drive + نوشن لكل عميل) | ✅ `doc-agent-vault-sync.workflow.js` — يستقبل من `vaultSync()` في المحرك |
| Stamp Engine (إزالة خلفية الختم وتركيبه) | n8n — مرحلة قادمة |
| Document Editor | ✅ AcroForm أصلياً في `_pdfform.js`؛ الرسم فوق الممسوح مرحلة n8n قادمة |
| Visual QA (فتح كل صفحة بصرياً) | n8n — مرحلة قادمة |
| Signature Workflow (DocuSign) | n8n + `api/_docusign.js` — مرحلة قادمة |
| Notification | القائم: `notify()` داخل التطبيق + `waSend()` في `_stage.js` |

## 8) لوحة المستشار وDocument Vault

- الملفات كلها في خزنة `documents` القائمة تحت
  `{orgId}/doc-agent/{requestId}/…` — فطلب العميل القادم يجد سجله وضريبته
  وبنكه وختمه محفوظة، ويُطلب منه الفورم الجديد فقط (`doc_agent_facts`
  تحمل `organization_id` لإعادة الاستخدام عبر الطلبات).
- لوحة المستشار (Approve / Correct / Ask Client / Regenerate / Send) مرحلتها
  القادمة واجهةً؛ بياناتها كلها متاحة الآن عبر `action=state` (الحقائق
  بمصادرها ودرجات ثقتها، التعارضات، النواقص، المحادثة، نتائج QA) —
  والمشرف يصل إليها بنمط أدوات `panel-*` القائم في `requests.js`.

## 9) الأمان

- تشفير التخزين لدى Supabase، والوصول بروابط موقّعة ≤ 10 دقائق فقط.
- عزل المستأجرين مرتين: `organization_id` من الجلسة في كل استعلام + RLS.
- مفتاح واتساب `DOC_AGENT_HOOK_KEY` سري في Vercel، والمدخل يرفض بدونه (401).
- حدود صارمة: 8MB للملف، أنواع MIME محددة، قص كل النصوص قبل التخزين.
- `audit()` عند كل تصنيف وتوليد وتأكيد إقرار — مع القناة والوقت.
- لا يُحذف إصدار مخرجات أبداً (append-only) — طلب المراجعة يولّد إصداراً جديداً.

## 10) متغيرات البيئة

| المتغير | جديد؟ | ملاحظة |
|---|---|---|
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | قائمة | سلسلة المزودين نفسها |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | قائمة | القاعدة والخزنة |
| `DOC_AGENT_HOOK_KEY` | **جديد** | مفتاح مدخل n8n/واتساب |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | قائمة | داخل n8n لهذه القناة |

## 11) خريطة المراحل (1–15) وحالها في هذا الفرع

| المرحلة | الحال |
|---|---|
| 1 Architecture · 2 Database · 3 Intake · 4 Extraction · 5 Mapping · 6 Conversation | ✅ في هذا الفرع |
| 7 Document Editing | ✅ DOCX وExcel وPDF (AcroForm) في مكانها؛ الممسوح عبر Fill Sheet |
| 8 Stamp & Signature | البنية جاهزة (أعمدة + تصنيف الأصول)؛ التركيب مرحلة n8n |
| 9 Visual QA | QA نصي ✅؛ البصري مرحلة n8n |
| 10 Packaging | ✅ ZIP بأسماء التسليم وبنية Required/Supporting |
| 11 Website Chat | ✅ `/ai-document-agent` |
| 12 WhatsApp | ✅ مصدر السير + المدخل؛ يحتاج تفعيل الاعتمادات في n8n |
| 13 Client Portal | ✅ عرض كامل داخل `/account` (`?view=docagent`) بتصميم الموقع الجديد + تجربة 14 يوماً |
| 14 Consultant Dashboard | البيانات جاهزة عبر الـAPI؛ الواجهة مرحلة قادمة |
| 15 End-to-End Testing | اختبارات وحدة لمحركات DOCX وXLSX وPDF وZIP ✅ (`tests/`)؛ E2E مع مفاتيح حية بعد النشر |

## الخطوة التالية (تحتاج قرارك)

1. تشغيل قسم SQL الجديد في Supabase (نسخ قسم 2026-08-27 من `db/schema.sql`).
2. وضع `DOC_AGENT_HOOK_KEY` في Vercel وتفعيل سير واتساب في n8n.
3. تحديد سعر الخدمة وكودها في كتالوج نوشن لتظهر في `/ai-agents` والسلة.

## 12) الوصول: تجربة مجانية 14 يوماً داخل لوحة العميل

الخدمة تظهر لكل منشأة مسجّلة في لوحة العميل **بدون شراء**. لا يوجد زر تفعيل: أول
استدعاء لـ`start` أو `upload` أو `chat` أو `generate` يختم
`organizations.doc_agent_trial_started_at`، ومن تلك اللحظة تبدأ 14 يوماً
(`DOC_AGENT_TRIAL_DAYS` يغيّر المدة).

- `GET /api/doc-agent?action=access` يرجع
  `{ entitled, trial_days, trial_started_at, trial_ends_at, days_left, allowed }`.
- الاشتراك المدفوع (`service_entitlements` بكود من `DOC_AGENT_SERVICE_CODES`،
  افتراضياً `bp-ai-doc-01,bp-doc-agent`) يلغي جدار التجربة نهائياً.
- بعد انتهاء التجربة: **القراءة والتنزيل تبقى مفتوحة للأبد** — يُمنع فقط عمل جديد
  (رفع، محادثة، تعبئة) بردّ `402 trial_ended` مع رسالة عربية جاهزة للعرض.

### عزل العميل في المتصفح

الـAPI يرفض أي طلب بلا جلسة (`401`) أو بلا منشأة (`400`)، فلا يُحفَظ شيء لزائر غير
مسجّل. وفوق ذلك يربط المتصفح المؤشّر المخزَّن محلياً (`bp_da_ref`) بهوية المنشأة
(`bp_da_org`) العائدة من `?action=list`: أي اختلاف — تسجيل خروج، أو عميل آخر على
نفس الجهاز — يمسح المؤشّر وسجل المحادثة قبل أي عرض.
