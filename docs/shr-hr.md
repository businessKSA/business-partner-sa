# SHR-HR — لوحة تشغيل الفواز (المرحلة ٢، محلية)

بيانات وهمية فقط. لا ربط حكومي ولا رسائل. تعمل مع `LOCAL_DB=1` وحدها؛ أي بيئة
أخرى ترد `503 shr_local_only`.

- `api/_shr.js` — بوابة العزل `scoped` + بذرة المستأجرين الوهميين (`SHR` و`OTHER`).
- `api/shr.js` — دالة واحدة (action): `session` · `session-end` · `dashboard` ·
  `workers` · `worker-create` · `worker-activate` · `worker-archive` · `requests` ·
  `request-state` · `expiring`. `worker-delete` يُرفض (أرشفة فقط).
- الجلسة كوكي موقَّع؛ المستأجر منه لا من الطلب (`tenant_id` في الطلب يُرفض).
- الأدوار في هذه المرحلة: `tenant_owner` و`operator`.
- التفعيل يتطلب: الهوية، مستند إقامة سارٍ، عقد عمل، منشأة وعميل؛ ويعتمده مستخدم غير من أدخل المسودة.
- الواجهة: `site/scripts/simple-v1-shr.mjs` (`buildShrOps`) — تنتظر تسجيلها في `generate.mjs` والمسار `/SHR-HR`.
- الاختبارات: `tests/shr-tenant.test.mjs` (البوابة) و`tests/shr-api.test.mjs` (الـAPI).

دخول تجريبي: `SHR` → `owner@shr.invalid` / `ops@shr.invalid`؛ `OTHER` → `owner@other.invalid` / `ops@other.invalid`.
