import { describe, expect, it } from 'vitest'

import {
  calculateWorkflowProgress,
  assignmentCreateSchema,
  canAccessOrganization,
  canAccessPortal,
  canManageStaffInvitations,
  customerCursorSchema,
  customerDetailResponseSchema,
  customerListQuerySchema,
  healthScoreCreateSchema,
  invitationCreateSchema,
  implementationProjectCreateSchema,
  memberMutationSchema,
  onboardingPlanCreateSchema,
  onboardingTaskCreateSchema,
  portalForRole,
  routeForRole,
} from '../src/index.js'

describe('role routing', () => {
  it.each([
    ['BEAUROI_ADMIN', 'beauroi', '/beauroi'],
    ['BEAUROI_EMPLOYEE', 'beauroi', '/beauroi'],
    ['CUSTOMER_ADMIN', 'customer', '/portal'],
    ['CUSTOMER_MEMBER', 'customer', '/portal'],
  ] as const)('routes %s into the correct portal', (role, portal, route) => {
    expect(portalForRole(role)).toBe(portal)
    expect(routeForRole(role)).toBe(route)
    expect(canAccessPortal(role, portal)).toBe(true)
  })

  it('rejects cross-portal access', () => {
    expect(canAccessPortal('CUSTOMER_ADMIN', 'beauroi')).toBe(false)
    expect(canAccessPortal('BEAUROI_EMPLOYEE', 'customer')).toBe(false)
  })
})

describe('customer-management contracts', () => {
  it('normalizes and bounds customer list queries', () => {
    expect(customerListQuerySchema.parse({ limit: '50', search: '  Acme  ' })).toMatchObject({
      limit: 50,
      search: 'Acme',
      sort: 'name-asc',
    })
    expect(customerListQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(customerListQuerySchema.safeParse({ unexpected: 'value' }).success).toBe(false)
  })

  it('rejects malformed cursor, assignment, and health mutations', () => {
    expect(
      customerCursorSchema.safeParse({ id: 'not-a-uuid', sort: 'name-asc', value: 'A' }).success,
    ).toBe(false)
    expect(
      assignmentCreateSchema.safeParse({
        employeeUserId: crypto.randomUUID(),
        type: 'ACCOUNT_OWNER',
      }).success,
    ).toBe(false)
    expect(healthScoreCreateSchema.safeParse({ reason: '', score: 101 }).success).toBe(false)
  })

  it('limits invitations and member changes to customer roles', () => {
    expect(
      invitationCreateSchema.safeParse({ email: 'ADMIN@EXAMPLE.COM', role: 'BEAUROI_ADMIN' })
        .success,
    ).toBe(false)
    expect(
      invitationCreateSchema.parse({ email: 'ADMIN@EXAMPLE.COM', role: 'CUSTOMER_MEMBER' }).email,
    ).toBe('admin@example.com')
    expect(memberMutationSchema.safeParse({ role: 'BEAUROI_EMPLOYEE' }).success).toBe(false)
  })

  it('rejects protected storage, invitation, note, and requirement fields in customer detail data', () => {
    const response = {
      data: {
        assignmentNotes: [],
        assignmentProfiles: [],
        assignments: [],
        auditEvents: [],
        canManageInvitations: false,
        healthHistory: [],
        invitations: [],
        members: [],
        organization: {
          companySize: null,
          country: null,
          id: crypto.randomUUID(),
          industry: null,
          lifecycleStatus: 'ACTIVE',
          logoAvailable: false,
          name: 'Customer',
          website: null,
        },
        storage: { logoUploadsAvailable: false },
        subscriptions: [],
      },
    }

    expect(customerDetailResponseSchema.safeParse(response).success).toBe(true)
    for (const [field, value] of [
      ['token_hash', 'secret'],
      ['logo_object_key', 'private/logo.png'],
      ['internal_notes', 'private'],
      ['requirement_summary', 'private'],
    ] as const) {
      expect(
        customerDetailResponseSchema.safeParse({
          data: { ...response.data, [field]: value },
        }).success,
      ).toBe(false)
    }
  })
})

describe('workflow contracts and calculations', () => {
  it('derives progress while excluding cancelled items', () => {
    expect(calculateWorkflowProgress(['COMPLETED', 'NOT_STARTED', 'CANCELLED'])).toBe(50)
    expect(calculateWorkflowProgress(['CANCELLED'])).toBe(0)
  })

  it('rejects malformed and oversized workflow payloads', () => {
    expect(
      onboardingPlanCreateSchema.safeParse({
        name: 'Plan',
        organizationId: crypto.randomUUID(),
        productId: crypto.randomUUID(),
        status: 'UNKNOWN',
      }).success,
    ).toBe(false)
    expect(
      onboardingTaskCreateSchema.safeParse({ title: 'Task', description: 'x'.repeat(5001) })
        .success,
    ).toBe(false)
    expect(
      implementationProjectCreateSchema.safeParse({
        name: 'Implementation',
        organizationId: crypto.randomUUID(),
        productId: crypto.randomUUID(),
        requirementSummary: '   ',
      }).success,
    ).toBe(false)
  })
})

describe('organization isolation', () => {
  const customer = {
    userId: 'user-1',
    role: 'CUSTOMER_MEMBER',
    organizationId: 'organization-a',
  } as const

  it('allows a customer to access its own organization', () => {
    expect(canAccessOrganization(customer, 'organization-a')).toBe(true)
  })

  it('rejects a customer from another organization', () => {
    expect(canAccessOrganization(customer, 'organization-b')).toBe(false)
  })

  it('allows an authorized Beau Roi employee to work across organizations', () => {
    expect(
      canAccessOrganization(
        {
          userId: 'user-2',
          role: 'BEAUROI_EMPLOYEE',
          organizationId: 'beau-roi',
        },
        'organization-b',
      ),
    ).toBe(true)
  })

  it('limits staff-side invitation administration to Beau Roi administrators', () => {
    expect(canManageStaffInvitations('BEAUROI_ADMIN')).toBe(true)
    expect(canManageStaffInvitations('BEAUROI_EMPLOYEE')).toBe(false)
    expect(canManageStaffInvitations('CUSTOMER_ADMIN')).toBe(false)
    expect(canManageStaffInvitations('CUSTOMER_MEMBER')).toBe(false)
  })
})
