import {
  BEAUROI_ROLES,
  CUSTOMER_ROLES,
  addSupportMessageSchema,
  createSupportTicketSchema,
  customerSupportTicketDetailSchema,
  customerSupportTicketListQuerySchema,
  staffSupportTicketDetailSchema,
  staffSupportQueueQuerySchema,
  supportCategoriesQuerySchema,
  supportEligibleAssigneesResponseSchema,
  supportFilterMetadataResponseSchema,
  supportIdentifierResponseSchema,
  supportNotificationParameterSchema,
  supportNotificationsResponseSchema,
  supportProductsResponseSchema,
  supportTicketCursorSchema,
  supportTicketListResponseSchema,
  supportTicketParameterSchema,
  updateSupportAssigneeSchema,
  updateSupportCategorySchema,
  updateSupportPrioritySchema,
  updateSupportStatusSchema,
  type AppRole,
} from '@nexora/contracts'
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'

import { isR2Configured } from '../lib/env.js'
import { AppError } from '../lib/errors.js'
import { createCallerClient } from '../lib/supabase.js'
import { requireBeauRoi } from '../middleware/auth.js'

type CallerClient = ReturnType<typeof createCallerClient>
interface SupportRouterDependencies {
  createClient?: (accessToken: string | undefined) => CallerClient
  now?: () => Date
}

const relationSchema = z.object({ id: z.uuid(), name: z.string() }).strict()
const categoryRelationSchema = z
  .object({
    code: z.string(),
    description: z.string().nullable(),
    id: z.uuid(),
    is_active: z.boolean(),
    name: z.string(),
    product_id: z.uuid().nullable(),
  })
  .strict()
const ticketRowSchema = z
  .object({
    assigned_to: z.uuid().nullable(),
    category_id: z.uuid().nullable(),
    created_at: z.iso.datetime({ offset: true }),
    created_by: z.uuid(),
    description: z.string(),
    first_responded_at: z.iso.datetime({ offset: true }).nullable(),
    first_response_due_at: z.iso.datetime({ offset: true }).nullable(),
    id: z.uuid(),
    last_activity_at: z.iso.datetime({ offset: true }),
    organization_id: z.uuid(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    product_id: z.uuid().nullable(),
    resolution_due_at: z.iso.datetime({ offset: true }).nullable(),
    resolution_summary: z.string().nullable(),
    resolved_at: z.iso.datetime({ offset: true }).nullable(),
    closed_at: z.iso.datetime({ offset: true }).nullable(),
    sla_policy_id: z.uuid().nullable(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED']),
    subject: z.string(),
    ticket_number: z.coerce.string(),
    updated_at: z.iso.datetime({ offset: true }),
    organization: relationSchema,
    product: relationSchema.nullable(),
    category: categoryRelationSchema.nullable(),
  })
  .strict()
const personRowSchema = z
  .object({ designation: z.string().nullable(), full_name: z.string(), id: z.uuid() })
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
const attachmentRowSchema = z
  .object({
    content_type: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    entity_id: z.uuid(),
    entity_type: z.enum(['TICKET', 'TICKET_MESSAGE']),
    id: z.uuid(),
    original_filename: z.string(),
    size_bytes: z.coerce.number().int().nonnegative(),
  })
  .strict()
const supportCategoriesResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          code: z.string(),
          description: z.string().nullable(),
          id: z.uuid(),
          isActive: z.boolean(),
          name: z.string(),
          productId: z.uuid().nullable(),
        })
        .strict(),
    ),
  })
  .strict()
const subscribedProductRowSchema = z
  .object({
    product: z.object({ code: z.string(), id: z.uuid(), name: z.string() }).strict(),
    product_id: z.uuid(),
  })
  .strict()
const staffMembershipRowSchema = z
  .object({
    organizations: z
      .object({ is_active: z.boolean(), organization_type: z.enum(['BEAUROI', 'CUSTOMER']) })
      .strict(),
    role: z.enum(['BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE']),
    user_id: z.uuid(),
  })
  .strict()
