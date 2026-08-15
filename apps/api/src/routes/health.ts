import { Router } from 'express'

import { isR2Configured, isSupabaseConfigured } from '../lib/env.js'

export const healthRouter = Router()

healthRouter.get('/health', (_request, response) => {
  response.json({ service: 'nexora-api', status: 'ok', timestamp: new Date().toISOString() })
})

healthRouter.get('/ready', (_request, response) => {
  const ready = isSupabaseConfigured
  response.status(ready ? 200 : 503).json({
    checks: {
      r2: isR2Configured ? 'configured' : 'not_configured',
      supabase: isSupabaseConfigured ? 'configured' : 'not_configured',
    },
    status: ready ? 'ready' : 'not_ready',
  })
})
