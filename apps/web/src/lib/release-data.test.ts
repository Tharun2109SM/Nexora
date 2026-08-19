import { describe, expect, it } from 'vitest'

import { maintenanceParams, releaseParams } from './release-data'

describe('release query parameters', () => {
  it('omits absent optional filters instead of serializing undefined', () => {
    expect(releaseParams({}, true).toString()).toBe('limit=25&sort=activity-desc')
    expect(maintenanceParams({}).toString()).toBe('limit=25')
  })

  it('preserves validated staff filters', () => {
    expect(
      releaseParams({ productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'DRAFT' }, true)
        .toString()
        .includes('status=DRAFT'),
    ).toBe(true)
  })
})
