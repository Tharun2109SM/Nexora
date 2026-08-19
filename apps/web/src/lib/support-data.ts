import {
  staffSupportTicketDetailSchema,
  supportCategorySchema,
  supportTicketListResponseSchema,
} from '@nexora/contracts'
import { z } from 'zod'

export const supportCategoriesResponseSchema = z
  .object({ data: z.array(supportCategorySchema) })
  .strict()

export type SupportTicketListItem = z.infer<typeof supportTicketListResponseSchema>['data'][number]
export type StaffSupportTicketDetail = z.infer<typeof staffSupportTicketDetailSchema>
export type SupportCategory = z.infer<typeof supportCategorySchema>

const filterNames = [
  'assigneeId',
  'categoryId',
  'cursor',
  'limit',
  'organizationId',
  'priority',
  'productId',
  'search',
  'sort',
  'status',
] as const

export function supportQueueParams(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams()
  for (const name of filterNames) {
    const value = values[name]
    if (typeof value === 'string' && value.length > 0) params.set(name, value)
  }
  return params
}

export function supportFilterUrl(
  pathname: string,
  current: { toString(): string },
  name: string,
  value: string,
) {
  if (!filterNames.includes(name as (typeof filterNames)[number])) return pathname
  const params = new URLSearchParams(current.toString())
  if (value) params.set(name, value)
  else params.delete(name)
  params.delete('cursor')
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function supportPageMetrics(rows: readonly SupportTicketListItem[]) {
  return {
    active: rows.filter((row) => !['RESOLVED', 'CLOSED'].includes(row.status)).length,
    slaAttention: rows.filter(
      (row) => row.sla.response.state === 'BREACHED' || row.sla.resolution.state === 'BREACHED',
    ).length,
    urgent: rows.filter((row) => row.priority === 'URGENT').length,
    waiting: rows.filter((row) => row.status === 'WAITING_ON_CUSTOMER').length,
  }
}

export function supportStatusTransitions(status: StaffSupportTicketDetail['status']) {
  const transitions: Record<
    StaffSupportTicketDetail['status'],
    StaffSupportTicketDetail['status'][]
  > = {
    CLOSED: [],
    IN_PROGRESS: ['WAITING_ON_CUSTOMER', 'RESOLVED'],
    OPEN: ['IN_PROGRESS', 'CLOSED'],
    RESOLVED: ['IN_PROGRESS', 'CLOSED'],
    WAITING_ON_CUSTOMER: ['IN_PROGRESS', 'RESOLVED'],
  }
  return transitions[status]
}

export function supportDetailPresentation(data: StaffSupportTicketDetail) {
  return {
    attachmentsAvailable: data.storage.attachmentsAvailable,
    categoryLabel: data.category?.name ?? 'Uncategorized',
    internalNotes: data.messages.filter((message) => message.isInternal),
    visibleMessages: data.messages.filter((message) => !message.isInternal),
  }
}

export function supportTone(value: string): 'danger' | 'muted' | 'success' | 'warning' {
  if (value === 'URGENT' || value === 'BREACHED') return 'danger'
  if (value === 'WAITING_ON_CUSTOMER' || value === 'HIGH' || value === 'PENDING') return 'warning'
  if (value === 'RESOLVED' || value === 'CLOSED' || value === 'MET') return 'success'
  return 'muted'
}
