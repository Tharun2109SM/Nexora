import type { AccessTokenVerifier } from '../src/types.js'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createApp } from '../src/app.js'
import {
  CUSTOMER_IMPLEMENTATION_PROJECT_SELECT,
  CUSTOMER_PROJECT_NOTE_SELECT,
} from '../src/routes/workflows.js'

const customerVerifier: AccessTokenVerifier = {
  verify(token) {
    if (token !== 'valid-customer') return Promise.reject(new Error('invalid test token'))
    return Promise.resolve({
      email: 'customer@example.test',
      organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'CUSTOMER_MEMBER' as const,
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })
  },
}

const beauRoiVerifier: AccessTokenVerifier = {
  verify() {
    return Promise.resolve({
      email: 'staff@beauroi.test',
      organizationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      role: 'BEAUROI_EMPLOYEE' as const,
      userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    })
  },
}

const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
})

describe('health and error contracts', () => {
  it('returns a public health response and request ID', async () => {
    const response = await request(createApp(customerVerifier)).get('/health').expect(200)
    const body = z.object({ status: z.string() }).parse(response.body as unknown)
    expect(body.status).toBe('ok')
    expect(response.headers['x-request-id']).toBeTypeOf('string')
  })

  it('returns a consistent not-found error', async () => {
    const response = await request(createApp(customerVerifier)).get('/missing').expect(404)
    const body = errorResponseSchema.parse(response.body as unknown)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message.length).toBeGreaterThan(0)
    expect(body.error.requestId.length).toBeGreaterThan(0)
  })
})

describe('authentication and organization isolation', () => {
  it('allowlists customer implementation fields and omits internal project content', () => {
    expect(CUSTOMER_IMPLEMENTATION_PROJECT_SELECT).not.toContain('requirement_summary')
    expect(CUSTOMER_PROJECT_NOTE_SELECT).not.toContain('updated_at')
    expect(CUSTOMER_PROJECT_NOTE_SELECT).not.toContain('metadata')
  })
  it('rejects protected routes without a bearer token', async () => {
    const response = await request(createApp(customerVerifier)).get('/v1/me').expect(401)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe('AUTH_REQUIRED')
  })

  it('returns the verified identity', async () => {
    const response = await request(createApp(customerVerifier))
      .get('/v1/me')
      .set('authorization', 'Bearer valid-customer')
      .expect(200)
    const body = z.object({ data: z.object({ role: z.string() }) }).parse(response.body as unknown)
    expect(body.data.role).toBe('CUSTOMER_MEMBER')
  })

  it('allows the customer organization', async () => {
    await request(createApp(customerVerifier))
      .get('/v1/organizations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/access-check')
      .set('authorization', 'Bearer valid-customer')
      .expect(204)
  })

  it('rejects a different customer organization', async () => {
    const response = await request(createApp(customerVerifier))
      .get('/v1/organizations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/access-check')
      .set('authorization', 'Bearer valid-customer')
      .expect(403)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      'ORGANIZATION_ACCESS_DENIED',
    )
  })

  it('blocks customer roles from the Beau Roi customer collection', async () => {
    const response = await request(createApp(customerVerifier))
      .get('/v1/customers')
      .set('authorization', 'Bearer valid-customer')
      .expect(403)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      'BEAUROI_ACCESS_REQUIRED',
    )
  })

  it('blocks customer roles from Beau Roi workflow management', async () => {
    const response = await request(createApp(customerVerifier))
      .get('/v1/onboarding')
      .set('authorization', 'Bearer valid-customer')
      .expect(403)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      'BEAUROI_ACCESS_REQUIRED',
    )
  })

  it('blocks cross-organization customer implementation reads', async () => {
    const response = await request(createApp(customerVerifier))
      .get('/v1/organizations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/implementation')
      .set('authorization', 'Bearer valid-customer')
      .expect(403)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      'ORGANIZATION_ACCESS_DENIED',
    )
  })

  it('rejects malformed workflow payloads before database access', async () => {
    const response = await request(createApp(beauRoiVerifier))
      .post('/v1/onboarding')
      .set('authorization', 'Bearer staff')
      .send({ name: 'x', organizationId: 'not-a-uuid' })
      .expect(400)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe('VALIDATION_ERROR')
  })

  it('blocks a cross-organization customer administrator mutation', async () => {
    const response = await request(createApp(customerVerifier))
      .patch('/v1/organizations/cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      .set('authorization', 'Bearer valid-customer')
      .send({})
      .expect(403)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      'ORGANIZATION_ADMIN_REQUIRED',
    )
  })

  it('reports R2 as unavailable without attempting a fake upload', async () => {
    const response = await request(createApp(beauRoiVerifier))
      .put('/v1/organizations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo')
      .set('authorization', 'Bearer staff')
      .set('content-type', 'image/png')
      .set('x-file-name', 'logo.png')
      .send(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      .expect(503)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      'FILE_STORAGE_NOT_CONFIGURED',
    )
  })

  it('returns a consistent error for an oversized logo body', async () => {
    const response = await request(createApp(beauRoiVerifier))
      .put('/v1/organizations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo')
      .set('authorization', 'Bearer staff')
      .set('content-type', 'image/png')
      .set('x-file-name', 'logo.png')
      .send(Buffer.alloc(2 * 1024 * 1024 + 1))
      .expect(413)
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe('PAYLOAD_TOO_LARGE')
  })
})
