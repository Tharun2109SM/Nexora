import { ArrowLeft, FileClock, ListTree, MessageSquareText, Route } from 'lucide-react'
import Link from 'next/link'

import {
  addMilestone,
  addProjectNote,
  updateImplementationProject,
  updateMilestoneStatus,
} from '@/app/workflow-actions'
import type { ImplementationDetail, WorkflowOptions } from '@/lib/workflow-data'

import { PageHeader, buttonClassName } from './ui'
import { StatusBadge } from './workflow-portfolio'

const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const statuses = ['DRAFT', 'NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']
const phases = [
  'DISCOVERY',
  'REQUIREMENTS',
  'CONFIGURATION',
  'INTEGRATION',
  'VALIDATION',
  'GO_LIVE',
  'STABILIZATION',
  'COMPLETE',
]

export function ImplementationWorkspace({
  data,
  editable,
  options,
}: {
  data: ImplementationDetail
  editable: boolean
  options?: WorkflowOptions
}) {
  return (
    <div className="space-y-7">
      {editable && (
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"
          href="/beauroi/implementation"
        >
          <ArrowLeft aria-hidden size={15} /> Back to implementation
        </Link>
      )}
      <PageHeader
        description={
          editable
            ? 'Manage delivery phase, requirements, milestones, timeline, and clearly scoped project notes.'
            : 'Track your implementation phase, milestones, target completion, and customer-visible updates.'
        }
        eyebrow={editable ? 'Implementation workspace' : 'Implementation status'}
        title={data.organizationName}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Status">
          <StatusBadge value={data.status} />
        </Summary>
        <Summary label="Current phase">{data.phase?.replaceAll('_', ' ') ?? 'Not set'}</Summary>
        <Summary label="Implementation engineer">{data.ownerName ?? 'Not assigned'}</Summary>
        <Summary label="Progress">
          <strong className="font-display text-2xl">{data.progressPercent}%</strong>
        </Summary>
        <Summary label="Target completion">{formatDate(data.targetCompletionOn)}</Summary>
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
        <Panel icon={<Route size={18} />} title="Project settings">
          <form
            action={updateImplementationProject.bind(null, data.id)}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Field defaultValue={data.name} label="Project name" name="name" required />
            <Select defaultValue={data.status} label="Status" name="status">
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
            <Select defaultValue={data.phase} label="Phase" name="phase">
              {phases.map((phase) => (
                <option key={phase}>{phase}</option>
              ))}
            </Select>
            <Select
              defaultValue={data.ownerUserId ?? ''}
              label="Implementation engineer"
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
              defaultValue={data.targetCompletionOn ?? ''}
              label="Target completion"
              name="targetCompletionOn"
              type="date"
            />
            <Field
              defaultValue={data.actualCompletionOn ?? ''}
              label="Actual completion"
              name="actualCompletionOn"
              type="date"
            />
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
              Requirement summary
              <textarea
                className="min-h-28 rounded-md border border-border bg-canvas p-3 text-sm"
                defaultValue={data.requirementSummary ?? ''}
                maxLength={20000}
                name="requirementSummary"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
              Customer-visible update
              <textarea
                className="min-h-28 rounded-md border border-border bg-canvas p-3 text-sm"
                defaultValue={data.customerUpdate ?? ''}
                maxLength={4000}
                name="customerUpdate"
              />
            </label>
            <div className="sm:col-span-2 xl:col-span-4">
              <button className={buttonClassName()} type="submit">
                Save project
              </button>
            </div>
          </form>
        </Panel>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={<ListTree size={18} />} title="Milestone timeline">
          {data.milestones.length === 0 ? (
            <p className="py-4 text-sm text-muted">No milestones have been created.</p>
          ) : (
            <ol className="relative ml-2 border-l border-border pl-5">
              {data.milestones.map((milestone) => (
                <li className="relative pb-6 last:pb-0" key={milestone.id}>
                  <span className="absolute top-1 -left-[1.65rem] size-3 rounded-full border-2 border-surface bg-accent" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{milestone.title}</p>
                      {milestone.description && (
                        <p className="mt-1 text-xs leading-5 text-muted">{milestone.description}</p>
                      )}
                      <p className="mt-1 text-xs text-subtle">{formatDate(milestone.dueOn)}</p>
                    </div>
                    <div className="grid justify-items-end gap-2">
                      <StatusBadge value={milestone.status} />
                      {editable && milestoneTransitions(milestone.status).length > 0 && (
                        <form
                          action={updateMilestoneStatus.bind(null, milestone.id, data.id)}
                          className="flex flex-wrap items-center justify-end gap-2"
                        >
                          <select
                            aria-label={`Update ${milestone.title} status`}
                            className="h-8 rounded-md border border-border bg-canvas px-2 text-xs"
                            defaultValue=""
                            name="status"
                            required
                          >
                            <option disabled value="">
                              Change status
                            </option>
                            {milestoneTransitions(milestone.status).map((status) => (
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
                </li>
              ))}
            </ol>
          )}
          {editable && (
            <details className="mt-4 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold">Add milestone</summary>
              <form
                action={addMilestone.bind(null, data.id)}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <Field label="Title" name="title" required />
                <Field label="Due date" name="dueOn" type="date" />
                <Field label="Description" name="description" />
                <Select label="Status" name="status">
                  <option>NOT_STARTED</option>
                  <option>IN_PROGRESS</option>
                  <option>BLOCKED</option>
                </Select>
                <Field defaultValue="0" label="Order" min="0" name="sortOrder" type="number" />
                <button className={buttonClassName()} type="submit">
                  Add milestone
                </button>
              </form>
            </details>
          )}
        </Panel>
        <Panel icon={<MessageSquareText size={18} />} title="Project notes">
          {data.notes.length === 0 ? (
            <p className="py-4 text-sm text-muted">
              No customer-visible project notes are available.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.notes.map((note) => (
                <article className="py-3" key={note.id}>
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge value={note.visibility} />
                    <time className="text-xs text-subtle">{formatDateTime(note.createdAt)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{note.body}</p>
                </article>
              ))}
            </div>
          )}
          {editable && (
            <details className="mt-4 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Add append-only note
              </summary>
              <form action={addProjectNote.bind(null, data.id)} className="mt-4 grid gap-3">
                <label className="grid gap-1.5 text-sm font-medium">
                  Visibility
                  <select className={inputClass} name="visibility">
                    <option value="SHARED">Customer visible</option>
                    <option value="INTERNAL">Beau Roi internal only</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Note
                  <textarea
                    className="min-h-28 rounded-md border border-border bg-canvas p-3 text-sm"
                    maxLength={20000}
                    name="body"
                    required
                  />
                </label>
                <p className="text-xs text-subtle">
                  Notes cannot be edited or deleted. Internal note bodies are never returned to
                  customer users or audit metadata.
                </p>
                <button className={buttonClassName()} type="submit">
                  Add note
                </button>
              </form>
            </details>
          )}
        </Panel>
        <Panel icon={<FileClock size={18} />} title="Delivery integrity">
          <p className="text-sm leading-6 text-muted">
            Progress is derived from non-cancelled milestones. Completed projects require a
            completion date and the Complete phase; cancelled records and historical notes remain
            preserved.
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
function formatDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`))
    : 'Not set'
}
function milestoneTransitions(status: string): string[] {
  if (status === 'NOT_STARTED') return ['IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']
  if (status === 'IN_PROGRESS') return ['NOT_STARTED', 'BLOCKED', 'COMPLETED', 'CANCELLED']
  if (status === 'BLOCKED') return ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
  return []
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}
