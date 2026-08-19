'use client'

import type {
  maintenanceListItemSchema,
  releaseProductSchema,
  releaseRelationSchema,
} from '@nexora/contracts'
import { CalendarPlus, PackagePlus } from 'lucide-react'
import { useActionState } from 'react'
import type { z } from 'zod'

import {
  createMaintenanceAction,
  createReleaseAction,
  transitionMaintenanceAction,
  updateMaintenanceAction,
  updateMaintenanceAudienceAction,
  type ReleaseActionState,
} from '@/app/release-actions'

import { buttonClassName } from './ui'

type Product = z.infer<typeof releaseProductSchema>
type Maintenance = z.infer<typeof maintenanceListItemSchema>
type Organization = z.infer<typeof releaseRelationSchema>
const initialState: ReleaseActionState = {}
const input =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const area = `${input} min-h-28 py-3`
function Result({ state }: { state: ReleaseActionState }) {
  if (!state.error && !state.success) return null
  return (
    <p aria-live="polite" className={state.error ? 'text-sm text-danger' : 'text-sm text-success'}>
      {state.error ?? state.success}
    </p>
  )
}
export function ReleaseCreationForms({ products }: { products: Product[] }) {
  const [releaseState, releaseAction, releasePending] = useActionState(
    createReleaseAction,
    initialState,
  )
  const [maintenanceState, maintenanceAction, maintenancePending] = useActionState(
    createMaintenanceAction,
    initialState,
  )
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <PackagePlus size={19} />
          Create release draft
        </h2>
        <p className="mt-1 text-sm text-muted">
          Version and product become immutable after creation.
        </p>
        <form action={releaseAction} className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Product">
            <select className={input} name="productId" required>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Version">
            <input className={input} maxLength={64} name="version" placeholder="2.4.0" required />
          </Field>
          <Field className="sm:col-span-2" label="Title">
            <input className={input} maxLength={240} name="title" required />
          </Field>
          <Field className="sm:col-span-2" label="Summary">
            <textarea className={area} maxLength={2000} name="summary" />
          </Field>
          <Field className="sm:col-span-2" label="Release notes">
            <textarea className={area} maxLength={50000} name="releaseNotes" />
          </Field>
          <div className="sm:col-span-2">
            <Result state={releaseState} />
            <button className={`${buttonClassName()} mt-3`} disabled={releasePending} type="submit">
              {releasePending ? 'Creating…' : 'Create draft'}
            </button>
          </div>
        </form>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <CalendarPlus size={19} />
          Create maintenance draft
        </h2>
        <p className="mt-1 text-sm text-muted">
          Customers see nothing until the notice is explicitly scheduled.
        </p>
        <form action={maintenanceAction} className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Product">
            <select className={input} name="productId" required>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input className={input} maxLength={240} name="title" required />
          </Field>
          <Field label="Starts">
            <input className={input} name="startsAt" required type="datetime-local" />
          </Field>
          <Field label="Expected end">
            <input className={input} name="endsAt" type="datetime-local" />
          </Field>
          <Field className="sm:col-span-2" label="Description">
            <textarea className={area} maxLength={30000} name="description" required />
          </Field>
          <div className="sm:col-span-2">
            <Result state={maintenanceState} />
            <button
              className={`${buttonClassName()} mt-3`}
              disabled={maintenancePending}
              type="submit"
            >
              {maintenancePending ? 'Creating…' : 'Create maintenance draft'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
function Field({
  children,
  className = '',
  label,
}: {
  children: React.ReactNode
  className?: string
  label: string
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-semibold ${className}`}>
      {label}
      {children}
    </label>
  )
}
function localDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
export function MaintenanceControls({
  notice,
  organizations,
}: {
  notice: Maintenance
  organizations: Organization[]
}) {
  const editable = notice.status === 'DRAFT' || notice.status === 'SCHEDULED'
  const selected = new Set(notice.targets.map((target) => target.id))
  const [contentState, contentAction, contentPending] = useActionState(
    updateMaintenanceAction.bind(null, notice.id),
    initialState,
  )
  const [audienceState, audienceAction, audiencePending] = useActionState(
    updateMaintenanceAudienceAction.bind(null, notice.id),
    initialState,
  )
  const next =
    notice.status === 'DRAFT'
      ? ['SCHEDULED']
      : notice.status === 'SCHEDULED'
        ? ['DRAFT', 'ACTIVE', 'CANCELLED']
        : notice.status === 'ACTIVE'
          ? ['COMPLETED', 'CANCELLED']
          : []
  return (
    <div className="mt-5 grid gap-5 border-t border-border pt-5">
      {editable && (
        <form action={contentAction} className="grid gap-3">
          <p className="text-sm font-semibold">Notice content</p>
          <Field label="Title">
            <input
              className={input}
              defaultValue={notice.title}
              maxLength={240}
              name="title"
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={area}
              defaultValue={notice.description}
              maxLength={30000}
              name="description"
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts">
              <input
                className={input}
                defaultValue={localDateTime(notice.startsAt)}
                name="startsAt"
                required
                type="datetime-local"
              />
            </Field>
            <Field label="Expected end">
              <input
                className={input}
                defaultValue={localDateTime(notice.endsAt)}
                name="endsAt"
                type="datetime-local"
              />
            </Field>
          </div>
          <Result state={contentState} />
          <button className={buttonClassName('secondary')} disabled={contentPending} type="submit">
            {contentPending ? 'Saving…' : 'Save notice'}
          </button>
        </form>
      )}
      {editable && (
        <form
          action={audienceAction}
          className="grid gap-3 border-t border-border pt-4"
          key={`${notice.audience}:${notice.targets.map((target) => target.id).join(',')}`}
        >
          <Field label="Audience">
            <select className={input} defaultValue={notice.audience} name="mode">
              <option value="ALL_SUBSCRIBERS">All active subscribers</option>
              <option value="SELECTED_ORGANIZATIONS">Selected organizations</option>
            </select>
          </Field>
          <fieldset className="grid max-h-44 gap-2 overflow-y-auto rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-semibold">Eligible organization targets</legend>
            {organizations.length ? (
              organizations.map((organization) => (
                <label className="flex items-center gap-2 text-sm" key={organization.id}>
                  <input
                    defaultChecked={selected.has(organization.id)}
                    name="organizationIds"
                    type="checkbox"
                    value={organization.id}
                  />
                  {organization.name}
                </label>
              ))
            ) : (
              <span className="text-xs text-muted">No active customer organizations.</span>
            )}
          </fieldset>
          <Result state={audienceState} />
          <button className={buttonClassName('secondary')} disabled={audiencePending} type="submit">
            {audiencePending ? 'Saving…' : 'Update audience'}
          </button>
        </form>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {next.map((status) => (
          <MaintenanceButton id={notice.id} key={status} status={status} />
        ))}
      </div>
    </div>
  )
}
function MaintenanceButton({ id, status }: { id: string; status: string }) {
  const bound = transitionMaintenanceAction.bind(null, id, status)
  const [state, action, pending] = useActionState(bound, initialState)
  return (
    <form action={action}>
      <button className={buttonClassName('secondary')} disabled={pending} type="submit">
        {status.replaceAll('_', ' ')}
      </button>
      <Result state={state} />
    </form>
  )
}
