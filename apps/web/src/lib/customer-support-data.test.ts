import { customerSupportTicketDetailSchema } from '@nexora/contracts'
import { describe, expect, it } from 'vitest'

import {
  customerSupportDetailPresentation,
  customerSupportParams,
  customerSupportUrl,
  formatSupportEvent,
} from './customer-support-data'
import { customerSupportMutationRequest } from './customer-support-mutations'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const timestamp = '2026-08-19T08:00:00.000Z'

const detail = customerSupportTicketDetailSchema.parse({
  assignee: null,
  attachments: [],
  category: null,
  createdAt: timestamp,
  description: 'Customer description',
  events: [
    { actor: null, createdAt: timestamp, eventType: 'TICKET_CREATED', id },
    { actor: null, createdAt: timestamp, eventType: 'INTERNAL_NOTE_ADDED', id: secondId },
  ],
  id,
  lastActivityAt: timestamp,
  messages: [],
  organization: { id, name: 'Scoped customer' },
  priority: 'MEDIUM',
  product: null,
  reference: 'SUP-1',
  requester: { designation: null, fullName: 'Customer User', id },
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
})

describe('customer support URL and presentation safety', () => {
  it('serializes only customer-safe filters and rejects organization selectors', () => {
    expect(
      customerSupportParams({
        organizationId: secondId,
        search: 'login',
        status: 'OPEN',
      }).toString(),
    ).toBe('search=login&status=OPEN')
  })

  it('clears cursors and dependent categories when product filters change', () => {
    expect(
      customerSupportUrl(
        '/portal/support',
        new URLSearchParams(`cursor=old&categoryId=${id}`),
        'productId',
        secondId,
      ),
    ).toBe(`/portal/support?productId=${secondId}`)
  })

  it('defensively removes internal-only event types from customer presentation', () => {
    const presentation = customerSupportDetailPresentation(detail)
    expect(presentation.events.map((event) => event.eventType)).toEqual(['TICKET_CREATED'])
    expect(JSON.stringify(presentation)).not.toContain('INTERNAL_NOTE_ADDED')
    expect(formatSupportEvent('UNKNOWN')).toBe('Ticket updated')
  })
})

describe('customer support mutation requests', () => {
  it('builds a narrow create request with no trusted lifecycle fields', () => {
    const request = customerSupportMutationRequest({
      categoryId: id,
      description: 'Detailed issue',
      kind: 'create',
      productId: secondId,
      subject: 'Login issue',
    })
    expect(request).toEqual({
      body: {
        categoryId: id,
        description: 'Detailed issue',
        productId: secondId,
        subject: 'Login issue',
      },
      method: 'POST',
      path: '/support/tickets',
    })
    expect(JSON.stringify(request)).not.toMatch(/organizationId|priority|status|assignedTo|sla/i)
  })

  it('requires product, category, subject, and description validation', () => {
    expect(() =>
      customerSupportMutationRequest({
        categoryId: '',
        description: '',
        kind: 'create',
        productId: '',
        subject: 'Hi',
      }),
    ).toThrow()
  })

  it('uses only the customer-visible message endpoint for replies', () => {
    expect(
      customerSupportMutationRequest({ body: 'More details', kind: 'reply', ticketId: id }),
    ).toEqual({
      body: { body: 'More details' },
      method: 'POST',
      path: `/support/tickets/${id}/messages`,
    })
  })
})
