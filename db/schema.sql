-- ============================================================================
-- Business Partner — Client Operations Center: operational database schema
-- Target: Supabase (Postgres 15+). Run in the Supabase SQL editor as-is.
--
-- Design rules (per the approved audit/design doc):
--   * Every operational table carries organization_id (tenant key) and RLS.
--   * Notion stays the source of services/pricing CONTENT; `services` here is
--     a synced read model keyed by the official catalog code (98 services).
--   * Money is a ledger: wallet balance is derived, never stored as a field
--     clients can write. Activation codes are stored as hashes only.
--   * API access uses the service_role key from Vercel functions ONLY; the
--     anon key gets nothing (no direct browser access in phase 1).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- identity --
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  email_verified_at timestamptz,
  phone text,
  password_hash text,                -- nullable: OTP/نفاذ users have none
  nafath_id text unique,
  full_name text,
  locale text not null default 'ar',
  is_bp_staff boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text,
  cr_number text,                    -- السجل التجاري
  vat_number text,
  city text,
  profile_completeness int not null default 0 check (profile_completeness between 0 and 100),
  notion_crm_page_id text,           -- mirror link to Sales Pipeline/CRM
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id text primary key,               -- owner/admin/finance/hr/gov_relations/viewer/external_accountant/bp_operator
  name_ar text not null,
  rank int not null default 0
);
insert into roles (id, name_ar, rank) values
  ('owner','مالك المنشأة',100), ('admin','مدير',90), ('finance','مالية',60),
  ('hr','موارد بشرية',60), ('gov_relations','علاقات حكومية',60),
  ('viewer','مشاهد',10), ('external_accountant','محاسب خارجي',20),
  ('bp_operator','مشغّل Business Partner',80)
on conflict (id) do nothing;

create table if not exists permissions (
  id text primary key,               -- e.g. orders.read, payments.approve, documents.write
  description text
);
create table if not exists role_permissions (
  role_id text not null references roles(id) on delete cascade,
  permission_id text not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role_id text not null references roles(id),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  invited_by uuid references users(id),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,   -- sha256 of the cookie value; raw never stored
  organization_id uuid references organizations(id), -- active org for the session
  ip text, user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists user_sessions_user_idx on user_sessions(user_id) where revoked_at is null;

-- ---------------------------------------------------------------- catalog --
-- Read model synced from BP Services Catalog - OFFICIAL (Notion). code = the
-- official Service Code; notion_page_id anchors the sync.
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null, name_en text,
  category text,
  gov_platform text,
  pricing_model text check (pricing_model in ('monthly','one_time','starting_from','percent','per_candidate','custom')),
  monthly_fee numeric(12,2), one_time_fee numeric(12,2), setup_fee numeric(12,2),
  min_price numeric(12,2), max_price_incl_vat numeric(12,2),
  requires_human_approval boolean not null default false,
  requires_contract boolean not null default false,
  opens_portal text,                 -- compliance/smart_employees/recruitment/shared_services/…
  active boolean not null default true,
  notion_page_id text unique,
  synced_at timestamptz
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- e.g. BP-HR-OPS-SMALL
  name_ar text not null, name_en text,
  period text not null default 'monthly' check (period in ('monthly','yearly','one_time')),
  price numeric(12,2),
  active boolean not null default true,
  notion_page_id text unique
);
create table if not exists plan_items (
  plan_id uuid not null references plans(id) on delete cascade,
  service_id uuid not null references services(id),
  quantity int not null default 1,
  primary key (plan_id, service_id)
);

