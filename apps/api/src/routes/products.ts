import {
  activateCustomerProductSchema,
  createProductSchema,
  customerProductStateSchema,
  customerProductsResponseSchema,
  productArchiveSchema,
  productDetailResponseSchema,
  productIdParameterSchema,
  productIdentifierResponseSchema,
  productListQuerySchema,
  productListResponseSchema,
  updateProductSchema,
} from '@nexora/contracts'
import { Router } from 'express'
import { z } from 'zod'

import { AppError } from '../lib/errors.js'
import { createCallerClient } from '../lib/supabase.js'
import {
  requireBeauRoi,
  requireBeauRoiAdmin,
  requireOrganizationAccess,
} from '../middleware/auth.js'

type CallerClient = ReturnType<typeof createCallerClient>
interface ProductRouterDependencies {
  createClient?: (accessToken: string | undefined) => CallerClient
}

const productRowSchema = z
  .object({
    code: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    description: z.string().nullable(),
    id: z.uuid(),
    name: z.string(),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']),
    updated_at: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()

function throwProductError(
  error: { code?: string; message: string } | null,
  conflictMessage = 'A product with this code already exists.',
): asserts error is null {
  if (!error) return
  if (error.code === '42501')
    throw new AppError(403, 'PRODUCT_ADMIN_REQUIRED', 'Beau Roi administrator access is required.')
  if (error.code === 'P0002') throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')
  if (error.code === '23505') throw new AppError(409, 'PRODUCT_CONFLICT', conflictMessage)
  if (error.code === '23514')
    throw new AppError(400, 'PRODUCT_VALIDATION_FAILED', 'Check the product details and try again.')
  throw new AppError(
    400,
    'PRODUCT_OPERATION_FAILED',
    'The product operation could not be completed.',
  )
}

export function createProductsRouter(dependencies: ProductRouterDependencies = {}) {
  const router = Router()
  const createClient = dependencies.createClient ?? createCallerClient

  router.get('/products', requireBeauRoi, async (request, response) => {
    const input = productListQuerySchema.parse(request.query)
    let query = createClient(request.accessToken)
      .from('products')
      .select('id,code,name,description,status,created_at', { count: 'exact' })
      .order('name')
    if (input.search) {
      const search = input.search.replace(/[^\p{L}\p{N} _-]/gu, '')
      if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
    }
    if (input.status) query = query.eq('status', input.status)
    const result = await query.range(input.offset, input.offset + input.limit - 1)
    throwProductError(result.error)
    const rows = z.array(productRowSchema).parse(result.data)
    response.json(
      productListResponseSchema.parse({
        meta: { limit: input.limit, offset: input.offset, total: result.count ?? rows.length },
        data: rows.map((row) => ({
          code: row.code,
          createdAt: row.created_at,
          description: row.description,
          id: row.id,
          name: row.name,
          status: row.status,
        })),
      }),
    )
  })

  router.get('/products/:productId', requireBeauRoi, async (request, response) => {
    const { productId } = productIdParameterSchema.parse(request.params)
    const supabase = createClient(request.accessToken)
    const [productResult, assignmentsResult, onboardingResult, implementationResult] =
      await Promise.all([
        supabase
          .from('products')
          .select('id,code,name,description,status,created_at,updated_at,created_by,updated_by')
          .eq('id', productId)
          .single(),
        supabase
          .from('customer_subscriptions')
          .select(
            'id,organization_id,product_id,status,created_at,organizations(name),products(name,code)',
          )
          .eq('product_id', productId)
          .order('created_at', { ascending: false }),
        supabase
          .from('onboarding_portfolio')
          .select('id,name,organization_name')
          .eq('product_id', productId)
          .limit(25),
        supabase
          .from('implementation_portfolio')
          .select('id,name,organization_name')
          .eq('product_id', productId)
          .limit(25),
      ])
    for (const result of [productResult, assignmentsResult, onboardingResult, implementationResult])
      throwProductError(result.error)
    const product = z
      .object({
        code: z.string(),
        created_at: z.string(),
        created_by: z.uuid().nullable(),
        description: z.string().nullable(),
        id: z.uuid(),
        name: z.string(),
        status: z.string(),
        updated_at: z.string(),
        updated_by: z.uuid().nullable(),
      })
      .parse(productResult.data)
    const actorIds = [
      ...new Set(
        [product.created_by, product.updated_by].filter((id): id is string => id !== null),
      ),
    ]
    const actors = actorIds.length
      ? await supabase.from('profiles').select('id,full_name').in('id', actorIds)
      : { data: [], error: null }
    throwProductError(actors.error)
    const names = new Map(
      z
        .array(z.object({ id: z.uuid(), full_name: z.string() }))
        .parse(actors.data)
        .map((actor) => [actor.id, actor.full_name]),
    )
    const assignments = z
      .array(
        z.object({
          created_at: z.string(),
          id: z.uuid(),
          organization_id: z.uuid(),
          product_id: z.uuid(),
          status: z.string(),
          organizations: z.object({ name: z.string() }),
          products: z.object({ name: z.string(), code: z.string() }),
        }),
      )
      .parse(assignmentsResult.data ?? [])
    const workflowRows = z.array(
      z.object({ id: z.uuid(), name: z.string(), organization_name: z.string() }),
    )
    response.json(
      productDetailResponseSchema.parse({
        data: {
          product: {
            code: product.code,
            createdAt: product.created_at,
            description: product.description,
            id: product.id,
            name: product.name,
            status: product.status,
            updatedAt: product.updated_at,
            updatedByName: product.updated_by ? (names.get(product.updated_by) ?? null) : null,
          },
          createdByName: product.created_by ? (names.get(product.created_by) ?? null) : null,
          assignments: assignments.map((item) => ({
            createdAt: item.created_at,
            id: item.id,
            organizationId: item.organization_id,
            organizationName: item.organizations.name,
            productId: item.product_id,
            productName: item.products.name,
            productCode: item.products.code,
            status: item.status,
          })),
          onboarding: workflowRows.parse(onboardingResult.data ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            organizationName: item.organization_name,
          })),
          implementation: workflowRows.parse(implementationResult.data ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            organizationName: item.organization_name,
          })),
        },
      }),
    )
  })

  router.post('/products', requireBeauRoiAdmin, async (request, response) => {
    const input = createProductSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('create_product', {
      product_code: input.code,
      product_description: input.description,
      product_name: input.name,
    })
    throwProductError(result.error)
    response
      .status(201)
      .json(productIdentifierResponseSchema.parse({ data: { id: z.uuid().parse(result.data) } }))
  })

  router.patch('/products/subscriptions', requireBeauRoiAdmin, async (request, response) => {
    const input = customerProductStateSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('set_customer_product_active', {
      target_organization_id: input.organizationId,
      target_product_id: input.productId,
      make_active: input.active,
    })
    throwProductError(result.error)
    response.json(
      productIdentifierResponseSchema.parse({ data: { id: z.uuid().parse(result.data) } }),
    )
  })

  router.patch('/products/:productId', requireBeauRoiAdmin, async (request, response) => {
    const { productId } = productIdParameterSchema.parse(request.params)
    const input = updateProductSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('update_product', {
      target_product_id: productId,
      product_name: input.name,
      product_description: input.description,
    })
    throwProductError(result.error)
    response.json(
      productIdentifierResponseSchema.parse({ data: { id: z.uuid().parse(result.data) } }),
    )
  })

  router.patch('/products/:productId/archive', requireBeauRoiAdmin, async (request, response) => {
    const { productId } = productIdParameterSchema.parse(request.params)
    const input = productArchiveSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('set_product_archived', {
      target_product_id: productId,
      archive_product: input.archived,
    })
    throwProductError(result.error)
    response.json(
      productIdentifierResponseSchema.parse({ data: { id: z.uuid().parse(result.data) } }),
    )
  })

  router.get(
    '/customers/:organizationId/products',
    requireOrganizationAccess,
    async (request, response) => {
      const organizationId = z.uuid().parse(request.params.organizationId)
      const result = await createClient(request.accessToken)
        .from('customer_subscriptions')
        .select(
          'id,organization_id,product_id,status,created_at,organizations(name),products(name,code)',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      throwProductError(result.error)
      const rows = z
        .array(
          z.object({
            created_at: z.string(),
            id: z.uuid(),
            organization_id: z.uuid(),
            product_id: z.uuid(),
            status: z.string(),
            organizations: z.object({ name: z.string() }),
            products: z.object({ name: z.string(), code: z.string() }),
          }),
        )
        .parse(result.data)
      response.json(
        customerProductsResponseSchema.parse({
          data: rows.map((item) => ({
            createdAt: item.created_at,
            id: item.id,
            organizationId: item.organization_id,
            organizationName: item.organizations.name,
            productId: item.product_id,
            productName: item.products.name,
            productCode: item.products.code,
            status: item.status,
          })),
        }),
      )
    },
  )

  router.post('/products/subscriptions', requireBeauRoiAdmin, async (request, response) => {
    const input = activateCustomerProductSchema.parse(request.body)
    const result = await createClient(request.accessToken).rpc('activate_customer_product', {
      target_organization_id: input.organizationId,
      target_product_id: input.productId,
    })
    throwProductError(result.error, 'This customer already has a record for that product.')
    response
      .status(201)
      .json(productIdentifierResponseSchema.parse({ data: { id: z.uuid().parse(result.data) } }))
  })

  return router
}

export const productsRouter = createProductsRouter()
