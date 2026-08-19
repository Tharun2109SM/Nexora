'use client'

import { Send } from 'lucide-react'
import { useActionState, useState } from 'react'

import { createFeedbackAction, type FeedbackActionState } from '@/app/feedback-actions'

import { buttonClassName } from './ui'

const input =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
export function FeedbackSubmissionForm({
  products,
  selectedType,
}: {
  products: { id: string; name: string }[]
  selectedType: string
}) {
  const [state, action, pending] = useActionState(createFeedbackAction, {} as FeedbackActionState)
  const [type, setType] = useState(
    ['GENERAL', 'BUG', 'FEATURE_REQUEST'].includes(selectedType) ? selectedType : 'GENERAL',
  )
  return (
    <form
      action={action}
      className="grid gap-5 rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <div>
        <h2 className="font-display text-xl font-semibold">Submit product feedback</h2>
        <p className="mt-1 text-sm text-muted">
          Choose the request type carefully. Staff-controlled severity, priority, and workflow
          status cannot be set here.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold">
          Request type
          <select
            className={input}
            name="type"
            onChange={(e) => setType(e.target.value)}
            value={type}
          >
            <option value="GENERAL">General feedback</option>
            <option value="BUG">Report a bug</option>
            <option value="FEATURE_REQUEST">Feature request</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Product
          <select className={input} name="productId" required>
            <option value="">Select a subscribed product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold">
        Title
        <input className={input} maxLength={240} minLength={3} name="title" required />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        Description
        <textarea
          className="min-h-36 rounded-md border border-border bg-canvas p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          maxLength={30000}
          name="description"
          required
        />
      </label>
      {type === 'BUG' && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">
            Reproduction steps
            <textarea
              className="min-h-28 rounded-md border border-border bg-canvas p-3 text-sm"
              maxLength={10000}
              name="bugReproductionSteps"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Environment
            <textarea
              className="min-h-28 rounded-md border border-border bg-canvas p-3 text-sm"
              maxLength={2000}
              name="bugEnvironment"
              placeholder="Browser, device, version, or operating system"
            />
          </label>
        </div>
      )}
      {type === 'FEATURE_REQUEST' && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">
            Problem to solve
            <textarea
              className="min-h-28 rounded-md border border-border bg-canvas p-3 text-sm"
              maxLength={10000}
              name="featureProblemStatement"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Desired outcome
            <textarea
              className="min-h-28 rounded-md border border-border bg-canvas p-3 text-sm"
              maxLength={10000}
              name="featureDesiredOutcome"
            />
          </label>
        </div>
      )}
      {state.error && (
        <p className="text-sm font-medium text-danger" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-subtle">
          Attachments remain unavailable until private R2 storage is configured.
        </p>
        <button
          className={buttonClassName()}
          disabled={pending || products.length === 0}
          type="submit"
        >
          <Send size={15} />
          {pending ? 'Submitting…' : 'Submit feedback'}
        </button>
      </div>
    </form>
  )
}
