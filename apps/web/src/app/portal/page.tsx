import { ClipboardCheck, Headphones, PackageOpen, Rocket } from 'lucide-react'
import { customerAnalyticsSummaryResponseSchema } from '@nexora/contracts'
import type { Metadata } from 'next'

import { DashboardOverview } from '@/components/dashboard-overview'
import { CustomerAnalyticsSummary } from '@/components/analytics-dashboard'
import { apiRequest } from '@/lib/api'
import { getCustomerOverview } from '@/lib/dashboard-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Customer dashboard' }

export default async function CustomerDashboardPage() {
  const viewer = await requireViewer('customer')
  const summary = await getCustomerOverview(viewer.organizationId)
  const analytics = customerAnalyticsSummaryResponseSchema.parse(
    await apiRequest('/analytics/customer-summary?window=30D'),
  ).data
  return (
    <div className="space-y-8">
      <DashboardOverview
        firstActionHref="/portal/onboarding"
        firstActionLabel="Review my onboarding"
        metrics={[
          {
            description: 'Onboarding actions assigned or open',
            icon: ClipboardCheck,
            label: 'My actions',
            value: summary.tasks,
          },
          {
            description: 'Implementation projects underway',
            icon: Rocket,
            label: 'Implementation',
            value: summary.implementations,
          },
          {
            description: 'Support tickets awaiting work',
            icon: Headphones,
            label: 'Open tickets',
            value: summary.tickets,
          },
          {
            description: 'Published product updates',
            icon: PackageOpen,
            label: 'Releases',
            value: summary.releases,
          },
        ]}
        portal="customer"
        title={`Welcome, ${viewer.fullName.split(' ')[0] ?? viewer.fullName}`}
      />
      <CustomerAnalyticsSummary summary={analytics} />
    </div>
  )
}
