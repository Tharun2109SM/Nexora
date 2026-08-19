'use server'

import { supportIdentifierResponseSchema } from '@nexora/contracts'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ZodError } from 'zod'

import { ApiRequestError, apiRequest } from '@/lib/api'
import {
  customerSupportMutationRequest,
  type CustomerSupportMutation,
} from '@/lib/customer-support-mutations'
import { requireViewer } from '@/lib/viewer'

export interface CustomerSupportActionState {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  success?: string
}

function field(formData: FormData, name: string) {
  const item = formData.get(name)
  return typeof item === 'string' ? item.trim() : ''
}

async function mutate(mutation: CustomerSupportMutation) {
  const request = customerSupportMutationRequest(mutation)
  return apiRequest(request.path, {
    body: JSON.stringify(request.body),
    method: request.method,
  })
}

export async function createCustomerSupportTicket(
  _state: CustomerSupportActionState,
  formData: FormData,
): Promise<CustomerSupportActionState> {
  await requireViewer('customer')
  let identifier: string
  try {
    const result = await mutate({
      categoryId: field(formData, 'categoryId'),
      description: field(formData, 'description'),
      kind: 'create',
      productId: field(formData, 'productId'),
      subject: field(formData, 'subject'),
    })
    identifier = supportIdentifierResponseSchema.parse(result).data.id
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: 'Review the highlighted ticket details.',
        fieldErrors: error.flatten().fieldErrors,
      } satisfies CustomerSupportActionState
    }
    return {
      error:
        error instanceof ApiRequestError
          ? error.message
          : 'The ticket could not be created. No successful submission was recorded.',
    } satisfies CustomerSupportActionState
  }

  revalidatePath('/portal/support')
  redirect(`/portal/support/${identifier}`)
}

export async function addCustomerSupportReply(
  ticketId: string,
  _state: CustomerSupportActionState,
  formData: FormData,
): Promise<CustomerSupportActionState> {
  await requireViewer('customer')
  try {
    await mutate({ body: field(formData, 'body'), kind: 'reply', ticketId })
    revalidatePath(`/portal/support/${ticketId}`)
    revalidatePath('/portal/support')
    return { success: 'Reply added to the customer-visible conversation.' }
  } catch (error) {
    return {
      error:
        error instanceof ZodError
          ? 'Enter a reply before sending.'
          : error instanceof ApiRequestError
            ? error.message
            : 'The reply could not be added. No successful submission was recorded.',
    }
  }
}
