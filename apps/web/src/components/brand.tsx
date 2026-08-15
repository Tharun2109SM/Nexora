import Link from 'next/link'

import { cn } from '@/lib/utils'

interface BrandProps {
  compact?: boolean
  href?: string
  inverse?: boolean
}

export function Brand({ compact = false, href = '/', inverse = false }: BrandProps) {
  return (
    <Link
      className={cn(
        'inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
        inverse && 'text-white',
      )}
      href={href}
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[0.55rem] bg-accent text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]"
      >
        <svg className="size-[1.1rem]" fill="none" viewBox="0 0 20 20">
          <path d="M4 15.5V4.5l6 7 6-7v11" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 15.5h12" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[1.05rem] font-semibold tracking-[0.16em]">NEXORA</span>
      )}
    </Link>
  )
}
