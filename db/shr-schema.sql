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

-- ------------------------------------------------------- بوابة المكاتب ----
-- مكاتب الاستقدام الخارجية داخل مستأجر واحد. القواعد:
--  * المكتب يُنشأ pending، ويعتمده مستخدم غير من أنشأه (check أدناه). لا دخول قبل approved.
--  * المكتب يرى الأوامر الموجّهة إليه (أو المفتوحة) ومرشحيه هو فقط، لا اسم عميل ولا سعر
--    ولا مراحل صاحب العمل. وصاحب العمل لا يرى اسم المكتب أبداً («عبر شريك»).
--  * مرشحو المكتب يُكتبون في shr_agency_candidates وحدها، لا في shr_candidates ولا في قاعدة BP.
--  * بلا هوية ولا هاتف ولا بريد: بصمة فقط (id_no_hash/name_key) لكشف التكرار.
--  * لا حذف: الإيقاف suspended والأرشفة archived_at. الأحداث append-only.

create table if not exists shr_agencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  ref text,                                   -- DEMO-AG-…
  name_ar text not null,
  country text,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_by uuid not null,                   -- من سجّل المكتب (shr_users.id)
  approved_by uuid,                           -- من اعتمده؛ لا يكون من أنشأه
  approved_at timestamptz,
  suspended_by uuid,
  suspended_at timestamptz,
  suspended_reason text,
  archived_at timestamptz,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),                     -- هدف مفاتيح مركّبة تمنع ربطاً عابراً للمستأجرين
  check (approved_by is null or approved_by <> created_by),   -- من يُدخل لا يعتمد
  check (status <> 'pending' or approved_by is null),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);

-- ربط مستخدم المكتب بمكتبه: الهوية من agency_id في هذا الجدول لا من اسم المكتب نصاً.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'shr_users_agency_fk') then
    alter table shr_users add constraint shr_users_agency_fk
      foreign key (tenant_id, agency_id) references shr_agencies(tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shr_users_agency_role') then
    alter table shr_users add constraint shr_users_agency_role
      check ((role = 'agency') = (agency_id is not null));   -- دور agency يلزمه مكتب، ولغيره لا مكتب
  end if;
end $$;

create table if not exists shr_recruitment_orders ( -- أمر استقدام: موجّه لمكتب، أو مفتوح (agency_id فارغ)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  ref text,                                   -- DEMO-ORD-…
  request_id uuid references shr_requests(id),
  client_company_id uuid references shr_client_companies(id),   -- داخلي: لا يصل المكتب أبداً
  establishment_id uuid references shr_establishments(id),
  agency_id uuid,                             -- فارغ = أمر مفتوح لكل المكاتب المعتمدة
  profession text not null,
  quantity int not null default 1 check (quantity >= 1),
  nationality_pref jsonb not null default '[]',
  agency_brief text,                          -- النص الوحيد الذي يراه المكتب عن الطلب
  due_on date,
  state text not null default 'open' check (state in ('draft','open','closed','cancelled')),
  created_by uuid not null,
  archived_at timestamptz,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, agency_id) references shr_agencies(tenant_id, id)
  -- المعلَّق بقرار المالك: منع الأمر إن كانت المنشأة restricted/suspected لنوع تأشيرات الأمر.
  -- لا حقل لنوع التأشيرة في shr_establishments بعد، فالمنع غير مُنفَّذ؛ الخادم يرد بتحذير فقط.
);

create table if not exists shr_agency_candidates (   -- ما قدّمه المكتب. مواصفات فقط، بلا هوية حقيقية.
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  ref text,                                   -- DEMO-A-…
  order_id uuid not null,
  agency_id uuid not null,
  full_name text not null,
  profession text, nationality text,
  years_experience int check (years_experience is null or years_experience >= 0),
  skills jsonb not null default '[]',
  id_no_hash text,                            -- بصمة الهوية إن قُدّمت؛ الرقم لا يُخزَّن
  name_key text not null,                     -- بصمة الاسم+الجنسية+المهنة لكشف التكرار بلا هوية
  state text not null default 'submitted'
    check (state in ('submitted','under_review','shortlisted','interview','accepted','rejected')),
  submitted_by uuid not null,                 -- مستخدم المكتب
  reviewed_by uuid,                           -- مشغّل الفواز
  reviewed_at timestamptz,
  review_note text,                           -- داخلي؛ لا يصل المكتب
  archived_at timestamptz,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, order_id) references shr_recruitment_orders(tenant_id, id),
  foreign key (tenant_id, agency_id) references shr_agencies(tenant_id, id),
  check (reviewed_by is null or reviewed_by <> submitted_by)
);
-- تكرار المرشح داخل المكتب الواحد على الأمر الواحد ممنوع (بصمة الهوية أو بصمة الاسم).
create unique index if not exists shr_agcand_dup_name on shr_agency_candidates (tenant_id, agency_id, order_id, name_key) where archived_at is null;
create unique index if not exists shr_agcand_dup_id on shr_agency_candidates (tenant_id, agency_id, order_id, id_no_hash) where id_no_hash is not null and archived_at is null;

create table if not exists shr_agency_candidate_events ( -- سجل حالات المرشح المقدَّم: لا تعديل ولا حذف
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  submission_id uuid not null,
  from_state text, to_state text not null,
  actor uuid, note text,
  at timestamptz not null default now(),
  foreign key (tenant_id, submission_id) references shr_agency_candidates(tenant_id, id)
);

create table if not exists shr_agency_interviews (   -- مقابلة مرشح مكتب؛ سجل داخلي، لا رسالة تُرسل
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  submission_id uuid not null,
  agency_id uuid not null,
  state text not null default 'requested' check (state in ('requested','scheduled','done','cancelled')),
  mode text check (mode in ('onsite','video','phone')),
  location text,
  scheduled_at timestamptz,
  agency_note text,                           -- النص الوحيد الموجَّه للمكتب
  requested_by uuid, scheduled_by uuid,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, submission_id) references shr_agency_candidates(tenant_id, id),
  foreign key (tenant_id, agency_id) references shr_agencies(tenant_id, id)
);

create or replace function shr_agcand_events_immutable() returns trigger language plpgsql as
$$ begin raise exception 'shr_agency_candidate_events is append-only'; end $$;
drop trigger if exists shr_agcand_events_no_change on shr_agency_candidate_events;
create trigger shr_agcand_events_no_change before update or delete on shr_agency_candidate_events
  for each row execute function shr_agcand_events_immutable();

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
    'shr_applications','shr_application_events','shr_interviews','shr_agency_candidate_events','shr_agency_interviews'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_iso on %I', t);
    execute format($p$create policy tenant_iso on %I using (tenant_id::text = current_setting('app.tenant_id', true)) with check (tenant_id::text = current_setting('app.tenant_id', true))$p$, t);
  end loop;
end $$;
