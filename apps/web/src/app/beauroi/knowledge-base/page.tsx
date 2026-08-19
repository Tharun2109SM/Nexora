import {
  knowledgeMetadataResponseSchema,
  staffKnowledgeListResponseSchema,
} from '@nexora/contracts'
import type { Metadata } from 'next'

import {
  KnowledgeCreateForm,
  KnowledgeFilters,
  KnowledgePortfolio,
} from '@/components/knowledge-ui'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { knowledgeParams } from '@/lib/knowledge-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Knowledge base' }
export default async function StaffKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireViewer('beauroi')
  const params = knowledgeParams(await searchParams, true)
  const [portfolioResult, metadataResult] = await Promise.all([
    apiRequest(`/knowledge/queue?${params}`),
    apiRequest('/knowledge/filter-metadata'),
  ])
  const portfolio = staffKnowledgeListResponseSchema.parse(portfolioResult)
  const filters = knowledgeMetadataResponseSchema.parse(metadataResult)
  const next = new URLSearchParams(params)
  if (portfolio.nextCursor) next.set('cursor', portfolio.nextCursor)
  return (
    <div className="space-y-8">
      <PageHeader
        description="Author, review, publish, and audit trustworthy product guidance for the right customer audience."
        eyebrow="Product operations"
        title="Knowledge base"
      />
      {viewer.role === 'BEAUROI_ADMIN' ? (
        <KnowledgeCreateForm metadata={filters} />
      ) : (
        <section className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
          <p className="font-semibold">Read-only knowledge portfolio</p>
          <p className="mt-1 text-muted">
            Authoring and publication require a Beau Roi administrator.
          </p>
        </section>
      )}
      <KnowledgeFilters metadata={filters} staff />
      <KnowledgePortfolio
        articles={portfolio.data}
        customer={false}
        nextHref={portfolio.nextCursor ? `?${next}` : null}
      />
    </div>
  )
}
