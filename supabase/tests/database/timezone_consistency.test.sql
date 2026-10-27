begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','61111111-1111-1111-1111-111111111111','authenticated','authenticated','timezone-owner@example.test','',now(),'{}','{}',now(),now());
insert into public.organizations (id,display_name,created_by_user_id)
values ('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Timezone Organization','61111111-1111-1111-1111-111111111111');
insert into public.organization_members (id,organization_id,user_id,role,status,display_name,joined_at)
values ('6a111111-1111-1111-1111-111111111111','6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','61111111-1111-1111-1111-111111111111','owner','active','Timezone Owner',now());
insert into public.business_settings (organization_id,business_display_name,timezone)
values ('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Timezone Organization','Pacific/Auckland');

select is(private.parse_job_schedule('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2026-07-01T09:00'),'2026-06-30 21:00:00+00'::timestamptz,'NZST local time converts to its UTC instant');
select is(private.parse_job_schedule('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2026-01-15T09:00'),'2026-01-14 20:00:00+00'::timestamptz,'NZDT local time converts to its UTC instant');
select throws_ok($$select private.parse_job_schedule('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2026-09-27T02:30')$$,'22007','Scheduled start does not exist in the organization timezone','DST spring-forward gap is rejected');
select throws_ok($$select private.parse_job_schedule('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2026-04-05T02:30')$$,'22007','Scheduled start is ambiguous in the organization timezone','DST fall-back overlap is rejected');
select is(private.parse_job_schedule('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null),null::timestamptz,'Unscheduled jobs remain supported');
select throws_ok($$select private.parse_job_schedule('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2026-01-15 09:00')$$,'22007','Invalid scheduled start','Non-canonical local input is rejected');

select * from finish();
rollback;
