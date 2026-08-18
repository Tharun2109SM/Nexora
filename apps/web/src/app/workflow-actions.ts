'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { apiRequest } from '@/lib/api'

const identifierResponseSchema = z.object({ data: z.object({ id: z.uuid() }) })

function value(formData: FormData, name: string): string {
  const item = formData.get(name)
  return typeof item === 'string' ? item.trim() : ''
}

function nullable(formData: FormData, name: string): string | null {
  return value(formData, name) || null
}

function dateTimeNullable(formData: FormData, name: string): string | null {
  const raw = value(formData, name)
  return raw ? new Date(raw).toISOString() : null
}

export async function createOnboardingPlan(formData: FormData) {
  const result = identifierResponseSchema.parse(
    await apiRequest('/onboarding', {
      body: JSON.stringify({
        name: value(formData, 'name'),
        organizationId: value(formData, 'organizationId'),
        ownerUserId: nullable(formData, 'ownerUserId'),
        productId: value(formData, 'productId'),
        startsOn: nullable(formData, 'startsOn'),
        status: 'DRAFT',
        targetGoLiveOn: nullable(formData, 'targetGoLiveOn'),
      }),
      method: 'POST',
    }),
  )
  redirect(`/beauroi/onboarding/${result.data.id}`)
}

export async function updateOnboardingPlan(planId: string, formData: FormData) {
  await apiRequest(`/onboarding/${planId}`, {
    body: JSON.stringify({
      actualGoLiveOn: nullable(formData, 'actualGoLiveOn'),
      customerUpdate: nullable(formData, 'customerUpdate'),
      name: value(formData, 'name'),
      ownerUserId: nullable(formData, 'ownerUserId'),
      readinessConfirmedAt:
        value(formData, 'status') === 'READY_FOR_GO_LIVE' || value(formData, 'status') === 'LIVE'
          ? new Date().toISOString()
          : null,
      startsOn: nullable(formData, 'startsOn'),
      status: value(formData, 'status'),
      targetGoLiveOn: nullable(formData, 'targetGoLiveOn'),
    }),
    method: 'PATCH',
  })
  revalidatePath(`/beauroi/onboarding/${planId}`)
  revalidatePath('/beauroi/onboarding')
}

export async function addOnboardingTask(planId: string, formData: FormData) {
  const completed = value(formData, 'status') === 'COMPLETED'
  const assignedUserId = nullable(formData, 'assignedUserId')
  await apiRequest(`/onboarding/${planId}/tasks`, {
    body: JSON.stringify({
      assignedUserId,
      completedAt: completed ? new Date().toISOString() : null,
      description: nullable(formData, 'description'),
      dueAt: dateTimeNullable(formData, 'dueAt'),
      ownerKind: assignedUserId ? 'BEAUROI' : null,
      sortOrder: Number(value(formData, 'sortOrder') || 0),
      status: value(formData, 'status') || 'NOT_STARTED',
      title: value(formData, 'title'),
    }),
    method: 'POST',
  })
  revalidatePath(`/beauroi/onboarding/${planId}`)
}

export async function updateOnboardingTaskStatus(
  taskId: string,
  planId: string,
  formData: FormData,
) {
  const status = value(formData, 'status')
  await apiRequest(`/onboarding-tasks/${taskId}`, {
    body: JSON.stringify({
      completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
      status,
    }),
    method: 'PATCH',
  })
  revalidatePath(`/beauroi/onboarding/${planId}`)
}

export async function addTrainingSession(planId: string, formData: FormData) {
  await apiRequest(`/onboarding/${planId}/training-sessions`, {
    body: JSON.stringify({
      deliveryMethod: value(formData, 'deliveryMethod'),
      description: nullable(formData, 'description'),
      durationMinutes: Number(value(formData, 'durationMinutes')),
      facilitatorUserId: nullable(formData, 'facilitatorUserId'),
      meetingLocation: nullable(formData, 'meetingLocation'),
      meetingUrl: nullable(formData, 'meetingUrl'),
      scheduledAt: new Date(value(formData, 'scheduledAt')).toISOString(),
      status: 'SCHEDULED',
      title: value(formData, 'title'),
    }),
    method: 'POST',
  })
  revalidatePath(`/beauroi/onboarding/${planId}`)
}

