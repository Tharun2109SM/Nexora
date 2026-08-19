import {
  staffSupportTicketDetailSchema,
  supportEligibleAssigneesResponseSchema,
} from '@nexora/contracts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SupportWorkspace } from '@/components/support-workspace'
import { ApiRequestError, apiRequest } from '@/lib/api'
import { supportCategoriesResponseSchema } from '@/lib/support-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Support ticket' }

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const { ticketId } = await params
  await requireViewer('beauroi')
  const { categories, detail, eligibleAssignees } = await loadTicket(ticketId)
  return (
    <SupportWorkspace categories={categories} data={detail} eligibleAssignees={eligibleAssignees} />
  )
}

async function loadTicket(ticketId: string) {
  try {
    const detailResult = await apiRequest(`/support/tickets/${ticketId}`)
    const detail = staffSupportTicketDetailSchema.parse(
      typeof detailResult === 'object' && detailResult !== null && 'data' in detailResult
        ? detailResult.data
        : detailResult,
    )
    const categoryResult = await apiRequest(
      `/support/categories${detail.product ? `?productId=${detail.product.id}` : ''}`,
    )
    const categories = supportCategoriesResponseSchema.parse(categoryResult).data
    const eligibleAssignees = detail.capabilities.canAssign
      ? supportEligibleAssigneesResponseSchema.parse(
          await apiRequest(`/support/tickets/${ticketId}/eligible-assignees`),
        ).data
      : []
    return { categories, detail, eligibleAssignees }
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'SUPPORT_TICKET_NOT_FOUND') notFound()
    throw error
  }
}
