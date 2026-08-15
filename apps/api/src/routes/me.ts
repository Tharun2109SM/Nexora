import { Router } from 'express'
import { z } from 'zod'

import { requireOrganizationAccess } from '../middleware/auth.js'

export const meRouter = Router()

meRouter.get('/me', (request, response) => {
  response.json({ data: request.identity })
})

meRouter.get(
  '/organizations/:organizationId/access-check',
  requireOrganizationAccess,
  (request, response, next) => {
    const parsed = z.uuid().safeParse(request.params.organizationId)
    if (!parsed.success) {
      next(parsed.error)
      return
    }
    response.status(204).send()
  },
)
