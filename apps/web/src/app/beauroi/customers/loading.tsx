export default function CustomersLoading() {
  return (
    <div aria-busy="true" aria-label="Loading customers" className="space-y-4">
      <div className="h-24 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-16 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-96 animate-pulse rounded-lg bg-surface-subtle" />
    </div>
  )
}