-- ------------------------------------------------------------------- sales --
create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  user_id uuid references users(id),
  status text not null default 'open' check (status in ('open','converted','abandoned')),
  created_at timestamptz not null default now()
);
create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  service_id uuid references services(id),
  plan_id uuid references plans(id),
  quantity int not null default 1,
  unit_price numeric(12,2) not null,  -- server-side snapshot from catalog; NEVER client-supplied
  check (service_id is not null or plan_id is not null)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,           -- BP-###### (server-generated)
  organization_id uuid not null references organizations(id),
  created_by uuid references users(id),
  status text not null default 'checkout' check (status in
    ('draft','checkout','payment_pending','payment_verification','paid',
     'provisioning','action_required','active','renewal_due','suspended',
     'expired','cancelled')),
  bp_fees numeric(12,2) not null default 0,
  gov_fees numeric(12,2) not null default 0,   -- الرسوم الحكومية منفصلة
  vat numeric(12,2) not null default 0,        -- 15%
  total numeric(12,2) not null default 0,
  currency text not null default 'SAR',
  notion_page_id text,                -- mirror into Sales Pipeline
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_org_idx on orders(organization_id);
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  service_id uuid references services(id),
  plan_id uuid references plans(id),
  quantity int not null default 1,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  plan_id uuid references plans(id),
  order_id uuid references orders(id),
  status text not null default 'active' check (status in ('active','renewal_due','suspended','expired','cancelled')),
  starts_at date not null default current_date,
  renews_at date,
  auto_renew boolean not null default false,   -- تجديد تلقائي بموافقة صريحة فقط
  auto_renew_consented_at timestamptz,
  created_at timestamptz not null default now()
);

-- one entitlement per purchased service — the thing "خدماتي وبواباتي" renders
create table if not exists service_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  service_id uuid not null references services(id),
  order_item_id uuid references order_items(id),
  subscription_id uuid references subscriptions(id),
  status text not null default 'provisioning' check (status in
    ('provisioning','action_required','active','suspended','expired','cancelled')),
  activation_pct int not null default 0 check (activation_pct between 0 and 100),
  client_action_required text,        -- ما المطلوب من العميل الآن
  missing_documents text[],
  bp_owner text,                      -- مسؤول الخدمة في BP
  sla_due timestamptz,
  starts_at date, renews_at date,
  last_update_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entitlements_org_idx on service_entitlements(organization_id);

-- ------------------------------------------------------------------- money --
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  order_id uuid references orders(id),
  method text not null check (method in ('bank_transfer','moyasar','wallet')),
  status text not null default 'initiated' check (status in
    ('initiated','pending_review','pending_gateway','paid','failed','refunded','partially_refunded')),
  amount numeric(12,2) not null,
  currency text not null default 'SAR',
  gateway_ref text,                   -- Moyasar payment id
  receipt_document_id uuid,           -- FK added after documents table
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_org_idx on payments(organization_id);

-- raw webhook/event trail; idempotency enforced here
create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id),
  provider text not null,             -- moyasar/manual/n8n-receipt-agent
  event_type text not null,
  idempotency_key text not null unique,
  signature_valid boolean,
  payload jsonb,
  received_at timestamptz not null default now()
);

create table if not exists wallet_accounts (
  organization_id uuid primary key references organizations(id) on delete cascade,
  currency text not null default 'SAR',
  created_at timestamptz not null default now()
  -- NO balance column: balance = sum(wallet_transactions.amount). By design.
);
create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references wallet_accounts(organization_id) on delete cascade,
  type text not null check (type in ('topup','payment','refund','adjustment')),
  amount numeric(12,2) not null,      -- signed: topup/refund > 0, payment < 0
  related_payment_id uuid references payments(id),
  related_order_id uuid references orders(id),
  note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists wallet_tx_org_idx on wallet_transactions(organization_id);
create or replace view wallet_balances as
  select organization_id, coalesce(sum(amount),0)::numeric(12,2) as balance
  from wallet_transactions group by organization_id;

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  order_id uuid references orders(id),
  number text not null unique,        -- INV-YYYY-#### sequential
  kind text not null default 'invoice' check (kind in ('invoice','credit_note')),
  bp_fees numeric(12,2) not null default 0,
  gov_fees numeric(12,2) not null default 0,
  vat numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  status text not null default 'unpaid' check (status in ('unpaid','paid','void','refunded')),
  zatca_qr text,                      -- filled when ZATCA phase lands
  issued_at timestamptz not null default now()
);
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  payment_id uuid references payments(id),
  invoice_id uuid references invoices(id),
  number text not null unique,
  issued_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ access --
