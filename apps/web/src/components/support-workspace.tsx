'use client'

import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  FileLock2,
  Headphones,
  History,
  LockKeyhole,
  MessageSquareText,
  Paperclip,
  Send,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'

import {
  addSupportInternalNote,
  addSupportReply,
  updateSupportCategory,
  updateSupportAssignee,
  updateSupportPriority,
  updateSupportStatus,
  type SupportActionState,
} from '@/app/support-actions'
import {
  supportDetailPresentation,
  supportStatusTransitions,
  type StaffSupportTicketDetail,
  type SupportCategory,
} from '@/lib/support-data'
import type { z } from 'zod'
import { supportEligibleAssigneesResponseSchema } from '@nexora/contracts'

import { formatDateTime, SupportBadge } from './support-queue'
import { PageHeader, buttonClassName } from './ui'

const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const initialState: SupportActionState = {}

export function SupportWorkspace({
  categories,
  data,
  eligibleAssignees,
}: {
  categories: SupportCategory[]
  data: StaffSupportTicketDetail
  eligibleAssignees: z.infer<typeof supportEligibleAssigneesResponseSchema>['data']
}) {
  const { internalNotes, visibleMessages } = supportDetailPresentation(data)
  const canManage = Object.values(data.capabilities).some(Boolean)
  const canChangeTicket =
    data.capabilities.canChangeCategory ||
    data.capabilities.canChangePriority ||
    data.capabilities.canChangeStatus
  return (
    <div className="space-y-7">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href="/beauroi/support"
      >
        <ArrowLeft aria-hidden size={15} /> Back to support queue
      </Link>
      <PageHeader
        description={`${data.reference} · ${data.organization.name}${data.product ? ` · ${data.product.name}` : ''}`}
        eyebrow="Product support workspace"
        title={data.subject}
      />
      {!canManage && (
        <section className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
          <ShieldCheck aria-hidden className="mt-0.5 shrink-0 text-warning" size={18} />
          <div>
            <p className="font-semibold">Read-only support view</p>
            <p className="mt-1 text-muted">
              This ticket is outside your active support scope. Authorization is derived by the API
              from your administrator role or a matching active SUPPORT_LEAD assignment; the
              displayed ticket assignee does not grant access.
            </p>
          </div>
        </section>
      )}
      <section aria-label="Ticket overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Status">
          <SupportBadge value={data.status} />
        </Summary>
        <Summary label="Priority">
          <SupportBadge value={data.priority} />
        </Summary>
        <Summary label="Customer">{data.organization.name}</Summary>
        <Summary label="Product">{data.product?.name ?? 'Product unavailable'}</Summary>
        <Summary label="Category">{data.category?.name ?? 'Uncategorized'}</Summary>
        <Summary label="Requester">
          <p>{data.requester.fullName}</p>
          <p className="text-xs text-subtle">
            {data.requester.designation ?? 'Designation unavailable'}
          </p>
        </Summary>
        <Summary label="Assignee">{data.assignee?.fullName ?? 'Unassigned'}</Summary>
        <Summary label="Last activity">{formatDateTime(data.lastActivityAt)}</Summary>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold">Customer request</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{data.description}</p>
        <p className="mt-4 text-xs text-subtle">
          Created {formatDateTime(data.createdAt)} · Updated {formatDateTime(data.updatedAt)}
        </p>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <div className="grid gap-6">
          <Panel icon={<MessageSquareText size={18} />} title="Customer-visible conversation">
            {visibleMessages.length === 0 ? (
              <EmptyLine>No customer-visible messages have been added yet.</EmptyLine>
            ) : (
              <div className="divide-y divide-border">
                {visibleMessages.map((message) => (
                  <MessageItem key={message.id} message={message} />
                ))}
              </div>
            )}
            {data.capabilities.canReply && <ReplyComposer ticketId={data.id} />}
          </Panel>
          <Panel icon={<LockKeyhole size={18} />} title="Internal notes" tone="warning">
            <p className="mb-4 text-xs font-semibold text-warning">
              Visible only to Beau Roi staff.
            </p>
            {internalNotes.length === 0 ? (
              <EmptyLine>No internal notes have been recorded.</EmptyLine>
            ) : (
              <div className="divide-y divide-warning/20">
                {internalNotes.map((message) => (
                  <MessageItem internal key={message.id} message={message} />
                ))}
              </div>
            )}
            {data.capabilities.canAddInternalNote && <InternalNoteComposer ticketId={data.id} />}
          </Panel>
          <Panel icon={<History size={18} />} title="Ticket history">
            {data.events.length === 0 ? (
              <EmptyLine>No ticket events are available.</EmptyLine>
            ) : (
              <ol className="grid gap-3">
                {data.events.map((event) => (
                  <li
                    className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                    key={event.id}
                  >
                    <div>
                      <p className="font-medium">{event.eventType.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-subtle">
                        {event.actor?.fullName ?? 'System'} ·{' '}
                        {event.customerVisible ? 'Customer visible' : 'Staff only'}
                      </p>
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
          <Panel icon={<Clock3 size={18} />} title="SLA tracking">
            <SlaMetric label="First response" metric={data.sla.response} />
            <SlaMetric label="Resolution" metric={data.sla.resolution} />
            <p className="mt-4 text-xs text-subtle">
              {data.sla.policyConfigured
                ? `Evaluated ${formatDateTime(data.sla.evaluatedAt)} using stored elapsed-time deadlines.`
                : 'No SLA policy snapshot is configured for this ticket.'}
            </p>
          </Panel>
          <Panel icon={<Paperclip size={18} />} title="Attachments">
            {data.attachments.length === 0 ? (
              <EmptyLine>No ticket-level attachments are available.</EmptyLine>
            ) : (
              <AttachmentList attachments={data.attachments} />
            )}
            {!data.storage.attachmentsAvailable && (
              <div className="mt-4 rounded-md border border-border bg-surface-subtle p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <FileLock2 aria-hidden size={16} /> File storage unavailable
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  R2 is not configured. Upload and download controls remain unavailable; only safe
                  stored metadata is shown.
                </p>
              </div>
            )}
          </Panel>
          <Panel icon={<Headphones size={18} />} title="Operational ownership">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs text-subtle">Assigned support person</dt>
                <dd className="font-medium">{data.assignee?.fullName ?? 'Unassigned'}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Authorization model</dt>
                <dd className="text-muted">
                  Administrator or matching SUPPORT_LEAD assignment. Assignee status does not grant
                  access.
                </dd>
              </div>
            </dl>
            {data.capabilities.canAssign && (
              <AssigneeForm
                assigneeId={data.assignee?.id ?? ''}
                assignees={eligibleAssignees}
                key={data.assignee?.id ?? 'unassigned'}
                ticketId={data.id}
              />
            )}
          </Panel>
          {canChangeTicket && <TicketControls categories={categories} data={data} />}
        </div>
      </div>
    </div>
  )
}

function ReplyComposer({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState(
    addSupportReply.bind(null, ticketId),
    initialState,
  )
  return (
    <form action={action} className="mt-5 grid gap-3 border-t border-border pt-5">
      <label className="grid gap-1.5 text-sm font-semibold">
        Reply to customer
        <textarea
          className="min-h-32 rounded-md border border-border bg-canvas p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          maxLength={20000}
          name="body"
          required
        />
      </label>
      <p className="text-xs text-muted">
        This message will be visible to the customer. Internal notes use the separate staff-only
        composer below.
      </p>
      <ActionFeedback state={state} />
      <button className={buttonClassName()} disabled={pending} type="submit">
        <Send aria-hidden size={15} /> {pending ? 'Sending…' : 'Send customer reply'}
      </button>
    </form>
  )
}

function InternalNoteComposer({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState(
    addSupportInternalNote.bind(null, ticketId),
    initialState,
  )
  return (
    <form action={action} className="mt-5 grid gap-3 border-t border-warning/20 pt-5">
      <label className="grid gap-1.5 text-sm font-semibold">
        Internal note
        <textarea
          className="min-h-28 rounded-md border border-warning/30 bg-canvas p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
          maxLength={20000}
          name="body"
          required
        />
      </label>
      <p className="text-xs font-semibold text-warning">
        Visible only to Beau Roi staff. This uses a separate internal-note endpoint.
      </p>
      <ActionFeedback state={state} />
      <button className={buttonClassName('secondary')} disabled={pending} type="submit">
        <LockKeyhole aria-hidden size={15} /> {pending ? 'Adding…' : 'Add internal note'}
      </button>
    </form>
  )
}

function TicketControls({
  categories,
  data,
}: {
  categories: SupportCategory[]
  data: StaffSupportTicketDetail
}) {
  const transitions = supportStatusTransitions(data.status)
  return (
    <Panel icon={<Settings2 size={18} />} title="Ticket controls">
      {data.capabilities.canChangeStatus && transitions.length > 0 ? (
        <StatusForm status={data.status} ticketId={data.id} transitions={transitions} />
      ) : data.capabilities.canChangeStatus ? (
        <p className="text-sm text-muted">Closed tickets are terminal in the current workflow.</p>
      ) : null}
      {data.capabilities.canChangePriority && (
        <PriorityForm key={data.priority} priority={data.priority} ticketId={data.id} />
      )}
      {data.capabilities.canChangeCategory && (
        <CategoryForm
          categories={categories}
          categoryId={data.category?.id ?? ''}
          key={data.category?.id ?? 'uncategorized'}
          ticketId={data.id}
        />
      )}
    </Panel>
  )
}

function AssigneeForm({
  assigneeId,
  assignees,
  ticketId,
}: {
  assigneeId: string
  assignees: z.infer<typeof supportEligibleAssigneesResponseSchema>['data']
  ticketId: string
}) {
  const [state, action, pending] = useActionState(
    updateSupportAssignee.bind(null, ticketId),
    initialState,
  )
  return (
    <form action={action} className="mt-5 grid gap-3 border-t border-border pt-5">
      <label className="grid gap-1.5 text-sm font-semibold">
        Assign support owner
        <select className={inputClass} defaultValue={assigneeId} name="assigneeId">
          <option value="">Unassigned</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-subtle">
        Only active Beau Roi administrators and matching SUPPORT_LEAD staff are listed.
      </p>
      <ActionFeedback state={state} />
      <button className={buttonClassName('secondary')} disabled={pending} type="submit">
        {pending ? 'Updating…' : 'Update support owner'}
      </button>
    </form>
  )
}

function StatusForm({
  status,
  ticketId,
  transitions,
}: {
  status: string
  ticketId: string
  transitions: string[]
}) {
  const [state, action, pending] = useActionState(
    updateSupportStatus.bind(null, ticketId),
    initialState,
  )
  return (
    <form action={action} className="grid gap-3 border-b border-border pb-5">
      <p className="text-sm font-semibold">Change status</p>
      <select
        aria-label="New ticket status"
        className={inputClass}
        defaultValue=""
        name="status"
        required
      >
        <option disabled value="">
          Select transition from {status.replaceAll('_', ' ')}
        </option>
        {transitions.map((item) => (
          <option key={item} value={item}>
            {item.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
      <label className="grid gap-1.5 text-xs font-semibold text-muted">
        Resolution summary
        <textarea
          className="min-h-24 rounded-md border border-border bg-canvas p-3 text-sm text-foreground"
          maxLength={10000}
          minLength={2}
          name="resolutionSummary"
        />
      </label>
      <p className="text-xs text-subtle">
        Required by the database for RESOLVED or CLOSED transitions.
      </p>
      <ActionFeedback state={state} />
      <button className={buttonClassName('secondary')} disabled={pending} type="submit">
        {pending ? 'Updating…' : 'Update status'}
      </button>
    </form>
  )
}

function PriorityForm({ priority, ticketId }: { priority: string; ticketId: string }) {
  const [state, action, pending] = useActionState(
    updateSupportPriority.bind(null, ticketId),
    initialState,
  )
  return (
    <form action={action} className="grid gap-3 border-b border-border py-5">
      <label className="grid gap-1.5 text-sm font-semibold">
        Priority
        <select className={inputClass} defaultValue={priority} name="priority">
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <ActionFeedback state={state} />
      <button className={buttonClassName('secondary')} disabled={pending} type="submit">
        {pending ? 'Updating…' : 'Update priority'}
      </button>
    </form>
  )
}

function CategoryForm({
  categories,
  categoryId,
  ticketId,
}: {
  categories: SupportCategory[]
  categoryId: string
  ticketId: string
}) {
  const [state, action, pending] = useActionState(
    updateSupportCategory.bind(null, ticketId),
    initialState,
  )
  return (
    <form action={action} className="grid gap-3 pt-5">
      <label className="grid gap-1.5 text-sm font-semibold">
        Category
        <select className={inputClass} defaultValue={categoryId} name="categoryId" required>
          <option disabled value="">
            {categories.length ? 'Select category' : 'No active categories available'}
          </option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {categories.length === 0 && (
        <p className="text-xs text-subtle">
          No active category can be assigned. Category administration is outside this phase.
        </p>
      )}
      <ActionFeedback state={state} />
      <button
        className={buttonClassName('secondary')}
        disabled={pending || categories.length === 0}
        type="submit"
      >
        {pending ? 'Updating…' : 'Update category'}
      </button>
    </form>
  )
}

function ActionFeedback({ state }: { state: SupportActionState }) {
  if (state.error)
    return (
      <p
        aria-live="polite"
        className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-xs font-medium text-danger"
      >
        <AlertCircle aria-hidden className="shrink-0" size={15} />
        {state.error}
      </p>
    )
  if (state.success)
    return (
      <p
        aria-live="polite"
        className="rounded-md bg-success-soft p-3 text-xs font-medium text-success"
      >
        {state.success}
      </p>
    )
  return null
}

function MessageItem({
  internal = false,
  message,
}: {
  internal?: boolean
  message: StaffSupportTicketDetail['messages'][number]
}) {
  return (
    <article className={`py-4 ${internal ? 'rounded-md bg-warning-soft/50 px-3' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {message.author?.fullName ?? 'Unavailable author'}
          </p>
          <p className="text-xs text-subtle">
            {message.author?.designation ?? (internal ? 'Beau Roi staff' : 'Support participant')}
          </p>
        </div>
        <time className="text-xs text-subtle">{formatDateTime(message.createdAt)}</time>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
      {message.attachments.length > 0 && (
        <div className="mt-3">
          <AttachmentList attachments={message.attachments} />
        </div>
      )}
    </article>
  )
}

function AttachmentList({ attachments }: { attachments: StaffSupportTicketDetail['attachments'] }) {
  return (
    <ul className="grid gap-2">
      {attachments.map((item) => (
        <li className="rounded-md border border-border bg-surface-subtle p-3 text-sm" key={item.id}>
          <p className="font-medium">{item.originalFilename}</p>
          <p className="mt-1 text-xs text-subtle">
            {item.contentType} · {formatBytes(item.sizeBytes)} · {formatDateTime(item.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  )
}

function SlaMetric({
  label,
  metric,
}: {
  label: string
  metric: StaffSupportTicketDetail['sla']['response']
}) {
  return (
    <div className="mt-4 border-b border-border pb-4 last:border-0">
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
      <div className="mt-2 text-sm font-medium">{children}</div>
    </div>
  )
}
function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted">{children}</p>
}
function Panel({
  children,
  icon,
  title,
  tone = 'default',
}: {
  children: React.ReactNode
  icon: React.ReactNode
  title: string
  tone?: 'default' | 'warning'
}) {
  return (
    <section
      className={`rounded-lg border bg-surface p-5 shadow-card ${tone === 'warning' ? 'border-warning/30' : 'border-border'}`}
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        {icon}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
