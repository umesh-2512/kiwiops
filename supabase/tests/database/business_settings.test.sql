begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(33);

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','71111111-1111-1111-1111-111111111111','authenticated','authenticated','settings-owner@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','72222222-2222-2222-2222-222222222222','authenticated','authenticated','settings-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','73333333-3333-3333-3333-333333333333','authenticated','authenticated','settings-tech@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','74444444-4444-4444-4444-444444444444','authenticated','authenticated','settings-owner-b@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','75555555-5555-5555-5555-555555555555','authenticated','authenticated','new-gst@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','76666666-6666-6666-6666-666666666666','authenticated','authenticated','new-no-gst@example.test','',now(),'{}','{}',now(),now());

insert into public.organizations(id,display_name,legal_name,created_by_user_id) values
('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Settings A','Settings A Limited','71111111-1111-1111-1111-111111111111'),
('7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Settings B','Settings B Limited','74444444-4444-4444-4444-444444444444');
insert into public.organization_members(id,organization_id,user_id,role,status,display_name,joined_at) values
('7a111111-1111-1111-1111-111111111111','7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','71111111-1111-1111-1111-111111111111','owner','active','Owner A',now()),
('7a222222-2222-2222-2222-222222222222','7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','72222222-2222-2222-2222-222222222222','admin','active','Admin A',now()),
('7a333333-3333-3333-3333-333333333333','7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','73333333-3333-3333-3333-333333333333','technician','active','Tech A',now()),
('7b444444-4444-4444-4444-444444444444','7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','74444444-4444-4444-4444-444444444444','owner','active','Owner B',now());
insert into public.business_settings(organization_id,business_display_name,email,address_line_1,city,postcode,gst_registered,gst_number,updated_by_member_id) values
('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Settings A','accounts@example.test','1 Queen Street','Auckland','1010',true,'049091850','7a111111-1111-1111-1111-111111111111'),
('7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Settings B','accounts-b@example.test','2 Queen Street','Auckland','1010',true,'049091850','7b444444-4444-4444-4444-444444444444');
insert into public.customers(id,organization_id,first_name,last_name) values
('7c111111-1111-1111-1111-111111111111','7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Test','Customer');
select set_config('request.jwt.claims',json_build_object('sub','71111111-1111-1111-1111-111111111111','role','authenticated')::text,true);
insert into public.quotes(id,organization_id,customer_id,quote_number,expiry_date,created_by_member_id) values
('7e111111-1111-1111-1111-111111111111','7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','7c111111-1111-1111-1111-111111111111','ignored',current_date+30,'7a111111-1111-1111-1111-111111111111');
insert into public.quote_items(organization_id,quote_id,description,quantity,unit_price_cents,tax_rate,position) values
('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','7e111111-1111-1111-1111-111111111111','Service',1,10000,15,0);
insert into public.invoices(id,organization_id,customer_id,invoice_number,due_date,created_by_member_id) values
('7d111111-1111-1111-1111-111111111111','7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','7c111111-1111-1111-1111-111111111111','ignored',current_date+14,'7a111111-1111-1111-1111-111111111111');
insert into public.invoice_items(organization_id,invoice_id,description,quantity,unit_price_cents,tax_rate,position) values
('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','7d111111-1111-1111-1111-111111111111','Service',1,10000,15,0);

set local role authenticated;
select throws_ok($$select public.issue_quote('7e111111-1111-1111-1111-111111111111')$$,'23514','Complete Business Settings before issuing financial documents','Unconfirmed existing settings block issuance');
select throws_ok($$select public.issue_invoice('7d111111-1111-1111-1111-111111111111',(select updated_at from public.invoices where id='7d111111-1111-1111-1111-111111111111'))$$,'23514','Complete Business Settings before issuing financial documents','Unconfirmed existing settings block invoice issuance');
select is(has_function_privilege('authenticated','public.set_quote_status(uuid,text)','execute'),false,'Legacy quote status RPC cannot bypass controlled issuance');
select is(has_function_privilege('authenticated','public.set_invoice_status(uuid,text)','execute'),false,'Legacy invoice status RPC cannot bypass controlled issuance');
select is((select financial_ready from public.get_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),false,'Existing organization is not silently confirmed');

