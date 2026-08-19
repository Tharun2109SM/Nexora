import {
  customerKnowledgeListResponseSchema,
  knowledgeMetadataResponseSchema,
} from '@nexora/contracts'
import type { Metadata } from 'next'

import { KnowledgeFilters, KnowledgePortfolio } from '@/components/knowledge-ui'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { knowledgeParams } from '@/lib/knowledge-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Knowledge center' }
export default async function CustomerKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireViewer('customer')
  const params = knowledgeParams(await searchParams, false)
  const [articlesResult, metadataResult] = await Promise.all([
    apiRequest(`/knowledge?${params}`),
    apiRequest('/knowledge/filter-metadata'),
  ])
  const articles = customerKnowledgeListResponseSchema.parse(articlesResult)
  const metadata = knowledgeMetadataResponseSchema.parse(metadataResult)
  const next = new URLSearchParams(params)
  if (articles.nextCursor) next.set('cursor', articles.nextCursor)
  return (
    <div className="space-y-8">
      <PageHeader
        description="Search product guidance intentionally published for your organization and active subscriptions."
        eyebrow="Help and documentation"
        title="Knowledge center"
      />
      <KnowledgeFilters metadata={metadata} staff={false} />
      <KnowledgePortfolio
        articles={articles.data}
        customer
        nextHref={articles.nextCursor ? `?${next}` : null}
      />
    </div>
  )
}
