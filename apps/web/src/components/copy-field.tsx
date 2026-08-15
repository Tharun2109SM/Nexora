'use client'

import { Copy } from 'lucide-react'
import { useState } from 'react'

import { buttonClassName } from './ui'

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex gap-2">
      <input
        aria-label="Invitation URL"
        className="h-10 min-w-0 flex-1 rounded-md border border-border bg-canvas px-3 text-sm"
        readOnly
        value={value}
      />
      <button
        className={buttonClassName('secondary')}
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        }}
        type="button"
      >
        <Copy aria-hidden size={15} /> {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
