import crypto from 'node:crypto'

import {
  idParameterSchema,
  invitationAcceptSchema,
  invitationCreateSchema,
  invitationParameterSchema,
  memberMutationSchema,
  membershipParameterSchema,
  organizationProfileUpdateSchema,
} from '@nexora/contracts'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'

import { environment, isR2Configured } from '../lib/env.js'
import { AppError } from '../lib/errors.js'
import { invitationDelivery } from '../lib/invitations.js'
import { createCallerClient, throwDatabaseError } from '../lib/supabase.js'
import { requireOrganizationAccess, requireOrganizationAdmin } from '../middleware/auth.js'

const invitationLimiter = rateLimit({
  handler(_request, _response, next) {
    next(new AppError(429, 'RATE_LIMITED', 'Too many invitation attempts. Try again later.'))
  },
  legacyHeaders: false,
  limit: 10,
  standardHeaders: 'draft-8',
  windowMs: 15 * 60 * 1000,
})

export const organizationsRouter = Router()
const assignmentIdentityRowsSchema = z.array(z.object({ employee_user_id: z.uuid() }))
const invitationRowsSchema = z.array(
  z.object({
    accepted_at: z.string().nullable(),
    created_at: z.string(),
    expires_at: z.string(),
    id: z.uuid(),
    intended_role: z.string(),
    normalized_email: z.string(),
    revoked_at: z.string().nullable(),
    status: z.string(),
  }),
)
const memberRowsSchema = z.array(
  z.object({
    id: z.uuid(),
    joined_at: z.string().nullable(),
    role: z.string(),
    status: z.string(),
    user_id: z.uuid(),
  }),
)
const profileRowsSchema = z.array(
  z.object({ designation: z.string().nullable(), full_name: z.string(), id: z.uuid() }),
)
const organizationRowSchema = z.object({
  company_size: z.string().nullable(),
  country: z.string().nullable(),
  id: z.uuid(),
  industry: z.string().nullable(),
  lifecycle_status: z.string(),
  logo_object_key: z.string().nullable(),
  name: z.string(),
  website: z.string().nullable(),
})

