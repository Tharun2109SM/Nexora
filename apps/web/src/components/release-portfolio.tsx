import type {
  customerMaintenanceListItemSchema,
  customerReleaseListItemSchema,
  maintenanceListItemSchema,
  releaseRelationSchema,
  releaseListItemSchema,
} from '@nexora/contracts'
import { ArrowRight, CalendarClock, PackageOpen, Wrench } from 'lucide-react'
import Link from 'next/link'
import type { z } from 'zod'

import { releaseTone } from '@/lib/release-data'
import { cn } from '@/lib/utils'

import { formatDateTime } from './support-queue'
import { EmptyState, buttonClassName } from './ui'
import { MaintenanceControls } from './release-forms'

type Release = z.infer<typeof releaseListItemSchema> | z.infer<typeof customerReleaseListItemSchema>
type Maintenance =
  z.infer<typeof maintenanceListItemSchema> | z.infer<typeof customerMaintenanceListItemSchema>
type Organization = z.infer<typeof releaseRelationSchema>
export function ReleaseBadge({ value }: { value: string }) {
  const tone = releaseTone(value)
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
export function ReleasePortfolio({
  filtered,
  nextHref,
  releases,
  staff,
}: {
  filtered: boolean
  nextHref: string | null
  releases: Release[]
  staff: boolean
}) {
  if (!releases.length)
    return (
      <EmptyState
        description={
          filtered
            ? 'No releases match the selected filters.'
            : 'No real product releases are available in this workspace.'
        }
        icon={<PackageOpen aria-hidden size={19} />}
        note="No sample releases or fabricated versions are shown."
        title={filtered ? 'No matching releases' : 'No releases yet'}
      />
    )
  const root = staff ? '/beauroi/releases' : '/portal/releases'
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {releases.map((release) => (
          <article
            className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-card"
            key={release.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-accent">
                  {release.product.name} · {release.version}
                </p>
                <h2 className="mt-1 truncate font-display text-xl font-semibold">
                  {release.title}
                </h2>
              </div>
              <ReleaseBadge value={release.status} />
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
              {release.summary ?? 'No release summary has been provided.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-subtle">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={14} />
                {release.releaseDate
                  ? formatDateTime(release.releaseDate)
                  : release.scheduledFor
                    ? formatDateTime(release.scheduledFor)
                    : 'Date not set'}
              </span>
              {'audience' in release && (
                <span>
                  {release.audience.replaceAll('_', ' ')}
                  {release.audience === 'SELECTED_ORGANIZATIONS'
                    ? ` · ${release.targetCount} targets`
                    : ''}
                </span>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <Link className={buttonClassName('secondary')} href={`${root}/${release.id}`}>
                Open release <ArrowRight size={15} />
              </Link>
            </div>
          </article>
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
export function MaintenancePortfolio({
  canManage = false,
  maintenance,
  organizations = [],
  staff = false,
}: {
  canManage?: boolean
  maintenance: Maintenance[]
  organizations?: Organization[]
  staff?: boolean
}) {
  if (!maintenance.length)
    return (
      <EmptyState
        description={
          staff
            ? 'No maintenance notices have been created.'
            : 'There are no relevant maintenance notices.'
        }
        icon={<Wrench aria-hidden size={19} />}
        title="No maintenance notices"
      />
    )
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {maintenance.map((notice) => (
        <article
          className="rounded-lg border border-border bg-surface p-5 shadow-card"
          key={notice.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-accent">{notice.product.name}</p>
              <h3 className="mt-1 font-display text-lg font-semibold">{notice.title}</h3>
            </div>
            <ReleaseBadge value={notice.status} />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">{notice.description}</p>
          <dl className="mt-4 grid gap-2 text-xs text-subtle">
            <div>
              <dt className="inline font-semibold">Starts: </dt>
              <dd className="inline">{formatDateTime(notice.startsAt)}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Expected end: </dt>
              <dd className="inline">
                {notice.endsAt ? formatDateTime(notice.endsAt) : 'Not specified'}
              </dd>
            </div>
            {'audience' in notice && (
              <div>
                <dt className="inline font-semibold">Audience: </dt>
                <dd className="inline">
                  {notice.audience.replaceAll('_', ' ')}
                  {notice.audience === 'SELECTED_ORGANIZATIONS'
                    ? ` · ${notice.targetCount} targets`
                    : ''}
                </dd>
              </div>
            )}
          </dl>
          {staff && canManage && 'audience' in notice && (
            <MaintenanceControls notice={notice} organizations={organizations} />
          )}
        </article>
      ))}
    </div>
  )
}
