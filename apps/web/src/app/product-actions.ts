'use server'

import { activateCustomerProductSchema, createProductSchema } from '@nexora/contracts'
import { revalidatePath } from 'next/cache'

import { ApiRequestError, apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export interface ProductActionState {
  error?: string
  success?: string
}

const value = (data: FormData, name: string) => {
  const entry = data.get(name)
  return typeof entry === 'string' ? entry.trim() : ''
}

export async function createProductAction(
  _state: ProductActionState,
  data: FormData,
): Promise<ProductActionState> {
  try {
    const viewer = await requireViewer('beauroi')
    if (viewer.role !== 'BEAUROI_ADMIN') {
      return { error: 'Beau Roi administrator access is required.' }
    }
    const input = createProductSchema.parse({
      code: value(data, 'code'),
      description: value(data, 'description') || null,
      name: value(data, 'name'),
    })
    await apiRequest('/products', { body: JSON.stringify(input), method: 'POST' })
    revalidatePath('/beauroi/products')
    revalidatePath('/beauroi/onboarding')
    revalidatePath('/beauroi/implementation')
    revalidatePath('/beauroi/support')
    revalidatePath('/beauroi/feedback')
    revalidatePath('/beauroi/releases')
    revalidatePath('/beauroi/knowledge-base')
    return {
      success: `${input.name} is active. Make it available to a customer before starting their workflow.`,
    }
  } catch (error) {
    return {
      error:
        error instanceof ApiRequestError
          ? error.message
          : 'Check the product details and try again.',
    }
  }
}

export async function activateCustomerProductAction(
  _state: ProductActionState,
  data: FormData,
): Promise<ProductActionState> {
  try {
    const viewer = await requireViewer('beauroi')
    if (viewer.role !== 'BEAUROI_ADMIN') {
      return { error: 'Beau Roi administrator access is required.' }
    }
    const input = activateCustomerProductSchema.parse({
      organizationId: value(data, 'organizationId'),
      productId: value(data, 'productId'),
    })
    await apiRequest('/products/subscriptions', { body: JSON.stringify(input), method: 'POST' })
    revalidatePath('/beauroi/products')
    revalidatePath(`/beauroi/customers/${input.organizationId}`)
    revalidatePath('/beauroi/onboarding')
    revalidatePath('/beauroi/implementation')
    revalidatePath('/portal')
    return { success: 'Product is now available to this customer for eligible workflows.' }
  } catch (error) {
    return {
      error:
        error instanceof ApiRequestError
          ? error.message
          : 'Select an active customer and product and try again.',
    }
  }
}
