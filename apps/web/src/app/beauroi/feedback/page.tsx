import { feedbackFilterMetadataResponseSchema, feedbackListResponseSchema } from '@nexora/contracts'
import type { Metadata } from 'next'

import { FeedbackFilters } from '@/components/feedback-filters'
import { FeedbackQueue } from '@/components/feedback-queue'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { feedbackParams } from '@/lib/feedback-data'

export const metadata: Metadata = { title: 'Feedback management' }
export default async function StaffFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const values = await searchParams
  const params = feedbackParams(values, true)
  const [queueResult, metadataResult] = await Promise.all([
    apiRequest(`/feedback/queue?${params}`),
    apiRequest('/feedback/filter-metadata'),
  ])
  const queue = feedbackListResponseSchema.parse(queueResult)
  const filters = feedbackFilterMetadataResponseSchema.parse(metadataResult).data
  const next = new URLSearchParams(params)
  if (queue.nextCursor) next.set('cursor', queue.nextCursor)
  const filtered = [...params.keys()].some((key) => !['cursor', 'limit', 'sort'].includes(key))
  return (
    <div className="space-y-7">
      <PageHeader
        description="Review customer feedback, triage bugs, assess feature demand, and keep private notes separate from customer-visible updates."
        eyebrow="Product operations"
        title="Feedback management"
      />
      <FeedbackFilters organizations={filters.organizations} products={filters.products} staff />
      <FeedbackQueue
        filtered={filtered}
        nextHref={queue.nextCursor ? `?${next}` : null}
        rows={queue.data}
        staff
      />
    </div>
  )
}
