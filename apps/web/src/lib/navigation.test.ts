import { describe, expect, it } from 'vitest'

import { beauroiNavigation, customerNavigation } from './navigation'

describe('portal navigation contracts', () => {
  it('exposes the overview plus all eight Beau Roi modules', () => {
    expect(beauroiNavigation).toHaveLength(9)
    expect(beauroiNavigation.map((item) => item.href)).toEqual([
      '/beauroi',
      '/beauroi/customers',
      '/beauroi/onboarding',
      '/beauroi/implementation',
      '/beauroi/support',
      '/beauroi/feedback',
      '/beauroi/releases',
      '/beauroi/analytics',
      '/beauroi/knowledge-base',
    ])
  })

  it('exposes all nine customer portal sections including the dashboard', () => {
    expect(customerNavigation).toHaveLength(9)
    expect(new Set(customerNavigation.map((item) => item.href)).size).toBe(
      customerNavigation.length,
    )
    expect(customerNavigation.at(-1)?.href).toBe('/portal/settings')
  })
})
