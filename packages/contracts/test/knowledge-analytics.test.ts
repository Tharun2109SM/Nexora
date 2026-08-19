import { describe, expect, it } from 'vitest'

import {
  analyticsOverviewResponseSchema,
  createKnowledgeArticleSchema,
  customerKnowledgeArticleSchema,
  customerSuccessPortfolioQuerySchema,
  staffKnowledgeArticleDetailSchema,
  staffKnowledgeListQuerySchema,
} from '../src/index.js'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const timestamp = '2026-08-19T15:00:00.000Z'
const customerArticle = {
  articleType: 'GUIDE',
  body: 'Customer-safe content',
  category: null,
  externalUrl: 'https://example.com/guide',
  id,
  product: { code: 'NEXORA', id, name: 'NEXORA' },
  publishedAt: timestamp,
  slug: 'safe-guide',
  summary: 'Summary',
  title: 'Safe guide',
  updatedAt: timestamp,
}
describe('knowledge and analytics contracts', () => {
  it('rejects ownership and internal-author fields from customer article responses', () => {
    expect(customerKnowledgeArticleSchema.safeParse(customerArticle).success).toBe(true)
    expect(
      customerKnowledgeArticleSchema.safeParse({ ...customerArticle, authorUserId: id }).success,
    ).toBe(false)
  })
  it('allows staff-only lifecycle and history only in the staff contract', () => {
    expect(
      staffKnowledgeArticleDetailSchema.safeParse({
        ...customerArticle,
        articleStatus: 'PUBLISHED',
        audience: 'PRODUCT_SCOPED',
        createdAt: timestamp,
        events: [{ createdAt: timestamp, eventType: 'PUBLISHED', id }],
        organization: null,
      }).success,
    ).toBe(true)
  })
  it('requires safe audience scope and HTTP resources', () => {
    const base = {
      articleType: 'GUIDE',
      audience: 'PRODUCT_SCOPED',
      body: 'Content',
      title: 'Article title',
    }
    expect(createKnowledgeArticleSchema.safeParse(base).success).toBe(false)
    expect(
      createKnowledgeArticleSchema.safeParse({
        ...base,
        externalUrl: 'javascript:alert(1)',
        productId: id,
      }).success,
    ).toBe(false)
  })
  it('keeps customer lifecycle filters out of customer contracts', () => {
    expect(staffKnowledgeListQuerySchema.safeParse({ status: 'IN_REVIEW' }).success).toBe(true)
  })
  it('requires complete deterministic portfolio cursors', () => {
    expect(customerSuccessPortfolioQuerySchema.safeParse({ afterName: 'Acme' }).success).toBe(false)
    expect(
      customerSuccessPortfolioQuerySchema.safeParse({ afterId: id, afterName: 'Acme' }).success,
    ).toBe(true)
  })
  it('accepts null averages and rejects non-finite fabricated analytics', () => {
    const response = {
      data: {
        customers: { active: 0, lifecycle: {} },
        delivery: {
          articleTypes: {},
          maintenance: 0,
          publishedArticles: 0,
          publishedReleases: 0,
          scheduledReleases: 0,
        },
        feedback: { publishedFeatures: 0, statuses: {}, total: 0, types: {}, votes: 0 },
        generatedAt: timestamp,
        implementation: { active: 0, completed: 0, overdueMilestones: 0 },
        onboarding: { active: 0, completed: 0, eligible: 0, overduePlans: 0, overdueTasks: 0 },
        support: {
          active: 0,
          averageFirstResponseMinutes: null,
          averageResolutionMinutes: null,
          breached: 0,
          firstResponseEligible: 0,
          firstResponseMet: 0,
          priorities: {},
          resolutionEligible: 0,
          resolutionMet: 0,
          statuses: {},
        },
        window: '30D',
      },
    }
    expect(analyticsOverviewResponseSchema.safeParse(response).success).toBe(true)
    expect(
      analyticsOverviewResponseSchema.safeParse({
        ...response,
        data: {
          ...response.data,
          support: { ...response.data.support, averageResolutionMinutes: Number.NaN },
        },
      }).success,
    ).toBe(false)
  })
})
