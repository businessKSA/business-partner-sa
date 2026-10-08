-- ============================================================================
-- Business Partner — EOR operations (Employer of Record): الجداول التشغيلية
-- مسوّدة غير مطبَّقة (2026-10-08) — تُراجَع ثم تُطبَّق يدوياً من المالك؛ لا أحد يطبّقها على قاعدة حقيقية آليّاً.
-- تعتمد على db/schema.sql كما هو: users, organizations, documents, invoices ودالة current_org_ids().
-- Idempotent: create ... if not exists / add column if not exists / drop policy|trigger if exists ثم create.
--
-- قواعد التصميم (متّسقة مع db/schema.sql):
--   * قاعدة الموقع (Postgres) هي المصدر الوحيد للبيانات التشغيلية؛ Notion للبنك والطلبات الواردة؛ n8n تكاملات فقط.
--   * المبالغ أعداد صحيحة بالهللة (bigint, *_halalas) — لا numeric ولا float. ١ ريال = ١٠٠ هللة.
--   * لا بيانات شخصية للمرشّح في أي جدول هنا: candidate_key = معرّف صفحة Notion فقط. الاسم والجوال والهوية تبقى في Notion
--     وتُسلَّم للأدوار بحسب القناع في api/_eor-flow.js (maskForRole).
--   * الوصول من دوال Vercel بمفتاح service_role، والعزل بين العملاء يُفرض في الكود؛ RLS هنا القفل الثاني.
--     سياسات القراءة للعميل على أربعة جداول فقط (eor_clients, eor_requests, eor_request_items, eor_timesheets*)؛
--     كل ما سواها RLS بلا سياسة = لا يراها إلا service_role. وهو مقصود: الهامش والتكلفة والمورّد والمرشّحون وكشوف الرواتب داخلية.
--   * أعمدة التكلفة الداخلية (راتب/حكومي/هامش/رسوم مورّد) في eor_cost_sheets وحده، لا في أي جدول يقرؤه العميل.
-- ============================================================================

begin;

-- ------------------------------------------------------------------ مورّدون --
create table if not exists eor_vendors (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('agency','freelance_recruiter','platform')),   -- مكتب استقدام / مجنّد مستقل / منصة
  name_ar text not null,
  name_en text,
  country text check (country is null or country ~ '^[A-Z]{2}$'),                  -- ISO-3166 alpha-2
  organization_id uuid references organizations(id),   -- إن كان للمورّد حساب في بوابتنا
  fee_model text check (fee_model in ('per_candidate','percent_of_salary','fixed_per_placement','custom')),
  fee_amount_halalas bigint check (fee_amount_halalas is null or fee_amount_halalas >= 0),
  fee_percent numeric(7,6) check (fee_percent is null or (fee_percent >= 0 and fee_percent <= 1)),  -- كسر عشري: 0.10 = 10%
  currency text not null default 'SAR',
  contact_email text,
  contact_phone text,
  status text not null default 'pending' check (status in ('pending','active','suspended','removed')),
  notion_page_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists eor_vendors_status_idx on eor_vendors(status);
comment on table eor_vendors is 'مورّدو المرشحين (مكاتب استقدام، مجنّدون مستقلون، منصات) ورسومهم — داخلي لا يراه العميل.';

create table if not exists eor_vendor_members (
  vendor_id uuid not null references eor_vendors(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'recruiter' check (role in ('admin','recruiter')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  invited_by uuid references users(id),
  created_at timestamptz not null default now(),
  primary key (vendor_id, user_id)
);
create index if not exists eor_vendor_members_user_idx on eor_vendor_members(user_id);
comment on table eor_vendor_members is 'مستخدمو المورّد المسموح لهم برفع مرشحيه ومتابعتهم.';

-- ------------------------------------------------------------------- عملاء --
create table if not exists eor_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id),
  status text not null default 'active' check (status in ('active','paused','closed')),
  agreed_month_days int check (agreed_month_days is null or agreed_month_days between 1 and 31),  -- أيام الشهر المتفق عليها لتناسب الفاتورة
  cost_visibility text check (cost_visibility is null or cost_visibility in ('total','breakdown')),  -- يغلب إعداد التسعير العام
  account_owner uuid references users(id),
  notion_page_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)                          -- هدف مفتاح أجنبي مركّب: يمنع اختلاف العميل والمنشأة
);
comment on table eor_clients is 'ربط المنشأة (organizations) بخدمة EOR وشروط فوترتها المتفق عليها.';

