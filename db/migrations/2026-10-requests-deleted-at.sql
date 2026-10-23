-- ============================================================================
-- Business Partner — إخفاء الطلب الملغى عن العميل (requests.deleted_at) + عمودا الإلغاء
-- مسوّدة غير مطبَّقة (2026-10-23) — يطبّقها المالك يدوياً؛ لا أحد يطبّقها على قاعدة حقيقية آليّاً.
-- تعتمد على db/schema.sql كما هو (جدول requests). Idempotent: add column if not exists.
--
-- ١) deleted_at — «العميل يقدر يلغي وتنمسح». حين يلغي العميل طلبه ولا توقيع ولا دفع عليه
--    تُكتب هنا لحظة الإلغاء، فيختفي من كل قوائمه ولوحته (api/_simple.js: myRequests وrequest-get
--    وsupport-track، وapi/_quotes.js). لا يُحذف أي صف: يراها المالك في قسم «المحذوفة» في /ops
--    للتدقيق فقط، والمحو النهائي قرارٌ له وحده. طلب عليه عقد موقَّع أو دفعة لا تُكتب فيه أبداً.
--    الكود يعمل بلا هذا العمود (يُلغي ويبقى الصف ظاهراً)، وبه يُخفي.
--
-- ٢) cancel وcancel_request — يكتبهما api/_simple.js منذ إلغاء العميل والمالك (request-cancel
--    وops-cancel) ولم يرد لهما تعريفٌ في schema.sql ولا في أي ترحيل: إن لم يكونا مضافَين يدوياً
--    على قاعدة التشغيل فكل إلغاء يفشل بـ db_failed. هنا لضمان وجودهما؛ إن وُجدا فالأمر بلا أثر.
--      cancel          {at, by: 'customer'|'ops', actor, note, stage, contract_signed?, was_paid?}
--      cancel_request  {at, by, actor, note, stage}  — طلب إلغاء بانتظار مراجعة الفريق
-- ============================================================================

begin;

alter table requests add column if not exists deleted_at     timestamptz;
alter table requests add column if not exists cancel         jsonb;
alter table requests add column if not exists cancel_request jsonb;

-- القراءة الوحيدة بالعمود نفسه هي قائمة «المحذوفة» في /ops: فهرسٌ جزئي صغير.
create index if not exists requests_deleted_idx on requests(deleted_at) where deleted_at is not null;

comment on column requests.deleted_at     is 'لحظة إخفاء الطلب الملغى عن العميل (لا توقيع ولا دفع). لا حذف فعلي — للتدقيق في /ops «المحذوفة».';
comment on column requests.cancel         is 'سجل إلغاء الطلب: {at,by,actor,note,stage,contract_signed,was_paid}.';
comment on column requests.cancel_request is 'طلب إلغاء بانتظار مراجعة الفريق (عقد موقَّع أو دفعة): {at,by,actor,note,stage}.';

commit;
