# Milestone 6 — Release Management

Milestone 6 evolves the existing `product_releases` and `maintenance_notices` tables through the additive `20260819150707_milestone_6_release_management.sql` migration. The legacy lifecycle columns remain compatibility mirrors for existing dashboards; the new release and maintenance status columns are authoritative.

## Release model and lifecycle

- Releases belong to one active product and use a bounded, product-unique version identifier. Product and version are immutable after creation.
- Lifecycle: `DRAFT → SCHEDULED → PUBLISHED → ARCHIVED`. A scheduled release may return to draft, and a draft may publish directly. All other transitions are rejected.
- Publication is explicit. Scheduled releases require a future schedule. Customer visibility and publication timestamps are controlled by the transition RPC, not browser input.
- Title, summary, plain-text notes, and controlled structured sections support new features, improvements, bug fixes, security, deprecations, and important changes. Raw HTML is not accepted or rendered.
- Release and maintenance events are append-only. Important lifecycle mutations also write audit events.

## Authorization and audience

- Only an active `BEAUROI_ADMIN` membership may create or mutate release and maintenance records. Ordinary Beau Roi employees have a read-only workspace. This conservative policy avoids treating tenant-scoped customer assignments as product-wide publishing authority.
- Customers require an active customer membership and active subscription to the release product.
- Audience is either every active subscriber or an explicit relational set of eligible customer organizations. Product-specific subscription eligibility is checked inside PostgreSQL.
- Customers cannot read target rows, draft records, private history, audit metadata, or staff capability fields. Direct authenticated table mutations are revoked; narrow caller-JWT `SECURITY DEFINER` functions use fixed empty search paths.

## Maintenance notices

- Lifecycle: `DRAFT → SCHEDULED → ACTIVE → COMPLETED`, with controlled unscheduling and cancellation paths.
- Staff administrators can create, edit, target, schedule, activate, complete, and cancel notices. Content and audience become immutable after activation.
- Customers see only intentionally visible notices for subscribed products and their eligible audience. No internal planning fields are exposed.

## API and interfaces

- Staff APIs provide filtered/cursor-paginated release and maintenance queues, release detail, draft creation, narrow content/section/audience/lifecycle mutations, and feature-request linking.
- Customer APIs return separate strict projections for eligible releases, release detail, maintenance, and authoritative current versions. When no deployed-version source exists, the UI states `Current version unavailable` instead of inferring one.
- `/beauroi/releases` provides creation, filtering, editing, audience targeting, publication, history, maintenance management, and read-only behavior for non-admin staff.
- `/portal/releases` provides entitled releases, structured notes, current-version availability, and relevant maintenance with responsive loading, error, and empty states.
- R2 is optional. When it is not configured, the detail view shows an honest unavailable state and exposes neither upload controls nor object keys.

## Notifications and feedback association

- Eligible customer members receive scoped in-app notifications for release scheduling/publication and maintenance scheduling, customer-visible updates, activation, completion, and cancellation.
- Notifications use safe portal deep links and bounded titles; private notes and rollout details are excluded.
- A staff-only relation can link a `PLANNED`, `IN_PROGRESS`, or `SHIPPED` feature request to a draft or scheduled release for the same product. The milestone does not automatically change feedback status or expose private requests across tenants.

## Verification

- `supabase/tests/milestone_6_release_security.sql` covers privileges, RLS visibility, targeting, transitions, immutability, notifications, history, maintenance, feature links, and trusted cleanup.
- The populated-upgrade harness covers valid Milestone 5 data plus independent duplicate-version, invalid-version, invalid-target, and invalid-maintenance preflight failures.
- Contract, API, web, production-build, local-browser, Docker health/readiness, schema-lint, and advisor checks form the final verification matrix.

## Remaining company and external decisions

- Decide whether product-wide release authority should later include a dedicated permission beyond `BEAUROI_ADMIN`.
- Add an authoritative deployed-version source before displaying a customer current version.
- Configure private Cloudflare R2 before release attachments can be enabled.
- Decide whether future rollout cohorts or release-to-maintenance associations are needed.
- Configure external email delivery separately if in-app notifications are insufficient.
