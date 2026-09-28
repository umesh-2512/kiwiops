# KiwiOps

KiwiOps is an operations platform for small New Zealand service businesses. It connects the workflow from customer enquiry through quoting, scheduling, field work, invoicing, and payment.

## Current milestone

Milestone 3 adds authentication and organization onboarding to the Milestone 2 database foundation:

- Next.js App Router, React, TypeScript, and Tailwind CSS
- Responsive desktop and mobile application shell
- Email and password authentication with Supabase Auth
- Cookie-based server-side sessions using `@supabase/ssr`
- Server-side route protection through the Next.js 16 `proxy.ts` convention
- Email confirmation callback handling
- Auth user profile provisioning
- Atomic organization and owner-membership onboarding
- Real user, organization, role, and sign-out controls in the application shell
- Version-controlled PostgreSQL migrations
- Organization-scoped UUID data model and composite tenant foreign keys
- Owner, admin, and technician Row Level Security policies
- Concurrency-safe quote, job, and invoice numbers
- Server-calculated financial line totals and document totals
- Controlled role, technician job, and payment functions
- pgTAP security boundary tests
- Browser and server Supabase client utilities

Customer, enquiry, quote, job, invoice, payment, reporting, and team-management interfaces remain outside this milestone.

## Application setup

Requirements:

- Node.js 20 or later
- npm
- A Supabase project
- Docker Desktop or another Docker-compatible runtime for the local Supabase stack

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env.local` and enter the browser-safe values from the Supabase project settings:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Do not commit `.env.local`. Do not add a service-role key to browser configuration.

Start the Next.js application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Authentication and onboarding

KiwiOps uses Supabase Auth for email and password accounts. The browser and server clients use the browser-safe publishable key. Authentication tokens are managed by Supabase through secure cookies and are not stored by application code.

The Next.js proxy refreshes expired authentication cookies and rejects unauthenticated requests to protected routes. Protected layouts repeat the server-side account and organization checks before rendering. `/login`, `/signup`, and `/auth/confirm` remain public and do not use the application sidebar.

Signup collects a first name, last name, email address, and password. When email confirmation is enabled, Supabase sends the user a confirmation link and the callback establishes the session. A database trigger creates the matching `profiles` row using the authenticated user's ID. Profile names are display data only and are never used for authorization.

Authenticated users without an active organization membership are sent to `/onboarding`. Workspace creation calls the existing `create_organization` database function. The function derives the owner from `auth.uid()` and creates the organization, business settings, and initial owner membership in one transaction. The browser cannot provide an owner user ID or assign itself to an existing organization.

For hosted Supabase Auth, configure:

- the application's public origin as the Auth Site URL;
- `<application-origin>/auth/confirm` as an allowed redirect URL;
- a production SMTP provider before relying on confirmation emails for real customers.

The callback supports Supabase PKCE `code` links and `token_hash` confirmation links. If the confirmation email template uses a token hash, its target should be:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

The default Supabase email service is suitable for initial testing but is rate limited and is not intended as a production mail service.

## Database development

The `supabase/` directory is the source of truth for database changes:

```text
supabase/
  config.toml
  migrations/
    20260928000100_initial_schema.sql
    20260928000200_integrity_and_security_functions.sql
    20260928000300_row_level_security.sql
    20260928000400_auth_profile_provisioning.sql
  tests/database/
    rls_security.test.sql
  seed.sql
```

Start the local stack, rebuild the database from migrations, run database linting, and execute the pgTAP tests:

```bash
npm run supabase:start
npm run db:reset
npm run db:lint
npm run db:test
```

`db:reset` is destructive to the local development database. It does not target the hosted project because the script passes `--local` explicitly.

To apply migrations to a hosted project, first review the target, link it explicitly with the Supabase CLI, compare migration history, and then run `supabase db push`. Remote deployment is a separate deliberate action and is not performed by application startup.

## Security model

Every business-owned record carries `organization_id`. Parent-child relationships use composite tenant foreign keys, so records cannot point across organizations even if privileged application code contains a bug.

RLS is enabled and forced on application tables:

- owners manage the organization and operational data;
- admins manage operational data but cannot change roles or owner-only settings;
- technicians see assigned jobs and team-visible job notes;
- technicians receive limited customer contact data through a checked function rather than direct customer-table access;
- technicians have no quote, invoice, payment, report, or settings access;
- role changes, document numbering, job transitions, and payment recording use narrow functions that derive the caller from `auth.uid()`.

The complete design and security reasoning are in [docs/database-design.md](docs/database-design.md). Reproduction and test details are in [docs/database-verification.md](docs/database-verification.md).

## Application checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Project structure

```text
src/
  app/             Protected, authentication, onboarding, and callback routes
  components/      Shared application and authentication UI
  lib/auth/        Server account context, redirects, and validation
  lib/supabase/    Browser, server, and proxy Supabase clients
supabase/
  migrations/      Ordered PostgreSQL schema changes
  tests/           SQL security tests
docs/
  database-design.md
  database-verification.md
```
