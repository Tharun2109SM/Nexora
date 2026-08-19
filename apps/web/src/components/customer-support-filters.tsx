'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { customerSupportUrl } from '@/lib/customer-support-data'

import { buttonClassName } from './ui'

interface FilterOption {
  id: string
  name: string
}

const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function CustomerSupportFilters({
  categories,
  products,
}: {
  categories: FilterOption[]
  products: FilterOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setFilter(name: string, value: string) {
    startTransition(() => router.replace(customerSupportUrl(pathname, params, name, value)))
  }

  return (
    <section aria-label="Ticket filters" className="rounded-lg border border-border bg-surface p-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1.5 text-sm font-medium xl:col-span-2">
          Search ticket subjects
          <span className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
              size={16}
            />
            <input
              className={`${inputClass} pl-9`}
              defaultValue={params.get('search') ?? ''}
              maxLength={120}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setFilter('search', event.currentTarget.value.trim())
              }}
              placeholder="Search by subject"
              type="search"
            />
          </span>
        </label>
        <FilterSelect
          label="Status"
          onChange={(value) => setFilter('status', value)}
          options={['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'].map(
            (value) => ({ id: value, name: value.replaceAll('_', ' ') }),
          )}
          value={params.get('status') ?? ''}
        />
        <FilterSelect
          label="Product"
          onChange={(value) => setFilter('productId', value)}
          options={products}
          value={params.get('productId') ?? ''}
        />
        <FilterSelect
          disabled={!params.get('productId')}
          label="Category"
          onChange={(value) => setFilter('categoryId', value)}
          options={categories}
          value={params.get('categoryId') ?? ''}
        />
        <FilterSelect
          label="Sort tickets"
          onChange={(value) => setFilter('sort', value)}
          options={[
            { id: 'activity-desc', name: 'Recent activity' },
            { id: 'created-desc', name: 'Newest created' },
            { id: 'created-asc', name: 'Oldest created' },
          ]}
          value={params.get('sort') ?? 'activity-desc'}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-subtle">
          {pending ? 'Updating ticket results…' : 'Search is limited to ticket subjects.'}
        </p>
        <button
          className={buttonClassName('secondary')}
          disabled={pending}
          onClick={() => startTransition(() => router.replace(pathname))}
          type="button"
        >
          <X aria-hidden size={15} /> Clear filters
        </button>
      </div>
    </section>
  )
}

function FilterSelect({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  options: FilterOption[]
  value: string
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select
        className={inputClass}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}
