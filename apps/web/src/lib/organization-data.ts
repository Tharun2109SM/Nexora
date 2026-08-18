import { z } from 'zod'

const profileSchema = z
  .object({ designation: z.string().nullable(), full_name: z.string(), id: z.uuid() })
  .strict()

export const organizationResponseSchema = z
  .object({
    data: z
      .object({
        assignments: z.array(
          z
            .object({
              assigned_at: z.string(),
              assignment_type: z.string(),
              employee_user_id: z.uuid(),
              id: z.uuid(),
            })
            .strict(),
        ),
        assignmentProfiles: z.array(profileSchema),
        invitations: z.array(
          z
            .object({
              accepted_at: z.string().nullable(),
              created_at: z.string(),
              expires_at: z.string(),
              id: z.uuid(),
              intended_role: z.string(),
              normalized_email: z.email(),
              revoked_at: z.string().nullable(),
              status: z.string(),
            })
            .strict(),
        ),
        members: z.array(
          z
            .object({
              id: z.uuid(),
              joined_at: z.string().nullable(),
              profiles: profileSchema.omit({ id: true }).nullable(),
              role: z.string(),
              status: z.string(),
              user_id: z.uuid(),
            })
            .strict(),
        ),
        organization: z
          .object({
            company_size: z.string().nullable(),
            country: z.string().nullable(),
            id: z.uuid(),
            industry: z.string().nullable(),
            lifecycle_status: z.string(),
            logo_available: z.boolean(),
            name: z.string(),
            website: z.string().nullable(),
          })
          .strict(),
        storage: z.object({ logoUploadsAvailable: z.boolean() }).strict(),
        subscriptions: z.array(z.unknown()),
      })
      .strict(),
  })
  .strict()
