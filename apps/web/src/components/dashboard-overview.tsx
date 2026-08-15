import { ArrowRight, CheckCircle2, Clock3, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

import { PageHeader } from './ui'

export interface OverviewMetric {
  description: string
  icon: LucideIcon
  label: string
  value: number
}

interface DashboardOverviewProps {
  firstActionHref: string
  firstActionLabel: string
  metrics: readonly OverviewMetric[]
  portal: 'beauroi' | 'customer'
  title: string
}

export function DashboardOverview({
  firstActionHref,
  firstActionLabel,
  metrics,
  portal,
  title,
}: DashboardOverviewProps) {
  const empty = metrics.every((metric) => metric.value === 0)
  return (
    <div className="space-y-7">
      <PageHeader
        description={
          portal === 'beauroi'
            ? 'A current view of the customer portfolio and operational work.'
            : 'Your current implementation, support, and product-success priorities.'
        }
        eyebrow={portal === 'beauroi' ? 'Portfolio command center' : 'Organization workspace'}
        title={title}
      />
      <section aria-label="Workspace summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            className="rounded-lg border border-border bg-surface p-5 shadow-card"
            key={metric.label}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                {metric.label}
              </span>
              <metric.icon aria-hidden className="text-subtle" size={17} />
            </div>
            <p className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-foreground">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-subtle">{metric.description}</p>
          </article>
        ))}
      </section>
      {empty ? (
        <section className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card lg:grid-cols-[1fr_19rem]">
          <div className="p-6 sm:p-8">
            <span className="grid size-10 place-items-center rounded-md bg-success-soft text-success">
              <CheckCircle2 aria-hidden size={19} />
            </span>
            <h2 className="mt-5 font-display text-2xl font-semibold">Your workspace is ready.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              There is no operational activity to display yet. NEXORA has not inserted demonstration
              customers, tickets, projects, or progress data.
            </p>
            <Link
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
              href={firstActionHref}
            >
              {firstActionLabel} <ArrowRight aria-hidden size={15} />
            </Link>
          </div>
          <div className="border-t border-border bg-surface-subtle p-6 lg:border-t-0 lg:border-l">
            <p className="text-xs font-semibold tracking-[0.1em] text-subtle uppercase">
              What appears here
            </p>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {metrics.map((metric) => (
                <li className="flex items-start gap-2.5" key={metric.label}>
                  <Clock3 aria-hidden className="mt-0.5 shrink-0 text-subtle" size={15} />
                  <span>{metric.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="font-display text-xl font-semibold">Operational summary</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            These counts come from the secured workspace. Detailed workflows will be added module by
            module in later milestones.
          </p>
        </section>
      )}
    </div>
  )
}
