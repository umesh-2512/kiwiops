-- KiwiOps core schema.
-- All tenant-owned relationships carry organization_id and use composite foreign keys.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (btrim(first_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  legal_name text,
  slug text unique check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_archive_state_check check (
    (status = 'closed' and archived_at is not null)
    or (status <> 'closed' and archived_at is null)
  )
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('owner', 'admin', 'technician')),
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  display_name text not null check (btrim(display_name) <> ''),
  job_title text,
  joined_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, user_id),
  constraint organization_members_status_dates_check check (
    (status = 'active' and joined_at is not null and removed_at is null)
    or (status = 'suspended' and joined_at is not null and removed_at is null)
    or (status = 'removed' and removed_at is not null)
  )
);

create table public.business_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  business_display_name text not null check (btrim(business_display_name) <> ''),
  phone text,
  email text,
  nzbn text,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text,
  postcode text,
  gst_registered boolean not null default true,
  gst_number text,
  default_gst_rate numeric(7,4) not null default 15.0000 check (default_gst_rate between 0 and 100),
  invoice_payment_terms_days integer not null default 14 check (invoice_payment_terms_days between 0 and 365),
  quote_validity_days integer not null default 30 check (quote_validity_days between 1 and 365),
  timezone text not null default 'Pacific/Auckland' check (btrim(timezone) <> ''),
  currency char(3) not null default 'NZD' check (currency = upper(currency)),
  updated_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_settings_updated_by_fk
    foreign key (organization_id, updated_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict
);

