import { Route } from 'lucide-react'
import type { Metadata } from 'next'

import { ImplementationWorkspace } from '@/components/implementation-workspace'
import { EmptyState } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { customerImplementationResponseSchema } from '@/lib/workflow-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Implementation status' }

export default async function CustomerImplementationPage() {
  const viewer = await requireViewer('customer')
  const result = customerImplementationResponseSchema.parse(
    await apiRequest(`/organizations/${viewer.organizationId}/implementation`),
  )
  if (result.data.length === 0)
    return (
      <EmptyState
        description="No implementation project is available for your organization. Verified phases and milestones will appear after Beau Roi starts the project."
        icon={<Route aria-hidden size={19} />}
        title="Implementation has not started"
      />
    )
  return (
    <div className="space-y-10">
      {result.data.map((project) => (
        <ImplementationWorkspace data={project} editable={false} key={project.id} />
      ))}
    </div>
  )
}
