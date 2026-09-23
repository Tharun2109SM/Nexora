'use server'

import {
  activateCustomerProductSchema,
  createProductSchema,
  customerProductStateSchema,
  updateProductSchema,
} from '@nexora/contracts'
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

export async function updateProductAction(
  productId: string,
  _state: ProductActionState,
  data: FormData,
): Promise<ProductActionState> {
  try {
    const viewer = await requireViewer('beauroi')
    if (viewer.role !== 'BEAUROI_ADMIN') return { error: 'Administrator access is required.' }
    const input = updateProductSchema.parse({
      description: value(data, 'description') || null,
      name: value(data, 'name'),
    })
    await apiRequest(`/products/${productId}`, { body: JSON.stringify(input), method: 'PATCH' })
    revalidatePath('/beauroi/products')
    revalidatePath(`/beauroi/products/${productId}`)
    return { success: 'Product details saved.' }
  } catch (error) {
    return {
      error: error instanceof ApiRequestError ? error.message : 'Check the product details.',
    }
  }
}

export async function archiveProductAction(
  productId: string,
  archived: boolean,
  _state: ProductActionState,
): Promise<ProductActionState> {
  void _state
  try {
    const viewer = await requireViewer('beauroi')
    if (viewer.role !== 'BEAUROI_ADMIN') return { error: 'Administrator access is required.' }
    await apiRequest(`/products/${productId}/archive`, {
      body: JSON.stringify({ archived }),
      method: 'PATCH',
    })
    revalidatePath('/beauroi/products')
    revalidatePath(`/beauroi/products/${productId}`)
    revalidatePath('/beauroi/onboarding')
    revalidatePath('/beauroi/implementation')
    return {
      success: archived
        ? 'Product archived. Existing work remains available.'
        : 'Product restored.',
    }
  } catch (error) {
    return {
      error: error instanceof ApiRequestError ? error.message : 'Unable to change product status.',
    }
  }
}

export async function setCustomerProductAction(
  organizationId: string,
  productId: string,
  active: boolean,
  _state: ProductActionState,
): Promise<ProductActionState> {
  void _state
  try {
    const viewer = await requireViewer('beauroi')
    if (viewer.role !== 'BEAUROI_ADMIN') return { error: 'Administrator access is required.' }
    const input = customerProductStateSchema.parse({ organizationId, productId, active })
    await apiRequest('/products/subscriptions', { body: JSON.stringify(input), method: 'PATCH' })
    revalidatePath(`/beauroi/customers/${organizationId}`)
    revalidatePath(`/beauroi/products/${productId}`)
    revalidatePath('/beauroi/onboarding')
    revalidatePath('/beauroi/implementation')
    revalidatePath('/portal/organization')
    return { success: active ? 'Customer product reactivated.' : 'Customer product deactivated.' }
  } catch (error) {
    return {
      error:
        error instanceof ApiRequestError ? error.message : 'Unable to change customer product.',
    }
  }
}
