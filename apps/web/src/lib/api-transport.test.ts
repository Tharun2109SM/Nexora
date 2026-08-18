import { describe, expect, it, vi } from 'vitest'

import { fetchApiResponse } from './api-transport'

const noWait = () => Promise.resolve()

describe('API transport resilience', () => {
  it('recovers an idempotent first render after transient network failures', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('{"data":{"ready":true}}', { status: 200 }))

    const response = await fetchApiResponse(
      'http://localhost:4000/v1/organizations/fixture',
      undefined,
      fetcher,
      noWait,
    )

    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('does not retry mutations that could produce duplicate side effects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      fetchApiResponse(
        'http://localhost:4000/v1/organizations/fixture/invitations',
        { method: 'POST' },
        fetcher,
        noWait,
      ),
    ).rejects.toThrow('fetch failed')
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('surfaces an exhausted transient failure instead of hiding it', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      fetchApiResponse(
        'http://localhost:4000/v1/organizations/fixture',
        undefined,
        fetcher,
        noWait,
      ),
    ).rejects.toThrow('fetch failed')
    expect(fetcher).toHaveBeenCalledTimes(5)
  })
})
