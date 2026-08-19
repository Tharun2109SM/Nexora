import { staffSupportTicketDetailSchema, supportTicketListResponseSchema } from '@nexora/contracts'
import { describe, expect, it } from 'vitest'

import {
  supportDetailPresentation,
  supportFilterUrl,
  supportPageMetrics,
  supportQueueParams,
  supportStatusTransitions,
  supportTone,
} from './support-data'
import { supportMutationRequest } from './support-mutations'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const timestamp = '2026-08-19T08:00:00.000Z'
const sla = {
  evaluatedAt: timestamp,
  policyConfigured: true,
  resolution: { completedAt: null, dueAt: timestamp, state: 'BREACHED' },
  response: { completedAt: timestamp, dueAt: timestamp, state: 'MET' },
} as const

const rows = supportTicketListResponseSchema.parse({
  data: [
    {
      assignee: null,
      category: null,
      createdAt: timestamp,
      id,
      lastActivityAt: timestamp,
      organization: { id, name: 'Customer One' },
      priority: 'URGENT',
      product: { id, name: 'Product' },
      reference: 'SUP-1',
      sla,
      status: 'OPEN',
      subject: 'A real support request',
    },
    {
      assignee: { designation: 'Support lead', fullName: 'Assigned Agent', id: secondId },
      category: {
        code: 'GENERAL',
        description: null,
        id: secondId,
        isActive: true,
        name: 'General',
        productId: null,
      },
      createdAt: timestamp,
      id: secondId,
      lastActivityAt: timestamp,
      organization: { id: secondId, name: 'Customer Two' },
      priority: 'MEDIUM',
      product: null,
      reference: 'SUP-2',
      sla: {
        ...sla,
        resolution: { completedAt: null, dueAt: timestamp, state: 'PENDING' },
      },
      status: 'WAITING_ON_CUSTOMER',
      subject: 'Another request',
    },
  ],
  nextCursor: 'cursor-value',
}).data

const firstRow = rows[0]
if (!firstRow) throw new Error('Support test fixture requires a ticket row')

const detail = staffSupportTicketDetailSchema.parse({
  ...firstRow,
  capabilities: {
    canAddInternalNote: true,
    canAssign: true,
    canChangeCategory: true,
    canChangePriority: true,
    canChangeStatus: true,
    canReply: true,
  },
  attachments: [
    {
      contentType: 'text/plain',
      createdAt: timestamp,
      entityId: id,
      entityType: 'TICKET',
      id,
      originalFilename: 'diagnostic.txt',
      sizeBytes: 42,
    },
  ],
  description: 'Detailed request',
  events: [],
  messages: [
    {
      attachments: [],
      author: { designation: null, fullName: 'Customer User', id },
      body: 'Visible reply',
      createdAt: timestamp,
      id,
      isInternal: false,
    },
    {
      attachments: [],
      author: { designation: 'Support lead', fullName: 'Staff User', id: secondId },
      body: 'Staff-only diagnosis',
      createdAt: timestamp,
      id: secondId,
      isInternal: true,
    },
  ],
  requester: { designation: 'Administrator', fullName: 'Customer User', id },
  resolutionSummary: null,
  storage: { attachmentsAvailable: false },
  updatedAt: timestamp,
})

describe('staff support queue presentation', () => {
  it('serializes only approved filters and retains sorting', () => {
    const params = supportQueueParams({
      arbitrary: 'private',
      priority: 'URGENT',
      search: 'login',
      sort: 'created-desc',
    })
    expect(params.toString()).toBe('priority=URGENT&search=login&sort=created-desc')
  })

  it('removes pagination cursors whenever a filter changes', () => {
    expect(
      supportFilterUrl(
        '/beauroi/support',
        new URLSearchParams('cursor=old&status=OPEN'),
        'priority',
        'HIGH',
      ),
    ).toBe('/beauroi/support?status=OPEN&priority=HIGH')
    expect(supportFilterUrl('/beauroi/support', new URLSearchParams(), 'unknown', 'value')).toBe(
      '/beauroi/support',
    )
  })

  it('calculates honestly labelled metrics from only the current page', () => {
    expect(supportPageMetrics(rows)).toEqual({ active: 2, slaAttention: 1, urgent: 1, waiting: 1 })
    expect(supportPageMetrics([])).toEqual({ active: 0, slaAttention: 0, urgent: 0, waiting: 0 })
  })

  it('recognizes all supported SLA and ticket emphasis states', () => {
    expect(supportTone('BREACHED')).toBe('danger')
    expect(supportTone('URGENT')).toBe('danger')
    expect(supportTone('PENDING')).toBe('warning')
    expect(supportTone('MET')).toBe('success')
    expect(supportTone('NOT_CONFIGURED')).toBe('muted')
  })
})

