import {
  customerMaintenanceListResponseSchema,
  customerReleaseListResponseSchema,
  releaseCurrentVersionsResponseSchema,
} from '@nexora/contracts'
import type { Metadata } from 'next'

import { MaintenancePortfolio, ReleasePortfolio } from '@/components/release-portfolio'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { releaseParams } from '@/lib/release-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Product releases' }
export default async function CustomerReleasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireViewer('customer')
  const values = await searchParams
  const params = releaseParams(values, false)
  const [releaseResult, maintenanceResult, versionsResult] = await Promise.all([
    apiRequest(`/releases?${params}`),
    apiRequest('/maintenance?limit=25'),
    apiRequest('/releases/current-versions'),
  ])
  const releases = customerReleaseListResponseSchema.parse(releaseResult)
  const maintenance = customerMaintenanceListResponseSchema.parse(maintenanceResult)
  const versions = releaseCurrentVersionsResponseSchema.parse(versionsResult).currentVersions
  const next = new URLSearchParams(params)
  if (releases.nextCursor) next.set('cursor', releases.nextCursor)
  return (
    <div className="space-y-8">
      <PageHeader
        description="Review intentionally published product updates and maintenance notices for your active subscriptions."
        eyebrow="Product updates"
        title="Product releases"
      />
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Current versions</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {versions.map((item) => (
            <article
              className="rounded-lg border border-border bg-surface p-4 shadow-card"
              key={item.product.id}
            >
              <p className="text-xs font-semibold text-accent">{item.product.name}</p>
              <p className="mt-2 font-display text-xl font-semibold">
                {item.currentVersion ?? 'Current version unavailable'}
              </p>
              <p className="mt-1 text-xs text-subtle">
                NEXORA does not infer deployed versions from release publication.
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Eligible releases</h2>
          <p className="mt-1 text-sm text-muted">
            Upcoming, published, and archived releases intentionally shared with your organization.
          </p>
        </div>
        <ReleasePortfolio
          filtered={false}
          nextHref={releases.nextCursor ? `?${next}` : null}
          releases={releases.data}
          staff={false}
        />
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Maintenance</h2>
        <MaintenancePortfolio maintenance={maintenance.data} />
      </section>
    </div>
  )
}
