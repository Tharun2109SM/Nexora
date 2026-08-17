# Milestone 3: Product onboarding and implementation

Milestone 3 turns the existing onboarding and implementation foundations into governed, organization-scoped workflows. Beau Roi staff manage plans, projects, child work items, customer updates, and append-only notes. Customer members and administrators receive read-only views for their active organization.

## User workflows

### Beau Roi

- `/beauroi/onboarding` provides organization search, status/product/CSM filters, deterministic keyset pagination, current-page real counts, desktop table and mobile cards, and draft plan creation.
- `/beauroi/onboarding/:planId` manages plan lifecycle, dates, assigned CSM, customer update, checklist tasks, training sessions, requested-document metadata, readiness, and calculated progress.
- `/beauroi/implementation` provides organization search, status/product/phase filters, deterministic keyset pagination, real counts, and draft project creation.
- `/beauroi/implementation/:projectId` manages phase, status, dates, assigned implementation engineer, requirement summary, customer update, ordered milestones, timeline, and append-only shared/internal notes.

### Customer

- `/portal/onboarding` shows only the signed-in organization’s plans, checklist, training schedule, requested-document statuses, assigned CSM, customer update, target date, exceptions, and calculated progress.
- `/portal/implementation` shows only the signed-in organization’s projects, assigned engineer, phase, milestones, timeline, customer update, and shared notes.
- Both destinations are read-only. File upload is explicitly unavailable until Cloudflare R2 is configured.

## Authorization matrix

| Capability                      | Anonymous | Customer member/admin        | Beau Roi access                                               |
| ------------------------------- | --------- | ---------------------------- | ------------------------------------------------------------- |
| Read onboarding/implementation  | No        | Own active organization only | Active Beau Roi users                                         |
| Create or update onboarding     | No        | No                           | Admin, CSM, or account owner assigned to organization/product |
| Create or update implementation | No        | No                           | Admin, implementation lead, or engineer assigned to scope     |
| Delete workflow history         | No        | No                           | No through authenticated API                                  |
| Read shared project notes       | No        | Own active organization only | Active Beau Roi users                                         |
| Read internal project notes     | No        | No                           | Active Beau Roi users                                         |
| Update requirement summary      | No        | No                           | Assigned implementation staff or administrator, guarded RPC   |
| Add append-only project notes   | No        | No                           | Assigned implementation staff or administrator                |

The Express API applies role/organization middleware, but PostgreSQL remains authoritative. Every API query uses the caller’s bearer token and publishable key, so RLS remains active. No service-role key is used.

## Database changes

Migration `20260815145547_milestone_3_onboarding_implementation.sql` evolves the Milestone 1 tables in place:

- Adds focused onboarding, implementation, task, training, document, phase, delivery, and owner enums.
- Adds customer updates, readiness/completion fields, delivery metadata, owner type, and actual dates.
- Stores Beau Roi-only requirement summaries in `private.implementation_project_requirements`; no requirement column exists on an exposed table or view. Guarded public RPCs re-authorize `auth.uid()` before reading or updating it.
- Adds dedicated `workflow_status` and expanded date columns, then deterministically backfills them without renaming, dropping, or changing the type of legacy columns.
- Synchronizes legacy and Milestone 3 status/date columns during the rolling deployment window so the previously deployed application remains compatible.
- Independently preflights plan owners, task assignees/owner kind, training facilitators, requested-document recipients, and project owners. Invalid, inactive, cross-organization, or ambiguous history aborts with the affected row/user IDs instead of being rewritten or deleted.
- Adds date, text-length, owner, completion-state, and parent/tenant consistency constraints.
- Adds indexes for portfolios, filters, owners, schedules, overdue work, ordering, visibility, and missing foreign-key access paths.
- Adds `security_invoker` onboarding and implementation portfolio views. These calculate progress, blocked counts, and overdue counts from rows visible through RLS.
- Removes authenticated deletion for workflow tables. Project notes additionally revoke update and remain append-only.

Progress is calculated as:

```text
completed non-cancelled items / all non-cancelled items × 100
```

An empty checklist or milestone set reports `0%`. Clients cannot write a progress percentage.

## RLS and integrity model

- Existing tenant read policies continue to call active database membership checks.
- Beau Roi insert/update policies remain role-backed and are narrowed by assignment-aware guard triggers. An employee needs an active applicable `customer_assignments` row; organization-wide assignments use `product_id = null`, while product-specific assignments must match the workflow product. Active Beau Roi administrators are the explicit override.
- Onboarding writes accept only `CSM` and `ACCOUNT_OWNER` assignments. Implementation, milestone, internal-note, and requirement writes accept only `IMPLEMENTATION_LEAD` and `IMPLEMENTATION_ENGINEER` assignments. Ended assignments and suspended Beau Roi memberships never authorize mutations.
- Guard triggers reject inactive organizations, inactive products/subscriptions, mismatched parent/child organizations, ineligible assignees, forged authors, immutable identity changes, invalid lifecycle transitions, and inconsistent completion timestamps.
- Workflow owners and facilitators must have an active Beau Roi membership. Customer task/document owners must have an active membership in the target customer organization.
- All new private trigger functions use `SECURITY DEFINER`, `search_path = ''`, explicit caller authorization, and no `PUBLIC`, `anon`, or `authenticated` execute grant. They are trigger-only implementation details.
- Audit triggers record operation, entity, status/visibility, actor, organization, and request context. Note bodies, requirement text, and customer updates are not copied into audit metadata.
- New workflows require an active customer, product, and subscription. After parent or scope deactivation, plans/projects may only close; tasks, training, and milestones may only move to `CANCELLED`; open document requests may only move to `WAIVED`; and unrelated child edits, new children, notes, and requirement changes are rejected.

