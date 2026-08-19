import { customerFeedbackDetailSchema } from '@nexora/contracts'
import type { Metadata } from 'next'

import { FeedbackWorkspace } from '@/components/feedback-workspace'
import { apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Feedback detail' }
export default async function CustomerFeedbackDetailPage({
  params,
}: {
  params: Promise<{ feedbackId: string }>
}) {
  await requireViewer('customer')
  const { feedbackId } = await params
  const response = customerFeedbackDetailSchema.parse(
    ((await apiRequest(`/feedback/${feedbackId}`)) as { data: unknown }).data,
  )
  return <FeedbackWorkspace data={response} staff={false} />
}
