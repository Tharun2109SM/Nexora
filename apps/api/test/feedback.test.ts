import type { AccessTokenVerifier } from '../src/types.js'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/app.js'
import {
  createFeedbackRouter,
  projectFeedbackEvent,
  projectFeedbackMessage,
} from '../src/routes/feedback.js'

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const feedbackId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const productId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
type Role = 'BEAUROI_ADMIN' | 'BEAUROI_EMPLOYEE' | 'CUSTOMER_ADMIN'
function verifier(role: Role): AccessTokenVerifier {
  return {
    verify: () => Promise.resolve({ email: 'user@example.test', organizationId, role, userId }),
  }
}
const rpc = vi.fn()
const client = { from: vi.fn(), rpc }
function app(role: Role) {
  return createApp(verifier(role), {
    feedbackRouter: createFeedbackRouter({ createClient: () => client as never }),
  })
}

describe('feedback API authorization and mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: feedbackId, error: null })
  })
  it('creates feedback through the narrow RPC with identity-derived organization scope', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .post('/v1/feedback')
      .set('authorization', 'Bearer customer')
      .send({
        description: 'Customer feedback detail',
        productId,
        title: 'Feature idea',
        type: 'GENERAL',
      })
      .expect(201)
    expect(rpc).toHaveBeenCalledWith(
      'create_feedback',
      expect.objectContaining({
        target_organization_id: organizationId,
        target_product_id: productId,
        feedback_type: 'GENERAL',
      }),
    )
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('submittedBy')
  })
  it('rejects organization spoofing before the database call', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .post('/v1/feedback')
      .set('authorization', 'Bearer customer')
      .send({
        description: 'Customer feedback detail',
        organizationId: productId,
        productId,
        title: 'Feature idea',
        type: 'GENERAL',
      })
      .expect(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('does not allow customer roles to invoke staff status operations', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .patch(`/v1/feedback/${feedbackId}/status`)
      .set('authorization', 'Bearer customer')
      .send({ status: 'UNDER_REVIEW' })
      .expect(403)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('routes staff status changes through the guarded RPC', async () => {
    await request(app('BEAUROI_EMPLOYEE'))
      .patch(`/v1/feedback/${feedbackId}/status`)
      .set('authorization', 'Bearer staff')
      .send({ status: 'UNDER_REVIEW' })
      .expect(200)
    expect(rpc).toHaveBeenCalledWith('update_feedback_status', {
      target_feedback_id: feedbackId,
      target_status: 'UNDER_REVIEW',
    })
  })
  it('keeps internal notes on a distinct staff-only endpoint', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .post(`/v1/feedback/${feedbackId}/internal-notes`)
      .set('authorization', 'Bearer customer')
      .send({ body: 'private' })
      .expect(403)
    await request(app('BEAUROI_ADMIN'))
      .post(`/v1/feedback/${feedbackId}/internal-notes`)
      .set('authorization', 'Bearer staff')
      .send({ body: 'private' })
      .expect(201)
    expect(rpc).toHaveBeenLastCalledWith('add_feedback_message', {
      internal_message: true,
      message_body: 'private',
      target_feedback_id: feedbackId,
    })
  })
  it('uses authenticated vote RPCs and never accepts voter identity', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .post(`/v1/feedback/${feedbackId}/vote`)
      .set('authorization', 'Bearer customer')
      .send({ userId: productId })
      .expect(200)
    expect(rpc).toHaveBeenCalledWith('vote_feature_request', { target_feedback_id: feedbackId })
  })
  it('maps RLS authorization failures to a safe error', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'sensitive database text' },
    })
    const response = await request(app('BEAUROI_EMPLOYEE'))
      .patch(`/v1/feedback/${feedbackId}/status`)
      .set('authorization', 'Bearer staff')
      .send({ status: 'UNDER_REVIEW' })
      .expect(403)
    expect(response.text).not.toContain('sensitive database text')
    expect(response.body).toMatchObject({ error: { code: 'FEEDBACK_ACCESS_DENIED' } })
  })
})

describe('feedback detail projections', () => {
  const author = {
    designation: 'Administrator',
    fullName: 'Customer Admin',
    id: userId,
  }
  it('omits staff-only message metadata from customer responses', () => {
    const row = {
      author_user_id: userId,
      body: 'Visible response',
      created_at: '2026-08-19T06:00:00.000Z',
      id: feedbackId,
      is_internal: false,
    }
    expect(projectFeedbackMessage(row, author, false)).not.toHaveProperty('isInternal')
    expect(projectFeedbackMessage(row, author, true)).toHaveProperty('isInternal', false)
  })
  it('omits staff-only event metadata from customer responses', () => {
    const row = {
      actor_user_id: userId,
      created_at: '2026-08-19T06:00:00.000Z',
      customer_visible: true,
      event_type: 'CREATED',
      id: feedbackId,
    }
    expect(projectFeedbackEvent(row, author, false)).not.toHaveProperty('customerVisible')
    expect(projectFeedbackEvent(row, author, true)).toHaveProperty('customerVisible', true)
  })
})
