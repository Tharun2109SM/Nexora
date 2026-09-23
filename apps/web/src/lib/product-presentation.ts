import type { ProductAssignment } from '@nexora/contracts'

export function customerProductAvailabilityLabel(
  product: Pick<ProductAssignment, 'productStatus' | 'status'>,
): string {
  return product.status === 'ACTIVE' && product.productStatus === 'ACTIVE'
    ? 'Available for new workflows'
    : 'Historical access'
}
