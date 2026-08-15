import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'

export default function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <ThemeToggle compact />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">{children}</main>
    </div>
  )
}
