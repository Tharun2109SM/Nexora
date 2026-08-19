import { supportProductsResponseSchema, supportTicketListResponseSchema } from '@nexora/contracts'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { CustomerSupportFilters } from '@/components/customer-support-filters'
import { CustomerSupportQueue } from '@/components/customer-support-queue'
import { CustomerTicketForm } from '@/components/customer-ticket-form'
import { PageHeader, buttonClassName } from '@/components/ui'
import { apiRequest } from '@/lib/api'
import { customerSupportParams } from '@/lib/customer-support-data'
import { supportCategoriesResponseSchema, type SupportCategory } from '@/lib/support-data'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Support Center' }

export default async function CustomerSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireViewer('customer')
  const values = await searchParams
  const params = customerSupportParams(values)
  const [ticketResult, productResult] = await Promise.all([
    apiRequest(`/support/tickets?${params.toString()}`),
    apiRequest('/support/products'),
  ])
  const tickets = supportTicketListResponseSchema.parse(ticketResult)
  const products = supportProductsResponseSchema.parse(productResult).data
  const filterProductId = typeof values.productId === 'string' ? values.productId : ''
  const requestedProductId = typeof values.newProductId === 'string' ? values.newProductId : ''
  const selectedProductId =
    products.find((product) => product.id === requestedProductId)?.id ?? products[0]?.id ?? ''
  const categoryProductIds = [...new Set([filterProductId, selectedProductId].filter(Boolean))]
  const categoryPairs = await Promise.all(
    categoryProductIds.map(async (productId) => {
      const result = supportCategoriesResponseSchema.parse(
        await apiRequest(`/support/categories?productId=${encodeURIComponent(productId)}`),
      ).data
      return [productId, result] as const
    }),
  )
  const categoriesByProduct = new Map<string, SupportCategory[]>(categoryPairs)
  const filterCategories = categoriesByProduct.get(filterProductId) ?? []
  const createCategories = categoriesByProduct.get(selectedProductId) ?? []
  const raise = values.raise === '1'
  const nextParams = new URLSearchParams(params)
  if (tickets.nextCursor) nextParams.set('cursor', tickets.nextCursor)
  const filtered = [...params.keys()].some((name) => !['cursor', 'limit', 'sort'].includes(name))
  const raiseHref = products[0]
    ? `/portal/support?raise=1&newProductId=${encodeURIComponent(products[0].id)}`
    : '/portal/support?raise=1'

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          description="Raise and follow support requests for your organization using a secure customer-visible workspace."
          eyebrow="Customer assistance"
          title="Support Center"
        />
        {!raise && (
          <Link className={buttonClassName()} href={raiseHref}>
            <Plus aria-hidden size={16} /> Raise ticket
          </Link>
        )}
      </div>
      {raise ? (
        <CustomerTicketForm
          categories={createCategories}
          products={products}
          selectedProductId={selectedProductId}
        />
      ) : (
        <>
          <CustomerSupportFilters
            categories={filterCategories.map((item) => ({ id: item.id, name: item.name }))}
            products={products.map((item) => ({ id: item.id, name: item.name }))}
          />
          <CustomerSupportQueue
            filtered={filtered}
            nextHref={tickets.nextCursor ? `?${nextParams.toString()}` : null}
            rows={tickets.data}
          />
        </>
      )}
    </div>
  )
}
