import {
  BEAUROI_ROLES,
  CUSTOMER_ROLES,
  analyticsOverviewQuerySchema,
  analyticsOverviewResponseSchema,
  analyticsWindowSchema,
  customerAnalyticsSummaryResponseSchema,
  customerSuccessPortfolioQuerySchema,
  customerSuccessPortfolioResponseSchema,
  type AppRole,
} from '@nexora/contracts'
import { Router, type Request } from 'express'

import { AppError } from '../lib/errors.js'
import { createCallerClient } from '../lib/supabase.js'
import { requireBeauRoi } from '../middleware/auth.js'

type CallerClient = ReturnType<typeof createCallerClient>
interface AnalyticsRouterDependencies {
  createClient?: (accessToken: string | undefined) => CallerClient
}
const STAFF_ROLES = new Set<AppRole>(BEAUROI_ROLES)
const CUSTOMER_ROLE_SET = new Set<AppRole>(CUSTOMER_ROLES)
function identityFor(request: Request) {
  if (!request.identity) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  return request.identity
}
function throwAnalyticsError(
  error: { code?: string; message: string } | null,
): asserts error is null {
  if (!error) return
  if (error.code === '42501')
    throw new AppError(403, 'ANALYTICS_ACCESS_DENIED', 'Analytics access is unavailable.')
  if (error.code === '22023')
    throw new AppError(400, 'INVALID_ANALYTICS_FILTER', 'The analytics filter is invalid.')
  throw new AppError(400, 'ANALYTICS_OPERATION_FAILED', 'Analytics are temporarily unavailable.')
}
export function createAnalyticsRouter(dependencies: AnalyticsRouterDependencies = {}) {
  const router = Router()
  const clientFor = (request: Request) =>
    (dependencies.createClient ?? createCallerClient)(request.accessToken)
  router.get('/analytics/overview', requireBeauRoi, async (request, response, next) => {
    try {
      const input = analyticsOverviewQuerySchema.parse(request.query)
      const result = await clientFor(request).rpc('get_staff_analytics', {
        target_organization_id: input.organizationId ?? null,
        target_product_id: input.productId ?? null,
        target_window: input.window,
      })
      throwAnalyticsError(result.error)
      response.json(analyticsOverviewResponseSchema.parse({ data: result.data as unknown }))
    } catch (error) {
      next(error)
    }
  })
  router.get('/analytics/customers', requireBeauRoi, async (request, response, next) => {
    try {
      const input = customerSuccessPortfolioQuerySchema.parse(request.query)
      const result = await clientFor(request).rpc('get_customer_success_portfolio', {
        target_after_id: input.afterId ?? null,
        target_after_name: input.afterName ?? null,
        target_limit: input.limit,
        target_product_id: input.productId ?? null,
        target_search: input.search ?? null,
      })
      throwAnalyticsError(result.error)
      response.json(customerSuccessPortfolioResponseSchema.parse(result.data as unknown))
    } catch (error) {
      next(error)
    }
  })
  router.get('/analytics/customer-summary', async (request, response, next) => {
    try {
      const identity = identityFor(request)
      if (!CUSTOMER_ROLE_SET.has(identity.role) || STAFF_ROLES.has(identity.role))
        throw new AppError(403, 'CUSTOMER_ACCESS_REQUIRED', 'Customer access is required.')
      const window = analyticsWindowSchema.parse(request.query.window ?? '30D')
      const result = await clientFor(request).rpc('get_customer_analytics_summary', {
        target_window: window,
      })
      throwAnalyticsError(result.error)
      response.json(customerAnalyticsSummaryResponseSchema.parse({ data: result.data as unknown }))
    } catch (error) {
      next(error)
    }
  })
  return router
}
export const analyticsRouter = createAnalyticsRouter()