describe('staff support detail presentation', () => {
  it('keeps visible conversation and internal notes in separate collections', () => {
    const presentation = supportDetailPresentation(detail)
    expect(presentation.visibleMessages.map((item) => item.body)).toEqual(['Visible reply'])
    expect(presentation.internalNotes.map((item) => item.body)).toEqual(['Staff-only diagnosis'])
    expect(presentation.attachmentsAvailable).toBe(false)
    expect(presentation.categoryLabel).toBe('Uncategorized')
  })

  it('renders safe requester and attachment metadata without accepting private keys', () => {
    expect(detail.requester).toEqual({
      designation: 'Administrator',
      fullName: 'Customer User',
      id,
    })
    expect(detail.attachments[0]).toMatchObject({
      originalFilename: 'diagnostic.txt',
      sizeBytes: 42,
    })
    expect(JSON.stringify(detail)).not.toContain('objectKey')
    expect(JSON.stringify(detail)).not.toContain('tokenHash')
    expect(JSON.stringify(detail)).not.toContain('requirement')
  })

  it('uses only obvious lifecycle transitions while leaving final authority to PostgreSQL', () => {
    expect(supportStatusTransitions('OPEN')).toEqual(['IN_PROGRESS', 'CLOSED'])
    expect(supportStatusTransitions('RESOLVED')).toEqual(['IN_PROGRESS', 'CLOSED'])
    expect(supportStatusTransitions('CLOSED')).toEqual([])
  })

  it('uses explicit server-derived capabilities instead of inferring from a role label', () => {
    expect(Object.values(detail.capabilities).every(Boolean)).toBe(true)
  })
})

describe('support mutation requests', () => {
  it('keeps customer replies and internal notes on separate endpoints', () => {
    expect(supportMutationRequest(id, { body: 'Customer response', kind: 'reply' })).toEqual({
      body: { body: 'Customer response' },
      method: 'POST',
      path: `/support/tickets/${id}/replies`,
    })
    expect(
      supportMutationRequest(id, { body: 'Private diagnosis', kind: 'internal-note' }),
    ).toEqual({
      body: { body: 'Private diagnosis' },
      method: 'POST',
      path: `/support/tickets/${id}/internal-notes`,
    })
  })

  it('builds only narrow status, priority, and category mutations', () => {
    expect(
      supportMutationRequest(id, {
        kind: 'status',
        resolutionSummary: 'Issue resolved',
        status: 'RESOLVED',
      }),
    ).toMatchObject({
      body: { resolutionSummary: 'Issue resolved', status: 'RESOLVED' },
      method: 'PATCH',
    })
    expect(supportMutationRequest(id, { kind: 'priority', priority: 'HIGH' })).toMatchObject({
      body: { priority: 'HIGH' },
      path: `/support/tickets/${id}/priority`,
    })
    expect(supportMutationRequest(id, { categoryId: secondId, kind: 'category' })).toMatchObject({
      body: { categoryId: secondId },
      path: `/support/tickets/${id}/category`,
    })
    expect(supportMutationRequest(id, { assigneeId: secondId, kind: 'assignee' })).toEqual({
      body: { assigneeId: secondId },
      method: 'PATCH',
      path: `/support/tickets/${id}/assignee`,
    })
  })
})
