import { ShieldX } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { routeForRole } from '@nexora/contracts'

import { buttonClassName } from '@/components/ui'
import { getViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Access denied' }

export default async function UnauthorizedPage() {
  const viewer = await getViewer()
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-lg bg-danger-soft text-danger">
          <ShieldX aria-hidden size={20} />
        </span>
        <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-danger uppercase">
          Access denied
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.035em]">
          This workspace is not assigned to you.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Your authenticated role does not permit access to this portal. No organization data was
          returned.
        </p>
        <Link
          className={`${buttonClassName()} mt-6`}
          href={viewer ? routeForRole(viewer.role) : '/login'}
        >
          {viewer ? 'Open my workspace' : 'Return to sign in'}
        </Link>
      </div>
    </main>
  )
}