select lives_ok($$select public.update_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select updated_at from public.business_settings where organization_id='7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),'Settings A Limited','Settings A','accounts@example.test','09 555 0100','1 Queen Street',null,null,'Auckland','1010',null,true,'49-091-850','NZD','Pacific/Auckland',14)$$,'Owner can confirm business settings');
select is((select financial_ready from public.get_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),true,'Complete confirmed settings are financially ready');
select is((select gst_number from public.business_settings where organization_id='7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),'049091850','GST number is normalized');
select lives_ok($$select public.issue_quote('7e111111-1111-1111-1111-111111111111')$$,'Confirmed owner can issue a matching draft');
select is((select business_gst_registered_snapshot from public.quotes where id='7e111111-1111-1111-1111-111111111111'),true,'Issued quote captures confirmed GST status');
select lives_ok($$select public.issue_invoice('7d111111-1111-1111-1111-111111111111',(select updated_at from public.invoices where id='7d111111-1111-1111-1111-111111111111'))$$,'Confirmed owner can issue a matching invoice draft');
select is((select business_gst_registered_snapshot from public.invoices where id='7d111111-1111-1111-1111-111111111111'),true,'Issued invoice captures confirmed GST status');

create temporary table stale_draft(id uuid);
insert into stale_draft select public.create_quote('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','7c111111-1111-1111-1111-111111111111',null,current_date+30,null,null,'[{"description":"Service","quantity":1,"unit_price_cents":10000}]'::jsonb);
select lives_ok($$select public.update_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select updated_at from public.business_settings where organization_id='7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),'Settings A Limited','Settings A','accounts@example.test','09 555 0100','1 Queen Street',null,null,'Auckland','1010',null,false,null,'NZD','Pacific/Auckland',14)$$,'Owner can change to non-GST registration');
select throws_ok($$select public.issue_quote((select id from stale_draft))$$,'23514','GST settings changed. Review and save this draft before issuing it','Stale draft tax configuration blocks issuance');
select lives_ok($$select public.update_draft_quote((select id from stale_draft),'7c111111-1111-1111-1111-111111111111',null,current_date+30,null,null,'[{"description":"Service","quantity":1,"unit_price_cents":10000}]'::jsonb,(select updated_at from public.quotes where id=(select id from stale_draft)))$$,'Saving a stale draft applies the current tax configuration');
select is((select tax_rate from public.quote_items where quote_id=(select id from stale_draft)),0.0000::numeric,'Non-GST draft uses zero tax');
select lives_ok($$select public.issue_quote((select id from stale_draft))$$,'Reviewed non-GST draft can be issued');
select is((select business_gst_registered_snapshot from public.quotes where id=(select id from stale_draft)),false,'Issued non-GST quote captures non-registered status');
select is((select business_gst_registered_snapshot from public.quotes where id='7e111111-1111-1111-1111-111111111111'),true,'Earlier issued quote keeps its historical GST snapshot');
select is((select business_gst_registered_snapshot from public.invoices where id='7d111111-1111-1111-1111-111111111111'),true,'Earlier issued invoice keeps its historical GST snapshot');
select ok((select count(*) >= 2 from public.activity_logs where organization_id='7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action='business_settings.updated'),'Settings changes are recorded in the activity log');

select set_config('request.jwt.claims',json_build_object('sub','72222222-2222-2222-2222-222222222222','role','authenticated')::text,true);
select is((select count(*)::integer from public.get_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),1,'Admin can read organization settings');
select throws_ok($$select public.update_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select updated_at from public.business_settings where organization_id='7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),'Settings A Limited','Settings A','accounts@example.test',null,'1 Queen Street',null,null,'Auckland','1010',null,true,'049091850','NZD','Pacific/Auckland',14)$$,'42501','Owner role required','Admin cannot update settings');

select set_config('request.jwt.claims',json_build_object('sub','73333333-3333-3333-3333-333333333333','role','authenticated')::text,true);
select throws_ok($$select * from public.get_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,'42501','Business settings access denied','Technician cannot read business settings');
select throws_ok($$select public.update_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',now(),'Settings A Limited','Settings A','accounts@example.test',null,'1 Queen Street',null,null,'Auckland','1010',null,false,null,'NZD','Pacific/Auckland',14)$$,'42501','Owner role required','Technician cannot update settings');

select set_config('request.jwt.claims',json_build_object('sub','71111111-1111-1111-1111-111111111111','role','authenticated')::text,true);
select throws_ok($$select * from public.get_business_settings('7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,'42501','Business settings access denied','Cross-organization settings access is denied');
select throws_ok($$update public.business_settings set city='Wellington' where organization_id='7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,'42501','permission denied for table business_settings','Direct authenticated settings updates are revoked');

select set_config('request.jwt.claims',json_build_object('sub','75555555-5555-5555-5555-555555555555','role','authenticated')::text,true);
create temporary table created_gst_org(id uuid);
insert into created_gst_org select public.create_organization('New GST Business','New GST Owner','New GST Business Limited',null,true,'49-091-850');
select is((select gst_registered from public.business_settings where organization_id=(select id from created_gst_org)),true,'GST-registered organization creation records explicit status');
select ok((select gst_settings_confirmed_at is not null from public.business_settings where organization_id=(select id from created_gst_org)),'GST-registered organization creation records confirmation');

select set_config('request.jwt.claims',json_build_object('sub','76666666-6666-6666-6666-666666666666','role','authenticated')::text,true);
create temporary table created_no_gst_org(id uuid);
insert into created_no_gst_org select public.create_organization('No GST Business','No GST Owner','No GST Business Limited',null,false,null);
select is((select gst_registered from public.business_settings where organization_id=(select id from created_no_gst_org)),false,'Non-GST organization creation records explicit status');
select is((select gst_number from public.business_settings where organization_id=(select id from created_no_gst_org)),null,'Non-GST organization stores no GST number');

select set_config('request.jwt.claims',json_build_object('sub','71111111-1111-1111-1111-111111111111','role','authenticated')::text,true);
select throws_ok($$select public.update_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select updated_at from public.business_settings where organization_id='7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),'Settings A Limited','Settings A','accounts@example.test',null,'1 Queen Street',null,null,'Auckland','1010',null,true,'123456789','NZD','Pacific/Auckland',14)$$,'22023','Enter a valid New Zealand GST number','Invalid GST number is rejected');
select throws_ok($$select public.update_business_settings('7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select updated_at from public.business_settings where organization_id='7aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),'Settings A Limited','Settings A','accounts@example.test',null,'1 Queen Street',null,null,'Auckland','1010',null,false,null,'NZD','Invalid/Timezone',14)$$,'22023','Select a valid IANA timezone','Invalid timezone is rejected');

select * from finish();
rollback;