const supportAssignmentCandidateSchema = z.object({ employee_user_id: z.uuid() }).strict()
const productMetadataRowSchema = z
  .object({ code: z.string(), id: z.uuid(), name: z.string() })
  .strict()
const notificationRowSchema = z
  .object({
    body: z.string(),
    category: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    id: z.uuid(),
    link_path: z.string().nullable(),
    status: z.enum(['UNREAD', 'READ', 'ARCHIVED']),
    title: z.string(),
  })
  .strict()

const TICKET_SELECT =
  'id,ticket_number,organization_id,product_id,category_id,subject,description,status,priority,created_by,assigned_to,sla_policy_id,first_response_due_at,resolution_due_at,first_responded_at,resolved_at,closed_at,resolution_summary,created_at,updated_at,last_activity_at,organization:organizations!support_tickets_organization_id_fkey(id,name),product:products!support_tickets_product_id_fkey(id,name),category:support_categories!support_tickets_category_id_fkey(id,code,name,description,product_id,is_active)'
const CUSTOMER_ROLES_SET = new Set<AppRole>(CUSTOMER_ROLES)

function identityFor(request: Request) {
  if (!request.identity) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  return request.identity
}

function requireCustomer(role: AppRole) {
  if (!CUSTOMER_ROLES_SET.has(role))
    throw new AppError(403, 'CUSTOMER_ACCESS_REQUIRED', 'Customer access is required.')
}

function encodeCursor(
  row: z.infer<typeof ticketRowSchema>,
  sort: 'activity-desc' | 'created-asc' | 'created-desc',
) {
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
    return supportTicketCursorSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString()) as unknown,
    )
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.')
  }
}

export function calculateSupportSla(
  row: Pick<
    z.infer<typeof ticketRowSchema>,
    | 'closed_at'
    | 'first_responded_at'
    | 'first_response_due_at'
    | 'resolution_due_at'
    | 'resolved_at'
    | 'sla_policy_id'
    | 'status'
  >,
  now: Date,
) {
  const evaluatedAt = now.toISOString()
  const metric = (dueAt: string | null, completedAt: string | null, notApplicable = false) => ({
    completedAt,
    dueAt,
    state:
      dueAt === null
        ? ('NOT_CONFIGURED' as const)
        : notApplicable
          ? ('NOT_APPLICABLE' as const)
          : completedAt !== null
            ? new Date(completedAt) <= new Date(dueAt)
              ? ('MET' as const)
              : ('BREACHED' as const)
            : now <= new Date(dueAt)
              ? ('PENDING' as const)
              : ('BREACHED' as const),
  })
  return {
    evaluatedAt,
    policyConfigured: row.sla_policy_id !== null,
    resolution: metric(row.resolution_due_at, row.resolved_at ?? row.closed_at),
    response: metric(
      row.first_response_due_at,
      row.first_responded_at,
      row.status === 'CLOSED' && row.first_responded_at === null,
    ),
  }
}

function person(row: z.infer<typeof personRowSchema> | undefined) {
  return row ? { designation: row.designation, fullName: row.full_name, id: row.id } : null
}
function category(row: z.infer<typeof categoryRelationSchema> | null) {
  return row
    ? {
        code: row.code,
        description: row.description,
        id: row.id,
        isActive: row.is_active,
        name: row.name,
        productId: row.product_id,
      }
    : null
}

function capabilities(allowed: boolean) {
  return {
    canAddInternalNote: allowed,
    canAssign: allowed,
    canChangeCategory: allowed,
    canChangePriority: allowed,
    canChangeStatus: allowed,
    canReply: allowed,
  }
}

async function supportCapabilities(
  client: CallerClient,
  identity: ReturnType<typeof identityFor>,
  ticket: z.infer<typeof ticketRowSchema>,
) {
  if (identity.role === 'BEAUROI_ADMIN') return capabilities(true)
  if (identity.role !== 'BEAUROI_EMPLOYEE') return capabilities(false)
  let query = client
    .from('customer_assignments')
    .select('employee_user_id')
    .eq('employee_user_id', identity.userId)
    .eq('organization_id', ticket.organization_id)
    .eq('assignment_type', 'SUPPORT_LEAD')
    .eq('is_active', true)
    .is('ended_at', null)
  query = ticket.product_id
    ? query.or(`product_id.is.null,product_id.eq.${ticket.product_id}`)
    : query.is('product_id', null)
  const result = await query.limit(1)
  throwSupportDatabaseError(result.error, 'Support capabilities are unavailable.')
  return capabilities(z.array(supportAssignmentCandidateSchema).parse(result.data).length > 0)
}

