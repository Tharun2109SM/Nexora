import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ModulePage } from '@/components/module-page'
import { getModuleCount } from '@/lib/module-data'
import { customerNavigation, sectionTableMap, type ModuleSection } from '@/lib/navigation'
import { requireViewer } from '@/lib/viewer'

interface SectionPageProps {
  params: Promise<{ section: string }>
}

function getItem(section: string) {
  return customerNavigation.find((item) => item.href === `/portal/${section}`)
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params
  return { title: getItem(section)?.label ?? 'Not found' }
}

export default async function CustomerSectionPage({ params }: SectionPageProps) {
  const { section } = await params
  const item = getItem(section)
  if (!item || !(section in sectionTableMap)) notFound()
  const viewer = await requireViewer('customer')
  const count = await getModuleCount(section as ModuleSection, viewer.organizationId)
  return <ModulePage count={count} item={item} portal="customer" />
}
