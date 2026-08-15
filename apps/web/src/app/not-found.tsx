import { FileQuestion } from 'lucide-react'
import Link from 'next/link'

import { buttonClassName } from '@/components/ui'

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-lg border border-border bg-surface text-muted shadow-card">
          <FileQuestion aria-hidden size={20} />
        </span>
        <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-accent uppercase">
          404 · Not found
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.035em]">
          This page is not available.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The address may be incorrect, or the resource may have moved.
        </p>
        <Link className={`${buttonClassName('secondary')} mt-6`} href="/">
          Return to NEXORA
        </Link>
      </div>
    </main>
  )
}
