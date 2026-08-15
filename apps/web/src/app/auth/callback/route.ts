import { NextResponse } from 'next/server'

import { isSupabaseConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/viewer'
import { routeForRole } from '@nexora/contracts'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code || !isSupabaseConfigured) {
    return NextResponse.redirect(new URL('/login?error=verification', requestUrl.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/login?error=verification', requestUrl.origin))

  const viewer = await getViewer()
  return NextResponse.redirect(
    new URL(viewer ? routeForRole(viewer.role) : '/login', requestUrl.origin),
  )
}