organizationsRouter.get(
  '/organizations/:organizationId',
  requireOrganizationAccess,
  async (request, response, next) => {
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const supabase = createCallerClient(request.accessToken)
      const [organization, members, assignments, subscriptions, invitations] = await Promise.all([
        supabase
          .from('organizations')
          .select(
            'id, name, website, industry, company_size, country, lifecycle_status, logo_object_key',
          )
          .eq('id', organizationId)
          .single(),
        supabase
          .from('organization_memberships')
          .select('id, user_id, role, status, joined_at')
          .eq('organization_id', organizationId)
          .order('created_at'),
        supabase
          .from('customer_assignments')
          .select('id, employee_user_id, assignment_type, assigned_at')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .in('assignment_type', ['CSM', 'IMPLEMENTATION_ENGINEER']),
        supabase
          .from('customer_subscriptions')
          .select('id, status, starts_on, ends_on, products(name, code)')
          .eq('organization_id', organizationId),
        supabase
          .from('organization_invitations')
          .select(
            'id, normalized_email, intended_role, status, created_at, expires_at, accepted_at, revoked_at',
          )
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false }),
      ])
      throwDatabaseError(organization.error, 'Organization not found.')
      for (const result of [members, assignments, subscriptions, invitations])
        throwDatabaseError(result.error, 'Unable to load organization details.')

      const assignmentRows = assignmentIdentityRowsSchema.parse(assignments.data ?? [])
      const employeeIds = assignmentRows.map((row) => row.employee_user_id)
      const memberRows = memberRowsSchema.parse(members.data ?? [])
      const profileIds = [
        ...new Set([...employeeIds, ...memberRows.map((member) => member.user_id)]),
      ]
      const profiles =
        profileIds.length === 0
          ? { data: [], error: null }
          : await supabase
              .from('profiles')
              .select('id, full_name, designation')
              .in('id', profileIds)
      throwDatabaseError(profiles.error, 'Unable to load assigned contacts.')
      const profileRows = profileRowsSchema.parse(profiles.data ?? [])
      const profileById = new Map(profileRows.map((profile) => [profile.id, profile]))
      const invitationRows = invitationRowsSchema.parse(invitations.data ?? [])
      const organizationRow = organizationRowSchema.parse(organization.data)

      response.json({
        data: {
          assignments: assignments.data ?? [],
          assignmentProfiles: profileRows.filter((profile) => employeeIds.includes(profile.id)),
          invitations: invitationRows.map((invitation) => ({
            ...invitation,
            status:
              invitation.status === 'PENDING' &&
              new Date(invitation.expires_at).getTime() <= Date.now()
                ? 'EXPIRED'
                : invitation.status,
          })),
          members: memberRows.map((member) => ({
            ...member,
            profiles: profileById.has(member.user_id)
              ? {
                  designation: profileById.get(member.user_id)?.designation ?? null,
                  full_name: profileById.get(member.user_id)?.full_name ?? 'Profile unavailable',
                }
              : null,
          })),
          organization: {
            company_size: organizationRow.company_size,
            country: organizationRow.country,
            id: organizationRow.id,
            industry: organizationRow.industry,
            lifecycle_status: organizationRow.lifecycle_status,
            logo_available: organizationRow.logo_object_key !== null,
            name: organizationRow.name,
            website: organizationRow.website,
          },
          storage: { logoUploadsAvailable: isR2Configured },
          subscriptions: subscriptions.data ?? [],
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

organizationsRouter.patch(
  '/organizations/:organizationId',
  requireOrganizationAdmin,
  async (request, response, next) => {
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const input = organizationProfileUpdateSchema.parse(request.body)
      const { data, error } = await createCallerClient(request.accessToken)
        .from('organizations')
        .update({
          company_size: input.companySize,
          country: input.country,
          industry: input.industry,
          name: input.name,
          website: input.website === '' ? null : input.website,
        })
        .eq('id', organizationId)
        .select('id, name, website, industry, company_size, country')
        .single()
      throwDatabaseError(error, 'Unable to update the organization profile.')
      response.json({ data })
    } catch (error) {
      next(error)
    }
  },
)

organizationsRouter.patch(
  '/organizations/:organizationId/members/:membershipId',
  requireOrganizationAdmin,
  async (request, response, next) => {
    try {
      const { membershipId, organizationId } = membershipParameterSchema.parse(request.params)
      const input = memberMutationSchema.parse(request.body)
      const changes: {
        role?: 'CUSTOMER_ADMIN' | 'CUSTOMER_MEMBER'
        status?: 'ACTIVE' | 'SUSPENDED' | 'REMOVED'
      } = {}
      if (input.role) changes.role = input.role
      if (input.status) changes.status = input.status
      const { data, error } = await createCallerClient(request.accessToken)
        .from('organization_memberships')
        .update(changes)
        .eq('id', membershipId)
        .eq('organization_id', organizationId)
        .in('role', ['CUSTOMER_ADMIN', 'CUSTOMER_MEMBER'])
        .select('id, role, status')
        .single()
      throwDatabaseError(error, 'Unable to update the member.')
      response.json({ data })
    } catch (error) {
      next(error)
    }
  },
)

organizationsRouter.post(
  '/organizations/:organizationId/invitations',
  invitationLimiter,
  requireOrganizationAdmin,
  async (request, response, next) => {
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const input = invitationCreateSchema.parse(request.body)
      if (!request.identity) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.')
      const token = crypto.randomBytes(32).toString('base64url')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      const { data, error } = await createCallerClient(request.accessToken)
        .from('organization_invitations')
        .insert({
          expires_at: expiresAt,
          intended_role: input.role,
          invited_by: request.identity.userId,
          normalized_email: input.email,
          organization_id: organizationId,
          token_hash: tokenHash,
        })
        .select('id, normalized_email, intended_role, created_at, expires_at, status')
        .single()
      throwDatabaseError(error, 'Unable to create the invitation.')
      const invitationUrl = `${environment.WEB_APP_URL}/invitations/accept?token=${encodeURIComponent(token)}`
      await invitationDelivery.deliver({ email: input.email, invitationUrl })
      response.status(201).json({
        data: { ...data, deliveryConfigured: invitationDelivery.configured, invitationUrl },
        message: invitationDelivery.configured
          ? 'Invitation created and queued for delivery.'
          : 'Invitation created. Email delivery is not configured; copy this link now.',
      })
    } catch (error) {
      next(error)
    }
  },
)

organizationsRouter.delete(
  '/organizations/:organizationId/invitations/:invitationId',
  requireOrganizationAdmin,
  async (request, response, next) => {
    try {
      const { invitationId, organizationId } = invitationParameterSchema.parse(request.params)
      if (!request.identity) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.')
      const { data, error } = await createCallerClient(request.accessToken)
        .from('organization_invitations')
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: request.identity.userId,
          status: 'REVOKED',
        })
        .eq('id', invitationId)
        .eq('organization_id', organizationId)
        .eq('status', 'PENDING')
        .select('id, status')
        .single()
      throwDatabaseError(error, 'Unable to revoke the invitation.')
      response.json({ data })
    } catch (error) {
      next(error)
    }
  },
)

organizationsRouter.post('/invitations/accept', async (request, response, next) => {
  try {
    const input = invitationAcceptSchema.parse(request.body)
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex')
    const rpcResult: unknown = await createCallerClient(request.accessToken).rpc(
      'accept_organization_invitation',
      { invitation_token_hash: tokenHash },
    )
    const result = z
      .object({ data: z.uuid().nullable(), error: z.unknown().nullable() })
      .loose()
      .parse(rpcResult)
    if (result.error)
      throw new AppError(
        400,
        'INVITATION_UNAVAILABLE',
        'The invitation is invalid, expired, revoked, already used, or does not match your signed-in email.',
      )
    response.json({ data: { organizationId: result.data } })
  } catch (error) {
    next(error)
  }
})
