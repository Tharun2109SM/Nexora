import {
  customerSupportTicketDetailSchema,
  supportTicketListResponseSchema,
} from '@nexora/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CustomerSupportQueue } from './customer-support-queue'
import { CustomerSupportWorkspace } from './customer-support-workspace'
import { CustomerTicketForm } from './customer-ticket-form'

vi.mock('next/navigation', () => ({
  usePathname: () => '/portal/support',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('raise=1'),
}))

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const timestamp = '2026-08-19T08:00:00.000Z'
const ticket = supportTicketListResponseSchema.parse({
  data: [
    {
      assignee: { designation: 'Private assignment', fullName: 'Do not render', id: secondId },
      category: null,
      createdAt: timestamp,
      id,
      lastActivityAt: timestamp,
      organization: { id: secondId, name: 'Unrelated Organization' },
      priority: 'MEDIUM',
      product: null,
      reference: 'SUP-1',
      sla: {
        evaluatedAt: timestamp,
        policyConfigured: false,
        resolution: { completedAt: null, dueAt: null, state: 'NOT_CONFIGURED' },
        response: { completedAt: null, dueAt: null, state: 'NOT_CONFIGURED' },
      },
      status: 'OPEN',
      subject: 'Support request',
    },
  ],
  nextCursor: 'next',
}).data[0]

if (!ticket) throw new Error('Customer support UI test requires a ticket')

const detail = customerSupportTicketDetailSchema.parse({
  ...ticket,
  attachments: [
    {
      contentType: 'text/plain',
      createdAt: timestamp,
      entityId: id,
      entityType: 'TICKET',
      id,
      originalFilename: 'safe.txt',
      sizeBytes: 12,
    },
  ],
  description: 'Customer-visible request',
  events: [
    { actor: null, createdAt: timestamp, eventType: 'TICKET_CREATED', id },
    { actor: null, createdAt: timestamp, eventType: 'INTERNAL_NOTE_ADDED', id: secondId },
  ],
  messages: [
    {
      attachments: [],
      author: { designation: null, fullName: 'Customer User', id },
      body: 'Customer-visible message',
      createdAt: timestamp,
      id,
    },
  ],
  requester: { designation: null, fullName: 'Customer User', id },
  resolutionSummary: null,
  storage: { attachmentsAvailable: false },
  updatedAt: timestamp,
})

describe('customer support list UI', () => {
  it('renders populated safe ticket information without organization or assignment internals', () => {
    const html = renderToStaticMarkup(
      <CustomerSupportQueue filtered={false} nextHref="?cursor=next" rows={[ticket]} />,
    )
    expect(html).toContain('Support request')
    expect(html).toContain('Uncategorized')
    expect(html).toContain('NOT CONFIGURED')
    expect(html).toContain('Next page')
    expect(html).not.toContain('Unrelated Organization')
    expect(html).not.toContain('Private assignment')
    expect(html).not.toContain('Do not render')
  })

  it('distinguishes an empty list from a filtered-empty result', () => {
    expect(
      renderToStaticMarkup(<CustomerSupportQueue filtered={false} nextHref={null} rows={[]} />),
    ).toContain('No support tickets yet')
    expect(
      renderToStaticMarkup(<CustomerSupportQueue filtered nextHref={null} rows={[]} />),
    ).toContain('No matching tickets')
  })
})

describe('customer ticket creation UI', () => {
  it('shows an honest state when no eligible product exists', () => {
    const html = renderToStaticMarkup(
      <CustomerTicketForm categories={[]} products={[]} selectedProductId="" />,
    )
    expect(html).toContain('No eligible support product')
    expect(html).not.toContain('Create ticket')
  })

  it('disables submission when an eligible product has no applicable category', () => {
    const html = renderToStaticMarkup(
      <CustomerTicketForm
        categories={[]}
        products={[{ code: 'NEXORA', id, name: 'NEXORA' }]}
        selectedProductId={id}
      />,
    )
    expect(html).toContain('No active support category')
    expect(html).toContain('disabled=""')
  })
})

describe('customer support detail UI security', () => {
  it('renders customer-safe conversation, timeline, SLA and unavailable storage states', () => {
    const html = renderToStaticMarkup(<CustomerSupportWorkspace data={detail} />)
    expect(html).toContain('Customer-visible message')
    expect(html).toContain('Ticket created')
    expect(html).toContain('No SLA policy snapshot is configured')
    expect(html).toContain('File actions unavailable')
    expect(html).toContain('safe.txt')
  })

  it('never renders internal events, tenant data, private keys, or staff controls', () => {
    const html = renderToStaticMarkup(<CustomerSupportWorkspace data={detail} />)
    for (const privateValue of [
      'INTERNAL_NOTE_ADDED',
      'Internal notes',
      'Unrelated Organization',
      'Private assignment',
      'object_key',
      'objectKey',
      'Update priority',
      'Update status',
      'Update category',
      'Update assignee',
      'Ticket controls',
    ]) {
      expect(html).not.toContain(privateValue)
    }
  })
})
