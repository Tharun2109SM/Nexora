'use client'

import { AlertCircle, ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useActionState, useTransition } from 'react'

import {
  createCustomerSupportTicket,
  type CustomerSupportActionState,
} from '@/app/customer-support-actions'
import { customerSupportUrl, type SupportProduct } from '@/lib/customer-support-data'
import type { SupportCategory } from '@/lib/support-data'

import { buttonClassName } from './ui'

const inputClass =
  'w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const initialState: CustomerSupportActionState = {}

export function CustomerTicketForm({
  categories,
  products,
  selectedProductId,
}: {
  categories: SupportCategory[]
  products: SupportProduct[]
  selectedProductId: string
}) {
  const [state, action, pending] = useActionState(createCustomerSupportTicket, initialState)
  const [changingProduct, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const product = products.find((item) => item.id === selectedProductId)

  if (!product)
    return (
      <section className="rounded-lg border border-border bg-surface p-6 shadow-card">
        <h2 className="font-display text-xl font-semibold">No eligible support product</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Your organization does not currently have an active product subscription available for
          ticket creation. Contact your Beau Roi representative if this looks incorrect.
        </p>
        <Link className={`${buttonClassName('secondary')} mt-5`} href="/portal/support">
          <ArrowLeft aria-hidden size={15} /> Back to Support Center
        </Link>
      </section>
    )

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.1em] text-accent uppercase">
            New request
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Raise a support ticket</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Describe the issue clearly. Status, priority, SLA and assignment are managed securely by
            Beau Roi and cannot be selected here.
          </p>
        </div>
        <Link className={buttonClassName('secondary')} href="/portal/support">
          <ArrowLeft aria-hidden size={15} /> Cancel
        </Link>
      </div>
      <form action={action} className="mt-6 grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldError errors={state.fieldErrors?.productId}>
            <label className="grid gap-1.5 text-sm font-semibold">
              Product
              <select
                className={`${inputClass} h-11`}
                disabled={pending || changingProduct}
                name="productId"
                onChange={(event) => {
                  const value = event.target.value
                  startTransition(() =>
                    router.replace(customerSupportUrl(pathname, params, 'newProductId', value)),
                  )
                }}
                value={selectedProductId}
              >
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </FieldError>
          <FieldError errors={state.fieldErrors?.categoryId}>
            <label className="grid gap-1.5 text-sm font-semibold">
              Category
              <select
                className={`${inputClass} h-11`}
                disabled={pending || changingProduct || categories.length === 0}
                name="categoryId"
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </FieldError>
        </div>
        {changingProduct && (
          <p aria-live="polite" className="text-sm text-muted">
            Loading applicable categories…
          </p>
        )}
        {!changingProduct && categories.length === 0 && (
          <div className="flex gap-3 rounded-md border border-warning/30 bg-warning-soft p-4 text-sm">
            <AlertCircle aria-hidden className="mt-0.5 shrink-0 text-warning" size={17} />
            <p>
              No active support category is available for this product. Ticket submission remains
              disabled.
            </p>
          </div>
        )}
        <FieldError errors={state.fieldErrors?.subject}>
          <label className="grid gap-1.5 text-sm font-semibold">
            Subject
            <input
              className={`${inputClass} h-11`}
              maxLength={240}
              minLength={3}
              name="subject"
              required
            />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors?.description}>
          <label className="grid gap-1.5 text-sm font-semibold">
            Description
            <textarea
              className={`${inputClass} min-h-44 p-3`}
              maxLength={20000}
              name="description"
              required
            />
          </label>
        </FieldError>
        {state.error && (
          <p
            aria-live="polite"
            className="flex items-center gap-2 text-sm font-semibold text-danger"
          >
            <AlertCircle aria-hidden size={16} /> {state.error}
          </p>
        )}
        <div className="flex justify-end">
          <button
            className={buttonClassName()}
            disabled={pending || changingProduct || categories.length === 0}
            type="submit"
          >
            <Send aria-hidden size={15} /> {pending ? 'Creating ticket…' : 'Create ticket'}
          </button>
        </div>
      </form>
    </section>
  )
}

function FieldError({
  children,
  errors,
}: {
  children: React.ReactNode
  errors: string[] | undefined
}) {
  return (
    <div>
      {children}
      {errors?.map((error) => (
        <p className="mt-1 text-xs font-semibold text-danger" key={error}>
          {error}
        </p>
      ))}
    </div>
  )
}
