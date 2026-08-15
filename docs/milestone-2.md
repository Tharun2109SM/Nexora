# Milestone 2: Customer Management and Organization Administration

Milestone 2 turns the customer placeholder destinations into secured operational workflows. It does not add fabricated portfolio data, billing behavior, SMTP delivery, or analytics calculations.

## Flows

Beau Roi staff can search and filter customer organizations, inspect a customer record, update approved profile and lifecycle fields, record a reasoned health score, replace the active Customer Success Manager or Implementation Engineer, and review people and append-only activity. Assignment replacement ends the prior row and keeps it as history.

Customer members can read their own company profile, team, active Beau Roi contacts, and real subscriptions. Customer administrators can additionally update approved company fields, manage eligible customer memberships, and create or revoke invitations. Database triggers reject protected-field changes, internal roles, self-management, and removal of the last active customer administrator.

## Authorization matrix

| Capability                                   | Anonymous | Customer member | Customer administrator         | Beau Roi employee            | Beau Roi administrator        |
| -------------------------------------------- | --------- | --------------- | ------------------------------ | ---------------------------- | ----------------------------- |
| Read customer portfolio                      | Denied    | Denied          | Denied                         | Allowed                      | Allowed                       |
| Read own organization/profile/members        | Denied    | Allowed         | Allowed                        | Allowed across customers     | Allowed across customers      |
| Edit approved own company fields             | Denied    | Denied          | Allowed                        | Allowed across customers     | Allowed across customers      |
| Change customer lifecycle/health/assignments | Denied    | Denied          | Denied                         | Allowed                      | Allowed                       |
| Read active own assignments                  | Denied    | Allowed         | Allowed                        | Allowed, including history   | Allowed, including history    |
| Read assignment internal notes               | Denied    | Denied          | Denied                         | Kept in private schema       | Kept in private schema        |
| Create/revoke customer invitation            | Denied    | Denied          | Own organization               | Denied by API admin boundary | Allowed                       |
| Change customer member role/status           | Denied    | Denied          | Safe roles in own organization | Denied                       | Allowed with last-admin guard |
| Read customer audit history                  | Denied    | Denied          | Denied                         | Allowed                      | Allowed                       |

All permissions are also enforced by PostgreSQL grants, RLS policies, constraints, and guarded database functions. A user cannot gain Beau Roi access from an email address or editable metadata.

Membership deletion is not an application capability: `authenticated` has no `DELETE` grant or policy, and membership history is preserved through status changes. No unconditional delete trigger blocks database-owner maintenance, organization cleanup, or valid foreign-key cascades. Internal invitation and logo transaction markers are usable only inside their approved owner-executed RPC workflows; setting the custom PostgreSQL setting as an authenticated caller grants no additional capability.

## API

All routes below are under `/v1`, require a Supabase bearer JWT, and return the existing request-ID error envelope.

| Method   | Route                                                      | Purpose                                           |
| -------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `GET`    | `/staff`                                                   | Active Beau Roi assignment choices                |
| `GET`    | `/customers`                                               | Filtered, deterministically sorted keyset page    |
| `GET`    | `/customers/:organizationId`                               | Beau Roi customer detail                          |
| `PATCH`  | `/customers/:organizationId/profile`                       | Update approved customer profile fields           |
| `PATCH`  | `/customers/:organizationId/lifecycle`                     | Change lifecycle                                  |
| `POST`   | `/customers/:organizationId/health-scores`                 | Append a manual score and reason                  |
| `POST`   | `/customers/:organizationId/assignments`                   | Atomically replace CSM or implementation engineer |
| `GET`    | `/organizations/:organizationId`                           | Customer organization administration detail       |
| `PATCH`  | `/organizations/:organizationId`                           | Update approved own-organization fields           |
| `PATCH`  | `/organizations/:organizationId/members/:membershipId`     | Safe member role/status change                    |
| `POST`   | `/organizations/:organizationId/invitations`               | Create token and return its URL once              |
| `DELETE` | `/organizations/:organizationId/invitations/:invitationId` | Revoke pending invitation                         |
| `POST`   | `/invitations/accept`                                      | Accept as matching authenticated email            |
| `GET`    | `/organizations/:organizationId/logo`                      | Proxy an authorized private logo                  |
| `PUT`    | `/organizations/:organizationId/logo`                      | Validate and replace private logo                 |

