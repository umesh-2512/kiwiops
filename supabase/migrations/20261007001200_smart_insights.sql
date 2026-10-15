-- Milestone 11: deterministic, aggregate Smart Insights for office users.

create or replace function public.get_smart_insights(p_organization_id uuid)
returns table(
  timezone text,
  organization_today date,
  currency text,
  overdue_invoice_count bigint,
  overdue_cents bigint,
  oldest_overdue_due_date date,
  urgent_open_enquiries bigint,
  aged_high_open_enquiries bigint,
  oldest_high_enquiry_date date,
  unscheduled_jobs bigint,
  oldest_unscheduled_job_date date,
  unassigned_scheduled_jobs bigint,
  oldest_unassigned_schedule_date date,
  uninvoiced_completed_jobs bigint,
  oldest_uninvoiced_completion_date date,
  aged_sent_quotes bigint,
  oldest_sent_quote_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_settings public.business_settings%rowtype;
  v_today date;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Smart Insights access denied' using errcode = '42501';
  end if;

  select * into strict v_settings
  from public.business_settings
  where organization_id = p_organization_id;

  v_today := (now() at time zone v_settings.timezone)::date;

  return query
  with payment_totals as (
    select p.invoice_id, sum(p.amount_cents)::bigint as paid_cents
    from public.payments p
    where p.organization_id = p_organization_id
      and p.voided_at is null
    group by p.invoice_id
  ), overdue_invoices as (
    select
      i.due_date,
      greatest(i.total_cents - coalesce(pt.paid_cents, 0), 0)::bigint as balance_cents
    from public.invoices i
    left join payment_totals pt on pt.invoice_id = i.id
    where i.organization_id = p_organization_id
      and i.status = 'sent'
      and i.due_date < v_today
  ), urgent_enquiries as (
    select e.id
    from public.enquiries e
    where e.organization_id = p_organization_id
      and e.status in ('new', 'reviewing')
      and e.priority = 'urgent'
  ), aged_high_enquiries as (
    select (e.created_at at time zone v_settings.timezone)::date as created_date
    from public.enquiries e
    where e.organization_id = p_organization_id
      and e.status in ('new', 'reviewing')
      and e.priority = 'high'
      and (e.created_at at time zone v_settings.timezone)::date <= v_today - 1
  ), unscheduled as (
    select (j.created_at at time zone v_settings.timezone)::date as created_date
    from public.jobs j
    where j.organization_id = p_organization_id
      and j.status = 'unscheduled'
  ), unassigned_scheduled as (
    select (j.scheduled_start_at at time zone v_settings.timezone)::date as schedule_date
    from public.jobs j
    where j.organization_id = p_organization_id
      and j.status = 'scheduled'
      and not exists (
        select 1
        from public.job_assignments a
        where a.organization_id = p_organization_id
          and a.job_id = j.id
          and a.unassigned_at is null
      )
  ), uninvoiced_completed as (
    select (j.completed_at at time zone v_settings.timezone)::date as completion_date
    from public.jobs j
    where j.organization_id = p_organization_id
      and j.status = 'completed'
      and not exists (
        select 1
        from public.invoices i
        where i.organization_id = p_organization_id
          and i.job_id = j.id
      )
  ), aged_quotes as (
    select (q.sent_at at time zone v_settings.timezone)::date as sent_date
    from public.quotes q
    where q.organization_id = p_organization_id
      and q.status = 'sent'
      and q.sent_at is not null
      and (q.sent_at at time zone v_settings.timezone)::date <= v_today - 7
  )
  select
    v_settings.timezone::text,
    v_today,
    v_settings.currency::text,
    (select count(*) from overdue_invoices o where o.balance_cents > 0),
    coalesce((select sum(o.balance_cents) from overdue_invoices o where o.balance_cents > 0), 0)::bigint,
    (select min(o.due_date) from overdue_invoices o where o.balance_cents > 0),
    (select count(*) from urgent_enquiries),
    (select count(*) from aged_high_enquiries),
    (select min(h.created_date) from aged_high_enquiries h),
    (select count(*) from unscheduled),
    (select min(u.created_date) from unscheduled u),
    (select count(*) from unassigned_scheduled),
    (select min(u.schedule_date) from unassigned_scheduled u),
    (select count(*) from uninvoiced_completed),
    (select min(c.completion_date) from uninvoiced_completed c),
    (select count(*) from aged_quotes),
    (select min(q.sent_date) from aged_quotes q);
end;
$$;

revoke all on function public.get_smart_insights(uuid) from public, anon;
grant execute on function public.get_smart_insights(uuid) to authenticated;

comment on function public.get_smart_insights(uuid) is
  'Returns deterministic organization-scoped Smart Insight aggregates to active owner/admin members.';
