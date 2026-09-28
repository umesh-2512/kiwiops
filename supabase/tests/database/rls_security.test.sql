begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

-- Fixed identities keep the security scenarios readable.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'admin-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'tech-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, display_name, created_by_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Organization A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Organization B', '44444444-4444-4444-4444-444444444444');

insert into public.organization_members (
  id, organization_id, user_id, role, status, display_name, joined_at
) values
  ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active', 'Owner A', now()),
  ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin', 'active', 'Admin A', now()),
  ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'technician', 'active', 'Tech A', now()),
  ('b4444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'owner', 'active', 'Owner B', now());

insert into public.business_settings (organization_id, business_display_name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Organization A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Organization B');

insert into public.customers (
  id, organization_id, first_name, last_name, email, phone, notes
) values
  ('ca111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Assigned', 'Customer', 'assigned@example.test', '0210000001', 'Office-only A note'),
  ('cb222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Other', 'Tenant', 'other@example.test', '0210000002', 'Office-only B note');

-- Seed operational records as Owner A so the normal system-field triggers run.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);

insert into public.quotes (
  id, organization_id, customer_id, quote_number, expiry_date, created_by_member_id
) values (
  'e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ca111111-1111-1111-1111-111111111111', 'ignored', current_date + 30,
  'a1111111-1111-1111-1111-111111111111'
);

insert into public.jobs (
  id, organization_id, customer_id, job_number, job_type, description,
  scheduled_start_at, address_line_1, city, created_by_member_id
) values (
  'f1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ca111111-1111-1111-1111-111111111111', 'ignored', 'Pool service',
  'Routine pool service', now() + interval '1 day', '1 Test Street', 'Auckland',
  'a1111111-1111-1111-1111-111111111111'
);

insert into public.job_assignments (
  id, organization_id, job_id, member_id, assigned_by_member_id
) values (
  'aa111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'f1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333',
  'a1111111-1111-1111-1111-111111111111'
);

insert into public.invoices (
  id, organization_id, customer_id, invoice_number, due_date, created_by_member_id
) values (
  'd1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ca111111-1111-1111-1111-111111111111', 'ignored', current_date + 14,
  'a1111111-1111-1111-1111-111111111111'
);

set local role authenticated;

-- Organization A owner cannot read Organization B customer rows.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
select is(
  (select count(*)::integer from public.customers where organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'Organization A cannot read Organization B customers'
);

-- Composite ownership prevents an Organization A quote from using Organization B's customer.
select throws_ok(
  $$
    insert into public.quotes (
      organization_id, customer_id, expiry_date
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'cb222222-2222-2222-2222-222222222222',
      current_date + 30
    )
  $$,
  '23503',
  null,
  'Cross-organization quote customer reference is rejected'
);

-- Technician receives no direct customer, quote, or invoice rows.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true
);
select is((select count(*)::integer from public.customers), 0, 'Technician cannot read the customers table');
select is((select count(*)::integer from public.quotes), 0, 'Technician cannot read quotes');
select is((select count(*)::integer from public.invoices), 0, 'Technician cannot read invoices');

select is(
  (select contact.first_name from public.get_assigned_job_contact('f1111111-1111-1111-1111-111111111111') as contact),
  'Assigned',
  'Technician can retrieve limited contact data for an assigned job'
);

select throws_ok(
  $$ select public.set_member_role('a3333333-3333-3333-3333-333333333333', 'owner') $$,
  '42501',
  'Owner role required',
  'Technician cannot elevate their role'
);

select throws_ok(
  $$
    insert into public.job_assignments (organization_id, job_id, member_id)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'f1111111-1111-1111-1111-111111111111',
      'a3333333-3333-3333-3333-333333333333'
    )
  $$,
  '42501',
  null,
  'Technician cannot assign themselves to a job'
);

-- Admin cannot promote themselves to owner.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true
);
select throws_ok(
  $$ select public.set_member_role('a2222222-2222-2222-2222-222222222222', 'owner') $$,
  '42501',
  'Owner role required',
  'Admin cannot elevate themselves to owner'
);

-- Even an owner cannot change their own role through the owner-only RPC.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
select throws_ok(
  $$ select public.set_member_role('a1111111-1111-1111-1111-111111111111', 'admin') $$,
  '42501',
  'Members cannot change their own role',
  'Owner cannot change their own role'
);

-- A cross-organization assignment is rejected independently of RLS.
select throws_ok(
  $$
    insert into public.job_assignments (organization_id, job_id, member_id)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'f1111111-1111-1111-1111-111111111111',
      'b4444444-4444-4444-4444-444444444444'
    )
  $$,
  '23514',
  'Assignment target must be an active organization member',
  'Cross-organization assignment is rejected'
);

reset role;
select * from finish();
rollback;
