import { describe, expect, it } from 'vitest'

import { feedbackParams, feedbackTone, feedbackTransitions } from './feedback-data'
import { feedbackMutationRequest } from './feedback-mutations'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
describe('feedback presentation helpers', () => {
  it('serializes only approved customer and staff filters', () => {
    const customer = feedbackParams(
      { organizationId: id, scope: 'public', tokenHash: 'secret' },
      false,
    )
    expect(Object.fromEntries(customer)).toEqual({
      limit: '25',
      scope: 'public',
      sort: 'activity-desc',
    })
    const staff = feedbackParams({ organizationId: id, priority: 'HIGH' }, true)
    expect(Object.fromEntries(staff)).toEqual({
      limit: '25',
      organizationId: id,
      priority: 'HIGH',
      sort: 'activity-desc',
    })
  })
  it('exposes controlled forward-only status transitions', () => {
    expect(feedbackTransitions('SUBMITTED')).toEqual(['UNDER_REVIEW', 'DECLINED'])
    expect(feedbackTransitions('SHIPPED')).toEqual([])
  })
  it('maps feedback states to non-color-only badge tones', () => {
    expect(feedbackTone('CRITICAL')).toBe('danger')
    expect(feedbackTone('UNDER_REVIEW')).toBe('warning')
    expect(feedbackTone('SHIPPED')).toBe('success')
  })
  it('builds only narrow mutation requests', () => {
    expect(feedbackMutationRequest(id, { body: 'note', kind: 'internal-note' })).toEqual({
      body: { body: 'note' },
      method: 'POST',
      path: `/feedback/${id}/internal-notes`,
    })
    expect(feedbackMutationRequest(id, { kind: 'vote', remove: true })).toEqual({
      body: undefined,
      method: 'DELETE',
      path: `/feedback/${id}/vote`,
    })
  })
})
