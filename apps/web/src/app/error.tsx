'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'

import { buttonClassName } from '@/components/ui'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-8 text-center shadow-card">
        <span className="mx-auto grid size-11 place-items-center rounded-lg bg-danger-soft text-danger">
          <AlertTriangle aria-hidden size={20} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          NEXORA could not load this view. The error has not been hidden; retry the request or
          contact an administrator if it continues.
        </p>
        {error.digest && <p className="mt-3 text-xs text-subtle">Reference: {error.digest}</p>}
        <button className={`${buttonClassName()} mt-6`} onClick={reset} type="button">
          <RotateCcw aria-hidden size={16} /> Try again
        </button>
      </div>
    </main>
  )
}