-- Single-use, expiring, hashed activation codes replacing "order ref as
-- password" and plaintext codes in Notion. Legacy migration: first successful
-- legacy-code login mints a row here + a session, old code retired gradually.
create table if not exists activation_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid references users(id),
  order_id uuid references orders(id),
  service_id uuid references services(id),
  token_hash text not null unique,    -- sha256; raw shown once + emailed
  purpose text not null,              -- portal_login/compliance/employer/shared_services
  single_use boolean not null default true,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  legacy_source text,                 -- e.g. 'notion:رمز الدخول' during migration
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- operations --
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  details text,
  assignee text not null default 'client' check (assignee in ('client','bp')),
  source text,                        -- system/order/document/approval/manual
  related_order_id uuid references orders(id),
  related_entitlement_id uuid references service_entitlements(id),
  status text not null default 'open' check (status in ('open','in_progress','blocked','done','cancelled')),
  urgency text not null default 'normal' check (urgency in ('urgent','soon','normal')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_org_open_idx on tasks(organization_id) where status in ('open','in_progress','blocked');

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  action_type text not null,          -- payment/contract/gov_submission/status_change/official_letter/share_document/member_change
  title text not null,
  amount numeric(12,2),
  target_entity text,                 -- الجهة
  risk_note text,
  requested_by uuid references users(id),
  deadline timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','expired')),
  decided_by uuid references users(id),
  decided_at timestamptz,
  decision_comment text,              -- إلزامي عند الرفض (يُفرض في الAPI)
  related_order_id uuid references orders(id),
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  category text not null,             -- cr/aoa/id/national_address/zakat/gosi/qiwa/mudad/muqeem/balady/chamber/license/contract/invoice/receipt/other
  title text not null,
  current_version_id uuid,            -- set after first version insert
  expiry_date date,
  verify_status text not null default 'pending' check (verify_status in ('pending','scanning','verified','rejected','expiring','expired')),
  qr_result text,
  related_order_id uuid references orders(id),
  related_service_id uuid references services(id),
  created_at timestamptz not null default now()
);
create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_no int not null,
  storage_key text not null,          -- Supabase Storage path; signed short-lived URLs only
  file_name text, mime text, size_bytes bigint,
  sha256 text,
  malware_scan text not null default 'pending' check (malware_scan in ('pending','clean','flagged','skipped')),
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now(),
  unique (document_id, version_no)    -- versions are append-only; nothing lost
);
alter table payments
  add constraint payments_receipt_fk foreign key (receipt_document_id) references documents(id);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,        -- BP-TKT-###### (server sequence)
  organization_id uuid not null references organizations(id),
  portal_source text,                 -- account/compliance/portal/employer/…
  category text, priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'new' check (status in ('new','open','waiting_client','waiting_bp','resolved','closed')),
  subject text not null,
  sla_due timestamptz,
  related_order_id uuid references orders(id),
  related_invoice_id uuid references invoices(id),
  opened_by uuid references users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_kind text not null check (author_kind in ('client','bp','system')),
  author_user_id uuid references users(id),
  body text not null,
  attachments uuid[],                 -- document ids
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid references users(id),  -- null = all org members
  event text not null,                -- account_created/order_created/payment_pending/…
  channel text not null default 'inapp' check (channel in ('inapp','email','whatsapp','sms')),
  title text not null, body text,
  idempotency_key text not null unique,  -- لا رسائل مكررة أبداً
  sent_at timestamptz, read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_inbox_idx on notifications(organization_id, user_id) where read_at is null;

create table if not exists platform_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  platform text not null,             -- qiwa/gosi/mudad/muqeem/absher_business/balady/sbc/zatca/salama/chamber/spl/ejar/wathq
  status text not null default 'not_connected' check (status in
    ('connected','verified_manually','awaiting_authorization','action_required','not_connected','integration_unavailable')),
  authorized_by uuid references users(id),
  authorized_at timestamptz,
  last_verified_at timestamptz,
  note text,
  unique (organization_id, platform)
);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  n8n_workflow_id text not null,
  status text not null check (status in ('started','succeeded','failed')),
  payload_ref text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  actor_user_id uuid references users(id),
  actor_label text,                   -- 'system'/'n8n'/'bp_operator:name' when no user
  action text not null,               -- e.g. payment.approved, entitlement.activated
  entity_type text, entity_id uuid,
  before jsonb, after jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists audit_org_idx on audit_logs(organization_id, created_at desc);

