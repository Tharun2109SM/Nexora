import { ClipboardCheck } from 'lucide-react'
import type { Metadata } from 'next'

import { OnboardingWorkspace } from '@/components/onboarding-workspace'
import { EmptyState } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { customerOnboardingResponseSchema } from '@/lib/workflow-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'My onboarding' }

export default async function CustomerOnboardingPage() {
  const viewer = await requireViewer('customer')
  const result = customerOnboardingResponseSchema.parse(
    await apiRequest(`/organizations/${viewer.organizationId}/onboarding`),
  )
  if (result.data.length === 0)
    return (
      <EmptyState
        description="Your organization does not have an onboarding plan yet. When Beau Roi creates one, its verified checklist and schedule will appear here."
        icon={<ClipboardCheck aria-hidden size={19} />}
        title="Onboarding has not started"
      />
    )
  return (
    <div className="space-y-10">
      {result.data.map((plan) => (
        <OnboardingWorkspace data={plan} editable={false} key={plan.id} />
      ))}
    </div>
  )
}
