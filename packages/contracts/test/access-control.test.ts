import { describe, expect, it } from 'vitest'

import {
  canAccessOrganization,
  canAccessPortal,
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
