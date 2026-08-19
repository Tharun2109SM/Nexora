import { supportNotificationsResponseSchema } from '@nexora/contracts'

import { AppShell } from '@/components/app-shell'
import { apiRequest } from '@/lib/api'
import { beauroiNavigation } from '@/lib/navigation'
import { requireViewer } from '@/lib/viewer'

export const dynamic = 'force-dynamic'

export default async function BeauRoiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer('beauroi')
  const notifications = supportNotificationsResponseSchema.parse(
    await apiRequest('/support/notifications'),
  ).data
  return (
    <AppShell
      navigation={beauroiNavigation}
      notifications={notifications}
      portalLabel="Beau Roi portal"
      viewer={viewer}
    >
      {children}
    </AppShell>
  )
}
