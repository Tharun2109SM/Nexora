import { z } from 'zod'

export const APP_ROLES = [
  'BEAUROI_ADMIN',
  'BEAUROI_EMPLOYEE',
  'CUSTOMER_ADMIN',
  'CUSTOMER_MEMBER',
] as const

export const appRoleSchema = z.enum(APP_ROLES)
export type AppRole = z.infer<typeof appRoleSchema>

export const BEAUROI_ROLES: readonly AppRole[] = ['BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE']
export const CUSTOMER_ROLES: readonly AppRole[] = ['CUSTOMER_ADMIN', 'CUSTOMER_MEMBER']

export const portalSchema = z.enum(['beauroi', 'customer'])
export type Portal = z.infer<typeof portalSchema>

export const companySizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const

const optionalUrl = z.union([
  z.literal(''),
  z.url('Enter a valid company website').trim().max(2048),
])

export const loginSchema = z.object({
  email: z.email('Enter a valid work email').trim().max(320),
  password: z.string().min(1, 'Enter your password').max(128),
})

export const registrationSchema = z
  .object({
    companyName: z.string().trim().min(2, 'Enter the company name').max(160),
    companyWebsite: optionalUrl,
    industry: z.string().trim().min(2, 'Select or enter an industry').max(100),
    companySize: z.enum(companySizes, { error: 'Select the company size' }),
    country: z.string().trim().min(2, 'Select or enter a country').max(100),
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    designation: z.string().trim().min(2, 'Enter your designation').max(120),
    email: z.email('Enter a valid work email').trim().max(320),
    phone: z.string().trim().min(7, 'Enter a valid phone number').max(32),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(128)
      .regex(/[A-Z]/, 'Add an uppercase letter')
      .regex(/[a-z]/, 'Add a lowercase letter')
      .regex(/[0-9]/, 'Add a number'),
    confirmPassword: z.string(),
    acceptedTerms: z.literal('on', { error: 'Accept the Terms and Conditions' }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegistrationInput = z.infer<typeof registrationSchema>

export function portalForRole(role: AppRole): Portal {
  return BEAUROI_ROLES.includes(role) ? 'beauroi' : 'customer'
}

export function routeForRole(role: AppRole): '/beauroi' | '/portal' {
  return portalForRole(role) === 'beauroi' ? '/beauroi' : '/portal'
}

export function canAccessPortal(role: AppRole, portal: Portal): boolean {
  return portalForRole(role) === portal
}

export interface ViewerContext {
  userId: string
  role: AppRole
  organizationId: string
}

export function canAccessOrganization(viewer: ViewerContext, organizationId: string): boolean {
  return BEAUROI_ROLES.includes(viewer.role) || viewer.organizationId === organizationId
}

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>

export const lifecycleStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const
export const lifecycleStatusSchema = z.enum(lifecycleStatuses)
export type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>

export const customerAssignmentTypes = ['CSM', 'IMPLEMENTATION_ENGINEER'] as const
export const customerAssignmentTypeSchema = z.enum(customerAssignmentTypes)
export type CustomerAssignmentType = z.infer<typeof customerAssignmentTypeSchema>

export const customerMemberRoles = ['CUSTOMER_ADMIN', 'CUSTOMER_MEMBER'] as const
export const customerMemberRoleSchema = z.enum(customerMemberRoles)
export type CustomerMemberRole = z.infer<typeof customerMemberRoleSchema>

export const customerListQuerySchema = z
  .object({
    assignment: z.enum(['assigned', 'unassigned']).optional(),
    country: z.string().trim().min(1).max(100).optional(),
    cursor: z.string().trim().min(1).max(1024).optional(),
    healthBand: z.enum(['healthy', 'watch', 'at-risk', 'unassessed']).optional(),
    industry: z.string().trim().min(1).max(100).optional(),
    lifecycle: lifecycleStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).optional(),
    sort: z.enum(['name-asc', 'name-desc', 'newest', 'oldest']).default('name-asc'),
  })
  .strict()
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>

export const customerCursorSchema = z
  .object({ id: z.uuid(), sort: customerListQuerySchema.shape.sort, value: z.string().min(1) })
  .strict()
export type CustomerCursor = z.infer<typeof customerCursorSchema>

const nullableText = z.string().nullable()
export const customerSummarySchema = z
  .object({
    companySize: nullableText,
    country: nullableText,
    createdAt: z.iso.datetime({ offset: true }),
    currentProductVersion: nullableText,
    csmName: nullableText,
    healthScore: z.number().min(0).max(100).nullable(),
    id: z.uuid(),
    implementationEngineerName: nullableText,
    industry: nullableText,
    lastActivityAt: z.iso.datetime({ offset: true }).nullable(),
    lifecycleStatus: lifecycleStatusSchema,
    logoAvailable: z.boolean(),
    name: z.string(),
    openTicketCount: z.number().int().nonnegative(),
  })
  .strict()
export type CustomerSummary = z.infer<typeof customerSummarySchema>

export const customerListResponseSchema = z
  .object({
    data: z.array(customerSummarySchema),
    meta: z.object({ nextCursor: z.string().nullable() }).strict(),
  })
  .strict()
export type CustomerListResponse = z.infer<typeof customerListResponseSchema>

export const organizationProfileSchema = z
  .object({
    companySize: nullableText,
    country: nullableText,
    id: z.uuid(),
    industry: nullableText,
    lifecycleStatus: lifecycleStatusSchema,
    logoAvailable: z.boolean(),
    name: z.string(),
    website: nullableText,
  })
  .strict()
export type OrganizationProfile = z.infer<typeof organizationProfileSchema>

export const organizationProfileUpdateSchema = z
  .object({
    companySize: z.enum(companySizes).nullable(),
    country: z.string().trim().min(2).max(100).nullable(),
    industry: z.string().trim().min(2).max(100).nullable(),
    name: z.string().trim().min(2).max(160),
    website: z.union([z.url().max(2048), z.literal(''), z.null()]),
  })
  .strict()
export type OrganizationProfileUpdate = z.infer<typeof organizationProfileUpdateSchema>

export const lifecycleUpdateSchema = z.object({ status: lifecycleStatusSchema }).strict()
export type LifecycleUpdate = z.infer<typeof lifecycleUpdateSchema>

export const healthScoreCreateSchema = z
  .object({ reason: z.string().trim().min(3).max(1000), score: z.number().min(0).max(100) })
  .strict()
export type HealthScoreCreate = z.infer<typeof healthScoreCreateSchema>

export const assignmentCreateSchema = z
  .object({
    employeeUserId: z.uuid(),
    internalNote: z.string().trim().max(1000).nullable().optional(),
    type: customerAssignmentTypeSchema,
  })
  .strict()
export type AssignmentCreate = z.infer<typeof assignmentCreateSchema>

export const membershipStatusSchema = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'])
export const memberMutationSchema = z
  .object({
    role: customerMemberRoleSchema.optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
  })
  .strict()
  .refine(
    (value) => value.role !== undefined || value.status !== undefined,
    'Provide a role or status change',
  )
export type MemberMutation = z.infer<typeof memberMutationSchema>

export const invitationCreateSchema = z
  .object({
    email: z
      .email()
      .trim()
      .max(320)
      .transform((value) => value.toLowerCase()),
    expiresInDays: z.number().int().min(1).max(30).default(7),
    role: customerMemberRoleSchema,
  })
  .strict()
export type InvitationCreate = z.infer<typeof invitationCreateSchema>

export const onboardingStatuses = [
  'DRAFT',
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_GO_LIVE',
  'LIVE',
  'CANCELLED',
] as const
export const onboardingStatusSchema = z.enum(onboardingStatuses)
export const workflowItemStatuses = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
] as const
export const workflowItemStatusSchema = z.enum(workflowItemStatuses)
export const implementationStatuses = [
  'DRAFT',
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
] as const
export const implementationStatusSchema = z.enum(implementationStatuses)
export const implementationPhases = [
  'DISCOVERY',
  'REQUIREMENTS',
  'CONFIGURATION',
  'INTEGRATION',
  'VALIDATION',
  'GO_LIVE',
  'STABILIZATION',
  'COMPLETE',
] as const
export const implementationPhaseSchema = z.enum(implementationPhases)
export const trainingStatusSchema = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED'])
export const trainingDeliveryMethodSchema = z.enum(['REMOTE', 'ONSITE', 'HYBRID'])
export const documentRequestStatusSchema = z.enum([
  'REQUESTED',
  'RECEIVED',
  'ACCEPTED',
  'REJECTED',
  'WAIVED',
])
export const workflowOwnerKindSchema = z.enum(['BEAUROI', 'CUSTOMER'])

const dateInputSchema = z.iso.date()
const optionalDateInputSchema = dateInputSchema.nullable().optional()
const optionalDateTimeInputSchema = z.iso.datetime({ offset: true }).nullable().optional()
const workflowNameSchema = z.string().trim().min(2).max(160)

export const workflowListQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(1024).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    organizationId: z.uuid().optional(),
    ownerUserId: z.uuid().optional(),
    phase: implementationPhaseSchema.optional(),
    productId: z.uuid().optional(),
    search: z.string().trim().max(160).optional(),
    sort: z.enum(['name-asc', 'name-desc']).default('name-asc'),
    status: z.union([onboardingStatusSchema, implementationStatusSchema]).optional(),
  })
  .strict()
