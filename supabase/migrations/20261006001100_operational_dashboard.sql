create or replace function public.get_operational_dashboard_summary(p_organization_id uuid)
returns table(
  timezone text,
  currency text,
  organization_today date,
  open_enquiries bigint,
  active_jobs bigint,
  quotes_awaiting_decision bigint,
  outstanding_invoice_count bigint,
  outstanding_cents bigint,
  overdue_invoice_count bigint,
  overdue_cents bigint,
  paid_this_month_cents bigint,
  urgent_open_enquiries bigint,
  unscheduled_jobs bigint,
  unassigned_scheduled_jobs bigint,
  enquiry_new bigint,
  enquiry_reviewing bigint,
  quote_draft bigint,
  quote_sent bigint,
  quote_accepted bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.business_settings%rowtype;
  v_today date;
  v_month_start date;
  v_month_end date;
begin
  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Dashboard access denied' using errcode = '42501';
  end if;

  select * into strict v_settings
  from public.business_settings
  where organization_id = p_organization_id;

  v_today := (now() at time zone v_settings.timezone)::date;
  v_month_start := date_trunc('month', v_today::timestamp)::date;
  v_month_end := (v_month_start + interval '1 month')::date;

  return query
  with payment_totals as (
    select p.invoice_id, sum(p.amount_cents)::bigint as paid_cents
    from public.payments p
    where p.organization_id = p_organization_id
      and p.voided_at is null
    group by p.invoice_id
  ), collectible as (
    select i.due_date, greatest(i.total_cents - coalesce(pt.paid_cents, 0), 0)::bigint as balance_cents
    from public.invoices i
    left join payment_totals pt on pt.invoice_id = i.id
    where i.organization_id = p_organization_id
      and i.status = 'sent'
  )
  select
    v_settings.timezone::text,
    v_settings.currency::text,
    v_today,
    (select count(*) from public.enquiries e where e.organization_id = p_organization_id and e.status in ('new', 'reviewing')),
    (select count(*) from public.jobs j where j.organization_id = p_organization_id and j.status in ('unscheduled', 'scheduled', 'in_progress')),
    (select count(*) from public.quotes q where q.organization_id = p_organization_id and q.status = 'sent'),
    (select count(*) from collectible c where c.balance_cents > 0),
    coalesce((select sum(c.balance_cents) from collectible c where c.balance_cents > 0), 0)::bigint,
    (select count(*) from collectible c where c.balance_cents > 0 and c.due_date < v_today),
    coalesce((select sum(c.balance_cents) from collectible c where c.balance_cents > 0 and c.due_date < v_today), 0)::bigint,
    coalesce((select sum(p.amount_cents) from public.payments p where p.organization_id = p_organization_id and p.voided_at is null and p.paid_on >= v_month_start and p.paid_on < v_month_end), 0)::bigint,
    (select count(*) from public.enquiries e where e.organization_id = p_organization_id and e.status in ('new', 'reviewing') and e.priority in ('high', 'urgent')),
    (select count(*) from public.jobs j where j.organization_id = p_organization_id and j.status = 'unscheduled'),
    (select count(*) from public.jobs j where j.organization_id = p_organization_id and j.status = 'scheduled' and not exists (select 1 from public.job_assignments a where a.job_id = j.id and a.unassigned_at is null)),
    (select count(*) from public.enquiries e where e.organization_id = p_organization_id and e.status = 'new'),
    (select count(*) from public.enquiries e where e.organization_id = p_organization_id and e.status = 'reviewing'),
    (select count(*) from public.quotes q where q.organization_id = p_organization_id and q.status = 'draft'),
    (select count(*) from public.quotes q where q.organization_id = p_organization_id and q.status = 'sent'),
    (select count(*) from public.quotes q where q.organization_id = p_organization_id and q.status = 'accepted');
end;
$$;

revoke all on function public.get_operational_dashboard_summary(uuid) from public, anon;
grant execute on function public.get_operational_dashboard_summary(uuid) to authenticated;
