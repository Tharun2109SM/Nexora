import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'quiet'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white shadow-[0_1px_2px_rgb(15_23_42/0.18)] hover:bg-accent-strong',
  quiet: 'text-muted hover:bg-surface-subtle hover:text-foreground',
  secondary: 'border border-border-strong bg-surface text-foreground hover:bg-surface-subtle',
}

export function buttonClassName(variant: ButtonVariant = 'primary'): string {
  return cn(
    'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50',
    buttonStyles[variant],
  )
}

interface ButtonLinkProps extends ComponentPropsWithoutRef<typeof Link> {
  variant?: ButtonVariant
}

export function ButtonLink({ className, variant = 'primary', ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonClassName(variant), className)} {...props} />
}

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description: string
  action?: ReactNode
}

export function PageHeader({ action, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-accent uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-[0.95rem] leading-6 text-muted">{description}</p>
      </div>
      {action}
    </header>
  )
}

interface EmptyStateProps {
  description: string
  icon: ReactNode
  title: string
  note?: string
}

export function EmptyState({ description, icon, note, title }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-border bg-surface px-6 py-12 text-center shadow-card sm:px-10">
      <div className="mx-auto grid size-11 place-items-center rounded-lg border border-border bg-surface-subtle text-muted">
        {icon}
      </div>
      <h2 className="mt-5 font-display text-xl font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {note && <p className="mx-auto mt-4 max-w-md text-xs leading-5 text-subtle">{note}</p>}
    </section>
  )
}
