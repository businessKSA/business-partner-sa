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
  role text not null check (role in ('tenant_owner','operator','client_admin','client_viewer','worker','agency','compliance_officer')),
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

-- ربط مستخدم العميل بشركته: هوية العميل من client_company_id في هذا الجدول لا من الطلب.
-- المفتاح المركّب يمنع ربط مستخدم بعميل مستأجر آخر، والقيد يلزم دور العميل بشركة ويمنعها عن غيره.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'shr_client_companies_tenant_id_id_key') then
    alter table shr_client_companies add constraint shr_client_companies_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shr_users_client_fk') then
    alter table shr_users add constraint shr_users_client_fk
      foreign key (tenant_id, client_company_id) references shr_client_companies(tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shr_users_client_role') then
    alter table shr_users add constraint shr_users_client_role
      check ((role in ('client_admin','client_viewer')) = (client_company_id is not null));
  end if;
end $$;
-- من قدّم طلب العميل (يُسجَّل أيضاً في shr_audit_log). المشغّل وحده يغيّر حالة الطلب.
alter table shr_requests add column if not exists created_by uuid;

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
  -- حجب الأمر لمنشأة restricted/suspected يطبّقه الخادم من لقطات shr_establishment_compliance (409 establishment_blocked)،
  -- لا من قيد هنا: الحالة الفعلية مشتقة من آخر لقطة متحقَّق منها.
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

-- ------------------------------------------------------------- الامتثال ----
-- وحدة الامتثال (مسودات وبيانات وهمية). القواعد:
--  * لا رقم نظامي هنا ولا في الشيفرة: الغرامات والمدد والنسب والنطاقات كلها من
--    db/shr-ref/*.json (لكل صف rule_id وsource_url وverified). ما verified فيه غير
--    confirmed لا يظهر لعميل ولا يُفعَّل في قاعدة تمنع أو تنبّه؛ يظهر للمشغّل بوسم «غير مؤكد».
--  * المبلغ والموعد تقدير دائماً ومعه مصدره؛ ولا موعد اعتراض بلا تاريخ تبليغ مُدخَل بشرياً.
--  * من يُدخل لا يعتمد (قيود check)، ولا حذف (مشغّل لكل جدول)، والتغييرات تُدوَّن في shr_audit_log.
--  * لا أسماء حقيقية ولا هوية خام: بصمة id_no_hash فقط، وأسماء A33 بوسم «(وهمي)».

-- ربط مركّب (tenant_id, id) يمنع ربطاً عابراً للمستأجرين.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'shr_establishments_tenant_id_id_key') then
    alter table shr_establishments add constraint shr_establishments_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shr_workers_tenant_id_id_key') then
    alter table shr_workers add constraint shr_workers_tenant_id_id_key unique (tenant_id, id);
  end if;
  -- ترقية قاعدة قديمة: دور compliance_officer في قيد الأدوار.
  if exists (select 1 from pg_constraint where conname = 'shr_users_role_check'
             and pg_get_constraintdef(oid) not like '%compliance_officer%') then
    alter table shr_users drop constraint shr_users_role_check;
    alter table shr_users add constraint shr_users_role_check
      check (role in ('tenant_owner','operator','client_admin','client_viewer','worker','agency','compliance_officer'));
  end if;
end $$;

alter table shr_procedure_steps add column if not exists establishment_id uuid;
alter table shr_procedure_steps add column if not exists created_by uuid;
alter table shr_procedure_steps add column if not exists created_at timestamptz not null default now();

create table if not exists shr_compliance_settings (   -- إعدادات الامتثال للمستأجر (صف واحد)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references shr_tenants(id),
  unknown_blocks boolean not null default false,       -- unknown تحذير لا منع، ما لم يُفعَّل
  expiry_alert_days int not null default 60 check (expiry_alert_days between 1 and 365),     -- افتراض تشغيلي لا نظامي
  deadline_alert_days int not null default 14 check (deadline_alert_days between 1 and 180), -- افتراض تشغيلي لا نظامي
  client_visibility boolean not null default false,    -- العميل لا يرى المخالفات ولا حالة القيد
  a33_gate boolean not null default true,              -- حجب تفعيل العامل المرتبط بقائمة A33 غير المعتمدة
  block_steps jsonb not null default '["visa"]',       -- خطوات الإجراء المحجوبة لمنشأة restricted/suspected
  updated_by uuid,
  updated_at timestamptz
);

create table if not exists shr_establishment_compliance (  -- لقطات تاريخية لحالة المنشأة
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  establishment_id uuid not null,
  as_of date not null default current_date,
  activity_rule_id text check (activity_rule_id is null or activity_rule_id ~ '^NIT-[0-9]+$'),   -- نشاط نطاقات من المرجع
  declared_band text check (declared_band is null or declared_band in ('red','green_low','green_mid','green_high','platinum')),
  declared_saudization_pct numeric(5,2) check (declared_saudization_pct is null or declared_saudization_pct between 0 and 100),
  saudi_count int check (saudi_count is null or saudi_count >= 0),
  non_saudi_count int check (non_saudi_count is null or non_saudi_count >= 0),
  computed_pct numeric(5,2),                           -- تقدير بالعدّ بالرؤوس (أوزان الأجور معطّلة)
  computed_band text check (computed_band is null or computed_band in ('red','green_low','green_mid','green_high','platinum')),
  computed_basis jsonb,                                -- مصدر التقدير وتحفظاته
  restriction_state text not null default 'unknown' check (restriction_state in ('unknown','clear','restricted','suspected')),
  restriction_reason text,
  source_note text,                                    -- من أين أُدخلت الحالة (إدخال بشري من منصة الجهة)
  entered_by uuid not null,
  verified_on date,
  verified_by uuid,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, establishment_id) references shr_establishments(tenant_id, id),
  check (verified_by is null or verified_by <> entered_by),                 -- من يُدخل لا يتحقق
  check ((verified_by is null) = (verified_on is null)),
  check (restriction_state not in ('restricted','suspected') or coalesce(length(trim(restriction_reason)), 0) > 0),
  check (computed_pct is null or computed_basis is not null)                -- لا تقدير بلا مصدر
);
create index if not exists shr_ecomp_est on shr_establishment_compliance (tenant_id, establishment_id, as_of desc, created_at desc);

create or replace function shr_ecomp_guard() returns trigger language plpgsql as
$$ begin
  if tg_op = 'DELETE' then raise exception 'shr_establishment_compliance is append-only'; end if;
  if old.verified_by is not null then raise exception 'snapshot already verified'; end if;
  if (to_jsonb(new) - 'verified_by' - 'verified_on') <> (to_jsonb(old) - 'verified_by' - 'verified_on') then
    raise exception 'snapshot is historical: only verification may be added';
  end if;
  return new;
end $$;
drop trigger if exists shr_ecomp_no_change on shr_establishment_compliance;
create trigger shr_ecomp_no_change before update or delete on shr_establishment_compliance
  for each row execute function shr_ecomp_guard();

create table if not exists shr_violations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  establishment_id uuid not null,
  authority text not null,                             -- الجهة المصدِرة
  ref_no text,                                         -- رقم المخالفة/القرار كما في الإشعار
  rule_id text not null check (rule_id ~ '^[A-Z]+-[0-9]+$'),   -- بند المرجع (db/shr-ref/violations_rules.json)
  rule_verified text not null,                         -- حالة تحقق البند وقت التسجيل
  kind_ar text not null,                               -- نوع المخالفة: نسخة من اسم البند
  severity text,
  persons_count int not null default 1 check (persons_count >= 1),   -- عدد الأشخاص/الحالات
  size_tier text,                                      -- شريحة المنشأة: مفتاح من fine_sar في المرجع، يُدخلها إنسان
  fine_estimate_sar numeric(14,2),                     -- تقدير من المرجع فقط
  fine_source jsonb,                                   -- {rule_id, source_url, source_ref, verified, tier, unit_sar, count}
  notification_date date,                              -- تاريخ التبليغ: إدخال بشري من الإشعار الرسمي وحده
  notification_entered_by uuid,
  estimated_objection_deadline date,                   -- تبليغ + مدة المرجع؛ لا يُشتق من تاريخ المخالفة
  objection_basis jsonb,
  status text not null default 'review' check (status in ('review','objection_eligibility_study','preparation','submission','follow_up')),
  paid_state text not null default 'unknown' check (paid_state in ('unknown','unpaid','paid')),
  entered_by uuid not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  archived_at timestamptz,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, establishment_id) references shr_establishments(tenant_id, id),
  check (reviewed_by is null or reviewed_by <> entered_by),                       -- من يُدخل لا يراجع
  check (status = 'review' or reviewed_by is not null),                           -- لا تقدّم بلا مراجعة ثانية
  check (estimated_objection_deadline is null or notification_date is not null),  -- لا موعد بلا تاريخ تبليغ
  check ((estimated_objection_deadline is null) = (objection_basis is null)),
  check (fine_estimate_sar is null or fine_source is not null),                   -- لا مبلغ بلا مصدر
  check (notification_date is null or notification_entered_by is not null)
);
create unique index if not exists shr_viol_refno on shr_violations (tenant_id, authority, ref_no) where ref_no is not null and archived_at is null;
create index if not exists shr_viol_est on shr_violations (tenant_id, establishment_id) where archived_at is null;

create table if not exists shr_compliance_checks (    -- نتائج الفحوص: سجل لا يُعدَّل
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  establishment_id uuid,
  worker_id uuid,
  check_key text not null,
  result text not null check (result in ('pass','warn','fail','unknown')),
  detail jsonb not null default '{}',
  rule_ids jsonb not null default '[]',
  run_by uuid,
  run_at timestamptz not null default now(),
  foreign key (tenant_id, establishment_id) references shr_establishments(tenant_id, id),
  foreign key (tenant_id, worker_id) references shr_workers(tenant_id, id)
);

create table if not exists shr_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  key text not null,
  title_ar text not null,
  audience text not null check (audience in ('staff','client','worker','agency')),   -- من يرى القائمة
  scope text not null check (scope in ('establishment','worker','violation')),
  version int not null default 1,                       -- التعديل نسخة جديدة لا تحرير
  active boolean not null default true,
  demo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key, version)
);

create table if not exists shr_checklist_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  template_id uuid not null,
  position int not null,
  text_ar text not null,
  required boolean not null default true,
  rule_id text check (rule_id is null or rule_id ~ '^[A-Z]+(-[A-Z]+)?-[0-9]+$'),   -- بند مرجعي؛ غير المؤكد يُعطَّل البند
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, template_id, position),
  foreign key (tenant_id, template_id) references shr_checklist_templates(tenant_id, id)
);

create table if not exists shr_checklist_ticks (      -- إنجاز البنود: سجل لا يُعدَّل، الأحدث هو الحالة
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  item_id uuid not null,
  subject_kind text not null check (subject_kind in ('establishment','worker','violation')),
  subject_id uuid not null,
  done boolean not null,
  note text,
  ticked_by uuid not null,
  ticked_at timestamptz not null default now(),
  foreign key (tenant_id, item_id) references shr_checklist_items(tenant_id, id)
);

create table if not exists shr_a33_names (            -- تصنيف أسماء قائمة م33 (سعوديون مسجّلون بلا علاقة عمل فعلية)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  establishment_id uuid not null,
  list_ref text not null,                              -- دفعة/قائمة واحدة
  alias text not null,                                 -- اسم وهمي موسوم «(وهمي)»؛ لا أسماء حقيقية
  id_no_hash text not null,                            -- بصمة الهوية فقط
  worker_id uuid,                                      -- ربط اختياري بعامل في النظام
  classification text check (classification in ('actual_worker','not_a_worker','works_for_other')),
  classification_note text,
  classified_by uuid,
  classified_at timestamptz,
  approved_by uuid,                                    -- مراجع ثانٍ
  approved_at timestamptz,
  archived_at timestamptz,
  demo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, establishment_id) references shr_establishments(tenant_id, id),
  foreign key (tenant_id, worker_id) references shr_workers(tenant_id, id),
  check ((classification is null) = (classified_by is null)),
  check (approved_by is null or classification is not null),
  check (approved_by is null or approved_by <> classified_by),      -- المصنِّف لا يعتمد
  check ((approved_by is null) = (approved_at is null))
);
create unique index if not exists shr_a33_dup on shr_a33_names (tenant_id, establishment_id, list_ref, id_no_hash) where archived_at is null;

create table if not exists shr_worker_transfers (     -- نقل عامل بين المنشآت: طلب ثم موافقة من غير الطالب
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  worker_id uuid not null,
  from_establishment_id uuid not null,
  to_establishment_id uuid not null,
  reason text not null,
  state text not null default 'requested' check (state in ('requested','approved','rejected')),
  requested_by uuid not null,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, worker_id) references shr_workers(tenant_id, id),
  foreign key (tenant_id, from_establishment_id) references shr_establishments(tenant_id, id),
  foreign key (tenant_id, to_establishment_id) references shr_establishments(tenant_id, id),
  check (from_establishment_id <> to_establishment_id),
  check (decided_by is null or decided_by <> requested_by),          -- من يطلب لا يوافق
  check ((state = 'requested') = (decided_by is null))
);
create unique index if not exists shr_transfer_open on shr_worker_transfers (tenant_id, worker_id) where state = 'requested';

create table if not exists shr_import_batches (       -- دفعات تأمينات/حماية أجور: uploaded → matched → reviewed → applied
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  kind text not null check (kind in ('gosi','wps')),
  label text,
  state text not null default 'uploaded' check (state in ('uploaded','matched','reviewed','applied')),
  row_count int not null default 0,
  matched_count int not null default 0,
  uploaded_by uuid not null,
  matched_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  applied_by uuid,
  applied_at timestamptz,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (reviewed_by is null or reviewed_by <> uploaded_by),         -- من يرفع لا يراجع
  check (applied_by is null or applied_by <> uploaded_by),           -- من يرفع لا يطبّق
  check (state not in ('reviewed','applied') or reviewed_by is not null),
  check (state <> 'applied' or applied_by is not null)
);

create table if not exists shr_import_rows (          -- صفوف مُبصَّمة فقط: لا اسم ولا هوية ولا هاتف
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  batch_id uuid not null,
  line int not null,
  id_no_hash text not null,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null,
  match_state text not null default 'unmatched' check (match_state in ('unmatched','matched')),
  worker_id uuid,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, batch_id, line),
  foreign key (tenant_id, batch_id) references shr_import_batches(tenant_id, id),
  foreign key (tenant_id, worker_id) references shr_workers(tenant_id, id)
);

-- ------------------------------------------------------- إعلانات الوظائف ----
-- بوست توظيف (إعلان وظيفة) داخل SHR وحدها. قرار المالك: موضع النشر العام معلّق، فالنشر
-- الخارجي أو على صفحة عامة ممنوع الآن. «published» تعني «ظاهر داخل صفحة SHR الخاصة» فقط.
--  * الدورة: draft → pending_approval → approved → published → closed، بلا قفز (مشغّل أدناه).
--  * من يكتب لا يعتمد (check). نطاق الراتب اختياري ويدخله إنسان فقط (salary_entered_by إلزامي معه).
--  * القناة الوحيدة المفعّلة shr_private؛ غيرها موجود في check ومعطّل بـshr_post_channels.
--  * بلا حذف (الإغلاق فقط) والأحداث append-only.

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'shr_jobs_tenant_id_id_key') then
    alter table shr_jobs add constraint shr_jobs_tenant_id_id_key unique (tenant_id, id);
  end if;
end $$;

create table if not exists shr_job_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  job_id uuid not null,
  establishment_id uuid,                       -- المنشأة المعلِنة: تخضع لحجب الامتثال
  title text not null check (char_length(title) between 2 and 120),
  description text check (description is null or char_length(description) <= 1500),
  requirements text check (requirements is null or char_length(requirements) <= 1500),
  city text,
  headcount int not null check (headcount >= 1),   -- نسخة من الوظيفة عند الإنشاء
  language text not null default 'ar' check (language in ('ar','en')),
  salary_min int check (salary_min is null or (salary_min >= 0 and salary_min <= 1000000)),
  salary_max int check (salary_max is null or (salary_max >= 0 and salary_max <= 1000000)),
  salary_entered_by uuid,                      -- إنسان أدخل النطاق؛ لا يُولَّد ولا يُخترع
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','published','closed')),
  channel text not null default 'shr_private' check (channel in ('shr_private','public_bp_jobs','external')),
  created_by uuid not null,
  submitted_by uuid, submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  published_by uuid, published_at timestamptz,
  closed_by uuid, closed_at timestamptz, close_reason text,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (tenant_id, job_id) references shr_jobs(tenant_id, id),
  foreign key (tenant_id, establishment_id) references shr_establishments(tenant_id, id),
  check (salary_min is null or salary_max is null or salary_min <= salary_max),
  check ((salary_min is null and salary_max is null) or salary_entered_by is not null),
  -- من يكتب لا يعتمد.
  check (approved_by is null or approved_by <> created_by),
  check (status not in ('approved','published') or approved_by is not null),
  check (status <> 'published' or published_at is not null),
  -- لا إرسال للاعتماد بلا منشأة معلِنة (يُفحص حجبها).
  check (status not in ('pending_approval','approved','published') or establishment_id is not null),
  -- «منشور» = داخل صفحة SHR الخاصة فقط في هذه المرحلة.
  check (status <> 'published' or channel = 'shr_private')
);
create index if not exists shr_job_posts_job on shr_job_posts (tenant_id, job_id);

alter table shr_applications add column if not exists post_id uuid references shr_job_posts(id);   -- طلب أُدخل من إعلان (اختياري)

create table if not exists shr_job_post_events (   -- سجل حالات الإعلان: لا تعديل ولا حذف
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  post_id uuid not null references shr_job_posts(id),
  from_status text, to_status text not null,
  actor uuid, note text,
  at timestamptz not null default now()
);

create table if not exists shr_post_channels (     -- قنوات النشر غير الخاصة: معطّلة حتى قرار المالك
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references shr_tenants(id),
  channel text not null check (channel in ('public_bp_jobs','external')),
  channel_enabled boolean not null default false,
  updated_by uuid,
  updated_at timestamptz,
  unique (tenant_id, channel)
);

-- الحراسة الثانية في القاعدة: لا قفز بين الحالات، ولا تعديل لمحتوى إعلان خرج من المسودة.
create or replace function shr_job_posts_guard() returns trigger language plpgsql as $$
begin
  if old.status = 'closed' and new.status <> 'closed' then raise exception 'shr_job_posts: closed is final'; end if;
  if new.status <> old.status and not (
       (old.status = 'draft' and new.status = 'pending_approval')
    or (old.status = 'pending_approval' and new.status = 'approved')
    or (old.status = 'approved' and new.status = 'published')
    or (new.status = 'closed')) then
    raise exception 'shr_job_posts: illegal transition % -> %', old.status, new.status;
  end if;
  if old.status <> 'draft' and (new.job_id, new.establishment_id, new.title, new.description, new.requirements, new.city, new.headcount, new.language, new.salary_min, new.salary_max, new.channel, new.created_by)
     is distinct from (old.job_id, old.establishment_id, old.title, old.description, old.requirements, old.city, old.headcount, old.language, old.salary_min, old.salary_max, old.channel, old.created_by) then
    raise exception 'shr_job_posts: content is frozen after draft';
  end if;
  return new;
end $$;
drop trigger if exists shr_job_posts_transition on shr_job_posts;
create trigger shr_job_posts_transition before update on shr_job_posts
  for each row execute function shr_job_posts_guard();

-- لا حذف في أي جدول امتثال؛ والسجلات الحدثية لا تُعدَّل أيضاً.
create or replace function shr_no_delete() returns trigger language plpgsql as
$$ begin raise exception '% is archive-only (no delete)', tg_table_name; end $$;
create or replace function shr_append_only() returns trigger language plpgsql as
$$ begin raise exception '% is append-only', tg_table_name; end $$;
do $$
declare t text;
begin
  foreach t in array array['shr_compliance_settings','shr_violations','shr_a33_names','shr_worker_transfers',
    'shr_import_batches','shr_import_rows','shr_checklist_templates','shr_checklist_items','shr_job_posts','shr_post_channels'] loop
    execute format('drop trigger if exists %I on %I', t || '_no_delete', t);
    execute format('create trigger %I before delete on %I for each row execute function shr_no_delete()', t || '_no_delete', t);
  end loop;
  foreach t in array array['shr_compliance_checks','shr_checklist_ticks','shr_job_post_events'] loop
    execute format('drop trigger if exists %I on %I', t || '_append_only', t);
    execute format('create trigger %I before update or delete on %I for each row execute function shr_append_only()', t || '_append_only', t);
  end loop;
end $$;

-- ----------------------------------------------------------------- RLS ----
-- الجلسة تضبط: select set_config('app.tenant_id', '<uuid>', true)
do $$
declare t text;
begin
  foreach t in array array['shr_users','shr_establishments','shr_client_companies','shr_contracts',
    'shr_workers','shr_assignments','shr_worker_documents','shr_requests','shr_agencies',
    'shr_recruitment_orders','shr_agency_candidates','shr_procedure_steps','shr_payroll_runs',
    'shr_invoices','shr_audit_log','shr_candidates','shr_candidate_consents','shr_jobs',
    'shr_applications','shr_application_events','shr_interviews','shr_agency_candidate_events','shr_agency_interviews',
    'shr_compliance_settings','shr_establishment_compliance','shr_violations','shr_compliance_checks',
    'shr_checklist_templates','shr_checklist_items','shr_checklist_ticks','shr_a33_names',
    'shr_worker_transfers','shr_import_batches','shr_import_rows','shr_job_posts','shr_job_post_events','shr_post_channels'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_iso on %I', t);
    execute format($p$create policy tenant_iso on %I using (tenant_id::text = current_setting('app.tenant_id', true)) with check (tenant_id::text = current_setting('app.tenant_id', true))$p$, t);
  end loop;
end $$;
