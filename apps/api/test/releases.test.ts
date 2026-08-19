import type { AccessTokenVerifier } from '../src/types.js'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/app.js'
import { createReleaseRouter } from '../src/routes/releases.js'

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const releaseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
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
    releasesRouter: createReleaseRouter({ createClient: () => client as never }),
  })
}
describe('release API authorization and mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: releaseId, error: null })
  })
  it('creates a release only through the narrow database RPC', async () => {
    await request(app('BEAUROI_ADMIN'))
      .post('/v1/releases')
      .set('authorization', 'Bearer admin')
      .send({
        productId,
        releaseNotes: 'Notes',
        summary: 'Summary',
        title: 'Release title',
        version: '2.0.0',
      })
      .expect(201)
    expect(rpc).toHaveBeenCalledWith(
      'create_release_draft',
      expect.objectContaining({ target_product_id: productId, target_version: '2.0.0' }),
    )
  })
  it('rejects customer release creation before the database call', async () => {
    await request(app('CUSTOMER_ADMIN'))
      .post('/v1/releases')
      .set('authorization', 'Bearer customer')
      .send({ productId, title: 'Release title', version: '2.0.0' })
      .expect(403)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects organization ownership spoofing in strict request schemas', async () => {
    await request(app('BEAUROI_ADMIN'))
      .post('/v1/releases')
      .set('authorization', 'Bearer admin')
      .send({ organizationId, productId, title: 'Release title', version: '2.0.0' })
      .expect(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('routes audience targeting through the guarded RPC', async () => {
    await request(app('BEAUROI_ADMIN'))
      .put(`/v1/releases/${releaseId}/audience`)
      .set('authorization', 'Bearer admin')
      .send({ mode: 'SELECTED_ORGANIZATIONS', organizationIds: [organizationId] })
      .expect(200)
    expect(rpc).toHaveBeenCalledWith('set_release_audience', {
      target_mode: 'SELECTED_ORGANIZATIONS',
      target_organization_ids: [organizationId],
      target_release_id: releaseId,
    })
  })
  it('routes publication through a non-generic lifecycle RPC', async () => {
    await request(app('BEAUROI_ADMIN'))
      .patch(`/v1/releases/${releaseId}/status`)
      .set('authorization', 'Bearer admin')
      .send({ status: 'PUBLISHED' })
      .expect(200)
    expect(rpc).toHaveBeenCalledWith('transition_release', {
      target_release_id: releaseId,
      target_scheduled_for: null,
      target_status: 'PUBLISHED',
    })
  })
  it('maps database authorization failures without leaking raw errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'database secret' } })
    const response = await request(app('BEAUROI_EMPLOYEE'))
      .post('/v1/releases')
      .set('authorization', 'Bearer employee')
      .send({ productId, title: 'Release title', version: '2.0.0' })
      .expect(403)
    expect(response.text).not.toContain('database secret')
    expect(response.body).toMatchObject({ error: { code: 'RELEASE_ACCESS_DENIED' } })
  })
  it('validates maintenance dates before calling PostgreSQL', async () => {
    await request(app('BEAUROI_ADMIN'))
      .post('/v1/maintenance')
      .set('authorization', 'Bearer admin')
      .send({
        description: 'Maintenance',
        endsAt: '2026-08-19T15:00:00.000Z',
        productId,
        startsAt: '2026-08-20T15:00:00.000Z',
        title: 'Maintenance notice',
      })
      .expect(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('routes maintenance targeting through its guarded RPC', async () => {
    await request(app('BEAUROI_ADMIN'))
      .put(`/v1/maintenance/${releaseId}/audience`)
      .set('authorization', 'Bearer admin')
      .send({ mode: 'SELECTED_ORGANIZATIONS', organizationIds: [organizationId] })
      .expect(200)
    expect(rpc).toHaveBeenCalledWith('set_maintenance_audience', {
      target_mode: 'SELECTED_ORGANIZATIONS',
      target_notice_id: releaseId,
      target_organization_ids: [organizationId],
    })
  })
})
