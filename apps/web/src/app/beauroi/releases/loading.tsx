export default function Loading() {
  return (
    <div aria-label="Loading releases" className="grid gap-4">
      <div className="h-24 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-72 animate-pulse rounded-lg bg-surface-subtle" />
    </div>
  )
}
