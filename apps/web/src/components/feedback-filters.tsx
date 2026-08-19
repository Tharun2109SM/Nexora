'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'

import { buttonClassName } from './ui'

const selectClass =
  'h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
interface Option {
  id: string
  name: string
}

export function FeedbackFilters({
  organizations = [],
  products,
  staff,
}: {
  organizations?: Option[]
  products: Option[]
  staff: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  function update(name: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('cursor')
    router.replace(`${pathname}?${next.toString()}`)
  }
  return (
    <section
      aria-label="Feedback filters"
      className="rounded-lg border border-border bg-surface p-4 shadow-card"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative min-w-0 md:col-span-2">
          <span className="sr-only">Search feedback</span>
          <Search aria-hidden className="absolute top-3 left-3 text-subtle" size={16} />
          <input
            className="h-10 w-full rounded-md border border-border bg-canvas pr-3 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            defaultValue={searchParams.get('search') ?? ''}
            onChange={(event) => {
              clearTimeout(debounce.current)
              debounce.current = setTimeout(() => update('search', event.target.value.trim()), 300)
            }}
            placeholder="Search titles and descriptions"
            type="search"
          />
        </label>
        <Select label="Type" name="type" update={update} value={searchParams.get('type') ?? ''}>
          <option value="">All types</option>
          <option value="GENERAL">General feedback</option>
          <option value="BUG">Bug reports</option>
          <option value="FEATURE_REQUEST">Feature requests</option>
        </Select>
        <Select
          label="Status"
          name="status"
          update={update}
          value={searchParams.get('status') ?? ''}
        >
          <option value="">All statuses</option>
          {['SUBMITTED', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'DECLINED'].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </Select>
        {staff && (
          <OptionSelect
            label="Organization"
            name="organizationId"
            options={organizations}
            update={update}
            value={searchParams.get('organizationId') ?? ''}
          />
        )}
        <OptionSelect
          label="Product"
          name="productId"
          options={products}
          update={update}
          value={searchParams.get('productId') ?? ''}
        />
        {staff ? (
          <Select
            label="Priority"
            name="priority"
            update={update}
            value={searchParams.get('priority') ?? ''}
          >
            <option value="">All priorities</option>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        ) : (
          <Select
            label="Collection"
            name="scope"
            update={update}
            value={searchParams.get('scope') ?? 'mine'}
          >
            <option value="mine">My organization</option>
            <option value="public">Public feature requests</option>
          </Select>
        )}
        <Select
          label="Sort"
          name="sort"
          update={update}
          value={searchParams.get('sort') ?? 'activity-desc'}
        >
          <option value="activity-desc">Recent activity</option>
          <option value="created-desc">Newest submitted</option>
          <option value="created-asc">Oldest submitted</option>
        </Select>
        <div className="flex items-end xl:justify-end">
          <button
            className={buttonClassName('quiet')}
            onClick={() => router.replace(pathname)}
            type="button"
          >
            <X aria-hidden size={15} /> Clear filters
          </button>
        </div>
      </div>
    </section>
  )
}
function Select({
  children,
  label,
  name,
  update,
  value,
}: {
  children: React.ReactNode
  label: string
  name: string
  update: (n: string, v: string) => void
  value: string
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
      {label}
      <select
        className={selectClass}
        defaultValue={value}
        onChange={(e) => update(name, e.target.value)}
      >
        {children}
      </select>
    </label>
  )
}
function OptionSelect({
  label,
  name,
  options,
  update,
  value,
}: {
  label: string
  name: string
  options: Option[]
  update: (n: string, v: string) => void
  value: string
}) {
  return (
    <Select label={label} name={name} update={update} value={value}>
      <option value="">All {label.toLowerCase()}s</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </Select>
  )
}
