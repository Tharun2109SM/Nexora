import { BriefcaseBusiness, Building2, MailPlus, ShieldCheck, Users } from 'lucide-react'
import type { Metadata } from 'next'
import { z } from 'zod'

import {
  createInvitation,
  revokeInvitation,
  updateMember,
  updateOrganizationProfile,
  uploadLogo,
} from '@/app/management-actions'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { CopyField } from '@/components/copy-field'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Organization administration' }
const organizationSchema = z.object({
  data: z.object({
    assignments: z.array(
      z
        .object({
          assigned_at: z.string(),
          assignment_type: z.string(),
          employee_user_id: z.uuid(),
          id: z.uuid(),
        })
        .loose(),
    ),
    assignmentProfiles: z.array(
      z.object({ designation: z.string().nullable(), full_name: z.string(), id: z.uuid() }).loose(),
    ),
    invitations: z.array(
      z
        .object({
          accepted_at: z.string().nullable(),
          created_at: z.string(),
          expires_at: z.string(),
          id: z.uuid(),
          intended_role: z.string(),
          normalized_email: z.string(),
          revoked_at: z.string().nullable(),
          status: z.string(),
        })
        .loose(),
    ),
    members: z.array(
      z
        .object({
          id: z.uuid(),
          joined_at: z.string().nullable(),
          profiles: z
            .object({ designation: z.string().nullable(), full_name: z.string() })
            .nullable(),
          role: z.string(),
          status: z.string(),
          user_id: z.uuid(),
        })
        .loose(),
    ),
    organization: z.object({
      company_size: z.string().nullable(),
      country: z.string().nullable(),
      id: z.uuid(),
      industry: z.string().nullable(),
      lifecycle_status: z.string(),
      logo_available: z.boolean(),
      name: z.string(),
      website: z.string().nullable(),
    }),
    storage: z.object({ logoUploadsAvailable: z.boolean() }),
    subscriptions: z.array(z.unknown()),
  }),
})
const inputClass =
  'h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

interface OrganizationPageProps {
  searchParams: Promise<{ invitation?: string }>
}

