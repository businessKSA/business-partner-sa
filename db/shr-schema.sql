-- SHR-HR — سحر الإمداد للموارد البشرية (EOR، white-label للفواز).
-- مستقل عن db/schema.sql عمداً: لا يطبّقه اختبار azpg ولا يختلط بجداول BP.
-- مكان التشغيل (مخطط مستقل أم قاعدة منفصلة داخل المملكة) قرار مالك معلّق؛
-- الملف لا يفترض شيئاً سوى Postgres. بيانات وهمية فقط حتى تكتمل الشروط.
--
-- القاعدة: كل جدول يحمل tenant_id، والخادم يضيفه من api/_shr.js (scoped).
-- سياسات RLS هنا طبقة ثانية، لأن مفتاح الخدمة يتجاوزها.

create extension if not exists pgcrypto;
create schema if not exists shr;
set search_path = shr, public;

create table if not exists shr_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- 'SHR'
  brand_ar text not null,
  brand_en text,
  demo boolean not null default true,        -- يُطفأ بقرار مكتوب فقط
  created_at timestamptz not null default now()
);

create table if not exists shr_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  email text not null,
  full_name text,
  role text not null check (role in ('tenant_owner','operator','client_admin','client_viewer','worker','agency')),
  client_company_id uuid,                    -- لأدوار العميل
  worker_id uuid,                            -- لدور العامل
  agency_id uuid,                            -- لدور المكتب
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists shr_establishments (   -- منشآت الفواز المشغِّلة
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  name_ar text not null,
  unified_no text,
  cr_number text,
  licensed_scope text,                       -- نطاق الترخيص كما يُثبت، لا افتراض
  restriction_state text not null default 'unknown' check (restriction_state in ('unknown','clear','restricted','suspected')),
  created_at timestamptz not null default now()
);

create table if not exists shr_client_companies (  -- عملاء الفواز
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  name_ar text not null,
  cr_number text,
  city text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists shr_contracts (        -- عقد إسناد بين المنشأة والعميل
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  establishment_id uuid not null references shr_establishments(id),
  client_company_id uuid not null references shr_client_companies(id),
  version int not null default 1,            -- التعديل نسخة جديدة لا تحرير
  starts_on date, ends_on date,
  status text not null default 'draft' check (status in ('draft','pending_approval','active','ended')),
  created_by uuid, approved_by uuid,
  check (approved_by is null or approved_by <> created_by)   -- من يُدخل لا يعتمد
);

create table if not exists shr_workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  full_name text not null,
  nationality text,
  profession text,
  id_kind text check (id_kind in ('iqama','national_id','border_no')),
  id_no_hash text,                           -- بصمة لا الرقم؛ الحقيقي يُشفَّر لاحقاً
  status text not null default 'draft' check (status in ('draft','pending_docs','active','archived')),
  archived_at timestamptz,
  created_by uuid,                           -- من أدخل المسودة
  activated_by uuid,                         -- من اعتمد التفعيل؛ لا يكون المُدخِل نفسه
  created_at timestamptz not null default now(),
  check (activated_by is null or activated_by <> created_by)
);

create table if not exists shr_assignments (       -- عامل ← عميل مستفيد ← منشأة
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  worker_id uuid not null references shr_workers(id),
  establishment_id uuid not null references shr_establishments(id),
  client_company_id uuid not null references shr_client_companies(id),
  contract_id uuid references shr_contracts(id),
  profession text not null,
  starts_on date, ends_on date,
  transfer_approved_by uuid,                 -- نقل بين المنشآت بموافقة
  status text not null default 'draft'
);

create table if not exists shr_worker_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  worker_id uuid not null references shr_workers(id),
  kind text not null check (kind in ('work_contract','iqama','passport','medical_insurance','gosi')),
  storage_key text, expires_on date,
  reviewed_by uuid, reviewed_at timestamptz
);

create table if not exists shr_requests (          -- طلبات العميل
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  client_company_id uuid not null references shr_client_companies(id),
  kind text not null check (kind in ('new_hire','termination','transfer','document','other')),
  state text not null default 'new',
  body jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists shr_agencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  name_ar text not null,
  country text,
  status text not null default 'pending'
);

create table if not exists shr_recruitment_orders ( -- أمر استقدام إلى مكتب
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  request_id uuid references shr_requests(id),
  agency_id uuid references shr_agencies(id),
  profession text, quantity int,
  state text not null default 'draft'
);

create table if not exists shr_agency_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  order_id uuid not null references shr_recruitment_orders(id),
  full_name text not null,
  state text not null default 'submitted'
);

create table if not exists shr_procedure_steps (    -- تأشيرة · إقامة · فحص · تأمين
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  worker_id uuid references shr_workers(id),
  order_id uuid references shr_recruitment_orders(id),
  step text not null, state text not null default 'pending', due_on date
);

create table if not exists shr_payroll_runs (       -- مسودات فقط
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  establishment_id uuid references shr_establishments(id),
  period text not null, status text not null default 'draft'
);

create table if not exists shr_invoices (           -- مسودات؛ لا تخرج إلا عبر بدر
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  client_company_id uuid references shr_client_companies(id),
  status text not null default 'draft' check (status in ('draft'))
);

