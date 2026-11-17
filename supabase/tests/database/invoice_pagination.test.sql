begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(25);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '71111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'invoice-owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '72222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'invoice-tech-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '73333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'invoice-owner-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, display_name, created_by_user_id) values
  ('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Invoice Organization A', '71111111-1111-1111-1111-111111111111'),
  ('7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Invoice Organization B', '73333333-3333-3333-3333-333333333333');

insert into public.organization_members (id, organization_id, user_id, role, status, display_name, joined_at) values
  ('7a111111-1111-1111-1111-111111111111', '7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '71111111-1111-1111-1111-111111111111', 'owner', 'active', 'Invoice Owner A', now()),
  ('7a222222-2222-2222-2222-222222222222', '7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '72222222-2222-2222-2222-222222222222', 'technician', 'active', 'Invoice Tech A', now()),
  ('7b333333-3333-3333-3333-333333333333', '7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '73333333-3333-3333-3333-333333333333', 'owner', 'active', 'Invoice Owner B', now());

insert into public.business_settings (organization_id, business_display_name, timezone) values
  ('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Invoice Organization A', 'Pacific/Auckland'),
  ('7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Invoice Organization B', 'Pacific/Auckland');

insert into public.customers (id, organization_id, first_name, last_name, email) values
  ('7ca11111-1111-1111-1111-111111111111', '7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pagination', 'Customer', 'pagination@example.test'),
  ('7cb22222-2222-2222-2222-222222222222', '7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Other', 'Tenant', 'other-invoice@example.test');

select set_config('request.jwt.claims', json_build_object('sub', '71111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

insert into public.invoices (
  id, organization_id, customer_id, invoice_number, due_date, created_by_member_id, created_at
)
select
  md5('invoice-page-a-' || value)::uuid,
  '7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '7ca11111-1111-1111-1111-111111111111',
  'ignored',
  current_date + 14,
  '7a111111-1111-1111-1111-111111111111',
  '2026-01-01 00:00:00+00'::timestamptz + value * interval '1 second'
from generate_series(1, 526) as value;

update public.invoices
set status = 'sent',
    issue_date = current_date - 30,
    due_date = case when id = md5('invoice-page-a-4')::uuid then current_date - 1 else current_date + 10 end,
    subtotal_cents = 10000,
    tax_cents = 0,
    total_cents = 10000,
    customer_name_snapshot = 'Pagination Customer',
    business_name_snapshot = 'Invoice Organization A',
    business_gst_registered_snapshot = false,
    tax_rate_snapshot = 0
where id in (
  md5('invoice-page-a-1')::uuid,
  md5('invoice-page-a-2')::uuid,
  md5('invoice-page-a-3')::uuid,
  md5('invoice-page-a-4')::uuid
);

update public.invoices
set status = 'cancelled'
where id = md5('invoice-page-a-5')::uuid;

insert into public.payments (
  organization_id, invoice_id, amount_cents, currency, paid_on, method,
  recorded_by_member_id, voided_at, voided_by_member_id
) values
  ('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', md5('invoice-page-a-2')::uuid, 3000, 'NZD', current_date, 'bank_transfer', '7a111111-1111-1111-1111-111111111111', null, null),
  ('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', md5('invoice-page-a-2')::uuid, 999, 'NZD', current_date, 'cash', '7a111111-1111-1111-1111-111111111111', now(), '7a111111-1111-1111-1111-111111111111'),
  ('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', md5('invoice-page-a-3')::uuid, 10000, 'NZD', current_date, 'card', '7a111111-1111-1111-1111-111111111111', null, null);

update public.invoices set status = 'paid' where id = md5('invoice-page-a-3')::uuid;

select set_config('request.jwt.claims', json_build_object('sub', '73333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);
insert into public.invoices (id, organization_id, customer_id, invoice_number, due_date, created_by_member_id)
values (md5('invoice-page-b-1')::uuid, '7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7cb22222-2222-2222-2222-222222222222', 'ignored', current_date + 14, '7b333333-3333-3333-3333-333333333333');

select ok(not has_function_privilege('anon', 'public.list_invoices(uuid,integer,integer,text,text)', 'EXECUTE'), 'Anon cannot execute invoice listing');
select ok(has_function_privilege('authenticated', 'public.list_invoices(uuid,integer,integer,text,text)', 'EXECUTE'), 'Authenticated users can execute the controlled invoice listing');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '71111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 526::bigint, 'Exact count includes more than 500 invoices');
select is((select jsonb_array_length(invoice_rows) from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 25, 'Default page contains 25 invoices');
select is((select jsonb_array_length(invoice_rows) from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 22, 25)), 1, 'Final page contains the remaining invoice');
select is(
  (select (invoice_rows->0->>'id')::uuid from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  (select id from public.invoices where organization_id = '7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' order by created_at desc, id desc limit 1),
  'Ordering is deterministic by created timestamp and unique ID'
);
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 999, 25)), 526::bigint, 'Out-of-range pages retain the exact count');
select is((select jsonb_array_length(invoice_rows) from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 999, 25)), 0, 'Out-of-range pages return no rows');
select is(
  (select total_count from public.list_invoices(
    '7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25,
    (select invoice_number from public.invoices where id = md5('invoice-page-a-20')::uuid), 'all'
  )),
  1::bigint,
  'Invoice-number search applies to the full organization dataset'
);
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, 'Pagination Customer', 'all')), 526::bigint, 'Customer search applies to the full organization dataset');
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'draft')), 521::bigint, 'Draft filtering is server-side');
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'unpaid')), 1::bigint, 'Unpaid filtering is server-side');
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'partial')), 1::bigint, 'Partial-payment filtering is server-side');
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'paid')), 1::bigint, 'Paid filtering is server-side');
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'overdue')), 1::bigint, 'Overdue filtering uses the organization-local date');
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'void')), 1::bigint, 'Void filtering is server-side');
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, 'Pagination Customer', 'partial')), 1::bigint, 'Search and payment-state filters combine');
select is((select total_count from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, 'not-present', 'all')), 0::bigint, 'Empty search results return a zero count');
select is(
  (select (invoice_rows->0->>'total_cents')::bigint from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'partial')),
  10000::bigint,
  'Trusted invoice total remains unchanged'
);
select is(
  (select (invoice_rows->0->>'paid_cents')::bigint from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'partial')),
  3000::bigint,
  'Only active payments contribute to the paid amount'
);
select is(
  (select (invoice_rows->0->>'balance_cents')::bigint from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'partial')),
  7000::bigint,
  'Trusted balance remains total minus active payments'
);
select throws_ok(
  $$ select * from public.list_invoices('7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501', 'Invoice access denied', 'Cross-organization invoice listing is rejected'
);
select throws_ok(
  $$ select * from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 25, null, 'invalid') $$,
  '22023', 'Invalid invoice filter', 'Invalid filters are rejected by the database'
);
select throws_ok(
  $$ select * from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 101) $$,
  '22023', 'Invalid invoice page size', 'Oversized pages are rejected by the database'
);

select set_config('request.jwt.claims', json_build_object('sub', '72222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ select * from public.list_invoices('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', 'Invoice access denied', 'Technicians cannot list invoices'
);

select * from finish();
rollback;
