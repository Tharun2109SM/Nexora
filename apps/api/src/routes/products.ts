import {
  activateCustomerProductSchema,
  createProductSchema,
  productIdentifierResponseSchema,
  productListResponseSchema,
} from '@nexora/contracts'
import { Router } from 'express'
import { z } from 'zod'

import { AppError } from '../lib/errors.js'
import { createCallerClient } from '../lib/supabase.js'
import { requireBeauRoi, requireBeauRoiAdmin } from '../middleware/auth.js'

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
  })
  .strict()

function throwProductError(
  error: { code?: string; message: string } | null,
  conflictMessage = 'A product with this code already exists.',
): asserts error is null {
  if (!error) return
  if (error.code === '42501')
    throw new AppError(403, 'PRODUCT_ADMIN_REQUIRED', 'Product creation is unavailable.')
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
    const result = await createClient(request.accessToken)
      .from('products')
      .select('id,code,name,description,status,created_at')
      .order('name')
    throwProductError(result.error)
    const rows = z.array(productRowSchema).parse(result.data)
    response.json(
      productListResponseSchema.parse({
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
