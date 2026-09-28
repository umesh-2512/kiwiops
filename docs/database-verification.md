# Database verification

## What is version controlled

The database is defined by three ordered migrations:

1. `20260928000100_initial_schema.sql` creates the tables, constraints, composite tenant foreign keys, indexes, and timestamp triggers.
2. `20260928000200_integrity_and_security_functions.sql` creates authorization helpers, immutable document protections, financial calculations, document numbering, and narrow RPCs.
3. `20260928000300_row_level_security.sql` removes implicit Data API access, grants only required operations, forces RLS, and creates role policies.

`supabase/seed.sql` is intentionally empty for this milestone. Demo users and organizations should be added only when authentication and approved demo data are implemented.

## Local verification

A Docker-compatible runtime is required because the Supabase CLI runs PostgreSQL, Auth, and the API stack in containers.

```bash
npm install
npm run supabase:start
npm run db:reset
npm run db:lint
npm run db:test
```

Expected result:

- every migration applies from an empty database;
- database lint reports no security errors;
- `rls_security.test.sql` reports 11 passing tests;
- the test transaction rolls back all test identities and business records.

## Security scenarios covered

The pgTAP suite verifies:

1. Organization A cannot read Organization B customers.
2. Organization A cannot create a quote for Organization B's customer.
3. A technician cannot select the customers table.
4. An assigned technician can retrieve only the approved job contact fields.
5. A technician cannot select invoices.
6. A technician cannot select quotes.
7. A technician cannot elevate their role.
8. A technician cannot assign themselves to a job.
9. An admin cannot elevate themselves to owner.
10. An owner cannot change their own role.
11. A cross-organization assignment fails.

## Hosted project workflow

Local validation and hosted deployment are separate states. Successful linting or a local reset does not mean the migrations exist on the hosted project.

Before a hosted deployment:

1. Confirm the intended Supabase project reference in the dashboard.
2. Authenticate the CLI interactively.
3. Link the repository to that exact project.
4. Run `supabase migration list` and review local versus remote history.
5. Apply with `supabase db push` only after review.
6. Run the security tests against a safe local or dedicated test database, not production data.

Never use `db reset --linked` against a production project. It destroys remote data.

## Environment safety

Only these browser-safe names belong in `.env.local` for this milestone:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`.env.local` is ignored by Git. The repository does not require or document a service-role key. Privileged credentials must not appear in client code, migration files, tests, documentation, or command output.