export async function updateTrainingStatus(trainingId: string, planId: string, formData: FormData) {
  const status = value(formData, 'status')
  await apiRequest(`/training-sessions/${trainingId}`, {
    body: JSON.stringify({
      completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
      status,
    }),
    method: 'PATCH',
  })
  revalidatePath(`/beauroi/onboarding/${planId}`)
}

export async function addRequestedDocument(planId: string, formData: FormData) {
  await apiRequest(`/onboarding/${planId}/requested-documents`, {
    body: JSON.stringify({
      description: nullable(formData, 'description'),
      dueAt: dateTimeNullable(formData, 'dueAt'),
      name: value(formData, 'name'),
      requestedFromUserId: nullable(formData, 'requestedFromUserId'),
      status: 'REQUESTED',
      submittedAt: null,
    }),
    method: 'POST',
  })
  revalidatePath(`/beauroi/onboarding/${planId}`)
}

export async function updateRequestedDocumentStatus(
  documentId: string,
  planId: string,
  formData: FormData,
) {
  const status = value(formData, 'status')
  await apiRequest(`/requested-documents/${documentId}`, {
    body: JSON.stringify({
      status,
      submittedAt: ['RECEIVED', 'ACCEPTED', 'REJECTED'].includes(status)
        ? new Date().toISOString()
        : null,
    }),
    method: 'PATCH',
  })
  revalidatePath(`/beauroi/onboarding/${planId}`)
}

export async function createImplementationProject(formData: FormData) {
  const result = identifierResponseSchema.parse(
    await apiRequest('/implementations', {
      body: JSON.stringify({
        name: value(formData, 'name'),
        organizationId: value(formData, 'organizationId'),
        ownerUserId: nullable(formData, 'ownerUserId'),
        phase: 'DISCOVERY',
        productId: value(formData, 'productId'),
        startsOn: nullable(formData, 'startsOn'),
        status: 'DRAFT',
        targetCompletionOn: nullable(formData, 'targetCompletionOn'),
      }),
      method: 'POST',
    }),
  )
  redirect(`/beauroi/implementation/${result.data.id}`)
}

export async function updateImplementationProject(projectId: string, formData: FormData) {
  await apiRequest(`/implementations/${projectId}`, {
    body: JSON.stringify({
      actualCompletionOn: nullable(formData, 'actualCompletionOn'),
      customerUpdate: nullable(formData, 'customerUpdate'),
      name: value(formData, 'name'),
      ownerUserId: nullable(formData, 'ownerUserId'),
      phase: value(formData, 'phase'),
      requirementSummary: nullable(formData, 'requirementSummary'),
      startsOn: nullable(formData, 'startsOn'),
      status: value(formData, 'status'),
      targetCompletionOn: nullable(formData, 'targetCompletionOn'),
    }),
    method: 'PATCH',
  })
  revalidatePath(`/beauroi/implementation/${projectId}`)
  revalidatePath('/beauroi/implementation')
}

export async function addMilestone(projectId: string, formData: FormData) {
  const completed = value(formData, 'status') === 'COMPLETED'
  await apiRequest(`/implementations/${projectId}/milestones`, {
    body: JSON.stringify({
      completedAt: completed ? new Date().toISOString() : null,
      description: nullable(formData, 'description'),
      dueOn: nullable(formData, 'dueOn'),
      sortOrder: Number(value(formData, 'sortOrder') || 0),
      status: value(formData, 'status') || 'NOT_STARTED',
      title: value(formData, 'title'),
    }),
    method: 'POST',
  })
  revalidatePath(`/beauroi/implementation/${projectId}`)
}

export async function updateMilestoneStatus(
  milestoneId: string,
  projectId: string,
  formData: FormData,
) {
  const status = value(formData, 'status')
  await apiRequest(`/milestones/${milestoneId}`, {
    body: JSON.stringify({
      completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
      status,
    }),
    method: 'PATCH',
  })
  revalidatePath(`/beauroi/implementation/${projectId}`)
}

export async function addProjectNote(projectId: string, formData: FormData) {
  await apiRequest(`/implementations/${projectId}/notes`, {
    body: JSON.stringify({
      body: value(formData, 'body'),
      visibility: value(formData, 'visibility'),
    }),
    method: 'POST',
  })
  revalidatePath(`/beauroi/implementation/${projectId}`)
}
