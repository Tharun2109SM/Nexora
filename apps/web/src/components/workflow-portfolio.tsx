import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import type { PortfolioRow, WorkflowOptions } from '@/lib/workflow-data'

import { EmptyState, buttonClassName } from './ui'

const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function Progress({ value }: { value: number }) {
  return (
    <div className="min-w-32" title={`${value}% complete`}>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>Progress</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function StatusBadge({ value }: { value: string }) {
  const urgent = value === 'BLOCKED' || value === 'CANCELLED'
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${urgent ? 'border-danger/30 bg-danger/10 text-danger' : 'border-border bg-surface-subtle text-muted'}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  )
}

export function WorkflowPortfolio({
  action,
  kind,
  nextHref,
  options,
  rows,
}: {
  action: (formData: FormData) => Promise<void>
  kind: 'implementation' | 'onboarding'
  nextHref: string | null
  options: WorkflowOptions
  rows: PortfolioRow[]
}) {
  const isOnboarding = kind === 'onboarding'
  const blocked = rows.filter((row) => row.status === 'BLOCKED').length
  const overdue = rows.reduce((total, row) => total + row.overdueCount, 0)
  const active = rows.filter((row) =>
    ['IN_PROGRESS', 'READY_FOR_GO_LIVE'].includes(row.status),
  ).length
  return (
    <>
      <section aria-label="Page summary" className="grid gap-3 sm:grid-cols-3">
        <Metric label="In progress" value={active} />
        <Metric label="Blocked records" value={blocked} />
        <Metric label="Overdue items" value={overdue} />
      </section>
      <details className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <summary className="cursor-pointer font-display text-lg font-semibold focus-visible:outline-2 focus-visible:outline-accent">
          Create {isOnboarding ? 'onboarding plan' : 'implementation project'}
        </summary>
        <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Workspace name" name="name" required />
          <Select label="Customer organization" name="organizationId" required>
            <option value="">Select organization</option>
            {options.organizations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select label="Product" name="productId" required>
            <option value="">Select product</option>
            {options.products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label={isOnboarding ? 'Customer Success Manager' : 'Implementation engineer'}
            name="ownerUserId"
          >
            <option value="">Unassigned</option>
            {options.staff.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fullName}
              </option>
            ))}
          </Select>
          <Field label="Start date" name="startsOn" type="date" />
          <Field
            label={isOnboarding ? 'Target go-live' : 'Target completion'}
            name={isOnboarding ? 'targetGoLiveOn' : 'targetCompletionOn'}
            type="date"
          />
          <div className="sm:col-span-2 xl:col-span-3">
            <button className={buttonClassName()} type="submit">
              Create draft
            </button>
          </div>
        </form>
      </details>
      {rows.length === 0 ? (
        <EmptyState
          description={`No ${kind} records match the selected filters. Create the first real record or clear the filters.`}
          icon={<BriefcaseBusiness aria-hidden size={19} />}
          title={`No ${kind} records`}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-card lg:block">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="bg-surface-subtle text-xs tracking-[0.06em] text-subtle uppercase">
                <tr>
                  <th className="px-5 py-3">Organization / product</th>
                  <th className="px-4 py-3">Status</th>
                  {!isOnboarding && <th className="px-4 py-3">Phase</th>}
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Exceptions</th>
                  <th className="px-4 py-3">Target</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <PortfolioTableRow isOnboarding={isOnboarding} key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 lg:hidden">
            {rows.map((row) => (
              <Link
                className="rounded-lg border border-border bg-surface p-5 shadow-card"
                href={`/beauroi/${kind}/${row.id}`}
                key={row.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{row.organizationName}</h2>
                    <p className="mt-1 text-sm text-muted">{row.productName}</p>
                  </div>
                  <ArrowRight aria-hidden className="text-subtle" size={18} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <StatusBadge value={row.status} />
                  <Progress value={row.progressPercent} />
                </div>
                {(row.blockedCount > 0 || row.overdueCount > 0) && (
                  <p className="mt-3 text-xs font-semibold text-danger">
                    {row.blockedCount} blocked · {row.overdueCount} overdue
                  </p>
                )}
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
        </>
      )}
    </>
  )
}

function PortfolioTableRow({ isOnboarding, row }: { isOnboarding: boolean; row: PortfolioRow }) {
  const target = isOnboarding ? row.targetGoLiveOn : row.targetCompletionOn
  const kind = isOnboarding ? 'onboarding' : 'implementation'
  return (
    <tr className="hover:bg-surface-subtle/60">
      <td className="px-5 py-4">
        <p className="font-semibold">{row.organizationName}</p>
        <p className="text-xs text-muted">{row.productName}</p>
      </td>
      <td className="px-4 py-4">
        <StatusBadge value={row.status} />
      </td>
      {!isOnboarding && <td className="px-4 py-4 text-muted">{row.phase?.replaceAll('_', ' ')}</td>}
      <td className="px-4 py-4">
        <Progress value={row.progressPercent} />
      </td>
      <td className="px-4 py-4 text-sm">
        <span className={row.blockedCount ? 'text-danger' : 'text-muted'}>
          {row.blockedCount} blocked
        </span>
        <br />
        <span className={row.overdueCount ? 'text-danger' : 'text-muted'}>
          {row.overdueCount} overdue
        </span>
      </td>
      <td className="px-4 py-4 text-muted">
        {target
          ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
              new Date(`${target}T00:00:00Z`),
            )
          : 'Not set'}
      </td>
      <td className="pr-4">
        <Link
          aria-label={`Open ${row.organizationName}`}
          className="grid size-9 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-accent"
          href={`/beauroi/${kind}/${row.id}`}
        >
          <ArrowRight aria-hidden size={16} />
        </Link>
      </td>
    </tr>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  const icon = label.includes('Overdue') ? (
    <CalendarClock size={17} />
  ) : label.includes('Blocked') ? (
    <AlertTriangle size={17} />
  ) : (
    <BriefcaseBusiness size={17} />
  )
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <p className="text-xs font-semibold tracking-wide uppercase">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-subtle">Current filtered page</p>
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
  name,
  required,
}: {
  children: ReactNode
  label: string
  name: string
  required?: boolean
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select className={inputClass} name={name} required={required}>
        {children}
      </select>
    </label>
  )
}