-- ------------------------------------------------------------------- طلبات --
-- الطلب يصل من النموذج العام قبل أن تكون للعميل منشأة؛ organization_id/eor_client_id فارغان حتى يحوّل الفريقُ العميلَ المحتمل.
create table if not exists eor_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                             -- EOR-###### (نفس الرقم المرجعي في Notion)
  organization_id uuid references organizations(id),
  eor_client_id uuid,
  status text not null default 'new' check (status in
    ('new','needs_info','quoted','approved','sourcing','shortlist_ready','interviewing','partially_filled','filled','on_hold','cancelled','closed')),
  worker_type text not null check (worker_type in ('saudi','foreign','both')),
  recruitment text not null check (recruitment in ('yes','no','unsure')),
  start_date date,
  duration_months int check (duration_months is null or duration_months between 1 and 120),
  company_name text,                                    -- لقطة من النموذج العام (قبل ربط المنشأة)
  contact_name text,
  contact_email text,
  contact_phone text,
  city text,
  notes text,
  source text not null default 'site:/eor',
  notion_page_id text unique,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((eor_client_id is null) = (organization_id is null)),   -- معاً أو لا شيء: العميل المحوَّل له منشأته
  unique (id, eor_client_id),                                    -- هدف مفتاح مركّب من eor_placements: عميل الموضع = عميل طلبه
  foreign key (eor_client_id, organization_id) references eor_clients(id, organization_id)
);
create index if not exists eor_requests_org_idx on eor_requests(organization_id);
create index if not exists eor_requests_status_idx on eor_requests(status);
comment on table eor_requests is 'طلب العميل لخدمة EOR (ترويسة). لا حقول داخلية؛ ملاحظات الفريق في سجل أحداث الموضع.';

create table if not exists eor_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references eor_requests(id) on delete cascade,
  position int not null default 1,
  occupation_id text not null,                          -- معرّف المهنة من api/_occupations.js (التصنيف الموحّد) — ليس مفتاحاً أجنبياً
  headcount int not null check (headcount between 1 and 500),
  nationalities text[] not null default '{}',           -- رموز ISO-2؛ فارغة = غير محدّدة
  target_salary_halalas bigint check (target_salary_halalas is null or target_salary_halalas >= 0),  -- الراتب المستهدف الذي صرّح به العميل
  notes text,
  created_at timestamptz not null default now(),
  unique (request_id, position)
);
create index if not exists eor_request_items_request_idx on eor_request_items(request_id);
comment on table eor_request_items is 'بنود المهن في الطلب: المهنة والعدد والجنسيات والراتب المستهدف.';

-- --------------------------------------------------------------- المرشّحون --
-- المرحلة تُقيَّد بالقائمة نفسها في api/_eor-flow.js (STAGE_ORDER + SIDE_STAGES)؛ tests/eor-flow.test.mjs يقارنهما.
-- لا قفز بين المراحل: يُفرض في الكود (canTransition) لا هنا، وكل انتقال يُسجَّل في eor_placement_events.
create table if not exists eor_placements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references eor_requests(id),
  item_id uuid not null references eor_request_items(id),
  eor_client_id uuid not null,
  organization_id uuid not null references organizations(id),
  candidate_key text not null,                          -- معرّف صفحة Notion للمرشّح — لا اسم ولا جوال ولا هوية
  source_vendor_id uuid references eor_vendors(id),     -- مورّد المصدر (داخلي: لا يُكشف للعميل)
  stage text not null default 'sourced' check (stage in
    ('sourced','screened','shortlisted','client_interview','client_selected','offer','contract_signed',
     'visa_processing','visa_issued','travelling','onboarding_ksa','ready','deployed','active','offboarding','closed',
     'rejected','withdrawn','on_hold')),
  held_from text check (held_from is null or held_from in
    ('sourced','screened','shortlisted','client_interview','client_selected','offer','contract_signed',
     'visa_processing','visa_issued','travelling','onboarding_ksa','ready')),
  stage_changed_at timestamptz not null default now(),
  assigned_to uuid references users(id),                -- مسؤول التشغيل
  employee_user_id uuid references users(id),           -- حساب الموظف في البوابة بعد العرض
  contract_document_id uuid references documents(id),
  planned_start_date date,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((stage = 'on_hold') = (held_from is not null)),
  unique (request_id, candidate_key),
  foreign key (eor_client_id, organization_id) references eor_clients(id, organization_id),
  foreign key (request_id, eor_client_id) references eor_requests(id, eor_client_id)   -- لا موضع قبل تحويل الطلب إلى عميل
);
create index if not exists eor_placements_request_idx on eor_placements(request_id);
create index if not exists eor_placements_stage_idx on eor_placements(stage);
create index if not exists eor_placements_vendor_idx on eor_placements(source_vendor_id);
create index if not exists eor_placements_org_idx on eor_placements(organization_id);
comment on table eor_placements is 'المرشّح ضمن طلب وبند: مفتاحه ومورّد مصدره ومرحلته. بلا RLS للعميل عمداً — يمرّ عبر الـAPI والقناع.';

