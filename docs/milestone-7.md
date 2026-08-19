# Milestone 7 — Knowledge Base

Milestone 7 evolves the original `knowledge_base_articles` table through the additive `20260819162041_milestone_7_knowledge_base.sql` migration. Existing identity, content, and legacy lifecycle columns are preserved; the new controlled fields are authoritative.

## Domain and lifecycle

- Article types: `GUIDE`, `FAQ`, `REFERENCE`, `TROUBLESHOOTING`, and `ANNOUNCEMENT`.
- Lifecycle: `DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`, with `IN_REVIEW → DRAFT` as the correction path. Published content, classification, and audience cannot be silently rewritten.
- Configurable categories can be global or product-specific and can be deactivated without deleting history.
- Audience modes are `INTERNAL`, `ALL_CUSTOMERS`, `PRODUCT_SCOPED`, and `SELECTED_ORGANIZATION`. Product and organization scope are database-validated.
- Article events are append-only. Audit metadata records identifiers and controlled transitions, never article bodies.
- Content is bounded plain text. External resources accept only validated HTTP/HTTPS URLs and open with safe external-link attributes. Arbitrary HTML and executable embeds are not supported.

## Authorization and visibility

- Active `BEAUROI_ADMIN` members manage categories, content, scope, and lifecycle through narrow caller-JWT `SECURITY DEFINER` RPCs.
- Active `BEAUROI_EMPLOYEE` members have a read-only staff portfolio.
- Customer reads require an active customer membership, a `PUBLISHED` article, an eligible audience, and an active date-valid subscription for product-scoped content.
- Organization-targeted content is limited to the selected organization. Internal, draft, review, and archived records are excluded by RLS.
- Direct authenticated insert/update/delete and event forgery are revoked. Staff author/reviewer/publisher identity columns are not granted to `authenticated`.
- All new definer functions use an empty `search_path`; private helpers are not executable by browser roles.

## Search, API, and interface

PostgreSQL generates an English `tsvector` from title, summary, and body and indexes it with GIN. API filtering occurs on the RLS-constrained relation, so unauthorized content is never fetched and filtered in Node.

The Express API provides staff/customer portfolio and detail projections, category/product metadata, cursor pagination, search and filters, plus narrow article/category mutation endpoints. Customer response schemas reject staff lifecycle history and identity metadata.

The real routes are `/beauroi/knowledge-base` and `/portal/knowledge-base`, matching the existing navigation. Staff receive a management workspace or an explicit read-only state. Customers receive a documentation-focused list and article reader. Loading, failure, filtered-empty, and no-content states are explicit.

R2 remains optional. APIs return `attachmentsAvailable`; when false, the UI explains that attachments are unavailable and renders no upload input, fake link, object key, or credential.

## Notifications and compatibility

Explicit publication creates in-app notifications only for active eligible customer members. Internal content creates none. Payloads contain a bounded title and role-safe portal link, not article bodies or private audience metadata.

`supabase/compatibility/test-milestones7-8-upgrade.sh` proves a populated Milestone 6 database upgrades through Milestone 7 and independently rejects invalid historical content and duplicate global slugs before schema mutation. `supabase/tests/milestone_7_knowledge_security.sql` covers grants, lifecycle, audience/subscription isolation, search visibility, notifications, immutable history, audit safety, and trusted cleanup.

## Known limitations

- R2 credentials and attachment endpoints remain external work.
- Production categories and articles are company content and are deliberately not seeded.
- Rich text, arbitrary embeds, readership/adoption tracking, and non-admin publishing permissions require separate approval.
