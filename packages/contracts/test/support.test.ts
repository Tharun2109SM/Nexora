import { describe, expect, it } from 'vitest'

import {
  createSupportTicketSchema,
  customerSupportTicketDetailSchema,
  staffSupportQueueQuerySchema,
  staffSupportTicketDetailSchema,
  supportTicketCursorSchema,
  updateSupportAssigneeSchema,
  updateSupportStatusSchema,
} from '../src/index.js'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const timestamp = '2026-08-19T08:00:00.000Z'
const person = { designation: null, fullName: 'Customer User', id }
const baseDetail = {
  assignee: null,
  attachments: [],
  category: null,
  createdAt: timestamp,
  description: 'A detailed support request.',
  events: [],
  id,
  lastActivityAt: timestamp,
  messages: [],
  organization: { id, name: 'Example Customer' },
  priority: 'MEDIUM',
  product: null,
  reference: 'SUP-1',
  requester: person,
  resolutionSummary: null,
  sla: {
    evaluatedAt: timestamp,
    policyConfigured: false,
    resolution: { completedAt: null, dueAt: null, state: 'NOT_CONFIGURED' },
    response: { completedAt: null, dueAt: null, state: 'NOT_CONFIGURED' },
  },
  status: 'OPEN',
  storage: { attachmentsAvailable: false },
  subject: 'Support request',
  updatedAt: timestamp,
}

describe('support contracts', () => {
  it('strictly bounds ticket creation and prevents organization spoofing', () => {
    expect(
      createSupportTicketSchema.safeParse({
        categoryId: id,
        description: 'Details',
        productId: id,
        subject: 'Help needed',
      }).success,
    ).toBe(true)
    expect(
      createSupportTicketSchema.safeParse({
        categoryId: id,
        description: 'Details',
        organizationId: id,
        productId: id,
        subject: 'Help needed',
      }).success,
    ).toBe(false)
    expect(
      createSupportTicketSchema.safeParse({
        categoryId: id,
        description: '',
        productId: id,
        subject: 'Hi',
      }).success,
    ).toBe(false)
  })

  it('bounds queue pagination, filters, and cursors', () => {
    expect(staffSupportQueueQuerySchema.parse({ limit: '100', priority: 'URGENT' }).limit).toBe(100)
    expect(staffSupportQueueQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(
      supportTicketCursorSchema.safeParse({ id, sort: 'activity-desc', value: timestamp }).success,
    ).toBe(true)
    expect(
      supportTicketCursorSchema.safeParse({ id, sort: 'unknown', value: timestamp }).success,
    ).toBe(false)
  })

  it('strictly validates narrow staff mutations', () => {
    expect(
      updateSupportStatusSchema.safeParse({ status: 'RESOLVED', resolutionSummary: 'Fixed' })
        .success,
    ).toBe(true)
    expect(
      updateSupportStatusSchema.safeParse({ priority: 'URGENT', status: 'OPEN' }).success,
    ).toBe(false)
    expect(updateSupportAssigneeSchema.safeParse({ assigneeId: null }).success).toBe(true)
  })

  it('keeps customer detail free of internal and storage fields', () => {
    expect(customerSupportTicketDetailSchema.safeParse(baseDetail).success).toBe(true)
    for (const field of ['objectKey', 'internalNotes', 'requirementSummary', 'tokenHash']) {
      expect(
        customerSupportTicketDetailSchema.safeParse({ ...baseDetail, [field]: 'secret' }).success,
      ).toBe(false)
    }
    expect(
      customerSupportTicketDetailSchema.safeParse({
        ...baseDetail,
        messages: [
          {
            attachments: [],
            author: person,
            body: 'note',
            createdAt: timestamp,
            id,
            isInternal: true,
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('allows explicit internal visibility only in the staff detail contract', () => {
    expect(
      staffSupportTicketDetailSchema.safeParse({
        ...baseDetail,
        messages: [
          {
            attachments: [],
            author: person,
            body: 'note',
            createdAt: timestamp,
            id,
            isInternal: true,
          },
        ],
      }).success,
    ).toBe(true)
  })
})
