import { describe, expect, it } from 'vitest'

import { workflowFilterUrl } from './workflow-data'

describe('workflow filter URLs', () => {
  it('updates a filter and clears the stale pagination cursor', () => {
    expect(
      workflowFilterUrl(
        '/beauroi/onboarding',
        new URLSearchParams('cursor=old&status=BLOCKED'),
        'productId',
        'product-1',
      ),
    ).toBe('/beauroi/onboarding?status=BLOCKED&productId=product-1')
  })

  it('removes an empty filter without leaving a question mark', () => {
    expect(
      workflowFilterUrl(
        '/beauroi/implementation',
        new URLSearchParams('phase=DISCOVERY'),
        'phase',
        '',
      ),
    ).toBe('/beauroi/implementation')
  })
})
