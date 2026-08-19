import {
  BEAUROI_ROLES,
  CUSTOMER_ROLES,
  createMaintenanceSchema,
  createReleaseSchema,
  customerMaintenanceListResponseSchema,
  customerReleaseDetailSchema,
  customerReleaseListQuerySchema,
  customerReleaseListResponseSchema,
  linkReleaseFeedbackSchema,
  maintenanceListQuerySchema,
  maintenanceListResponseSchema,
  maintenanceParameterSchema,
  releaseCurrentVersionsResponseSchema,
  releaseFilterMetadataResponseSchema,
  releaseIdentifierResponseSchema,
  releaseListResponseSchema,
  releaseParameterSchema,
  staffReleaseDetailSchema,
  staffReleaseListQuerySchema,
  transitionMaintenanceSchema,
  transitionReleaseSchema,
  updateMaintenanceSchema,
  updateReleaseAudienceSchema,
  updateReleaseContentSchema,
  upsertReleaseSectionSchema,
  type AppRole,
} from '@nexora/contracts'
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'

import { isR2Configured } from '../lib/env.js'
import { AppError } from '../lib/errors.js'
import { createCallerClient } from '../lib/supabase.js'
import { requireBeauRoi } from '../middleware/auth.js'

type CallerClient = ReturnType<typeof createCallerClient>
interface ReleaseRouterDependencies {
  createClient?: (accessToken: string | undefined) => CallerClient
}
const relationSchema = z.object({ id: z.uuid(), name: z.string() }).strict()
const productSchema = relationSchema.extend({ code: z.string() }).strict()
const releaseRowSchema = z
  .object({
    audience_mode: z.enum(['ALL_SUBSCRIBERS', 'SELECTED_ORGANIZATIONS']),
    created_at: z.iso.datetime({ offset: true }),
    customer_visible: z.boolean(),
    id: z.uuid(),
    last_activity_at: z.iso.datetime({ offset: true }),
    product: productSchema,
    product_id: z.uuid(),
    published_at: z.iso.datetime({ offset: true }).nullable(),
    release_notes: z.string().nullable(),
    release_status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
    released_at: z.iso.datetime({ offset: true }).nullable(),
    scheduled_for: z.iso.datetime({ offset: true }).nullable(),
    summary: z.string().nullable(),
    title: z.string(),
    version: z.string(),
  })
  .strict()
const maintenanceRowSchema = z
  .object({
    audience_mode: z.enum(['ALL_SUBSCRIBERS', 'SELECTED_ORGANIZATIONS']),
    created_at: z.iso.datetime({ offset: true }),
    customer_visible: z.boolean(),
    description: z.string(),
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    id: z.uuid(),
    last_activity_at: z.iso.datetime({ offset: true }),
    maintenance_status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
    product: productSchema,
    product_id: z.uuid(),
    starts_at: z.iso.datetime({ offset: true }),
    title: z.string(),
  })
  .strict()
const sectionRowSchema = z
  .object({
    body: z.string(),
    category: z.enum([
      'NEW_FEATURE',
      'IMPROVEMENT',
      'BUG_FIX',
      'SECURITY',
      'DEPRECATION',
      'IMPORTANT_CHANGE',
    ]),
    id: z.uuid(),
    sort_order: z.number().int(),
    title: z.string(),
  })
  .strict()
const eventRowSchema = z
  .object({
    created_at: z.iso.datetime({ offset: true }),
    customer_visible: z.boolean(),
    event_type: z.string(),
    id: z.uuid(),
  })
  .strict()
const targetRowSchema = z.object({ organization: relationSchema }).strict()
const feedbackLinkRowSchema = z
  .object({ feedback: z.object({ id: z.uuid(), title: z.string() }).strict() })
  .strict()
const subscriptionProductRowSchema = z.object({ product: productSchema }).strict()
const featureMetadataRowSchema = z
  .object({ id: z.uuid(), product_id: z.uuid(), title: z.string() })
  .strict()
