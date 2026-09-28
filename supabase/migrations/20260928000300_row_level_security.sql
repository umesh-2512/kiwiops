-- Explicit grants and RLS policies. The Data API roles receive no implicit table access.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.current_membership_id(uuid) to authenticated;
grant execute on function private.current_org_role(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.is_assigned_to_job(uuid) to authenticated;

grant select on public.profiles to authenticated;
grant insert (id, first_name, last_name, phone, avatar_url) on public.profiles to authenticated;
grant update (first_name, last_name, phone, avatar_url) on public.profiles to authenticated;

grant select on public.organizations to authenticated;
grant update (display_name, legal_name, slug, status) on public.organizations to authenticated;

grant select on public.organization_members to authenticated;

grant select on public.business_settings to authenticated;
grant update (
  business_display_name, phone, email, nzbn, address_line_1, address_line_2,
  suburb, city, postcode, gst_registered, gst_number, default_gst_rate,
  invoice_payment_terms_days, quote_validity_days, timezone, currency
) on public.business_settings to authenticated;

grant select on public.customers to authenticated;
grant insert (
  organization_id, first_name, last_name, email, phone, address_line_1,
  address_line_2, suburb, city, postcode, notes
) on public.customers to authenticated;
grant update (
  first_name, last_name, email, phone, address_line_1, address_line_2,
  suburb, city, postcode, notes, status
) on public.customers to authenticated;

grant select on public.enquiries to authenticated;
grant insert (
  organization_id, customer_id, contact_name, contact_email, contact_phone,
  source, description, category, priority
) on public.enquiries to authenticated;
grant update (
  customer_id, contact_name, contact_email, contact_phone, source,
  description, category, priority, status
) on public.enquiries to authenticated;
grant delete on public.enquiries to authenticated;

grant select on public.quotes to authenticated;
grant insert (
  organization_id, customer_id, enquiry_id, issue_date, expiry_date,
  currency, notes, terms
) on public.quotes to authenticated;
grant update (
  customer_id, enquiry_id, issue_date, expiry_date, currency, notes, terms
) on public.quotes to authenticated;
grant delete on public.quotes to authenticated;

grant select on public.quote_items to authenticated;
grant insert (
  organization_id, quote_id, description, quantity, unit_price_cents,
  tax_rate, position
) on public.quote_items to authenticated;
grant update (
  description, quantity, unit_price_cents, tax_rate, position
) on public.quote_items to authenticated;
grant delete on public.quote_items to authenticated;

grant select on public.jobs to authenticated;
grant insert (
  organization_id, customer_id, quote_id, job_type, description, priority,
  scheduled_start_at, estimated_duration_minutes, address_line_1,
  address_line_2, suburb, city, postcode
) on public.jobs to authenticated;
grant update (
  customer_id, quote_id, job_type, description, priority, status,
  scheduled_start_at, estimated_duration_minutes, address_line_1,
  address_line_2, suburb, city, postcode, completion_notes
) on public.jobs to authenticated;
grant delete on public.jobs to authenticated;

grant select on public.job_assignments to authenticated;
grant insert (organization_id, job_id, member_id) on public.job_assignments to authenticated;
grant update (unassigned_at) on public.job_assignments to authenticated;

grant select on public.job_notes to authenticated;
grant insert (organization_id, job_id, content, visibility) on public.job_notes to authenticated;

grant select on public.invoices to authenticated;
grant insert (
  organization_id, customer_id, job_id, issue_date, due_date, currency,
  notes, payment_instructions
) on public.invoices to authenticated;
grant update (
  customer_id, job_id, issue_date, due_date, currency, notes, payment_instructions
) on public.invoices to authenticated;
grant delete on public.invoices to authenticated;

grant select on public.invoice_items to authenticated;
grant insert (
  organization_id, invoice_id, description, quantity, unit_price_cents,
  tax_rate, position
) on public.invoice_items to authenticated;
grant update (
  description, quantity, unit_price_cents, tax_rate, position
) on public.invoice_items to authenticated;
grant delete on public.invoice_items to authenticated;

grant select on public.payments to authenticated;

grant select on public.service_reminders to authenticated;
grant insert (
  organization_id, customer_id, source_job_id, service_type, due_date,
  status, notes
) on public.service_reminders to authenticated;
grant update (
  customer_id, source_job_id, service_type, due_date, status, notes
) on public.service_reminders to authenticated;
grant delete on public.service_reminders to authenticated;

grant select on public.activity_logs to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;
alter table public.business_settings enable row level security;
alter table public.business_settings force row level security;
alter table public.document_sequences enable row level security;
alter table public.document_sequences force row level security;
alter table public.customers enable row level security;
alter table public.customers force row level security;
alter table public.enquiries enable row level security;
alter table public.enquiries force row level security;
alter table public.quotes enable row level security;
alter table public.quotes force row level security;
alter table public.quote_items enable row level security;
alter table public.quote_items force row level security;
alter table public.jobs enable row level security;
alter table public.jobs force row level security;
alter table public.job_assignments enable row level security;
alter table public.job_assignments force row level security;
alter table public.job_notes enable row level security;
alter table public.job_notes force row level security;
alter table public.invoices enable row level security;
alter table public.invoices force row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_items force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;
alter table public.service_reminders enable row level security;
alter table public.service_reminders force row level security;
alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy organizations_select_member on public.organizations
  for select to authenticated
  using (private.is_active_member(id));
create policy organizations_update_owner on public.organizations
  for update to authenticated
  using (private.has_org_role(id, array['owner']))
  with check (private.has_org_role(id, array['owner']));

create policy organization_members_select_allowed on public.organization_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.has_org_role(organization_id, array['owner'])
    or (
      status = 'active'
      and private.has_org_role(organization_id, array['admin'])
    )
  );

