

# KiwiOps

## Milestone 7: office jobs

Office users can create direct jobs or convert accepted quotes, schedule work, assign multiple active technicians, update editable jobs, and use the existing lifecycle. Job numbers, authorization, quote conversion, assignment history, concurrency checks, and activity logs are enforced by `20260930000800_job_operations.sql`.

Review the remote dry-run and explicitly approve the migration before applying it to the linked Supabase project.

## Milestone 8: technician experience

Technicians use `/my-jobs`, not the office workspace. The jobs query runs under the signed-in technician session and relies on forced RLS plus active `job_assignments`; the browser never supplies a trusted member identity. Job detail reads the service-address snapshot from `jobs` and obtains customer phone/email only through `get_assigned_job_contact`, which repeats the assignment check in the database.

Start and completion use the existing `start_job` and `complete_job` security-definer RPCs. They derive the actor from `auth.uid()`, validate active assignment and lifecycle state, set timestamps on the server, and write activity records. Technicians cannot reschedule, assign, cancel, view commercial documents, or broadly query Customers.

Migration `20260930000900_technician_experience.sql` adds one read-only RPC for the organization IANA timezone. This avoids granting technicians access to financial business settings while ensuring “Today” grouping and schedule formatting do not depend on the device timezone. It requires explicit approval before remote deployment.

Freeform technician notes are not enabled in this milestone. The current schema supports secure completion notes through `complete_job`; adding general notes would require a controlled author-deriving operation rather than broad table writes.

## Milestone 9: invoices and manual payments

Office users create one draft invoice from a completed job, edit its lines while draft, issue it, and record one or more manual payments. `20261005001000_invoice_operations.sql` keeps invoice numbering in the existing organization/year sequence and calculates line subtotal, GST, and totals through the existing database triggers. The client sends descriptions, quantities, and unit prices, never authoritative totals.

Issuing captures customer, billing, business, GST, and tax-rate snapshots. Issued financial content is immutable. Active payments derive unpaid, partial, paid, balance, and overdue presentation; overpayments are rejected under an invoice row lock. Payment corrections use void metadata instead of deletion. Invoice voiding preserves its number and history and requires active payments to be voided first.

Invoice and payment reads remain owner/admin-only under forced RLS. Direct authenticated writes are revoked and controlled RPCs derive the actor from `auth.uid()`. Technicians receive no invoice, payment, settings, or pricing access. The current MVP records manual payments only, with no gateway, credit notes, refunds, PDF/email delivery, or general ledger integration. The earlier quote address-snapshot limitation remains deferred to Milestone 12.

## Milestone 10: operational dashboard

The owner/admin dashboard is a server-rendered daily command centre. Technicians continue to use `/my-jobs` and cannot access office dashboard data.

Dashboard definitions:

- Open enquiries: `new` or `reviewing`.
- Active jobs: `unscheduled`, `scheduled`, or `in_progress`.
- Quotes awaiting decision: `sent`.
- Outstanding: remaining balances on `sent` invoices after non-voided payments.
- Overdue: an outstanding balance whose due date is before the organization-local date.
- Paid this month: non-voided payments with `paid_on` inside the current organization-local calendar month.
- Attention rules: overdue invoices, high/urgent open enquiries, unscheduled jobs, scheduled jobs without an active assignment, and sent quotes awaiting a decision.

`20261006001100_operational_dashboard.sql` adds one narrow aggregate RPC. It derives the organization-local date from `business_settings.timezone`, requires an authenticated owner/admin membership, and returns counts and financial totals only. Job lists and recent activity continue to use existing forced-RLS table reads. Recent activity uses `organization_members.display_name` through the explicit activity-log actor relationship.

The dashboard limits today to 12 jobs, upcoming work to 5 jobs, and recent activity to 8 events. It is an operational overview, not an accounting ledger or historical reporting system. The migration must be reviewed and explicitly approved before remote deployment.

## Milestone 11: Smart Insights

Smart Insights is a deterministic operational assistant for owners and admins. It groups seven explicit rules: overdue sent invoices, urgent open enquiries, high-priority enquiries open for at least one organization-local calendar day, unscheduled jobs, scheduled jobs without an active technician assignment, completed jobs with no invoice record, and sent quotes awaiting a decision for at least seven organization-local calendar days.

Rules have a fixed priority from financial urgency through enquiry, job, invoicing, and quote follow-up. Severity is limited to `critical`, `attention`, and `opportunity`. Counts are grouped by rule rather than returning customer or document rows. Invoice balances use sent invoices minus non-voided payments, matching the invoice and dashboard definitions. Date thresholds use `business_settings.timezone`, including Pacific/Auckland daylight-saving boundaries.

`20261007001200_smart_insights.sql` adds `get_smart_insights(uuid)`, a narrow aggregate RPC restricted to active owner/admin membership. The supplied organization scopes the query but does not authorize it; caller identity comes from `auth.uid()`. Technicians, inactive members, anonymous callers, and cross-organization callers are rejected. `/insights` and the dashboard preview use one shared presentation mapper, and an RPC failure is never shown as an all-clear result.

Service reminders are deferred because KiwiOps does not yet provide a supported reminder management workflow. This version deliberately uses auditable business rules instead of an LLM, prediction service, health score, or generated recommendation. At larger scale, quote ageing should be measured before considering an `(organization_id, status, sent_at)` index.

Migration `01200` was reviewed, approved, and applied to the linked project.
