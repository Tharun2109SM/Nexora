import {
  customerSupportTicketDetailSchema,
  supportProductsResponseSchema,
  supportTicketListResponseSchema,
} from '@nexora/contracts'
import { z } from 'zod'

export type CustomerSupportTicket = z.infer<typeof supportTicketListResponseSchema>['data'][number]
export type CustomerSupportDetail = z.infer<typeof customerSupportTicketDetailSchema>
export type SupportProduct = z.infer<typeof supportProductsResponseSchema>['data'][number]

const apiFilterNames = [
  'categoryId',
  'cursor',
  'limit',
  'productId',
  'search',
  'sort',
  'status',
] as const

const pageStateNames = [...apiFilterNames, 'newProductId', 'raise'] as const

export const customerVisibleSupportEvents = [
  'TICKET_CREATED',
  'STATUS_CHANGED',
  'CUSTOMER_REPLIED',
  'STAFF_REPLIED',
  'RESOLVED',
  'CLOSED',
] as const

export function customerSupportParams(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams()
  for (const name of apiFilterNames) {
    const value = values[name]
    if (typeof value === 'string' && value.length > 0) params.set(name, value)
  }
  return params
}

export function customerSupportUrl(
  pathname: string,
  current: { toString(): string },
  name: string,
  value: string,
) {
  if (!pageStateNames.includes(name as (typeof pageStateNames)[number])) return pathname
  const params = new URLSearchParams(current.toString())
  if (value) params.set(name, value)
  else params.delete(name)
  if (apiFilterNames.includes(name as (typeof apiFilterNames)[number])) params.delete('cursor')
  if (name === 'productId') params.delete('categoryId')
  if (name === 'newProductId') params.delete('newCategoryId')
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function customerSupportDetailPresentation(data: CustomerSupportDetail) {
  return {
    attachmentsAvailable: data.storage.attachmentsAvailable,
    categoryLabel: data.category?.name ?? 'Uncategorized',
    events: data.events.filter((event) =>
      customerVisibleSupportEvents.includes(
        event.eventType as (typeof customerVisibleSupportEvents)[number],
      ),
    ),
    messages: data.messages,
    productLabel: data.product?.name ?? 'Product unavailable',
  }
}

export function formatSupportEvent(value: string) {
  const labels: Record<string, string> = {
    CLOSED: 'Ticket closed',
    CUSTOMER_REPLIED: 'Customer replied',
    RESOLVED: 'Ticket resolved',
    STAFF_REPLIED: 'Beau Roi replied',
    STATUS_CHANGED: 'Status changed',
    TICKET_CREATED: 'Ticket created',
  }
  return labels[value] ?? 'Ticket updated'
}
