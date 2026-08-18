'use client'

import { AlertCircle } from 'lucide-react'

import { buttonClassName } from './ui'

export function ErrorState({ message, reset }: { message: string; reset: () => void }) {
  return (
    <section className="rounded-lg border border-danger/30 bg-surface p-8 text-center">
      <AlertCircle aria-hidden className="mx-auto text-danger" />
      <h1 className="mt-4 font-display text-xl font-semibold">Unable to load this workspace</h1>
      <p className="mt-2 text-sm text-muted">{message} No changes were made.</p>
      <button className={`${buttonClassName('secondary')} mt-5`} onClick={reset} type="button">
        Try again
      </button>
    </section>
  )
}
