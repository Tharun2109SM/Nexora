'use client'

import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  FileLock2,
  History,
  MessageSquareText,
  Paperclip,
  Send,
} from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'

import {
  addCustomerSupportReply,
  type CustomerSupportActionState,
} from '@/app/customer-support-actions'
import {
  customerSupportDetailPresentation,
  formatSupportEvent,
  type CustomerSupportDetail,
} from '@/lib/customer-support-data'

import { formatDateTime, SupportBadge } from './support-queue'
import { PageHeader, buttonClassName } from './ui'

const initialState: CustomerSupportActionState = {}

export function CustomerSupportWorkspace({ data }: { data: CustomerSupportDetail }) {
  const presentation = customerSupportDetailPresentation(data)
  return (
    <div className="space-y-7">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href="/portal/support"
      >
        <ArrowLeft aria-hidden size={15} /> Back to Support Center
      </Link>
      <PageHeader
        description={`${data.reference} · Created ${formatDateTime(data.createdAt)}`}
        eyebrow="Support ticket"
        title={data.subject}
      />
      <section aria-label="Ticket overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Status">
          <SupportBadge value={data.status} />
        </Summary>
        <Summary label="Priority">
          <SupportBadge value={data.priority} />
        </Summary>
        <Summary label="Product">{presentation.productLabel}</Summary>
        <Summary label="Category">{presentation.categoryLabel}</Summary>
        <Summary label="Requester">{data.requester.fullName}</Summary>
        <Summary label="Created">{formatDateTime(data.createdAt)}</Summary>
        <Summary label="Last activity">{formatDateTime(data.lastActivityAt)}</Summary>
        <Summary label="Resolution">{data.resolutionSummary ?? 'Not resolved'}</Summary>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold">Your request</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{data.description}</p>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <div className="grid gap-6">
          <Panel icon={<MessageSquareText size={18} />} title="Conversation">
            {presentation.messages.length === 0 ? (
              <EmptyLine>No customer-visible messages have been added yet.</EmptyLine>
            ) : (
              <div className="divide-y divide-border">
                {presentation.messages.map((message) => (
                  <article className="py-4 first:pt-0 last:pb-0" key={message.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {message.author?.fullName ?? 'NEXORA user'}
                        </p>
                        <p className="text-xs text-subtle">
                          {message.author?.designation ?? 'Support conversation participant'}
                        </p>
                      </div>
                      <time className="text-xs text-subtle">
                        {formatDateTime(message.createdAt)}
                      </time>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                      {message.body}
                    </p>
                  </article>
                ))}
              </div>
            )}
            <CustomerReplyComposer ticketId={data.id} />
          </Panel>
          <Panel icon={<History size={18} />} title="Ticket history">
            {presentation.events.length === 0 ? (
              <EmptyLine>No customer-visible ticket events are available.</EmptyLine>
            ) : (
              <ol className="grid gap-3">
                {presentation.events.map((event) => (
                  <li
                    className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                    key={event.id}
                  >
                    <div>
                      <p className="font-medium">{formatSupportEvent(event.eventType)}</p>
                      <p className="text-xs text-subtle">{event.actor?.fullName ?? 'NEXORA'}</p>
                    </div>
                    <time className="shrink-0 text-xs text-subtle">
                      {formatDateTime(event.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
        <div className="grid content-start gap-6">
          <Panel icon={<Clock3 size={18} />} title="Service-level tracking">
            <SlaMetric label="First response" metric={data.sla.response} />
            <SlaMetric label="Resolution" metric={data.sla.resolution} />
            <p className="mt-4 text-xs leading-5 text-subtle">
              {data.sla.policyConfigured
                ? `Last evaluated ${formatDateTime(data.sla.evaluatedAt)} from the ticket's stored SLA snapshot.`
                : 'No SLA policy snapshot is configured for this ticket.'}
            </p>
          </Panel>
          <Panel icon={<Paperclip size={18} />} title="Attachments">
            {data.attachments.length === 0 ? (
              <EmptyLine>No ticket-level attachment metadata is available.</EmptyLine>
            ) : (
              <ul className="grid gap-2">
                {data.attachments.map((attachment) => (
                  <li
                    className="rounded-md border border-border bg-surface-subtle p-3"
                    key={attachment.id}
                  >
                    <p className="text-sm font-semibold">{attachment.originalFilename}</p>
                    <p className="text-xs text-subtle">
                      {attachment.contentType} · {formatBytes(attachment.sizeBytes)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {!presentation.attachmentsAvailable && (
              <div className="mt-4 rounded-md border border-border bg-surface-subtle p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <FileLock2 aria-hidden size={16} /> File actions unavailable
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Private Cloudflare R2 storage is not configured. Upload and download controls
                  remain unavailable.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function CustomerReplyComposer({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState(
    addCustomerSupportReply.bind(null, ticketId),
    initialState,
  )
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])
  return (
    <form action={action} className="mt-5 grid gap-3 border-t border-border pt-5" ref={formRef}>
      <label className="grid gap-1.5 text-sm font-semibold">
        Add a reply
        <textarea
          className="min-h-32 rounded-md border border-border bg-canvas p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          maxLength={20000}
          name="body"
          required
        />
      </label>
      <p className="text-xs text-muted">
        Your reply is customer-visible. Replying does not change ticket status unless Beau Roi
        approves a backend workflow later.
      </p>
      <ActionFeedback state={state} />
      <button className={buttonClassName()} disabled={pending} type="submit">
        <Send aria-hidden size={15} /> {pending ? 'Sending reply…' : 'Send reply'}
      </button>
    </form>
  )
}

function SlaMetric({
  label,
  metric,
}: {
  label: string
  metric: CustomerSupportDetail['sla']['response']
}) {
  return (
    <div className="border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <SupportBadge value={metric.state} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-subtle">Deadline</dt>
          <dd className="mt-1 text-muted">{formatDateTime(metric.dueAt)}</dd>
        </div>
        <div>
          <dt className="text-subtle">Completed</dt>
          <dd className="mt-1 text-muted">{formatDateTime(metric.completedAt)}</dd>
        </div>
      </dl>
    </div>
  )
}

function Summary({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold tracking-wide text-subtle uppercase">{label}</p>
      <div className="mt-2 text-sm font-semibold">{children}</div>
    </div>
  )
}
function Panel({
  children,
  icon,
  title,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  title: string
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}
function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
      {children}
    </p>
  )
}
function ActionFeedback({ state }: { state: CustomerSupportActionState }) {
  if (!state.error && !state.success) return null
  return (
    <p
      aria-live="polite"
      className={`flex items-center gap-2 text-sm font-semibold ${state.error ? 'text-danger' : 'text-success'}`}
    >
      <AlertCircle aria-hidden size={16} />
      {state.error ?? state.success}
    </p>
  )
}
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
