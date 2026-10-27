begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '51111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'quote-owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '52222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'quote-tech-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '53333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'quote-owner-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, display_name, created_by_user_id) values
  ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Quote Organization A', '51111111-1111-1111-1111-111111111111'),
  ('5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Quote Organization B', '53333333-3333-3333-3333-333333333333');

insert into public.organization_members (
  id, organization_id, user_id, role, status, display_name, joined_at
) values
  ('5a111111-1111-1111-1111-111111111111', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '51111111-1111-1111-1111-111111111111', 'owner', 'active', 'Quote Owner A', now()),
  ('5a222222-2222-2222-2222-222222222222', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '52222222-2222-2222-2222-222222222222', 'technician', 'active', 'Quote Tech A', now()),
  ('5b333333-3333-3333-3333-333333333333', '5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '53333333-3333-3333-3333-333333333333', 'owner', 'active', 'Quote Owner B', now());

insert into public.business_settings (
  organization_id, business_display_name, email, phone, address_line_1,
  suburb, city, postcode, gst_registered, gst_number, default_gst_rate
) values
  ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Snapshot Business A', 'business-a@example.test', '09 500 0001', '10 Business Street', 'Takapuna', 'Auckland', '0622', true, '111-222-333', 15),
  ('5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Snapshot Business B', 'business-b@example.test', '09 500 0002', '20 Other Street', 'Albany', 'Auckland', '0632', true, '444-555-666', 15);

insert into public.customers (
  id, organization_id, first_name, last_name, email, phone, address_line_1,
  suburb, city, postcode
) values
  ('5ca11111-1111-1111-1111-111111111111', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Snapshot', 'Customer A', 'customer-a@example.test', '021 500 0001', '1 Customer Lane', 'Devonport', 'Auckland', '0624'),
  ('5cb22222-2222-2222-2222-222222222222', '5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Snapshot', 'Customer B', 'customer-b@example.test', '021 500 0002', '2 Other Lane', 'Birkenhead', 'Auckland', '0626');

select set_config('request.jwt.claims', json_build_object('sub', '51111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
insert into public.quotes (id, organization_id, customer_id, quote_number, expiry_date, created_by_member_id)
values ('5e111111-1111-1111-1111-111111111111', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5ca11111-1111-1111-1111-111111111111', 'ignored', current_date + 30, '5a111111-1111-1111-1111-111111111111');
insert into public.quote_items (organization_id, quote_id, description, quantity, unit_price_cents, tax_rate, position)
values ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e111111-1111-1111-1111-111111111111', 'Snapshot service', 1, 10000, 15, 0);

select set_config('request.jwt.claims', json_build_object('sub', '53333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);
insert into public.quotes (id, organization_id, customer_id, quote_number, expiry_date, created_by_member_id)
values ('5e222222-2222-2222-2222-222222222222', '5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '5cb22222-2222-2222-2222-222222222222', 'ignored', current_date + 30, '5b333333-3333-3333-3333-333333333333');
insert into public.quote_items (organization_id, quote_id, description, quantity, unit_price_cents, tax_rate, position)
values ('5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '5e222222-2222-2222-2222-222222222222', 'Other tenant service', 1, 20000, 15, 0);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '51111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
select lives_ok($$ select public.issue_quote('5e111111-1111-1111-1111-111111111111') $$, 'Owner can issue the organization quote');
select is((select customer_name_snapshot from public.quotes where id = '5e111111-1111-1111-1111-111111111111'), 'Snapshot Customer A', 'Issuance captures the customer name');
select is((select business_name_snapshot from public.quotes where id = '5e111111-1111-1111-1111-111111111111'), 'Snapshot Business A', 'Issuance captures the business name');
select is((select business_gst_number_snapshot from public.quotes where id = '5e111111-1111-1111-1111-111111111111'), '111-222-333', 'Issuance captures GST registration details');
select is((select total_cents from public.quotes where id = '5e111111-1111-1111-1111-111111111111'), 11500::bigint, 'Issuance leaves trusted financial totals unchanged');

reset role;
update public.customers set first_name = 'Changed', address_line_1 = '99 Changed Street' where id = '5ca11111-1111-1111-1111-111111111111';
update public.business_settings set business_display_name = 'Changed Business', address_line_1 = '88 Changed Road' where organization_id = '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '51111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
select is((select customer_name_snapshot from public.quotes where id = '5e111111-1111-1111-1111-111111111111'), 'Snapshot Customer A', 'Customer edits do not alter the issued snapshot');
select is((select business_name_snapshot from public.quotes where id = '5e111111-1111-1111-1111-111111111111'), 'Snapshot Business A', 'Business edits do not alter the issued snapshot');

reset role;
select throws_ok(
  $$ update public.quotes set customer_name_snapshot = 'Tampered' where id = '5e111111-1111-1111-1111-111111111111' $$,
  '42501', 'Issued quote content is immutable', 'Issued snapshot values cannot be modified'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '51111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ select public.issue_quote('5e222222-2222-2222-2222-222222222222') $$,
  '42501', 'Operational role required', 'Cross-organization quote issuance is rejected'
);
select throws_ok(
  $$ select * from public.get_quote_document_business('5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501', 'Operational role required', 'Cross-organization draft business access is rejected'
);
select is(
  (select count(*)::integer from public.quotes where organization_id = '5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'Cross-organization quote snapshots are hidden by RLS'
);

select set_config('request.jwt.claims', json_build_object('sub', '52222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
select is((select count(*)::integer from public.quotes), 0, 'Technician quote visibility remains denied');
select throws_ok(
  $$ select public.issue_quote('5e222222-2222-2222-2222-222222222222') $$,
  '42501', 'Operational role required', 'Technician cannot issue a quote'
);
select throws_ok(
  $$ select * from public.get_quote_document_business('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', 'Operational role required', 'Technician cannot read draft business details'
);

select * from finish();
rollback;
