import { AppShell } from '@/components/app-shell'
import { customerNavigation } from '@/lib/navigation'
import { requireViewer } from '@/lib/viewer'

export const dynamic = 'force-dynamic'

export default async function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer('customer')
  return (
    <AppShell navigation={customerNavigation} portalLabel="Customer portal" viewer={viewer}>
      {children}
    </AppShell>
  )
}
