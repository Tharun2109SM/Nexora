'use server'

import { revalidatePath } from 'next/cache'

import { ApiRequestError, apiRequest } from '@/lib/api'
import { supportMutationRequest, type SupportMutation } from '@/lib/support-mutations'

export interface SupportActionState {
  error?: string
  success?: string
}

function value(formData: FormData, name: string) {
  const item = formData.get(name)
  return typeof item === 'string' ? item.trim() : ''
}

async function run(ticketId: string, operation: () => Promise<void>, success: string) {
  try {
    await operation()
    revalidatePath(`/beauroi/support/${ticketId}`)
    revalidatePath('/beauroi/support')
    return { success } satisfies SupportActionState
  } catch (error) {
    return {
      error:
        error instanceof ApiRequestError
          ? error.message
          : 'The support change could not be completed. No change was hidden.',
    } satisfies SupportActionState
  }
}

async function mutate(ticketId: string, mutation: SupportMutation) {
  const request = supportMutationRequest(ticketId, mutation)
  await apiRequest(request.path, {
    body: JSON.stringify(request.body),
    method: request.method,
  })
}

export async function addSupportReply(
  ticketId: string,
  _state: SupportActionState,
  formData: FormData,
) {
  return run(
    ticketId,
    () => mutate(ticketId, { body: value(formData, 'body'), kind: 'reply' }),
    'Customer-visible reply added.',
  )
}

export async function addSupportInternalNote(
  ticketId: string,
  _state: SupportActionState,
  formData: FormData,
) {
  return run(
    ticketId,
    () => mutate(ticketId, { body: value(formData, 'body'), kind: 'internal-note' }),
    'Internal note added.',
  )
}

export async function updateSupportStatus(
  ticketId: string,
  _state: SupportActionState,
  formData: FormData,
) {
  const summary = value(formData, 'resolutionSummary')
  return run(
    ticketId,
    () =>
      mutate(ticketId, {
        kind: 'status',
        ...(summary ? { resolutionSummary: summary } : {}),
        status: value(formData, 'status'),
      }),
    'Ticket status updated.',
  )
}

export async function updateSupportPriority(
  ticketId: string,
  _state: SupportActionState,
  formData: FormData,
) {
  return run(
    ticketId,
    () => mutate(ticketId, { kind: 'priority', priority: value(formData, 'priority') }),
    'Ticket priority updated.',
  )
}

export async function updateSupportCategory(
  ticketId: string,
  _state: SupportActionState,
  formData: FormData,
) {
  return run(
    ticketId,
    () => mutate(ticketId, { categoryId: value(formData, 'categoryId'), kind: 'category' }),
    'Ticket category updated.',
  )
}

export async function updateSupportAssignee(
  ticketId: string,
  _state: SupportActionState,
  formData: FormData,
) {
  const assigneeId = value(formData, 'assigneeId')
  return run(
    ticketId,
    () => mutate(ticketId, { assigneeId: assigneeId || null, kind: 'assignee' }),
    assigneeId ? 'Support owner updated.' : 'Support owner cleared.',
  )
}