Customer list parameters are `search`, `lifecycle`, `industry`, `country`, `healthBand`, `assignment`, `sort`, `limit`, and opaque `cursor`. The cursor is tied to its sort and rejected when malformed or reused under another sort.

## Invitations

The API generates 256-bit random tokens and stores only lowercase SHA-256 hashes. The invitation table grants no `SELECT`, `INSERT`, `UPDATE`, or `DELETE` access to `anon` or `authenticated`; safe listing, creation, revocation, and acceptance are narrow RPCs with database authorization. No view or RPC returns `token_hash`. Acceptance receives the raw token, hashes it inside PostgreSQL with `pgcrypto`, locks the matching row, checks the signed JWT email, expiry, revocation, and prior use, then creates or reactivates the customer membership atomically. Raw links are returned only by the create response.

SMTP is not configured. The UI says so and provides a one-time copy control; it never claims mail was sent. `InvitationDelivery` is the provider boundary for a future approved SMTP or Resend integration.

## Audit and history

Guarded triggers record safe structured events for profile, logo, lifecycle, assignment, health, invitation, and membership mutations. Actor user, primary actor organization/role, target organization/entity, timestamp, and request ID are retained. Tokens, JWTs, credentials, private notes, passwords, and request headers are never written. Authenticated application roles have no insert/update/delete grant on `audit_events`.

## Private R2 logos

Set all four API-only variables or none:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

The bucket must remain private. Upload accepts only PNG, JPEG, or WebP up to 2 MB and checks declared MIME type, filename extension, and decoded magic bytes. Object keys use organization scope plus a random UUID. The API updates the database only after upload succeeds, rolls the new object back when the database update fails, and attempts old-object cleanup after replacement. Reads are proxied through authenticated organization authorization.

Without all four variables, the API starts normally, returns `FILE_STORAGE_NOT_CONFIGURED` for uploads, and the UI keeps profile editing enabled while showing logo upload as unavailable.

## Migration and production order

The additive migration is `20260815090632_customer_management_organization_admin.sql`. Because it remains unapplied, compatibility corrections are maintained in that existing file. It verifies the exact Milestone 1 assignment constraint before replacing it, backfills inactive history, and fails with organization/type details when duplicate active CSM or implementation assignments require manual review. It must be reviewed and tested locally before merge. Safe deployment order:

Local compatibility checks use only the Supabase CLI development database:

```bash
pnpm exec supabase db reset --local --version 20260814183342 --sql-paths compatibility/milestone1-populated.sql
pnpm exec supabase migration up --local
pnpm exec supabase test db supabase/compatibility/milestone2-populated.test.sql

pnpm exec supabase db reset --local --sql-paths compatibility/milestone2-concurrent-invitation.sql
bash supabase/compatibility/test-concurrent-invitation.sh
```

The duplicate-active fixture is expected to make `supabase migration up --local` fail with the explicit preflight error and the affected organization/type/count; it never resolves or deletes history automatically.

1. Back up and review the linked Supabase project; confirm the existing Milestone 1 migration is applied.
2. Merge the reviewed migration and let the existing Supabase GitHub integration apply it once.
3. Confirm migration status, RLS/grants, database lint, security advisor, and performance advisor.
4. Deploy the Render API and verify `/health` and `/ready` before directing web traffic to new routes.
5. Deploy Vercel and verify Beau Roi/customer role flows at desktop and mobile sizes.
6. Configure all R2 variables later in Render as one set, create the private bucket, redeploy the API, and test upload/proxy/delete authorization.
7. Add an approved delivery provider later; do not add SMTP secrets until then.

The first Beau Roi administrator remains an explicit production provisioning task. Create the Auth account administratively, insert its profile and active `BEAUROI_ADMIN` membership in the real `BEAUROI` organization through a reviewed privileged process, then verify the portal. Email domains do not provision roles.
