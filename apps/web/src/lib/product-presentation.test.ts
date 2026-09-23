import { describe, expect, it } from 'vitest'

import { customerProductAvailabilityLabel } from './product-presentation'

describe('customer product presentation', () => {
  it('requires both an active assignment and active catalog product for new workflows', () => {
    expect(customerProductAvailabilityLabel({ productStatus: 'ACTIVE', status: 'ACTIVE' })).toBe(
      'Available for new workflows',
    )
    expect(customerProductAvailabilityLabel({ productStatus: 'ARCHIVED', status: 'ACTIVE' })).toBe(
      'Historical access',
    )
    expect(customerProductAvailabilityLabel({ productStatus: 'ACTIVE', status: 'ARCHIVED' })).toBe(
      'Historical access',
    )
  })
})
