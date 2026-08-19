import { ArrowRight, Inbox } from 'lucide-react'
import Link from 'next/link'

import type { CustomerSupportTicket } from '@/lib/customer-support-data'

import { formatDate, formatDateTime, SupportBadge } from './support-queue'
import { EmptyState, buttonClassName } from './ui'

export function CustomerSupportQueue({
  filtered,
  nextHref,
  rows,
}: {
  filtered: boolean
  nextHref: string | null
  rows: CustomerSupportTicket[]
}) {
  if (rows.length === 0)
    return (
      <EmptyState
        description={
          filtered
            ? 'No tickets match the selected filters. Clear or adjust the subject, status, product, or category filters.'
            : 'Your organization has not raised a support ticket yet.'
        }
        icon={<Inbox aria-hidden size={19} />}
        note="Only real tickets belonging to your organization are shown."
        title={filtered ? 'No matching tickets' : 'No support tickets yet'}
      />
    )

  return (
    <div className="space-y-4">
      <div className="hidden max-w-full overflow-x-auto rounded-lg border border-border bg-surface shadow-card xl:block">
        <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs font-semibold tracking-[0.06em] text-subtle uppercase">
            <tr>
              <th className="px-5 py-3">Ticket</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Last activity</th>
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((ticket) => (
              <tr className="hover:bg-surface-subtle/60" key={ticket.id}>
                <td className="max-w-xs px-5 py-4">
                  <p className="text-xs font-semibold text-accent">{ticket.reference}</p>
                  <p className="mt-1 truncate font-semibold" title={ticket.subject}>
                    {ticket.subject}
                  </p>
                  <p className="mt-1 text-xs text-subtle">Created {formatDate(ticket.createdAt)}</p>
                </td>
                <td className="px-4 py-4 text-muted">
                  {ticket.product?.name ?? 'Product unavailable'}
                </td>
                <td className="px-4 py-4">
                  <SupportBadge value={ticket.status} />
                </td>
                <td className="px-4 py-4">
                  <SupportBadge value={ticket.priority} />
                </td>
                <td className="px-4 py-4 text-muted">{ticket.category?.name ?? 'Uncategorized'}</td>
                <td className="px-4 py-4">
                  <CustomerSla ticket={ticket} />
                </td>
                <td className="px-4 py-4 text-muted">{formatDateTime(ticket.lastActivityAt)}</td>
                <td className="pr-4">
                  <Link
                    aria-label={`Open ${ticket.reference}: ${ticket.subject}`}
                    className="grid size-9 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-accent"
                    href={`/portal/support/${ticket.id}`}
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
        {rows.map((ticket) => (
          <Link
            className="rounded-lg border border-border bg-surface p-5 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href={`/portal/support/${ticket.id}`}
            key={ticket.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-accent">{ticket.reference}</p>
                <h2 className="mt-1 font-display text-lg font-semibold">{ticket.subject}</h2>
                <p className="mt-1 text-sm text-muted">
                  {ticket.product?.name ?? 'Product unavailable'}
                </p>
              </div>
              <ArrowRight aria-hidden className="shrink-0 text-subtle" size={18} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SupportBadge value={ticket.status} />
              <SupportBadge value={ticket.priority} />
              <SupportBadge value={ticket.sla.resolution.state} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <div>
                <dt className="text-xs text-subtle">Category</dt>
                <dd>{ticket.category?.name ?? 'Uncategorized'}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Last activity</dt>
                <dd>{formatDate(ticket.lastActivityAt)}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
      {nextHref && (
        <div className="flex justify-end">
          <Link className={buttonClassName('secondary')} href={nextHref}>
            Next page <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
      )}
    </div>
  )
}

function CustomerSla({ ticket }: { ticket: CustomerSupportTicket }) {
  if (!ticket.sla.policyConfigured)
    return <span className="text-xs text-subtle">Not configured</span>
  return (
    <span className="text-xs text-muted">
      Response {ticket.sla.response.state.replaceAll('_', ' ')} · Resolution{' '}
      {ticket.sla.resolution.state.replaceAll('_', ' ')}
    </span>
  )
}
