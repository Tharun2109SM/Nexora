import { customerSupportTicketDetailSchema } from '@nexora/contracts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomerSupportWorkspace } from '@/components/customer-support-workspace'
import { ApiRequestError, apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Support ticket' }

export default async function CustomerSupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  await requireViewer('customer')
  const { ticketId } = await params
  const data = await loadTicket(ticketId)
  return <CustomerSupportWorkspace data={data} />
}

async function loadTicket(ticketId: string) {
  try {
    const result = await apiRequest(`/support/tickets/${ticketId}`)
    return customerSupportTicketDetailSchema.parse(
      typeof result === 'object' && result !== null && 'data' in result ? result.data : result,
    )
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'SUPPORT_TICKET_NOT_FOUND') notFound()
    throw error
  }
}
