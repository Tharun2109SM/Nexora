'use client'

import { Moon, Sun } from 'lucide-react'

import { useTheme } from './theme-provider'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <button
      aria-label={`Switch to ${next} mode`}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onClick={() => setTheme(next)}
      type="button"
    >
      {resolvedTheme === 'dark' ? <Sun aria-hidden size={16} /> : <Moon aria-hidden size={16} />}
      {!compact && <span>{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>}
    </button>
  )
}
