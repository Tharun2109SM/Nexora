'use client'

import { useFormStatus } from 'react-dom'

import { buttonClassName } from './ui'

export function ConfirmSubmit({
  confirmMessage,
  label,
  variant = 'primary',
}: {
  confirmMessage?: string
  label: string
  variant?: 'primary' | 'secondary' | 'quiet'
}) {
  const { pending } = useFormStatus()
  return (
    <button
      className={buttonClassName(variant)}
      disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault()
      }}
      type="submit"
    >
      {pending ? 'Saving…' : label}
    </button>
  )
}
