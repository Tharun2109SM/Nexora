import {
  BEAUROI_ROLES,
  CUSTOMER_ROLES,
  addFeedbackMessageSchema,
  createFeedbackSchema,
  customerFeedbackDetailSchema,
  customerFeedbackListQuerySchema,
  feedbackFilterMetadataResponseSchema,
  feedbackIdentifierResponseSchema,
  feedbackListResponseSchema,
  feedbackParameterSchema,
  feedbackProductsResponseSchema,
  feedbackStatusSchema,
  staffFeedbackDetailSchema,
  staffFeedbackQueueQuerySchema,
  updateFeedbackStatusSchema,
  updateFeedbackTriageSchema,
  type AppRole,
} from '@nexora/contracts'
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'

import { isR2Configured } from '../lib/env.js'
import { AppError } from '../lib/errors.js'
import { createCallerClient } from '../lib/supabase.js'
import { requireBeauRoi } from '../middleware/auth.js'

type CallerClient = ReturnType<typeof createCallerClient>
interface FeedbackRouterDependencies {
  createClient?: (accessToken: string | undefined) => CallerClient
}

const relationSchema = z.object({ id: z.uuid(), name: z.string() }).strict()
const personRowSchema = z
  .object({ designation: z.string().nullable(), full_name: z.string(), id: z.uuid() })
  .strict()
