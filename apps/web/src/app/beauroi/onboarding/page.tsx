import type { Metadata } from 'next'

import { createOnboardingPlan } from '@/app/workflow-actions'
import { WorkflowFilters } from '@/components/workflow-filters'
import { WorkflowPortfolio } from '@/components/workflow-portfolio'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { portfolioResponseSchema, workflowOptionsSchema } from '@/lib/workflow-data'

export const metadata: Metadata = { title: 'Product onboarding' }

export default async function OnboardingPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const values = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values))
    if (typeof value === 'string') params.set(key, value)
  const [result, optionsResult] = await Promise.all([
    apiRequest(`/onboarding?${params.toString()}`),
    apiRequest('/workflow-options'),
  ])
  const portfolio = portfolioResponseSchema.parse(result)
  const options = workflowOptionsSchema.parse(optionsResult).data
  const nextParams = new URLSearchParams(params)
  if (portfolio.meta.nextCursor) nextParams.set('cursor', portfolio.meta.nextCursor)
  return (
    <div className="space-y-7">
      <PageHeader
        description="Coordinate customer readiness, training, requested documents, and go-live from one governed workspace."
        eyebrow="Product operations"
        title="Onboarding"
      />
      <WorkflowFilters kind="onboarding" options={options} />
      <WorkflowPortfolio
        action={createOnboardingPlan}
        kind="onboarding"
        nextHref={portfolio.meta.nextCursor ? `?${nextParams.toString()}` : null}
        options={options}
        rows={portfolio.data}
      />
    </div>
  )
}
