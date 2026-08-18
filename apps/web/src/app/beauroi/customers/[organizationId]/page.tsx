import { customerDetailResponseSchema } from '@nexora/contracts'
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Clock3,
  HeartPulse,
  History,
  ImageIcon,
  MailPlus,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { z } from 'zod'

import {
  createStaffInvitation,
  recordHealthScore,
  replaceAssignment,
  revokeStaffInvitation,
  updateCustomerProfile,
  updateLifecycle,
  uploadLogo,
} from '@/app/management-actions'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { CopyField } from '@/components/copy-field'
import { HealthIndicator } from '@/components/health-indicator'
import { PageHeader } from '@/components/ui'
import { apiRequest, ApiRequestError } from '@/lib/api'
import { staffCustomerPresentation } from '@/lib/staff-customer-presentation'

const detailSchema = customerDetailResponseSchema
const staffSchema = z.object({
  data: z.array(
    z.object({ designation: z.string().nullable(), full_name: z.string(), id: z.uuid() }),
  ),
})
const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const getCustomerDetail = cache(async (organizationId: string) =>
  detailSchema.parse(await apiRequest(`/customers/${organizationId}`)),
)

interface DetailProps {
  params: Promise<{ organizationId: string }>
  searchParams: Promise<{ invitation?: string }>
}

export async function generateMetadata({ params }: DetailProps): Promise<Metadata> {
  const { organizationId } = await params
  try {
    const result = await getCustomerDetail(organizationId)
    return { title: result.data.organization.name }
  } catch {
    return { title: 'Customer detail' }
  }
}

