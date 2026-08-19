import type { AccessTokenVerifier } from '../src/types.js'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createApp } from '../src/app.js'
import { calculateSupportSla, createSupportRouter } from '../src/routes/support.js'

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ticketId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const productId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const categoryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const messageId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const timestamp = '2026-08-19T08:00:00.000Z'

interface FakeResult {
  data: unknown
  error: { code?: string; message: string } | null
}

class FakeQuery {
  constructor(readonly result: FakeResult) {}
  eq() {
    return this
  }
  gt() {
    return this
  }
  in() {
    return this
  }
  limit() {
    return this
  }
  lt() {
    return this
  }
  or() {
    return this
  }
  order() {
    return this
  }
  select() {
    return this
  }
  single() {
    return Promise.resolve(this.result)
  }
  maybeSingle() {
    return Promise.resolve(this.result)
  }
  then(resolve: (result: FakeResult) => unknown) {
    return Promise.resolve(this.result).then(resolve)
  }
}

type TestRole = 'BEAUROI_ADMIN' | 'BEAUROI_EMPLOYEE' | 'CUSTOMER_ADMIN'

function verifier(role: TestRole): AccessTokenVerifier {
  return {
    verify: () => Promise.resolve({ email: 'user@example.test', organizationId, role, userId }),
  }
}

const rpc = vi.fn()
const update = vi.fn()
const eq = vi.fn()
const select = vi.fn()
const single = vi.fn()
const fakeClient = {
  from: vi.fn(() => ({ update })),
  rpc,
}

function app(role: TestRole) {
  return createApp(verifier(role), {
    supportRouter: createSupportRouter({ createClient: () => fakeClient as never }),
  })
}

function appWithResults(role: TestRole, results: Record<string, FakeResult>) {
  const client = {
    from: vi.fn((table: string) => new FakeQuery(results[table] ?? { data: [], error: null })),
    rpc,
  }
  return {
    app: createApp(verifier(role), {
      supportRouter: createSupportRouter({
        createClient: () => client as never,
        now: () => new Date(timestamp),
      }),
    }),
    client,
  }
}

const ticket = {
  assigned_to: null,
  category: {
    code: 'GENERAL',
    description: null,
    id: categoryId,
    is_active: true,
    name: 'General',
    product_id: null,
  },
  category_id: categoryId,
  closed_at: null,
  created_at: timestamp,
  created_by: userId,
  description: 'Ticket detail',
  first_responded_at: null,
  first_response_due_at: null,
  id: ticketId,
  last_activity_at: timestamp,
  organization: { id: organizationId, name: 'Customer' },
  organization_id: organizationId,
  priority: 'MEDIUM',
  product: { id: productId, name: 'NEXORA' },
  product_id: productId,
  resolution_due_at: null,
  resolution_summary: null,
  resolved_at: null,
  sla_policy_id: null,
  status: 'OPEN',
  subject: 'Support request',
  ticket_number: '42',
  updated_at: timestamp,
}

const errorSchema = z.object({ error: z.object({ code: z.string() }) })

