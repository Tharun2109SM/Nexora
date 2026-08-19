import type { AccessTokenVerifier } from '../src/types.js'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/app.js'
import { createAnalyticsRouter } from '../src/routes/analytics.js'
import { createKnowledgeRouter } from '../src/routes/knowledge.js'

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const articleId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const productId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
type Role = 'BEAUROI_ADMIN' | 'BEAUROI_EMPLOYEE' | 'CUSTOMER_ADMIN'
function verifier(role: Role): AccessTokenVerifier {
  return { verify: () => Promise.resolve({ email: 'user@test', organizationId, role, userId }) }
}
const rpc = vi.fn()
const client = { from: vi.fn(), rpc }
function app(role: Role) {
  return createApp(verifier(role), {
    analyticsRouter: createAnalyticsRouter({ createClient: () => client as never }),
    knowledgeRouter: createKnowledgeRouter({ createClient: () => client as never }),
  })
}
describe('knowledge and analytics API boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: articleId, error: null })
  })
  it('routes admin article creation through the narrow RPC', async () => {
    await request(app('BEAUROI_ADMIN'))
      .post('/v1/knowledge')
      .set('authorization', 'Bearer admin')
      .send({
        articleType: 'GUIDE',
        audience: 'PRODUCT_SCOPED',
        body: 'Safe content',
        productId,
        title: 'Product guide',
      })
      .expect(201)
    expect(rpc).toHaveBeenCalledWith(
      'create_knowledge_article',
      expect.objectContaining({ target_audience: 'PRODUCT_SCOPED', target_product_id: productId }),
    )
  })
  it('rejects customer knowledge mutation before PostgreSQL', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .post('/v1/knowledge')
      .set('authorization', 'Bearer customer')
      .send({
        articleType: 'GUIDE',
        audience: 'INTERNAL',
        body: 'Forged content',
        title: 'Forged article',
      })
      .expect(403)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects unsafe external resources before PostgreSQL', async () => {
    await request(app('BEAUROI_ADMIN'))
      .post('/v1/knowledge')
      .set('authorization', 'Bearer admin')
      .send({
        articleType: 'GUIDE',
        audience: 'INTERNAL',
        body: 'Content',
        externalUrl: 'javascript:alert(1)',
        title: 'Unsafe article',
      })
      .expect(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('routes customer summaries without an organization identifier', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        activeTickets: 0,
        generatedAt: '2026-08-19T15:00:00.000Z',
        healthHistory: [],
        implementationActive: 0,
        maintenanceNotices: 0,
        onboardingActive: 0,
        openFeedback: 0,
        pendingActions: 0,
        publishedArticles: 0,
        recentReleases: 0,
        window: '30D',
      },
      error: null,
    })
    await request(app('CUSTOMER_ADMIN'))
      .get('/v1/analytics/customer-summary?window=30D')
      .set('authorization', 'Bearer customer')
      .expect(200)
    expect(rpc).toHaveBeenCalledWith('get_customer_analytics_summary', { target_window: '30D' })
  })
  it('rejects customer portfolio analytics', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .get('/v1/analytics/customers')
      .set('authorization', 'Bearer customer')
      .expect(403)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects invalid analytics windows before PostgreSQL', async () => {
    await request(app('BEAUROI_EMPLOYEE'))
      .get('/v1/analytics/overview?window=1Y')
      .set('authorization', 'Bearer employee')
      .expect(400)
    expect(rpc).not.toHaveBeenCalled()
  })
})
