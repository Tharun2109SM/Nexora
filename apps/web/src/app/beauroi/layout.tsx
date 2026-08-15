import { AppShell } from '@/components/app-shell'
import { beauroiNavigation } from '@/lib/navigation'
import { requireViewer } from '@/lib/viewer'

export const dynamic = 'force-dynamic'

export default async function BeauRoiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer('beauroi')
  return (
    <AppShell navigation={beauroiNavigation} portalLabel="Beau Roi portal" viewer={viewer}>
      {children}
    </AppShell>
  )
}
