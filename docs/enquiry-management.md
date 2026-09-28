# Enquiry management

Milestone 5 uses the deployed `enquiries` table without changing its shape. An enquiry belongs to an organization and an active customer and stores a description, optional category, source, priority, status, and lifecycle timestamps. The schema has no title or human-readable enquiry number, so the UI uses category or a description excerpt and keeps UUIDs inside routes.

The list is server-rendered in pages of 20. URL parameters `q`, `status`, `priority`, and `page` preserve list state. Search runs in PostgreSQL across enquiry description and category plus organization-scoped customer name and email matches.

New enquiry customer selection is a separate database search limited to 20 active customers. Archived customers and customers from another organization cannot be associated. Editing keeps the existing customer association and supports category, description, source, priority, and the approved statuses: `new`, `reviewing`, `quoted`, `converted`, and `closed`.

Migration `20260929000600_enquiry_operations.sql` adds `create_enquiry` and `update_enquiry`. Both functions derive office authorization and the activity actor through helpers backed by `auth.uid()`. They validate constrained values and active same-organization customer ownership. Creation, detail changes, priority changes, and status changes write human-readable activity in the same transaction. Direct authenticated insert, update, and delete grants are revoked; existing SELECT RLS remains the read boundary. Technicians retain no broad enquiry access.
