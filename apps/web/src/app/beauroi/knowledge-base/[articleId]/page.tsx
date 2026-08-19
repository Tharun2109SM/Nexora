import {
  knowledgeMetadataResponseSchema,
  staffKnowledgeDetailResponseSchema,
} from '@nexora/contracts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { KnowledgeBadge, KnowledgeStaffEditor } from '@/components/knowledge-ui'
import { ButtonLink, PageHeader } from '@/components/ui'
import { ApiRequestError, apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Knowledge article' }
export default async function StaffKnowledgeArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>
}) {
  const viewer = await requireViewer('beauroi')
  const { articleId } = await params
  let detailResult: unknown
  try {
    detailResult = await apiRequest(`/knowledge/${articleId}`)
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'ARTICLE_NOT_FOUND') notFound()
    throw error
  }
  const detail = staffKnowledgeDetailResponseSchema.parse(detailResult)
  const metadataResult = knowledgeMetadataResponseSchema.parse(
    await apiRequest('/knowledge/filter-metadata'),
  )
  return (
    <div className="space-y-8">
      <PageHeader
        action={
          <ButtonLink href="/beauroi/knowledge-base" variant="secondary">
            Back to portfolio
          </ButtonLink>
        }
        description="Review classification, content, lifecycle, and immutable publication history."
        eyebrow="Knowledge article"
        title={detail.data.title}
      />
      <div className="flex flex-wrap gap-2">
        <KnowledgeBadge>{detail.data.articleStatus}</KnowledgeBadge>
        <KnowledgeBadge>{detail.data.audience}</KnowledgeBadge>
        <KnowledgeBadge>{detail.data.articleType}</KnowledgeBadge>
      </div>
      {viewer.role === 'BEAUROI_ADMIN' ? (
        <KnowledgeStaffEditor article={detail.data} metadata={metadataResult} />
      ) : (
        <article className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <p className="whitespace-pre-wrap text-sm leading-7">{detail.data.body}</p>
        </article>
      )}
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-xl font-semibold">Article history</h2>
        {detail.data.events.length ? (
          <ol className="mt-4 space-y-3">
            {detail.data.events.map((event) => (
              <li className="border-l-2 border-border pl-4 text-sm" key={event.id}>
                <span className="font-semibold">{event.eventType.replaceAll('_', ' ')}</span>
                <span className="ml-2 text-subtle">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted">No lifecycle events have been recorded.</p>
        )}
      </section>
    </div>
  )
}
