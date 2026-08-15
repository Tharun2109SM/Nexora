import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { acceptInvitation } from '@/app/management-actions'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { buttonClassName } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Accept organization invitation' }

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const token = (await searchParams).token
  const claims = await (await createClient()).auth.getClaims()
  const email = typeof claims.data?.claims.email === 'string' ? claims.data.claims.email : null
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-16">
      <section className="w-full rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
        <span className="grid size-11 place-items-center rounded-lg bg-accent-soft text-accent">
          <CheckCircle2 aria-hidden size={20} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold">Join the organization</h1>
        {!token ? (
          <>
            <p className="mt-3 text-sm leading-6 text-muted">
              This invitation link is incomplete. Ask the organization administrator for a new link.
            </p>
            <Link className={`${buttonClassName('secondary')} mt-6`} href="/">
              Return home
            </Link>
          </>
        ) : !email ? (
          <>
            <p className="mt-3 text-sm leading-6 text-muted">
              Sign in with the exact email address that received this invitation, then open this
              link again.
            </p>
            <Link
              className={`${buttonClassName()} mt-6`}
              href={`/login?next=${encodeURIComponent(`/invitations/accept?token=${token}`)}`}
            >
              Sign in to continue
            </Link>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-muted">
              You are signed in as <strong>{email}</strong>. NEXORA will accept the invitation only
              if this address matches and the link is pending and unexpired.
            </p>
            <form action={acceptInvitation.bind(null, token)} className="mt-6">
              <ConfirmSubmit
                confirmMessage="Accept this organization invitation?"
                label="Accept invitation"
              />
            </form>
          </>
        )}
      </section>
    </main>
  )
}
