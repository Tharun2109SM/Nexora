import { releaseFilterMetadataResponseSchema, staffReleaseDetailSchema } from '@nexora/contracts'
import type { Metadata } from 'next'

import { ReleaseWorkspace } from '@/components/release-workspace'
import { apiRequest } from '@/lib/api'

export const metadata: Metadata = { title: 'Release detail' }
export default async function StaffReleaseDetailPage({
  params,
}: {
  params: Promise<{ releaseId: string }>
}) {
  const { releaseId } = await params
  const [detailResult, metadataResult] = await Promise.all([
    apiRequest(`/releases/${releaseId}`),
    apiRequest('/releases/filter-metadata'),
  ])
  const data = staffReleaseDetailSchema.parse((detailResult as { data: unknown }).data)
  const metadata = releaseFilterMetadataResponseSchema.parse(metadataResult).data
  return (
    <ReleaseWorkspace
      data={data}
      featureRequests={metadata.featureRequests}
      organizations={metadata.organizations}
      staff
    />
  )
}
