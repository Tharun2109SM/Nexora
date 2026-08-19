# Milestone 4: Product Support

## Status and migrations

Milestone 4 provides the database, authorization, contracts, API, Beau Roi workspace, customer Support Center, and scoped in-app support notifications. It is implemented by additive migrations:

```text
supabase/migrations/20260818171437_milestone_4_support_foundation.sql
supabase/migrations/20260819053724_complete_support_notifications.sql
```

No production category taxonomy, SLA duration, storage credential, or notification-delivery vendor is embedded in the application.

## Complete product functionality

- Customer administrators and members can list their organization's tickets, create a ticket for an active subscribed product, view safe detail/SLA/history, and add customer-visible replies.
- Beau Roi administrators and active matching `SUPPORT_LEAD` staff can use the portfolio queue, full ticket workspace, visible replies, internal notes, lifecycle controls, priority/category controls, and assignment workflow.
- Staff capabilities are returned as narrow booleans derived from current database membership and assignment scope. A product assignment must match the ticket product; an organization-wide assignment may have a null product. `assigned_to` never authorizes mutation.
- Eligible assignees are limited to active Beau Roi administrators and active employees with applicable `SUPPORT_LEAD` scope. The API returns safe profile display fields only.
- Portfolio filter metadata is loaded independently of the current queue page and exposes only safe organization, product, category, and assignee labels/identifiers.
- Ticket creation, visible replies, assignment, waiting-on-customer, resolution, and closure generate recipient-scoped in-app notifications with portal-safe deep links. Internal notes never generate notifications, and notification payloads exclude descriptions, message bodies, metadata, and storage identifiers.
- `OPEN`, `IN_PROGRESS`, `WAITING_ON_CUSTOMER`, `RESOLVED`, and `CLOSED` transitions remain database-controlled. Resolution summaries and timestamps are guarded; `RESOLVED` can reopen to `IN_PROGRESS`; `CLOSED` is terminal for application roles.
- SLA selection prefers an active exact-product policy and then an organization-wide priority policy. Stored elapsed-minute deadlines and first-response timestamps remain deterministic and historical tickets are unaffected by later policy edits.
- Customer projections exclude internal messages/events and internal-note attachments. Authenticated callers cannot select attachment `object_key`, rewrite/delete message or event history, forge authorship/organization/SLA/assignment fields, or use ordinary service-role access.

The browser's capability presentation is advisory. PostgreSQL RLS, triggers, constrained RPCs, column grants, and caller-scoped JWT clients remain the final authorization boundary.

## API surface added for completion

```text
GET   /v1/support/filter-metadata
GET   /v1/support/tickets/:ticketId/eligible-assignees
GET   /v1/support/notifications
PATCH /v1/support/notifications/:notificationId/read
```

Existing narrow ticket, message, status, priority, category, and assignee routes remain in use. Customer organization scope continues to come from authenticated identity rather than request data.

## Verification

Application verification:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Database verification:

```bash
pnpm exec supabase db reset --local --no-seed
pnpm exec supabase test db
supabase/compatibility/test-milestone3-upgrade.sh
supabase/compatibility/test-milestone4-upgrade.sh
pnpm exec supabase db reset --local --sql-paths compatibility/milestone2-concurrent-invitation.sql
bash supabase/compatibility/test-concurrent-invitation.sh
bash supabase/compatibility/test-concurrent-first-response.sh
pnpm exec supabase db lint --local --level warning
```

The Milestone 4 pgTAP suite covers tenant isolation, internal-note visibility, assignment-scoped mutation, lifecycle transitions, deterministic first response and SLA snapshots, attachment metadata protection, notification recipients/deep links/content, immutable history, grants, and transaction-marker spoofing.

## Deployment and company-configuration follow-ups

These external decisions do not block the core Product Support workflow:

- Configure real Cloudflare R2 credentials, approved attachment types/size/retention, and private transfer endpoints before enabling upload/download controls. Until then, both portals deliberately show storage unavailable and tickets work without attachments.
- Define and seed the production support category taxonomy.
- Define production SLA durations. Business-hours calendars, holidays, timezone rules, and waiting-on-customer pause behavior remain unimplemented because no company policy was supplied.
- Choose an email provider and delivery policy if support email notifications are required; Milestone 4 provides in-app notifications only.
- Decide whether customer replies should automatically leave `WAITING_ON_CUSTOMER`, whether null-product tickets are customer-facing, and whether a future administrator-only closed-ticket reopen workflow is required.
