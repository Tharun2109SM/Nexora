import type { Metadata } from 'next'
import Link from 'next/link'

import { LoginForm } from '@/components/auth-form'
import { getViewer } from '@/lib/viewer'
import { routeForRole } from '@nexora/contracts'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Sign in' }

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const viewer = await getViewer()
  if (viewer) redirect(routeForRole(viewer.role))
  const query = await searchParams

  return (
    <div className="w-full max-w-md py-2 sm:py-8">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">Welcome back</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em]">
        Sign in to NEXORA
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Use your authorized work account to open the correct workspace.
      </p>
      <LoginForm verificationError={query.error === 'verification'} />
      <p className="mt-7 border-t border-border pt-6 text-center text-sm text-muted">
        New customer organization?{' '}
        <Link className="font-semibold text-accent hover:underline" href="/register">
          Create an account
        </Link>
      </p>
    </div>
  )
}
