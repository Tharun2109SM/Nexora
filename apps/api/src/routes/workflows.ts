import {
  implementationProjectCreateSchema,
  implementationProjectUpdateSchema,
  implementationListQuerySchema,
  milestoneCreateSchema,
  milestoneUpdateSchema,
  onboardingPlanCreateSchema,
  onboardingListQuerySchema,
  onboardingPlanUpdateSchema,
  onboardingTaskCreateSchema,
  onboardingTaskUpdateSchema,
  projectNoteCreateSchema,
  requestedDocumentCreateSchema,
  requestedDocumentUpdateSchema,
  trainingSessionCreateSchema,
  trainingSessionUpdateSchema,
  workflowCursorSchema,
} from '@nexora/contracts'
import { Router } from 'express'
import { z } from 'zod'

import { AppError } from '../lib/errors.js'
import { createCallerClient, throwDatabaseError } from '../lib/supabase.js'
import { requireBeauRoi, requireOrganizationAccess } from '../middleware/auth.js'

const planParameterSchema = z.object({ planId: z.uuid() }).strict()
const projectParameterSchema = z.object({ projectId: z.uuid() }).strict()
const taskParameterSchema = z.object({ taskId: z.uuid() }).strict()
const trainingParameterSchema = z.object({ trainingId: z.uuid() }).strict()
const documentParameterSchema = z.object({ documentId: z.uuid() }).strict()
const milestoneParameterSchema = z.object({ milestoneId: z.uuid() }).strict()
const organizationParameterSchema = z.object({ organizationId: z.uuid() }).strict()
const identifierRowSchema = z.object({ id: z.uuid() })
const onboardingChildRowsSchema = z.array(z.object({ onboarding_plan_id: z.uuid() }).loose())
const implementationChildRowsSchema = z.array(
  z.object({ implementation_project_id: z.uuid() }).loose(),
)

export const CUSTOMER_IMPLEMENTATION_PROJECT_SELECT =
  'id, organization_id, product_id, name, status, phase, owner_user_id, owner_name, starts_on, target_completion_on, actual_completion_on, customer_update, organization_name, product_name, progress_percent, blocked_count, overdue_count, milestone_count'
export const CUSTOMER_PROJECT_NOTE_SELECT =
  'id, organization_id, implementation_project_id, author_user_id, body, visibility, created_at'
const ONBOARDING_TASK_SELECT =
  'id, organization_id, onboarding_plan_id, title, description, status:workflow_status, assigned_user_id, owner_kind, due_at, sort_order, completed_at, created_at, updated_at'
const TRAINING_SESSION_SELECT =
  'id, organization_id, onboarding_plan_id, title, description, scheduled_at, duration_minutes, delivery_method, meeting_location, meeting_url, status:workflow_status, facilitator_user_id, completed_at, created_at, updated_at'
const REQUESTED_DOCUMENT_SELECT =
  'id, organization_id, onboarding_plan_id, name, description, requested_from_user_id, due_at, submitted_at, status:workflow_status, created_at, updated_at'
const MILESTONE_SELECT =
  'id, organization_id, implementation_project_id, title, description, status:workflow_status, due_on, completed_at, sort_order, created_at, updated_at'

function camelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}

function toApiValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toApiValue)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [camelKey(key), toApiValue(item)]),
  )
}

function encodeCursor(input: z.infer<typeof workflowCursorSchema>): string {
  return Buffer.from(JSON.stringify(input)).toString('base64url')
}

function decodeCursor(value: string | undefined) {
  if (!value) return undefined
  try {
    return workflowCursorSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString()) as unknown,
    )
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.')
  }
}