async function eligibleSupportPeople(
  client: CallerClient,
  scope?: { organizationId: string; productId: string | null },
) {
  const membershipResult = await client
    .from('organization_memberships')
    .select('user_id,role,organizations!inner(organization_type,is_active)')
    .eq('status', 'ACTIVE')
    .in('role', ['BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE'])
    .eq('organizations.organization_type', 'BEAUROI')
    .eq('organizations.is_active', true)
  throwSupportDatabaseError(membershipResult.error, 'Eligible support staff are unavailable.')

  let assignmentQuery = client
    .from('customer_assignments')
    .select('employee_user_id')
    .eq('assignment_type', 'SUPPORT_LEAD')
    .eq('is_active', true)
    .is('ended_at', null)
  if (scope) {
    assignmentQuery = assignmentQuery.eq('organization_id', scope.organizationId)
    assignmentQuery = scope.productId
      ? assignmentQuery.or(`product_id.is.null,product_id.eq.${scope.productId}`)
      : assignmentQuery.is('product_id', null)
  }
  const assignmentResult = await assignmentQuery
  throwSupportDatabaseError(assignmentResult.error, 'Eligible support staff are unavailable.')

  const memberships = z.array(staffMembershipRowSchema).parse(membershipResult.data)
  const assigned = new Set(
    z
      .array(supportAssignmentCandidateSchema)
      .parse(assignmentResult.data)
      .map((row) => row.employee_user_id),
  )
  const ids = memberships
    .filter((membership) => membership.role === 'BEAUROI_ADMIN' || assigned.has(membership.user_id))
    .map((membership) => membership.user_id)
  const people = await profiles(client, ids)
  return [...people.values()]
    .map((row) => person(row))
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => left.fullName.localeCompare(right.fullName))
}
function attachment(row: z.infer<typeof attachmentRowSchema>) {
  return {
    contentType: row.content_type,
    createdAt: row.created_at,
    entityId: row.entity_id,
    entityType: row.entity_type,
    id: row.id,
    originalFilename: row.original_filename,
    sizeBytes: row.size_bytes,
  }
}

function listItem(
  row: z.infer<typeof ticketRowSchema>,
  people: Map<string, z.infer<typeof personRowSchema>>,
  now: Date,
) {
  return {
    assignee: row.assigned_to ? person(people.get(row.assigned_to)) : null,
    category: category(row.category),
    createdAt: row.created_at,
    id: row.id,
    lastActivityAt: row.last_activity_at,
    organization: row.organization,
    priority: row.priority,
    product: row.product,
    reference: `SUP-${row.ticket_number}`,
    sla: calculateSupportSla(row, now),
    status: row.status,
    subject: row.subject,
  }
}

async function profiles(client: CallerClient, ids: readonly (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))]
  if (unique.length === 0) return new Map<string, z.infer<typeof personRowSchema>>()
  const { data, error } = await client
    .from('profiles')
    .select('id,full_name,designation')
    .in('id', unique)
  throwSupportDatabaseError(error, 'Profiles are unavailable.')
  const rows = z.array(personRowSchema).parse(data)
  return new Map(rows.map((row) => [row.id, row]))
}

function throwSupportDatabaseError(
  error: { code?: string; message: string } | null,
  message: string,
): asserts error is null {
  if (!error) return
  if (error.code === '42501')
    throw new AppError(403, 'SUPPORT_ACCESS_DENIED', 'Support access is unavailable.')
  if (error.code === 'PGRST116' || error.code === 'P0001')
    throw new AppError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Support ticket not found.')
  if (error.code === '23505') throw new AppError(409, 'SUPPORT_CONFLICT', message)
  if (error.code === '23514') throw new AppError(409, 'SUPPORT_MUTATION_REJECTED', message)
  throw new AppError(400, 'SUPPORT_OPERATION_FAILED', message)
}

