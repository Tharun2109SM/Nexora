import { MailCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonClassName } from '@/components/ui'

export const metadata: Metadata = { title: 'Verify your email' }

export default function CheckEmailPage() {
  return (
    <div className="w-full max-w-md py-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-lg border border-border bg-surface text-accent shadow-card">
        <MailCheck aria-hidden size={22} />
      </span>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-[-0.035em]">
        Check your work email
      </h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        If the registration details were accepted, Supabase has sent a secure verification link.
        Open it in the same browser to continue.
      </p>
      <Link className={`${buttonClassName('secondary')} mt-7`} href="/login">
        Return to sign in
      </Link>
    </div>
  )
}