function escapeFilterValue(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function onboardingPlanPayload(input: z.infer<typeof onboardingPlanCreateSchema>) {
  return {
    actual_go_live_on: input.actualGoLiveOn,
    customer_update: input.customerUpdate,
    name: input.name,
    organization_id: input.organizationId,
    owner_user_id: input.ownerUserId,
    product_id: input.productId,
    readiness_confirmed_at: input.readinessConfirmedAt,
    starts_on: input.startsOn,
    workflow_status: input.status,
    target_go_live_on: input.targetGoLiveOn,
  }
}

function implementationProjectPayload(input: z.infer<typeof implementationProjectCreateSchema>) {
  return {
    actual_completion_on: input.actualCompletionOn,
    customer_update: input.customerUpdate,
    name: input.name,
    organization_id: input.organizationId,
    owner_user_id: input.ownerUserId,
    phase: input.phase,
    product_id: input.productId,
    starts_on: input.startsOn,
    workflow_status: input.status,
    target_completion_on: input.targetCompletionOn,
  }
}

function taskPayload(input: z.infer<typeof onboardingTaskCreateSchema>) {
  return {
    assigned_user_id: input.assignedUserId,
    completed_at: input.completedAt,
    description: input.description,
    due_at: input.dueAt,
    owner_kind: input.ownerKind,
    sort_order: input.sortOrder,
    workflow_status: input.status,
    title: input.title,
  }
}

function trainingPayload(input: z.infer<typeof trainingSessionCreateSchema>) {
  return {
    completed_at: input.completedAt,
    delivery_method: input.deliveryMethod,
    description: input.description,
    duration_minutes: input.durationMinutes,
    facilitator_user_id: input.facilitatorUserId,
    meeting_location: input.meetingLocation,
    meeting_url: input.meetingUrl === '' ? null : input.meetingUrl,
    scheduled_at: input.scheduledAt,
    workflow_status: input.status,
    title: input.title,
  }
}

function documentPayload(input: z.infer<typeof requestedDocumentCreateSchema>) {
  return {
    description: input.description,
    due_at: input.dueAt,
    name: input.name,
    requested_from_user_id: input.requestedFromUserId,
    workflow_status: input.status,
    submitted_at: input.submittedAt,
  }
}

function milestonePayload(input: z.infer<typeof milestoneCreateSchema>) {
  return {
    completed_at: input.completedAt,
    description: input.description,
    due_on: input.dueOn,
    sort_order: input.sortOrder,
    workflow_status: input.status,
    title: input.title,
  }
}

function onboardingPlanUpdatePayload(input: z.infer<typeof onboardingPlanUpdateSchema>) {
  return {
    ...(input.actualGoLiveOn !== undefined && { actual_go_live_on: input.actualGoLiveOn }),
    ...(input.customerUpdate !== undefined && { customer_update: input.customerUpdate }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.ownerUserId !== undefined && { owner_user_id: input.ownerUserId }),
    ...(input.readinessConfirmedAt !== undefined && {
      readiness_confirmed_at: input.readinessConfirmedAt,
    }),
    ...(input.startsOn !== undefined && { starts_on: input.startsOn }),
    ...(input.status !== undefined && { workflow_status: input.status }),
    ...(input.targetGoLiveOn !== undefined && { target_go_live_on: input.targetGoLiveOn }),
  }
}

function taskUpdatePayload(input: z.infer<typeof onboardingTaskUpdateSchema>) {
  return {
    ...(input.assignedUserId !== undefined && { assigned_user_id: input.assignedUserId }),
    ...(input.completedAt !== undefined && { completed_at: input.completedAt }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.dueAt !== undefined && { due_at: input.dueAt }),
    ...(input.ownerKind !== undefined && { owner_kind: input.ownerKind }),
    ...(input.sortOrder !== undefined && { sort_order: input.sortOrder }),
    ...(input.status !== undefined && { workflow_status: input.status }),
    ...(input.title !== undefined && { title: input.title }),
  }
}

function trainingUpdatePayload(input: z.infer<typeof trainingSessionUpdateSchema>) {
  return {
    ...(input.completedAt !== undefined && { completed_at: input.completedAt }),
    ...(input.deliveryMethod !== undefined && { delivery_method: input.deliveryMethod }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.durationMinutes !== undefined && { duration_minutes: input.durationMinutes }),
    ...(input.facilitatorUserId !== undefined && {
      facilitator_user_id: input.facilitatorUserId,
    }),
    ...(input.meetingLocation !== undefined && { meeting_location: input.meetingLocation }),
    ...(input.meetingUrl !== undefined && {
      meeting_url: input.meetingUrl === '' ? null : input.meetingUrl,
    }),
    ...(input.scheduledAt !== undefined && { scheduled_at: input.scheduledAt }),
    ...(input.status !== undefined && { workflow_status: input.status }),
    ...(input.title !== undefined && { title: input.title }),
  }
}

function documentUpdatePayload(input: z.infer<typeof requestedDocumentUpdateSchema>) {
  return {
    ...(input.description !== undefined && { description: input.description }),
    ...(input.dueAt !== undefined && { due_at: input.dueAt }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.requestedFromUserId !== undefined && {
      requested_from_user_id: input.requestedFromUserId,
    }),
    ...(input.status !== undefined && { workflow_status: input.status }),
    ...(input.submittedAt !== undefined && { submitted_at: input.submittedAt }),
  }
}

function implementationProjectUpdatePayload(
  input: z.infer<typeof implementationProjectUpdateSchema>,
) {
  return {
    ...(input.actualCompletionOn !== undefined && {
      actual_completion_on: input.actualCompletionOn,
    }),
    ...(input.customerUpdate !== undefined && { customer_update: input.customerUpdate }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.ownerUserId !== undefined && { owner_user_id: input.ownerUserId }),
    ...(input.phase !== undefined && { phase: input.phase }),
    ...(input.startsOn !== undefined && { starts_on: input.startsOn }),
    ...(input.status !== undefined && { workflow_status: input.status }),
    ...(input.targetCompletionOn !== undefined && {
      target_completion_on: input.targetCompletionOn,
    }),
  }
}

function milestoneUpdatePayload(input: z.infer<typeof milestoneUpdateSchema>) {
  return {
    ...(input.completedAt !== undefined && { completed_at: input.completedAt }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.dueOn !== undefined && { due_on: input.dueOn }),
    ...(input.sortOrder !== undefined && { sort_order: input.sortOrder }),
    ...(input.status !== undefined && { workflow_status: input.status }),
    ...(input.title !== undefined && { title: input.title }),
  }
}

export const workflowsRouter = Router()

workflowsRouter.get('/workflow-options', requireBeauRoi, async (request, response, next) => {
  try {
    const supabase = createCallerClient(request.accessToken)
    const [organizations, products, subscriptions, memberships] = await Promise.all([
      supabase
        .from('organizations')
        .select('id, name')
        .eq('organization_type', 'CUSTOMER')
        .eq('is_active', true)
        .order('name'),
      supabase.from('products').select('id, name, code').eq('status', 'ACTIVE').order('name'),
      supabase
        .from('customer_subscriptions')
        .select('organization_id, product_id')
        .eq('status', 'ACTIVE'),
      supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('status', 'ACTIVE')
        .in('role', ['BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE']),
    ])
    for (const result of [organizations, products, subscriptions, memberships])
      throwDatabaseError(result.error, 'Unable to load workflow options.')
    const memberRows = z.array(z.object({ user_id: z.uuid() })).parse(memberships.data ?? [])
    const userIds = [...new Set(memberRows.map((row) => row.user_id))]
    const staff =
      userIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from('profiles')
            .select('id, full_name, designation')
            .in('id', userIds)
            .order('full_name')
    throwDatabaseError(staff.error, 'Unable to load workflow staff.')
    response.json({
      data: toApiValue({
        organizations: organizations.data ?? [],
        products: products.data ?? [],
        staff: staff.data ?? [],
        subscriptions: subscriptions.data ?? [],
      }),
    })
  } catch (error) {
    next(error)
  }
})

workflowsRouter.get('/onboarding', requireBeauRoi, async (request, response, next) => {
  try {
    const input = onboardingListQuerySchema.parse(request.query)
    const cursor = decodeCursor(input.cursor)
    if (cursor && cursor.sort !== input.sort)
      throw new AppError(400, 'INVALID_CURSOR', 'The cursor does not match the selected sort.')
    const ascending = input.sort === 'name-asc'
    const supabase = createCallerClient(request.accessToken)
    let query = supabase.from('onboarding_portfolio').select('*')
    if (input.search) query = query.ilike('organization_name', `%${input.search}%`)
    if (input.organizationId) query = query.eq('organization_id', input.organizationId)
    if (input.productId) query = query.eq('product_id', input.productId)
    if (input.ownerUserId) query = query.eq('owner_user_id', input.ownerUserId)
    if (input.status) query = query.eq('status', input.status)
    if (cursor) {
      const operation = ascending ? 'gt' : 'lt'
      const value = escapeFilterValue(cursor.value)
      query = query.or(
        `organization_name.${operation}.${value},and(organization_name.eq.${value},id.${operation}.${cursor.id})`,
      )
    }
    const result = await query
      .order('organization_name', { ascending })
      .order('id', { ascending })
      .limit(input.limit + 1)
    throwDatabaseError(result.error, 'Unable to load onboarding plans.')
    const rows = z
      .array(z.object({ id: z.uuid(), organization_name: z.string() }).loose())
      .parse(result.data ?? [])
    const hasMore = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    const last = page.at(-1)
    response.json({
      data: toApiValue(page),
      meta: {
        nextCursor:
          hasMore && last
            ? encodeCursor({ id: last.id, sort: input.sort, value: last.organization_name })
            : null,
      },
    })
  } catch (error) {
    next(error)
  }
})

workflowsRouter.post('/onboarding', requireBeauRoi, async (request, response, next) => {
  try {
    const input = onboardingPlanCreateSchema.parse(request.body)
    const result = await createCallerClient(request.accessToken)
      .from('onboarding_plans')
      .insert(onboardingPlanPayload(input))
      .select('id')
      .single()
    throwDatabaseError(result.error, 'Unable to create the onboarding plan.')
    response.status(201).json({ data: identifierRowSchema.parse(result.data) })
  } catch (error) {
    next(error)
  }
})

workflowsRouter.get('/onboarding/:planId', requireBeauRoi, async (request, response, next) => {
  try {
    const { planId } = planParameterSchema.parse(request.params)
    const supabase = createCallerClient(request.accessToken)
    const [plan, tasks, training, documents] = await Promise.all([
      supabase.from('onboarding_portfolio').select('*').eq('id', planId).single(),
      supabase
        .from('onboarding_tasks')
        .select(ONBOARDING_TASK_SELECT)
        .eq('onboarding_plan_id', planId)
        .order('sort_order')
        .order('id'),
      supabase
        .from('training_sessions')
        .select(TRAINING_SESSION_SELECT)
        .eq('onboarding_plan_id', planId)
        .order('scheduled_at'),
      supabase
        .from('requested_documents')
        .select(REQUESTED_DOCUMENT_SELECT)
        .eq('onboarding_plan_id', planId)
        .order('created_at'),
    ])
    throwDatabaseError(plan.error, 'Onboarding plan not found.')
    for (const result of [tasks, training, documents])
      throwDatabaseError(result.error, 'Unable to load the onboarding workspace.')
    response.json({
      data: toApiValue({
        ...z.object({ id: z.uuid() }).loose().parse(plan.data),
        documents: documents.data ?? [],
        tasks: tasks.data ?? [],
        trainingSessions: training.data ?? [],
        uploadAvailable: false,
      }),
    })
  } catch (error) {
    next(error)
  }
})

workflowsRouter.patch('/onboarding/:planId', requireBeauRoi, async (request, response, next) => {
  try {
    const { planId } = planParameterSchema.parse(request.params)
    const input = onboardingPlanUpdateSchema.parse(request.body)
    const payload = onboardingPlanUpdatePayload(input)
    const result = await createCallerClient(request.accessToken)
      .from('onboarding_plans')
      .update(payload)
      .eq('id', planId)
      .select('id')
      .single()
    throwDatabaseError(result.error, 'Unable to update the onboarding plan.')
    response.json({ data: identifierRowSchema.parse(result.data) })
  } catch (error) {
    next(error)
  }
})

workflowsRouter.post(
  '/onboarding/:planId/tasks',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { planId } = planParameterSchema.parse(request.params)
      const input = onboardingTaskCreateSchema.parse(request.body)
      const supabase = createCallerClient(request.accessToken)
      const parent = await supabase
        .from('onboarding_plans')
        .select('organization_id')
        .eq('id', planId)
        .single()
      throwDatabaseError(parent.error, 'Onboarding plan not found.')
      const organizationId = z
        .object({ organization_id: z.uuid() })
        .parse(parent.data).organization_id
      const result = await supabase
        .from('onboarding_tasks')
        .insert({
          ...taskPayload(input),
          onboarding_plan_id: planId,
          organization_id: organizationId,
        })
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to create the onboarding task.')
      response.status(201).json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.patch(
  '/onboarding-tasks/:taskId',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { taskId } = taskParameterSchema.parse(request.params)
      const input = onboardingTaskUpdateSchema.parse(request.body)
      const payload = taskUpdatePayload(input)
      const result = await createCallerClient(request.accessToken)
        .from('onboarding_tasks')
        .update(payload)
        .eq('id', taskId)
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to update the onboarding task.')
      response.json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.post(
  '/onboarding/:planId/training-sessions',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { planId } = planParameterSchema.parse(request.params)
      const input = trainingSessionCreateSchema.parse(request.body)
      const supabase = createCallerClient(request.accessToken)
      const parent = await supabase
        .from('onboarding_plans')
        .select('organization_id')
        .eq('id', planId)
        .single()
      throwDatabaseError(parent.error, 'Onboarding plan not found.')
      const organizationId = z
        .object({ organization_id: z.uuid() })
        .parse(parent.data).organization_id
      const result = await supabase
        .from('training_sessions')
        .insert({
          ...trainingPayload(input),
          onboarding_plan_id: planId,
          organization_id: organizationId,
        })
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to create the training session.')
      response.status(201).json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.patch(
  '/training-sessions/:trainingId',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { trainingId } = trainingParameterSchema.parse(request.params)
      const input = trainingSessionUpdateSchema.parse(request.body)
      const payload = trainingUpdatePayload(input)
      const result = await createCallerClient(request.accessToken)
        .from('training_sessions')
        .update(payload)
        .eq('id', trainingId)
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to update the training session.')
      response.json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.post(
  '/onboarding/:planId/requested-documents',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { planId } = planParameterSchema.parse(request.params)
      const input = requestedDocumentCreateSchema.parse(request.body)
      const supabase = createCallerClient(request.accessToken)
      const parent = await supabase
        .from('onboarding_plans')
        .select('organization_id')
        .eq('id', planId)
        .single()
      throwDatabaseError(parent.error, 'Onboarding plan not found.')
      const organizationId = z
        .object({ organization_id: z.uuid() })
        .parse(parent.data).organization_id
      const result = await supabase
        .from('requested_documents')
        .insert({
          ...documentPayload(input),
          onboarding_plan_id: planId,
          organization_id: organizationId,
        })
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to create the document request.')
      response.status(201).json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.patch(
  '/requested-documents/:documentId',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { documentId } = documentParameterSchema.parse(request.params)
      const input = requestedDocumentUpdateSchema.parse(request.body)
      const payload = documentUpdatePayload(input)
      const result = await createCallerClient(request.accessToken)
        .from('requested_documents')
        .update(payload)
        .eq('id', documentId)
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to update the document request.')
      response.json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.get(
  '/organizations/:organizationId/onboarding',
  requireOrganizationAccess,
  async (request, response, next) => {
    try {
      const { organizationId } = organizationParameterSchema.parse(request.params)
      const supabase = createCallerClient(request.accessToken)
      const plans = await supabase
        .from('onboarding_portfolio')
        .select(
          'id, organization_id, product_id, name, status, starts_on, target_go_live_on, actual_go_live_on, customer_update, owner_user_id, owner_name, organization_name, product_name, progress_percent, blocked_count, overdue_count, task_count',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      throwDatabaseError(plans.error, 'Unable to load onboarding status.')
      const planRows = z.array(z.object({ id: z.uuid() }).loose()).parse(plans.data ?? [])
      if (planRows.length === 0) return response.json({ data: [] })
      const planIds = planRows.map((row) => row.id)
      const [tasks, training, documents] = await Promise.all([
        supabase
          .from('onboarding_tasks')
          .select(ONBOARDING_TASK_SELECT)
          .in('onboarding_plan_id', planIds)
          .order('sort_order'),
        supabase
          .from('training_sessions')
          .select(TRAINING_SESSION_SELECT)
          .in('onboarding_plan_id', planIds)
          .order('scheduled_at'),
        supabase
          .from('requested_documents')
          .select(REQUESTED_DOCUMENT_SELECT)
          .in('onboarding_plan_id', planIds)
          .order('created_at'),
      ])
      for (const result of [tasks, training, documents])
        throwDatabaseError(result.error, 'Unable to load onboarding status.')
      const taskRows = onboardingChildRowsSchema.parse(tasks.data ?? [])
      const trainingRows = onboardingChildRowsSchema.parse(training.data ?? [])
      const documentRows = onboardingChildRowsSchema.parse(documents.data ?? [])
      response.json({
        data: toApiValue(
          planRows.map((plan) => ({
            ...plan,
            documents: documentRows.filter((row) => row.onboarding_plan_id === plan.id),
            tasks: taskRows.filter((row) => row.onboarding_plan_id === plan.id),
            trainingSessions: trainingRows.filter((row) => row.onboarding_plan_id === plan.id),
            uploadAvailable: false,
          })),
        ),
      })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.get('/implementations', requireBeauRoi, async (request, response, next) => {
  try {
    const input = implementationListQuerySchema.parse(request.query)
    const cursor = decodeCursor(input.cursor)
    if (cursor && cursor.sort !== input.sort)
      throw new AppError(400, 'INVALID_CURSOR', 'The cursor does not match the selected sort.')
    const ascending = input.sort === 'name-asc'
    const supabase = createCallerClient(request.accessToken)
    let query = supabase.from('implementation_portfolio').select('*')
    if (input.search) query = query.ilike('organization_name', `%${input.search}%`)
    if (input.organizationId) query = query.eq('organization_id', input.organizationId)
    if (input.productId) query = query.eq('product_id', input.productId)
    if (input.ownerUserId) query = query.eq('owner_user_id', input.ownerUserId)
    if (input.phase) query = query.eq('phase', input.phase)
    if (input.status) query = query.eq('status', input.status)
    if (cursor) {
      const operation = ascending ? 'gt' : 'lt'
      const value = escapeFilterValue(cursor.value)
      query = query.or(
        `organization_name.${operation}.${value},and(organization_name.eq.${value},id.${operation}.${cursor.id})`,
      )
    }
    const result = await query
      .order('organization_name', { ascending })
      .order('id', { ascending })
      .limit(input.limit + 1)
    throwDatabaseError(result.error, 'Unable to load implementation projects.')
    const rows = z
      .array(z.object({ id: z.uuid(), organization_name: z.string() }).loose())
      .parse(result.data ?? [])
    const hasMore = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    const last = page.at(-1)
    response.json({
      data: toApiValue(page),
      meta: {
        nextCursor:
          hasMore && last
            ? encodeCursor({ id: last.id, sort: input.sort, value: last.organization_name })
            : null,
      },
    })
  } catch (error) {
    next(error)
  }
})

workflowsRouter.post('/implementations', requireBeauRoi, async (request, response, next) => {
  try {
    const input = implementationProjectCreateSchema.parse(request.body)
    const supabase = createCallerClient(request.accessToken)
    const result = await supabase
      .from('implementation_projects')
      .insert(implementationProjectPayload(input))
      .select('id')
      .single()
    throwDatabaseError(result.error, 'Unable to create the implementation project.')
    const project = identifierRowSchema.parse(result.data)
    if (input.requirementSummary) {
      const requirement = await supabase.rpc('set_implementation_requirement', {
        target_project_id: project.id,
        target_requirement_summary: input.requirementSummary,
      })
      throwDatabaseError(requirement.error, 'Unable to save the implementation requirement.')
    }
    response.status(201).json({ data: project })
  } catch (error) {
    next(error)
  }
})

workflowsRouter.get(
  '/implementations/:projectId',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { projectId } = projectParameterSchema.parse(request.params)
      const supabase = createCallerClient(request.accessToken)
      const [project, milestones, notes, requirement] = await Promise.all([
        supabase.from('implementation_portfolio').select('*').eq('id', projectId).single(),
        supabase
          .from('milestones')
          .select(MILESTONE_SELECT)
          .eq('implementation_project_id', projectId)
          .order('sort_order')
          .order('id'),
        supabase
          .from('project_notes')
          .select('*')
          .eq('implementation_project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_implementation_requirement', { target_project_id: projectId }),
      ])
      throwDatabaseError(project.error, 'Implementation project not found.')
      for (const result of [milestones, notes, requirement])
        throwDatabaseError(result.error, 'Unable to load the implementation workspace.')
      response.json({
        data: toApiValue({
          ...z.object({ id: z.uuid() }).loose().parse(project.data),
          milestones: milestones.data ?? [],
          notes: notes.data ?? [],
          requirement_summary: z.string().nullable().parse(requirement.data),
        }),
      })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.patch(
  '/implementations/:projectId',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { projectId } = projectParameterSchema.parse(request.params)
      const input = implementationProjectUpdateSchema.parse(request.body)
      const payload = implementationProjectUpdatePayload(input)
      const supabase = createCallerClient(request.accessToken)
      if (Object.keys(payload).length > 0) {
        const result = await supabase
          .from('implementation_projects')
          .update(payload)
          .eq('id', projectId)
          .select('id')
          .single()
        throwDatabaseError(result.error, 'Unable to update the implementation project.')
      }
      if (input.requirementSummary !== undefined) {
        const requirement = await supabase.rpc('set_implementation_requirement', {
          target_project_id: projectId,
          target_requirement_summary: input.requirementSummary,
        })
        throwDatabaseError(requirement.error, 'Unable to update the implementation requirement.')
      }
      response.json({ data: { id: projectId } })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.post(
  '/implementations/:projectId/milestones',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { projectId } = projectParameterSchema.parse(request.params)
      const input = milestoneCreateSchema.parse(request.body)
      const supabase = createCallerClient(request.accessToken)
      const parent = await supabase
        .from('implementation_projects')
        .select('organization_id')
        .eq('id', projectId)
        .single()
      throwDatabaseError(parent.error, 'Implementation project not found.')
      const organizationId = z
        .object({ organization_id: z.uuid() })
        .parse(parent.data).organization_id
      const result = await supabase
        .from('milestones')
        .insert({
          ...milestonePayload(input),
          implementation_project_id: projectId,
          organization_id: organizationId,
        })
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to create the milestone.')
      response.status(201).json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.patch(
  '/milestones/:milestoneId',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { milestoneId } = milestoneParameterSchema.parse(request.params)
      const input = milestoneUpdateSchema.parse(request.body)
      const payload = milestoneUpdatePayload(input)
      const result = await createCallerClient(request.accessToken)
        .from('milestones')
        .update(payload)
        .eq('id', milestoneId)
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to update the milestone.')
      response.json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.post(
  '/implementations/:projectId/notes',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { projectId } = projectParameterSchema.parse(request.params)
      const input = projectNoteCreateSchema.parse(request.body)
      const supabase = createCallerClient(request.accessToken)
      const parent = await supabase
        .from('implementation_projects')
        .select('organization_id')
        .eq('id', projectId)
        .single()
      throwDatabaseError(parent.error, 'Implementation project not found.')
      const organizationId = z
        .object({ organization_id: z.uuid() })
        .parse(parent.data).organization_id
      const result = await supabase
        .from('project_notes')
        .insert({
          body: input.body,
          implementation_project_id: projectId,
          organization_id: organizationId,
          visibility: input.visibility,
        })
        .select('id')
        .single()
      throwDatabaseError(result.error, 'Unable to add the project note.')
      response.status(201).json({ data: identifierRowSchema.parse(result.data) })
    } catch (error) {
      next(error)
    }
  },
)

workflowsRouter.get(
  '/organizations/:organizationId/implementation',
  requireOrganizationAccess,
  async (request, response, next) => {
    try {
      const { organizationId } = organizationParameterSchema.parse(request.params)
      const supabase = createCallerClient(request.accessToken)
      const projects = await supabase
        .from('implementation_portfolio')
        .select(CUSTOMER_IMPLEMENTATION_PROJECT_SELECT)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      throwDatabaseError(projects.error, 'Unable to load implementation status.')
      const projectRows = z.array(z.object({ id: z.uuid() }).loose()).parse(projects.data ?? [])
      if (projectRows.length === 0) return response.json({ data: [] })
      const projectIds = projectRows.map((row) => row.id)
      const [milestones, notes] = await Promise.all([
        supabase
          .from('milestones')
          .select(MILESTONE_SELECT)
          .in('implementation_project_id', projectIds)
          .order('sort_order'),
        supabase
          .from('project_notes')
          .select(CUSTOMER_PROJECT_NOTE_SELECT)
          .in('implementation_project_id', projectIds)
          .eq('visibility', 'SHARED')
          .order('created_at', { ascending: false }),
      ])
      for (const result of [milestones, notes])
        throwDatabaseError(result.error, 'Unable to load implementation status.')
      const milestoneRows = implementationChildRowsSchema.parse(milestones.data ?? [])
      const noteRows = implementationChildRowsSchema.parse(notes.data ?? [])
      response.json({
        data: toApiValue(
          projectRows.map((project) => ({
            ...project,
            milestones: milestoneRows.filter((row) => row.implementation_project_id === project.id),
            notes: noteRows.filter((row) => row.implementation_project_id === project.id),
          })),
        ),
      })
    } catch (error) {
      next(error)
    }
  },
)
