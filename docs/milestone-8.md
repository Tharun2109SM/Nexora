# Milestone 8 — Analytics & Customer Success

Milestone 8 adds `20260819162042_milestone_8_analytics_success.sql`: focused aggregate indexes and three caller-authorized, fixed-search-path SQL functions. It stores no derived warehouse data, adds no background job, and does not invent a health or risk formula.

## Authorization and architecture

- Active `BEAUROI_ADMIN` and `BEAUROI_EMPLOYEE` memberships can read staff aggregates and the customer-success portfolio.
- Customers can call only a no-organization-argument summary function. PostgreSQL derives their active primary customer organization from `auth.uid()`.
- Unassigned users and customer attempts to call staff aggregates fail. Aggregate functions never accept caller identity from request bodies.
- The Express layer uses the caller JWT and strict response schemas. Node does not load raw operational tables to aggregate them.
- Time windows are `7D`, `30D`, `90D`, and `ALL`. Unsupported windows fail with `22023`.

## Exact metric definitions

- Active customers: active organizations whose type is `CUSTOMER`; lifecycle distribution groups those same organizations.
- Active onboarding: plans created in the selected window with status `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, or `READY_FOR_GO_LIVE`.
- Completed onboarding: plans created in the window whose status is `LIVE`. Completion percentage is completed divided by non-cancelled eligible plans; zero eligible plans display “No data yet.”
- Overdue onboarding plans/tasks: unfinished records whose target/due time is before database current date/time.
- Active implementation: projects created in the window with status `NOT_STARTED`, `IN_PROGRESS`, or `BLOCKED`. Completed counts use `COMPLETED`. Overdue milestones are unfinished milestones past `due_on`.
- Active support: tickets created in the window with status `OPEN`, `IN_PROGRESS`, or `WAITING_ON_CUSTOMER`.
- Breached support: a first-response or resolution deadline is earlier than its actual timestamp, or earlier than now while still outstanding.
- Average response/resolution minutes: arithmetic mean of completed observations only. No observations return `null`, never zero, NaN, or Infinity.
- SLA percentages: observations met divided by eligible completed observations. No eligible observations display “No data yet.”
- Feedback totals/distributions: records created in the window, grouped by controlled category/status. Published features require `FEATURE_REQUEST` and `is_public`; votes count real vote rows.
- Delivery: releases published in the window, future scheduled releases, scheduled/active maintenance, and knowledge articles published in the window. Article type distribution uses published articles only.
- Health: latest portfolio score is the newest `health_score_history` record. Customer history is chronological and includes the stored score, timestamp, and approved reason. No automated formula is applied.
- Customer-success signals show real onboarding, implementation, support, SLA, feedback, assignment, and health values separately; there is no opaque composite risk score.

Organization/product filters are applied in aggregate SQL. Product-filtered customer totals require an active date-valid subscription. Organization-filtered release, maintenance, and knowledge delivery counts require the same customer eligibility and audience targeting used by their customer-facing workflows. The customer portfolio uses bounded keyset pagination. Accessible textual values accompany every distribution bar, which works in both themes and does not depend on color alone.

## Interface and customer summary

`/beauroi/analytics` provides URL-persisted period, organization, product, and portfolio-search filters; operational metric cards; accessible distributions; and a horizontally self-contained portfolio table linking to canonical customer detail pages. Empty aggregates are explicit.

The existing customer dashboard is enhanced with its own organization-scoped summary for onboarding, implementation, pending actions, support, releases, maintenance, knowledge, feedback, and health history. Beau Roi portfolio totals are never exposed to customer routes.

## Performance, verification, and limitations

Composite indexes support the aggregate predicates. Aggregation occurs in PostgreSQL in bounded requests, and the portfolio avoids N+1 API calls. `supabase/tests/milestone_8_analytics_security.sql` validates zero/populated behavior, windows, product filters, health ordering, latest-score selection, cross-tenant isolation, grants, and null averages. The combined compatibility harness proves populated M7→M8 operation.

Known limitations: no knowledge readership telemetry, ticket-volume time series, business-hours SLA calendar, automated health formula, or external warehouse exists. Those metrics must remain absent until real source data and company-approved definitions exist.
