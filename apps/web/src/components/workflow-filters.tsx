'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'

import type { WorkflowOptions } from '@/lib/workflow-data'
import { workflowFilterUrl } from '@/lib/workflow-data'

import { buttonClassName } from './ui'

const controlClass =
  'h-10 min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const onboardingStatuses = [
  'DRAFT',
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_GO_LIVE',
  'LIVE',
  'CANCELLED',
]
const implementationStatuses = [
  'DRAFT',
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
]
const phases = [
  'DISCOVERY',
  'REQUIREMENTS',
  'CONFIGURATION',
  'INTEGRATION',
  'VALIDATION',
  'GO_LIVE',
  'STABILIZATION',
  'COMPLETE',
]

export function WorkflowFilters({
  kind,
  options,
}: {
  kind: 'implementation' | 'onboarding'
  options: WorkflowOptions
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const statuses = kind === 'onboarding' ? onboardingStatuses : implementationStatuses
  const update = (name: string, value: string) =>
    router.replace(workflowFilterUrl(pathname, searchParams, name, value))

  return (
    <section
      aria-label={`${kind} filters`}
      className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card md:grid-cols-2 xl:grid-cols-6"
    >
      <label className="relative xl:col-span-2">
        <span className="sr-only">Search organizations</span>
        <Search aria-hidden className="absolute top-3 left-3 text-subtle" size={16} />
        <input
          className={`${controlClass} w-full pl-9`}
          defaultValue={searchParams.get('search') ?? ''}
          onChange={(event) => {
            clearTimeout(debounce.current)
            debounce.current = setTimeout(() => update('search', event.target.value.trim()), 300)
          }}
          placeholder="Search organizations"
          type="search"
        />
      </label>
      <select
        aria-label="Status"
        className={controlClass}
        defaultValue={searchParams.get('status') ?? ''}
        onChange={(event) => update('status', event.target.value)}
      >
        <option value="">All statuses</option>
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
      <select
        aria-label="Product"
        className={controlClass}
        defaultValue={searchParams.get('productId') ?? ''}
        onChange={(event) => update('productId', event.target.value)}
      >
        <option value="">All products</option>
        {options.products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
      {kind === 'implementation' ? (
        <select
          aria-label="Phase"
          className={controlClass}
          defaultValue={searchParams.get('phase') ?? ''}
          onChange={(event) => update('phase', event.target.value)}
        >
          <option value="">All phases</option>
          {phases.map((phase) => (
            <option key={phase} value={phase}>
              {phase.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      ) : (
        <select
          aria-label="Assigned Customer Success Manager"
          className={controlClass}
          defaultValue={searchParams.get('ownerUserId') ?? ''}
          onChange={(event) => update('ownerUserId', event.target.value)}
        >
          <option value="">All CSMs</option>
          {options.staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
      )}
      <button
        className={buttonClassName('quiet')}
        onClick={() => router.replace(pathname)}
        type="button"
      >
        <X aria-hidden size={15} /> Clear
      </button>
    </section>
  )
}
