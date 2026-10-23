-- ============================================================================
-- Business Partner — مفاتيح تكرار إيصالات الحوالة البنكية (bank_receipt_keys)
-- مسوّدة غير مطبَّقة (2026-10-23) — يطبّقها المالك يدوياً على Supabase وعلى قاعدة أزور؛ لا أحد يطبّقها
-- آلياً. Idempotent: create table if not exists.
--
-- لماذا: كان منع تكرار الإيصال يجلب آخر ٦٠٠ طلب كاملة ويقارن في الذاكرة (بصمة الملف وحدها، وبايت إضافي
-- يتجاوزها). الآن لكل إيصال ثلاثة مفاتيح، المفتاح هو المفتاح الأساسي فيكون البحث والإدراج على فهرس:
--     f:<sha256>   بصمة المحتوى الموحّد للصورة/الملف (لا تتغير بإضافة بايت أو تعليق)
--     t:<sha256>   بصمة نص الإيصال المقروء قراءةً مستقلة (تتجاوز إعادة التصوير والضغط)
--     r:<REF>      رقم مرجع المصرف (أحرف وأرقام كبيرة، ٦ خانات فأكثر) — إلزامي للاعتماد الآلي
--   كلها تشير إلى الطلب الذي رُفع عليه الإيصال أول مرة (request_ref).
--
-- بدون هذا الجدول يفشل الكود مغلقاً: فحص التكرار «غير متاح» فيذهب كل إيصال إلى مراجعة بشرية
-- (duplicate_check_unavailable) ولا يُعتمد شيء آلياً. فتطبيقه شرطٌ للاعتماد الآلي.
-- ============================================================================

begin;

create table if not exists bank_receipt_keys (
  key         text primary key,
  kind        text not null check (kind in ('f','t','r')),
  request_ref text not null,
  order_ref   text,
  created_at  timestamptz not null default now()
);
create index if not exists bank_receipt_keys_request_idx on bank_receipt_keys(request_ref);

comment on table bank_receipt_keys is 'مفاتيح منع تكرار إيصال الحوالة (f: بصمة المحتوى · t: بصمة النص المستقل · r: مرجع المصرف) → الطلب الأول.';

-- الخادم وحده يقرأ ويكتب (مفتاح الخدمة)؛ لا وصول من المتصفح.
alter table bank_receipt_keys enable row level security;

commit;
