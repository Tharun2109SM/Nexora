'use client'

import type {
  customerReleaseDetailSchema,
  releaseRelationSchema,
  staffReleaseDetailSchema,
} from '@nexora/contracts'
import {
  ArrowLeft,
  CalendarClock,
  FileLock2,
  History,
  Link2,
  ListPlus,
  Settings2,
} from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'
import type { z } from 'zod'

import {
  addReleaseSectionAction,
  linkReleaseFeedbackAction,
  transitionReleaseAction,
  updateReleaseAudienceAction,
  updateReleaseContentAction,
  type ReleaseActionState,
} from '@/app/release-actions'
import { releaseTransitions } from '@/lib/release-data'

import { ReleaseBadge } from './release-portfolio'
import { formatDateTime } from './support-queue'
import { PageHeader, buttonClassName } from './ui'

type StaffDetail = z.infer<typeof staffReleaseDetailSchema>
type CustomerDetail = z.infer<typeof customerReleaseDetailSchema>
type Organization = z.infer<typeof releaseRelationSchema>
interface FeatureOption {
  id: string
  productId: string
  title: string
}
const initialState: ReleaseActionState = {}
const input =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const area = `${input} min-h-32 py-3`
function Result({ state }: { state: ReleaseActionState }) {
  if (!state.error && !state.success) return null
  return (
    <p aria-live="polite" className={state.error ? 'text-sm text-danger' : 'text-sm text-success'}>
      {state.error ?? state.success}
    </p>
  )
}
function Panel({
  children,
  title,
  icon,
}: {
  children: React.ReactNode
  title: string
  icon: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}
export function ReleaseWorkspace({
  data,
  featureRequests = [],
  organizations = [],
  staff,
}: {
  data: StaffDetail | CustomerDetail
  featureRequests?: FeatureOption[]
  organizations?: Organization[]
  staff: boolean
}) {
  const capabilities = 'capabilities' in data ? data.capabilities : null
  const detail = data.releaseNotes?.trim()
  const releaseTiming =
    data.status === 'SCHEDULED' && data.scheduledFor
      ? `Scheduled ${formatDateTime(data.scheduledFor)}`
      : data.releaseDate
        ? `Released ${formatDateTime(data.releaseDate)}`
        : 'Release date not set'
  return (
    <div className="space-y-7">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href={staff ? '/beauroi/releases' : '/portal/releases'}
      >
        <ArrowLeft size={15} /> Back to releases
      </Link>
      <PageHeader
        description={`${data.product.name} · Version ${data.version} · ${releaseTiming}`}
        eyebrow={staff ? 'Release management workspace' : 'Product release'}
        title={data.title}
      />
      <section aria-label="Release overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Product">{data.product.name}</Summary>
        <Summary label="Version">{data.version}</Summary>
        <Summary label="Status">
          <ReleaseBadge value={data.status} />
        </Summary>
        <Summary label={data.status === 'SCHEDULED' ? 'Schedule' : 'Publication'}>
          {data.publishedAt
            ? formatDateTime(data.publishedAt)
            : data.scheduledFor
              ? formatDateTime(data.scheduledFor)
              : 'Not published'}
        </Summary>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-xl font-semibold">Release notes</h2>
        {data.summary && <p className="mt-3 text-base leading-7 text-foreground">{data.summary}</p>}
        {detail ? (
          <div className="mt-5 whitespace-pre-wrap border-t border-border pt-5 text-sm leading-7 text-muted">
            {detail}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No general release notes were provided.</p>
        )}
        {data.sections.length > 0 && (
          <div className="mt-6 grid gap-4">
            {data.sections.map((section) => (
              <article
                className="rounded-md border border-border bg-surface-subtle p-4"
                key={section.id}
              >
                <ReleaseBadge value={section.category} />
                <h3 className="mt-3 font-display text-lg font-semibold">{section.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
        <div className="grid content-start gap-6">
          <Panel icon={<History size={18} />} title="Release history">
            <ol className="grid gap-3">
              {data.events.map((event) => (
                <li
                  className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-0"
                  key={event.id}
                >
                  <div>
                    <p className="font-medium">{event.eventType.replaceAll('_', ' ')}</p>
                    {'customerVisible' in event && (
                      <p className="text-xs text-subtle">
                        {event.customerVisible ? 'Customer visible' : 'Staff only'}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-subtle">
                    {formatDateTime(event.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel icon={<FileLock2 size={18} />} title="Attachments">
            <div className="rounded-md border border-border bg-surface-subtle p-4">
              <p className="font-semibold">
                {data.storage.attachmentsAvailable
                  ? 'Attachment service available'
                  : 'File actions unavailable'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {data.storage.attachmentsAvailable
                  ? 'Release attachments are not enabled in this milestone.'
                  : 'Private Cloudflare R2 storage is not configured. No upload control is shown and no object key is exposed.'}
              </p>
            </div>
          </Panel>
        </div>
        {staff && capabilities && 'targets' in data ? (
          <StaffControls
            data={data}
            featureRequests={featureRequests}
            organizations={organizations}
          />
        ) : null}
      </div>
    </div>
  )
}
function StaffControls({
  data,
  featureRequests,
  organizations,
}: {
  data: StaffDetail
  featureRequests: FeatureOption[]
  organizations: Organization[]
}) {
  const editable = data.capabilities.canEdit
  return (
    <aside className="grid content-start gap-6">
      {!Object.values(data.capabilities).some(Boolean) && (
        <section className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
          <p className="font-semibold">Read-only release view</p>
          <p className="mt-1 text-muted">
            Release mutations require an active Beau Roi administrator.
          </p>
        </section>
      )}
      {editable && (
        <>
          <ContentForm data={data} />
          <SectionForm id={data.id} />
        </>
      )}
      {data.capabilities.canManageAudience && (
        <AudienceForm data={data} organizations={organizations} />
      )}
      {(data.capabilities.canPublish || data.capabilities.canArchive) && <StatusForm data={data} />}
      {editable && (
        <FeedbackLinkForm
          data={data}
          options={featureRequests.filter((x) => x.productId === data.product.id)}
        />
      )}
      {data.feedbackLinks.length > 0 && (
        <Panel icon={<Link2 size={18} />} title="Linked feature requests">
          <ul className="grid gap-2 text-sm">
            {data.feedbackLinks.map((link) => (
              <li key={link.feedbackId}>{link.title}</li>
            ))}
          </ul>
        </Panel>
      )}
    </aside>
  )
}
function ContentForm({ data }: { data: StaffDetail }) {
  const [state, action, pending] = useActionState(
    updateReleaseContentAction.bind(null, data.id),
    initialState,
  )
  return (
    <Panel icon={<Settings2 size={18} />} title="Release content">
      <form action={action} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Title
          <input
            className={input}
            defaultValue={data.title}
            maxLength={240}
            name="title"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Summary
          <textarea
            className={area}
            defaultValue={data.summary ?? ''}
            maxLength={2000}
            name="summary"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          General notes
          <textarea
            className={area}
            defaultValue={data.releaseNotes ?? ''}
            maxLength={50000}
            name="releaseNotes"
          />
        </label>
        <Result state={state} />
        <button className={buttonClassName()} disabled={pending} type="submit">
          Save content
        </button>
      </form>
    </Panel>
  )
}
function SectionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    addReleaseSectionAction.bind(null, id),
    initialState,
  )
  return (
    <Panel icon={<ListPlus size={18} />} title="Add structured section">
      <form action={action} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Category
          <select className={input} name="category">
            {[
              'NEW_FEATURE',
              'IMPROVEMENT',
              'BUG_FIX',
              'SECURITY',
              'DEPRECATION',
              'IMPORTANT_CHANGE',
            ].map((x) => (
              <option key={x} value={x}>
                {x.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Heading
          <input className={input} maxLength={160} name="title" required />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Content
          <textarea className={area} maxLength={10000} name="body" required />
        </label>
        <input name="sortOrder" type="hidden" value="0" />
        <Result state={state} />
        <button className={buttonClassName()} disabled={pending} type="submit">
          Add section
        </button>
      </form>
    </Panel>
  )
}
function AudienceForm({
  data,
  organizations,
}: {
  data: StaffDetail
  organizations: Organization[]
}) {
  const [state, action, pending] = useActionState(
    updateReleaseAudienceAction.bind(null, data.id),
    initialState,
  )
  const selected = new Set(data.targets.map((x) => x.id))
  return (
    <Panel icon={<Settings2 size={18} />} title="Rollout audience">
      <form
        action={action}
        className="grid gap-3"
        key={`${data.audience}:${data.targets.map((target) => target.id).join(',')}`}
      >
        <label className="grid gap-1 text-sm font-semibold">
          Audience
          <select className={input} defaultValue={data.audience} name="mode">
            <option value="ALL_SUBSCRIBERS">All active subscribers</option>
            <option value="SELECTED_ORGANIZATIONS">Selected organizations</option>
          </select>
        </label>
        <fieldset className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold text-muted">Selected organizations</legend>
          {organizations.map((org) => (
            <label className="flex gap-2 text-sm" key={org.id}>
              <input
                defaultChecked={selected.has(org.id)}
                name="organizationIds"
                type="checkbox"
                value={org.id}
              />
              {org.name}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-subtle">
          Selections are validated against active subscriptions for this product.
        </p>
        <Result state={state} />
        <button className={buttonClassName()} disabled={pending} type="submit">
          Update audience
        </button>
      </form>
    </Panel>
  )
}
function StatusForm({ data }: { data: StaffDetail }) {
  const [state, action, pending] = useActionState(
    transitionReleaseAction.bind(null, data.id),
    initialState,
  )
  const transitions = releaseTransitions(data.status)
  return (
    <Panel icon={<CalendarClock size={18} />} title="Lifecycle">
      <form action={action} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Next status
          <select className={input} name="status" required>
            <option value="">Select transition</option>
            {transitions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Schedule date
          <input className={input} name="scheduledFor" type="datetime-local" />
        </label>
        <Result state={state} />
        <button className={buttonClassName()} disabled={pending} type="submit">
          Update status
        </button>
      </form>
    </Panel>
  )
}
function FeedbackLinkForm({ data, options }: { data: StaffDetail; options: FeatureOption[] }) {
  const [state, action, pending] = useActionState(
    linkReleaseFeedbackAction.bind(null, data.id),
    initialState,
  )
  return (
    <Panel icon={<Link2 size={18} />} title="Feature delivery">
      <form action={action} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Accepted feature request
          <select className={input} disabled={!options.length} name="feedbackId" required>
            <option value="">Select feature request</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-subtle">
          Only planned, in-progress, or shipped requests for this product are eligible.
        </p>
        <Result state={state} />
        <button className={buttonClassName()} disabled={pending || !options.length} type="submit">
          Link feature request
        </button>
      </form>
    </Panel>
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