create table if not exists notion_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('notion_to_db','db_to_notion')),
  entity text not null,               -- services/plans/orders/…
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  last_error text,
  started_at timestamptz, finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------- RLS --
-- Phase 1 access model: Vercel functions use the service_role key (bypasses
-- RLS by definition) and enforce org scoping in code; RLS below is the second
-- lock so ANY other key (anon, future client-side reads, mistakes) sees
-- nothing cross-tenant. Membership drives visibility.
create or replace function current_org_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select organization_id from organization_members
  where user_id = nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid
    and status = 'active'
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','organization_members','carts','cart_items','orders','order_items',
    'subscriptions','service_entitlements','payments','payment_events','wallet_accounts',
    'wallet_transactions','invoices','receipts','activation_tokens','tasks','approvals',
    'documents','document_versions','support_tickets','ticket_messages','notifications',
    'platform_connections','automation_runs','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- org-scoped read policies (write stays service_role-only in phase 1)
create policy org_read on organizations for select using (id in (select current_org_ids()));
create policy member_read on organization_members for select using (organization_id in (select current_org_ids()));
create policy orders_read on orders for select using (organization_id in (select current_org_ids()));
create policy order_items_read on order_items for select using (order_id in (select id from orders where organization_id in (select current_org_ids())));
create policy entitlements_read on service_entitlements for select using (organization_id in (select current_org_ids()));
create policy payments_read on payments for select using (organization_id in (select current_org_ids()));
create policy wallet_read on wallet_transactions for select using (organization_id in (select current_org_ids()));
create policy invoices_read on invoices for select using (organization_id in (select current_org_ids()));
create policy tasks_read on tasks for select using (organization_id in (select current_org_ids()));
create policy approvals_read on approvals for select using (organization_id in (select current_org_ids()));
create policy documents_read on documents for select using (organization_id in (select current_org_ids()));
create policy docver_read on document_versions for select using (document_id in (select id from documents where organization_id in (select current_org_ids())));
create policy tickets_read on support_tickets for select using (organization_id in (select current_org_ids()));
create policy ticketmsg_read on ticket_messages for select using (ticket_id in (select id from support_tickets where organization_id in (select current_org_ids())));
create policy notif_read on notifications for select using (organization_id in (select current_org_ids()));
create policy platform_read on platform_connections for select using (organization_id in (select current_org_ids()));

-- users/sessions: self only
alter table users enable row level security;
alter table user_sessions enable row level security;
create policy users_self on users for select using (id = nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid);
create policy sessions_self on user_sessions for select using (user_id = nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid);

-- catalog is world-readable (public pricing content)
alter table services enable row level security;
alter table plans enable row level security;
alter table plan_items enable row level security;
create policy services_public on services for select using (true);
create policy plans_public on plans for select using (true);
create policy plan_items_public on plan_items for select using (true);

-- ---------------------------------------------------------------------------
-- 2026-08-22: automatic document reading. The upload endpoint now runs the
-- same extraction agent the checkout uses and stores what it read, so the
-- client's dashboard shows every document parsed (dates, entity, numbers)
-- and services can be bought with the company's own data pre-filled.
alter table documents add column if not exists issue_date date;
alter table documents add column if not exists extracted jsonb;

-- ---------------------------------------------------------------------------
-- 2026-08-23: escrow between client and supplier + supplier wallet.
-- The client funds an escrow from their wallet (a signed 'payment' ledger row
-- keyed by the escrow ref); when the client approves delivery, the amount is
-- credited to the supplier's own ledger. Balances stay derived, never stored.
create table if not exists escrows (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  organization_id uuid not null references organizations(id) on delete cascade,
  client_email text not null,
  supplier_email text not null,
  supplier_name text,
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'held' check (status in ('held','released','refund_requested','refunded','cancelled')),
  note text,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists escrows_org_idx on escrows(organization_id);
create index if not exists escrows_supplier_idx on escrows(supplier_email);
alter table escrows enable row level security;

create table if not exists supplier_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  supplier_email text not null,
  type text not null check (type in ('escrow_release','withdrawal','adjustment')),
  amount numeric(12,2) not null,      -- signed: release > 0, withdrawal < 0
  note text,
  created_at timestamptz not null default now()
);
create index if not exists supplier_tx_email_idx on supplier_wallet_transactions(supplier_email);
alter table supplier_wallet_transactions enable row level security;
create or replace view supplier_wallet_balances as
  select supplier_email, coalesce(sum(amount),0)::numeric(14,2) as balance
  from supplier_wallet_transactions group by supplier_email;

