import { z } from 'zod'

export const APP_ROLES = [
  'BEAUROI_ADMIN',
  'BEAUROI_EMPLOYEE',
  'CUSTOMER_ADMIN',
  'CUSTOMER_MEMBER',
] as const

export const appRoleSchema = z.enum(APP_ROLES)
export type AppRole = z.infer<typeof appRoleSchema>

export const BEAUROI_ROLES: readonly AppRole[] = ['BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE']
export const CUSTOMER_ROLES: readonly AppRole[] = ['CUSTOMER_ADMIN', 'CUSTOMER_MEMBER']

export const portalSchema = z.enum(['beauroi', 'customer'])
export type Portal = z.infer<typeof portalSchema>

export const companySizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const

const optionalUrl = z.union([
  z.literal(''),
  z.url('Enter a valid company website').trim().max(2048),
])

export const loginSchema = z.object({
  email: z.email('Enter a valid work email').trim().max(320),
  password: z.string().min(1, 'Enter your password').max(128),
})

export const registrationSchema = z
  .object({
    companyName: z.string().trim().min(2, 'Enter the company name').max(160),
    companyWebsite: optionalUrl,
    industry: z.string().trim().min(2, 'Select or enter an industry').max(100),
    companySize: z.enum(companySizes, { error: 'Select the company size' }),
    country: z.string().trim().min(2, 'Select or enter a country').max(100),
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    designation: z.string().trim().min(2, 'Enter your designation').max(120),
    email: z.email('Enter a valid work email').trim().max(320),
    phone: z.string().trim().min(7, 'Enter a valid phone number').max(32),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(128)
      .regex(/[A-Z]/, 'Add an uppercase letter')
      .regex(/[a-z]/, 'Add a lowercase letter')
      .regex(/[0-9]/, 'Add a number'),
    confirmPassword: z.string(),
    acceptedTerms: z.literal('on', { error: 'Accept the Terms and Conditions' }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegistrationInput = z.infer<typeof registrationSchema>

export function portalForRole(role: AppRole): Portal {
  return BEAUROI_ROLES.includes(role) ? 'beauroi' : 'customer'
}

export function routeForRole(role: AppRole): '/beauroi' | '/portal' {
  return portalForRole(role) === 'beauroi' ? '/beauroi' : '/portal'
}

export function canAccessPortal(role: AppRole, portal: Portal): boolean {
  return portalForRole(role) === portal
}

export interface ViewerContext {
  userId: string
  role: AppRole
  organizationId: string
}

export function canAccessOrganization(viewer: ViewerContext, organizationId: string): boolean {
  return BEAUROI_ROLES.includes(viewer.role) || viewer.organizationId === organizationId
}

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>
