import { describe, expect, it } from 'vitest'

import {
  assignmentCreateSchema,
  canAccessOrganization,
  canAccessPortal,
  customerCursorSchema,
  customerListQuerySchema,
  healthScoreCreateSchema,
  invitationCreateSchema,
  memberMutationSchema,
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
})
