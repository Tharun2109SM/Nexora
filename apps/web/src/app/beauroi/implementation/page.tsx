import type { Metadata } from 'next'

import { createImplementationProject } from '@/app/workflow-actions'
import { WorkflowFilters } from '@/components/workflow-filters'
import { WorkflowPortfolio } from '@/components/workflow-portfolio'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { portfolioResponseSchema, workflowOptionsSchema } from '@/lib/workflow-data'

export const metadata: Metadata = { title: 'Product implementation' }

export default async function ImplementationPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const values = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values))
    if (typeof value === 'string') params.set(key, value)
  const [result, optionsResult] = await Promise.all([
    apiRequest(`/implementations?${params.toString()}`),
    apiRequest('/workflow-options'),
  ])
  const portfolio = portfolioResponseSchema.parse(result)
  const options = workflowOptionsSchema.parse(optionsResult).data
  const nextParams = new URLSearchParams(params)
  if (portfolio.meta.nextCursor) nextParams.set('cursor', portfolio.meta.nextCursor)
  return (
    <div className="space-y-7">
      <PageHeader
        description="Manage requirements, phases, milestones, delivery risk, and customer-visible implementation updates."
        eyebrow="Product operations"
        title="Implementation"
      />
      <WorkflowFilters kind="implementation" options={options} />
      <WorkflowPortfolio
        action={createImplementationProject}
        kind="implementation"
        nextHref={portfolio.meta.nextCursor ? `?${nextParams.toString()}` : null}
        options={options}
        rows={portfolio.data}
      />
    </div>
  )
}
