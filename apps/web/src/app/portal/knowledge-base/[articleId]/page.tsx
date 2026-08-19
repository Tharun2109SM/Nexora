import { customerKnowledgeDetailResponseSchema } from '@nexora/contracts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AttachmentState, KnowledgeArticleDocument } from '@/components/knowledge-ui'
import { ButtonLink } from '@/components/ui'
import { ApiRequestError, apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Knowledge article' }
export default async function CustomerKnowledgeArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>
}) {
  await requireViewer('customer')
  const { articleId } = await params
  let result: unknown
  try {
    result = await apiRequest(`/knowledge/${articleId}`)
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'ARTICLE_NOT_FOUND') notFound()
    throw error
  }
  const article = customerKnowledgeDetailResponseSchema.parse(result)
  return (
    <div className="space-y-8">
      <ButtonLink href="/portal/knowledge-base" variant="secondary">
        Back to knowledge center
      </ButtonLink>
      <KnowledgeArticleDocument article={article.data} />
      <div className="mx-auto max-w-3xl">
        <AttachmentState available={article.attachmentsAvailable} />
      </div>
    </div>
  )
}
