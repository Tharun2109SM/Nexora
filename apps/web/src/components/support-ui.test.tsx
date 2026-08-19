import { staffSupportTicketDetailSchema, supportTicketListResponseSchema } from '@nexora/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SupportQueue } from './support-queue'
import { SupportWorkspace } from './support-workspace'

const ticketId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const staffId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const timestamp = '2026-08-19T08:00:00.000Z'

const ticket = supportTicketListResponseSchema.parse({
  data: [
    {
      assignee: null,
      category: null,
      createdAt: timestamp,
      id: ticketId,
      lastActivityAt: timestamp,
      organization: { id: ticketId, name: 'Customer One' },
      priority: 'URGENT',
      product: null,
      reference: 'SUP-1',
      sla: {
        evaluatedAt: timestamp,
        policyConfigured: true,
        resolution: { completedAt: null, dueAt: timestamp, state: 'BREACHED' },
        response: { completedAt: timestamp, dueAt: timestamp, state: 'MET' },
      },
      status: 'OPEN',
      subject: 'A real support request',
    },
  ],
  nextCursor: 'next-page',
}).data[0]

if (!ticket) throw new Error('Support UI test fixture requires a ticket')

const detail = staffSupportTicketDetailSchema.parse({
  ...ticket,
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
      entityId: ticketId,
      entityType: 'TICKET',
      id: ticketId,
      originalFilename: 'diagnostic.txt',
      sizeBytes: 42,
    },
  ],
  description: 'Detailed customer request',
  events: [],
  messages: [
    {
      attachments: [],
      author: { designation: null, fullName: 'Customer User', id: ticketId },
      body: 'Customer-visible reply',
      createdAt: timestamp,
      id: ticketId,
      isInternal: false,
    },
    {
      attachments: [],
      author: { designation: 'Support lead', fullName: 'Staff User', id: staffId },
      body: 'Staff-only diagnosis',
      createdAt: timestamp,
      id: staffId,
      isInternal: true,
    },
  ],
  requester: { designation: 'Administrator', fullName: 'Customer User', id: ticketId },
  resolutionSummary: null,
  storage: { attachmentsAvailable: false },
  updatedAt: timestamp,
})

describe('staff support queue UI', () => {
  it('renders populated, legacy-null, unassigned, SLA, and cursor states', () => {
    const html = renderToStaticMarkup(
      <SupportQueue
        filtered={false}
        nextHref="/beauroi/support?cursor=next-page"
        rows={[ticket]}
      />,
    )

    expect(html).toContain('A real support request')
    expect(html).toContain('Uncategorized')
    expect(html).toContain('Unassigned')
    expect(html).toContain('BREACHED')
    expect(html).toContain('Next page')
  })

  it('distinguishes an empty queue from an empty filtered result', () => {
    expect(
      renderToStaticMarkup(<SupportQueue filtered={false} nextHref={null} rows={[]} />),
    ).toContain('Support queue is clear')
    expect(renderToStaticMarkup(<SupportQueue filtered nextHref={null} rows={[]} />)).toContain(
      'No matching tickets',
    )
  })
})

describe('staff support detail UI', () => {
  it('renders safe staff detail, distinct notes, controls, and the R2-unavailable state', () => {
    const html = renderToStaticMarkup(
      <SupportWorkspace
        categories={[]}
        data={detail}
        eligibleAssignees={[{ designation: 'Support lead', fullName: 'Staff User', id: staffId }]}
      />,
    )

    expect(html).toContain('Customer-visible conversation')
    expect(html).toContain('Customer-visible reply')
    expect(html).toContain('Internal notes')
    expect(html).toContain('Staff-only diagnosis')
    expect(html).toContain('Visible only to Beau Roi staff')
    expect(html).toContain('Ticket controls')
    expect(html).toContain('Assign support owner')
    expect(html).toContain('Staff User')
    expect(html).toContain('File storage unavailable')
    expect(html).toContain('diagnostic.txt')
    expect(html).not.toContain('objectKey')
    expect(html).not.toContain('tokenHash')
  })

  it('renders a read-only state without mutation controls for unauthorized staff', () => {
    const html = renderToStaticMarkup(
      <SupportWorkspace
        categories={[]}
        data={{
          ...detail,
          capabilities: {
            canAddInternalNote: false,
            canAssign: false,
            canChangeCategory: false,
            canChangePriority: false,
            canChangeStatus: false,
            canReply: false,
          },
        }}
        eligibleAssignees={[]}
      />,
    )

    expect(html).toContain('Read-only support view')
    expect(html).not.toContain('Send customer reply')
    expect(html).not.toContain('Add internal note')
    expect(html).not.toContain('Ticket controls')
    expect(html).not.toContain('Assign support owner')
  })
})
