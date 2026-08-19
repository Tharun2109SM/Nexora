export default function Loading() {
  return (
    <div className="grid gap-4" aria-label="Loading feedback">
      <div className="h-24 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-72 animate-pulse rounded-lg bg-surface-subtle" />
    </div>
  )
}
