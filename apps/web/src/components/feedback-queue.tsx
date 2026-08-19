import { ArrowRight, Inbox, ThumbsUp } from 'lucide-react'
import Link from 'next/link'

import type { FeedbackListItem } from '@/lib/feedback-data'
import { feedbackTone } from '@/lib/feedback-data'
import { cn } from '@/lib/utils'

import { formatDateTime } from './support-queue'
import { EmptyState, buttonClassName } from './ui'

export function FeedbackBadge({ value }: { value: string }) {
  const tone = feedbackTone(value)
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
export function FeedbackQueue({
  filtered,
  nextHref,
  rows,
  staff,
}: {
  filtered: boolean
  nextHref: string | null
  rows: FeedbackListItem[]
  staff: boolean
}) {
  if (!rows.length)
    return (
      <EmptyState
        description={
          filtered
            ? 'No submissions match the selected filters.'
            : 'No real feedback submissions are available in this collection.'
        }
        icon={<Inbox aria-hidden size={19} />}
        note="No sample or fabricated feedback records are shown."
        title={filtered ? 'No matching feedback' : 'No feedback yet'}
      />
    )
  const root = staff ? '/beauroi/feedback' : '/portal/feedback'
  return (
    <div className="space-y-4">
      <div className="hidden max-w-full overflow-x-auto rounded-lg border border-border bg-surface shadow-card xl:block">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs font-semibold tracking-[.06em] text-subtle uppercase">
            <tr>
              <th className="px-5 py-3">Submission</th>
              {staff && <th className="px-4 py-3">Customer</th>}
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Triage</th>
              <th className="px-4 py-3">Activity</th>
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr className="hover:bg-surface-subtle/60" key={row.id}>
                <td className="max-w-sm px-5 py-4">
                  <p className="truncate font-semibold" title={row.title}>
                    {row.title}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {row.requester?.fullName ?? 'Requester not disclosed'}
                  </p>
                </td>
                {staff && <td className="px-4 py-4">{row.organization?.name ?? 'Unavailable'}</td>}
                <td className="px-4 py-4 text-muted">{row.product.name}</td>
                <td className="px-4 py-4">
                  <FeedbackBadge value={row.type} />
                </td>
                <td className="px-4 py-4">
                  <FeedbackBadge value={row.status} />
                </td>
                <td className="px-4 py-4 text-muted">
                  {row.type === 'FEATURE_REQUEST' ? (
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp size={14} />
                      {row.votes.count} votes
                    </span>
                  ) : (
                    (row.severity ?? row.priority ?? 'Not set')
                  )}
                </td>
                <td className="px-4 py-4 text-muted">{formatDateTime(row.lastActivityAt)}</td>
                <td className="pr-4">
                  <Link
                    aria-label={`Open feedback: ${row.title}`}
                    className="grid size-9 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-accent"
                    href={`${root}/${row.id}`}
                  >
                    <ArrowRight aria-hidden size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 xl:hidden">
        {rows.map((row) => (
          <Link
            className="rounded-lg border border-border bg-surface p-5 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href={`${root}/${row.id}`}
            key={row.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-accent">
                  {staff ? (row.organization?.name ?? 'Unavailable') : row.product.name}
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold">{row.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {row.product.name} · {row.requester?.fullName ?? 'Requester not disclosed'}
                </p>
              </div>
              <ArrowRight className="shrink-0 text-subtle" size={18} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <FeedbackBadge value={row.type} />
              <FeedbackBadge value={row.status} />
              {row.isPublic && <FeedbackBadge value="PUBLIC" />}
            </div>
            {row.type === 'FEATURE_REQUEST' && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <ThumbsUp size={15} />
                {row.votes.count} votes
              </p>
            )}
          </Link>
        ))}
      </div>
      {nextHref && (
        <div className="flex justify-end">
          <Link className={buttonClassName('secondary')} href={nextHref}>
            Next page <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </div>
  )
}