export type WorkflowListQuery = z.infer<typeof workflowListQuerySchema>
export const onboardingListQuerySchema = workflowListQuerySchema.extend({
  phase: z.undefined().optional(),
  status: onboardingStatusSchema.optional(),
})
export const implementationListQuerySchema = workflowListQuerySchema.extend({
  status: implementationStatusSchema.optional(),
})

export const workflowCursorSchema = z
  .object({ id: z.uuid(), sort: workflowListQuerySchema.shape.sort, value: z.string().min(1) })
  .strict()

export const onboardingPlanCreateSchema = z
  .object({
    actualGoLiveOn: optionalDateInputSchema,
    customerUpdate: z.string().trim().max(4000).nullable().optional(),
    name: workflowNameSchema,
    organizationId: z.uuid(),
    ownerUserId: z.uuid().nullable().optional(),
    productId: z.uuid(),
    readinessConfirmedAt: optionalDateTimeInputSchema,
    startsOn: optionalDateInputSchema,
    status: onboardingStatusSchema.default('DRAFT'),
    targetGoLiveOn: optionalDateInputSchema,
  })
  .strict()
export const onboardingPlanUpdateSchema = onboardingPlanCreateSchema
  .omit({ organizationId: true, productId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change')

export const onboardingTaskCreateSchema = z
  .object({
    assignedUserId: z.uuid().nullable().optional(),
    completedAt: optionalDateTimeInputSchema,
    description: z.string().trim().max(5000).nullable().optional(),
    dueAt: optionalDateTimeInputSchema,
    ownerKind: workflowOwnerKindSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).max(100000).default(0),
    status: workflowItemStatusSchema.default('NOT_STARTED'),
    title: z.string().trim().min(2).max(200),
  })
  .strict()
export const onboardingTaskUpdateSchema = onboardingTaskCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change')

export const trainingSessionCreateSchema = z
  .object({
    completedAt: optionalDateTimeInputSchema,
    deliveryMethod: trainingDeliveryMethodSchema.default('REMOTE'),
    description: z.string().trim().max(5000).nullable().optional(),
    durationMinutes: z.number().int().min(15).max(1440),
    facilitatorUserId: z.uuid().nullable().optional(),
    meetingLocation: z.string().trim().max(500).nullable().optional(),
    meetingUrl: z.union([z.url().max(2048), z.literal(''), z.null()]).optional(),
    scheduledAt: z.iso.datetime({ offset: true }),
    status: trainingStatusSchema.default('SCHEDULED'),
    title: z.string().trim().min(2).max(200),
  })
  .strict()
export const trainingSessionUpdateSchema = trainingSessionCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change')

export const requestedDocumentCreateSchema = z
  .object({
    description: z.string().trim().max(5000).nullable().optional(),
    dueAt: optionalDateTimeInputSchema,
    name: z.string().trim().min(2).max(200),
    requestedFromUserId: z.uuid().nullable().optional(),
    status: documentRequestStatusSchema.default('REQUESTED'),
    submittedAt: optionalDateTimeInputSchema,
  })
  .strict()
export const requestedDocumentUpdateSchema = requestedDocumentCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change')

export const implementationProjectCreateSchema = z
  .object({
    actualCompletionOn: optionalDateInputSchema,
    customerUpdate: z.string().trim().max(4000).nullable().optional(),
    name: workflowNameSchema,
    organizationId: z.uuid(),
    ownerUserId: z.uuid().nullable().optional(),
    phase: implementationPhaseSchema.default('DISCOVERY'),
    productId: z.uuid(),
    requirementSummary: z.string().trim().min(1).max(20000).nullable().optional(),
    startsOn: optionalDateInputSchema,
    status: implementationStatusSchema.default('DRAFT'),
    targetCompletionOn: optionalDateInputSchema,
  })
  .strict()
export const implementationProjectUpdateSchema = implementationProjectCreateSchema
  .omit({ organizationId: true, productId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change')

export const milestoneCreateSchema = z
  .object({
    completedAt: optionalDateTimeInputSchema,
    description: z.string().trim().max(5000).nullable().optional(),
    dueOn: optionalDateInputSchema,
    sortOrder: z.number().int().min(0).max(100000).default(0),
    status: workflowItemStatusSchema.default('NOT_STARTED'),
    title: z.string().trim().min(2).max(200),
  })
  .strict()
export const milestoneUpdateSchema = milestoneCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change')

export const projectNoteCreateSchema = z
  .object({ body: z.string().trim().min(1).max(20000), visibility: z.enum(['INTERNAL', 'SHARED']) })
  .strict()

export function calculateWorkflowProgress(
  statuses: readonly z.infer<typeof workflowItemStatusSchema>[],
): number {
  const counted = statuses.filter((status) => status !== 'CANCELLED')
  if (counted.length === 0) return 0
  return Math.round(
    (counted.filter((status) => status === 'COMPLETED').length / counted.length) * 100,
  )
}

export const invitationAcceptSchema = z.object({ token: z.string().min(32).max(512) }).strict()
export type InvitationAccept = z.infer<typeof invitationAcceptSchema>

export const invitationStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'])

export const organizationMemberSchema = z
  .object({
    id: z.uuid(),
    joined_at: z.iso.datetime({ offset: true }).nullable(),
    profiles: z
      .object({ designation: z.string().nullable(), full_name: z.string() })
      .strict()
      .nullable(),
    role: appRoleSchema,
    status: membershipStatusSchema,
    user_id: z.uuid(),
  })
  .strict()

export const customerAssignmentSchema = z
  .object({
    assigned_at: z.iso.datetime({ offset: true }),
    assigned_by: z.uuid().nullable(),
    assignment_type: z.string(),
    employee_user_id: z.uuid(),
    ended_at: z.iso.datetime({ offset: true }).nullable(),
    id: z.uuid(),
    is_active: z.boolean(),
  })
  .strict()

export const healthScoreSchema = z
  .object({
    calculated_at: z.iso.datetime({ offset: true }),
    calculated_by: z.uuid().nullable(),
    id: z.uuid(),
    reason: z.string(),
    score: z.coerce.number().min(0).max(100),
    source: z.enum(['MANUAL', 'SYSTEM', 'IMPORT']),
  })
  .strict()

export const auditEventSchema = z
  .object({
    action: z.string(),
    actor_role: appRoleSchema.nullable(),
    actor_user_id: z.uuid().nullable(),
    entity_id: z.uuid().nullable(),
    entity_type: z.string(),
    id: z.uuid(),
    metadata: z.record(z.string(), z.unknown()),
    occurred_at: z.iso.datetime({ offset: true }),
    request_id: z.string().nullable(),
  })
  .strict()

export const customerDetailResponseSchema = z
  .object({
    data: z
      .object({
        assignmentNotes: z.array(z.object({ assignment_id: z.uuid(), note: z.string() }).strict()),
        assignmentProfiles: z.array(
          z
            .object({ designation: z.string().nullable(), full_name: z.string(), id: z.uuid() })
            .strict(),
        ),
        assignments: z.array(customerAssignmentSchema),
        auditEvents: z.array(auditEventSchema),
        healthHistory: z.array(healthScoreSchema),
        members: z.array(organizationMemberSchema),
        organization: organizationProfileSchema,
        subscriptions: z.array(z.unknown()),
      })
      .strict(),
  })
  .strict()

export const invitationSchema = z
  .object({
    accepted_at: z.iso.datetime({ offset: true }).nullable(),
    created_at: z.iso.datetime({ offset: true }),
    expires_at: z.iso.datetime({ offset: true }),
    id: z.uuid(),
    intended_role: customerMemberRoleSchema,
    normalized_email: z.email(),
    revoked_at: z.iso.datetime({ offset: true }).nullable(),
    status: invitationStatusSchema,
  })
  .strict()

export const idParameterSchema = z.object({ organizationId: z.uuid() }).strict()
export const membershipParameterSchema = z
  .object({ membershipId: z.uuid(), organizationId: z.uuid() })
  .strict()
export const invitationParameterSchema = z
  .object({ invitationId: z.uuid(), organizationId: z.uuid() })
  .strict()
