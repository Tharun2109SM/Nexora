import {
  customerReleaseListQuerySchema,
  maintenanceListQuerySchema,
  releaseListResponseSchema,
  staffReleaseListQuerySchema,
  type releaseStatusSchema,
} from '@nexora/contracts'
import type { z } from 'zod'

export type ReleaseListItem = z.infer<typeof releaseListResponseSchema>['data'][number]
export type ReleaseStatus = z.infer<typeof releaseStatusSchema>

function scalar(values: Record<string, string | string[] | undefined>, key: string) {
  const value = values[key]
  return typeof value === 'string' && value ? value : undefined
}
function queryParameters(values: Record<string, unknown>) {
  return new URLSearchParams(
    Object.entries(values).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, String(value)]],
    ),
  )
}
export function releaseParams(
  values: Record<string, string | string[] | undefined>,
  staff: boolean,
) {
  const input = {
    cursor: scalar(values, 'cursor'),
    limit: scalar(values, 'limit'),
    productId: scalar(values, 'productId'),
    search: scalar(values, 'search'),
    sort: scalar(values, 'sort'),
    ...(staff ? { status: scalar(values, 'status') } : {}),
  }
  const parsed = (staff ? staffReleaseListQuerySchema : customerReleaseListQuerySchema).parse(input)
  return queryParameters(parsed)
}
export function maintenanceParams(values: Record<string, string | string[] | undefined>) {
  const parsed = maintenanceListQuerySchema.parse({
    limit: scalar(values, 'maintenanceLimit'),
    productId: scalar(values, 'productId'),
    status: scalar(values, 'maintenanceStatus'),
  })
  return queryParameters(parsed)
}
export function releaseTransitions(status: ReleaseStatus): ReleaseStatus[] {
  const transitions: Record<ReleaseStatus, ReleaseStatus[]> = {
    ARCHIVED: [],
    DRAFT: ['SCHEDULED', 'PUBLISHED'],
    PUBLISHED: ['ARCHIVED'],
    SCHEDULED: ['DRAFT', 'PUBLISHED'],
  }
  return transitions[status]
}
export function releaseTone(value: string) {
  if (['CANCELLED', 'ARCHIVED', 'DEPRECATION'].includes(value)) return 'danger'
  if (['DRAFT', 'SCHEDULED', 'SECURITY', 'IMPORTANT_CHANGE'].includes(value)) return 'warning'
  if (['PUBLISHED', 'ACTIVE', 'COMPLETED', 'NEW_FEATURE'].includes(value)) return 'success'
  return 'muted'
}
