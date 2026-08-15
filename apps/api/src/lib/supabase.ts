import { createClient } from '@supabase/supabase-js'

import { environment, isSupabaseConfigured } from './env.js'
import { AppError } from './errors.js'

export function createCallerClient(accessToken: string | undefined) {
  if (!isSupabaseConfigured || !environment.SUPABASE_URL || !environment.SUPABASE_PUBLISHABLE_KEY) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The data service is not configured.')
  }
  if (!accessToken) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  return createClient(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export function throwDatabaseError(
  error: { code?: string | undefined; message: string } | null,
  message: string,
) {
  if (!error) return
  if (error.code === '23505') throw new AppError(409, 'CONFLICT', message)
  if (error.code === 'PGRST116') throw new AppError(404, 'NOT_FOUND', message)
  throw new AppError(400, 'DATA_OPERATION_FAILED', message)
}
