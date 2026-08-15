import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ModulePage } from '@/components/module-page'
import { getModuleCount } from '@/lib/module-data'
import { beauroiNavigation, sectionTableMap, type ModuleSection } from '@/lib/navigation'

interface SectionPageProps {
  params: Promise<{ section: string }>
}

function getItem(section: string) {
  return beauroiNavigation.find((item) => item.href === `/beauroi/${section}`)
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params
  return { title: getItem(section)?.label ?? 'Not found' }
}

export default async function BeauRoiSectionPage({ params }: SectionPageProps) {
  const { section } = await params
  const item = getItem(section)
  if (!item || !(section in sectionTableMap)) notFound()
  const count = await getModuleCount(section as ModuleSection)
  return <ModulePage count={count} item={item} portal="beauroi" />
}