-- ---------------------------------------------------------------------------
-- 2026-08-23 (b): escrow becomes a two-sided handshake, like freelance
-- marketplaces. The supplier declares delivery (delivered_at), the client
-- approves receipt to release; a refund reaches the client only with the
-- supplier's consent or a Business Partner decision. Every step is stamped.
alter table escrows drop constraint if exists escrows_status_check;
alter table escrows add constraint escrows_status_check
  check (status in ('held','delivered','refund_requested','released','refunded','cancelled'));
alter table escrows add column if not exists delivered_at timestamptz;
alter table escrows add column if not exists supplier_note text;

-- 2026-08-24: n8n-driven automation timers. refund_requested_at anchors the
-- auto-refund deadline (supplier silence on an UNDELIVERED job = consent);
-- delivered_at already anchors auto-release (client silence = acceptance).
alter table escrows add column if not exists refund_requested_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2026-08-27: الوكيل الذكي للمستندات (AI Document Agent).
-- A request = one conversation-first case: the client uploads source documents
-- (CR, AOA, IDs, bank letters…) and target forms (vendor/AML/KYC/NDA…); the
-- agent classifies, extracts, reconciles across documents, maps form fields,
-- asks only for what is missing, fills, stamps, QA-checks and packages.
-- Every extracted value keeps its provenance (document, page, confidence,
-- status) — nothing is ever assumed for legal declarations (PEP, sanctions…).
-- Channel-agnostic: the same request continues across website, portal and
-- WhatsApp through one conversation id.

create table if not exists doc_agent_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                 -- DOC-###### (server-generated)
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references users(id),
  contact text,                             -- email/phone for pre-login WhatsApp cases
  channel text not null default 'web' check (channel in ('web','portal','whatsapp','consultant')),
  locale text not null default 'ar',
  status text not null default 'NEW' check (status in
    ('NEW','UPLOADING','ANALYZING','EXTRACTING','MAPPING','WAITING_FOR_CLIENT',
     'READY_TO_GENERATE','GENERATING','QA','READY','DELIVERED','REVISION','COMPLETED')),
  title text,
  checklist jsonb not null default '[]',    -- requirement list parsed from emails/screenshots
  fill_color text not null default 'blue' check (fill_color in ('blue','black','original')),
  signature_mode text not null default 'leave_blank' check (signature_mode in
    ('leave_blank','typed_electronic','external_esign')),
  stamp_document_id uuid references documents(id),   -- transparent PNG stamp asset
  qa_report jsonb,
  package_storage_key text,                 -- final ZIP in the documents bucket
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists doc_agent_requests_org_idx on doc_agent_requests(organization_id);
create index if not exists doc_agent_requests_contact_idx on doc_agent_requests(contact);

-- Every uploaded file, auto-classified. Bytes live in the documents vault
-- (Supabase Storage, signed URLs only); rows here carry the agent's reading.
create table if not exists doc_agent_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references doc_agent_requests(id) on delete cascade,
  document_id uuid references documents(id),         -- vault reuse across requests
  role text not null default 'unknown' check (role in
    ('source','target_form','supporting','signature_asset','stamp_asset','requirement','unknown')),
  doc_kind text,                            -- cr/aoa/vat/bank/id/passport/license/form/…
  file_name text not null,
  mime text, size_bytes bigint, storage_key text not null,
  pages int,
  language text,                            -- dominant language detected (ar/en/…)
  expiry_status text not null default 'UNKNOWN' check (expiry_status in
    ('VALID','EXPIRING_SOON','EXPIRED','UNKNOWN')),
  expiry_date date,
  field_map jsonb,                          -- for target forms: detected fields/checkboxes/tables
  extracted jsonb,                          -- for sources: raw extraction payload
  analysis_note text,
  created_at timestamptz not null default now()
);
create index if not exists doc_agent_files_req_idx on doc_agent_files(request_id);

