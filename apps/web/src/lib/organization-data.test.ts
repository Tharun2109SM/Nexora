import { describe, expect, it } from 'vitest'

import { organizationResponseSchema } from './organization-data'

const organizationId = '10000000-0000-4000-8000-000000000001'
const userId = '20000000-0000-4000-8000-000000000001'

const realisticCustomerAdminResponse = {
  data: {
    assignmentProfiles: [],
    assignments: [],
    invitations: [],
    members: [
      {
        id: '30000000-0000-4000-8000-000000000001',
        joined_at: '2026-08-18T09:00:00+00:00',
        profiles: { designation: 'Customer Success Lead', full_name: 'Customer Admin' },
        role: 'CUSTOMER_ADMIN',
        status: 'ACTIVE',
        user_id: userId,
      },
    ],
    organization: {
      company_size: '51-200',
      country: 'India',
      id: organizationId,
      industry: 'Software',
      lifecycle_status: 'ACTIVE',
      logo_available: false,
      name: 'QA Customer Organization',
      website: 'https://customer.example',
    },
    storage: { logoUploadsAvailable: false },
    subscriptions: [],
  },
}

describe('customer organization first-render data', () => {
  it('parses and serializes a realistic customer administrator payload deterministically', () => {
    const parsed = organizationResponseSchema.parse(realisticCustomerAdminResponse)

    expect(parsed.data.organization.name).toBe('QA Customer Organization')
    expect(() => structuredClone(parsed)).not.toThrow()
    expect(parsed).toEqual(realisticCustomerAdminResponse)
  })

  it('rejects protected database fields at the page boundary', () => {
    expect(
      organizationResponseSchema.safeParse({
        data: {
          ...realisticCustomerAdminResponse.data,
          organization: {
            ...realisticCustomerAdminResponse.data.organization,
            logo_object_key: 'private/customer/logo.png',
          },
        },
      }).success,
    ).toBe(false)
    expect(
      organizationResponseSchema.safeParse({
        data: {
          ...realisticCustomerAdminResponse.data,
          invitations: [
            {
              accepted_at: null,
              created_at: '2026-08-18T09:00:00+00:00',
              expires_at: '2026-08-25T09:00:00+00:00',
              id: '40000000-0000-4000-8000-000000000001',
              intended_role: 'CUSTOMER_MEMBER',
              normalized_email: 'invitee@example.test',
              revoked_at: null,
              status: 'PENDING',
              token_hash: '0'.repeat(64),
            },
          ],
        },
      }).success,
    ).toBe(false)
  })
})
