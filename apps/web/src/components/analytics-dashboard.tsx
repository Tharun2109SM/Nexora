import type {
  analyticsOverviewSchema,
  customerAnalyticsSummarySchema,
  customerSuccessPortfolioItemSchema,
} from '@nexora/contracts'
import { Activity, ArrowRight, BarChart3, CircleAlert } from 'lucide-react'
import Link from 'next/link'
import type { z } from 'zod'

import { cn } from '@/lib/utils'

import { EmptyState, buttonClassName } from './ui'

type Overview = z.infer<typeof analyticsOverviewSchema>
type Customer = z.infer<typeof customerSuccessPortfolioItemSchema>
type CustomerSummary = z.infer<typeof customerAnalyticsSummarySchema>
function MetricCard({ label, note, value }: { label: string; note: string; value: number | null }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
      <p className="mt-4 font-display text-4xl font-semibold tracking-tight">{value ?? '—'}</p>
      <p className="mt-1 text-xs text-subtle">{value === null ? 'No data yet' : note}</p>
    </article>
  )
}
function percentage(met: number, eligible: number) {
  return eligible ? Math.round((met / eligible) * 100) : null
}
export function Distribution({ label, values }: { label: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b))
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  if (!total)
    return (
      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
        No {label.toLowerCase()} data yet.
      </div>
    )
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h3 className="font-display text-lg font-semibold">{label}</h3>
      <dl className="mt-5 space-y-4">
        {entries.map(([name, value]) => {
          const share = Math.round((value / total) * 100)
          return (
            <div key={name}>
              <div className="flex justify-between gap-4 text-sm">
                <dt>{name.replaceAll('_', ' ')}</dt>
                <dd className="font-semibold">
                  {value} · {share}%
                </dd>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle"
                aria-label={`${name}: ${value} of ${total}`}
                role="img"
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
              </div>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
export function AnalyticsOverview({ overview }: { overview: Overview }) {
  const completion = overview.onboarding.eligible
    ? Math.round((overview.onboarding.completed / overview.onboarding.eligible) * 100)
    : null
  return (
    <div className="space-y-6">
      <section aria-label="Portfolio metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active customers"
          note="active customer organizations"
          value={overview.customers.active}
        />
        <MetricCard
          label="Active support"
          note="tickets awaiting work"
          value={overview.support.active}
        />
        <MetricCard
          label="Onboarding completion"
          note="within selected window (%)"
          value={completion}
        />
        <MetricCard
          label="SLA breaches"
          note="deterministically overdue tickets"
          value={overview.support.breached}
        />
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <Distribution label="Customer lifecycle" values={overview.customers.lifecycle} />
        <Distribution label="Support status" values={overview.support.statuses} />
        <Distribution label="Feedback type" values={overview.feedback.types} />
      </div>
      <section className="grid gap-4 rounded-lg border border-border bg-surface p-5 shadow-card md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="First-response SLA"
          note="eligible observations (%)"
          value={percentage(
            overview.support.firstResponseMet,
            overview.support.firstResponseEligible,
          )}
        />
        <MetricCard
          label="Resolution SLA"
          note="eligible observations (%)"
          value={percentage(overview.support.resolutionMet, overview.support.resolutionEligible)}
        />
        <MetricCard
          label="Published releases"
          note="in the selected window"
          value={overview.delivery.publishedReleases}
        />
        <MetricCard
          label="Published guidance"
          note="in the selected window"
          value={overview.delivery.publishedArticles}
        />
      </section>
    </div>
  )
}
export function CustomerSuccessPortfolio({
  customers,
  nextHref,
}: {
  customers: Customer[]
  nextHref: string | null
}) {
  if (!customers.length)
    return (
      <EmptyState
        description="No real customer organizations match these portfolio filters."
        icon={<BarChart3 size={19} />}
        title="No customer-success data"
      />
    )
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
        <table className="w-full min-w-[58rem] text-left text-sm">
          <thead className="border-b border-border bg-surface-subtle text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Workflows</th>
              <th className="px-4 py-3">Support</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-4">
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-xs text-subtle">
                    {customer.lifecycleStatus.replaceAll('_', ' ')}
                  </p>
                </td>
                <td className="px-4 py-4">
                  {customer.healthScore ?? <span className="text-subtle">No score</span>}
                </td>
                <td className="px-4 py-4">
                  <p>
                    {customer.onboardingActive} onboarding · {customer.implementationActive}{' '}
                    implementation
                  </p>
                  {customer.onboardingOverdue && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-danger">
                      <CircleAlert size={13} />
                      Onboarding overdue
                    </p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <p>
                    {customer.activeTickets} active · {customer.urgentTickets} urgent
                  </p>
                  {customer.slaBreaches > 0 && (
                    <p className="mt-1 text-xs text-danger">
                      {customer.slaBreaches} SLA breach{customer.slaBreaches === 1 ? '' : 'es'}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4">
                  {customer.csmName ?? <span className="text-subtle">Unassigned</span>}
                </td>
                <td className="px-4 py-4">
                  <Link
                    className="text-accent hover:underline"
                    href={`/beauroi/customers/${customer.id}`}
                  >
                    Open <ArrowRight className="inline" size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextHref && (
        <div className="flex justify-end">
          <Link className={buttonClassName('secondary')} href={nextHref}>
            Next customers <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </div>
  )
}
export function CustomerAnalyticsSummary({ summary }: { summary: CustomerSummary }) {
  const values = [
    summary.onboardingActive,
    summary.implementationActive,
    summary.activeTickets,
    summary.pendingActions,
    summary.recentReleases,
    summary.publishedArticles,
  ]
  if (values.every((value) => value === 0) && !summary.healthHistory.length)
    return (
      <section className="rounded-lg border border-border bg-surface p-6 shadow-card">
        <Activity className="text-muted" size={20} />
        <h2 className="mt-4 font-display text-xl font-semibold">No organization activity yet</h2>
        <p className="mt-2 text-sm text-muted">
          This summary will populate only from real onboarding, implementation, support, release,
          and knowledge records.
        </p>
      </section>
    )
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-semibold">Organization success summary</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Active onboarding"
          note="current plans"
          value={summary.onboardingActive}
        />
        <MetricCard
          label="Implementation"
          note="active projects"
          value={summary.implementationActive}
        />
        <MetricCard
          label="Pending actions"
          note="open onboarding tasks"
          value={summary.pendingActions}
        />
        <MetricCard label="Active tickets" note="support work" value={summary.activeTickets} />
        <MetricCard
          label="Recent releases"
          note={`in ${summary.window.toLowerCase()}`}
          value={summary.recentReleases}
        />
        <MetricCard
          label="Published guidance"
          note={`in ${summary.window.toLowerCase()}`}
          value={summary.publishedArticles}
        />
      </div>
      {summary.healthHistory.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
          <h3 className="font-display text-lg font-semibold">Health history</h3>
          <ol
            className="mt-4 flex items-end gap-2 overflow-x-auto"
            aria-label="Health score history"
          >
            {summary.healthHistory.map((point) => (
              <li className="flex min-w-14 flex-col items-center gap-2" key={point.calculatedAt}>
                <span className="text-xs font-semibold">{point.score}</span>
                <span
                  className={cn('w-8 rounded-t bg-accent')}
                  style={{ height: `${Math.max(point.score, 4)}px` }}
                  aria-label={`${new Date(point.calculatedAt).toLocaleDateString()}: ${point.score}`}
                />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