export default async function OrganizationPage({ searchParams }: OrganizationPageProps) {
  const viewer = await requireViewer('customer')
  const result = organizationSchema.parse(
    await apiRequest(`/organizations/${viewer.organizationId}`),
  ).data
  const canAdminister = viewer.role === 'CUSTOMER_ADMIN'
  const invitationLink = (await searchParams).invitation
  const profileById = new Map(result.assignmentProfiles.map((profile) => [profile.id, profile]))
  return (
    <div className="space-y-7">
      <PageHeader
        description="Your company profile, team access, invitations, and Beau Roi contacts in one organization-isolated workspace."
        eyebrow="Organization workspace"
        title={result.organization.name}
      />
      {invitationLink && canAdminister && (
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
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={<Building2 size={18} />} title="Company profile">
          <div className="mb-5 flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-lg bg-accent-soft font-display text-2xl font-semibold text-accent">
              {result.organization.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="font-semibold">
                {result.organization.logo_available
                  ? 'Private company logo available'
                  : 'Professional lettermark fallback'}
              </p>
              <p className="text-xs text-muted">
                Logos are served only through the authorized API.
              </p>
            </div>
          </div>
          {canAdminister ? (
            <form
              action={updateOrganizationProfile.bind(null, viewer.organizationId)}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field
                defaultValue={result.organization.name}
                label="Company name"
                name="name"
                required
              />
              <Field
                defaultValue={result.organization.website ?? ''}
                label="Website"
                name="website"
                type="url"
              />
              <Field
                defaultValue={result.organization.industry ?? ''}
                label="Industry"
                name="industry"
              />
              <Field
                defaultValue={result.organization.country ?? ''}
                label="Country"
                name="country"
              />
              <label className="grid gap-1.5 text-sm font-medium">
                Company size
                <select
                  className={inputClass}
                  defaultValue={result.organization.company_size ?? ''}
                  name="companySize"
                >
                  <option value="">Not provided</option>
                  {['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map((size) => (
                    <option key={size}>{size}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <ConfirmSubmit label="Save company profile" />
              </div>
            </form>
          ) : (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Fact label="Industry" value={result.organization.industry} />
              <Fact label="Website" value={result.organization.website} />
              <Fact label="Company size" value={result.organization.company_size} />
              <Fact label="Country" value={result.organization.country} />
            </dl>
          )}
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Company logo</h3>
            {result.storage.logoUploadsAvailable && canAdminister ? (
              <form
                action={uploadLogo.bind(null, viewer.organizationId)}
                className="mt-3 flex flex-wrap items-end gap-3"
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
              <p className="mt-2 text-sm text-muted">
                Logo upload is unavailable until Beau Roi configures private Cloudflare R2 storage.
                Other organization editing remains available.
              </p>
            )}
          </div>
        </Panel>
        <Panel icon={<BriefcaseBusiness size={18} />} title="Beau Roi contacts">
          <div className="grid gap-3">
            {['CSM', 'IMPLEMENTATION_ENGINEER'].map((type) => {
              const assignment = result.assignments.find((item) => item.assignment_type === type)
              const profile = assignment ? profileById.get(assignment.employee_user_id) : undefined
              return (
                <div className="rounded-md border border-border bg-surface-subtle p-4" key={type}>
                  <p className="text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
                    {type === 'CSM' ? 'Customer Success Manager' : 'Implementation Engineer'}
                  </p>
                  <p className="mt-2 font-semibold">{profile?.full_name ?? 'Not assigned'}</p>
                  <p className="text-sm text-muted">
                    {profile?.designation ?? 'No Beau Roi contact is currently assigned.'}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Subscriptions</h3>
            {result.subscriptions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No active subscription records are available. Billing controls are not part of this
                milestone.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {result.subscriptions.length} real subscription record
                {result.subscriptions.length === 1 ? '' : 's'} available.
              </p>
            )}
          </div>
        </Panel>
        <Panel icon={<Users size={18} />} title="Organization members">
          <div className="divide-y divide-border">
            {result.members.map((member) => (
              <div
                className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                key={member.id}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {member.profiles?.full_name ?? 'Profile unavailable'}
                    {member.user_id === viewer.userId ? ' (you)' : ''}
                  </p>
                  <p className="text-xs text-muted">
                    {member.profiles?.designation ?? 'Designation not provided'} · Joined{' '}
                    {member.joined_at
                      ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                          new Date(member.joined_at),
                        )
                      : 'date unavailable'}
                  </p>
                </div>
                {canAdminister && member.user_id !== viewer.userId ? (
                  <form
                    action={updateMember.bind(null, viewer.organizationId, member.id)}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <select
                      aria-label="Member role"
                      className={inputClass}
                      defaultValue={member.role}
                      name="role"
                    >
                      <option value="CUSTOMER_ADMIN">Customer admin</option>
                      <option value="CUSTOMER_MEMBER">Customer member</option>
                    </select>
                    <select
                      aria-label="Membership status"
                      className={inputClass}
                      defaultValue={member.status}
                      name="status"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="REMOVED">Removed</option>
                    </select>
                    <ConfirmSubmit
                      confirmMessage="Apply this member access change? The final active administrator cannot be removed."
                      label="Update"
                      variant="secondary"
                    />
                  </form>
                ) : (
                  <div className="text-right text-xs">
                    <p className="font-semibold">{member.role.replaceAll('_', ' ')}</p>
                    <p className="text-subtle">{member.status}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
        <Panel icon={<MailPlus size={18} />} title="Invitations">
          {canAdminister ? (
            <form
              action={createInvitation.bind(null, viewer.organizationId)}
              className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
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
              Only customer administrators can create or revoke invitations.
            </p>
          )}
          <div className="mt-5 divide-y divide-border">
            {result.invitations.length === 0 ? (
              <p className="py-4 text-sm text-muted">
                No invitations are visible for this organization.
              </p>
            ) : (
              result.invitations.map((invitation) => (
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
                  {canAdminister && invitation.status === 'PENDING' && (
                    <form
                      action={revokeInvitation.bind(null, viewer.organizationId, invitation.id)}
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
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-subtle">
            <ShieldCheck aria-hidden className="mt-0.5 shrink-0" size={14} /> Invitation tokens are
            single-use; only their hashes are stored. Acceptance requires a signed-in account with
            the exact normalized email.
          </p>
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
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-1 font-medium">{value ?? 'Not provided'}</dd>
    </div>
  )
}
