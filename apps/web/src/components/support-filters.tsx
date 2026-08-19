'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'

import { supportFilterUrl } from '@/lib/support-data'

import { buttonClassName } from './ui'

interface FilterOption {
  id: string
  name: string
}

const selectClass =
  'h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function SupportFilters({
  assignees,
  categories,
  organizations,
  products,
}: {
  assignees: FilterOption[]
  categories: FilterOption[]
  organizations: FilterOption[]
  products: FilterOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

  function update(name: string, value: string) {
    router.replace(supportFilterUrl(pathname, searchParams, name, value))
  }

  return (
    <section
      aria-label="Ticket queue filters"
      className="rounded-lg border border-border bg-surface p-4 shadow-card"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative min-w-0 md:col-span-2">
          <span className="sr-only">Search ticket subjects</span>
          <Search aria-hidden className="absolute top-3 left-3 text-subtle" size={16} />
          <input
            className="h-10 w-full rounded-md border border-border bg-canvas pr-3 pl-9 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            defaultValue={searchParams.get('search') ?? ''}
            onChange={(event) => {
              clearTimeout(debounce.current)
              debounce.current = setTimeout(() => update('search', event.target.value.trim()), 300)
            }}
            placeholder="Search ticket subjects"
            type="search"
          />
        </label>
        <FilterSelect
          label="Status"
          name="status"
          onChange={update}
          value={searchParams.get('status') ?? ''}
        >
          <option value="">All statuses</option>
          {['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'].map((item) => (
            <option key={item} value={item}>
              {item.replaceAll('_', ' ')}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Priority"
          name="priority"
          onChange={update}
          value={searchParams.get('priority') ?? ''}
        >
          <option value="">All priorities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </FilterSelect>
        <OptionSelect
          label="Organization"
          name="organizationId"
          onChange={update}
          options={organizations}
          value={searchParams.get('organizationId') ?? ''}
        />
        <OptionSelect
          label="Product"
          name="productId"
          onChange={update}
          options={products}
          value={searchParams.get('productId') ?? ''}
        />
        <OptionSelect
          label="Category"
          name="categoryId"
          onChange={update}
          options={categories}
          value={searchParams.get('categoryId') ?? ''}
        />
        <OptionSelect
          label="Assignee"
          name="assigneeId"
          onChange={update}
          options={assignees}
          value={searchParams.get('assigneeId') ?? ''}
        />
        <FilterSelect
          label="Sort tickets"
          name="sort"
          onChange={update}
          value={searchParams.get('sort') ?? 'activity-desc'}
        >
          <option value="activity-desc">Recent activity</option>
          <option value="created-desc">Newest created</option>
          <option value="created-asc">Oldest created</option>
        </FilterSelect>
        <div className="flex items-end xl:col-span-3 xl:justify-end">
          <button
            className={buttonClassName('quiet')}
            onClick={() => router.replace(pathname)}
            type="button"
          >
            <X aria-hidden size={15} /> Clear filters
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-subtle">
        Search is limited to ticket subjects. SLA filtering is not available in the current API.
      </p>
    </section>
  )
}

function FilterSelect({
  children,
  label,
  name,
  onChange,
  value,
}: {
  children: React.ReactNode
  label: string
  name: string
  onChange: (name: string, value: string) => void
  value: string
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
      {label}
      <select
        className={selectClass}
        defaultValue={value}
        onChange={(event) => onChange(name, event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

function OptionSelect({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string
  name: string
  onChange: (name: string, value: string) => void
  options: FilterOption[]
  value: string
}) {
  return (
    <FilterSelect label={label} name={name} onChange={onChange} value={value}>
      <option value="">
        All {label === 'Category' ? 'categories' : `${label.toLowerCase()}s`}
      </option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </FilterSelect>
  )
}
