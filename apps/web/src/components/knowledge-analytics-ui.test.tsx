import {
  analyticsOverviewSchema,
  customerKnowledgeArticleSchema,
  customerSuccessPortfolioItemSchema,
} from '@nexora/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AnalyticsOverview, CustomerSuccessPortfolio } from './analytics-dashboard'
import { AttachmentState, KnowledgeArticleDocument, KnowledgePortfolio } from './knowledge-ui'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const timestamp = '2026-08-19T15:00:00.000Z'
describe('knowledge and analytics UI', () => {
  it('renders customer documentation without staff metadata', () => {
    const article = customerKnowledgeArticleSchema.parse({
      articleType: 'GUIDE',
      body: 'Safe plain-text guidance',
      category: null,
      externalUrl: null,
      id,
      product: null,
      publishedAt: timestamp,
      slug: 'safe-guide',
      summary: 'Summary',
      title: 'Safe guide',
      updatedAt: timestamp,
    })
    const html = renderToStaticMarkup(<KnowledgeArticleDocument article={article} />)
    expect(html).toContain('Safe plain-text guidance')
    expect(html).not.toContain('authorUserId')
    expect(html).not.toContain('audience')
    expect(html).not.toContain('objectKey')
  })
  it('renders an honest empty knowledge state and unavailable attachment state', () => {
    expect(
      renderToStaticMarkup(<KnowledgePortfolio articles={[]} customer nextHref={null} />),
    ).toContain('No knowledge articles')
    const html = renderToStaticMarkup(<AttachmentState available={false} />)
    expect(html).toContain('Attachments unavailable')
    expect(html).not.toContain('type="file"')
  })
  it('renders zero analytics without NaN or Infinity', () => {
    const overview = analyticsOverviewSchema.parse({
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
    })
    const html = renderToStaticMarkup(<AnalyticsOverview overview={overview} />)
    expect(html).toContain('No data yet')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
  })
  it('links customer-success signals to the canonical customer detail', () => {
    const customer = customerSuccessPortfolioItemSchema.parse({
      activeTickets: 2,
      csmName: null,
      healthCalculatedAt: null,
      healthScore: null,
      id,
      implementationActive: 0,
      lifecycleStatus: 'ACTIVE',
      name: 'Customer A',
      onboardingActive: 1,
      onboardingOverdue: true,
      openFeedback: 0,
      slaBreaches: 1,
      urgentTickets: 1,
    })
    const html = renderToStaticMarkup(
      <CustomerSuccessPortfolio customers={[customer]} nextHref={null} />,
    )
    expect(html).toContain(`/beauroi/customers/${id}`)
    expect(html).toContain('Onboarding overdue')
    expect(html).not.toContain('risk score')
  })
})
