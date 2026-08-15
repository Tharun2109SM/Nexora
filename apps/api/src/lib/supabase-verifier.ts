import { appRoleSchema } from '@nexora/contracts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { environment, isSupabaseConfigured } from './env.js'
import { AppError } from './errors.js'
import type { AccessTokenVerifier } from '../types.js'

const membershipSchema = z.object({
  organization_id: z.uuid(),
  role: appRoleSchema,
})

export class SupabaseAccessTokenVerifier implements AccessTokenVerifier {
  async verify(token: string) {
    if (
      !isSupabaseConfigured ||
      !environment.SUPABASE_URL ||
      !environment.SUPABASE_PUBLISHABLE_KEY
    ) {
      throw new AppError(
        503,
        'AUTH_NOT_CONFIGURED',
        'Authentication is not configured for this API.',
      )
    }

    const supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    const userId = claimsData?.claims.sub
    const email = claimsData?.claims.email
    if (claimsError || typeof userId !== 'string' || typeof email !== 'string') {
      throw new AppError(401, 'INVALID_TOKEN', 'The access token is invalid or expired.')
    }

    const { data, error } = await supabase
      .from('organization_memberships')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle()

    const membership = membershipSchema.safeParse(data)
    if (error || !membership.success)
      throw new AppError(
        403,
        'NO_ACTIVE_MEMBERSHIP',
        'No active organization membership was found.',
      )

    return {
      email,
      organizationId: membership.data.organization_id,
      role: membership.data.role,
      userId,
    }
  }
}
