import { AlertTriangle, ArrowRight, Clock3, Headphones, Hourglass, Inbox } from 'lucide-react'
import Link from 'next/link'

import { supportPageMetrics, supportTone, type SupportTicketListItem } from '@/lib/support-data'
import { cn } from '@/lib/utils'

import { EmptyState, buttonClassName } from './ui'

export function SupportQueue({
  filtered,
  nextHref,
  rows,
}: {
  filtered: boolean
  nextHref: string | null
  rows: SupportTicketListItem[]
}) {
  const metrics = supportPageMetrics(rows)
  return (
    <>
      <section
        aria-label="Current filtered page summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric icon={<Headphones size={17} />} label="Active tickets" value={metrics.active} />
        <Metric icon={<AlertTriangle size={17} />} label="Urgent tickets" value={metrics.urgent} />
        <Metric
          icon={<Hourglass size={17} />}
          label="Waiting on customer"
          value={metrics.waiting}
        />
        <Metric icon={<Clock3 size={17} />} label="SLA attention" value={metrics.slaAttention} />
      </section>
      {rows.length === 0 ? (
        <EmptyState
          description={
            filtered
              ? 'No tickets match the selected filters. Clear filters or adjust the subject search.'
              : 'No real support tickets are currently available in the staff queue.'
          }
          icon={<Inbox aria-hidden size={19} />}
          note="No sample or fabricated support records are shown."
          title={filtered ? 'No matching tickets' : 'Support queue is clear'}
        />
      ) : (
        <>
          <div className="hidden max-w-full overflow-x-auto rounded-lg border border-border bg-surface shadow-card xl:block">
            <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
              <thead className="bg-surface-subtle text-xs font-semibold tracking-[0.06em] text-subtle uppercase">
                <tr>
                  <th className="px-5 py-3">Ticket</th>
                  <th className="px-4 py-3">Customer / product</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <TicketTableRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 xl:hidden">
            {rows.map((row) => (
              <TicketCard key={row.id} row={row} />
            ))}
          </div>
          {nextHref && (
            <div className="flex justify-end">
              <Link className={buttonClassName('secondary')} href={nextHref}>
                Next page <ArrowRight aria-hidden size={15} />
              </Link>
            </div>
          )}
        </>
      )}
    </>
  )
}

export function SupportBadge({ value }: { value: string }) {
  const tone = supportTone(value)
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
        tone === 'danger' && 'border-danger/30 bg-danger-soft text-danger',
        tone === 'warning' && 'border-warning/30 bg-warning-soft text-warning',
        tone === 'success' && 'border-success/30 bg-success-soft text-success',
        tone === 'muted' && 'border-border bg-surface-subtle text-muted',
      )}
    >
      <span className="sr-only">State: </span>
      {value.replaceAll('_', ' ')}
    </span>
  )
}

function TicketTableRow({ row }: { row: SupportTicketListItem }) {
  return (
    <tr className="hover:bg-surface-subtle/60">
      <td className="max-w-xs px-5 py-4">
        <p className="text-xs font-semibold text-accent">{row.reference}</p>
        <p className="mt-1 truncate font-semibold text-foreground" title={row.subject}>
          {row.subject}
        </p>
        <p className="mt-1 text-xs text-subtle">Created {formatDate(row.createdAt)}</p>
      </td>
      <td className="px-4 py-4">
        <p className="font-medium">{row.organization.name}</p>
        <p className="text-xs text-muted">{row.product?.name ?? 'Product unavailable'}</p>
      </td>
      <td className="px-4 py-4">
        <SupportBadge value={row.status} />
      </td>
      <td className="px-4 py-4">
        <SupportBadge value={row.priority} />
      </td>
      <td className="px-4 py-4 text-muted">{row.category?.name ?? 'Uncategorized'}</td>
      <td className="px-4 py-4 text-muted">{row.assignee?.fullName ?? 'Unassigned'}</td>
      <td className="px-4 py-4">
        <SlaCompact row={row} />
      </td>
      <td className="px-4 py-4 text-muted">{formatDateTime(row.lastActivityAt)}</td>
      <td className="pr-4">
        <Link
          aria-label={`Open ${row.reference}: ${row.subject}`}
          className="grid size-9 place-items-center rounded-md hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent"
          href={`/beauroi/support/${row.id}`}
        >
          <ArrowRight aria-hidden size={16} />
        </Link>
      </td>
    </tr>
  )
}

function TicketCard({ row }: { row: SupportTicketListItem }) {
  return (
    <Link
      className="rounded-lg border border-border bg-surface p-5 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      href={`/beauroi/support/${row.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-accent">{row.reference}</p>
          <h2 className="mt-1 font-display text-lg font-semibold">{row.subject}</h2>
          <p className="mt-1 text-sm text-muted">
            {row.organization.name} · {row.product?.name ?? 'Product unavailable'}
          </p>
        </div>
        <ArrowRight aria-hidden className="shrink-0 text-subtle" size={18} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <SupportBadge value={row.status} />
        <SupportBadge value={row.priority} />
        <SupportBadge value={row.sla.resolution.state} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-xs text-subtle">Category</dt>
          <dd className="font-medium">{row.category?.name ?? 'Uncategorized'}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Assignee</dt>
          <dd className="font-medium">{row.assignee?.fullName ?? 'Unassigned'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-subtle">Last activity</dt>
          <dd>{formatDateTime(row.lastActivityAt)}</dd>
        </div>
      </dl>
    </Link>
  )
}

function SlaCompact({ row }: { row: SupportTicketListItem }) {
  if (!row.sla.policyConfigured) return <span className="text-xs text-subtle">Not configured</span>
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted">
        Response{' '}
        <strong
          className={row.sla.response.state === 'BREACHED' ? 'text-danger' : 'text-foreground'}
        >
          {row.sla.response.state.replaceAll('_', ' ')}
        </strong>
      </span>
      <span className="text-xs text-muted">
        Resolution{' '}
        <strong
          className={row.sla.resolution.state === 'BREACHED' ? 'text-danger' : 'text-foreground'}
        >
          {row.sla.resolution.state.replaceAll('_', ' ')}
        </strong>
      </span>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <p className="text-xs font-semibold tracking-wide uppercase">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-subtle">Current filtered page</p>
    </div>
  )
}

export function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
    : 'Not available'
}
export function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Not available'
}
