'use client'

import {
  ArrowLeft,
  FileLock2,
  History,
  LockKeyhole,
  MessageSquareText,
  Send,
  Settings2,
  ShieldCheck,
  ThumbsUp,
} from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'

import {
  addCustomerFeedbackMessage,
  addFeedbackInternalNote,
  addStaffFeedbackResponse,
  toggleFeatureVoteAction,
  updateFeedbackStatusAction,
  updateFeedbackTriageAction,
  type FeedbackActionState,
} from '@/app/feedback-actions'
import {
  feedbackTransitions,
  type CustomerFeedbackDetail,
  type StaffFeedbackDetail,
} from '@/lib/feedback-data'

import { FeedbackBadge } from './feedback-queue'
import { formatDateTime } from './support-queue'
import { PageHeader, buttonClassName } from './ui'

const initialState: FeedbackActionState = {}
const input =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
type Detail = CustomerFeedbackDetail | StaffFeedbackDetail

export function FeedbackWorkspace({ data, staff }: { data: Detail; staff: boolean }) {
  const capabilities = 'capabilities' in data ? data.capabilities : null
  const visibleMessages = data.messages.filter(
    (message) => !('isInternal' in message) || !message.isInternal,
  )
  const internalMessages = data.messages.filter(
    (message) => 'isInternal' in message && message.isInternal,
  )
  const customerName = data.organization?.name ?? 'Customer not disclosed'
  const requesterName = data.requester?.fullName ?? 'Requester not disclosed'
  return (
    <div className="space-y-7">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href={staff ? '/beauroi/feedback' : '/portal/feedback'}
      >
        <ArrowLeft size={15} /> Back to feedback
      </Link>
      <PageHeader
        description={`${customerName} · ${data.product.name} · Submitted ${formatDateTime(data.createdAt)}`}
        eyebrow={staff ? 'Feedback management workspace' : 'Product feedback'}
        title={data.title}
      />
      {staff && capabilities && !Object.values(capabilities).some(Boolean) && (
        <section className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
          <ShieldCheck className="mt-0.5 shrink-0 text-warning" size={18} />
          <div>
            <p className="font-semibold">Read-only feedback view</p>
            <p className="mt-1 text-muted">
              Mutation requires a Beau Roi administrator or a matching active CSM or ACCOUNT_OWNER
              assignment.
            </p>
          </div>
        </section>
      )}
      <section aria-label="Feedback overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Type">
          <FeedbackBadge value={data.type} />
        </Summary>
        <Summary label="Status">
          <FeedbackBadge value={data.status} />
        </Summary>
        <Summary label="Product">{data.product.name}</Summary>
        <Summary label="Customer">{customerName}</Summary>
        <Summary label="Requester">{requesterName}</Summary>
        <Summary label="Priority">{data.priority ?? 'Not set'}</Summary>
        <Summary label="Severity">{data.severity ?? 'Not applicable'}</Summary>
        <Summary label="Visibility">
          {data.isPublic ? 'Approved public request' : 'Organization private'}
        </Summary>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold">Submitted request</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{data.description}</p>
        {data.bug && (
          <dl className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
            <Field label="Reproduction steps" value={data.bug.reproductionSteps} />
            <Field label="Environment" value={data.bug.environment} />
          </dl>
        )}
        {data.feature && (
          <dl className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
            <Field label="Problem statement" value={data.feature.problemStatement} />
            <Field label="Desired outcome" value={data.feature.desiredOutcome} />
          </dl>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
        <div className="grid gap-6">
          <Panel icon={<MessageSquareText size={18} />} title="Customer-visible discussion">
            {visibleMessages.length ? (
              <div className="divide-y divide-border">
                {visibleMessages.map((m) => (
                  <article className="py-4 first:pt-0 last:pb-0" key={m.id}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-semibold">{m.author?.fullName ?? 'NEXORA user'}</p>
                      <time className="text-xs text-subtle">{formatDateTime(m.createdAt)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                      {m.body}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <Empty>No customer-visible responses yet.</Empty>
            )}
            {staff ? (
              capabilities?.canRespond && (
                <MessageForm
                  action={addStaffFeedbackResponse.bind(null, data.id)}
                  button="Publish response"
                  label="Customer-visible response"
                />
              )
            ) : (
              <MessageForm
                action={addCustomerFeedbackMessage.bind(null, data.id)}
                button="Add response"
                label="Your response"
              />
            )}
          </Panel>
          {staff && (
            <Panel icon={<LockKeyhole size={18} />} title="Internal triage notes" warning>
              <p className="mb-4 text-xs font-semibold text-warning">
                Never exposed to customer roles, events, or notifications.
              </p>
              {internalMessages.length ? (
                <div className="divide-y divide-warning/20">
                  {internalMessages.map((m) => (
                    <article className="py-3" key={m.id}>
                      <p className="text-xs font-semibold">
                        {m.author?.fullName ?? 'Beau Roi staff'} · {formatDateTime(m.createdAt)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{m.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty>No internal notes recorded.</Empty>
              )}
              {capabilities?.canAddInternalNote && (
                <MessageForm
                  action={addFeedbackInternalNote.bind(null, data.id)}
                  button="Add internal note"
                  label="Internal note"
                />
              )}
            </Panel>
          )}
          <Panel icon={<History size={18} />} title="Workflow history">
            <ol className="grid gap-3">
              {data.events.map((event) => (
                <li
                  className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-0"
                  key={event.id}
                >
                  <div>
                    <p className="font-medium">{event.eventType.replaceAll('_', ' ')}</p>
                    <p className="text-xs text-subtle">
                      {event.actor?.fullName ?? 'NEXORA'}
                      {staff && 'customerVisible' in event
                        ? ` · ${event.customerVisible ? 'Customer visible' : 'Staff only'}`
                        : ''}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-subtle">
                    {formatDateTime(event.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="grid content-start gap-6">
          {data.type === 'FEATURE_REQUEST' && (
            <Panel icon={<ThumbsUp size={18} />} title="Feature voting">
              <p className="font-display text-3xl font-semibold">{data.votes.count}</p>
              <p className="text-sm text-muted">eligible customer votes</p>
              {!staff && <VoteForm data={data as CustomerFeedbackDetail} />}
              <p className="mt-3 text-xs text-subtle">
                Private requests are visible and votable only within their owning organization.
                Cross-company voting requires explicit publication.
              </p>
            </Panel>
          )}
          <Panel icon={<FileLock2 size={18} />} title="Attachments">
            {!data.storage.attachmentsAvailable ? (
              <div className="rounded-md border border-border bg-surface-subtle p-4">
                <p className="font-semibold">File actions unavailable</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Private Cloudflare R2 storage is not configured. No upload control is shown and no
                  object key is exposed.
                </p>
              </div>
            ) : (
              <Empty>No attachment metadata is available.</Empty>
            )}
          </Panel>
          {staff && capabilities?.canTriage && <TriageForm data={data as StaffFeedbackDetail} />}{' '}
          {staff && capabilities?.canChangeStatus && (
            <StatusForm data={data as StaffFeedbackDetail} />
          )}
        </div>
      </div>
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
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-subtle uppercase">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-muted">{value ?? 'Not provided'}</dd>
    </div>
  )
}
function Panel({
  children,
  icon,
  title,
  warning = false,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  title: string
  warning?: boolean
}) {
  return (
    <section
      className={`rounded-lg border p-5 shadow-card ${warning ? 'border-warning/30 bg-warning-soft/30' : 'border-border bg-surface'}`}
    >
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-subtle">{children}</p>
}
function FeedbackResult({ state }: { state: FeedbackActionState }) {
  return (
    <>
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-success" role="status">
          {state.success}
        </p>
      )}
    </>
  )
}
function MessageForm({
  action,
  button,
  label,
}: {
  action: (s: FeedbackActionState, d: FormData) => Promise<FeedbackActionState>
  button: string
  label: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  return (
    <form action={formAction} className="mt-5 grid gap-3 border-t border-border pt-5">
      <label className="grid gap-1.5 text-sm font-semibold">
        {label}
        <textarea
          className="min-h-28 rounded-md border border-border bg-canvas p-3 text-sm"
          maxLength={30000}
          name="body"
          required
        />
      </label>
      <FeedbackResult state={state} />
      <button className={buttonClassName()} disabled={pending} type="submit">
        <Send size={15} />
        {pending ? 'Saving…' : button}
      </button>
    </form>
  )
}
function VoteForm({ data }: { data: CustomerFeedbackDetail }) {
  const [state, action, pending] = useActionState(
    toggleFeatureVoteAction.bind(null, data.id, data.votes.hasVoted),
    initialState,
  )
  return (
    <form action={action} className="mt-4">
      <FeedbackResult state={state} />
      <button className={buttonClassName('secondary')} disabled={pending} type="submit">
        <ThumbsUp size={15} />
        {data.votes.hasVoted ? 'Remove my vote' : 'Vote for this request'}
      </button>
    </form>
  )
}
function TriageForm({ data }: { data: StaffFeedbackDetail }) {
  const [state, action, pending] = useActionState(
    updateFeedbackTriageAction.bind(null, data.id),
    initialState,
  )
  return (
    <Panel icon={<Settings2 size={18} />} title="Triage controls">
      <form action={action} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Priority
          <select className={input} defaultValue={data.priority ?? ''} name="priority">
            <option value="">Not set</option>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {data.type === 'BUG' && (
          <label className="grid gap-1 text-sm font-semibold">
            Severity
            <select className={input} defaultValue={data.severity ?? 'MEDIUM'} name="severity">
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input
            defaultChecked={data.isPublic}
            disabled={data.type !== 'FEATURE_REQUEST'}
            name="isPublic"
            type="checkbox"
          />
          <span>
            <strong>Approved public feature request</strong>
            <span className="block text-xs text-muted">
              Allows eligible customers subscribed to this product to discover and vote.
            </span>
          </span>
        </label>
        <FeedbackResult state={state} />
        <button className={buttonClassName()} disabled={pending} type="submit">
          {pending ? 'Saving…' : 'Update triage'}
        </button>
      </form>
    </Panel>
  )
}
function StatusForm({ data }: { data: StaffFeedbackDetail }) {
  const [state, action, pending] = useActionState(
    updateFeedbackStatusAction.bind(null, data.id),
    initialState,
  )
  const transitions = feedbackTransitions(data.status)
  return (
    <Panel icon={<Settings2 size={18} />} title="Status workflow">
      <form action={action} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Next status
          <select className={input} disabled={!transitions.length} name="status" required>
            <option value="">Select transition</option>
            {transitions.map((x) => (
              <option key={x} value={x}>
                {x.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <FeedbackResult state={state} />
        <button
          className={buttonClassName()}
          disabled={pending || !transitions.length}
          type="submit"
        >
          {transitions.length ? 'Update status' : 'Terminal status'}
        </button>
      </form>
    </Panel>
  )
}
