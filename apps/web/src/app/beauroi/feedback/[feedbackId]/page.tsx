import { staffFeedbackDetailSchema } from '@nexora/contracts'
import type { Metadata } from 'next'

import { FeedbackWorkspace } from '@/components/feedback-workspace'
import { apiRequest } from '@/lib/api'

export const metadata: Metadata = { title: 'Feedback detail' }
export default async function StaffFeedbackDetailPage({
  params,
}: {
  params: Promise<{ feedbackId: string }>
}) {
  const { feedbackId } = await params
  const response = staffFeedbackDetailSchema.parse(
    ((await apiRequest(`/feedback/${feedbackId}`)) as { data: unknown }).data,
  )
  return <FeedbackWorkspace data={response} staff />
}
