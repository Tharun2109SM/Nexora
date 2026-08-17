import { createClient } from './supabase/server'

async function exactCount(
  table:
    | 'implementation_projects'
    | 'onboarding_plans'
    | 'onboarding_tasks'
    | 'organizations'
    | 'product_releases'
    | 'support_tickets',
  filters: ReadonlyArray<readonly [string, readonly string[] | string]>,
): Promise<number> {
  const supabase = await createClient()
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  for (const [column, value] of filters)
    query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value)
  const { count, error } = await query
  if (error) throw new Error(`Unable to load ${table} summary`)
  return count ?? 0
}

export async function getBeauRoiOverview() {
  const [customers, onboarding, implementations, tickets] = await Promise.all([
    exactCount('organizations', [['organization_type', 'CUSTOMER']]),
    exactCount('onboarding_plans', [
      ['workflow_status', ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'READY_FOR_GO_LIVE']],
    ]),
    exactCount('implementation_projects', [
      ['workflow_status', ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED']],
    ]),
    exactCount('support_tickets', [['status', 'OPEN']]),
  ])
  return { customers, implementations, onboarding, tickets }
}

export async function getCustomerOverview(organizationId: string) {
  const [tasks, implementations, tickets, releases] = await Promise.all([
    exactCount('onboarding_tasks', [
      ['organization_id', organizationId],
      ['workflow_status', ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED']],
    ]),
    exactCount('implementation_projects', [
      ['organization_id', organizationId],
      ['workflow_status', ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED']],
    ]),
    exactCount('support_tickets', [
      ['organization_id', organizationId],
      ['status', 'OPEN'],
    ]),
    exactCount('product_releases', [['status', 'ACTIVE']]),
  ])
  return { implementations, releases, tasks, tickets }
}
