import {
  assignmentCreateSchema,
  canManageStaffInvitations,
  customerCursorSchema,
  customerListQuerySchema,
  healthScoreCreateSchema,
  idParameterSchema,
  invitationSchema,
  lifecycleUpdateSchema,
  organizationProfileUpdateSchema,
} from '@nexora/contracts'
import { Router } from 'express'
import { z } from 'zod'

import { AppError } from '../lib/errors.js'
import { isR2Configured } from '../lib/env.js'
import { createCallerClient, throwDatabaseError } from '../lib/supabase.js'
import { requireBeauRoi, requireOrganizationAccess } from '../middleware/auth.js'

const summaryRowSchema = z.object({
  company_size: z.string().nullable(),
  country: z.string().nullable(),
  created_at: z.string(),
  current_product_version: z.string().nullable(),
  csm_name: z.string().nullable(),
  health_score: z.coerce.number().nullable(),
  id: z.uuid(),
  implementation_engineer_name: z.string().nullable(),
  industry: z.string().nullable(),
  last_activity_at: z.string().nullable(),
  lifecycle_status: lifecycleUpdateSchema.shape.status,
  logo_object_key: z.string().nullable(),
  name: z.string(),
  open_ticket_count: z.coerce.number().int().nonnegative(),
})

const organizationRowSchema = z.object({
  company_size: z.string().nullable(),
  country: z.string().nullable(),
  id: z.uuid(),
  industry: z.string().nullable(),
  lifecycle_status: lifecycleUpdateSchema.shape.status,
  logo_object_key: z.string().nullable(),
  name: z.string(),
  website: z.string().nullable(),
})
const assignmentIdentityRowsSchema = z.array(z.object({ employee_user_id: z.uuid() }))
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

function encodeCursor(value: z.infer<typeof customerCursorSchema>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decodeCursor(value: string | undefined) {
  if (!value) return undefined
  try {
    return customerCursorSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString()) as unknown,
    )
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.')
  }
}

function escapeFilterValue(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

export const customersRouter = Router()

customersRouter.get('/staff', requireBeauRoi, async (request, response, next) => {
  try {
    const supabase = createCallerClient(request.accessToken)
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('user_id, role')
      .eq('status', 'ACTIVE')
      .in('role', ['BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE'])
    throwDatabaseError(error, 'Unable to load Beau Roi staff.')
    const rows = z.array(z.object({ role: z.string(), user_id: z.uuid() })).parse(data ?? [])
    const userIds = [...new Set(rows.map((row) => row.user_id))]
    const profiles =
      userIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from('profiles')
            .select('id, full_name, designation')
            .in('id', userIds)
            .order('full_name')
    throwDatabaseError(profiles.error, 'Unable to load Beau Roi staff.')
    response.json({ data: profiles.data ?? [] })
  } catch (error) {
    next(error)
  }
})

customersRouter.get('/customers', requireBeauRoi, async (request, response, next) => {
  try {
    const input = customerListQuerySchema.parse(request.query)
    const cursor = decodeCursor(input.cursor)
    if (cursor && cursor.sort !== input.sort)
      throw new AppError(400, 'INVALID_CURSOR', 'The cursor does not match the selected sort.')
    const supabase = createCallerClient(request.accessToken)
    let query = supabase.from('customer_management_summary').select('*')
    if (input.search) query = query.ilike('name', `%${input.search}%`)
    if (input.lifecycle) query = query.eq('lifecycle_status', input.lifecycle)
    if (input.industry) query = query.eq('industry', input.industry)
    if (input.country) query = query.eq('country', input.country)
    if (input.assignment === 'assigned') query = query.not('csm_user_id', 'is', null)
    if (input.assignment === 'unassigned') query = query.is('csm_user_id', null)
    if (input.healthBand === 'healthy') query = query.gte('health_score', 70)
    if (input.healthBand === 'watch') query = query.gte('health_score', 40).lt('health_score', 70)
    if (input.healthBand === 'at-risk') query = query.lt('health_score', 40)
    if (input.healthBand === 'unassessed') query = query.is('health_score', null)

    const ascending = input.sort === 'name-asc' || input.sort === 'oldest'
    const sortColumn = input.sort.startsWith('name') ? 'name' : 'created_at'
    if (cursor) {
      const operation = ascending ? 'gt' : 'lt'
      const value = escapeFilterValue(cursor.value)
      query = query.or(
        `${sortColumn}.${operation}.${value},and(${sortColumn}.eq.${value},id.${operation}.${cursor.id})`,
      )
    }
    query = query
      .order(sortColumn, { ascending })
      .order('id', { ascending })
      .limit(input.limit + 1)
    const { data, error } = await query
    throwDatabaseError(error, 'Unable to load customers.')
    const rows = z.array(summaryRowSchema).parse(data as unknown)
    const hasMore = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    const last = page.at(-1)
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            id: last.id,
            sort: input.sort,
            value: sortColumn === 'name' ? last.name : last.created_at,
          })
        : null
    response.json({
      data: page.map((row) => ({
        companySize: row.company_size,
        country: row.country,
        createdAt: row.created_at,
        currentProductVersion: row.current_product_version,
        csmName: row.csm_name,
        healthScore: row.health_score,
        id: row.id,
        implementationEngineerName: row.implementation_engineer_name,
        industry: row.industry,
        lastActivityAt: row.last_activity_at,
        lifecycleStatus: row.lifecycle_status,
        logoAvailable: row.logo_object_key !== null,
        name: row.name,
        openTicketCount: row.open_ticket_count,
      })),
      meta: { nextCursor },
    })
  } catch (error) {
    next(error)
  }
})

