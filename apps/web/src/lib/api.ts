import { apiErrorSchema } from '@nexora/contracts'

import { getPublicEnvironment } from './env'
import { fetchApiResponse } from './api-transport'
import { createClient } from './supabase/server'

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

export async function apiRequest(path: string, init?: RequestInit): Promise<unknown> {
  const supabase = await createClient()
  const claims = await supabase.auth.getClaims()
  if (!claims.data?.claims)
    throw new ApiRequestError('Authentication is required.', 'AUTH_REQUIRED')
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) throw new ApiRequestError('Authentication is required.', 'AUTH_REQUIRED')
  const headers = new Headers(init?.headers)
  headers.set('authorization', `Bearer ${accessToken}`)
  headers.set('x-request-id', crypto.randomUUID())
  if (typeof init?.body === 'string') headers.set('content-type', 'application/json')
  const response = await fetchApiResponse(
    `${getPublicEnvironment().NEXT_PUBLIC_API_URL}/v1${path}`,
    {
      ...init,
      cache: 'no-store',
      headers,
    },
  )
  if (response.status === 204) return null
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (!response.ok)
      throw new ApiRequestError('The API is temporarily unavailable.', 'UPSTREAM_UNAVAILABLE')
    throw new ApiRequestError('The API returned an invalid response.', 'API_RESPONSE_INVALID')
  }
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body)
    throw new ApiRequestError(
      parsed.success ? parsed.data.error.message : 'The request could not be completed.',
      parsed.success ? parsed.data.error.code : 'API_ERROR',
    )
  }
  return body
}
