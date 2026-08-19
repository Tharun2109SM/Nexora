'use server'

import {
  createKnowledgeArticleSchema,
  transitionKnowledgeArticleSchema,
  updateKnowledgeContentSchema,
  updateKnowledgeScopeSchema,
} from '@nexora/contracts'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { ApiRequestError, apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export interface KnowledgeActionState {
  error?: string
  success?: string
}
const text = (data: FormData, name: string) => {
  const value = data.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
function message(error: unknown) {
  return error instanceof ApiRequestError
    ? error.message
    : 'The knowledge change could not be completed.'
}
export async function createKnowledgeArticleAction(
  _state: KnowledgeActionState,
  data: FormData,
): Promise<KnowledgeActionState> {
  try {
    await requireViewer('beauroi')
    const input = createKnowledgeArticleSchema.parse({
      articleType: text(data, 'articleType'),
      audience: text(data, 'audience'),
      body: text(data, 'body'),
      categoryId: text(data, 'categoryId') || null,
      externalUrl: text(data, 'externalUrl') || null,
      organizationId: text(data, 'organizationId') || null,
      productId: text(data, 'productId') || null,
      summary: text(data, 'summary') || null,
      title: text(data, 'title'),
    })
    const result = (await apiRequest('/knowledge', {
      body: JSON.stringify(input),
      method: 'POST',
    })) as { data: { id: string } }
    redirect(`/beauroi/knowledge-base/${result.data.id}`)
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error
    return { error: message(error) }
  }
}
export async function updateKnowledgeContentAction(
  articleId: string,
  _state: KnowledgeActionState,
  data: FormData,
): Promise<KnowledgeActionState> {
  try {
    const input = updateKnowledgeContentSchema.parse({
      body: text(data, 'body'),
      externalUrl: text(data, 'externalUrl') || null,
      summary: text(data, 'summary') || null,
      title: text(data, 'title'),
    })
    await apiRequest(`/knowledge/${articleId}/content`, {
      body: JSON.stringify(input),
      method: 'PATCH',
    })
    revalidatePath(`/beauroi/knowledge-base/${articleId}`)
    return { success: 'Article content updated.' }
  } catch (error) {
    return { error: message(error) }
  }
}
export async function updateKnowledgeScopeAction(
  articleId: string,
  _state: KnowledgeActionState,
  data: FormData,
): Promise<KnowledgeActionState> {
  try {
    const input = updateKnowledgeScopeSchema.parse({
      articleType: text(data, 'articleType'),
      audience: text(data, 'audience'),
      categoryId: text(data, 'categoryId') || null,
      organizationId: text(data, 'organizationId') || null,
      productId: text(data, 'productId') || null,
    })
    await apiRequest(`/knowledge/${articleId}/scope`, {
      body: JSON.stringify(input),
      method: 'PUT',
    })
    revalidatePath(`/beauroi/knowledge-base/${articleId}`)
    return { success: 'Article scope updated.' }
  } catch (error) {
    return { error: message(error) }
  }
}
export async function transitionKnowledgeAction(
  articleId: string,
  _state: KnowledgeActionState,
  data: FormData,
): Promise<KnowledgeActionState> {
  try {
    const input = transitionKnowledgeArticleSchema.parse({ status: text(data, 'status') })
    await apiRequest(`/knowledge/${articleId}/status`, {
      body: JSON.stringify(input),
      method: 'PATCH',
    })
    revalidatePath('/beauroi/knowledge-base')
    revalidatePath(`/beauroi/knowledge-base/${articleId}`)
    revalidatePath('/portal/knowledge-base')
    return { success: 'Article lifecycle updated.' }
  } catch (error) {
    return { error: message(error) }
  }
}