const RELEASE_SELECT =
  'id,product_id,version,title,summary,release_notes,release_status,audience_mode,customer_visible,scheduled_for,published_at,released_at,created_at,last_activity_at,product:products!product_releases_product_id_fkey(id,code,name)'
const MAINTENANCE_SELECT =
  'id,product_id,title,description,starts_at,ends_at,maintenance_status,audience_mode,customer_visible,created_at,last_activity_at,product:products!maintenance_notices_product_id_fkey(id,code,name)'
const CUSTOMER_ROLE_SET = new Set<AppRole>(CUSTOMER_ROLES)

function identityFor(request: Request) {
  if (!request.identity) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  return request.identity
}
function requireCustomer(role: AppRole) {
  if (!CUSTOMER_ROLE_SET.has(role))
    throw new AppError(403, 'CUSTOMER_ACCESS_REQUIRED', 'Customer access is required.')
}
function throwReleaseError(
  error: { code?: string; message: string } | null,
  message: string,
): asserts error is null {
  if (!error) return
  if (error.code === '42501')
    throw new AppError(403, 'RELEASE_ACCESS_DENIED', 'Release access is unavailable.')
  if (error.code === 'P0001' || error.code === 'PGRST116')
    throw new AppError(404, 'RELEASE_NOT_FOUND', 'Release information is unavailable.')
  if (error.code === '23505') throw new AppError(409, 'RELEASE_CONFLICT', message)
  if (error.code === '23514') throw new AppError(409, 'RELEASE_MUTATION_REJECTED', message)
  throw new AppError(400, 'RELEASE_OPERATION_FAILED', message)
}
function decodeCursor(value: string | undefined) {
  if (!value) return undefined
  try {
    return z
      .object({ id: z.uuid(), value: z.iso.datetime({ offset: true }) })
      .parse(JSON.parse(Buffer.from(value, 'base64url').toString()) as unknown)
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.')
  }
}
function encodeCursor(id: string, value: string) {
  return Buffer.from(JSON.stringify({ id, value })).toString('base64url')
}
async function targetCounts(client: CallerClient, releaseIds: string[], maintenance = false) {
  if (!releaseIds.length) return new Map<string, number>()
  const field = maintenance ? 'notice_id' : 'release_id'
  const result = await client
    .from(maintenance ? 'maintenance_targets' : 'release_targets')
    .select(field)
    .in(field, releaseIds)
  throwReleaseError(result.error, 'Audience information is unavailable.')
  const rows = z.array(z.record(z.string(), z.uuid())).parse(result.data)
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const id = row[field]
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  })
  return counts
}
function releaseItem(row: z.infer<typeof releaseRowSchema>, targetCount?: number) {
  const customer = {
    createdAt: row.created_at,
    customerVisible: row.customer_visible,
    id: row.id,
    lastActivityAt: row.last_activity_at,
    product: row.product,
    publishedAt: row.published_at,
    releaseDate: row.released_at,
    scheduledFor: row.scheduled_for,
    status: row.release_status,
    summary: row.summary,
    title: row.title,
    version: row.version,
  }
  return targetCount === undefined
    ? customer
    : { ...customer, audience: row.audience_mode, targetCount }
}
function maintenanceItem(
  row: z.infer<typeof maintenanceRowSchema>,
  targets?: z.infer<typeof relationSchema>[],
) {
  const customer = {
    createdAt: row.created_at,
    customerVisible: row.customer_visible,
    description: row.description,
    endsAt: row.ends_at,
    id: row.id,
    lastActivityAt: row.last_activity_at,
    product: row.product,
    startsAt: row.starts_at,
    status: row.maintenance_status,
    title: row.title,
  }
  return targets === undefined
    ? customer
    : { ...customer, audience: row.audience_mode, targetCount: targets.length, targets }
}

