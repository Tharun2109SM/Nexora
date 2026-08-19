import {
  customerFeedbackDetailSchema,
  customerFeedbackListQuerySchema,
  feedbackListResponseSchema,
  staffFeedbackDetailSchema,
  staffFeedbackQueueQuerySchema,
} from '@nexora/contracts'
import type { z } from 'zod'

export type FeedbackListItem = z.infer<typeof feedbackListResponseSchema>['data'][number]
export type CustomerFeedbackDetail = z.infer<typeof customerFeedbackDetailSchema>
export type StaffFeedbackDetail = z.infer<typeof staffFeedbackDetailSchema>

function scalar(values: Record<string, string | string[] | undefined>, key: string) {
  const value = values[key]
  return typeof value === 'string' && value ? value : undefined
}

export function feedbackParams(
  values: Record<string, string | string[] | undefined>,
  staff: boolean,
) {
  const base = {
    cursor: scalar(values, 'cursor'),
    limit: scalar(values, 'limit'),
    productId: scalar(values, 'productId'),
    search: scalar(values, 'search'),
    sort: scalar(values, 'sort'),
    status: scalar(values, 'status'),
    type: scalar(values, 'type'),
  }
  const parsed = staff
    ? staffFeedbackQueueQuerySchema.parse({
        ...base,
        organizationId: scalar(values, 'organizationId'),
        priority: scalar(values, 'priority'),
      })
    : customerFeedbackListQuerySchema.parse({ ...base, scope: scalar(values, 'scope') })
  const params = new URLSearchParams()
  Object.entries(parsed).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value))
  })
  return params
}

export function feedbackTone(value: string) {
  if (['DECLINED', 'CRITICAL', 'URGENT'].includes(value)) return 'danger'
  if (['SUBMITTED', 'UNDER_REVIEW', 'HIGH'].includes(value)) return 'warning'
  if (['SHIPPED', 'COMPLETED', 'PLANNED'].includes(value)) return 'success'
  return 'muted'
}

export function feedbackTransitions(status: StaffFeedbackDetail['status']) {
  const map: Record<StaffFeedbackDetail['status'], StaffFeedbackDetail['status'][]> = {
    DECLINED: [],
    IN_PROGRESS: ['SHIPPED', 'DECLINED'],
    PLANNED: ['IN_PROGRESS', 'DECLINED'],
    SHIPPED: [],
    SUBMITTED: ['UNDER_REVIEW', 'DECLINED'],
    UNDER_REVIEW: ['PLANNED', 'IN_PROGRESS', 'DECLINED'],
  }
  return map[status]
}
