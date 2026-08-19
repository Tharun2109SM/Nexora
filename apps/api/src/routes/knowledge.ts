import {
  BEAUROI_ROLES,
  CUSTOMER_ROLES,
  createKnowledgeArticleSchema,
  createKnowledgeCategorySchema,
  customerKnowledgeDetailResponseSchema,
  customerKnowledgeListQuerySchema,
  customerKnowledgeListResponseSchema,
  knowledgeArticleParameterSchema,
  knowledgeCategoryParameterSchema,
  knowledgeIdentifierResponseSchema,
  knowledgeMetadataResponseSchema,
  setKnowledgeCategoryActiveSchema,
  staffKnowledgeDetailResponseSchema,
  staffKnowledgeListQuerySchema,
  staffKnowledgeListResponseSchema,
  transitionKnowledgeArticleSchema,
  updateKnowledgeContentSchema,
  updateKnowledgeScopeSchema,
  type AppRole,
} from '@nexora/contracts'
import { Router, type Request } from 'express'
import { z } from 'zod'

import { isR2Configured } from '../lib/env.js'
import { AppError } from '../lib/errors.js'
import { createCallerClient } from '../lib/supabase.js'
import { requireBeauRoi } from '../middleware/auth.js'

type CallerClient = ReturnType<typeof createCallerClient>
interface KnowledgeRouterDependencies {
  createClient?: (accessToken: string | undefined) => CallerClient
}
const STAFF_ROLES = new Set<AppRole>(BEAUROI_ROLES)
const CUSTOMER_ROLE_SET = new Set<AppRole>(CUSTOMER_ROLES)
const relationRowSchema = z.object({ id: z.uuid(), name: z.string() }).strict()
const productRowSchema = relationRowSchema.extend({ code: z.string() }).strict()
const categoryRelationRowSchema = relationRowSchema.extend({ code: z.string() }).strict()
const articleRowSchema = z
  .object({
    article_status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED']),
    article_type: z.enum(['GUIDE', 'FAQ', 'REFERENCE', 'TROUBLESHOOTING', 'ANNOUNCEMENT']),
    audience_mode: z.enum(['INTERNAL', 'ALL_CUSTOMERS', 'PRODUCT_SCOPED', 'SELECTED_ORGANIZATION']),
    body: z.string(),
    category: categoryRelationRowSchema.nullable(),
    created_at: z.iso.datetime({ offset: true }),
    external_url: z.string().nullable(),
    id: z.uuid(),
    organization: relationRowSchema.nullable(),
    product: productRowSchema.nullable(),
    published_at: z.iso.datetime({ offset: true }).nullable(),
    slug: z.string(),
    summary: z.string().nullable(),
    title: z.string(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict()
const eventRowSchema = z
  .object({ created_at: z.iso.datetime({ offset: true }), event_type: z.string(), id: z.uuid() })
  .strict()
const categoryRowSchema = z
  .object({
    code: z.string(),
    description: z.string().nullable(),
    id: z.uuid(),
    is_active: z.boolean(),
    name: z.string(),
    product: productRowSchema.nullable(),
    sort_order: z.number().int(),
  })
  .strict()
const ARTICLE_SELECT =
  'id,slug,title,summary,body,article_status,audience_mode,article_type,external_url,published_at,created_at,updated_at,category:knowledge_categories(id,code,name),product:products(id,code,name),organization:organizations(id,name)'

function identityFor(request: Request) {
  if (!request.identity) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  return request.identity
}
function throwKnowledgeError(
  error: { code?: string; message: string } | null,
): asserts error is null {
  if (!error) return
  if (error.code === '42501')
    throw new AppError(403, 'KNOWLEDGE_ACCESS_DENIED', 'Knowledge access is unavailable.')
  if (error.code === 'P0001' || error.code === 'PGRST116')
    throw new AppError(404, 'ARTICLE_NOT_FOUND', 'The article is unavailable.')
  if (error.code === '23505')
    throw new AppError(409, 'KNOWLEDGE_CONFLICT', 'That knowledge record already exists.')
  if (error.code === '23514')
    throw new AppError(409, 'KNOWLEDGE_MUTATION_REJECTED', 'The requested change is not allowed.')
  throw new AppError(400, 'KNOWLEDGE_OPERATION_FAILED', 'The knowledge operation failed.')
}
function encodeCursor(id: string, value: string) {
  return Buffer.from(JSON.stringify({ id, value })).toString('base64url')
}
function decodeCursor(value: string | undefined) {
  if (!value) return undefined
  try {
    return z
      .object({ id: z.uuid(), value: z.string().min(1).max(300) })
      .parse(JSON.parse(Buffer.from(value, 'base64url').toString()) as unknown)
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.')
  }
}
function mapCustomer(row: z.infer<typeof articleRowSchema>) {
  if (!row.published_at)
    throw new AppError(500, 'INVALID_ARTICLE', 'Published article data is invalid.')
  return {
    articleType: row.article_type,
    category: row.category ? { id: row.category.id, name: row.category.name } : null,
    externalUrl: row.external_url,
    id: row.id,
    product: row.product,
    publishedAt: row.published_at,
    slug: row.slug,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
  }
}
function mapStaff(row: z.infer<typeof articleRowSchema>) {
  return {
    ...mapCustomerNullable(row),
    articleStatus: row.article_status,
    audience: row.audience_mode,
    organization: row.organization,
  }
}
function mapCustomerNullable(row: z.infer<typeof articleRowSchema>) {
  return {
    articleType: row.article_type,
    category: row.category ? { id: row.category.id, name: row.category.name } : null,
    externalUrl: row.external_url,
    id: row.id,
    product: row.product,
    publishedAt: row.published_at,
    slug: row.slug,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
  }
}
export function createKnowledgeRouter(dependencies: KnowledgeRouterDependencies = {}) {
  const router = Router()
  const clientFor = (request: Request) =>
    (dependencies.createClient ?? createCallerClient)(request.accessToken)

  router.get('/knowledge/filter-metadata', async (request, response, next) => {
    try {
      const identity = identityFor(request)
      const client = clientFor(request)
      const staff = STAFF_ROLES.has(identity.role)
      if (!staff && !CUSTOMER_ROLE_SET.has(identity.role))
        throw new AppError(403, 'KNOWLEDGE_ACCESS_DENIED', 'Knowledge access is unavailable.')
      const [categoriesResult, productsResult, organizationsResult] = await Promise.all([
        client
          .from('knowledge_categories')
          .select('id,code,name,description,is_active,sort_order,product:products(id,code,name)')
          .order('sort_order')
          .order('name'),
        client.from('products').select('id,code,name').eq('status', 'ACTIVE').order('name'),
        staff
          ? client
              .from('organizations')
              .select('id,name')
              .eq('organization_type', 'CUSTOMER')
              .eq('is_active', true)
              .order('name')
          : Promise.resolve({ data: [], error: null }),
      ])
      throwKnowledgeError(categoriesResult.error)
      throwKnowledgeError(productsResult.error)
      throwKnowledgeError(organizationsResult.error)
      const categories = z
        .array(categoryRowSchema)
        .parse(categoriesResult.data)
        .map((category) => ({
          code: category.code,
          description: category.description,
          id: category.id,
          isActive: category.is_active,
          name: category.name,
          product: category.product,
          sortOrder: category.sort_order,
        }))
      response.json(
        knowledgeMetadataResponseSchema.parse({
          attachmentsAvailable: isR2Configured,
          categories,
          organizations: z.array(relationRowSchema).parse(organizationsResult.data),
          products: z.array(productRowSchema).parse(productsResult.data),
        }),
      )
    } catch (error) {
      next(error)
    }
  })

  router.get('/knowledge/queue', requireBeauRoi, async (request, response, next) => {
    try {
      const input = staffKnowledgeListQuerySchema.parse(request.query)
      const cursor = decodeCursor(input.cursor)
      const client = clientFor(request)
      let query = client.from('knowledge_base_articles').select(ARTICLE_SELECT)
      if (input.categoryId) query = query.eq('category_id', input.categoryId)
      if (input.productId) query = query.eq('product_id', input.productId)
      if (input.type) query = query.eq('article_type', input.type)
      if (input.search)
        query = query.textSearch('search_document', input.search, {
          config: 'english',
          type: 'websearch',
        })
      if (input.status) query = query.eq('article_status', input.status)
      const ascending = input.sort === 'title-asc'
      const column = ascending
        ? 'title'
        : input.sort === 'published-desc'
          ? 'published_at'
          : 'updated_at'
      if (cursor)
        query = ascending
          ? query.or(
              `${column}.gt.${cursor.value},and(${column}.eq.${cursor.value},id.gt.${cursor.id})`,
            )
          : query.or(
              `${column}.lt.${cursor.value},and(${column}.eq.${cursor.value},id.lt.${cursor.id})`,
            )
      const result = await query
        .order(column, { ascending, nullsFirst: false })
        .order('id', { ascending })
        .limit(input.limit + 1)
      throwKnowledgeError(result.error)
      const rows = z.array(articleRowSchema).parse(result.data)
      const page = rows.slice(0, input.limit)
      const last = page.at(-1)
      response.json(
        staffKnowledgeListResponseSchema.parse({
          data: page.map(mapStaff),
          nextCursor:
            rows.length > input.limit && last
              ? encodeCursor(
                  last.id,
                  ascending
                    ? last.title
                    : ((column === 'published_at' ? last.published_at : last.updated_at) ??
                        last.updated_at),
                )
              : null,
        }),
      )
    } catch (error) {
      next(error)
    }
  })

  router.get('/knowledge', async (request, response, next) => {
    try {
      const identity = identityFor(request)
      if (!CUSTOMER_ROLE_SET.has(identity.role))
        throw new AppError(403, 'CUSTOMER_ACCESS_REQUIRED', 'Customer access is required.')
      const input = customerKnowledgeListQuerySchema.parse(request.query)
      const cursor = decodeCursor(input.cursor)
      const client = clientFor(request)
      let query = client
        .from('knowledge_base_articles')
        .select(ARTICLE_SELECT)
        .eq('article_status', 'PUBLISHED')
      if (input.categoryId) query = query.eq('category_id', input.categoryId)
      if (input.productId) query = query.eq('product_id', input.productId)
      if (input.type) query = query.eq('article_type', input.type)
      if (input.search)
        query = query.textSearch('search_document', input.search, {
          config: 'english',
          type: 'websearch',
        })
      const ascending = input.sort === 'title-asc'
      const column = ascending
        ? 'title'
        : input.sort === 'published-desc'
          ? 'published_at'
          : 'updated_at'
      if (cursor)
        query = ascending
          ? query.or(
              `${column}.gt.${cursor.value},and(${column}.eq.${cursor.value},id.gt.${cursor.id})`,
            )
          : query.or(
              `${column}.lt.${cursor.value},and(${column}.eq.${cursor.value},id.lt.${cursor.id})`,
            )
      const result = await query
        .order(column, { ascending, nullsFirst: false })
        .order('id', { ascending })
        .limit(input.limit + 1)
      throwKnowledgeError(result.error)
      const rows = z.array(articleRowSchema).parse(result.data)
      const page = rows.slice(0, input.limit)
      const last = page.at(-1)
      response.json(
        customerKnowledgeListResponseSchema.parse({
          data: page.map(mapCustomer),
          nextCursor:
            rows.length > input.limit && last
              ? encodeCursor(
                  last.id,
                  ascending
                    ? last.title
                    : ((column === 'published_at' ? last.published_at : last.updated_at) ??
                        last.updated_at),
                )
              : null,
        }),
      )
    } catch (error) {
      next(error)
    }
  })

  router.get('/knowledge/:articleId', async (request, response, next) => {
    try {
      const { articleId } = knowledgeArticleParameterSchema.parse(request.params)
      const identity = identityFor(request)
      const staff = STAFF_ROLES.has(identity.role)
      const client = clientFor(request)
      const articleResult = await client
        .from('knowledge_base_articles')
        .select(ARTICLE_SELECT)
        .eq('id', articleId)
        .single()
      throwKnowledgeError(articleResult.error)
      const row = articleRowSchema.parse(articleResult.data)
      if (staff) {
        const eventsResult = await client
          .from('knowledge_article_events')
          .select('id,event_type,created_at')
          .eq('article_id', articleId)
          .order('created_at')
          .order('id')
        throwKnowledgeError(eventsResult.error)
        response.json(
          staffKnowledgeDetailResponseSchema.parse({
            attachmentsAvailable: isR2Configured,
            data: {
              ...mapStaff(row),
              body: row.body,
              createdAt: row.created_at,
              events: z
                .array(eventRowSchema)
                .parse(eventsResult.data)
                .map((event) => ({
                  createdAt: event.created_at,
                  eventType: event.event_type,
                  id: event.id,
                })),
            },
          }),
        )
      } else {
        response.json(
          customerKnowledgeDetailResponseSchema.parse({
            attachmentsAvailable: isR2Configured,
            data: { ...mapCustomer(row), body: row.body },
          }),
        )
      }
    } catch (error) {
      next(error)
    }
  })

  router.post('/knowledge', requireBeauRoi, async (request, response, next) => {
    try {
      const input = createKnowledgeArticleSchema.parse(request.body)
      const result = await clientFor(request).rpc('create_knowledge_article', {
        target_article_type: input.articleType,
        target_audience: input.audience,
        target_body: input.body,
        target_category_id: input.categoryId ?? null,
        target_external_url: input.externalUrl ?? null,
        target_organization_id: input.organizationId ?? null,
        target_product_id: input.productId ?? null,
        target_summary: input.summary ?? null,
        target_title: input.title,
      })
      throwKnowledgeError(result.error)
      const id = z.uuid().parse(result.data as unknown)
      response.status(201).json(knowledgeIdentifierResponseSchema.parse({ data: { id } }))
    } catch (error) {
      next(error)
    }
  })
  router.patch('/knowledge/:articleId/content', requireBeauRoi, async (request, response, next) => {
    try {
      const { articleId } = knowledgeArticleParameterSchema.parse(request.params)
      const input = updateKnowledgeContentSchema.parse(request.body)
      const result = await clientFor(request).rpc('update_knowledge_article_content', {
        target_article_id: articleId,
        target_body: input.body,
        target_external_url: input.externalUrl ?? null,
        target_summary: input.summary ?? null,
        target_title: input.title,
      })
      throwKnowledgeError(result.error)
      response.status(204).send()
    } catch (error) {
      next(error)
    }
  })
  router.put('/knowledge/:articleId/scope', requireBeauRoi, async (request, response, next) => {
    try {
      const { articleId } = knowledgeArticleParameterSchema.parse(request.params)
      const input = updateKnowledgeScopeSchema.parse(request.body)
      const result = await clientFor(request).rpc('update_knowledge_article_scope', {
        target_article_id: articleId,
        target_article_type: input.articleType,
        target_audience: input.audience,
        target_category_id: input.categoryId ?? null,
        target_organization_id: input.organizationId ?? null,
        target_product_id: input.productId ?? null,
      })
      throwKnowledgeError(result.error)
      response.status(204).send()
    } catch (error) {
      next(error)
    }
  })
  router.patch('/knowledge/:articleId/status', requireBeauRoi, async (request, response, next) => {
    try {
      const { articleId } = knowledgeArticleParameterSchema.parse(request.params)
      const input = transitionKnowledgeArticleSchema.parse(request.body)
      const result = await clientFor(request).rpc('transition_knowledge_article', {
        target_article_id: articleId,
        target_status: input.status,
      })
      throwKnowledgeError(result.error)
      response.status(204).send()
    } catch (error) {
      next(error)
    }
  })
  router.post('/knowledge/categories', requireBeauRoi, async (request, response, next) => {
    try {
      const input = createKnowledgeCategorySchema.parse(request.body)
      const result = await clientFor(request).rpc('create_knowledge_category', {
        target_code: input.code,
        target_description: input.description ?? null,
        target_name: input.name,
        target_product_id: input.productId ?? null,
        target_sort_order: input.sortOrder,
      })
      throwKnowledgeError(result.error)
      const id = z.uuid().parse(result.data as unknown)
      response.status(201).json(knowledgeIdentifierResponseSchema.parse({ data: { id } }))
    } catch (error) {
      next(error)
    }
  })
  router.patch(
    '/knowledge/categories/:categoryId',
    requireBeauRoi,
    async (request, response, next) => {
      try {
        const { categoryId } = knowledgeCategoryParameterSchema.parse(request.params)
        const input = setKnowledgeCategoryActiveSchema.parse(request.body)
        const result = await clientFor(request).rpc('set_knowledge_category_active', {
          target_active: input.active,
          target_category_id: categoryId,
        })
        throwKnowledgeError(result.error)
        response.status(204).send()
      } catch (error) {
        next(error)
      }
    },
  )
  return router
}

export const knowledgeRouter = createKnowledgeRouter()
