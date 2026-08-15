import type { AppRole } from '@nexora/contracts'

export interface AuthenticatedIdentity {
  email: string
  organizationId: string
  role: AppRole
  userId: string
}

declare module 'express-serve-static-core' {
  interface Request {
    identity?: AuthenticatedIdentity
    requestId: string
  }
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<AuthenticatedIdentity>
}