export default async function CustomerDetailPage({ params, searchParams }: DetailProps) {
  const { organizationId } = await params
  let result: z.infer<typeof detailSchema>
  try {
    result = await getCustomerDetail(organizationId)
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') notFound()
    throw error
  }
  const staff = staffSchema.parse(await apiRequest('/staff')).data
  const { organization } = result.data
  const latestHealth = result.data.healthHistory[0]?.score ?? null
  const profileById = new Map(
    result.data.assignmentProfiles.map((profile) => [profile.id, profile]),
  )
  const noteByAssignmentId = new Map(
    result.data.assignmentNotes.map((item) => [item.assignment_id, item.note]),
  )
  const invitationLink = (await searchParams).invitation
  const presentation = staffCustomerPresentation(result.data)
  return (
    <div className="space-y-7">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"
        href="/beauroi/customers"
      >
        <ArrowLeft aria-hidden size={15} /> Back to customers
      </Link>
      <PageHeader
        description="Company profile, customer health, access invitations, ownership, lifecycle, and verified activity."
        eyebrow="Customer record"
        title={organization.name}
      />
      {invitationLink && result.data.canManageInvitations && (
        <section className="rounded-lg border border-accent/30 bg-accent-soft p-5">
          <h2 className="font-display text-lg font-semibold">Invitation created</h2>
          <p className="mt-1 text-sm text-muted">
            Email delivery is not configured. Copy this secure link now; NEXORA will not show the
            raw token again.
          </p>
          <div className="mt-4">
            <CopyField value={invitationLink} />
          </div>
        </section>
      )}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={<HeartPulse size={17} />} label="Health">
          <HealthIndicator score={latestHealth} />
        </Summary>
        <Summary icon={<Users size={17} />} label="Members">
          {result.data.members.length}
        </Summary>
        <Summary icon={<BriefcaseBusiness size={17} />} label="Active assignments">
          {result.data.assignments.filter((item) => item.is_active).length}
        </Summary>
        <Summary icon={<Clock3 size={17} />} label="Lifecycle">
          {organization.lifecycleStatus}
        </Summary>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={<Building2 size={18} />} title="Company profile">
          <form
            action={updateCustomerProfile.bind(null, organizationId)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Company name" name="name" defaultValue={organization.name} required />
            <Field
              label="Website"
              name="website"
              defaultValue={organization.website ?? ''}
              type="url"
            />
            <Field label="Industry" name="industry" defaultValue={organization.industry ?? ''} />
            <Field label="Country" name="country" defaultValue={organization.country ?? ''} />
            <label className="grid gap-1.5 text-sm font-medium">
              Company size
              <select
                className={inputClass}
                defaultValue={organization.companySize ?? ''}
                name="companySize"
              >
                <option value="">Not provided</option>
                {['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <ConfirmSubmit label="Save profile" />
            </div>
          </form>
        </Panel>
        <Panel icon={<ImageIcon size={18} />} title="Organization logo">
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-accent-soft font-display text-2xl font-semibold text-accent">
              {organization.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="font-semibold">{presentation.logoStatus}</p>
              <p className="text-xs text-muted">
                Private storage details and object identifiers are never exposed here.
              </p>
            </div>
          </div>
          {!presentation.logoUploadUnavailable ? (
            <form
              action={uploadLogo.bind(null, organizationId)}
              className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5"
            >
              <label className="grid gap-1.5 text-sm font-medium">
                PNG, JPEG, or WebP · maximum 2 MB
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className={inputClass}
                  name="logo"
                  required
                  type="file"
                />
              </label>
              <ConfirmSubmit label="Upload logo" />
            </form>
          ) : (
            <div className="mt-5 border-t border-border pt-5">
              <p className="text-sm font-semibold">Logo upload unavailable</p>
              <p className="mt-1 text-sm text-muted">
                Private Cloudflare R2 storage is not configured. Existing customer administration
                remains available, but NEXORA will not present a non-functional upload control.
              </p>
            </div>
          )}
        </Panel>
        <Panel icon={<Clock3 size={18} />} title="Lifecycle">
          <form
            action={updateLifecycle.bind(null, organizationId)}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <label className="grid flex-1 gap-1.5 text-sm font-medium">
              Status
              <select
                className={inputClass}
                defaultValue={organization.lifecycleStatus}
                name="status"
              >
                {['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <ConfirmSubmit
              confirmMessage="Change this customer's lifecycle status?"
              label="Update lifecycle"
            />
          </form>
          <p className="mt-4 text-xs text-subtle">
            Lifecycle changes are recorded in the append-only audit history.
          </p>
        </Panel>
        <Panel icon={<HeartPulse size={18} />} title="Health history">
          <form
            action={recordHealthScore.bind(null, organizationId)}
            className="grid gap-4 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
          >
            <Field label="Score (0–100)" max="100" min="0" name="score" required type="number" />
            <Field label="Required reason" name="reason" required />
            <ConfirmSubmit label="Record score" />
          </form>
          <div className="mt-5 divide-y divide-border">
            {result.data.healthHistory.length === 0 ? (
              <p className="py-4 text-sm text-muted">
                Not assessed. No inferred adoption or satisfaction values are shown.
              </p>
            ) : (
              result.data.healthHistory.map((health) => (
                <div className="flex items-start justify-between gap-4 py-3" key={health.id}>
                  <div>
                    <HealthIndicator score={health.score} />
                    <p className="mt-1 text-sm text-muted">{health.reason}</p>
                  </div>
                  <time className="shrink-0 text-xs text-subtle">
                    {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                      new Date(health.calculated_at),
                    )}
                  </time>
                </div>
              ))
            )}
          </div>
        </Panel>
        <Panel icon={<BriefcaseBusiness size={18} />} title="Assignments">
          <form
            action={replaceAssignment.bind(null, organizationId)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="grid gap-1.5 text-sm font-medium">
              Responsibility
              <select className={inputClass} name="type">
                <option value="CSM">Customer Success Manager</option>
                <option value="IMPLEMENTATION_ENGINEER">Implementation Engineer</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Beau Roi colleague
              <select className={inputClass} name="employeeUserId" required>
                <option value="">Select a colleague</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                    {person.designation ? ` · ${person.designation}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Internal note (not shown to customers)" name="internalNote" />
            <div className="flex items-end">
              <ConfirmSubmit
                confirmMessage="Replace the active assignment and retain the previous one in history?"
                label="Save assignment"
              />
            </div>
          </form>
          <div className="mt-5 divide-y divide-border">
            {result.data.assignments.length === 0 ? (
              <p className="py-4 text-sm text-muted">No assignments have been made.</p>
            ) : (
              result.data.assignments.map((assignment) => (
                <div className="flex items-center justify-between gap-4 py-3" key={assignment.id}>
                  <div>
                    <p className="text-sm font-semibold">
                      {assignment.assignment_type === 'CSM'
                        ? 'Customer Success Manager'
                        : 'Implementation Engineer'}
                    </p>
                    <p className="text-xs text-muted">
                      {profileById.get(assignment.employee_user_id)?.full_name ??
                        'Profile unavailable'}{' '}
                      · {assignment.is_active ? 'Active' : 'Historical'}
                    </p>
                    {noteByAssignmentId.get(assignment.id) && (
                      <p className="mt-1 text-xs text-subtle">
                        Internal: {noteByAssignmentId.get(assignment.id)}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-subtle">
                    {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                      new Date(assignment.assigned_at),
                    )}
                  </time>
                </div>
              ))
            )}
          </div>
        </Panel>
        <Panel icon={<Users size={18} />} title="People">
          <div className="divide-y divide-border">
            {result.data.members.map((member) => (
              <div className="flex items-center justify-between gap-4 py-3" key={member.id}>
                <div>
                  <p className="text-sm font-semibold">
                    {member.profiles?.full_name ?? 'Profile unavailable'}
                  </p>
                  <p className="text-xs text-muted">
                    {member.profiles?.designation ?? 'Designation not provided'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">{member.role.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-subtle">{member.status}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel icon={<MailPlus size={18} />} title="Invitations">
          {presentation.invitationControlsVisible ? (
            <form
              action={createStaffInvitation.bind(null, organizationId)}
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
            >
              <Field label="Work email" name="email" required type="email" />
              <label className="grid gap-1.5 text-sm font-medium">
                Role
                <select className={inputClass} name="role">
                  <option value="CUSTOMER_MEMBER">Customer member</option>
                  <option value="CUSTOMER_ADMIN">Customer admin</option>
                </select>
              </label>
              <ConfirmSubmit label="Create invitation" />
            </form>
          ) : (
            <p className="text-sm text-muted">
              Invitation details and controls are available only to Beau Roi administrators.
            </p>
          )}
          {presentation.invitationControlsVisible && (
            <div className="mt-5 divide-y divide-border">
              {result.data.invitations.length === 0 ? (
                <p className="py-4 text-sm text-muted">{presentation.invitationEmptyState}</p>
              ) : (
                result.data.invitations.map((invitation) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                    key={invitation.id}
                  >
                    <div>
                      <p className="text-sm font-semibold">{invitation.normalized_email}</p>
                      <p className="text-xs text-muted">
                        {invitation.intended_role.replaceAll('_', ' ')} · {invitation.status}
                      </p>
                    </div>
                    {invitation.status === 'PENDING' && (
                      <form
                        action={revokeStaffInvitation.bind(null, organizationId, invitation.id)}
                      >
                        <ConfirmSubmit
                          confirmMessage="Revoke this invitation? Its link will stop working immediately."
                          label="Revoke"
                          variant="quiet"
                        />
                      </form>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-subtle">
            <ShieldCheck aria-hidden className="mt-0.5 shrink-0" size={14} /> Invitation tokens are
            single-use and accepted only by the signed-in account matching the normalized email.
            Token hashes are never returned to this page.
          </p>
        </Panel>
        <Panel icon={<History size={18} />} title="Recent activity">
          <div className="divide-y divide-border">
            {result.data.auditEvents.length === 0 ? (
              <p className="py-4 text-sm text-muted">No recorded activity yet.</p>
            ) : (
              result.data.auditEvents.map((event) => (
                <div className="py-3" key={event.id}>
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-semibold">{event.action.replaceAll('_', ' ')}</p>
                    <time className="text-xs text-subtle">
                      {new Intl.DateTimeFormat('en', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(event.occurred_at))}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Actor role: {event.actor_role?.replaceAll('_', ' ') ?? 'Unavailable'}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Panel({
  children,
  icon,
  title,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  title: string
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-accent-soft text-accent">
          {icon}
        </span>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}
function Summary({
  children,
  icon,
  label,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between text-xs font-semibold tracking-[0.07em] text-subtle uppercase">
        <span>{label}</span>
        <span>{icon}</span>
      </div>
      <div className="mt-4 font-display text-xl font-semibold">{children}</div>
    </div>
  )
}
function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input className={inputClass} name={name} {...props} />
    </label>
  )
}
