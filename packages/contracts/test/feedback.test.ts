import { describe, expect, it } from 'vitest'

import {
  createFeedbackSchema,
  customerFeedbackDetailSchema,
  customerFeedbackListQuerySchema,
  staffFeedbackDetailSchema,
  staffFeedbackQueueQuerySchema,
  updateFeedbackStatusSchema,
  updateFeedbackTriageSchema,
} from '../src/index.js'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const timestamp = '2026-08-19T08:00:00.000Z'
const person = { designation: null, fullName: 'Customer User', id }
const base = {
  bug: null,
  createdAt: timestamp,
  description: 'Useful detail',
  events: [],
  feature: null,
  id,
  isPublic: false,
  lastActivityAt: timestamp,
  messages: [],
  organization: { id, name: 'Customer' },
  priority: null,
  product: { id, name: 'NEXORA' },
  requester: person,
  severity: null,
  status: 'SUBMITTED',
  storage: { attachmentsAvailable: false },
  title: 'Feedback title',
  type: 'GENERAL',
  updatedAt: timestamp,
  votes: { count: 0, hasVoted: false },
}

describe('feedback contracts', () => {
  it('derives organization and requester instead of accepting spoofed identity fields', () => {
    expect(
      createFeedbackSchema.safeParse({
        description: 'Details',
        productId: id,
        title: 'Feedback title',
        type: 'GENERAL',
      }).success,
    ).toBe(true)
    expect(
      createFeedbackSchema.safeParse({
        description: 'Details',
        organizationId: id,
        productId: id,
        submittedBy: id,
        title: 'Feedback title',
        type: 'GENERAL',
      }).success,
    ).toBe(false)
  })
  it('requires a problem statement for feature requests', () => {
    expect(
      createFeedbackSchema.safeParse({
        description: 'Details',
        productId: id,
        title: 'Feature title',
        type: 'FEATURE_REQUEST',
      }).success,
    ).toBe(false)
  })
  it('strictly separates customer and staff scope filters', () => {
    expect(customerFeedbackListQuerySchema.safeParse({ organizationId: id }).success).toBe(false)
    expect(customerFeedbackListQuerySchema.parse({ scope: 'public' }).scope).toBe('public')
    expect(
      staffFeedbackQueueQuerySchema.safeParse({ organizationId: id, priority: 'HIGH' }).success,
    ).toBe(true)
  })
  it('accepts only narrow status and triage operations', () => {
    expect(updateFeedbackStatusSchema.safeParse({ status: 'UNDER_REVIEW' }).success).toBe(true)
    expect(
      updateFeedbackStatusSchema.safeParse({ status: 'UNDER_REVIEW', title: 'changed' }).success,
    ).toBe(false)
    expect(
      updateFeedbackTriageSchema.safeParse({ isPublic: true, priority: 'HIGH', severity: null })
        .success,
    ).toBe(true)
  })
  it('keeps customer detail free of internal fields', () => {
    expect(customerFeedbackDetailSchema.safeParse(base).success).toBe(true)
    for (const field of ['internalNotes', 'objectKey', 'tokenHash', 'requirements'])
      expect(customerFeedbackDetailSchema.safeParse({ ...base, [field]: 'secret' }).success).toBe(
        false,
      )
    expect(
      customerFeedbackDetailSchema.safeParse({
        ...base,
        messages: [{ author: person, body: 'secret', createdAt: timestamp, id, isInternal: true }],
      }).success,
    ).toBe(false)
  })
  it('supports anonymized explicitly public cross-organization requests', () => {
    expect(
      customerFeedbackDetailSchema.safeParse({
        ...base,
        isPublic: true,
        organization: null,
        requester: null,
        type: 'FEATURE_REQUEST',
      }).success,
    ).toBe(true)
  })
  it('allows internal visibility only in the staff contract', () => {
    expect(
      staffFeedbackDetailSchema.safeParse({
        ...base,
        capabilities: {
          canAddInternalNote: true,
          canChangeStatus: true,
          canPublish: false,
          canRespond: true,
          canTriage: true,
        },
        messages: [
          { author: person, body: 'internal', createdAt: timestamp, id, isInternal: true },
        ],
      }).success,
    ).toBe(true)
  })
})