-- سجل أحداث لا يُحذف ولا يُعدَّل (مُسقطان تحميان ذلك حتى من service_role عبر الخطأ).
create table if not exists eor_placement_events (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references eor_placements(id) on delete restrict,
  from_stage text,                                      -- null عند إنشاء السجل
  to_stage text not null,
  actor_user_id uuid references users(id),
  actor_role text not null check (actor_role in ('vendor','ops','client','candidate','system')),
  actor_label text,                                     -- 'n8n' / 'cron' عند غياب مستخدم
  note text,
  created_at timestamptz not null default now()
);
create index if not exists eor_placement_events_placement_idx on eor_placement_events(placement_id, created_at);

create or replace function eor_events_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'eor_placement_events is append-only (% blocked)', tg_op using errcode = '42501';
end $$;
drop trigger if exists eor_placement_events_no_change on eor_placement_events;
create trigger eor_placement_events_no_change before update or delete on eor_placement_events
  for each row execute function eor_events_immutable();
drop trigger if exists eor_placement_events_no_truncate on eor_placement_events;
create trigger eor_placement_events_no_truncate before truncate on eor_placement_events
  for each statement execute function eor_events_immutable();
comment on table eor_placement_events is 'سجل انتقالات المراحل: من ومتى ومن/إلى أي مرحلة وملاحظة. إضافة فقط — لا تعديل ولا حذف.';

-- ------------------------------------------------------------------ التأشيرة --
-- مستندات الإثبات (documents) تخص منشأة؛ يجب أن تُنشأ تحت منشأة Business Partner الداخلية لا منشأة العميل،
-- وإلا ظهرت للعميل عبر سياسة documents_read (جوازات وفحوص). انظر أسئلة التصميم المفتوحة.
create table if not exists eor_visa_cases (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null unique references eor_placements(id),
  origin_country text check (origin_country is null or origin_country ~ '^[A-Z]{2}$'),
  office_vendor_id uuid references eor_vendors(id),     -- المكتب المنفّذ إن كان مسجّلاً مورّداً
  office_name text,
  status text not null default 'open' check (status in ('open','in_progress','completed','blocked','cancelled')),
  opened_at timestamptz not null default now(),
  completed_at timestamptz,
  note text,
  updated_at timestamptz not null default now()
);
comment on table eor_visa_cases is 'ملف التأشيرة للمرشّح عند مكتب خارجي (واحد لكل موضع).';

create table if not exists eor_visa_steps (
  id uuid primary key default gen_random_uuid(),
  visa_case_id uuid not null references eor_visa_cases(id) on delete cascade,
  step_key text not null,                               -- من visaChecklist() في api/_eor-flow.js
  position int not null,
  title_ar text not null,
  title_en text,
  executor_vendor_id uuid references eor_vendors(id),   -- المكتب المنفّذ لهذه الخطوة
  due_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','done','blocked','skipped')),
  completed_at timestamptz,
  proof_document_id uuid references documents(id),      -- مستند الإثبات؛ إلزامه عند done يُفرض في الـAPI
  note text,
  updated_at timestamptz not null default now(),
  unique (visa_case_id, step_key)
);
create index if not exists eor_visa_steps_due_idx on eor_visa_steps(due_date) where status in ('pending','in_progress','blocked');
comment on table eor_visa_steps is 'خطوات ملف التأشيرة: المكتب المنفّذ وموعد الاستحقاق والحالة ومستند الإثبات.';

-- --------------------------------------------------------- الاستقبال داخل المملكة --
create table if not exists eor_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references eor_placements(id),
  item_key text not null,                               -- من onboardingChecklist() في api/_eor-flow.js
  position int not null,
  title_ar text not null,
  title_en text,
  status text not null default 'pending' check (status in ('pending','in_progress','done','blocked','not_applicable')),
  due_date date,
  completed_at timestamptz,
  amount_halalas bigint check (amount_halalas is null or amount_halalas >= 0),   -- الرسم المدفوع إن وُجد (داخلي)
  proof_document_id uuid references documents(id),
  note text,
  updated_at timestamptz not null default now(),
  unique (placement_id, item_key)
);
create index if not exists eor_onboarding_placement_idx on eor_onboarding_items(placement_id);
comment on table eor_onboarding_items is 'قائمة استقبال الموظف داخل المملكة (إقامة، تأمين، فحص طبي، رسوم رخصة العمل).';

