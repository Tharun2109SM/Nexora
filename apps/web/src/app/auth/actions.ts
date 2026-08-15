'use server'

import { loginSchema, registrationSchema, routeForRole } from '@nexora/contracts'
import { redirect } from 'next/navigation'

import { getPublicEnvironment, isSupabaseConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/viewer'

export interface AuthActionState {
  error?: string
  fieldErrors?: Record<string, string[]>
}

const configurationMessage =
  'Authentication is not connected yet. Add the Supabase public environment values and restart the application.'

function valuesFromFormData(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()].filter(([, value]) => typeof value === 'string'),
  )
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(valuesFromFormData(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  if (!isSupabaseConfigured) return { error: configurationMessage }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: 'Email or password is incorrect. Please try again.' }

  const viewer = await getViewer()
  if (!viewer) {
    await supabase.auth.signOut()
    return {
      error: 'Your account does not have an active NEXORA membership. Contact an administrator.',
    }
  }

  redirect(routeForRole(viewer.role))
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registrationSchema.safeParse(valuesFromFormData(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  if (!isSupabaseConfigured) return { error: configurationMessage }

  const logo = formData.get('companyLogo')
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024)
      return { fieldErrors: { companyLogo: ['Use an image under 2 MB'] } }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(logo.type)) {
      return { fieldErrors: { companyLogo: ['Use a PNG, JPG, WebP, or SVG image'] } }
    }
    return {
      fieldErrors: {
        companyLogo: [
          'Logo upload will be enabled when Cloudflare R2 is connected. Continue without a logo and add it later in Organization settings.',
        ],
      },
    }
  }

  const environment = getPublicEnvironment()
  const supabase = await createClient()
  const input = parsed.data
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${environment.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: {
        company_name: input.companyName,
        company_size: input.companySize,
        company_website: input.companyWebsite || null,
        country: input.country,
        designation: input.designation,
        full_name: input.fullName,
        industry: input.industry,
        phone: input.phone,
      },
    },
  })

  if (error) {
    return {
      error:
        'We could not create the organization. Check your details or try signing in if you already have an account.',
    }
  }

  if (data.session) redirect('/portal')
  redirect('/register/check-email')
}

export async function signOutAction() {
  if (isSupabaseConfigured) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect('/login')
}
