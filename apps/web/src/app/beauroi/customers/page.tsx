import { customerListResponseSchema } from '@nexora/contracts'
import { Building2, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { CustomerFilters } from '@/components/customer-filters'
import { HealthIndicator } from '@/components/health-indicator'
import { EmptyState, PageHeader, buttonClassName } from '@/components/ui'
import { apiRequest } from '@/lib/api'

export const metadata: Metadata = { title: 'Customer management' }

interface CustomerPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CustomerManagementPage({ searchParams }: CustomerPageProps) {
  const values = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values))
    if (typeof value === 'string') params.set(key, value)
  const result = customerListResponseSchema.parse(
    await apiRequest(`/customers?${params.toString()}`),
  )
  const nextParams = new URLSearchParams(params)
  if (result.meta.nextCursor) nextParams.set('cursor', result.meta.nextCursor)
  return (
    <div className="space-y-7">
      <PageHeader
        description="Search, assess, and coordinate every customer organization from one secured portfolio."
        eyebrow="Customer operations"
        title="Customers"
      />
      <CustomerFilters />
      {result.data.length === 0 ? (
        <EmptyState
          description="No customer organizations match the current filters. Clear the filters or wait until a real customer organization is registered."
          icon={<Building2 aria-hidden size={19} />}
          title="No matching customers"
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-card lg:block">
            <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
              <thead className="bg-surface-subtle text-xs font-semibold tracking-[0.06em] text-subtle uppercase">
                <tr>
                  <th className="px-5 py-3">Organization</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Lifecycle</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Assignments</th>
                  <th className="px-4 py-3">Product / support</th>
                  <th className="px-4 py-3">Activity</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((customer) => (
                  <tr className="hover:bg-surface-subtle/60" key={customer.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-md bg-accent-soft font-display font-semibold text-accent">
                          {customer.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="font-semibold text-foreground">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted">
                      <p>{customer.industry ?? 'Industry not provided'}</p>
                      <p className="text-xs text-subtle">
                        {customer.country ?? 'Country not provided'} ·{' '}
                        {customer.companySize ?? 'Size not provided'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold">
                        {customer.lifecycleStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <HealthIndicator score={customer.healthScore} />
                    </td>
                    <td className="px-4 py-4 text-muted">
                      <p>CSM: {customer.csmName ?? 'Not assigned'}</p>
                      <p className="text-xs text-subtle">
                        Engineer: {customer.implementationEngineerName ?? 'Not assigned'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-muted">
                      <p>{customer.currentProductVersion ?? 'Version unavailable'}</p>
                      <p className="text-xs text-subtle">
                        {customer.openTicketCount} open ticket
                        {customer.openTicketCount === 1 ? '' : 's'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-muted">
                      {customer.lastActivityAt
                        ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                            new Date(customer.lastActivityAt),
                          )
                        : 'No activity yet'}
                    </td>
                    <td className="pr-4">
                      <Link
                        aria-label={`Open ${customer.name}`}
                        className="grid size-9 place-items-center rounded-md hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent"
                        href={`/beauroi/customers/${customer.id}`}
                      >
                        <ChevronRight aria-hidden size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 lg:hidden">
            {result.data.map((customer) => (
              <Link
                className="rounded-lg border border-border bg-surface p-5 shadow-card"
                href={`/beauroi/customers/${customer.id}`}
                key={customer.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{customer.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {customer.industry ?? 'Industry not provided'} ·{' '}
                      {customer.country ?? 'Country not provided'}
                    </p>
                  </div>
                  <ChevronRight aria-hidden className="text-subtle" size={18} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                  <div>
                    <p className="text-xs text-subtle">Health</p>
                    <HealthIndicator score={customer.healthScore} />
                  </div>
                  <div>
                    <p className="text-xs text-subtle">CSM</p>
                    <p className="font-medium">{customer.csmName ?? 'Not assigned'}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {result.meta.nextCursor && (
            <div className="flex justify-end">
              <Link className={buttonClassName('secondary')} href={`?${nextParams.toString()}`}>
                Next page <ChevronRight aria-hidden size={15} />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
