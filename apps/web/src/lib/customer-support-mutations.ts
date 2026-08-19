import { addSupportMessageSchema, createSupportTicketSchema } from '@nexora/contracts'

export type CustomerSupportMutation =
  | {
      categoryId: string
      description: string
      kind: 'create'
      productId: string
      subject: string
    }
  | { body: string; kind: 'reply'; ticketId: string }

export function customerSupportMutationRequest(mutation: CustomerSupportMutation) {
  if (mutation.kind === 'create') {
    const body = createSupportTicketSchema.parse({
      categoryId: mutation.categoryId,
      description: mutation.description,
      productId: mutation.productId,
      subject: mutation.subject,
    })
    return { body, method: 'POST' as const, path: '/support/tickets' }
  }

  return {
    body: addSupportMessageSchema.parse({ body: mutation.body }),
    method: 'POST' as const,
    path: `/support/tickets/${mutation.ticketId}/messages`,
  }
}
