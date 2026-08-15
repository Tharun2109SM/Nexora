import { describe, expect, it } from 'vitest'

import { customerFilterUrl } from './customer-filter-url'

describe('customer filter URL state', () => {
  it('preserves other filters and resets cursor pagination', () => {
    const current = new URLSearchParams('country=India&cursor=opaque-cursor&lifecycle=ACTIVE')

    expect(customerFilterUrl('/beauroi/customers', current, 'search', 'Acme')).toBe(
      '/beauroi/customers?country=India&lifecycle=ACTIVE&search=Acme',
    )
  })

  it('removes empty filters without leaving an empty query string', () => {
    expect(
      customerFilterUrl(
        '/beauroi/customers',
        new URLSearchParams('search=Acme&cursor=next'),
        'search',
        '',
      ),
    ).toBe('/beauroi/customers')
  })
})
