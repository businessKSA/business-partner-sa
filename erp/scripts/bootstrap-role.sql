-- ═══════════════════════════════════════════════════════════════════════
-- إنشاء دور التطبيق الذي **لا يتخطّى** عزل الصفوف.
--
-- يُشغَّل مرّةً واحدة على قاعدة الإنتاج، بدورٍ إداري (`postgres` على
-- Supabase)، **قبل** أوّل `npm run db:push`.
--
-- ── لماذا هذا الملف موجود أصلاً ──────────────────────────────────────
--
-- مزوّدو Postgres المُدارون يسلّمونك رابط اتصالٍ بدورٍ إداري. وعلى
-- Supabase تحديداً، الدور `postgres` — وهو صاحب الرابط الذي تنسخه من
-- اللوحة — يحمل `rolbypassrls = true`. تحقّقنا من ذلك على مشروعٍ حيّ:
--
--   rolname     | rolsuper | rolbypassrls
--   postgres    | f        | t     ← الرابط الذي تنسخه من اللوحة
--   service_role| f        | t
--   supabase_admin | t     | t
--
-- ومعنى `rolbypassrls` أن Postgres يعفي هذا الدور من كل سياسة صفوف
-- إعفاءً تاماً: السياسات تبقى معرَّفةً في الجداول، و`\d` يعرضها، ولا
-- تُطبَّق على استعلامٍ واحد. فلو وصل التطبيق بهذا الدور لصار كل عملاء
-- المنصّة في دفترٍ واحد — ولا شيء في الشاشة ولا في السجلّات ولا في
-- الاختبارات يشي بذلك، لأن كل استعلامٍ يعود بصفوفٍ تبدو صحيحة.
--
-- ولهذا لا يُترك الأمر لانتباه من ينشر: `npm run db:push` يفحص الدور
-- ويرفض المتابعة إن كان يتخطّى العزل. هذا الملف هو الجواب على ذلك
-- الرفض — لا حيلةٌ للالتفاف عليه.
-- ═══════════════════════════════════════════════════════════════════════

-- ١. الدور. غيّر كلمة السر إلى واحدةٍ مولَّدة عشوائياً قبل التشغيل:
--      openssl rand -base64 24
\set app_password 'ضع-كلمة-سر-قوية-هنا'

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    CREATE ROLE erp_app LOGIN;
  END IF;
END
$$;

ALTER ROLE erp_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
  PASSWORD :'app_password';

-- ٢. صلاحياته على المخطّط. الدور يملك الجداول ليقرأ ويكتب **ضمن**
--    السياسات؛ والملكية لا تعني التخطّي — التخطّي هو `BYPASSRLS` وحده،
--    ويُضاف إليه أن الجداول أُنشئت بـ`FORCE ROW LEVEL SECURITY` فتُطبَّق
--    السياسات على مالكها أيضاً.
GRANT USAGE, CREATE ON SCHEMA public TO erp_app;
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO erp_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO erp_app;

-- وما يُنشأ لاحقاً (الترحيلات القادمة) يرث الصلاحيات نفسها
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO erp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO erp_app;

-- ٣. الإثبات. يجب أن يعود السطر بـ f و f. إن عاد بغير ذلك فلا تُكمل
--    النشر — العزل لن يُطبَّق مهما بدت الشاشات سليمة.
SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = 'erp_app';

-- ═══════════════════════════════════════════════════════════════════════
-- بعد هذا الملف:
--
--   DATABASE_URL="postgresql://erp_app:<كلمة السر>@<المضيف>:5432/postgres"
--   npm run db:push        ← يفحص الدور ثم ينشئ الجداول والسياسات
--
-- ولا تضع رابط `postgres` في متغيّرات بيئة التطبيق أبداً — ولا حتى
-- مؤقّتاً «حتى نُشغّله ثم نصلحه»: أوّل تشغيلٍ بهذا الرابط يكتب صفوفاً
-- بلا عزل، ولا يُعرف بعدها أيُّ صفٍّ رآه من.
-- ═══════════════════════════════════════════════════════════════════════
