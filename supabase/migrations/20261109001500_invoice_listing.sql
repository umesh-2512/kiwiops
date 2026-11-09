-- Server-side invoice listing with tenant-safe search, state filtering, and pagination.

create index if not exists invoices_org_created_id_idx
  on public.invoices (organization_id, created_at desc, id desc);

create index if not exists payments_org_invoice_active_idx
  on public.payments (organization_id, invoice_id)
  include (amount_cents)
  where voided_at is null;

create or replace function public.list_invoices(
  p_organization_id uuid,
  p_page integer default 1,
  p_page_size integer default 25,
  p_query text default null,
  p_filter text default 'all'
)
returns table(total_count bigint, invoice_rows jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_query text := lower(nullif(btrim(p_query), ''));
  v_offset bigint;
begin
  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Invoice access denied' using errcode = '42501';
  end if;

  if p_page is null or p_page < 1 or p_page > 1000000 then
    raise exception 'Invalid invoice page' using errcode = '22023';
  end if;
  if p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'Invalid invoice page size' using errcode = '22023';
  end if;
  if p_filter is null or p_filter not in ('all', 'draft', 'unpaid', 'partial', 'paid', 'overdue', 'void') then
    raise exception 'Invalid invoice filter' using errcode = '22023';
  end if;
  if char_length(coalesce(p_query, '')) > 100 then
    raise exception 'Invoice search is too long' using errcode = '22023';
  end if;

  select (now() at time zone settings.timezone)::date
  into strict v_today
  from public.business_settings as settings
  where settings.organization_id = p_organization_id;

  v_offset := (p_page::bigint - 1) * p_page_size::bigint;

  return query
  with payment_totals as (
    select payment.invoice_id, coalesce(sum(payment.amount_cents), 0)::bigint as paid_cents
    from public.payments as payment
    where payment.organization_id = p_organization_id
      and payment.voided_at is null
    group by payment.invoice_id
  ), classified as (
    select
      invoice.id,
      invoice.customer_id,
      invoice.job_id,
      invoice.invoice_number,
      invoice.status,
      invoice.issue_date,
      invoice.due_date,
      invoice.currency::text as currency,
      invoice.total_cents,
      case
        when invoice.status = 'draft' then btrim(customer.first_name || ' ' || customer.last_name)
        else coalesce(nullif(btrim(invoice.customer_name_snapshot), ''), btrim(customer.first_name || ' ' || customer.last_name))
      end as customer_name,
      job.job_number,
      coalesce(payment.paid_cents, 0)::bigint as paid_cents,
      greatest(invoice.total_cents - coalesce(payment.paid_cents, 0), 0)::bigint as balance_cents,
      case
        when invoice.status = 'cancelled' then 'void'
        when invoice.status = 'draft' then 'draft'
        when greatest(invoice.total_cents - coalesce(payment.paid_cents, 0), 0) = 0 and invoice.total_cents > 0 then 'paid'
        when invoice.due_date < v_today then 'overdue'
        when coalesce(payment.paid_cents, 0) > 0 then 'partial'
        else 'unpaid'
      end as payment_state,
      invoice.created_at
    from public.invoices as invoice
    join public.customers as customer
      on customer.organization_id = invoice.organization_id
     and customer.id = invoice.customer_id
    left join public.jobs as job
      on job.organization_id = invoice.organization_id
     and job.id = invoice.job_id
    left join payment_totals as payment on payment.invoice_id = invoice.id
    where invoice.organization_id = p_organization_id
      and (
        v_query is null
        or position(v_query in lower(invoice.invoice_number)) > 0
        or position(v_query in lower(btrim(customer.first_name || ' ' || customer.last_name))) > 0
        or position(v_query in lower(coalesce(customer.email, ''))) > 0
        or position(v_query in lower(coalesce(invoice.customer_name_snapshot, ''))) > 0
        or position(v_query in lower(coalesce(invoice.customer_email_snapshot, ''))) > 0
      )
  ), filtered as (
    select *
    from classified
    where p_filter = 'all' or payment_state = p_filter
  ), page_rows as (
    select *
    from filtered
    order by created_at desc, id desc
    limit p_page_size
    offset v_offset
  )
  select
    (select count(*)::bigint from filtered),
    coalesce(
      (select jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc, page_row.id desc) from page_rows as page_row),
      '[]'::jsonb
    );
end;
$$;

revoke all on function public.list_invoices(uuid, integer, integer, text, text) from public, anon;
grant execute on function public.list_invoices(uuid, integer, integer, text, text) to authenticated;

comment on function public.list_invoices(uuid, integer, integer, text, text) is
  'Returns one authorized organization invoice page with trusted payment-state totals and an exact filtered count.';
