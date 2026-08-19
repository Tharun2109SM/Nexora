import { supportNotificationsResponseSchema } from '@nexora/contracts'

import { AppShell } from '@/components/app-shell'
import { apiRequest } from '@/lib/api'
import { customerNavigation } from '@/lib/navigation'
import { requireViewer } from '@/lib/viewer'

export const dynamic = 'force-dynamic'

export default async function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer('customer')
  const notifications = supportNotificationsResponseSchema.parse(
    await apiRequest('/support/notifications'),
  ).data
  return (
    <AppShell
      navigation={customerNavigation}
      notifications={notifications}
      portalLabel="Customer portal"
      viewer={viewer}
    >
      {children}
    </AppShell>
  )
}
