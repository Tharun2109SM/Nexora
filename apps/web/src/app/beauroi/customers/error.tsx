'use client'

import { AlertCircle } from 'lucide-react'

import { buttonClassName } from '@/components/ui'

export default function CustomersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="rounded-lg border border-danger/30 bg-surface p-8 text-center">
      <AlertCircle aria-hidden className="mx-auto text-danger" />
      <h1 className="mt-4 font-display text-2xl font-semibold">Customers could not be loaded</h1>
      <p className="mt-2 text-sm text-muted">
        The request failed safely. Try again; if the issue continues, share the request ID from the
        API logs.
      </p>
      <button className={`${buttonClassName()} mt-5`} onClick={reset} type="button">
        Try again
      </button>
    </section>
  )
}
