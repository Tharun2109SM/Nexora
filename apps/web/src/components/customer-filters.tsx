'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'

import { customerFilterUrl } from '@/lib/customer-filter-url'

import { buttonClassName } from './ui'

const selectClass =
  'h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function CustomerFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

  function update(name: string, value: string) {
    router.replace(customerFilterUrl(pathname, searchParams, name, value))
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card md:grid-cols-2 xl:grid-cols-[minmax(12rem,1.5fr)_repeat(6,minmax(0,1fr))_auto]">
      <label className="relative min-w-0">
        <span className="sr-only">Search organizations</span>
        <Search aria-hidden className="absolute top-3 left-3 text-subtle" size={16} />
        <input
          className="h-10 w-full rounded-md border border-border bg-canvas pr-3 pl-9 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          defaultValue={searchParams.get('search') ?? ''}
          onChange={(event) => {
            clearTimeout(debounce.current)
            debounce.current = setTimeout(() => update('search', event.target.value.trim()), 300)
          }}
          placeholder="Search customers"
          type="search"
        />
      </label>
      <input
        aria-label="Filter by industry"
        className={selectClass}
        defaultValue={searchParams.get('industry') ?? ''}
        onChange={(event) => {
          clearTimeout(debounce.current)
          debounce.current = setTimeout(() => update('industry', event.target.value.trim()), 300)
        }}
        placeholder="Industry"
      />
      <input
        aria-label="Filter by country"
        className={selectClass}
        defaultValue={searchParams.get('country') ?? ''}
        onChange={(event) => {
          clearTimeout(debounce.current)
          debounce.current = setTimeout(() => update('country', event.target.value.trim()), 300)
        }}
        placeholder="Country"
      />
      <select
        aria-label="Lifecycle"
        className={selectClass}
        defaultValue={searchParams.get('lifecycle') ?? ''}
        onChange={(event) => update('lifecycle', event.target.value)}
      >
        <option value="">All lifecycle states</option>
        <option value="ACTIVE">Active</option>
        <option value="PAUSED">Paused</option>
        <option value="DRAFT">Draft</option>
        <option value="COMPLETED">Completed</option>
        <option value="ARCHIVED">Archived</option>
      </select>
      <select
        aria-label="Health"
        className={selectClass}
        defaultValue={searchParams.get('healthBand') ?? ''}
        onChange={(event) => update('healthBand', event.target.value)}
      >
        <option value="">All health bands</option>
        <option value="healthy">Healthy</option>
        <option value="watch">Watch</option>
        <option value="at-risk">At risk</option>
        <option value="unassessed">Not assessed</option>
      </select>
      <select
        aria-label="Assignment"
        className={selectClass}
        defaultValue={searchParams.get('assignment') ?? ''}
        onChange={(event) => update('assignment', event.target.value)}
      >
        <option value="">All assignments</option>
        <option value="assigned">CSM assigned</option>
        <option value="unassigned">CSM not assigned</option>
      </select>
      <select
        aria-label="Sort customers"
        className={selectClass}
        defaultValue={searchParams.get('sort') ?? 'name-asc'}
        onChange={(event) => update('sort', event.target.value)}
      >
        <option value="name-asc">Name A–Z</option>
        <option value="name-desc">Name Z–A</option>
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
      <button
        className={buttonClassName('quiet')}
        onClick={() => router.replace(pathname)}
        type="button"
      >
        <X aria-hidden size={15} /> Clear
      </button>
    </div>
  )
}
