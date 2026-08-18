import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { OnboardingWorkspace } from '@/components/onboarding-workspace'
import { apiRequest, ApiRequestError } from '@/lib/api'
import { onboardingDetailSchema, workflowOptionsSchema } from '@/lib/workflow-data'

export const metadata: Metadata = { title: 'Onboarding workspace' }

export default async function OnboardingDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  let detail: unknown
  let options: unknown
  try {
    ;[detail, options] = await Promise.all([
      apiRequest(`/onboarding/${planId}`),
      apiRequest('/workflow-options'),
    ])
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') notFound()
    throw error
  }
  return (
    <OnboardingWorkspace
      data={onboardingDetailSchema.parse(detail).data}
      editable
      options={workflowOptionsSchema.parse(options).data}
    />
  )
}