-- ----------------------------------------------------------------- التكلفة --
-- داخلي بالكامل: لا سياسة قراءة لأي عميل، ولا يُجلب لواجهة العميل أبداً. العميل يرى sale_monthly_halalas وحده عبر
-- clientView() في api/_eor-cost.js. النسخ تتراكم (version) ولا تُمحى؛ الحالية واحدة.
create table if not exists eor_cost_sheets (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references eor_placements(id),
  version int not null default 1,
  is_current boolean not null default true,
  status text not null check (status in ('ok','pending_pricing')),
  currency text,
  contract_months int check (contract_months is null or contract_months between 1 and 120),
  salary_halalas bigint check (salary_halalas is null or salary_halalas >= 0),
  government_monthly_halalas bigint check (government_monthly_halalas is null or government_monthly_halalas >= 0),
  eos_accrual_monthly_halalas bigint check (eos_accrual_monthly_halalas is null or eos_accrual_monthly_halalas >= 0),    -- مخصّص نهاية الخدمة
  leave_accrual_monthly_halalas bigint check (leave_accrual_monthly_halalas is null or leave_accrual_monthly_halalas >= 0), -- مخصّص الإجازات
  recruitment_halalas bigint check (recruitment_halalas is null or recruitment_halalas >= 0),   -- مرة واحدة، تُوزَّع على المدة
  visa_halalas bigint check (visa_halalas is null or visa_halalas >= 0),
  vendor_fee_halalas bigint check (vendor_fee_halalas is null or vendor_fee_halalas >= 0),
  amortization_residual_halalas bigint,                 -- فرق تقريب التوزيع على المدة (قد يكون سالباً)
  cost_monthly_halalas bigint check (cost_monthly_halalas is null or cost_monthly_halalas >= 0),
  margin_rate numeric(7,6) check (margin_rate is null or (margin_rate >= 0 and margin_rate <= 1)),
  margin_halalas bigint check (margin_halalas is null or margin_halalas >= 0),
  sale_monthly_halalas bigint check (sale_monthly_halalas is null or sale_monthly_halalas >= 0), -- سعر البيع الشهري قبل الضريبة
  rounding text not null default 'half_up_per_line',
  missing text[] not null default '{}',                 -- ما نقص حين كانت الحالة pending_pricing
  config_snapshot jsonb,                                -- الإعداد المستعمل وقت الحساب (هامش، مخصّصات…)
  computed_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (placement_id, version),
  check (status <> 'ok' or (sale_monthly_halalas is not null and cost_monthly_halalas is not null and margin_halalas is not null))
);
create unique index if not exists eor_cost_sheets_current_idx on eor_cost_sheets(placement_id) where is_current;
comment on table eor_cost_sheets is 'ورقة تكلفة الموضع (راتب، حكومي، مخصّصات، استقدام/تأشيرة/مورّد، هامش، سعر بيع) بالهللة — داخلي، لا يُجلب لواجهة العميل.';

-- ----------------------------------------------------------------- التايم شيت --
create table if not exists eor_timesheets (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references eor_placements(id),
  organization_id uuid not null references organizations(id),   -- منشأة العميل (للقراءة والاعتماد)
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),   -- YYYY-MM
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),   -- rejected = أُعيد للتصحيح
  agreed_days int check (agreed_days is null or agreed_days between 1 and 31),   -- لقطة أيام الشهر المتفق عليها
  total_days_hundredths int check (total_days_hundredths is null or total_days_hundredths >= 0),         -- ١٠٠ = يوم؛ تُثبَّت عند الاعتماد
  submitted_by uuid references users(id),
  submitted_at timestamptz,
  approved_by uuid references users(id),
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement_id, period),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null and total_days_hundredths is not null))
);
create index if not exists eor_timesheets_org_period_idx on eor_timesheets(organization_id, period);
comment on table eor_timesheets is 'تايم شيت الموظف الشهري: يسجّله الموظف ويعتمده العميل (مسودة ← مقدَّم ← معتمد). الفاتورة تُبنى من المعتمد فقط.';

create table if not exists eor_timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references eor_timesheets(id) on delete cascade,
  work_date date not null,
  kind text not null default 'work' check (kind in ('work','leave','absent','holiday')),   -- أي نوع يُحتسب للفوترة قرار المالك (انظر الأسئلة)
  day_pct int check (day_pct is null or day_pct between 0 and 100),   -- نسبة اليوم المحتسبة (١٠٠ = يوم كامل)
  hours numeric(4,2) check (hours is null or (hours >= 0 and hours <= 24)),
  note text,
  created_at timestamptz not null default now(),
  unique (timesheet_id, work_date),
  check ((day_pct is null) <> (hours is null))          -- أيام أو ساعات، لا الاثنان ولا لا شيء
);
comment on table eor_timesheet_entries is 'إدخالات الحضور اليومية: نسبة يوم أو ساعات.';