const feedbackRowSchema = z
  .object({
    category: z.enum(['GENERAL', 'BUG', 'FEATURE_REQUEST']),
    created_at: z.iso.datetime({ offset: true }),
    description: z.string(),
    id: z.uuid(),
    is_public: z.boolean(),
    last_activity_at: z.iso.datetime({ offset: true }),
    organization: relationSchema.nullable(),
    organization_id: z.uuid(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).nullable(),
    product: relationSchema,
    product_id: z.uuid(),
    status: feedbackStatusSchema,
    submitted_by: z.uuid(),
    title: z.string(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict()
const messageRowSchema = z
  .object({
    author_user_id: z.uuid(),
    body: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    id: z.uuid(),
    is_internal: z.boolean(),
  })
  .strict()
const eventRowSchema = z
  .object({
    actor_user_id: z.uuid().nullable(),
    created_at: z.iso.datetime({ offset: true }),
    customer_visible: z.boolean(),
    event_type: z.string(),
    id: z.uuid(),
  })
  .strict()
const bugRowSchema = z
  .object({
    environment: z.string().nullable(),
    reproduction_steps: z.string().nullable(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  })
  .strict()
const featureRowSchema = z
  .object({ desired_outcome: z.string().nullable(), problem_statement: z.string() })
  .strict()
const voteRowSchema = z
  .object({ has_voted: z.boolean(), vote_count: z.coerce.number().int() })
  .strict()
const CUSTOMER_ROLE_SET = new Set<AppRole>(CUSTOMER_ROLES)
const FEEDBACK_SELECT =
  'id,organization_id,product_id,submitted_by,title,description,category,status,is_public,priority,created_at,updated_at,last_activity_at,organization:organizations!feedback_organization_id_fkey(id,name),product:products!feedback_product_id_fkey(id,name)'

function identityFor(request: Request) {
  if (!request.identity) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  return request.identity
}
function requireCustomer(role: AppRole) {
  if (!CUSTOMER_ROLE_SET.has(role))
    throw new AppError(403, 'CUSTOMER_ACCESS_REQUIRED', 'Customer access is required.')
}
function throwFeedbackError(
  error: { code?: string; message: string } | null,
  message: string,
): asserts error is null {
  if (!error) return
  if (error.code === '42501')
    throw new AppError(403, 'FEEDBACK_ACCESS_DENIED', 'Feedback access is unavailable.')
  if (error.code === 'P0001' || error.code === 'PGRST116')
    throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Feedback not found.')
  if (error.code === '23505') throw new AppError(409, 'FEEDBACK_CONFLICT', message)
  if (error.code === '23514') throw new AppError(409, 'FEEDBACK_MUTATION_REJECTED', message)
  throw new AppError(400, 'FEEDBACK_OPERATION_FAILED', message)
}
function person(row: z.infer<typeof personRowSchema> | undefined) {
  return row ? { designation: row.designation, fullName: row.full_name, id: row.id } : null
}
export function projectFeedbackMessage(
  row: z.infer<typeof messageRowSchema>,
  author: ReturnType<typeof person>,
  staff: boolean,
) {
  const shared = {
    author,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
  }
  return staff ? { ...shared, isInternal: row.is_internal } : shared
}
export function projectFeedbackEvent(
  row: z.infer<typeof eventRowSchema>,
  actor: ReturnType<typeof person>,
  staff: boolean,
) {
  const shared = {
    actor,
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
  }
  return staff ? { ...shared, customerVisible: row.customer_visible } : shared
}
async function profiles(client: CallerClient, ids: readonly (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))]
  if (!unique.length) return new Map<string, z.infer<typeof personRowSchema>>()
  const result = await client.from('profiles').select('id,full_name,designation').in('id', unique)
  throwFeedbackError(result.error, 'Feedback people are unavailable.')
  const rows = z.array(personRowSchema).parse(result.data)
  return new Map(rows.map((row) => [row.id, row]))
}
async function votes(client: CallerClient, feedbackId: string) {
  const result = await client.rpc('get_feature_vote_summary', { target_feedback_id: feedbackId })
  throwFeedbackError(result.error, 'Feature votes are unavailable.')
  const row = z.array(voteRowSchema).parse(result.data)[0]
  return { count: row?.vote_count ?? 0, hasVoted: row?.has_voted ?? false }
}
async function severity(client: CallerClient, row: z.infer<typeof feedbackRowSchema>) {
  if (row.category !== 'BUG') return null
  const result = await client
    .from('bug_reports')
    .select('severity')
    .eq('feedback_id', row.id)
    .single()
  throwFeedbackError(result.error, 'Bug details are unavailable.')
  return z.object({ severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) }).parse(result.data)
    .severity
}
async function listItem(
  client: CallerClient,
  row: z.infer<typeof feedbackRowSchema>,
  people: Map<string, z.infer<typeof personRowSchema>>,
) {
  const requester =
    person(people.get(row.submitted_by)) ??
    (row.organization
      ? { designation: null, fullName: row.organization.name, id: row.organization.id }
      : null)
  return {
    createdAt: row.created_at,
    id: row.id,
    isPublic: row.is_public,
    lastActivityAt: row.last_activity_at,
    organization: row.organization,
    priority: row.priority,
    product: row.product,
    requester,
    severity: await severity(client, row),
    status: row.status,
    title: row.title,
    type: row.category,
    votes:
      row.category === 'FEATURE_REQUEST'
        ? await votes(client, row.id)
        : { count: 0, hasVoted: false },
  }
}
function cursor(row: z.infer<typeof feedbackRowSchema>, sort: string) {
  return Buffer.from(
    JSON.stringify({
      id: row.id,
      sort,
      value: sort === 'activity-desc' ? row.last_activity_at : row.created_at,
    }),
  ).toString('base64url')
}
function decodeCursor(value: string | undefined) {
  if (!value) return undefined
  try {
    return z
      .object({ id: z.uuid(), sort: z.string(), value: z.iso.datetime({ offset: true }) })
      .parse(JSON.parse(Buffer.from(value, 'base64url').toString()) as unknown)
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.')
  }
}
async function capabilities(
  client: CallerClient,
  identity: ReturnType<typeof identityFor>,
  item: z.infer<typeof feedbackRowSchema>,
) {
  let allowed = identity.role === 'BEAUROI_ADMIN'
  if (identity.role === 'BEAUROI_EMPLOYEE') {
    let query = client
      .from('customer_assignments')
      .select('id')
      .eq('employee_user_id', identity.userId)
      .eq('organization_id', item.organization_id)
      .in('assignment_type', ['CSM', 'ACCOUNT_OWNER'])
      .eq('is_active', true)
      .is('ended_at', null)
    query = query.or(`product_id.is.null,product_id.eq.${item.product_id}`)
    const result = await query.limit(1)
    throwFeedbackError(result.error, 'Feedback capabilities are unavailable.')
    allowed = z.array(z.object({ id: z.uuid() })).parse(result.data).length > 0
  }
  return {
    canAddInternalNote: allowed,
    canChangeStatus: allowed,
    canPublish: allowed && item.category === 'FEATURE_REQUEST',
    canRespond: allowed,
    canTriage: allowed,
  }
}
async function detail(
  client: CallerClient,
  feedbackId: string,
  staff: boolean,
  identity: ReturnType<typeof identityFor>,
) {
  const itemResult = await client
    .from('feedback')
    .select(FEEDBACK_SELECT)
    .eq('id', feedbackId)
    .maybeSingle()
  throwFeedbackError(itemResult.error, 'Feedback is unavailable.')
  if (!itemResult.data) throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Feedback not found.')
  const item = feedbackRowSchema.parse(itemResult.data)
  const [messagesResult, eventsResult, bugResult, featureResult] = await Promise.all([
    client
      .from('feedback_messages')
      .select('id,author_user_id,body,is_internal,created_at')
      .eq('feedback_id', feedbackId)
      .order('created_at')
      .order('id'),
    client
      .from('feedback_events')
      .select('id,actor_user_id,event_type,customer_visible,created_at')
      .eq('feedback_id', feedbackId)
      .order('created_at')
      .order('id'),
    item.category === 'BUG'
      ? client
          .from('bug_reports')
          .select('severity,reproduction_steps,environment')
          .eq('feedback_id', feedbackId)
          .single()
      : Promise.resolve({ data: null, error: null }),
    item.category === 'FEATURE_REQUEST'
      ? client
          .from('feature_requests')
          .select('problem_statement,desired_outcome')
          .eq('feedback_id', feedbackId)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])
  throwFeedbackError(messagesResult.error, 'Feedback messages are unavailable.')
  throwFeedbackError(eventsResult.error, 'Feedback history is unavailable.')
  throwFeedbackError(bugResult.error, 'Bug details are unavailable.')
  throwFeedbackError(featureResult.error, 'Feature details are unavailable.')
  const messages = z.array(messageRowSchema).parse(messagesResult.data)
  const events = z.array(eventRowSchema).parse(eventsResult.data)
  const people = await profiles(client, [
    item.submitted_by,
    ...messages.map((m) => m.author_user_id),
    ...events.map((e) => e.actor_user_id),
  ])
  const base = await listItem(client, item, people)
  const bug = bugResult.data ? bugRowSchema.parse(bugResult.data) : null
  const feature = featureResult.data ? featureRowSchema.parse(featureResult.data) : null
  return {
    ...base,
    bug: bug ? { environment: bug.environment, reproductionSteps: bug.reproduction_steps } : null,
    description: item.description,
    events: events
      .filter((e) => staff || e.customer_visible)
      .map((e) =>
        projectFeedbackEvent(
          e,
          person(e.actor_user_id ? people.get(e.actor_user_id) : undefined),
          staff,
        ),
      ),
    feature: feature
      ? { desiredOutcome: feature.desired_outcome, problemStatement: feature.problem_statement }
      : null,
    messages: messages
      .filter((m) => staff || !m.is_internal)
      .map((m) => projectFeedbackMessage(m, person(people.get(m.author_user_id)), staff)),
    storage: { attachmentsAvailable: isR2Configured },
    updatedAt: item.updated_at,
    ...(staff ? { capabilities: await capabilities(client, identity, item) } : {}),
  }
}

export function createFeedbackRouter(dependencies: FeedbackRouterDependencies = {}) {
  const router = Router()
  const createClient = dependencies.createClient ?? createCallerClient

  router.get('/feedback/products', async (request, response) => {
    const identity = identityFor(request)
    let query = createClient(request.accessToken)
      .from('customer_subscriptions')
      .select('product:products!inner(id,code,name)')
      .eq('status', 'ACTIVE')
    if (CUSTOMER_ROLE_SET.has(identity.role))
      query = query.eq('organization_id', identity.organizationId)
    const result = await query
    throwFeedbackError(result.error, 'Feedback products are unavailable.')
    const rows = z
      .array(z.object({ product: z.object({ code: z.string(), id: z.uuid(), name: z.string() }) }))
      .parse(result.data)
    response.json(
      feedbackProductsResponseSchema.parse({
        data: [...new Map(rows.map((r) => [r.product.id, r.product])).values()],
      }),
    )
  })

  router.get('/feedback/filter-metadata', requireBeauRoi, async (request, response) => {
    const client = createClient(request.accessToken)
    const [organizations, products] = await Promise.all([
      client
        .from('organizations')
        .select('id,name')
        .eq('organization_type', 'CUSTOMER')
        .order('name'),
      client.from('products').select('id,code,name').eq('status', 'ACTIVE').order('name'),
    ])
    throwFeedbackError(organizations.error, 'Feedback organizations are unavailable.')
    throwFeedbackError(products.error, 'Feedback products are unavailable.')
    response.json(
      feedbackFilterMetadataResponseSchema.parse({
        data: { organizations: organizations.data, products: products.data },
      }),
    )
  })

  const list = (staff: boolean) => async (request: Request, response: Response) => {
    const identity = identityFor(request)
    if (!staff) requireCustomer(identity.role)
    const input = (staff ? staffFeedbackQueueQuerySchema : customerFeedbackListQuerySchema).parse(
      request.query,
    )
    const client = createClient(request.accessToken)
    const pageCursor = decodeCursor(input.cursor)
    let query = client.from('feedback').select(FEEDBACK_SELECT)
    if (!staff)
      query =
        ('scope' in input ? input.scope : 'mine') === 'mine'
          ? query.eq('organization_id', identity.organizationId)
          : query.eq('is_public', true).eq('category', 'FEATURE_REQUEST')
    if ('organizationId' in input && input.organizationId)
      query = query.eq('organization_id', input.organizationId)
    if (input.productId) query = query.eq('product_id', input.productId)
    if (input.type) query = query.eq('category', input.type)
    if (input.status) query = query.eq('status', input.status)
    if ('priority' in input && input.priority) query = query.eq('priority', input.priority)
    if (input.search)
      query = query.or(
        `title.ilike.%${input.search.replaceAll(',', '')}%,description.ilike.%${input.search.replaceAll(',', '')}%`,
      )
    const field = input.sort === 'activity-desc' ? 'last_activity_at' : 'created_at'
    const ascending = input.sort === 'created-asc'
    if (pageCursor)
      query = ascending ? query.gt(field, pageCursor.value) : query.lt(field, pageCursor.value)
    const result = await query
      .order(field, { ascending })
      .order('id', { ascending })
      .limit(input.limit + 1)
    throwFeedbackError(result.error, 'Feedback could not be listed.')
    const rows = z.array(feedbackRowSchema).parse(result.data)
    const page = rows.slice(0, input.limit)
    const people = await profiles(
      client,
      page.map((r) => r.submitted_by),
    )
    const data = await Promise.all(page.map((row) => listItem(client, row, people)))
    const lastRow = page.at(-1)
    response.json(
      feedbackListResponseSchema.parse({
        data,
        nextCursor: rows.length > input.limit && lastRow ? cursor(lastRow, input.sort) : null,
      }),
    )
  }
  router.get('/feedback', list(false))
  router.get('/feedback/queue', requireBeauRoi, list(true))

  router.post('/feedback', async (request, response) => {
    const identity = identityFor(request)
    requireCustomer(identity.role)
    const input = createFeedbackSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('create_feedback', {
      bug_environment: input.bugEnvironment ?? null,
      bug_reproduction_steps: input.bugReproductionSteps ?? null,
      feature_desired_outcome: input.featureDesiredOutcome ?? null,
      feature_problem_statement: input.featureProblemStatement ?? null,
      feedback_description: input.description,
      feedback_title: input.title,
      feedback_type: input.type,
      target_organization_id: identity.organizationId,
      target_product_id: input.productId,
    })
    throwFeedbackError(result.error, 'Feedback could not be created.')
    response.status(201).json(
      feedbackIdentifierResponseSchema.parse({
        data: { id: z.uuid().parse(result.data as unknown) },
      }),
    )
  })

  router.get('/feedback/:feedbackId', async (request, response) => {
    const identity = identityFor(request)
    const { feedbackId } = feedbackParameterSchema.parse(request.params)
    const staff = BEAUROI_ROLES.includes(identity.role)
    const data = await detail(createClient(request.accessToken), feedbackId, staff, identity)
    response.json({
      data: (staff ? staffFeedbackDetailSchema : customerFeedbackDetailSchema).parse(data),
    })
  })

  const addMessage = (internal: boolean) => async (request: Request, response: Response) => {
    const { feedbackId } = feedbackParameterSchema.parse(request.params)
    const input = addFeedbackMessageSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('add_feedback_message', {
      internal_message: internal,
      message_body: input.body,
      target_feedback_id: feedbackId,
    })
    throwFeedbackError(result.error, 'Feedback response could not be added.')
    response.status(201).json(
      feedbackIdentifierResponseSchema.parse({
        data: { id: z.uuid().parse(result.data as unknown) },
      }),
    )
  }
  router.post('/feedback/:feedbackId/messages', addMessage(false))
  router.post('/feedback/:feedbackId/responses', requireBeauRoi, addMessage(false))
  router.post('/feedback/:feedbackId/internal-notes', requireBeauRoi, addMessage(true))

  router.patch('/feedback/:feedbackId/status', requireBeauRoi, async (request, response) => {
    const { feedbackId } = feedbackParameterSchema.parse(request.params)
    const input = updateFeedbackStatusSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('update_feedback_status', {
      target_feedback_id: feedbackId,
      target_status: input.status,
    })
    throwFeedbackError(result.error, 'Feedback status could not be updated.')
    response.json(feedbackIdentifierResponseSchema.parse({ data: { id: feedbackId } }))
  })
  router.patch('/feedback/:feedbackId/triage', requireBeauRoi, async (request, response) => {
    const { feedbackId } = feedbackParameterSchema.parse(request.params)
    const input = updateFeedbackTriageSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('update_feedback_triage', {
      target_feedback_id: feedbackId,
      target_priority: input.priority,
      target_public: input.isPublic,
      target_severity: input.severity,
    })
    throwFeedbackError(result.error, 'Feedback triage could not be updated.')
    response.json(feedbackIdentifierResponseSchema.parse({ data: { id: feedbackId } }))
  })
  const vote = (remove: boolean) => async (request: Request, response: Response) => {
    requireCustomer(identityFor(request).role)
    const { feedbackId } = feedbackParameterSchema.parse(request.params)
    const result = await createClient(request.accessToken).rpc(
      remove ? 'unvote_feature_request' : 'vote_feature_request',
      { target_feedback_id: feedbackId },
    )
    throwFeedbackError(result.error, 'Feature vote could not be updated.')
    response.json(feedbackIdentifierResponseSchema.parse({ data: { id: feedbackId } }))
  }
  router.post('/feedback/:feedbackId/vote', vote(false))
  router.delete('/feedback/:feedbackId/vote', vote(true))
  return router
}

export const feedbackRouter = createFeedbackRouter()
