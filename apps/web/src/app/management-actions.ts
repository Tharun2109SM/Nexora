'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { apiRequest } from '@/lib/api'

function stringValue(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function profileBody(formData: FormData) {
  return {
    companySize: stringValue(formData, 'companySize') || null,
    country: stringValue(formData, 'country') || null,
    industry: stringValue(formData, 'industry') || null,
    name: stringValue(formData, 'name'),
    website: stringValue(formData, 'website') || null,
  }
}

export async function updateCustomerProfile(organizationId: string, formData: FormData) {
  await apiRequest(`/customers/${organizationId}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(profileBody(formData)),
  })
  revalidatePath(`/beauroi/customers/${organizationId}`)
  revalidatePath('/beauroi/customers')
}

export async function updateOrganizationProfile(organizationId: string, formData: FormData) {
  await apiRequest(`/organizations/${organizationId}`, {
    method: 'PATCH',
    body: JSON.stringify(profileBody(formData)),
  })
  revalidatePath('/portal/organization')
}

export async function updateLifecycle(organizationId: string, formData: FormData) {
  await apiRequest(`/customers/${organizationId}/lifecycle`, {
    method: 'PATCH',
    body: JSON.stringify({ status: stringValue(formData, 'status') }),
  })
  revalidatePath(`/beauroi/customers/${organizationId}`)
  revalidatePath('/beauroi/customers')
}

export async function recordHealthScore(organizationId: string, formData: FormData) {
  await apiRequest(`/customers/${organizationId}/health-scores`, {
    method: 'POST',
    body: JSON.stringify({
      reason: stringValue(formData, 'reason'),
      score: Number(stringValue(formData, 'score')),
    }),
  })
  revalidatePath(`/beauroi/customers/${organizationId}`)
  revalidatePath('/beauroi/customers')
}

export async function replaceAssignment(organizationId: string, formData: FormData) {
  await apiRequest(`/customers/${organizationId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({
      employeeUserId: stringValue(formData, 'employeeUserId'),
      internalNote: stringValue(formData, 'internalNote') || null,
      type: stringValue(formData, 'type'),
    }),
  })
  revalidatePath(`/beauroi/customers/${organizationId}`)
  revalidatePath('/portal/organization')
}

export async function createInvitation(organizationId: string, formData: FormData) {
  const response = await apiRequest(`/organizations/${organizationId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({
      email: stringValue(formData, 'email'),
      expiresInDays: 7,
      role: stringValue(formData, 'role'),
    }),
  })
  const result = response as { data?: { invitationUrl?: string } }
  revalidatePath('/portal/organization')
  const invitationUrl = result.data?.invitationUrl
  if (invitationUrl)
    redirect(`/portal/organization?invitation=${encodeURIComponent(invitationUrl)}`)
}

export async function createStaffInvitation(organizationId: string, formData: FormData) {
  const response = await apiRequest(`/organizations/${organizationId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({
      email: stringValue(formData, 'email'),
      expiresInDays: 7,
      role: stringValue(formData, 'role'),
    }),
  })
  const result = response as { data?: { invitationUrl?: string } }
  revalidatePath(`/beauroi/customers/${organizationId}`)
  const invitationUrl = result.data?.invitationUrl
  if (invitationUrl)
    redirect(`/beauroi/customers/${organizationId}?invitation=${encodeURIComponent(invitationUrl)}`)
}

export async function revokeInvitation(organizationId: string, invitationId: string) {
  await apiRequest(`/organizations/${organizationId}/invitations/${invitationId}`, {
    method: 'DELETE',
  })
  revalidatePath('/portal/organization')
}

export async function revokeStaffInvitation(organizationId: string, invitationId: string) {
  await apiRequest(`/organizations/${organizationId}/invitations/${invitationId}`, {
    method: 'DELETE',
  })
  revalidatePath(`/beauroi/customers/${organizationId}`)
}

export async function updateMember(
  organizationId: string,
  membershipId: string,
  formData: FormData,
) {
  await apiRequest(`/organizations/${organizationId}/members/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      role: stringValue(formData, 'role'),
      status: stringValue(formData, 'status'),
    }),
  })
  revalidatePath('/portal/organization')
}

export async function uploadLogo(organizationId: string, formData: FormData) {
  const logo = formData.get('logo')
  if (!(logo instanceof File) || logo.size === 0) return
  await apiRequest(`/organizations/${organizationId}/logo`, {
    body: await logo.arrayBuffer(),
    headers: { 'content-type': logo.type, 'x-file-name': logo.name },
    method: 'PUT',
  })
  revalidatePath('/portal/organization')
  revalidatePath(`/beauroi/customers/${organizationId}`)
}

export async function acceptInvitation(token: string) {
  const result = (await apiRequest('/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })) as { data?: { organizationId?: string } }
  if (result.data?.organizationId) redirect('/portal/organization')
}
