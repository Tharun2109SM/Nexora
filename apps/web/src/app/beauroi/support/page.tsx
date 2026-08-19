import {
  supportFilterMetadataResponseSchema,
  supportTicketListResponseSchema,
} from '@nexora/contracts'
import type { Metadata } from 'next'

import { SupportFilters } from '@/components/support-filters'
import { SupportQueue } from '@/components/support-queue'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { supportQueueParams } from '@/lib/support-data'

export const metadata: Metadata = { title: 'Product support' }

export default async function SupportQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const values = await searchParams
  const params = supportQueueParams(values)
  const [queueResult, metadataResult] = await Promise.all([
    apiRequest(`/support/queue?${params.toString()}`),
    apiRequest('/support/filter-metadata'),
  ])
  const queue = supportTicketListResponseSchema.parse(queueResult)
  const metadata = supportFilterMetadataResponseSchema.parse(metadataResult).data
  const nextParams = new URLSearchParams(params)
  if (queue.nextCursor) nextParams.set('cursor', queue.nextCursor)
  const filtered = [...params.keys()].some((name) => !['cursor', 'limit', 'sort'].includes(name))
  return (
    <div className="space-y-7">
      <PageHeader
        description="Triage customer issues, monitor SLA deadlines, and coordinate secure customer-visible and internal support work."
        eyebrow="Support operations"
        title="Product support"
      />
      <SupportFilters
        assignees={metadata.assignees.map((item) => ({ id: item.id, name: item.fullName }))}
        categories={metadata.categories.map((item) => ({ id: item.id, name: item.name }))}
        organizations={metadata.organizations}
        products={metadata.products}
      />
      <SupportQueue
        filtered={filtered}
        nextHref={queue.nextCursor ? `?${nextParams.toString()}` : null}
        rows={queue.data}
      />
    </div>
  )
}