describe('support API authorization and writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: ticketId, error: null })
    update.mockReturnValue({ eq })
    eq.mockReturnValue({ select })
    select.mockReturnValue({ single })
    single.mockResolvedValue({ data: { id: ticketId }, error: null })
  })

  it('creates a customer ticket through the RPC using identity-derived organization scope', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .post('/v1/support/tickets')
      .set('authorization', 'Bearer customer')
      .send({
        categoryId,
        description: 'The application cannot start.',
        productId,
        subject: 'Startup failure',
      })
      .expect(201)

    expect(rpc).toHaveBeenCalledWith('create_support_ticket', {
      target_category_id: categoryId,
      target_organization_id: organizationId,
      target_product_id: productId,
      ticket_description: 'The application cannot start.',
      ticket_subject: 'Startup failure',
    })
  })

  it('lists only the identity-scoped customer ticket collection', async () => {
    const setup = appWithResults('CUSTOMER_ADMIN', {
      profiles: { data: [], error: null },
      support_tickets: { data: [ticket], error: null },
    })
    const response = await request(setup.app)
      .get('/v1/support/tickets')
      .set('authorization', 'Bearer customer')
      .expect(200)
    expect(response.body).toMatchObject({ data: [{ id: ticketId, reference: 'SUP-42' }] })
    expect(setup.client.from).toHaveBeenCalledWith('support_tickets')
  })

  it('returns a paginated staff queue with a deterministic cursor', async () => {
    const secondTicket = {
      ...ticket,
      created_at: '2026-08-19T07:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
      last_activity_at: '2026-08-19T07:00:00.000Z',
      ticket_number: '41',
    }
    const setup = appWithResults('BEAUROI_EMPLOYEE', {
      support_tickets: { data: [ticket, secondTicket], error: null },
    })
    const response = await request(setup.app)
      .get('/v1/support/queue?limit=1&status=OPEN&priority=MEDIUM')
      .set('authorization', 'Bearer staff')
      .expect(200)
    expect(response.body).toMatchObject({ data: [{ id: ticketId, reference: 'SUP-42' }] })
    expect(
      z.object({ nextCursor: z.string().min(1) }).parse(response.body as unknown).nextCursor,
    ).toBeTypeOf('string')
  })

  it('does not accept an organization selector on the customer list', async () => {
    const response = await request(app('CUSTOMER_ADMIN'))
      .get(`/v1/support/tickets?organizationId=${productId}`)
      .set('authorization', 'Bearer customer')
      .expect(400)
    expect(errorSchema.parse(response.body as unknown).error.code).toBe('VALIDATION_ERROR')
    expect(fakeClient.from).not.toHaveBeenCalled()
  })

  it('returns customer detail without internal rows or private attachment fields', async () => {
    const setup = appWithResults('CUSTOMER_ADMIN', {
      attachments: {
        data: [
          {
            content_type: 'text/plain',
            created_at: timestamp,
            entity_id: ticketId,
            entity_type: 'TICKET',
            id: categoryId,
            original_filename: 'safe.txt',
            size_bytes: 12,
          },
        ],
        error: null,
      },
      profiles: {
        data: [{ designation: null, full_name: 'Customer User', id: userId }],
        error: null,
      },
      support_ticket_events: {
        data: [
          {
            actor_user_id: userId,
            created_at: timestamp,
            customer_visible: true,
            event_type: 'TICKET_CREATED',
            id: categoryId,
          },
          {
            actor_user_id: userId,
            created_at: timestamp,
            customer_visible: false,
            event_type: 'INTERNAL_NOTE_ADDED',
            id: messageId,
          },
        ],
        error: null,
      },
      support_tickets: { data: ticket, error: null },
      ticket_messages: {
        data: [
          {
            author_user_id: userId,
            body: 'Visible reply',
            created_at: timestamp,
            id: categoryId,
            is_internal: false,
          },
          {
            author_user_id: userId,
            body: 'Private note',
            created_at: timestamp,
            id: messageId,
            is_internal: true,
          },
        ],
        error: null,
      },
    })
    const response = await request(setup.app)
      .get(`/v1/support/tickets/${ticketId}`)
      .set('authorization', 'Bearer customer')
      .expect(200)
    expect(response.text).toContain('Visible reply')
    expect(response.text).not.toContain('Private note')
    expect(response.text).not.toContain('INTERNAL_NOTE_ADDED')
    expect(response.text).not.toContain('object_key')
    expect(response.text).not.toContain('objectKey')
  })

  it('returns a safe not-found response when RLS hides another tenant ticket', async () => {
    const setup = appWithResults('CUSTOMER_ADMIN', {
      support_tickets: { data: null, error: null },
    })
    const response = await request(setup.app)
      .get(`/v1/support/tickets/${ticketId}`)
      .set('authorization', 'Bearer customer')
      .expect(404)
    expect(errorSchema.parse(response.body as unknown).error.code).toBe('SUPPORT_TICKET_NOT_FOUND')
  })

  it('keeps internal notes in the staff-only detail projection', async () => {
    const setup = appWithResults('BEAUROI_EMPLOYEE', {
      attachments: { data: [], error: null },
      profiles: {
        data: [{ designation: 'Support', full_name: 'Support Agent', id: userId }],
        error: null,
      },
      support_ticket_events: {
        data: [
          {
            actor_user_id: userId,
            created_at: timestamp,
            customer_visible: false,
            event_type: 'INTERNAL_NOTE_ADDED',
            id: categoryId,
          },
        ],
        error: null,
      },
      support_tickets: { data: ticket, error: null },
      ticket_messages: {
        data: [
          {
            author_user_id: userId,
            body: 'Staff-only diagnosis',
            created_at: timestamp,
            id: messageId,
            is_internal: true,
          },
        ],
        error: null,
      },
    })
    const response = await request(setup.app)
      .get(`/v1/support/tickets/${ticketId}`)
      .set('authorization', 'Bearer staff')
      .expect(200)
    expect(response.text).toContain('Staff-only diagnosis')
    expect(response.body).toMatchObject({ data: { messages: [{ isInternal: true }] } })
  })

  it('rejects a customer-supplied organization before database access', async () => {
    const response = await request(app('CUSTOMER_ADMIN'))
      .post('/v1/support/tickets')
      .set('authorization', 'Bearer customer')
      .send({
        categoryId,
        description: 'Details',
        organizationId,
        productId,
        subject: 'Support request',
      })
      .expect(400)
    expect(errorSchema.parse(response.body as unknown).error.code).toBe('VALIDATION_ERROR')
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['priority', 'URGENT'],
    ['status', 'CLOSED'],
    ['assignedTo', userId],
    ['slaPolicyId', productId],
    ['firstResponseDueAt', '2026-08-19T10:00:00.000Z'],
  ])('rejects customer-controlled trusted field %s', async (field, value) => {
    const response = await request(app('CUSTOMER_ADMIN'))
      .post('/v1/support/tickets')
      .set('authorization', 'Bearer customer')
      .send({
        categoryId,
        description: 'Details',
        productId,
        subject: 'Support request',
        [field]: value,
      })
      .expect(400)
    expect(errorSchema.parse(response.body as unknown).error.code).toBe('VALIDATION_ERROR')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('forces customer messages to be customer-visible', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .post(`/v1/support/tickets/${ticketId}/messages`)
      .set('authorization', 'Bearer customer')
      .send({ body: 'Additional information' })
      .expect(201)
    expect(rpc).toHaveBeenCalledWith('add_support_ticket_message', {
      internal_message: false,
      message_body: 'Additional information',
      target_ticket_id: ticketId,
    })
  })

  it('blocks customer access to staff queue and internal-note routes', async () => {
    const queue = await request(app('CUSTOMER_ADMIN'))
      .get('/v1/support/queue')
      .set('authorization', 'Bearer customer')
      .expect(403)
    const note = await request(app('CUSTOMER_ADMIN'))
      .post(`/v1/support/tickets/${ticketId}/internal-notes`)
      .set('authorization', 'Bearer customer')
      .send({ body: 'private' })
      .expect(403)
    expect(errorSchema.parse(queue.body as unknown).error.code).toBe('BEAUROI_ACCESS_REQUIRED')
    expect(errorSchema.parse(note.body as unknown).error.code).toBe('BEAUROI_ACCESS_REQUIRED')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('creates staff internal notes only through the guarded RPC', async () => {
    await request(app('BEAUROI_EMPLOYEE'))
      .post(`/v1/support/tickets/${ticketId}/internal-notes`)
      .set('authorization', 'Bearer staff')
      .send({ body: 'Internal triage note' })
      .expect(201)
    expect(rpc).toHaveBeenCalledWith('add_support_ticket_message', {
      internal_message: true,
      message_body: 'Internal triage note',
      target_ticket_id: ticketId,
    })
  })

  it('updates only the requested allowlisted staff column', async () => {
    await request(app('BEAUROI_EMPLOYEE'))
      .patch(`/v1/support/tickets/${ticketId}/priority`)
      .set('authorization', 'Bearer staff')
      .send({ priority: 'URGENT' })
      .expect(200)
    expect(update).toHaveBeenCalledWith({ priority: 'URGENT' })
  })

  it.each([
    [
      '/status',
      { resolutionSummary: 'Resolved safely', status: 'RESOLVED' },
      { resolution_summary: 'Resolved safely', status: 'RESOLVED' },
    ],
    ['/category', { categoryId }, { category_id: categoryId }],
    ['/assignee', { assigneeId: userId }, { assigned_to: userId }],
  ] as const)('uses a narrow update for %s', async (path, body, expected) => {
    await request(app('BEAUROI_EMPLOYEE'))
      .patch(`/v1/support/tickets/${ticketId}${path}`)
      .set('authorization', 'Bearer staff')
      .send(body)
      .expect(200)
    expect(update).toHaveBeenCalledWith(expected)
  })

  it('allows the administrator role to reach guarded staff mutations', async () => {
    await request(app('BEAUROI_ADMIN'))
      .patch(`/v1/support/tickets/${ticketId}/priority`)
      .set('authorization', 'Bearer admin')
      .send({ priority: 'HIGH' })
      .expect(200)
    expect(update).toHaveBeenCalledWith({ priority: 'HIGH' })
  })

  it('maps assignment-scoped database rejection to a safe response', async () => {
    single.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'assignment details' },
    })
    const response = await request(app('BEAUROI_EMPLOYEE'))
      .patch(`/v1/support/tickets/${ticketId}/priority`)
      .set('authorization', 'Bearer unassigned-staff')
      .send({ priority: 'HIGH' })
      .expect(403)
    expect(response.text).not.toContain('assignment details')
    expect(errorSchema.parse(response.body as unknown).error.code).toBe('SUPPORT_ACCESS_DENIED')
  })

  it('validates staff filters and cursors before querying', async () => {
    for (const path of [
      '/v1/support/queue?priority=CRITICAL',
      '/v1/support/queue?limit=101',
      '/v1/support/queue?organizationId=not-a-uuid',
      '/v1/support/queue?cursor=not-base64-json',
    ]) {
      const response = await request(app('BEAUROI_EMPLOYEE'))
        .get(path)
        .set('authorization', 'Bearer staff')
        .expect(400)
      expect(['INVALID_CURSOR', 'VALIDATION_ERROR']).toContain(
        errorSchema.parse(response.body as unknown).error.code,
      )
    }
    expect(fakeClient.from).not.toHaveBeenCalled()
  })

  it('returns generic database authorization failures without leaking details', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'sensitive database detail' },
    })
    const response = await request(app('CUSTOMER_ADMIN'))
      .post('/v1/support/tickets')
      .set('authorization', 'Bearer customer')
      .send({
        categoryId,
        description: 'The application cannot start.',
        productId,
        subject: 'Startup failure',
      })
      .expect(403)
    expect(response.text).not.toContain('sensitive database detail')
    expect(errorSchema.parse(response.body as unknown).error.code).toBe('SUPPORT_ACCESS_DENIED')
  })

  it('maps invalid product or category constraints without exposing PostgreSQL text', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'private constraint detail' },
    })
    const response = await request(app('CUSTOMER_ADMIN'))
      .post('/v1/support/tickets')
      .set('authorization', 'Bearer customer')
      .send({
        categoryId,
        description: 'The application cannot start.',
        productId,
        subject: 'Startup failure',
      })
      .expect(409)
    expect(response.text).not.toContain('private constraint detail')
    expect(errorSchema.parse(response.body as unknown).error.code).toBe('SUPPORT_MUTATION_REJECTED')
  })
})

