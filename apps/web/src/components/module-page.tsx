import { Inbox } from 'lucide-react'

import type { NavigationItem } from '@/lib/navigation'
import { EmptyState, PageHeader } from '@/components/ui'

interface ModulePageProps {
  count: number
  item: NavigationItem
  portal: 'beauroi' | 'customer'
}

export function ModulePage({ count, item, portal }: ModulePageProps) {
  const isEmpty = count === 0
  return (
    <div className="space-y-7">
      <PageHeader
        description={item.description}
        eyebrow={portal === 'beauroi' ? 'Beau Roi workspace' : 'Customer workspace'}
        title={item.label}
      />
      {isEmpty ? (
        <EmptyState
          description={`There are no ${item.label.toLowerCase()} records available for this workspace yet. This page will become actionable when the module is implemented in a later milestone.`}
          icon={<item.icon aria-hidden size={19} />}
          note="No sample customer or operational data has been inserted."
          title={`No ${item.label.toLowerCase()} yet`}
        />
      ) : (
        <section className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-accent-soft text-accent">
              <Inbox aria-hidden size={18} />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold">
                {count} record{count === 1 ? '' : 's'} available
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                The workflow UI for this module is intentionally scheduled for a later milestone.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
