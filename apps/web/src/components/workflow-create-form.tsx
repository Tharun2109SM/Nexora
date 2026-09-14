'use client'

import { useState } from 'react'

import type { WorkflowOptions } from '@/lib/workflow-data'

import { buttonClassName } from './ui'

const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function WorkflowCreateForm({
  action,
  kind,
  options,
}: {
  action: (formData: FormData) => Promise<void>
  kind: 'implementation' | 'onboarding'
  options: WorkflowOptions
}) {
  const [organizationId, setOrganizationId] = useState('')
  const [productId, setProductId] = useState('')
  const eligibleProducts = options.products.filter((product) =>
    options.subscriptions.some(
      (subscription) =>
        subscription.organizationId === organizationId && subscription.productId === product.id,
    ),
  )
  const isOnboarding = kind === 'onboarding'
  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Workspace name
        <input className={inputClass} name="name" required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Customer organization
        <select
          className={inputClass}
          name="organizationId"
          onChange={(event) => {
            setOrganizationId(event.target.value)
            setProductId('')
          }}
          required
          value={organizationId}
        >
          <option value="">Select organization</option>
          {options.organizations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Product
        <select
          className={inputClass}
          disabled={!organizationId || eligibleProducts.length === 0}
          name="productId"
          onChange={(event) => setProductId(event.target.value)}
          required
          value={productId}
        >
          <option value="">Select assigned product</option>
          {eligibleProducts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {organizationId && eligibleProducts.length === 0 && (
        <p className="text-sm text-warning sm:col-span-2 xl:col-span-3" role="status">
          This customer has no active assigned products. A Beau Roi administrator must assign one
          before new work can begin.
        </p>
      )}
      <label className="grid gap-1.5 text-sm font-medium">
        {isOnboarding ? 'Customer Success Manager' : 'Implementation engineer'}
        <select className={inputClass} name="ownerUserId">
          <option value="">Unassigned</option>
          {options.staff.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Start date
        <input className={inputClass} name="startsOn" type="date" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {isOnboarding ? 'Target go-live' : 'Target completion'}
        <input
          className={inputClass}
          name={isOnboarding ? 'targetGoLiveOn' : 'targetCompletionOn'}
          type="date"
        />
      </label>
      <div className="sm:col-span-2 xl:col-span-3">
        <button
          className={buttonClassName()}
          disabled={!organizationId || !productId}
          type="submit"
        >
          Create draft
        </button>
      </div>
    </form>
  )
}