async function ticketDetail(
  client: CallerClient,
  ticketId: string,
  staff: boolean,
  identity: ReturnType<typeof identityFor>,
  now: Date,
) {
  const ticketResult = await client
    .from('support_tickets')
    .select(TICKET_SELECT)
    .eq('id', ticketId)
    .maybeSingle()
  throwSupportDatabaseError(ticketResult.error, 'The support ticket is unavailable.')
  if (!ticketResult.data)
    throw new AppError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Support ticket not found.')
  const ticket = ticketRowSchema.parse(ticketResult.data)
  const [messageResult, eventResult] = await Promise.all([
    client
      .from('ticket_messages')
      .select('id,author_user_id,body,is_internal,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at')
      .order('id'),
    client
      .from('support_ticket_events')
      .select('id,event_type,actor_user_id,customer_visible,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at')
      .order('id'),
  ])
  throwSupportDatabaseError(messageResult.error, 'Ticket messages are unavailable.')
  throwSupportDatabaseError(eventResult.error, 'Ticket history is unavailable.')
  const messages = z
    .array(messageRowSchema)
    .parse(messageResult.data)
    .filter((row) => staff || !row.is_internal)
  const events = z
    .array(eventRowSchema)
    .parse(eventResult.data)
    .filter((row) => staff || row.customer_visible)
  const attachmentIds = [ticketId, ...messages.map((row) => row.id)]
  const attachmentResult = await client
    .from('attachments')
    .select('id,entity_type,entity_id,original_filename,content_type,size_bytes,created_at')
    .in('entity_id', attachmentIds)
    .in('entity_type', ['TICKET', 'TICKET_MESSAGE'])
  throwSupportDatabaseError(attachmentResult.error, 'Ticket attachments are unavailable.')
  const attachments = z.array(attachmentRowSchema).parse(attachmentResult.data)
  const people = await profiles(client, [
    ticket.created_by,
    ticket.assigned_to,
    ...messages.map((row) => row.author_user_id),
    ...events.map((row) => row.actor_user_id),
  ])
  const base = {
    ...listItem(ticket, people, now),
    attachments: attachments.filter((row) => row.entity_type === 'TICKET').map(attachment),
    description: ticket.description,
    requester: person(people.get(ticket.created_by)),
    resolutionSummary: ticket.resolution_summary,
    storage: { attachmentsAvailable: isR2Configured },
    updatedAt: ticket.updated_at,
  }
  if (!base.requester)
    throw new AppError(500, 'SUPPORT_DATA_INVALID', 'The ticket requester is unavailable.')
  return {
    ...base,
    ...(staff ? { capabilities: await supportCapabilities(client, identity, ticket) } : {}),
    events: events.map((row) => ({
      actor: person(row.actor_user_id ? people.get(row.actor_user_id) : undefined),
      createdAt: row.created_at,
      eventType: row.event_type,
      id: row.id,
      ...(staff ? { customerVisible: row.customer_visible } : {}),
    })),
    messages: messages.map((row) => ({
      attachments: attachments
        .filter((item) => item.entity_type === 'TICKET_MESSAGE' && item.entity_id === row.id)
        .map(attachment),
      author: person(people.get(row.author_user_id)),
      body: row.body,
      createdAt: row.created_at,
      id: row.id,
      ...(staff ? { isInternal: row.is_internal } : {}),
    })),
  }
}

