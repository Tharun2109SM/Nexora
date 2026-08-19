import {
  maintenanceListResponseSchema,
  releaseFilterMetadataResponseSchema,
  releaseListResponseSchema,
} from '@nexora/contracts'
import type { Metadata } from 'next'

import { ReleaseFilters } from '@/components/release-filters'
import { ReleaseCreationForms } from '@/components/release-forms'
import { MaintenancePortfolio, ReleasePortfolio } from '@/components/release-portfolio'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { maintenanceParams, releaseParams } from '@/lib/release-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Release management' }
export default async function StaffReleasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireViewer('beauroi')
  const values = await searchParams
  const params = releaseParams(values, true)
  const maintenanceQuery = maintenanceParams(values)
  const [releaseResult, maintenanceResult, metadataResult] = await Promise.all([
    apiRequest(`/releases/queue?${params}`),
    apiRequest(`/maintenance/queue?${maintenanceQuery}`),
    apiRequest('/releases/filter-metadata'),
  ])
  const releases = releaseListResponseSchema.parse(releaseResult)
  const maintenance = maintenanceListResponseSchema.parse(maintenanceResult)
  const filters = releaseFilterMetadataResponseSchema.parse(metadataResult).data
  const next = new URLSearchParams(params)
  if (releases.nextCursor) next.set('cursor', releases.nextCursor)
  const filtered = [...params.keys()].some((key) => !['cursor', 'limit', 'sort'].includes(key))
  const admin = viewer.role === 'BEAUROI_ADMIN'
  return (
    <div className="space-y-8">
      <PageHeader
        description="Create, schedule, publish, and audit product releases and maintenance communications for eligible customers."
        eyebrow="Product operations"
        title="Release management"
      />
      {admin ? (
        <ReleaseCreationForms products={filters.products} />
      ) : (
        <section className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
          <p className="font-semibold">Read-only release portfolio</p>
          <p className="mt-1 text-muted">
            Drafting and publication require a Beau Roi administrator.
          </p>
        </section>
      )}
      <ReleaseFilters products={filters.products} staff />
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Release portfolio</h2>
        <ReleasePortfolio
          filtered={filtered}
          nextHref={releases.nextCursor ? `?${next}` : null}
          releases={releases.data}
          staff
        />
      </section>
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Maintenance notices</h2>
          <p className="mt-1 text-sm text-muted">
            Scheduled and historical product maintenance communication.
          </p>
        </div>
        <MaintenancePortfolio
          canManage={admin}
          maintenance={maintenance.data}
          organizations={filters.organizations}
          staff
        />
      </section>
    </div>
  )
}
