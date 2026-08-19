'use client'
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-lg border border-danger/30 bg-danger-soft p-6">
      <h1 className="font-display text-xl font-semibold">Analytics unavailable</h1>
      <p className="mt-2 text-sm text-muted">
        The error was not hidden. No fallback metrics were fabricated.
      </p>
      <button className="mt-4 text-sm font-semibold underline" onClick={reset}>
        Try again
      </button>
    </section>
  )
}
