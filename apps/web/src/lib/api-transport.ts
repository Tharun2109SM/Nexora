export type ApiFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

const transientStatuses = new Set([502, 503, 504])
const retryDelaysMs = [400, 800, 1600, 3200] as const

function isIdempotentRead(init?: RequestInit): boolean {
  return (init?.method ?? 'GET').toUpperCase() === 'GET'
}

function isTransientNetworkError(error: unknown): boolean {
  return error instanceof TypeError
}

function waitForRetry(delayMs: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

export async function fetchApiResponse(
  url: string,
  init?: RequestInit,
  fetcher: ApiFetch = fetch,
  wait: (delayMs: number, signal?: AbortSignal | null) => Promise<void> = waitForRetry,
): Promise<Response> {
  if (!isIdempotentRead(init)) return fetcher(url, init)

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetcher(url, init)
      const retryDelay = retryDelaysMs[attempt]
      if (!transientStatuses.has(response.status) || retryDelay === undefined) return response
      await wait(retryDelay, init?.signal)
    } catch (error) {
      const retryDelay = retryDelaysMs[attempt]
      if (!isTransientNetworkError(error) || retryDelay === undefined || init?.signal?.aborted)
        throw error
      await wait(retryDelay, init?.signal)
    }
  }
}