create table public.document_sequences (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_type text not null check (document_type in ('quote', 'job', 'invoice')),
  calendar_year integer not null check (calendar_year between 2000 and 9999),
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, document_type, calendar_year)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  first_name text not null check (btrim(first_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  email text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text,
  postcode text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint customers_archive_state_check check (
    (status = 'archived' and archived_at is not null)
    or (status = 'active' and archived_at is null)
  )
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  source text not null check (source in ('phone', 'email', 'website', 'walk_in', 'referral', 'other')),
  description text not null check (btrim(description) <> ''),
  category text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'quoted', 'converted', 'closed')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint enquiries_customer_fk
    foreign key (organization_id, customer_id)
    references public.customers(organization_id, id)
    on delete restrict,
  constraint enquiries_contact_check check (
    customer_id is not null
    or nullif(btrim(contact_name), '') is not null
    or nullif(btrim(contact_email), '') is not null
    or nullif(btrim(contact_phone), '') is not null
  ),
  constraint enquiries_closed_state_check check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  )
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  enquiry_id uuid,
  quote_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  issue_date date not null default current_date,
  expiry_date date not null,
  currency char(3) not null default 'NZD' check (currency = upper(currency)),
  notes text,
  terms text,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0 and total_cents = subtotal_cents + tax_cents),
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, quote_number),
  constraint quotes_customer_fk
    foreign key (organization_id, customer_id)
    references public.customers(organization_id, id)
    on delete restrict,
  constraint quotes_enquiry_fk
    foreign key (organization_id, enquiry_id)
    references public.enquiries(organization_id, id)
    on delete restrict,
  constraint quotes_creator_fk
    foreign key (organization_id, created_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint quotes_dates_check check (expiry_date >= issue_date)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  quote_id uuid not null,
  description text not null check (btrim(description) <> ''),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  tax_rate numeric(7,4) not null check (tax_rate between 0 and 100),
  line_subtotal_cents bigint not null default 0 check (line_subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  line_total_cents bigint not null default 0 check (line_total_cents >= 0 and line_total_cents = line_subtotal_cents + tax_cents),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (quote_id, position),
  constraint quote_items_quote_fk
    foreign key (organization_id, quote_id)
    references public.quotes(organization_id, id)
    on delete cascade
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  quote_id uuid,
  job_number text not null,
  job_type text not null check (btrim(job_type) <> ''),
  description text not null check (btrim(description) <> ''),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'unscheduled' check (status in ('unscheduled', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_start_at timestamptz,
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  address_line_1 text not null check (btrim(address_line_1) <> ''),
  address_line_2 text,
  suburb text,
  city text not null check (btrim(city) <> ''),
  postcode text,
  completion_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  completed_by_member_id uuid,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, job_number),
  constraint jobs_customer_fk
    foreign key (organization_id, customer_id)
    references public.customers(organization_id, id)
    on delete restrict,
  constraint jobs_quote_fk
    foreign key (organization_id, quote_id)
    references public.quotes(organization_id, id)
    on delete restrict,
  constraint jobs_completed_by_fk
    foreign key (organization_id, completed_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint jobs_creator_fk
    foreign key (organization_id, created_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint jobs_schedule_check check (status <> 'scheduled' or scheduled_start_at is not null)
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  member_id uuid not null,
  assigned_at timestamptz not null default now(),
  assigned_by_member_id uuid not null,
  unassigned_at timestamptz,
  unassigned_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint job_assignments_job_fk
    foreign key (organization_id, job_id)
    references public.jobs(organization_id, id)
    on delete cascade,
  constraint job_assignments_member_fk
    foreign key (organization_id, member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint job_assignments_assigned_by_fk
    foreign key (organization_id, assigned_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint job_assignments_unassigned_by_fk
    foreign key (organization_id, unassigned_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint job_assignments_unassigned_state_check check (
    (unassigned_at is null and unassigned_by_member_id is null)
    or (unassigned_at is not null and unassigned_by_member_id is not null)
  )
);

create unique index job_assignments_one_active_member_idx
  on public.job_assignments(job_id, member_id)
  where unassigned_at is null;

create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  author_member_id uuid not null,
  content text not null check (btrim(content) <> '' and char_length(content) <= 10000),
  visibility text not null default 'team' check (visibility in ('team', 'office')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint job_notes_job_fk
    foreign key (organization_id, job_id)
    references public.jobs(organization_id, id)
    on delete cascade,
  constraint job_notes_author_fk
    foreign key (organization_id, author_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  job_id uuid,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
  issue_date date not null default current_date,
  due_date date not null,
  currency char(3) not null default 'NZD' check (currency = upper(currency)),
  notes text,
  payment_instructions text,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0 and total_cents = subtotal_cents + tax_cents),
  sent_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, invoice_number),
  constraint invoices_customer_fk
    foreign key (organization_id, customer_id)
    references public.customers(organization_id, id)
    on delete restrict,
  constraint invoices_job_fk
    foreign key (organization_id, job_id)
    references public.jobs(organization_id, id)
    on delete restrict,
  constraint invoices_creator_fk
    foreign key (organization_id, created_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint invoices_dates_check check (due_date >= issue_date)
);

create unique index invoices_one_per_job_idx
  on public.invoices(organization_id, job_id)
  where job_id is not null;

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  description text not null check (btrim(description) <> ''),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  tax_rate numeric(7,4) not null check (tax_rate between 0 and 100),
  line_subtotal_cents bigint not null default 0 check (line_subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  line_total_cents bigint not null default 0 check (line_total_cents >= 0 and line_total_cents = line_subtotal_cents + tax_cents),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (invoice_id, position),
  constraint invoice_items_invoice_fk
    foreign key (organization_id, invoice_id)
    references public.invoices(organization_id, id)
    on delete cascade
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null check (currency = upper(currency)),
  paid_on date not null,
  method text not null check (method in ('bank_transfer', 'cash', 'card', 'cheque', 'other')),
  reference text,
  notes text,
  recorded_by_member_id uuid not null,
  voided_at timestamptz,
  voided_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint payments_invoice_fk
    foreign key (organization_id, invoice_id)
    references public.invoices(organization_id, id)
    on delete restrict,
  constraint payments_recorded_by_fk
    foreign key (organization_id, recorded_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint payments_voided_by_fk
    foreign key (organization_id, voided_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint payments_void_state_check check (
    (voided_at is null and voided_by_member_id is null)
    or (voided_at is not null and voided_by_member_id is not null)
  )
);

create table public.service_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  source_job_id uuid,
  service_type text not null check (btrim(service_type) <> ''),
  due_date date not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'due', 'completed', 'dismissed', 'cancelled')),
  notes text,
  completed_at timestamptz,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint service_reminders_customer_fk
    foreign key (organization_id, customer_id)
    references public.customers(organization_id, id)
    on delete restrict,
  constraint service_reminders_job_fk
    foreign key (organization_id, source_job_id)
    references public.jobs(organization_id, id)
    on delete set null (source_job_id),
  constraint service_reminders_creator_fk
    foreign key (organization_id, created_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  constraint service_reminders_completed_state_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_member_id uuid,
  actor_type text not null check (actor_type in ('member', 'system', 'customer')),
  entity_type text not null check (entity_type in ('organization', 'member', 'customer', 'enquiry', 'quote', 'job', 'invoice', 'payment', 'service_reminder')),
  entity_id uuid not null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  summary text not null check (btrim(summary) <> '' and char_length(summary) <= 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 16384),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint activity_logs_actor_fk
    foreign key (organization_id, actor_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict
);

-- Query-focused indexes. Unique constraints above supply the remaining indexes.
create index organization_members_user_status_idx
  on public.organization_members(user_id, status, organization_id);
create index organization_members_org_role_status_idx
  on public.organization_members(organization_id, role, status);
create index customers_org_status_name_idx
  on public.customers(organization_id, status, last_name, first_name);
create index customers_org_email_idx
  on public.customers(organization_id, lower(email));
create index customers_org_phone_idx
  on public.customers(organization_id, phone);
create index enquiries_org_status_created_idx
  on public.enquiries(organization_id, status, created_at desc);
create index enquiries_org_customer_created_idx
  on public.enquiries(organization_id, customer_id, created_at desc);
create index quotes_org_status_issue_idx
  on public.quotes(organization_id, status, issue_date desc);
create index quotes_org_customer_created_idx
  on public.quotes(organization_id, customer_id, created_at desc);
create index jobs_org_status_schedule_idx
  on public.jobs(organization_id, status, scheduled_start_at);
create index jobs_org_customer_created_idx
  on public.jobs(organization_id, customer_id, created_at desc);
create index job_assignments_member_active_idx
  on public.job_assignments(member_id, unassigned_at, job_id);
create index job_assignments_job_active_idx
  on public.job_assignments(job_id, unassigned_at);
create index job_notes_job_created_idx
  on public.job_notes(job_id, created_at);
create index invoices_org_status_due_idx
  on public.invoices(organization_id, status, due_date);
create index invoices_org_customer_created_idx
  on public.invoices(organization_id, customer_id, created_at desc);
create index payments_invoice_paid_idx
  on public.payments(invoice_id, paid_on);
create index service_reminders_org_status_due_idx
  on public.service_reminders(organization_id, status, due_date);
create index activity_logs_org_created_idx
  on public.activity_logs(organization_id, created_at desc);
create index activity_logs_entity_idx
  on public.activity_logs(organization_id, entity_type, entity_id, created_at);

-- Maintain updated_at consistently.
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger organization_members_set_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();
create trigger business_settings_set_updated_at before update on public.business_settings
  for each row execute function private.set_updated_at();
create trigger document_sequences_set_updated_at before update on public.document_sequences
  for each row execute function private.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger enquiries_set_updated_at before update on public.enquiries
  for each row execute function private.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes
  for each row execute function private.set_updated_at();
create trigger quote_items_set_updated_at before update on public.quote_items
  for each row execute function private.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function private.set_updated_at();
create trigger job_assignments_set_updated_at before update on public.job_assignments
  for each row execute function private.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function private.set_updated_at();
create trigger invoice_items_set_updated_at before update on public.invoice_items
  for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();
create trigger service_reminders_set_updated_at before update on public.service_reminders
  for each row execute function private.set_updated_at();

comment on schema private is 'Non-exposed authorization and integrity functions for KiwiOps.';
comment on table public.document_sequences is 'Private, concurrency-safe counters for organization document numbers.';
comment on table public.activity_logs is 'Append-only operational history. Metadata must not contain secrets or full customer records.';
