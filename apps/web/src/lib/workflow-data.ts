import { z } from 'zod'

const nullableString = z.string().nullable()

export const workflowOptionsSchema = z.object({
  data: z.object({
    organizations: z.array(z.object({ id: z.uuid(), name: z.string() })),
    products: z.array(z.object({ code: z.string(), id: z.uuid(), name: z.string() })),
    staff: z.array(z.object({ designation: nullableString, fullName: z.string(), id: z.uuid() })),
    subscriptions: z.array(z.object({ organizationId: z.uuid(), productId: z.uuid() })),
  }),
})
export type WorkflowOptions = z.infer<typeof workflowOptionsSchema>['data']

export const portfolioRowSchema = z
  .object({
    blockedCount: z.coerce.number().int().nonnegative(),
    customerUpdate: nullableString.optional(),
    id: z.uuid(),
    name: z.string(),
    organizationId: z.uuid(),
    organizationName: z.string(),
    overdueCount: z.coerce.number().int().nonnegative(),
    ownerUserId: z.uuid().nullable(),
    ownerName: nullableString,
    phase: z.string().optional(),
    productId: z.uuid(),
    productName: z.string(),
    progressPercent: z.coerce.number().int().min(0).max(100),
    status: z.string(),
    targetCompletionOn: nullableString.optional(),
    targetGoLiveOn: nullableString.optional(),
  })
  .passthrough()
export type PortfolioRow = z.infer<typeof portfolioRowSchema>

export const portfolioResponseSchema = z.object({
  data: z.array(portfolioRowSchema),
  meta: z.object({ nextCursor: nullableString }),
})

export const onboardingDetailSchema = z.object({
  data: portfolioRowSchema.extend({
    actualGoLiveOn: nullableString,
    documents: z.array(
      z
        .object({
          dueAt: nullableString,
          id: z.uuid(),
          name: z.string(),
          status: z.string(),
        })
        .passthrough(),
    ),
    startsOn: nullableString,
    tasks: z.array(
      z
        .object({
          description: nullableString,
          dueAt: nullableString,
          id: z.uuid(),
          sortOrder: z.number(),
          status: z.string(),
          title: z.string(),
        })
        .passthrough(),
    ),
    trainingSessions: z.array(
      z
        .object({
          deliveryMethod: z.string(),
          durationMinutes: z.number(),
          id: z.uuid(),
          scheduledAt: z.string(),
          status: z.string(),
          title: z.string(),
        })
        .passthrough(),
    ),
    uploadAvailable: z.boolean(),
  }),
})
export type OnboardingDetail = z.infer<typeof onboardingDetailSchema>['data']

export const implementationDetailSchema = z.object({
  data: portfolioRowSchema.extend({
    actualCompletionOn: nullableString,
    customerUpdate: nullableString,
    milestones: z.array(
      z
        .object({
          completedAt: nullableString,
          description: nullableString,
          dueOn: nullableString,
          id: z.uuid(),
          sortOrder: z.number(),
          status: z.string(),
          title: z.string(),
        })
        .passthrough(),
    ),
    notes: z.array(
      z
        .object({
          body: z.string(),
          createdAt: z.string(),
          id: z.uuid(),
          visibility: z.enum(['INTERNAL', 'SHARED']),
        })
        .passthrough(),
    ),
    requirementSummary: nullableString.optional(),
    startsOn: nullableString,
  }),
})
export type ImplementationDetail = z.infer<typeof implementationDetailSchema>['data']

export const customerOnboardingResponseSchema = z.object({
  data: z.array(onboardingDetailSchema.shape.data),
})
export const customerImplementationResponseSchema = z.object({
  data: z.array(implementationDetailSchema.shape.data),
})

export function workflowFilterUrl(
  pathname: string,
  current: URLSearchParams | ReadonlyURLSearchParams,
  name: string,
  value: string,
): string {
  const next = new URLSearchParams(current.toString())
  if (value) next.set(name, value)
  else next.delete(name)
  next.delete('cursor')
  const query = next.toString()
  return query ? `${pathname}?${query}` : pathname
}

interface ReadonlyURLSearchParams {
  toString(): string
}
