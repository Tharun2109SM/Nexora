import type { ModuleSection } from './navigation'
import { sectionTableMap } from './navigation'
import { createClient } from './supabase/server'

export async function getModuleCount(
  section: ModuleSection,
  organizationId?: string,
): Promise<number> {
  const supabase = await createClient()
  const table = sectionTableMap[section]
  let query = supabase.from(table).select('*', { count: 'exact', head: true })

  if (section === 'customers') query = query.eq('organization_type', 'CUSTOMER')
  if (organizationId && !['customers', 'settings'].includes(section)) {
    query = query.eq('organization_id', organizationId)
  }
  if (section === 'settings')
    query = query.eq('id', (await supabase.auth.getClaims()).data?.claims.sub ?? '')

  const { count, error } = await query
  if (error) throw new Error(`Unable to load ${section} summary`)
  return count ?? 0
}
