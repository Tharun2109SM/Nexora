import { ShieldCheck } from 'lucide-react'

import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(32rem,0.92fr)]">
      <aside className="relative hidden min-h-screen overflow-hidden border-r border-border bg-[#111827] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.055)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom_right,black,transparent_85%)]"
        />
        <div className="relative">
          <Brand inverse />
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs font-semibold tracking-[0.15em] text-[#9db1ea] uppercase">
            A shared operating system
          </p>
          <h2 className="mt-5 font-display text-5xl leading-[1.02] font-semibold tracking-[-0.045em]">
            Keep customer work moving in one secure place.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#b9c0ce]">
            Built for clear ownership between Beau Roi product teams and the customers they support.
          </p>
          <div className="mt-10 grid max-w-md gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10">
            {[
              'Database-enforced organization isolation',
              'Role-aware portal access',
              'Secure, verified account sessions',
            ].map((item) => (
              <div
                className="flex items-center gap-3 bg-[#111827] px-4 py-3.5 text-sm text-[#d5dae4]"
                key={item}
              >
                <ShieldCheck aria-hidden className="text-[#91a9ef]" size={16} /> {item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-[#7f899a]">Beau Roi Technologies Private Limited</p>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-5 sm:px-8 lg:justify-end">
          <div className="lg:hidden">
            <Brand />
          </div>
          <ThemeToggle compact />
        </header>
        <main className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8 sm:py-14">
          {children}
        </main>
      </div>
    </div>
  )
}
