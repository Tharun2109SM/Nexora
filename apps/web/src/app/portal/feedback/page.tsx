import { feedbackListResponseSchema, feedbackProductsResponseSchema } from '@nexora/contracts'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { FeedbackFilters } from '@/components/feedback-filters'
import { FeedbackQueue } from '@/components/feedback-queue'
import { FeedbackSubmissionForm } from '@/components/feedback-submission-form'
import { PageHeader, buttonClassName } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { feedbackParams } from '@/lib/feedback-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Feedback & feature requests' }
export default async function CustomerFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireViewer('customer')
  const values = await searchParams
  const params = feedbackParams(values, false)
  const [listResult, productResult] = await Promise.all([
    apiRequest(`/feedback?${params}`),
    apiRequest('/feedback/products'),
  ])
  const list = feedbackListResponseSchema.parse(listResult)
  const products = feedbackProductsResponseSchema.parse(productResult).data
  const submit = values.submit === '1'
  const type = typeof values.type === 'string' ? values.type : 'GENERAL'
  const next = new URLSearchParams(params)
  if (list.nextCursor) next.set('cursor', list.nextCursor)
  const filtered = [...params.keys()].some((k) => !['cursor', 'limit', 'sort', 'scope'].includes(k))
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          description="Share product feedback, report bugs, request features, and follow approved customer-visible progress."
          eyebrow="Customer voice"
          title="Feedback & feature requests"
        />
        {!submit && (
          <Link className={buttonClassName()} href="/portal/feedback?submit=1">
            <Plus size={16} /> Submit feedback
          </Link>
        )}
      </div>
      {submit ? (
        <FeedbackSubmissionForm products={products} selectedType={type} />
      ) : (
        <>
          <FeedbackFilters products={products} staff={false} />
          <FeedbackQueue
            filtered={filtered}
            nextHref={list.nextCursor ? `?${next}` : null}
            rows={list.data}
            staff={false}
          />
        </>
      )}
    </div>
  )
}
