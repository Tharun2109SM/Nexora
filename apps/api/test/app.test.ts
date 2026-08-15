import type { AccessTokenVerifier } from '../src/types.js'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createApp } from '../src/app.js'

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
})
