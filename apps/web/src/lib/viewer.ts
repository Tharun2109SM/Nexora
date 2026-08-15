import { appRoleSchema, canAccessPortal, type Portal } from '@nexora/contracts'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { z } from 'zod'

import { isSupabaseConfigured } from './env'
import { createClient } from './supabase/server'

const membershipSchema = z.object({
  organization_id: z.string().uuid(),
  role: appRoleSchema,
  organizations: z
    .object({
      name: z.string(),
    })
    .nullable(),
})

const profileSchema = z.object({ full_name: z.string() })

export interface Viewer {
  email: string
  fullName: string
  organizationId: string
  organizationName: string
  role: z.infer<typeof appRoleSchema>
  userId: string
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured) return null

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub
  const email = claimsData?.claims.email

  if (claimsError || typeof userId !== 'string' || typeof email !== 'string') return null

  const [membershipResult, profileResult] = await Promise.all([
    supabase
      .from('organization_memberships')
      .select('organization_id, role, organizations(name)')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
  ])

  const membership = membershipSchema.safeParse(membershipResult.data)
  const profile = profileSchema.safeParse(profileResult.data)
  if (membershipResult.error || !membership.success || !profile.success) return null

  return {
    email,
    fullName: profile.data.full_name,
    organizationId: membership.data.organization_id,
    organizationName: membership.data.organizations?.name ?? 'Organization',
    role: membership.data.role,
    userId,
  }
})

export async function requireViewer(portal: Portal): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/login?next=${portal === 'beauroi' ? '/beauroi' : '/portal'}`)
  if (!canAccessPortal(viewer.role, portal)) redirect('/unauthorized')
  return viewer
}
