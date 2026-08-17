import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  GraduationCap,
  ListChecks,
} from 'lucide-react'
import Link from 'next/link'

import {
  addOnboardingTask,
  addRequestedDocument,
  addTrainingSession,
  updateOnboardingTaskStatus,
  updateOnboardingPlan,
  updateRequestedDocumentStatus,
  updateTrainingStatus,
} from '@/app/workflow-actions'
import type { OnboardingDetail, WorkflowOptions } from '@/lib/workflow-data'

import { PageHeader, buttonClassName } from './ui'
import { StatusBadge } from './workflow-portfolio'

const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const statuses = [
  'DRAFT',
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_GO_LIVE',
  'LIVE',
  'CANCELLED',
]

export function OnboardingWorkspace({
  data,
  editable,
  options,
}: {
  data: OnboardingDetail
  editable: boolean
  options?: WorkflowOptions
}) {
  return (
    <div className="space-y-7">
      {editable && (
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"
          href="/beauroi/onboarding"
        >
          <ArrowLeft aria-hidden size={15} /> Back to onboarding
        </Link>
      )}
      <PageHeader
        description={
          editable
            ? 'Manage checklist ownership, training, document requests, readiness, and go-live.'
            : 'Track your organization’s checklist, training, requested documents, and go-live readiness.'
        }
        eyebrow={editable ? 'Onboarding workspace' : 'My onboarding'}
        title={data.organizationName}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Status">
          <StatusBadge value={data.status} />
        </Summary>
        <Summary label="Assigned CSM">{data.ownerName ?? 'Not assigned'}</Summary>
        <Summary label="Progress">
          <strong className="font-display text-2xl">{data.progressPercent}%</strong>
        </Summary>
        <Summary label="Target go-live">{formatDate(data.targetGoLiveOn)}</Summary>
        <Summary label="Exceptions">
          <span className={data.blockedCount + data.overdueCount ? 'text-danger' : ''}>
            {data.blockedCount} blocked · {data.overdueCount} overdue
          </span>
        </Summary>
      </section>
      {data.customerUpdate && (
        <section className="rounded-lg border border-accent/20 bg-accent-soft p-5">
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">
            Customer update
          </p>
          <p className="mt-2 text-sm leading-6">{data.customerUpdate}</p>
        </section>
      )}
      {editable && options && (
        <Panel icon={<CheckCircle2 size={18} />} title="Plan settings">
          <form
            action={updateOnboardingPlan.bind(null, data.id)}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Field defaultValue={data.name} label="Plan name" name="name" required />
            <Select defaultValue={data.status} label="Status" name="status">
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
            <Select
              defaultValue={data.ownerUserId ?? ''}
              label="Customer Success Manager"
              name="ownerUserId"
            >
              <option value="">Unassigned</option>
              {options.staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </Select>
            <Field
              defaultValue={data.startsOn ?? ''}
              label="Start date"
              name="startsOn"
              type="date"
            />
            <Field
              defaultValue={data.targetGoLiveOn ?? ''}
              label="Target go-live"
              name="targetGoLiveOn"
              type="date"
            />
            <Field
              defaultValue={data.actualGoLiveOn ?? ''}
              label="Actual go-live"
              name="actualGoLiveOn"
              type="date"
            />
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
              Customer-visible update
              <textarea
                className="min-h-24 rounded-md border border-border bg-canvas p-3 text-sm"
                defaultValue={data.customerUpdate ?? ''}
                maxLength={4000}
                name="customerUpdate"
              />
            </label>
            <div className="sm:col-span-2 xl:col-span-4">
              <button className={buttonClassName()} type="submit">
                Save plan
              </button>
            </div>
          </form>
        </Panel>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={<ListChecks size={18} />} title="Checklist">
          <ItemList
            empty="No checklist tasks have been created."
            items={data.tasks.map((task) => ({
              action: editable
                ? updateOnboardingTaskStatus.bind(null, task.id, data.id)
                : undefined,
              date: task.dueAt,
              id: task.id,
              status: task.status,
              subtitle: task.description,
              title: task.title,
              transitions: itemTransitions(task.status),
            }))}
          />
          {editable && (
            <details className="mt-4 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold">Add checklist task</summary>
              <form
                action={addOnboardingTask.bind(null, data.id)}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <Field label="Task title" name="title" required />
                <Field label="Due date and time" name="dueAt" type="datetime-local" />
                <Field label="Description" name="description" />
                <Select label="Status" name="status">
                  <option>NOT_STARTED</option>
                  <option>IN_PROGRESS</option>
                  <option>BLOCKED</option>
                </Select>
                <Select label="Owner" name="assignedUserId">
                  <option value="">Unassigned</option>
                  {options?.staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </Select>
                <Field defaultValue="0" label="Order" min="0" name="sortOrder" type="number" />
                <button className={buttonClassName()} type="submit">
                  Add task
                </button>
              </form>
            </details>
          )}
        </Panel>
        <Panel icon={<GraduationCap size={18} />} title="Training schedule">
          <ItemList
            empty="No training sessions are scheduled."
            items={data.trainingSessions.map((session) => ({
              action:
                editable && session.status === 'SCHEDULED'
                  ? updateTrainingStatus.bind(null, session.id, data.id)
                  : undefined,
              date: session.scheduledAt,
              id: session.id,
              status: session.status,
              subtitle: `${session.durationMinutes} minutes · ${session.deliveryMethod}`,
              title: session.title,
              transitions: ['COMPLETED', 'CANCELLED'],
            }))}
          />
          {editable && (
            <details className="mt-4 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold">Schedule training</summary>
              <form
                action={addTrainingSession.bind(null, data.id)}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <Field label="Title" name="title" required />
                <Field label="Scheduled time" name="scheduledAt" required type="datetime-local" />
                <Field
                  defaultValue="60"
                  label="Duration (minutes)"
                  min="15"
                  name="durationMinutes"
                  required
                  type="number"
                />
                <Select label="Delivery" name="deliveryMethod">
                  <option>REMOTE</option>
                  <option>ONSITE</option>
                  <option>HYBRID</option>
                </Select>
                <Field label="Meeting link" name="meetingUrl" type="url" />
                <Field label="Location" name="meetingLocation" />
                <button className={buttonClassName()} type="submit">
                  Schedule session
                </button>
              </form>
            </details>
          )}
        </Panel>
        <Panel icon={<FileText size={18} />} title="Requested documents">
          <ItemList
            empty="No documents have been requested."
            items={data.documents.map((document) => ({
              action: editable
                ? updateRequestedDocumentStatus.bind(null, document.id, data.id)
                : undefined,
              date: document.dueAt,
              id: document.id,
              status: document.status,
              title: document.name,
              transitions: documentTransitions(document.status),
            }))}
          />
          {!data.uploadAvailable && (
            <p className="mt-4 rounded-md bg-surface-subtle p-3 text-xs leading-5 text-muted">
              Document request metadata and status tracking are available. File upload remains
              unavailable until Cloudflare R2 is configured.
            </p>
          )}
          {editable && (
            <details className="mt-4 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold">Request document</summary>
              <form
                action={addRequestedDocument.bind(null, data.id)}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <Field label="Document title" name="name" required />
                <Field label="Due date and time" name="dueAt" type="datetime-local" />
                <Field label="Description" name="description" />
                <button className={buttonClassName()} type="submit">
                  Add request
                </button>
              </form>
            </details>
          )}
        </Panel>
        <Panel icon={<CalendarClock size={18} />} title="Readiness">
          <p className="text-sm leading-6 text-muted">
            Go-live is recorded only after the plan reaches readiness. Progress is calculated from
            non-cancelled checklist items and cannot be edited manually.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-strong">
            <div className="h-full bg-accent" style={{ width: `${data.progressPercent}%` }} />
          </div>
        </Panel>
      </div>
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
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        {icon}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}
function Summary({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <p className="text-xs font-semibold tracking-wide text-subtle uppercase">{label}</p>
      <div className="mt-2 text-sm font-semibold">{children}</div>
    </div>
  )
}
function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input className={inputClass} {...props} />
    </label>
  )
}
function Select({
  children,
  label,
  ...props
}: { children: React.ReactNode; label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select className={inputClass} {...props}>
        {children}
      </select>
    </label>
  )
}
function ItemList({
  empty,
  items,
}: {
  empty: string
  items: {
    action?: ((formData: FormData) => Promise<void>) | undefined
    date?: string | null
    id: string
    status: string
    subtitle?: string | null
    title: string
    transitions?: string[] | undefined
  }[]
}) {
  if (items.length === 0) return <p className="py-4 text-sm text-muted">{empty}</p>
  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <div className="flex items-start justify-between gap-4 py-3" key={item.id}>
          <div>
            <p className="text-sm font-semibold">{item.title}</p>
            {item.subtitle && <p className="mt-1 text-xs text-muted">{item.subtitle}</p>}
            {item.date && <p className="mt-1 text-xs text-subtle">{formatDateTime(item.date)}</p>}
          </div>
          <div className="grid justify-items-end gap-2">
            <StatusBadge value={item.status} />
            {item.action && item.transitions && item.transitions.length > 0 && (
              <form action={item.action} className="flex flex-wrap items-center justify-end gap-2">
                <select
                  aria-label={`Update ${item.title} status`}
                  className="h-8 rounded-md border border-border bg-canvas px-2 text-xs"
                  defaultValue=""
                  name="status"
                  required
                >
                  <option disabled value="">
                    Change status
                  </option>
                  {item.transitions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <button className={buttonClassName('quiet')} type="submit">
                  Save
                </button>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
function itemTransitions(status: string): string[] {
  if (status === 'NOT_STARTED') return ['IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']
  if (status === 'IN_PROGRESS') return ['NOT_STARTED', 'BLOCKED', 'COMPLETED', 'CANCELLED']
  if (status === 'BLOCKED') return ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
  return []
}
function documentTransitions(status: string): string[] {
  if (status === 'REQUESTED') return ['RECEIVED', 'WAIVED']
  if (status === 'RECEIVED') return ['ACCEPTED', 'REJECTED']
  if (status === 'REJECTED') return ['RECEIVED']
  return []
}
function formatDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`))
    : 'Not set'
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}
