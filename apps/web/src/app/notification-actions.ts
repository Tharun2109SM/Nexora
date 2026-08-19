'use server'

import { supportIdentifierResponseSchema } from '@nexora/contracts'
import { revalidatePath } from 'next/cache'

import { apiRequest } from '@/lib/api'

export async function markSupportNotificationRead(notificationId: string, path: string) {
  supportIdentifierResponseSchema.parse(
    await apiRequest(`/support/notifications/${notificationId}/read`, { method: 'PATCH' }),
  )
  revalidatePath(path)
}
