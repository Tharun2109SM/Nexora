# Milestone 4: Product Support

## Phase 4A + 4B scope

The first Product Support phase adds the database/domain and authorization foundation only. It does not add Express routes or replace the Beau Roi and customer support UI shells.

The additive migration is:

```text
supabase/migrations/20260818171437_milestone_4_support_foundation.sql
```

## Approved foundation decisions

- The existing `OPEN`, `IN_PROGRESS`, `WAITING_ON_CUSTOMER`, `RESOLVED`, and `CLOSED` lifecycle is retained.
- `CLOSED` is terminal for application roles. `OPEN -> CLOSED` is the controlled invalid/duplicate closure path and requires a resolution summary.
- Categories are Beau Roi-global and may optionally target one product. No production categories or SLA policies are seeded.
- Customer ticket creation requires an active membership, an active subscribed product, and an active applicable category. The database column remains nullable for legacy data and a future approved general-support workflow, but the current customer RPC rejects null products.
- Staff mutation requires `BEAUROI_ADMIN` or an active matching `SUPPORT_LEAD` assignment. `assigned_to` is operational ownership and does not grant authorization by itself.
- SLA selection prefers an active exact-product policy and then an organization-wide policy for the ticket priority. Deadlines are elapsed-minute snapshots. Business calendars, holidays, timezones, and waiting-on-customer pause behavior remain deferred.
- Attachments remain metadata-only in this phase. Authenticated Data API roles cannot select private `object_key` values, and no generic R2 upload API is introduced.

## Database workflows

Two narrowly scoped authenticated functions prepare the later API without granting broad table mutation:

```text
public.create_support_ticket(uuid, uuid, uuid, text, text)
public.add_support_ticket_message(uuid, text, boolean)
```

Both bind authorship to `auth.uid()`. Ticket creation derives protected lifecycle, assignment, SLA, and resolution fields. Message creation locks the ticket row, enforces organization and visibility rules, and atomically records the first customer-visible Beau Roi response.

## Verification

Run a fresh local migration and every pgTAP suite with:

```bash
pnpm exec supabase db reset --local --no-seed
pnpm exec supabase test db
```

Run populated-upgrade preflights and concurrency verification with:

```bash
supabase/compatibility/test-milestone4-upgrade.sh
supabase/compatibility/test-concurrent-first-response.sh
```

The Milestone 4 pgTAP suite directly exercises customer isolation, internal-note visibility, assignment-scoped mutation, lifecycle transitions, first-response behavior, SLA snapshotting, attachment metadata protection, notification state hardening, immutable history, grants, and transaction-marker spoofing.

## CI status

The repository GitHub Actions workflow currently runs formatting, ESLint, strict TypeScript, application tests, and production builds. It does **not** start the Supabase CLI stack or run pgTAP. Database verification therefore remains an explicit local gate for this phase. Adding a separate Docker-backed database job should be reviewed as an independent CI change rather than hidden inside the security migration.

## Deferred business decisions

- Production category taxonomy
- Production SLA durations
- Business-hours and holiday calendars
- Waiting-on-customer pause behavior
- Whether customer replies automatically leave `WAITING_ON_CUSTOMER`
- Whether closed tickets can be reopened through an administrator-only future workflow
- Whether null-product ticket creation is exposed in the UI
- Attachment types, limits, retention, and R2 rollout