async function maintenanceTargets(client: CallerClient, noticeIds: string[]) {
  const targets = new Map<string, z.infer<typeof relationSchema>[]>()
  if (!noticeIds.length) return targets
  const result = await client
    .from('maintenance_targets')
    .select(
      'notice_id,organization:organizations!maintenance_targets_organization_id_fkey(id,name)',
    )
    .in('notice_id', noticeIds)
  throwReleaseError(result.error, 'Maintenance audience information is unavailable.')
  const rows = z
    .array(z.object({ notice_id: z.uuid(), organization: relationSchema }).strict())
    .parse(result.data)
  rows.forEach((row) => {
    const values = targets.get(row.notice_id) ?? []
    values.push(row.organization)
    targets.set(row.notice_id, values)
  })
  return targets
}

export function createReleaseRouter(dependencies: ReleaseRouterDependencies = {}) {
  const router = Router()
  const createClient = dependencies.createClient ?? createCallerClient

  router.get('/releases/filter-metadata', requireBeauRoi, async (request, response) => {
    const client = createClient(request.accessToken)
    const [products, organizations, featureRequests] = await Promise.all([
      client.from('products').select('id,code,name').eq('status', 'ACTIVE').order('name'),
      client
        .from('organizations')
        .select('id,name')
        .eq('organization_type', 'CUSTOMER')
        .eq('is_active', true)
        .order('name'),
      client
        .from('feedback')
        .select('id,product_id,title')
        .eq('category', 'FEATURE_REQUEST')
        .in('status', ['PLANNED', 'IN_PROGRESS', 'SHIPPED'])
        .order('title'),
    ])
    throwReleaseError(products.error, 'Release products are unavailable.')
    throwReleaseError(organizations.error, 'Release organizations are unavailable.')
    throwReleaseError(featureRequests.error, 'Release feature requests are unavailable.')
    const features = z.array(featureMetadataRowSchema).parse(featureRequests.data)
    response.json(
      releaseFilterMetadataResponseSchema.parse({
        data: {
          featureRequests: features.map((feature) => ({
            id: feature.id,
            productId: feature.product_id,
            title: feature.title,
          })),
          organizations: organizations.data,
          products: products.data,
        },
      }),
    )
  })

  const listReleases = (staff: boolean) => async (request: Request, response: Response) => {
    const identity = identityFor(request)
    if (!staff) requireCustomer(identity.role)
    const input = (staff ? staffReleaseListQuerySchema : customerReleaseListQuerySchema).parse(
      request.query,
    )
    const pageCursor = decodeCursor(input.cursor)
    const field = input.sort === 'activity-desc' ? 'last_activity_at' : 'released_at'
    const ascending = input.sort === 'date-asc'
    let query = createClient(request.accessToken).from('product_releases').select(RELEASE_SELECT)
    if (input.productId) query = query.eq('product_id', input.productId)
    if ('status' in input && input.status) query = query.eq('release_status', input.status)
    if (input.search)
      query = query.or(
        `title.ilike.%${input.search.replaceAll(',', '')}%,version.ilike.%${input.search.replaceAll(',', '')}%`,
      )
    if (pageCursor)
      query = ascending ? query.gt(field, pageCursor.value) : query.lt(field, pageCursor.value)
    const result = await query
      .order(field, { ascending, nullsFirst: false })
      .order('id', { ascending })
      .limit(input.limit + 1)
    throwReleaseError(result.error, 'Releases could not be listed.')
    const rows = z.array(releaseRowSchema).parse(result.data)
    const page = rows.slice(0, input.limit)
    const counts = staff
      ? await targetCounts(
          createClient(request.accessToken),
          page.map((x) => x.id),
        )
      : null
    const data = page.map((row) => releaseItem(row, counts?.get(row.id) ?? (staff ? 0 : undefined)))
    const last = page.at(-1)
    const payload = {
      data,
      nextCursor:
        rows.length > input.limit && last
          ? encodeCursor(
              last.id,
              field === 'last_activity_at'
                ? last.last_activity_at
                : (last.released_at ?? last.created_at),
            )
          : null,
    }
    response.json(
      (staff ? releaseListResponseSchema : customerReleaseListResponseSchema).parse(payload),
    )
  }
  router.get('/releases', listReleases(false))
  router.get('/releases/queue', requireBeauRoi, listReleases(true))

  router.get('/releases/current-versions', async (request, response) => {
    const identity = identityFor(request)
    requireCustomer(identity.role)
    const result = await createClient(request.accessToken)
      .from('customer_subscriptions')
      .select('product:products!inner(id,code,name)')
      .eq('organization_id', identity.organizationId)
      .eq('status', 'ACTIVE')
    throwReleaseError(result.error, 'Subscribed products are unavailable.')
    const rows = z.array(subscriptionProductRowSchema).parse(result.data)
    response.json(
      releaseCurrentVersionsResponseSchema.parse({
        currentVersions: rows.map((row) => ({ currentVersion: null, product: row.product })),
      }),
    )
  })

  router.get('/releases/:releaseId', async (request, response) => {
    const identity = identityFor(request)
    const { releaseId } = releaseParameterSchema.parse(request.params)
    const staff = BEAUROI_ROLES.includes(identity.role)
    const client = createClient(request.accessToken)
    const [releaseResult, sectionsResult, eventsResult] = await Promise.all([
      client.from('product_releases').select(RELEASE_SELECT).eq('id', releaseId).maybeSingle(),
      client
        .from('release_note_sections')
        .select('id,category,title,body,sort_order')
        .eq('release_id', releaseId)
        .order('sort_order')
        .order('id'),
      client
        .from('release_events')
        .select('id,event_type,customer_visible,created_at')
        .eq('release_id', releaseId)
        .order('created_at')
        .order('id'),
    ])
    throwReleaseError(releaseResult.error, 'Release is unavailable.')
    throwReleaseError(sectionsResult.error, 'Release notes are unavailable.')
    throwReleaseError(eventsResult.error, 'Release history is unavailable.')
    if (!releaseResult.data) throw new AppError(404, 'RELEASE_NOT_FOUND', 'Release not found.')
    const row = releaseRowSchema.parse(releaseResult.data)
    const sections = z
      .array(sectionRowSchema)
      .parse(sectionsResult.data)
      .map((section) => ({
        body: section.body,
        category: section.category,
        id: section.id,
        sortOrder: section.sort_order,
        title: section.title,
      }))
    const events = z.array(eventRowSchema).parse(eventsResult.data)
    const base = {
      ...releaseItem(row),
      events: events.map((event) => ({
        createdAt: event.created_at,
        eventType: event.event_type,
        id: event.id,
        ...(staff ? { customerVisible: event.customer_visible } : {}),
      })),
      releaseNotes: row.release_notes,
      sections,
      storage: { attachmentsAvailable: isR2Configured },
    }
    if (!staff) return response.json({ data: customerReleaseDetailSchema.parse(base) })
    const [targetsResult, linksResult] = await Promise.all([
      client
        .from('release_targets')
        .select('organization:organizations!release_targets_organization_id_fkey(id,name)')
        .eq('release_id', releaseId),
      client
        .from('release_feedback_links')
        .select('feedback:feedback!release_feedback_links_feedback_id_fkey(id,title)')
        .eq('release_id', releaseId),
    ])
    throwReleaseError(targetsResult.error, 'Release audience is unavailable.')
    throwReleaseError(linksResult.error, 'Release feedback links are unavailable.')
    const targets = z
      .array(targetRowSchema)
      .parse(targetsResult.data)
      .map((x) => x.organization)
    const feedbackLinks = z
      .array(feedbackLinkRowSchema)
      .parse(linksResult.data)
      .map((x) => ({
        feedbackId: x.feedback.id,
        title: x.feedback.title,
      }))
    const admin = identity.role === 'BEAUROI_ADMIN'
    response.json({
      data: staffReleaseDetailSchema.parse({
        ...base,
        audience: row.audience_mode,
        capabilities: {
          canArchive: admin && row.release_status === 'PUBLISHED',
          canEdit: admin && ['DRAFT', 'SCHEDULED'].includes(row.release_status),
          canManageAudience: admin && ['DRAFT', 'SCHEDULED'].includes(row.release_status),
          canManageMaintenance: admin,
          canPublish: admin && ['DRAFT', 'SCHEDULED'].includes(row.release_status),
          canSchedule: admin && ['DRAFT', 'SCHEDULED'].includes(row.release_status),
        },
        feedbackLinks,
        targetCount: targets.length,
        targets,
      }),
    })
  })

  router.post('/releases', requireBeauRoi, async (request, response) => {
    const input = createReleaseSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('create_release_draft', {
      target_notes: input.releaseNotes ?? null,
      target_product_id: input.productId,
      target_summary: input.summary ?? null,
      target_title: input.title,
      target_version: input.version,
    })
    throwReleaseError(result.error, 'Release draft could not be created.')
    const id = z.uuid().parse(result.data)
    response.status(201).json(releaseIdentifierResponseSchema.parse({ data: { id } }))
  })
  router.patch('/releases/:releaseId/content', requireBeauRoi, async (request, response) => {
    const { releaseId } = releaseParameterSchema.parse(request.params)
    const input = updateReleaseContentSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('update_release_content', {
      target_notes: input.releaseNotes ?? null,
      target_release_id: releaseId,
      target_summary: input.summary ?? null,
      target_title: input.title,
    })
    throwReleaseError(result.error, 'Release content could not be updated.')
    response.json(releaseIdentifierResponseSchema.parse({ data: { id: releaseId } }))
  })
  router.put('/releases/:releaseId/audience', requireBeauRoi, async (request, response) => {
    const { releaseId } = releaseParameterSchema.parse(request.params)
    const input = updateReleaseAudienceSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('set_release_audience', {
      target_mode: input.mode,
      target_organization_ids: input.organizationIds,
      target_release_id: releaseId,
    })
    throwReleaseError(result.error, 'Release audience could not be updated.')
    response.json(releaseIdentifierResponseSchema.parse({ data: { id: releaseId } }))
  })
  router.post('/releases/:releaseId/sections', requireBeauRoi, async (request, response) => {
    const { releaseId } = releaseParameterSchema.parse(request.params)
    const input = upsertReleaseSectionSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('upsert_release_section', {
      target_body: input.body,
      target_category: input.category,
      target_release_id: releaseId,
      target_section_id: input.sectionId ?? null,
      target_sort_order: input.sortOrder,
      target_title: input.title,
    })
    throwReleaseError(result.error, 'Release note section could not be saved.')
    const id = z.uuid().parse(result.data)
    response.status(201).json(releaseIdentifierResponseSchema.parse({ data: { id } }))
  })
  router.patch('/releases/:releaseId/status', requireBeauRoi, async (request, response) => {
    const { releaseId } = releaseParameterSchema.parse(request.params)
    const input = transitionReleaseSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('transition_release', {
      target_release_id: releaseId,
      target_scheduled_for: input.scheduledFor ?? null,
      target_status: input.status,
    })
    throwReleaseError(result.error, 'Release status could not be updated.')
    response.json(releaseIdentifierResponseSchema.parse({ data: { id: releaseId } }))
  })
  router.post('/releases/:releaseId/feedback-links', requireBeauRoi, async (request, response) => {
    const { releaseId } = releaseParameterSchema.parse(request.params)
    const input = linkReleaseFeedbackSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('link_release_feedback', {
      target_feedback_id: input.feedbackId,
      target_release_id: releaseId,
    })
    throwReleaseError(result.error, 'Feature request could not be linked.')
    response.status(201).json(releaseIdentifierResponseSchema.parse({ data: { id: releaseId } }))
  })

  const listMaintenance = (staff: boolean) => async (request: Request, response: Response) => {
    const identity = identityFor(request)
    if (!staff) requireCustomer(identity.role)
    const input = maintenanceListQuerySchema.parse(request.query)
    const pageCursor = decodeCursor(input.cursor)
    const client = createClient(request.accessToken)
    let query = client.from('maintenance_notices').select(MAINTENANCE_SELECT)
    if (input.productId) query = query.eq('product_id', input.productId)
    if (input.status) query = query.eq('maintenance_status', input.status)
    if (pageCursor) query = query.lt('last_activity_at', pageCursor.value)
    const result = await query
      .order('last_activity_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(input.limit + 1)
    throwReleaseError(result.error, 'Maintenance notices could not be listed.')
    const rows = z.array(maintenanceRowSchema).parse(result.data)
    const page = rows.slice(0, input.limit)
    const targets = staff
      ? await maintenanceTargets(
          client,
          page.map((x) => x.id),
        )
      : null
    const data = page.map((row) =>
      maintenanceItem(row, targets?.get(row.id) ?? (staff ? [] : undefined)),
    )
    const last = page.at(-1)
    response.json(
      (staff ? maintenanceListResponseSchema : customerMaintenanceListResponseSchema).parse({
        data,
        nextCursor:
          rows.length > input.limit && last ? encodeCursor(last.id, last.last_activity_at) : null,
      }),
    )
  }
  router.get('/maintenance', listMaintenance(false))
  router.get('/maintenance/queue', requireBeauRoi, listMaintenance(true))
  router.post('/maintenance', requireBeauRoi, async (request, response) => {
    const input = createMaintenanceSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('create_maintenance_draft', {
      target_description: input.description,
      target_ends_at: input.endsAt ?? null,
      target_product_id: input.productId,
      target_starts_at: input.startsAt,
      target_title: input.title,
    })
    throwReleaseError(result.error, 'Maintenance draft could not be created.')
    const id = z.uuid().parse(result.data)
    response.status(201).json(releaseIdentifierResponseSchema.parse({ data: { id } }))
  })
  router.patch('/maintenance/:noticeId/content', requireBeauRoi, async (request, response) => {
    const { noticeId } = maintenanceParameterSchema.parse(request.params)
    const input = updateMaintenanceSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('update_maintenance_content', {
      target_description: input.description,
      target_ends_at: input.endsAt ?? null,
      target_notice_id: noticeId,
      target_starts_at: input.startsAt,
      target_title: input.title,
    })
    throwReleaseError(result.error, 'Maintenance content could not be updated.')
    response.json(releaseIdentifierResponseSchema.parse({ data: { id: noticeId } }))
  })
  router.put('/maintenance/:noticeId/audience', requireBeauRoi, async (request, response) => {
    const { noticeId } = maintenanceParameterSchema.parse(request.params)
    const input = updateReleaseAudienceSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('set_maintenance_audience', {
      target_mode: input.mode,
      target_notice_id: noticeId,
      target_organization_ids: input.organizationIds,
    })
    throwReleaseError(result.error, 'Maintenance audience could not be updated.')
    response.json(releaseIdentifierResponseSchema.parse({ data: { id: noticeId } }))
  })
  router.patch('/maintenance/:noticeId/status', requireBeauRoi, async (request, response) => {
    const { noticeId } = maintenanceParameterSchema.parse(request.params)
    const input = transitionMaintenanceSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('transition_maintenance', {
      target_notice_id: noticeId,
      target_status: input.status,
    })
    throwReleaseError(result.error, 'Maintenance status could not be updated.')
    response.json(releaseIdentifierResponseSchema.parse({ data: { id: noticeId } }))
  })
  return router
}

export const releasesRouter = createReleaseRouter()