describe('support SLA representation', () => {
  it('distinguishes pending, met, breached, and unconfigured states deterministically', () => {
    const now = new Date('2026-08-19T10:00:00.000Z')
    expect(
      calculateSupportSla(
        {
          closed_at: null,
          first_responded_at: '2026-08-19T09:30:00.000Z',
          first_response_due_at: '2026-08-19T09:45:00.000Z',
          resolution_due_at: '2026-08-19T12:00:00.000Z',
          resolved_at: null,
          sla_policy_id: productId,
          status: 'IN_PROGRESS',
        },
        now,
      ),
    ).toMatchObject({ response: { state: 'MET' }, resolution: { state: 'PENDING' } })
    expect(
      calculateSupportSla(
        {
          closed_at: null,
          first_responded_at: null,
          first_response_due_at: '2026-08-19T09:00:00.000Z',
          resolution_due_at: null,
          resolved_at: null,
          sla_policy_id: productId,
          status: 'OPEN',
        },
        now,
      ),
    ).toMatchObject({ response: { state: 'BREACHED' }, resolution: { state: 'NOT_CONFIGURED' } })
  })

  it('freezes resolved and closed evaluation at stored completion timestamps', () => {
    const now = new Date('2026-08-22T10:00:00.000Z')
    expect(
      calculateSupportSla(
        {
          closed_at: null,
          first_responded_at: '2026-08-19T09:30:00.000Z',
          first_response_due_at: '2026-08-19T09:45:00.000Z',
          resolution_due_at: '2026-08-19T12:00:00.000Z',
          resolved_at: '2026-08-19T11:00:00.000Z',
          sla_policy_id: productId,
          status: 'RESOLVED',
        },
        now,
      ),
    ).toMatchObject({ response: { state: 'MET' }, resolution: { state: 'MET' } })
    expect(
      calculateSupportSla(
        {
          closed_at: '2026-08-19T11:00:00.000Z',
          first_responded_at: null,
          first_response_due_at: '2026-08-19T09:45:00.000Z',
          resolution_due_at: '2026-08-19T10:30:00.000Z',
          resolved_at: null,
          sla_policy_id: productId,
          status: 'CLOSED',
        },
        now,
      ),
    ).toMatchObject({ response: { state: 'NOT_APPLICABLE' }, resolution: { state: 'BREACHED' } })
  })
})