create policy business_settings_select_owner on public.business_settings
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner']));
create policy business_settings_update_owner on public.business_settings
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner']))
  with check (private.has_org_role(organization_id, array['owner']));

create policy customers_select_office on public.customers
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy customers_insert_office on public.customers
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy customers_update_office on public.customers
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy enquiries_select_office on public.enquiries
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy enquiries_insert_office on public.enquiries
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy enquiries_update_office on public.enquiries
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy enquiries_delete_office on public.enquiries
  for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));

create policy quotes_select_office on public.quotes
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy quotes_insert_office on public.quotes
  for insert to authenticated
  with check (
    status = 'draft'
    and private.has_org_role(organization_id, array['owner', 'admin'])
  );
create policy quotes_update_office on public.quotes
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy quotes_delete_draft on public.quotes
  for delete to authenticated
  using (
    status = 'draft'
    and private.has_org_role(organization_id, array['owner', 'admin'])
  );

create policy quote_items_select_office on public.quote_items
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy quote_items_insert_office on public.quote_items
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy quote_items_update_office on public.quote_items
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy quote_items_delete_office on public.quote_items
  for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));

create policy jobs_select_allowed on public.jobs
  for select to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin'])
    or private.is_assigned_to_job(id)
  );
create policy jobs_insert_office on public.jobs
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy jobs_update_office on public.jobs
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy jobs_delete_unscheduled on public.jobs
  for delete to authenticated
  using (
    status = 'unscheduled'
    and private.has_org_role(organization_id, array['owner', 'admin'])
  );

create policy job_assignments_select_allowed on public.job_assignments
  for select to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin'])
    or member_id = private.current_membership_id(organization_id)
  );
create policy job_assignments_insert_office on public.job_assignments
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy job_assignments_update_office on public.job_assignments
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));

create policy job_notes_select_allowed on public.job_notes
  for select to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin'])
    or (visibility = 'team' and private.is_assigned_to_job(job_id))
  );
create policy job_notes_insert_allowed on public.job_notes
  for insert to authenticated
  with check (
    author_member_id = private.current_membership_id(organization_id)
    and (
      private.has_org_role(organization_id, array['owner', 'admin'])
      or (visibility = 'team' and private.is_assigned_to_job(job_id))
    )
  );

create policy invoices_select_office on public.invoices
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy invoices_insert_office on public.invoices
  for insert to authenticated
  with check (
    status = 'draft'
    and private.has_org_role(organization_id, array['owner', 'admin'])
  );
create policy invoices_update_office on public.invoices
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy invoices_delete_draft on public.invoices
  for delete to authenticated
  using (
    status = 'draft'
    and private.has_org_role(organization_id, array['owner', 'admin'])
  );

create policy invoice_items_select_office on public.invoice_items
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy invoice_items_insert_office on public.invoice_items
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy invoice_items_update_office on public.invoice_items
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy invoice_items_delete_office on public.invoice_items
  for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));

create policy payments_select_office on public.payments
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));

create policy service_reminders_select_office on public.service_reminders
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy service_reminders_insert_office on public.service_reminders
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy service_reminders_update_office on public.service_reminders
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy service_reminders_delete_office on public.service_reminders
  for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));

create policy activity_logs_select_office on public.activity_logs
  for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));

-- document_sequences deliberately has no authenticated grants or policies.
-- payments and activity_logs deliberately have no direct client write policies.