## Rolling-deployment compatibility

Milestone 3 is the expand phase. The legacy `status`, `target_completion_on`, `target_go_live_on`, and `actual_go_live_on` fields remain present where the old application expects them. Compatibility triggers synchronize those fields with the new workflow statuses and dates.

The pre-Milestone-3 application was audited before this change: it had dashboard count reads for the legacy workflow `status` columns but no Express onboarding or implementation mutation routes. Those reads remain valid, and the compatibility test additionally proves legacy `DRAFT → ACTIVE` writes synchronize to the new status model.

After the new API and web application are deployed and the coexistence window has been observed, a separate reviewed contract migration should:

1. Confirm no deployed client reads or writes the legacy workflow fields.
2. Remove the compatibility triggers and `private.sync_workflow_compatibility()`.
3. Remove redundant legacy status/date columns and their obsolete indexes/defaults.
4. Re-run populated migration, RLS, API, and rollback tests before deployment.

Do not combine that destructive cleanup with this migration.

## Internal-note security

`project_notes.visibility` is either `SHARED` or `INTERNAL`.

- Customer RLS permits only `SHARED` rows for the caller’s active organization.
- The customer endpoint also explicitly filters `visibility = 'SHARED'` and selects a safe field list.
- The Beau Roi detail endpoint can return both classes.
- Notes are append-only; authenticated update/delete privileges and policies are absent.
- Internal note bodies are excluded from audit metadata.

## API endpoints

All endpoints are under `/v1` and require a caller bearer JWT.

| Method    | Endpoint                                        | Access              | Purpose                                                       |
| --------- | ----------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| GET       | `/workflow-options`                             | Beau Roi            | Active customers, products, subscriptions, and eligible staff |
| GET/POST  | `/onboarding`                                   | Beau Roi            | Paginated portfolio / create draft plan                       |
| GET/PATCH | `/onboarding/:planId`                           | Beau Roi            | Plan workspace / update plan                                  |
| POST      | `/onboarding/:planId/tasks`                     | Beau Roi            | Add checklist task                                            |
| PATCH     | `/onboarding-tasks/:taskId`                     | Beau Roi            | Update checklist task                                         |
| POST      | `/onboarding/:planId/training-sessions`         | Beau Roi            | Schedule training                                             |
| PATCH     | `/training-sessions/:trainingId`                | Beau Roi            | Update training                                               |
| POST      | `/onboarding/:planId/requested-documents`       | Beau Roi            | Add document request metadata                                 |
| PATCH     | `/requested-documents/:documentId`              | Beau Roi            | Update document request status                                |
| GET       | `/organizations/:organizationId/onboarding`     | Organization access | Customer-safe read model                                      |
| GET/POST  | `/implementations`                              | Beau Roi            | Paginated portfolio / create project                          |
| GET/PATCH | `/implementations/:projectId`                   | Beau Roi            | Project workspace / update project                            |
| POST      | `/implementations/:projectId/milestones`        | Beau Roi            | Add milestone                                                 |
| PATCH     | `/milestones/:milestoneId`                      | Beau Roi            | Update milestone                                              |
| POST      | `/implementations/:projectId/notes`             | Beau Roi            | Add append-only shared/internal note                          |
| GET       | `/organizations/:organizationId/implementation` | Organization access | Customer-safe read model with shared notes only               |

Collection limits are bounded to 100. Portfolio cursors encode the selected sort, organization name, and UUID tie-breaker. Search and filters are validated by shared strict Zod contracts.

## Testing

```bash
pnpm format:check
pnpm lint
pnpm type-check
pnpm test
pnpm build
pnpm exec supabase db reset
supabase/compatibility/test-milestone3-upgrade.sh
pnpm exec supabase test db
pnpm exec supabase db lint
pnpm exec supabase db advisors --local
docker build -f apps/api/Dockerfile -t nexora-api:milestone-3 .
```

The Milestone 3 pgTAP suite covers anonymous/customer/cross-tenant/inactive rejection, assignment-scoped mutation authorization, administrator override, parent/scope child freezing, internal-note isolation, assignee eligibility, invalid transitions and timestamps, calculated progress, audit events, grants, and RLS preservation. The populated upgrade harness runs each historical-assignee preflight independently. Application tests cover shared validation, progress calculation, filter URL cursor reset, API role/tenant checks, oversized values, and consistent errors.

## Deployment order

1. Review the migration and local verification output.
2. Apply the Supabase migration in a controlled maintenance window.
3. Deploy the caller-scoped Express API.
4. Verify API health/readiness and customer-safe responses.
5. Deploy the Next.js web application.
6. Run authenticated smoke tests as Beau Roi and two different customer organizations.

This change does not deploy anything automatically.

## Known external blockers

- Cloudflare R2 is not configured, so document file upload remains unavailable by design.
- No production administrative account, SMTP provider, billing decision, DNS ownership, or cloud credential is created by this milestone.
- Final company-approved legal text and a production security review remain launch requirements.
