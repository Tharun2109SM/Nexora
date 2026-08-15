import { Menu } from 'lucide-react'
import Link from 'next/link'

import { Brand } from './brand'
import { ThemeToggle } from './theme-toggle'
import { ButtonLink } from './ui'

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-canvas/92 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Brand />
        <nav aria-label="Primary navigation" className="hidden items-center gap-7 md:flex">
          <Link
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            href="/#platform"
          >
            Platform
          </Link>
          <Link
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            href="/#workspaces"
          >
            Workspaces
          </Link>
          <Link
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            href="/#security"
          >
            Security
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <ButtonLink className="max-sm:hidden" href="/login" variant="secondary">
            Sign in
          </ButtonLink>
          <ButtonLink className="max-sm:hidden" href="/register">
            Create organization
          </ButtonLink>
          <Link
            aria-label="Open sign-in page"
            className="grid size-9 place-items-center rounded-md border border-border bg-surface text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:hidden"
            href="/login"
          >
            <Menu aria-hidden size={17} />
          </Link>
        </div>
      </div>
    </header>
  )
}
