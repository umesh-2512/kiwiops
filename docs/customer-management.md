# Customer management

Milestone 4 uses the deployed `customers` table without changing its shape. The schema stores individual customers with required first and last names, optional contact and address fields, notes, and an active or archived lifecycle. Business/company customers are not represented because the approved schema has no company-name or customer-type columns.

## Routes

- `/customers` lists customers with search, active/archived filtering, and pages of 20.
- `/customers/new` creates a customer.
- `/customers/[customerId]` shows contact details, address, notes, status, record dates, and customer activity.
- `/customers/[customerId]/edit` edits supported customer fields.

List state uses the URL parameters `q`, `status`, and `page`. Search terms are normalized before being applied to first name, last name, email, phone, suburb, and city filters. Supabase performs the search and pagination; the browser does not download the full customer directory.

## Authorization

The server resolves the organization from the authenticated membership. Customer forms never submit an organization ID, user ID, role, actor ID, or ownership field. Owner and admin memberships can manage customers. Technician requests receive the same unavailable response used for missing or cross-tenant records.

RLS remains the final boundary. Every customer query includes the resolved organization for clarity and performance, while the existing policies independently require an active owner or admin membership. A customer ID from another organization cannot be selected or changed.

## Writes and activity

Migration `20260928000500_customer_operations.sql` adds three narrow functions:

- `create_customer` creates the row and records `customer.created`.
- `update_customer` updates only normal customer fields and records `customer.updated`.
- `set_customer_archived` archives or restores the row and records the matching lifecycle event.

Each function derives the actor through `auth.uid()`, checks the current membership and office role, validates the supported fields, and writes the customer change and activity entry in one database transaction. Direct authenticated customer insert and update grants are removed so activity and database validation cannot be bypassed. Customer reads remain governed by the existing RLS policies. Activity metadata contains no customer record or secret data.

Normal UI deletion is not supported. Archive sets the database lifecycle fields consistently, and restore reverses them. This preserves references needed by later enquiries, quotes, jobs, invoices, and service reminders.
