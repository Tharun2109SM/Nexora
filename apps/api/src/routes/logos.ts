import express, { Router } from 'express'
import { z } from 'zod'

import { idParameterSchema } from '@nexora/contracts'

import { AppError } from '../lib/errors.js'
import { isR2Configured } from '../lib/env.js'
import { deletePrivateObject, getPrivateObject, putLogo, validateLogo } from '../lib/r2.js'
import { createCallerClient, throwDatabaseError } from '../lib/supabase.js'
import { requireOrganizationAccess } from '../middleware/auth.js'

export const logosRouter = Router()
const logoRowSchema = z.object({ logo_object_key: z.string().nullable() })

logosRouter.get(
  '/organizations/:organizationId/logo',
  requireOrganizationAccess,
  async (request, response, next) => {
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const { data, error } = await createCallerClient(request.accessToken)
        .from('organizations')
        .select('logo_object_key')
        .eq('id', organizationId)
        .single()
      throwDatabaseError(error, 'Organization logo not found.')
      const row = logoRowSchema.parse(data)
      if (!row.logo_object_key)
        throw new AppError(404, 'LOGO_NOT_FOUND', 'This organization does not have a logo.')
      const object = await getPrivateObject(row.logo_object_key)
      response.setHeader('cache-control', 'private, max-age=300')
      response.type(object.contentType).send(object.bytes)
    } catch (error) {
      next(error)
    }
  },
)

logosRouter.put(
  '/organizations/:organizationId/logo',
  requireOrganizationAccess,
  express.raw({ limit: '2mb', type: ['image/jpeg', 'image/png', 'image/webp'] }),
  async (request, response, next) => {
    let newKey: string | undefined
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const identity = request.identity
      const canManage =
        identity &&
        (identity.role === 'BEAUROI_ADMIN' ||
          identity.role === 'BEAUROI_EMPLOYEE' ||
          (identity.role === 'CUSTOMER_ADMIN' && identity.organizationId === organizationId))
      if (!canManage)
        throw new AppError(
          403,
          'ORGANIZATION_ADMIN_REQUIRED',
          'Organization administrator access is required.',
        )
      if (!isR2Configured)
        throw new AppError(
          503,
          'FILE_STORAGE_NOT_CONFIGURED',
          'Logo upload is unavailable until private file storage is configured.',
        )
      if (!Buffer.isBuffer(request.body))
        throw new AppError(400, 'INVALID_LOGO', 'An image body is required.')
      const validated = validateLogo(
        request.body,
        request.header('content-type'),
        request.header('x-file-name'),
      )
      const supabase = createCallerClient(request.accessToken)
      const current = await supabase
        .from('organizations')
        .select('logo_object_key')
        .eq('id', organizationId)
        .single()
      throwDatabaseError(current.error, 'Organization not found.')
      const currentRow = logoRowSchema.parse(current.data)
      newKey = await putLogo(
        organizationId,
        request.body,
        validated.contentType,
        validated.extension,
      )
      const update = await supabase
        .from('organizations')
        .update({ logo_object_key: newKey })
        .eq('id', organizationId)
        .select('id')
        .single()
      throwDatabaseError(update.error, 'Unable to save the organization logo.')
      if (currentRow.logo_object_key) {
        try {
          await deletePrivateObject(currentRow.logo_object_key)
        } catch (error) {
          request.log.warn({ err: error, organizationId }, 'Old logo cleanup failed')
        }
      }
      response.status(201).json({ data: { logoAvailable: true } })
    } catch (error) {
      if (newKey) {
        try {
          await deletePrivateObject(newKey)
        } catch {
          /* best-effort rollback */
        }
      }
      next(error)
    }
  },
)
