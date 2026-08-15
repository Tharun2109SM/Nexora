import { Building2, ClipboardCheck, Headphones, Rocket } from 'lucide-react'
import type { Metadata } from 'next'

import { DashboardOverview } from '@/components/dashboard-overview'
import { getBeauRoiOverview } from '@/lib/dashboard-data'

export const metadata: Metadata = { title: 'Beau Roi overview' }

export default async function BeauRoiOverviewPage() {
  const summary = await getBeauRoiOverview()
  return (
    <DashboardOverview
      firstActionHref="/beauroi/customers"
      firstActionLabel="Open customer management"
      metrics={[
        {
          description: 'Active customer organizations',
          icon: Building2,
          label: 'Customers',
          value: summary.customers,
        },
        {
          description: 'Active onboarding plans',
          icon: ClipboardCheck,
          label: 'Onboarding',
          value: summary.onboarding,
        },
        {
          description: 'Implementations currently active',
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
      ]}
      portal="beauroi"
      title="Customer operations overview"
    />
  )
}
