import { productListResponseSchema } from '@nexora/contracts'
import type { Metadata } from 'next'

import {
  ProductManagementControls,
  ProductPortfolio,
  ProductSubscriptionForm,
} from '@/components/product-management'
import { PageHeader } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'
import { workflowOptionsSchema } from '@/lib/workflow-data'

export const metadata: Metadata = { title: 'Product management' }

export default async function ProductManagementPage() {
  const viewer = await requireViewer('beauroi')
  const [productsResult, optionsResult] = await Promise.all([
    apiRequest('/products'),
    viewer.role === 'BEAUROI_ADMIN' ? apiRequest('/workflow-options') : Promise.resolve(null),
  ])
  const products = productListResponseSchema.parse(productsResult).data
  const options = optionsResult ? workflowOptionsSchema.parse(optionsResult).data : null
  const admin = viewer.role === 'BEAUROI_ADMIN'

  return (
    <div className="space-y-8">
      <PageHeader
        description="Maintain the governed product catalog used by onboarding, implementation, support, feedback, releases, and knowledge workflows."
        eyebrow="Platform administration"
        title="Products"
      />
      <ProductManagementControls canCreate={admin} />
      {options && <ProductSubscriptionForm options={options} />}
      <ProductPortfolio products={products} />
    </div>
  )
}