export function createSupportRouter(dependencies: SupportRouterDependencies = {}) {
  const router = Router()
  const createClient = dependencies.createClient ?? createCallerClient
  const now = dependencies.now ?? (() => new Date())

  async function list(request: Request, response: Response, staff: boolean) {
    const identity = identityFor(request)
    const input = staff
      ? staffSupportQueueQuerySchema.parse(request.query)
      : customerSupportTicketListQuerySchema.parse(request.query)
    const cursor = decodeCursor(input.cursor)
    if (cursor && cursor.sort !== input.sort)
      throw new AppError(
        400,
        'INVALID_CURSOR',
        'The pagination cursor does not match the selected sort.',
      )
    const client = createClient(request.accessToken)
    let query = client.from('support_tickets').select(TICKET_SELECT)
    if (!staff) query = query.eq('organization_id', identity.organizationId)
    if (input.status) query = query.eq('status', input.status)
    if (input.productId) query = query.eq('product_id', input.productId)
    if (input.categoryId) query = query.eq('category_id', input.categoryId)
    if (input.search) query = query.ilike('subject', `%${input.search}%`)
    if (staff) {
      const staffInput = staffSupportQueueQuerySchema.parse(input)
      if (staffInput.organizationId) query = query.eq('organization_id', staffInput.organizationId)
      if (staffInput.assigneeId) query = query.eq('assigned_to', staffInput.assigneeId)
      if (staffInput.priority) query = query.eq('priority', staffInput.priority)
    }
    const dateColumn = input.sort === 'activity-desc' ? 'last_activity_at' : 'created_at'
    const ascending = input.sort === 'created-asc'
    if (cursor) {
      const operation = ascending ? 'gt' : 'lt'
      const value = `"${cursor.value}"`
      query = query.or(
        `${dateColumn}.${operation}.${value},and(${dateColumn}.eq.${value},id.${operation}.${cursor.id})`,
      )
    }
    const result = await query
      .order(dateColumn, { ascending })
      .order('id', { ascending })
      .limit(input.limit + 1)
    throwSupportDatabaseError(result.error, 'Support tickets are unavailable.')
    const rows = z.array(ticketRowSchema).parse(result.data)
    const page = rows.slice(0, input.limit)
    const people = await profiles(
      client,
      page.map((row) => row.assigned_to),
    )
    const lastRow = page.at(-1)
    response.json(
      supportTicketListResponseSchema.parse({
        data: page.map((row) => listItem(row, people, now())),
        nextCursor: rows.length > input.limit && lastRow ? encodeCursor(lastRow, input.sort) : null,
      }),
    )
  }

  router.get('/support/tickets', async (request, response) => {
    requireCustomer(identityFor(request).role)
    await list(request, response, false)
  })
  router.get('/support/queue', requireBeauRoi, async (request, response) => {
    await list(request, response, true)
  })

  router.get('/support/filter-metadata', requireBeauRoi, async (request, response) => {
    const client = createClient(request.accessToken)
    const [organizationResult, productResult, categoryResult, assignees] = await Promise.all([
      client
        .from('organizations')
        .select('id,name')
        .eq('organization_type', 'CUSTOMER')
        .eq('is_active', true)
        .order('name')
        .order('id'),
      client
        .from('products')
        .select('id,code,name')
        .eq('status', 'ACTIVE')
        .order('name')
        .order('id'),
      client
        .from('support_categories')
        .select('id,code,name,description,product_id,is_active')
        .eq('is_active', true)
        .order('sort_order')
        .order('name')
        .order('id'),
      eligibleSupportPeople(client),
    ])
    throwSupportDatabaseError(organizationResult.error, 'Support filter metadata is unavailable.')
    throwSupportDatabaseError(productResult.error, 'Support filter metadata is unavailable.')
    throwSupportDatabaseError(categoryResult.error, 'Support filter metadata is unavailable.')
    response.json(
      supportFilterMetadataResponseSchema.parse({
        data: {
          assignees,
          categories: z.array(categoryRelationSchema).parse(categoryResult.data).map(category),
          organizations: z.array(relationSchema).parse(organizationResult.data),
          products: z.array(productMetadataRowSchema).parse(productResult.data),
        },
      }),
    )
  })

  router.get('/support/products', async (request, response) => {
    const identity = identityFor(request)
    requireCustomer(identity.role)
    const result = await createClient(request.accessToken)
      .from('customer_subscriptions')
      .select(
        'product_id,product:products!customer_subscriptions_product_id_fkey!inner(id,code,name)',
      )
      .eq('organization_id', identity.organizationId)
      .eq('status', 'ACTIVE')
      .order('product(name)')
      .order('product_id')
    throwSupportDatabaseError(result.error, 'Support products are unavailable.')
    const rows = z.array(subscribedProductRowSchema).parse(result.data)
    response.json(supportProductsResponseSchema.parse({ data: rows.map((row) => row.product) }))
  })

  router.get('/support/categories', async (request, response) => {
    const input = supportCategoriesQuerySchema.parse(request.query)
    const identity = identityFor(request)
    const client = createClient(request.accessToken)
    if (CUSTOMER_ROLES_SET.has(identity.role)) {
      if (!input.productId)
        throw new AppError(400, 'PRODUCT_REQUIRED', 'Select a subscribed product.')
      const subscription = await client
        .from('customer_subscriptions')
        .select('id')
        .eq('organization_id', identity.organizationId)
        .eq('product_id', input.productId)
        .eq('status', 'ACTIVE')
        .maybeSingle()
      throwSupportDatabaseError(subscription.error, 'The product subscription is unavailable.')
      if (!subscription.data)
        throw new AppError(404, 'PRODUCT_NOT_AVAILABLE', 'The product is unavailable.')
    }
    let query = client
      .from('support_categories')
      .select('id,code,name,description,product_id,is_active')
      .eq('is_active', true)
    if (input.productId) query = query.or(`product_id.is.null,product_id.eq.${input.productId}`)
    const result = await query.order('sort_order').order('name').order('id')
    throwSupportDatabaseError(result.error, 'Support categories are unavailable.')
    response.json(
      supportCategoriesResponseSchema.parse({
        data: z.array(categoryRelationSchema).parse(result.data).map(category),
      }),
    )
  })

  router.post('/support/tickets', async (request, response) => {
    const identity = identityFor(request)
    requireCustomer(identity.role)
    const input = createSupportTicketSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('create_support_ticket', {
      target_category_id: input.categoryId,
      target_organization_id: identity.organizationId,
      target_product_id: input.productId,
      ticket_description: input.description,
      ticket_subject: input.subject,
    })
    throwSupportDatabaseError(result.error, 'The support ticket could not be created.')
    const identifier = z.uuid().parse(result.data as unknown)
    response.status(201).json(supportIdentifierResponseSchema.parse({ data: { id: identifier } }))
  })

  router.get('/support/tickets/:ticketId', async (request, response) => {
    const { ticketId } = supportTicketParameterSchema.parse(request.params)
    const identity = identityFor(request)
    const staff = BEAUROI_ROLES.includes(identity.role)
    const data = await ticketDetail(
      createClient(request.accessToken),
      ticketId,
      staff,
      identity,
      now(),
    )
    response.json({
      data: (staff ? staffSupportTicketDetailSchema : customerSupportTicketDetailSchema).parse(
        data,
      ),
    })
  })

  router.get(
    '/support/tickets/:ticketId/eligible-assignees',
    requireBeauRoi,
    async (request, response) => {
      const identity = identityFor(request)
      const { ticketId } = supportTicketParameterSchema.parse(request.params)
      const client = createClient(request.accessToken)
      const result = await client
        .from('support_tickets')
        .select(TICKET_SELECT)
        .eq('id', ticketId)
        .maybeSingle()
      throwSupportDatabaseError(result.error, 'The support ticket is unavailable.')
      if (!result.data)
        throw new AppError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Support ticket not found.')
      const ticket = ticketRowSchema.parse(result.data)
      const ticketCapabilities = await supportCapabilities(client, identity, ticket)
      if (!ticketCapabilities.canAssign)
        throw new AppError(403, 'SUPPORT_ACCESS_DENIED', 'Support access is unavailable.')
      response.json(
        supportEligibleAssigneesResponseSchema.parse({
          data: await eligibleSupportPeople(client, {
            organizationId: ticket.organization_id,
            productId: ticket.product_id,
          }),
        }),
      )
    },
  )

  router.get('/support/notifications', async (request, response) => {
    const identity = identityFor(request)
    const client = createClient(request.accessToken)
    const result = await client
      .from('notifications')
      .select('id,title,body,category,link_path,status,created_at')
      .eq('user_id', identity.userId)
      .eq('category', 'SUPPORT')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(20)
    throwSupportDatabaseError(result.error, 'Support notifications are unavailable.')
    const prefix = CUSTOMER_ROLES_SET.has(identity.role) ? '/portal/support/' : '/beauroi/support/'
    const data = z
      .array(notificationRowSchema)
      .parse(result.data)
      .filter((row) => row.status !== 'ARCHIVED' && row.link_path?.startsWith(prefix))
      .map((row) => ({
        body: row.body,
        category: 'SUPPORT' as const,
        createdAt: row.created_at,
        id: row.id,
        linkPath: row.link_path,
        status: row.status,
        title: row.title,
      }))
    response.json(supportNotificationsResponseSchema.parse({ data }))
  })

  router.patch('/support/notifications/:notificationId/read', async (request, response) => {
    const identity = identityFor(request)
    const { notificationId } = supportNotificationParameterSchema.parse(request.params)
    const result = await createClient(request.accessToken)
      .from('notifications')
      .update({ status: 'READ' })
      .eq('id', notificationId)
      .eq('user_id', identity.userId)
      .select('id')
      .maybeSingle()
    throwSupportDatabaseError(result.error, 'The support notification could not be updated.')
    if (!result.data)
      throw new AppError(404, 'SUPPORT_NOTIFICATION_NOT_FOUND', 'Support notification not found.')
    response.json(supportIdentifierResponseSchema.parse({ data: result.data }))
  })

  const addMessage =
    (staff: boolean, internal: boolean) => async (request: Request, response: Response) => {
      if (staff) requireBeauRoi(request, response, () => undefined)
      else requireCustomer(identityFor(request).role)
      const { ticketId } = supportTicketParameterSchema.parse(request.params)
      const input = addSupportMessageSchema.parse(request.body)
      const result = await createClient(request.accessToken).rpc('add_support_ticket_message', {
        internal_message: internal,
        message_body: input.body,
        target_ticket_id: ticketId,
      })
      throwSupportDatabaseError(result.error, 'The ticket message could not be added.')
      const identifier = z.uuid().parse(result.data as unknown)
      response.status(201).json(supportIdentifierResponseSchema.parse({ data: { id: identifier } }))
    }
  router.post('/support/tickets/:ticketId/messages', addMessage(false, false))
  router.post('/support/tickets/:ticketId/replies', requireBeauRoi, addMessage(true, false))
  router.post('/support/tickets/:ticketId/internal-notes', requireBeauRoi, addMessage(true, true))

  const update =
    (
      schema:
        | typeof updateSupportStatusSchema
        | typeof updateSupportPrioritySchema
        | typeof updateSupportCategorySchema
        | typeof updateSupportAssigneeSchema,
      payload: (input: Record<string, unknown>) => Record<string, unknown>,
    ) =>
    async (request: Request, response: Response) => {
      const { ticketId } = supportTicketParameterSchema.parse(request.params)
      const input = schema.parse(request.body) as Record<string, unknown>
      const result = await createClient(request.accessToken)
        .from('support_tickets')
        .update(payload(input))
        .eq('id', ticketId)
        .select('id')
        .single()
      throwSupportDatabaseError(result.error, 'The support ticket could not be updated.')
      response.json(supportIdentifierResponseSchema.parse({ data: result.data }))
    }
  router.patch(
    '/support/tickets/:ticketId/status',
    requireBeauRoi,
    update(updateSupportStatusSchema, (input) => ({
      resolution_summary: input.resolutionSummary,
      status: input.status,
    })),
  )
  router.patch(
    '/support/tickets/:ticketId/priority',
    requireBeauRoi,
    update(updateSupportPrioritySchema, (input) => ({ priority: input.priority })),
  )
  router.patch(
    '/support/tickets/:ticketId/category',
    requireBeauRoi,
    update(updateSupportCategorySchema, (input) => ({ category_id: input.categoryId })),
  )
  router.patch(
    '/support/tickets/:ticketId/assignee',
    requireBeauRoi,
    update(updateSupportAssigneeSchema, (input) => ({ assigned_to: input.assigneeId })),
  )
  return router
}

export const supportRouter = createSupportRouter()
