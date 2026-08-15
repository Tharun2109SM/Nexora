import type { Metadata } from 'next'
import Link from 'next/link'

import { RegisterForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Create organization' }

export default function RegisterPage() {
  return (
    <div className="w-full max-w-2xl pb-10">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
        Customer registration
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em]">
        Create your organization
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        This creates a customer workspace and makes you its first administrator. Beau Roi employee
        accounts are provisioned separately.
      </p>
      <RegisterForm />
      <p className="mt-7 border-t border-border pt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link className="font-semibold text-accent hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  )
}
