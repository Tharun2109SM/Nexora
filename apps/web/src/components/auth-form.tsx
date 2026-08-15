'use client'

import { AlertCircle, ArrowRight, Building2, LockKeyhole, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { companySizes } from '@nexora/contracts'

import type { AuthActionState } from '@/app/auth/actions'
import { loginAction, registerAction } from '@/app/auth/actions'
import { buttonClassName } from '@/components/ui'
import { cn } from '@/lib/utils'

const initialState: AuthActionState = {}

interface FieldProps {
  autoComplete?: string | undefined
  error?: string | undefined
  label: string
  name: string
  placeholder?: string | undefined
  required?: boolean
  type?: string
}

function Field({
  autoComplete,
  error,
  label,
  name,
  placeholder,
  required = true,
  type = 'text',
}: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor={name}>
        {label}{' '}
        {required ? (
          <span className="text-danger">*</span>
        ) : (
          <span className="text-subtle">(optional)</span>
        )}
      </label>
      <input
        aria-describedby={error ? `${name}-error` : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className={cn(
          'h-11 w-full rounded-md border bg-surface px-3.5 text-[0.95rem] text-foreground outline-none transition placeholder:text-subtle focus:border-accent focus:ring-3 focus:ring-accent/10',
          error ? 'border-danger' : 'border-border-strong',
        )}
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      {error && (
        <p className="mt-1.5 text-xs text-danger" id={`${name}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button className={cn(buttonClassName(), 'h-11 w-full')} disabled={pending} type="submit">
      {pending ? 'Please wait…' : children}
      {!pending && <ArrowRight aria-hidden size={16} />}
    </button>
  )
}

function FormError({ message }: { message?: string | undefined }) {
  if (!message) return null
  return (
    <div
      className="flex gap-2.5 rounded-md border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger"
      role="alert"
    >
      <AlertCircle aria-hidden className="mt-0.5 shrink-0" size={16} />
      <p>{message}</p>
    </div>
  )
}

export function LoginForm({
  next,
  verificationError = false,
}: {
  next?: string
  verificationError?: boolean
}) {
  const [state, formAction] = useActionState(loginAction, initialState)
  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      {next && <input name="next" type="hidden" value={next} />}
      <FormError
        message={
          state.error ??
          (verificationError
            ? 'The verification link is invalid or has expired. Request a new email and try again.'
            : undefined)
        }
      />
      <Field
        autoComplete="email"
        error={state.fieldErrors?.email?.[0]}
        label="Work email"
        name="email"
        placeholder="name@company.com"
        type="email"
      />
      <Field
        autoComplete="current-password"
        error={state.fieldErrors?.password?.[0]}
        label="Password"
        name="password"
        placeholder="Enter your password"
        type="password"
      />
      <SubmitButton>Sign in securely</SubmitButton>
    </form>
  )
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState)
  const error = (field: string) => state.fieldErrors?.[field]?.[0]

  return (
    <form action={formAction} className="mt-8 space-y-8" noValidate>
      <FormError message={state.error} />

      <fieldset>
        <legend className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
          <Building2 aria-hidden className="text-accent" size={17} /> Organization details
        </legend>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              error={error('companyName')}
              label="Company name"
              name="companyName"
              placeholder="Acme Private Limited"
            />
          </div>
          <Field
            error={error('companyWebsite')}
            label="Company website"
            name="companyWebsite"
            placeholder="https://company.com"
            required={false}
            type="url"
          />
          <Field
            error={error('industry')}
            label="Industry"
            name="industry"
            placeholder="Financial services"
          />
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-foreground"
              htmlFor="companySize"
            >
              Company size <span className="text-danger">*</span>
            </label>
            <select
              aria-invalid={Boolean(error('companySize'))}
              className="h-11 w-full rounded-md border border-border-strong bg-surface px-3.5 text-[0.95rem] text-foreground outline-none focus:border-accent focus:ring-3 focus:ring-accent/10"
              defaultValue=""
              id="companySize"
              name="companySize"
              required
            >
              <option disabled value="">
                Select employee count
              </option>
              {companySizes.map((size) => (
                <option key={size} value={size}>
                  {size} employees
                </option>
              ))}
            </select>
            {error('companySize') && (
              <p className="mt-1.5 text-xs text-danger">{error('companySize')}</p>
            )}
          </div>
          <Field error={error('country')} label="Country" name="country" placeholder="India" />
          <div className="sm:col-span-2">
            <label
              className="mb-1.5 block text-sm font-medium text-foreground"
              htmlFor="companyLogo"
            >
              Company logo <span className="text-subtle">(optional)</span>
            </label>
            <input
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="block w-full rounded-md border border-border-strong bg-surface text-sm text-muted file:mr-4 file:h-10 file:border-0 file:border-r file:border-border file:bg-surface-subtle file:px-4 file:text-sm file:font-semibold file:text-foreground hover:file:bg-accent-soft"
              id="companyLogo"
              name="companyLogo"
              type="file"
            />
            <p className="mt-1.5 text-xs text-subtle">PNG, JPG, WebP, or SVG. Maximum 2 MB.</p>
            {error('companyLogo') && (
              <p className="mt-1.5 text-xs text-danger">{error('companyLogo')}</p>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
          <UserRound aria-hidden className="text-accent" size={17} /> Administrator details
        </legend>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            autoComplete="name"
            error={error('fullName')}
            label="Full name"
            name="fullName"
            placeholder="Your full name"
          />
          <Field
            error={error('designation')}
            label="Designation"
            name="designation"
            placeholder="Head of Operations"
          />
          <Field
            autoComplete="email"
            error={error('email')}
            label="Work email"
            name="email"
            placeholder="name@company.com"
            type="email"
          />
          <Field
            autoComplete="tel"
            error={error('phone')}
            label="Phone number"
            name="phone"
            placeholder="+91 98765 43210"
            type="tel"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
          <LockKeyhole aria-hidden className="text-accent" size={17} /> Secure your account
        </legend>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            autoComplete="new-password"
            error={error('password')}
            label="Password"
            name="password"
            placeholder="At least 10 characters"
            type="password"
          />
          <Field
            autoComplete="new-password"
            error={error('confirmPassword')}
            label="Confirm password"
            name="confirmPassword"
            placeholder="Repeat your password"
            type="password"
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-subtle">
          Use at least 10 characters with uppercase, lowercase, and a number.
        </p>
      </fieldset>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-subtle p-3.5 text-sm text-muted">
          <input
            className="mt-0.5 size-4 rounded border-border-strong accent-accent"
            name="acceptedTerms"
            type="checkbox"
          />
          <span>
            I agree to the NEXORA{' '}
            <Link className="font-medium text-accent hover:underline" href="/terms" target="_blank">
              Terms and Conditions
            </Link>{' '}
            and acknowledge the{' '}
            <Link
              className="font-medium text-accent hover:underline"
              href="/privacy"
              target="_blank"
            >
              Privacy Notice
            </Link>
            .
          </span>
        </label>
        {error('acceptedTerms') && (
          <p className="mt-1.5 text-xs text-danger">{error('acceptedTerms')}</p>
        )}
      </div>
      <SubmitButton>Create organization</SubmitButton>
    </form>
  )
}
