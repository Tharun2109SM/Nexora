import Link from 'next/link'

import { Brand } from './brand'

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div>
          <Brand />
          <p className="mt-3 text-xs text-subtle">
            A Beau Roi Technologies Private Limited platform.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted"
        >
          <Link className="hover:text-foreground" href="/login">
            Sign in
          </Link>
          <Link className="hover:text-foreground" href="/register">
            Create organization
          </Link>
          <Link className="hover:text-foreground" href="/terms">
            Terms
          </Link>
          <Link className="hover:text-foreground" href="/privacy">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
