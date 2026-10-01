

# KiwiOps

## Milestone 7: office jobs

Office users can create direct jobs or convert accepted quotes, schedule work, assign multiple active technicians, update editable jobs, and use the existing lifecycle. Job numbers, authorization, quote conversion, assignment history, concurrency checks, and activity logs are enforced by `20260930000800_job_operations.sql`.

Review the remote dry-run and explicitly approve the migration before applying it to the linked Supabase project.

## Milestone 8: technician experience

Technicians use `/my-jobs`, not the office workspace. The jobs query runs under the signed-in technician session and relies on forced RLS plus active `job_assignments`; the browser never supplies a trusted member identity. Job detail reads the service-address snapshot from `jobs` and obtains customer phone/email only through `get_assigned_job_contact`, which repeats the assignment check in the database.

Start and completion use the existing `start_job` and `complete_job` security-definer RPCs. They derive the actor from `auth.uid()`, validate active assignment and lifecycle state, set timestamps on the server, and write activity records. Technicians cannot reschedule, assign, cancel, view commercial documents, or broadly query Customers.

Migration `20260930000900_technician_experience.sql` adds one read-only RPC for the organization IANA timezone. This avoids granting technicians access to financial business settings while ensuring “Today” grouping and schedule formatting do not depend on the device timezone. It requires explicit approval before remote deployment.

Freeform technician notes are not enabled in this milestone. The current schema supports secure completion notes through `complete_job`; adding general notes would require a controlled author-deriving operation rather than broad table writes.
