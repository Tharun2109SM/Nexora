import { productListResponseSchema } from '@nexora/contracts'
import type { Metadata } from 'next'
import Link from 'next/link'

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

export default async function ProductManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; offset?: string }>
}) {
  const viewer = await requireViewer('beauroi')
  const params = await searchParams
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status === 'ACTIVE' || params.status === 'ARCHIVED') query.set('status', params.status)
  if (params.offset && /^\d+$/.test(params.offset)) query.set('offset', params.offset)
  const [productsResult, optionsResult] = await Promise.all([
    apiRequest(`/products?${query.toString()}`),
    viewer.role === 'BEAUROI_ADMIN' ? apiRequest('/workflow-options') : Promise.resolve(null),
  ])
  const portfolio = productListResponseSchema.parse(productsResult)
  const products = portfolio.data
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
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-card"
        method="get"
      >
        <label className="grid min-w-52 flex-1 gap-1.5 text-sm font-medium">
          Search products
          <input
            className="h-10 rounded-md border border-border bg-canvas px-3 focus-visible:outline-2 focus-visible:outline-accent"
            defaultValue={params.search ?? ''}
            maxLength={160}
            name="search"
            placeholder="Name or code"
            type="search"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Status
          <select
            className="h-10 rounded-md border border-border bg-canvas px-3 focus-visible:outline-2 focus-visible:outline-accent"
            defaultValue={params.status ?? ''}
            name="status"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <button
          className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-white"
          type="submit"
        >
          Apply filters
        </button>
      </form>
      <ProductPortfolio products={products} />
      {portfolio.meta && portfolio.meta.total > portfolio.meta.limit && (
        <nav aria-label="Product pages" className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Showing {portfolio.meta.offset + 1}–
            {Math.min(portfolio.meta.offset + products.length, portfolio.meta.total)} of{' '}
            {portfolio.meta.total}
          </span>
          <div className="flex gap-3">
            {portfolio.meta.offset > 0 && (
              <Link
                className="font-semibold text-accent"
                href={`?${new URLSearchParams({ ...Object.fromEntries(query), offset: String(Math.max(0, portfolio.meta.offset - portfolio.meta.limit)) })}`}
              >
                Previous
              </Link>
            )}
            {portfolio.meta.offset + portfolio.meta.limit < portfolio.meta.total && (
              <Link
                className="font-semibold text-accent"
                href={`?${new URLSearchParams({ ...Object.fromEntries(query), offset: String(portfolio.meta.offset + portfolio.meta.limit) })}`}
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
