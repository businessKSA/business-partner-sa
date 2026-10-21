-- ============================================================================
-- Business Partner — مراحل الطلب وتحديثات الفريق (requests.stages / requests.updates)
-- مسوّدة غير مطبَّقة (2026-10-21) — تُراجَع ثم تُطبَّق يدوياً من المالك؛ لا أحد يطبّقها على قاعدة حقيقية آليّاً.
-- تعتمد على db/schema.sql كما هو (جدول requests). Idempotent: add column if not exists.
--
-- عمودان jsonb على الجدول نفسه، كما في quote و contract و documents — لا جدول جديد:
--
--   stages  [{key, title_ar, title_en?, status: 'pending'|'active'|'done', at, note}]
--           خط التقدّم الذي يحرّكه الفريق. أول مرحلتين لعميل المبيعات (sign_quote, first_payment)
--           تُملآن آلياً من حدثي توقيع العقد والدفع (api/_simple.js: autoStages).
--   updates [{id, at, by, text_ar, text_en?, published, published_at}]
--           سجلّ تحديثات الفريق. التحديث مسوّدة حتى يضغط الفريق «نشر للعميل»؛ والمسوّدة لا تُرسل
--           للعميل أبداً (clientView يرشّحها). `by` اسم من كتبه وهو داخلي لا يصل العميل.
--
-- طلب بلا مراحل ولا تحديثات (كل عملاء السلة وما سبق) يبقى كما كان: القيمتان '[]' وواجهة /my
-- لا ترسم شيئاً. لا فهارس: القراءة دائماً بطلب واحد بمرجعه.
-- ============================================================================

begin;

alter table requests add column if not exists stages  jsonb not null default '[]'::jsonb;
alter table requests add column if not exists updates jsonb not null default '[]'::jsonb;

comment on column requests.stages  is 'خط تقدّم الطلب: [{key,title_ar,title_en,status,at,note}] — يحرّكه الفريق، ويراه العميل في /my.';
comment on column requests.updates is 'تحديثات الفريق: [{id,at,by,text_ar,text_en,published,published_at}] — المنشورة وحدها تصل العميل.';

commit;
