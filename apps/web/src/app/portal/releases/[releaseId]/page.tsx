import { customerReleaseDetailSchema } from '@nexora/contracts'
import type { Metadata } from 'next'

import { ReleaseWorkspace } from '@/components/release-workspace'
import { apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Release notes' }
export default async function CustomerReleaseDetailPage({
  params,
}: {
  params: Promise<{ releaseId: string }>
}) {
  await requireViewer('customer')
  const { releaseId } = await params
  const result = await apiRequest(`/releases/${releaseId}`)
  const data = customerReleaseDetailSchema.parse((result as { data: unknown }).data)
  return <ReleaseWorkspace data={data} staff={false} />
}
