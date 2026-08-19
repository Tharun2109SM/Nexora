import {
  analyticsOverviewResponseSchema,
  customerSuccessPortfolioResponseSchema,
  knowledgeMetadataResponseSchema,
} from '@nexora/contracts'
import type { Metadata } from 'next'

import { AnalyticsOverview, CustomerSuccessPortfolio } from '@/components/analytics-dashboard'
import { PageHeader, buttonClassName } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Analytics & customer success' }
const value = (input: string | string[] | undefined) =>
  typeof input === 'string' ? input : undefined
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireViewer('beauroi')
  const values = await searchParams
  const window = value(values.window) ?? '30D'
  const organizationId = value(values.organizationId)
  const productId = value(values.productId)
  const search = value(values.search)
  const overviewParams = new URLSearchParams({ window })
  if (organizationId) overviewParams.set('organizationId', organizationId)
  if (productId) overviewParams.set('productId', productId)
  const portfolioParams = new URLSearchParams({ limit: '25' })
  if (productId) portfolioParams.set('productId', productId)
  if (search) portfolioParams.set('search', search)
  if (value(values.afterName) && value(values.afterId)) {
    portfolioParams.set('afterName', value(values.afterName)!)
    portfolioParams.set('afterId', value(values.afterId)!)
  }
  const [overviewResult, portfolioResult, metadataResult] = await Promise.all([
    apiRequest(`/analytics/overview?${overviewParams}`),
    apiRequest(`/analytics/customers?${portfolioParams}`),
    apiRequest('/knowledge/filter-metadata'),
  ])
  const overview = analyticsOverviewResponseSchema.parse(overviewResult).data
  const portfolio = customerSuccessPortfolioResponseSchema.parse(portfolioResult)
  const filters = knowledgeMetadataResponseSchema.parse(metadataResult)
  const next = new URLSearchParams(portfolioParams)
  if (portfolio.next) {
    next.set('afterName', portfolio.next.name)
    next.set('afterId', portfolio.next.id)
  }
  return (
    <div className="space-y-8">
      <PageHeader
        description="Explainable operational signals derived only from secured NEXORA records."
        eyebrow="Customer success"
        title="Analytics & success"
      />
      <form
        className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5"
        method="get"
      >
        <label className="space-y-1 text-xs font-semibold">
          <span>Period</span>
          <select
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
            defaultValue={window}
            name="window"
          >
            {['7D', '30D', '90D', 'ALL'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          <span>Organization</span>
          <select
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
            defaultValue={organizationId}
            name="organizationId"
          >
            <option value="">All customers</option>
            {filters.organizations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          <span>Product</span>
          <select
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
            defaultValue={productId}
            name="productId"
          >
            <option value="">All products</option>
            {filters.products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          <span>Portfolio search</span>
          <input
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
            defaultValue={search}
            name="search"
          />
        </label>
        <button className={buttonClassName()} type="submit">
          Apply filters
        </button>
      </form>
      <p className="text-xs text-subtle">
        Period: {overview.window} · generated {new Date(overview.generatedAt).toLocaleString()}. A
        dash means there are no eligible observations.
      </p>
      <AnalyticsOverview overview={overview} />
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Customer-success portfolio</h2>
          <p className="mt-1 text-sm text-muted">
            Explicit risk and progress signals—no unexplained composite score.
          </p>
        </div>
        <CustomerSuccessPortfolio
          customers={portfolio.data}
          nextHref={portfolio.next ? `?${next}` : null}
        />
      </section>
    </div>
  )
}
