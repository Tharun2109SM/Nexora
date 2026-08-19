import crypto from 'node:crypto'

import cors from 'cors'
import express, { type Router } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import pino from 'pino'
import { pinoHttp } from 'pino-http'

import { environment } from './lib/env.js'
import { AppError, errorHandler, notFoundHandler } from './lib/errors.js'
import { SupabaseAccessTokenVerifier } from './lib/supabase-verifier.js'
import { authenticate } from './middleware/auth.js'
import { healthRouter } from './routes/health.js'
import { customersRouter } from './routes/customers.js'
import { logosRouter } from './routes/logos.js'
import { meRouter } from './routes/me.js'
import { organizationsRouter } from './routes/organizations.js'
import { supportRouter } from './routes/support.js'
import { workflowsRouter } from './routes/workflows.js'
import type { AccessTokenVerifier } from './types.js'

interface CreateAppOptions {
  supportRouter?: Router
}

export function createApp(
  verifier: AccessTokenVerifier = new SupabaseAccessTokenVerifier(),
  options: CreateAppOptions = {},
) {
  const app = express()
  const logger = pino({
    level: environment.LOG_LEVEL,
    redact: {
      censor: '[Redacted]',
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
  })

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(
    pinoHttp({
      genReqId(request, response) {
        const incoming = request.headers['x-request-id']
        const requestId =
          typeof incoming === 'string' && incoming.length <= 128 ? incoming : crypto.randomUUID()
        response.setHeader('x-request-id', requestId)
        return requestId
      },
      logger,
    }),
  )
  app.use((request, _response, next) => {
    request.requestId =
      typeof request.id === 'string'
        ? request.id
        : typeof request.id === 'number'
          ? request.id.toString()
          : crypto.randomUUID()
    next()
  })
  app.use(helmet())
  app.use(
    cors({
      allowedHeaders: ['authorization', 'content-type', 'x-file-name', 'x-request-id'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      origin: environment.WEB_APP_URL,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(
    rateLimit({
      handler(_request, _response, next) {
        next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Try again later.'))
      },
      legacyHeaders: false,
      limit: environment.NODE_ENV === 'test' ? 1000 : 150,
      standardHeaders: 'draft-8',
      windowMs: 15 * 60 * 1000,
    }),
  )

  app.use(healthRouter)
  app.use(
    '/v1',
    authenticate(verifier),
    meRouter,
    customersRouter,
    organizationsRouter,
    logosRouter,
    workflowsRouter,
    options.supportRouter ?? supportRouter,
  )
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
