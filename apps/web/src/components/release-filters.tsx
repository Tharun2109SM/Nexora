'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'

import { buttonClassName } from './ui'

const control =
  'h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
export function ReleaseFilters({
  products,
  staff,
}: {
  products: { id: string; name: string }[]
  staff: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('cursor')
    router.replace(`${pathname}?${next}`)
  }
  return (
    <section
      aria-label="Release filters"
      className="rounded-lg border border-border bg-surface p-4 shadow-card"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="relative min-w-0 md:col-span-2">
          <span className="sr-only">Search releases</span>
          <Search aria-hidden className="absolute top-3 left-3 text-subtle" size={16} />
          <input
            className={`${control} pl-9`}
            defaultValue={params.get('search') ?? ''}
            onChange={(event) => {
              clearTimeout(debounce.current)
              debounce.current = setTimeout(() => update('search', event.target.value.trim()), 300)
            }}
            placeholder="Search title or version"
            type="search"
          />
        </label>
        <Select
          label="Product"
          onChange={(value) => update('productId', value)}
          value={params.get('productId') ?? ''}
        >
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
        {staff && (
          <Select
            label="Status"
            onChange={(value) => update('status', value)}
            value={params.get('status') ?? ''}
          >
            <option value="">All statuses</option>
            {['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </Select>
        )}
        <Select
          label="Sort"
          onChange={(value) => update('sort', value)}
          value={params.get('sort') ?? 'activity-desc'}
        >
          <option value="activity-desc">Recent activity</option>
          <option value="date-desc">Newest release date</option>
          <option value="date-asc">Oldest release date</option>
        </Select>
        <button
          className={buttonClassName('quiet')}
          onClick={() => router.replace(pathname)}
          type="button"
        >
          <X aria-hidden size={15} /> Clear filters
        </button>
      </div>
    </section>
  )
}
function Select({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
      {label}
      <select
        className={control}
        defaultValue={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}
