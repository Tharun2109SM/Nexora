import { canAccessOrganization } from '@nexora/contracts'
import type { NextFunction, Request, Response } from 'express'

import { AppError } from '../lib/errors.js'
import type { AccessTokenVerifier } from '../types.js'

export function authenticate(verifier: AccessTokenVerifier) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const authorization = request.header('authorization')
      if (!authorization?.startsWith('Bearer ')) {
        throw new AppError(401, 'AUTH_REQUIRED', 'A valid bearer token is required.')
      }
      const token = authorization.slice('Bearer '.length).trim()
      if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'A valid bearer token is required.')
      request.identity = await verifier.verify(token)
      request.accessToken = token
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireBeauRoi(request: Request, _response: Response, next: NextFunction) {
  if (!request.identity) {
    next(new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.'))
    return
  }
  if (!['BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE'].includes(request.identity.role)) {
    next(new AppError(403, 'BEAUROI_ACCESS_REQUIRED', 'Beau Roi access is required.'))
    return
  }
  next()
}

export function requireOrganizationAdmin(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const identity = request.identity
  const organizationId = request.params.organizationId
  if (!identity) {
    next(new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.'))
    return
  }
  const beauRoiAdmin = identity.role === 'BEAUROI_ADMIN'
  const ownCustomerAdmin =
    identity.role === 'CUSTOMER_ADMIN' && identity.organizationId === organizationId
  if (!beauRoiAdmin && !ownCustomerAdmin) {
    next(
      new AppError(
        403,
        'ORGANIZATION_ADMIN_REQUIRED',
        'Organization administrator access is required.',
      ),
    )
    return
  }
  next()
}

export function requireOrganizationAccess(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const identity = request.identity
  const organizationId = request.params.organizationId
  if (!identity) {
    next(new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.'))
    return
  }
  if (typeof organizationId !== 'string') {
    next(new AppError(400, 'ORGANIZATION_REQUIRED', 'An organization ID is required.'))
    return
  }
  if (!canAccessOrganization(identity, organizationId)) {
    next(new AppError(403, 'ORGANIZATION_ACCESS_DENIED', 'You cannot access this organization.'))
    return
  }
  next()
}
