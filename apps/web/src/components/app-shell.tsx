'use client'

import { ChevronRight, LogOut, Menu, PanelLeftClose, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { signOutAction } from '@/app/auth/actions'
import type { NavigationItem } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import type { Viewer } from '@/lib/viewer'

import { Brand } from './brand'
import { NavigationIcon } from './navigation-icon'
import { ThemeToggle } from './theme-toggle'

interface AppShellProps {
  children: React.ReactNode
  navigation: readonly NavigationItem[]
  portalLabel: string
  viewer: Viewer
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function roleLabel(role: Viewer['role']): string {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

export function AppShell({ children, navigation, portalLabel, viewer }: AppShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopCompact, setDesktopCompact] = useState(false)

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-white/9 px-4">
        <Brand compact={desktopCompact} href={navigation[0]?.href ?? '/'} inverse />
        <button
          aria-label="Close navigation"
          className="grid size-8 place-items-center rounded-md text-[#9ba5b5] hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ea6ed] lg:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        >
          <X aria-hidden size={18} />
        </button>
      </div>
      {!desktopCompact && (
        <div className="border-b border-white/9 px-4 py-4">
          <p className="truncate text-sm font-semibold text-white">{viewer.organizationName}</p>
          <p className="mt-0.5 text-[0.7rem] font-semibold tracking-[0.12em] text-[#818da0] uppercase">
            {portalLabel}
          </p>
        </div>
      )}
      <nav aria-label={`${portalLabel} navigation`} className="flex-1 overflow-y-auto px-2.5 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const active =
              item.href === pathname ||
              (item.href !== navigation[0]?.href && pathname.startsWith(`${item.href}/`))
            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#8ea6ed]',
                    active
                      ? 'bg-white/11 text-white'
                      : 'text-[#aeb6c3] hover:bg-white/6 hover:text-white',
                    desktopCompact && 'justify-center px-2',
                  )}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={desktopCompact ? item.label : undefined}
                >
                  <NavigationIcon
                    aria-hidden
                    className={
                      active ? 'text-[#91a9ef]' : 'text-[#7d889b] group-hover:text-[#aeb9cb]'
                    }
                    icon={item.icon}
                    size={18}
                    strokeWidth={1.8}
                  />
                  {!desktopCompact && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-white/9 p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-2',
            desktopCompact && 'justify-center',
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#2c3d70] text-xs font-semibold text-white">
            {initials(viewer.fullName)}
          </span>
          {!desktopCompact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{viewer.fullName}</p>
              <p className="truncate text-[0.68rem] text-[#818da0]">{roleLabel(viewer.role)}</p>
            </div>
          )}
          {!desktopCompact && (
            <form action={signOutAction}>
              <button
                aria-label="Sign out"
                className="grid size-8 place-items-center rounded-md text-[#818da0] hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#8ea6ed]"
                type="submit"
              >
                <LogOut aria-hidden size={15} />
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col bg-[#111722] shadow-2xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          desktopCompact && 'lg:w-[4.5rem]',
        )}
      >
        {sidebar}
      </aside>
      {mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-canvas/92 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-expanded={mobileOpen}
              aria-label="Open navigation"
              className="grid size-9 place-items-center rounded-md border border-border bg-surface text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu aria-hidden size={18} />
            </button>
            <button
              aria-label={desktopCompact ? 'Expand navigation' : 'Collapse navigation'}
              className="hidden size-9 place-items-center rounded-md border border-border bg-surface text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:grid"
              onClick={() => setDesktopCompact((value) => !value)}
              type="button"
            >
              <PanelLeftClose
                aria-hidden
                className={cn('transition-transform', desktopCompact && 'rotate-180')}
                size={17}
              />
            </button>
            <div className="hidden items-center gap-2 text-xs text-subtle sm:flex">
              <span>{portalLabel}</span>
              <ChevronRight aria-hidden size={13} />
              <span className="font-medium text-muted">
                {navigation.find((item) => item.href === pathname)?.label ?? 'Workspace'}
              </span>
            </div>
          </div>
          <ThemeToggle compact />
        </header>
        <main className="mx-auto w-full max-w-[96rem] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
