import { z } from 'zod'

const environmentSchema = z
  .object({
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_BUCKET_NAME: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
    SUPABASE_URL: z.url().optional(),
    WEB_APP_URL: z.url().default('http://localhost:3000'),
  })
  .superRefine((value, context) => {
    const r2Values = [
      value.R2_ACCESS_KEY_ID,
      value.R2_ACCOUNT_ID,
      value.R2_BUCKET_NAME,
      value.R2_SECRET_ACCESS_KEY,
    ]
    const supplied = r2Values.filter(Boolean).length
    if (supplied !== 0 && supplied !== r2Values.length) {
      context.addIssue({
        code: 'custom',
        message: 'Provide all Cloudflare R2 values or none of them.',
      })
    }
  })

const result = environmentSchema.safeParse(process.env)
if (!result.success) {
  throw new Error(`Invalid API environment: ${z.prettifyError(result.error)}`)
}

export const environment = result.data
export const isSupabaseConfigured = Boolean(
  environment.SUPABASE_URL && environment.SUPABASE_PUBLISHABLE_KEY,
)
export const isR2Configured = Boolean(environment.R2_ACCOUNT_ID)