create table if not exists shr_audit_log (          -- لا تعديل ولا حذف
  id bigint generated always as identity primary key,
  tenant_id uuid not null references shr_tenants(id),
  actor uuid, action text not null, entity text, entity_id uuid,
  at timestamptz not null default now()
);

create or replace function shr_audit_immutable() returns trigger language plpgsql as
$$ begin raise exception 'shr_audit_log is append-only'; end $$;
drop trigger if exists shr_audit_no_change on shr_audit_log;
create trigger shr_audit_no_change before update or delete on shr_audit_log
  for each row execute function shr_audit_immutable();

-- ------------------------------------------------------------------ ATS ----
-- مرشحون ووظائف وطلبات تقديم ومقابلات وموافقات. بيانات وهمية فقط في هذه المرحلة.
-- لا هوية ولا هاتف ولا بريد في shr_candidates عمداً: لا حقل لها حتى يُقرَّر
-- التشفير ومكان التشغيل. لا حذف في أي جدول هنا: الأرشفة (archived_at) أو الإغلاق فقط.

create table if not exists shr_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  ref text,                                   -- DEMO-C-01 … وسم صريح
  full_name text not null,
  profession text, nationality text, city text,
  years_experience int check (years_experience is null or years_experience >= 0),
  residency_transferable text check (residency_transferable in ('yes','no','unknown')),
  willing_to_relocate boolean,
  notice_days int check (notice_days is null or notice_days >= 0),
  skills jsonb not null default '[]',
  demo boolean not null default true,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists shr_candidate_consents ( -- سجل موافقة المرشح؛ السحب يملأ withdrawn_at ولا يحذف
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  candidate_id uuid not null references shr_candidates(id),
  text_version text not null,                 -- صيغة النص المعروض عليه (رقم الإصدار)
  text_body text,                             -- نص الصيغة كما عُرض
  granted_at timestamptz not null,
  source text not null check (source in ('demo_seed','candidate_form','agency_upload','operator_entry')),
  withdrawn_at timestamptz,
  withdrawn_reason text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  check (withdrawn_at is null or withdrawn_at >= granted_at)
);

create table if not exists shr_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  client_company_id uuid references shr_client_companies(id),
  title text not null,
  profession text, city text,
  experience_years int check (experience_years is null or experience_years >= 0),
  residency_required text not null default 'any' check (residency_required in ('transferable','any')),
  nationality_pref jsonb not null default '[]',   -- فارغ = لا تفضيل
  skills jsonb not null default '[]',
  must_have jsonb not null default '[]',          -- مفاتيح مكوّنات أو مهارات
  headcount int not null default 1 check (headcount >= 1),
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists shr_applications (       -- طلب تقديم: مرشح على وظيفة
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  job_id uuid not null references shr_jobs(id),
  candidate_id uuid not null references shr_candidates(id),
  stage text not null default 'new' check (stage in ('new','review','shortlist','interview','offer','hired','rejected','future')),
  created_by uuid,                            -- من أدخل الطلب
  offer_proposed_by uuid,                     -- من نقله إلى «عرض»
  offer_approved_by uuid,                     -- من اعتمد العرض (الانتقال إلى «تعيين»)
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (tenant_id, job_id, candidate_id),
  -- من يُدخل لا يعتمد العرض، ومن اقترحه لا يعتمده.
  check (offer_approved_by is null or (offer_approved_by <> created_by and offer_approved_by <> offer_proposed_by))
);

create table if not exists shr_application_events ( -- سجل المراحل: لا تعديل ولا حذف
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  application_id uuid not null references shr_applications(id),
  from_stage text, to_stage text not null,
  actor uuid, note text,
  at timestamptz not null default now()
);

create table if not exists shr_interviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  application_id uuid not null references shr_applications(id),
  state text not null default 'requested' check (state in ('requested','scheduled','done','cancelled')),
  mode text check (mode in ('onsite','video','phone')),
  location text,
  scheduled_at timestamptz,
  note text,
  requested_by uuid, scheduled_by uuid,
  created_at timestamptz not null default now()
  -- الجدولة سجل داخلي فقط؛ لا رسالة تُرسل لأحد في هذه المرحلة.
);

create or replace function shr_events_immutable() returns trigger language plpgsql as
$$ begin raise exception 'shr_application_events is append-only'; end $$;
drop trigger if exists shr_events_no_change on shr_application_events;
create trigger shr_events_no_change before update or delete on shr_application_events
  for each row execute function shr_events_immutable();

-- ----------------------------------------------------------------- RLS ----
-- الجلسة تضبط: select set_config('app.tenant_id', '<uuid>', true)
do $$
declare t text;
begin
  foreach t in array array['shr_users','shr_establishments','shr_client_companies','shr_contracts',
    'shr_workers','shr_assignments','shr_worker_documents','shr_requests','shr_agencies',
    'shr_recruitment_orders','shr_agency_candidates','shr_procedure_steps','shr_payroll_runs',
    'shr_invoices','shr_audit_log','shr_candidates','shr_candidate_consents','shr_jobs',
    'shr_applications','shr_application_events','shr_interviews'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_iso on %I', t);
    execute format($p$create policy tenant_iso on %I using (tenant_id::text = current_setting('app.tenant_id', true)) with check (tenant_id::text = current_setting('app.tenant_id', true))$p$, t);
  end loop;
end $$;