-- The unified client data profile: one row per fact, with provenance.
-- Reconciliation rule: newest official source wins; conflicts are surfaced,
-- never auto-resolved; legal declarations enter only as CLIENT_CONFIRMED.
create table if not exists doc_agent_facts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references doc_agent_requests(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,  -- vault-level reuse
  fact_group text not null,                 -- company/people/ownership/banking/addresses/licenses/tax/employment/declarations
  fact_key text not null,                   -- e.g. company.cr_number, people[0].name_en, banking.iban
  value text,
  value_lang text,                          -- keep official names untranslated per language
  source_file_id uuid references doc_agent_files(id) on delete set null,
  source_page int,
  source_document_date date,
  confidence text not null default 'MEDIUM' check (confidence in ('HIGH','MEDIUM','LOW')),
  status text not null default 'INFERRED' check (status in
    ('VERIFIED','CLIENT_CONFIRMED','INFERRED','CONFLICT','MISSING')),
  conflict_with jsonb,                      -- [{value, source_file_id, document_date}] when CONFLICT
  confirmed_via text,                       -- web/portal/whatsapp when CLIENT_CONFIRMED
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists doc_agent_facts_req_idx on doc_agent_facts(request_id);
create index if not exists doc_agent_facts_org_key_idx on doc_agent_facts(organization_id, fact_key);

-- Chat transcript for the request — the same thread whatever the channel,
-- and the consultant dashboard's audit view of every question and answer.
create table if not exists doc_agent_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references doc_agent_requests(id) on delete cascade,
  author text not null check (author in ('client','agent','consultant','system')),
  channel text not null default 'web' check (channel in ('web','portal','whatsapp','consultant')),
  body text not null,
  attachments uuid[],                       -- doc_agent_files ids
  actions jsonb,                            -- structured effects applied (field edits, checkbox sets…)
  created_at timestamptz not null default now()
);
create index if not exists doc_agent_messages_req_idx on doc_agent_messages(request_id, created_at);

-- Generated deliverables: filled forms, ownership charts, the final package.
-- version_no is append-only like document_versions — a REVISION never
-- overwrites what was already delivered.
create table if not exists doc_agent_outputs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references doc_agent_requests(id) on delete cascade,
  source_form_file_id uuid references doc_agent_files(id) on delete set null,
  kind text not null default 'filled_form' check (kind in
    ('filled_form','ownership_chart','package_zip','other')),
  delivery_name text not null,              -- client-facing name from the checklist, never FINAL_v2
  storage_key text not null,
  mime text, size_bytes bigint,
  version_no int not null default 1,
  fill_summary jsonb,                       -- fields filled + their fact ids (blue-data trace)
  qa_status text not null default 'pending' check (qa_status in ('pending','passed','failed','waived')),
  qa_findings jsonb,
  created_at timestamptz not null default now(),
  unique (request_id, delivery_name, version_no)
);
create index if not exists doc_agent_outputs_req_idx on doc_agent_outputs(request_id);

alter table doc_agent_requests enable row level security;
alter table doc_agent_files enable row level security;
alter table doc_agent_facts enable row level security;
alter table doc_agent_messages enable row level security;
alter table doc_agent_outputs enable row level security;
create policy doc_agent_requests_read on doc_agent_requests for select using (organization_id in (select current_org_ids()));
create policy doc_agent_files_read on doc_agent_files for select using (request_id in (select id from doc_agent_requests where organization_id in (select current_org_ids())));
create policy doc_agent_facts_read on doc_agent_facts for select using (organization_id in (select current_org_ids()));
create policy doc_agent_messages_read on doc_agent_messages for select using (request_id in (select id from doc_agent_requests where organization_id in (select current_org_ids())));
create policy doc_agent_outputs_read on doc_agent_outputs for select using (request_id in (select id from doc_agent_requests where organization_id in (select current_org_ids())));
