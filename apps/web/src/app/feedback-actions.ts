'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createFeedbackSchema } from '@nexora/contracts'

import { ApiRequestError, apiRequest } from '@/lib/api'
import { feedbackMutationRequest, type FeedbackMutation } from '@/lib/feedback-mutations'
import { requireViewer } from '@/lib/viewer'

export interface FeedbackActionState {
  error?: string
  success?: string
}
const text = (data: FormData, name: string) => {
  const value = data.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
async function run(id: string, mutation: FeedbackMutation, success: string) {
  try {
    const request = feedbackMutationRequest(id, mutation)
    await apiRequest(request.path, {
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      method: request.method,
    })
    revalidatePath(`/beauroi/feedback/${id}`)
    revalidatePath(`/portal/feedback/${id}`)
    revalidatePath('/beauroi/feedback')
    revalidatePath('/portal/feedback')
    return { success }
  } catch (error) {
    return {
      error:
        error instanceof ApiRequestError
          ? error.message
          : 'The feedback change could not be completed.',
    }
  }
}
export async function createFeedbackAction(
  _state: FeedbackActionState,
  data: FormData,
): Promise<FeedbackActionState> {
  try {
    await requireViewer('customer')
    const input = createFeedbackSchema.parse({
      bugEnvironment: text(data, 'bugEnvironment') || null,
      bugReproductionSteps: text(data, 'bugReproductionSteps') || null,
      description: text(data, 'description'),
      featureDesiredOutcome: text(data, 'featureDesiredOutcome') || null,
      featureProblemStatement: text(data, 'featureProblemStatement') || null,
      productId: text(data, 'productId'),
      title: text(data, 'title'),
      type: text(data, 'type'),
    })
    const result = (await apiRequest('/feedback', {
      body: JSON.stringify(input),
      method: 'POST',
    })) as { data: { id: string } }
    redirect(`/portal/feedback/${result.data.id}`)
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error
    return {
      error:
        error instanceof ApiRequestError
          ? error.message
          : 'Check the feedback details and try again.',
    }
  }
}
export async function addCustomerFeedbackMessage(
  id: string,
  _state: FeedbackActionState,
  data: FormData,
) {
  return run(id, { body: text(data, 'body'), kind: 'message' }, 'Response added.')
}
export async function addStaffFeedbackResponse(
  id: string,
  _state: FeedbackActionState,
  data: FormData,
) {
  return run(id, { body: text(data, 'body'), kind: 'response' }, 'Customer-visible response added.')
}
export async function addFeedbackInternalNote(
  id: string,
  _state: FeedbackActionState,
  data: FormData,
) {
  return run(id, { body: text(data, 'body'), kind: 'internal-note' }, 'Internal triage note added.')
}
export async function updateFeedbackStatusAction(
  id: string,
  _state: FeedbackActionState,
  data: FormData,
) {
  return run(id, { kind: 'status', status: text(data, 'status') }, 'Feedback status updated.')
}
export async function updateFeedbackTriageAction(
  id: string,
  _state: FeedbackActionState,
  data: FormData,
) {
  return run(
    id,
    {
      isPublic: data.get('isPublic') === 'on',
      kind: 'triage',
      priority: text(data, 'priority') || null,
      severity: text(data, 'severity') || null,
    },
    'Feedback triage updated.',
  )
}
export async function toggleFeatureVoteAction(
  id: string,
  remove: boolean,
  state: FeedbackActionState,
) {
  void state
  return run(id, { kind: 'vote', remove }, remove ? 'Vote removed.' : 'Vote recorded.')
}
