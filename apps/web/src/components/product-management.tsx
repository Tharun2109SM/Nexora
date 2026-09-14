'use client'

import type { ProductRecord } from '@nexora/contracts'
import { Box, PackagePlus } from 'lucide-react'
import { useActionState } from 'react'

import {
  activateCustomerProductAction,
  createProductAction,
  type ProductActionState,
} from '@/app/product-actions'
import type { WorkflowOptions } from '@/lib/workflow-data'

import { EmptyState, buttonClassName } from './ui'

const initialState: ProductActionState = {}
const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  )
}

export function ProductCreateForm() {
  const [state, action, pending] = useActionState(createProductAction, initialState)
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <PackagePlus aria-hidden size={19} />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">Create product</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            New products become active immediately and appear in workflow product selectors.
          </p>
        </div>
      </div>
      <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Product name">
          <input autoComplete="off" className={inputClass} maxLength={160} name="name" required />
        </Field>
        <Field label="Product code">
          <input
            autoCapitalize="characters"
            autoComplete="off"
            className={inputClass}
            maxLength={40}
            name="code"
            pattern="[A-Za-z][A-Za-z0-9_-]+"
            placeholder="PRODUCT_CODE"
            required
          />
        </Field>
        <label className="grid gap-1.5 text-sm font-semibold md:col-span-2">
          Description <span className="font-normal text-subtle">Optional</span>
          <textarea className={`${inputClass} min-h-28 py-3`} maxLength={2000} name="description" />
        </label>
        <div className="md:col-span-2">
          {(state.error || state.success) && (
            <p
              aria-live="polite"
              className={state.error ? 'text-sm text-danger' : 'text-sm text-success'}
            >
              {state.error ?? state.success}
            </p>
          )}
          <button className={`${buttonClassName()} mt-3`} disabled={pending} type="submit">
            {pending ? 'Creating…' : 'Create active product'}
          </button>
        </div>
      </form>
    </section>
  )
}

export function ProductManagementControls({ canCreate }: { canCreate: boolean }) {
  if (canCreate) return <ProductCreateForm />
  return (
    <section className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
      <p className="font-semibold">Read-only product catalog</p>
      <p className="mt-1 text-muted">Only an active Beau Roi administrator can create products.</p>
    </section>
  )
}

export function ProductSubscriptionForm({ options }: { options: WorkflowOptions }) {
  const [state, action, pending] = useActionState(activateCustomerProductAction, initialState)
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h2 className="font-display text-xl font-semibold">Make a product available to a customer</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        A customer needs an active product subscription before onboarding, implementation, or
        product-scoped support can begin. Each customer-product pair can be provisioned once.
      </p>
      {options.organizations.length === 0 || options.products.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Create an active product and have an active customer organization before provisioning.
        </p>
      ) : (
        <form
          action={action}
          className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
        >
          <Field label="Customer organization">
            <select className={inputClass} name="organizationId" required>
              <option value="">Select customer</option>
              {options.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product">
            <select className={inputClass} name="productId" required>
              <option value="">Select product</option>
              {options.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
          <button className={buttonClassName()} disabled={pending} type="submit">
            {pending ? 'Saving…' : 'Make available'}
          </button>
          {(state.error || state.success) && (
            <p
              aria-live="polite"
              className={`text-sm md:col-span-3 ${state.error ? 'text-danger' : 'text-success'}`}
            >
              {state.error ?? state.success}
            </p>
          )}
        </form>
      )}
      {options.subscriptions.length > 0 && (
        <p className="mt-4 text-xs text-subtle">
          {options.subscriptions.length} active customer-product relationships are currently
          available.
        </p>
      )}
    </section>
  )
}

export function ProductPortfolio({ products }: { products: ProductRecord[] }) {
  if (!products.length) {
    return (
      <EmptyState
        description="No products have been created. A Beau Roi administrator can create the first product when it is ready for customer operations."
        icon={<Box aria-hidden size={19} />}
        title="No products yet"
      />
    )
  }
  return (
    <section aria-labelledby="product-catalog-title" className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold" id="product-catalog-title">
          Product catalog
        </h2>
        <p className="mt-1 text-sm text-muted">{products.length} governed product records</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article
            className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-card"
            key={product.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold tracking-[0.08em] text-accent uppercase">
                  {product.code}
                </p>
                <h3 className="mt-2 font-display text-xl font-semibold">{product.name}</h3>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${product.status === 'ACTIVE' ? 'border-success/25 bg-success-soft text-success' : 'border-border bg-surface-subtle text-muted'}`}
              >
                {product.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              {product.description ?? 'No product description has been added.'}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
