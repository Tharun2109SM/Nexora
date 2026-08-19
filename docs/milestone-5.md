# Milestone 5 — Feedback Management

Milestone 5 adds a complete multi-tenant feedback workflow on the existing `feedback`, `bug_reports`, `feature_requests`, and `feature_votes` foundation. The additive migration is `20260819064421_milestone_5_feedback_management.sql`.

## Domain and lifecycle

- Types: `GENERAL`, `BUG`, and `FEATURE_REQUEST`.
- Feedback status is authoritative: `SUBMITTED → UNDER_REVIEW → PLANNED/IN_PROGRESS → SHIPPED`, with controlled decline paths. `SHIPPED` and `DECLINED` are terminal.
- Bug severity defaults safely to `MEDIUM` and can be changed only by authorized staff. Priority is staff-owned.
- Messages and events are append-only. Customer-visible responses and internal triage notes are separate records and separate projections.
- Attachments are intentionally unavailable until private R2 storage is configured. No object key is returned.

## Authorization and visibility

- Customer organization and requester identity are derived from the authenticated database identity, never request fields.
- Customer users can create and read their organization’s submissions and add customer-visible responses.
- Feature requests are private by default. Cross-company discovery requires an authorized staff member to explicitly set `is_public`; the discovering customer must have an active subscription to the same product.
- Public cross-company projections deliberately anonymize the owning organization and requester because tenant RLS does not expose those related records.
- Staff mutations require an active Beau Roi administrator or an active matching `CSM`/`ACCOUNT_OWNER` assignment. Product-specific assignments must match; organization-wide assignments use a null product.
- Direct authenticated inserts, updates, and deletes are revoked from workflow tables. Narrow `SECURITY DEFINER` RPCs enforce authorization with `auth.uid()` and fixed empty search paths.
- Internal notes and private events are filtered by RLS and excluded again from customer API contracts.

## Voting

- Only feature requests may be voted on.
- A customer may vote on its own request or an explicitly public request for a subscribed product.
- `(feature_request_id, user_id)` enforces one vote per user. Vote RPCs are idempotent and derive both user and organization from the caller.
- Raw vote rows and voter identities are not selectable by authenticated users. The safe summary RPC returns only count and whether the current caller voted.

## API

Customer:

- `GET /v1/feedback`, `GET /v1/feedback/:feedbackId`
- `GET /v1/feedback/products`
- `POST /v1/feedback`
- `POST /v1/feedback/:feedbackId/messages`
- `POST|DELETE /v1/feedback/:feedbackId/vote`

Beau Roi:

- `GET /v1/feedback/queue`, `GET /v1/feedback/filter-metadata`
- `GET /v1/feedback/:feedbackId`
- `POST /v1/feedback/:feedbackId/responses`
- `POST /v1/feedback/:feedbackId/internal-notes`
- `PATCH /v1/feedback/:feedbackId/status`
- `PATCH /v1/feedback/:feedbackId/triage`

All routes use caller-scoped JWT Supabase clients, strict Zod contracts, safe error mapping, and bounded cursor pagination. Mutations are not retried automatically.

## Notifications

Submission, customer-visible response, status, and publication events create recipient-scoped in-app notifications with role-safe `/beauroi/feedback/:id` or `/portal/feedback/:id` links. Internal notes and votes do not create notification noise. Notification bodies contain only the bounded feedback title, never descriptions, notes, vote identities, or storage data.

## User interfaces

- `/beauroi/feedback` provides staff inbox filters, responsive table/cards, detail context, voting insight, status workflow, triage, publication, internal notes, visible responses, history, and honest storage state.
- `/portal/feedback` separates the organization collection from explicitly public feature requests and supports all three submission types, detail tracking, discussion, voting, loading, error, and empty states.
- Existing Bevellier/Supreme typography, semantic tokens, theme behavior, reduced-motion support, focus styling, and responsive shell are reused.

## Remaining company/configuration decisions

- Define any future feedback category taxonomy beyond the three approved types.
- Decide whether public feature requests should ever expose the owning organization name; the current safe projection exposes neither organization nor requester identity across companies.
- Configure Cloudflare R2 before enabling evidence attachments.
- Select an email provider if feedback email notifications are required; this milestone provides in-app notifications only.
