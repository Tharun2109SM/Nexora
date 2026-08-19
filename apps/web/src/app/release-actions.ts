'use server'

import {
  createMaintenanceSchema,
  createReleaseSchema,
  linkReleaseFeedbackSchema,
  transitionMaintenanceSchema,
  transitionReleaseSchema,
  updateMaintenanceSchema,
  updateReleaseAudienceSchema,
  updateReleaseContentSchema,
  upsertReleaseSectionSchema,
} from '@nexora/contracts'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { ApiRequestError, apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export interface ReleaseActionState {
  error?: string
  success?: string
}
const text = (data: FormData, name: string) => {
  const value = data.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
const instant = (data: FormData, name: string) => {
  const value = text(data, name)
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toISOString()
}
function message(error: unknown, fallback: string) {
  return error instanceof ApiRequestError ? error.message : fallback
}
async function mutate(path: string, method: string, body: unknown, success: string) {
  try {
    await requireViewer('beauroi')
    await apiRequest(path, { body: JSON.stringify(body), method })
    revalidatePath('/beauroi/releases')
    revalidatePath('/portal/releases')
    return { success }
  } catch (error) {
    return { error: message(error, 'The release change could not be completed.') }
  }
}
async function validateAndMutate(
  path: string,
  method: string,
  input: () => unknown,
  success: string,
  validationMessage: string,
) {
  try {
    return await mutate(path, method, input(), success)
  } catch {
    return { error: validationMessage }
  }
}
export async function createReleaseAction(
  _state: ReleaseActionState,
  data: FormData,
): Promise<ReleaseActionState> {
  try {
    await requireViewer('beauroi')
    const input = createReleaseSchema.parse({
      productId: text(data, 'productId'),
      releaseNotes: text(data, 'releaseNotes') || null,
      summary: text(data, 'summary') || null,
      title: text(data, 'title'),
      version: text(data, 'version'),
    })
    const response = (await apiRequest('/releases', {
      body: JSON.stringify(input),
      method: 'POST',
    })) as { data: { id: string } }
    redirect(`/beauroi/releases/${response.data.id}`)
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error
    return { error: message(error, 'Check the release details and try again.') }
  }
}
export async function updateReleaseContentAction(
  id: string,
  _state: ReleaseActionState,
  data: FormData,
) {
  const result = await validateAndMutate(
    `/releases/${id}/content`,
    'PATCH',
    () =>
      updateReleaseContentSchema.parse({
        releaseNotes: text(data, 'releaseNotes') || null,
        summary: text(data, 'summary') || null,
        title: text(data, 'title'),
      }),
    'Release content updated.',
    'Check the release content and try again.',
  )
  revalidatePath(`/beauroi/releases/${id}`)
  return result
}
export async function updateReleaseAudienceAction(
  id: string,
  _state: ReleaseActionState,
  data: FormData,
) {
  const result = await validateAndMutate(
    `/releases/${id}/audience`,
    'PUT',
    () =>
      updateReleaseAudienceSchema.parse({
        mode: text(data, 'mode'),
        organizationIds: data
          .getAll('organizationIds')
          .filter((x): x is string => typeof x === 'string'),
      }),
    'Release audience updated.',
    'Select a valid release audience and try again.',
  )
  revalidatePath(`/beauroi/releases/${id}`)
  return result
}
export async function addReleaseSectionAction(
  id: string,
  _state: ReleaseActionState,
  data: FormData,
) {
  const result = await validateAndMutate(
    `/releases/${id}/sections`,
    'POST',
    () =>
      upsertReleaseSectionSchema.parse({
        body: text(data, 'body'),
        category: text(data, 'category'),
        sectionId: null,
        sortOrder: Number(text(data, 'sortOrder') || '0'),
        title: text(data, 'title'),
      }),
    'Release section added.',
    'Check the release section and try again.',
  )
  revalidatePath(`/beauroi/releases/${id}`)
  return result
}
export async function transitionReleaseAction(
  id: string,
  _state: ReleaseActionState,
  data: FormData,
) {
  const result = await validateAndMutate(
    `/releases/${id}/status`,
    'PATCH',
    () =>
      transitionReleaseSchema.parse({
        scheduledFor: instant(data, 'scheduledFor'),
        status: text(data, 'status'),
      }),
    'Release status updated.',
    'Select a valid release transition and try again.',
  )
  revalidatePath(`/beauroi/releases/${id}`)
  revalidatePath(`/portal/releases/${id}`)
  return result
}
export async function linkReleaseFeedbackAction(
  id: string,
  _state: ReleaseActionState,
  data: FormData,
) {
  const result = await validateAndMutate(
    `/releases/${id}/feedback-links`,
    'POST',
    () => linkReleaseFeedbackSchema.parse({ feedbackId: text(data, 'feedbackId') }),
    'Feature request linked.',
    'Select an eligible feature request and try again.',
  )
  revalidatePath(`/beauroi/releases/${id}`)
  return result
}
export async function createMaintenanceAction(_state: ReleaseActionState, data: FormData) {
  return validateAndMutate(
    '/maintenance',
    'POST',
    () =>
      createMaintenanceSchema.parse({
        description: text(data, 'description'),
        endsAt: instant(data, 'endsAt'),
        productId: text(data, 'productId'),
        startsAt: instant(data, 'startsAt'),
        title: text(data, 'title'),
      }),
    'Maintenance draft created.',
    'Check the maintenance details and try again.',
  )
}
export async function updateMaintenanceAction(
  id: string,
  _state: ReleaseActionState,
  data: FormData,
) {
  return validateAndMutate(
    `/maintenance/${id}/content`,
    'PATCH',
    () =>
      updateMaintenanceSchema.parse({
        description: text(data, 'description'),
        endsAt: instant(data, 'endsAt'),
        startsAt: instant(data, 'startsAt'),
        title: text(data, 'title'),
      }),
    'Maintenance notice updated.',
    'Check the maintenance details and try again.',
  )
}
export async function updateMaintenanceAudienceAction(
  id: string,
  _state: ReleaseActionState,
  data: FormData,
) {
  return validateAndMutate(
    `/maintenance/${id}/audience`,
    'PUT',
    () =>
      updateReleaseAudienceSchema.parse({
        mode: text(data, 'mode'),
        organizationIds: data
          .getAll('organizationIds')
          .filter((x): x is string => typeof x === 'string'),
      }),
    'Maintenance audience updated.',
    'Select a valid maintenance audience and try again.',
  )
}
export async function transitionMaintenanceAction(
  id: string,
  status: string,
  _state: ReleaseActionState,
) {
  void _state
  return validateAndMutate(
    `/maintenance/${id}/status`,
    'PATCH',
    () => transitionMaintenanceSchema.parse({ status }),
    'Maintenance status updated.',
    'Select a valid maintenance transition and try again.',
  )
}