customersRouter.get(
  '/customers/:organizationId',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const supabase = createCallerClient(request.accessToken)
      const canManageInvitations = request.identity
        ? canManageStaffInvitations(request.identity.role)
        : false
      const [
        organizationResult,
        membersResult,
        assignmentsResult,
        healthResult,
        auditResult,
        subscriptionsResult,
        invitationsResult,
      ] = await Promise.all([
        supabase
          .from('organizations')
          .select(
            'id, name, website, industry, company_size, country, lifecycle_status, logo_object_key',
          )
          .eq('id', organizationId)
          .eq('organization_type', 'CUSTOMER')
          .single(),
        supabase
          .from('organization_memberships')
          .select('id, user_id, role, status, joined_at')
          .eq('organization_id', organizationId)
          .order('created_at'),
        supabase
          .from('customer_assignments')
          .select(
            'id, employee_user_id, assignment_type, is_active, assigned_at, ended_at, assigned_by',
          )
          .eq('organization_id', organizationId)
          .order('assigned_at', { ascending: false }),
        supabase
          .from('health_score_history')
          .select('id, score, reason, source, calculated_at, calculated_by')
          .eq('organization_id', organizationId)
          .order('calculated_at', { ascending: false })
          .limit(25),
        supabase
          .from('audit_events')
          .select(
            'id, action, entity_type, entity_id, actor_user_id, actor_role, metadata, occurred_at, request_id',
          )
          .eq('organization_id', organizationId)
          .order('occurred_at', { ascending: false })
          .limit(50),
        supabase
          .from('customer_subscriptions')
          .select('id, status, starts_on, ends_on, products(name, code)')
          .eq('organization_id', organizationId),
        canManageInvitations
          ? supabase.rpc('list_organization_invitations', {
              target_organization_id: organizationId,
            })
          : Promise.resolve({ data: [], error: null }),
      ])
      throwDatabaseError(organizationResult.error, 'Customer not found.')
      for (const result of [
        membersResult,
        assignmentsResult,
        healthResult,
        auditResult,
        subscriptionsResult,
        invitationsResult,
      ]) {
        throwDatabaseError(result.error, 'Unable to load customer details.')
      }
      const organization = organizationRowSchema.parse(organizationResult.data)
      const assignmentRows = assignmentIdentityRowsSchema.parse(assignmentsResult.data ?? [])
      const employeeIds = [...new Set(assignmentRows.map((row) => row.employee_user_id))]
      const memberRows = memberRowsSchema.parse(membersResult.data ?? [])
      const invitationRows = invitationSchema.array().parse(invitationsResult.data ?? [])
      const assignmentProfilesResult =
        employeeIds.length === 0
          ? { data: [], error: null }
          : await supabase
              .from('profiles')
              .select('id, full_name, designation')
              .in('id', employeeIds)
      throwDatabaseError(assignmentProfilesResult.error, 'Unable to load assignment profiles.')
      const memberProfilesResult =
        memberRows.length === 0
          ? { data: [], error: null }
          : await supabase
              .from('profiles')
              .select('id, full_name, designation')
              .in(
                'id',
                memberRows.map((member) => member.user_id),
              )
      throwDatabaseError(memberProfilesResult.error, 'Unable to load member profiles.')
      const assignmentNotesResult: unknown = await supabase.rpc('get_customer_assignment_notes', {
        target_organization_id: organizationId,
      })
      const assignmentNotes = z
        .object({
          data: z.array(z.object({ assignment_id: z.uuid(), note: z.string() })).nullable(),
          error: z.object({ code: z.string().optional(), message: z.string() }).nullable(),
        })
        .loose()
        .parse(assignmentNotesResult)
      throwDatabaseError(assignmentNotes.error, 'Unable to load assignment notes.')
      const memberProfiles = new Map(
        profileRowsSchema
          .parse(memberProfilesResult.data ?? [])
          .map((profile) => [profile.id, profile]),
      )
      response.json({
        data: {
          assignments: assignmentsResult.data ?? [],
          assignmentNotes: assignmentNotes.data ?? [],
          assignmentProfiles: assignmentProfilesResult.data ?? [],
          auditEvents: auditResult.data ?? [],
          canManageInvitations,
          healthHistory: healthResult.data ?? [],
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
            profiles: memberProfiles.has(member.user_id)
              ? {
                  designation: memberProfiles.get(member.user_id)?.designation ?? null,
                  full_name: memberProfiles.get(member.user_id)?.full_name ?? 'Profile unavailable',
                }
              : null,
          })),
          organization: {
            companySize: organization.company_size,
            country: organization.country,
            id: organization.id,
            industry: organization.industry,
            lifecycleStatus: organization.lifecycle_status,
            logoAvailable: organization.logo_object_key !== null,
            name: organization.name,
            website: organization.website,
          },
          storage: { logoUploadsAvailable: isR2Configured },
          subscriptions: subscriptionsResult.data ?? [],
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

customersRouter.patch(
  '/customers/:organizationId/profile',
  requireBeauRoi,
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
        .eq('organization_type', 'CUSTOMER')
        .select('id')
        .single()
      throwDatabaseError(error, 'Unable to update the customer profile.')
      response.json({ data })
    } catch (error) {
      next(error)
    }
  },
)

