import { createProductSchema, productListResponseSchema } from '../src/index.js'
import { describe, expect, it } from 'vitest'

describe('product management contracts', () => {
  it('normalizes a valid product code and rejects spoofed fields', () => {
    expect(
      createProductSchema.parse({ code: ' nexora_ops ', description: null, name: 'Nexora Ops' }),
    ).toMatchObject({ code: 'NEXORA_OPS' })
    expect(
      createProductSchema.safeParse({
        code: 'NEXORA',
        createdBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        description: null,
        name: 'Nexora',
      }).success,
    ).toBe(false)
  })

  it('rejects invalid product codes and malformed responses', () => {
    expect(
      createProductSchema.safeParse({ code: '1 invalid', description: null, name: 'Nexora' })
        .success,
    ).toBe(false)
    expect(productListResponseSchema.safeParse({ data: [{ code: 'NEXORA' }] }).success).toBe(false)
  })
})