-- ---------------------------------------------------------- الرواتب والفوترة --
-- دورة شهرية واحدة لكل عميل وفترة؛ الفاتورة تشير إليها (invoices.eor_pay_run_id) لا العكس.
create table if not exists eor_pay_runs (
  id uuid primary key default gen_random_uuid(),
  eor_client_id uuid not null,
  organization_id uuid not null references organizations(id),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'draft' check (status in ('draft','calculated','approved','paid','cancelled')),
  subtotal_halalas bigint check (subtotal_halalas is null or subtotal_halalas >= 0),   -- لقطة الفاتورة قبل الضريبة
  vat_halalas bigint check (vat_halalas is null or vat_halalas >= 0),
  total_halalas bigint check (total_halalas is null or total_halalas >= 0),
  payroll_net_halalas bigint check (payroll_net_halalas is null or payroll_net_halalas >= 0),   -- صافي الرواتب (داخلي)
  currency text not null default 'SAR',
  calculated_at timestamptz,
  approved_by uuid references users(id),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (eor_client_id, period),
  foreign key (eor_client_id, organization_id) references eor_clients(id, organization_id)
);
comment on table eor_pay_runs is 'دورة الرواتب والفوترة الشهرية لعميل — داخلي.';

create table if not exists eor_payslips (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references eor_pay_runs(id),
  placement_id uuid not null references eor_placements(id),
  gross_halalas bigint not null check (gross_halalas >= 0),
  deductions_halalas bigint not null default 0 check (deductions_halalas >= 0),
  net_halalas bigint not null check (net_halalas >= 0),
  approved_days_hundredths int check (approved_days_hundredths is null or approved_days_hundredths >= 0),
  agreed_days int check (agreed_days is null or agreed_days between 1 and 31),
  breakdown jsonb,
  status text not null default 'draft' check (status in ('draft','approved','paid','failed')),
  paid_at timestamptz,
  payment_ref text,
  document_id uuid references documents(id),
  created_at timestamptz not null default now(),
  unique (pay_run_id, placement_id),
  check (net_halalas = gross_halalas - deductions_halalas)
);
comment on table eor_payslips is 'قسيمة راتب الموظف في دورة: إجمالي، خصومات، صافي، حالة التحويل — داخلي.';

-- ربط الفاتورة الشهرية بجدول invoices القائم (إضافة أعمدة فقط، لا تغيير لما فيه).
alter table invoices add column if not exists eor_pay_run_id uuid references eor_pay_runs(id);
alter table invoices add column if not exists eor_period text check (eor_period is null or eor_period ~ '^\d{4}-(0[1-9]|1[0-2])$');
create unique index if not exists invoices_eor_pay_run_idx on invoices(eor_pay_run_id)
  where eor_pay_run_id is not null and kind = 'invoice' and status <> 'void';       -- فاتورة واحدة نشطة لكل دورة

-- ---------------------------------------------------------------------- RLS --
do $$
declare t text;
begin
  foreach t in array array[
    'eor_vendors','eor_vendor_members','eor_clients','eor_requests','eor_request_items','eor_placements',
    'eor_placement_events','eor_visa_cases','eor_visa_steps','eor_onboarding_items','eor_cost_sheets',
    'eor_timesheets','eor_timesheet_entries','eor_pay_runs','eor_payslips'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- قراءة العميل: منشأته فقط، وعلى الجداول الخالية من أي حقل داخلي وحدها. الكتابة service_role فقط.
drop policy if exists eor_clients_read on eor_clients;
create policy eor_clients_read on eor_clients for select using (organization_id in (select current_org_ids()));
drop policy if exists eor_requests_read on eor_requests;
create policy eor_requests_read on eor_requests for select using (organization_id in (select current_org_ids()));
drop policy if exists eor_request_items_read on eor_request_items;
create policy eor_request_items_read on eor_request_items for select using (request_id in (select id from eor_requests where organization_id in (select current_org_ids())));
drop policy if exists eor_timesheets_read on eor_timesheets;
create policy eor_timesheets_read on eor_timesheets for select using (organization_id in (select current_org_ids()));
drop policy if exists eor_timesheet_entries_read on eor_timesheet_entries;
create policy eor_timesheet_entries_read on eor_timesheet_entries for select using (timesheet_id in (select id from eor_timesheets where organization_id in (select current_org_ids())));

commit;
