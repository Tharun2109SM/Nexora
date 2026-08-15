export default function Loading() {
  return (
    <div
      aria-label="Loading NEXORA"
      className="mx-auto w-full max-w-6xl animate-pulse px-5 py-12"
      role="status"
    >
      <div className="h-3 w-28 rounded bg-border" />
      <div className="mt-4 h-10 w-80 max-w-full rounded bg-border" />
      <div className="mt-3 h-4 w-[32rem] max-w-full rounded bg-border" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="h-36 rounded-lg border border-border bg-surface" key={item} />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
