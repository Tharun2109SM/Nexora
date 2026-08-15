import { cn } from '@/lib/utils'

export function HealthIndicator({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-subtle">Not assessed</span>
  const band = score >= 70 ? 'Healthy' : score >= 40 ? 'Watch' : 'At risk'
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-danger',
        )}
      />
      {score} · {band}
    </span>
  )
}