customersRouter.patch(
  '/customers/:organizationId/lifecycle',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const input = lifecycleUpdateSchema.parse(request.body)
      const { data, error } = await createCallerClient(request.accessToken)
        .from('organizations')
        .update({ lifecycle_status: input.status })
        .eq('id', organizationId)
        .eq('organization_type', 'CUSTOMER')
        .select('id, lifecycle_status')
        .single()
      throwDatabaseError(error, 'Unable to update lifecycle status.')
      response.json({ data })
    } catch (error) {
      next(error)
    }
  },
)

customersRouter.post(
  '/customers/:organizationId/health-scores',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const input = healthScoreCreateSchema.parse(request.body)
      const { data, error } = await createCallerClient(request.accessToken)
        .from('health_score_history')
        .insert({
          organization_id: organizationId,
          reason: input.reason,
          score: input.score,
          source: 'MANUAL',
        })
        .select('id, score, reason, source, calculated_at')
        .single()
      throwDatabaseError(error, 'Unable to record the health score.')
      response.status(201).json({ data })
    } catch (error) {
      next(error)
    }
  },
)

customersRouter.post(
  '/customers/:organizationId/assignments',
  requireBeauRoi,
  async (request, response, next) => {
    try {
      const { organizationId } = idParameterSchema.parse(request.params)
      const input = assignmentCreateSchema.parse(request.body)
      const rpcResult: unknown = await createCallerClient(request.accessToken).rpc(
        'replace_customer_assignment',
        {
          assignment_employee_user_id: input.employeeUserId,
          assignment_internal_note: input.internalNote ?? null,
          assignment_organization_id: organizationId,
          assignment_type_value: input.type,
        },
      )
      const result = z
        .object({
          data: z.uuid().nullable(),
          error: z.object({ code: z.string().optional(), message: z.string() }).nullable(),
        })
        .loose()
        .parse(rpcResult)
      throwDatabaseError(result.error, 'Unable to replace the customer assignment.')
      response.status(201).json({ data: { id: result.data } })
    } catch (error) {
      next(error)
    }
  },
)

customersRouter.get(
  '/organizations/:organizationId/access',
  requireOrganizationAccess,
  (_request, response) => response.status(204).send(),
)
