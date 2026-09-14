import type { AppRole } from '@nexora/contracts'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/app.js'
import { createProductsRouter } from '../src/routes/products.js'
import type { AccessTokenVerifier } from '../src/types.js'

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const productId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function verifier(role: AppRole): AccessTokenVerifier {
  return {
    verify: () => Promise.resolve({ email: 'user@example.test', organizationId, role, userId }),
  }
}

const rpc = vi.fn()
const client = { from: vi.fn(), rpc }
function app(role: AppRole) {
  return createApp(verifier(role), {
    productsRouter: createProductsRouter({ createClient: () => client as never }),
  })
}

describe('product management API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: productId, error: null })
  })

  it('creates an active product through the guarded database RPC', async () => {
    await request(app('BEAUROI_ADMIN'))
      .post('/v1/products')
      .set('authorization', 'Bearer admin')
      .send({ code: 'nexora_ops', description: 'Operations platform', name: 'Nexora Ops' })
      .expect(201)

    expect(rpc).toHaveBeenCalledWith('create_product', {
      product_code: 'NEXORA_OPS',
      product_description: 'Operations platform',
      product_name: 'Nexora Ops',
    })
  })

  it.each(['BEAUROI_EMPLOYEE', 'CUSTOMER_ADMIN', 'CUSTOMER_MEMBER'] as const)(
    'rejects product creation for %s before PostgreSQL is called',
    async (role) => {
      await request(app(role))
        .post('/v1/products')
        .set('authorization', 'Bearer user')
        .send({ code: 'NEXORA_OPS', description: null, name: 'Nexora Ops' })
        .expect(403)
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  it('rejects ownership and status spoofing in the strict request contract', async () => {
    await request(app('BEAUROI_ADMIN'))
      .post('/v1/products')
      .set('authorization', 'Bearer admin')
      .send({ code: 'NEXORA', description: null, name: 'Nexora', status: 'ACTIVE' })
      .expect(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('maps database authorization failures to a generic API error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'private detail' } })
    const response = await request(app('BEAUROI_ADMIN'))
      .post('/v1/products')
      .set('authorization', 'Bearer admin')
      .send({ code: 'NEXORA', description: null, name: 'Nexora' })
      .expect(403)
    expect(response.body).toMatchObject({ error: { code: 'PRODUCT_ADMIN_REQUIRED' } })
    expect(response.text).not.toContain('private detail')
  })

  it('provisions an active customer-product relationship through the guarded RPC', async () => {
    await request(app('BEAUROI_ADMIN'))
      .post('/v1/products/subscriptions')
      .set('authorization', 'Bearer admin')
      .send({ organizationId, productId })
      .expect(201)
    expect(rpc).toHaveBeenCalledWith('activate_customer_product', {
      target_organization_id: organizationId,
      target_product_id: productId,
    })
  })

  it('rejects employee provisioning before calling PostgreSQL', async () => {
    await request(app('BEAUROI_EMPLOYEE'))
      .post('/v1/products/subscriptions')
      .set('authorization', 'Bearer employee')
      .send({ organizationId, productId })
      .expect(403)
    expect(rpc).not.toHaveBeenCalled()
  })
})
