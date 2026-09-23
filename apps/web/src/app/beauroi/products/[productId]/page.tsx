import { productDetailResponseSchema } from '@nexora/contracts'
import { ArrowLeft, Box, Building2, CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CustomerProductToggle, ProductDetailControls } from '@/components/product-management'
import { PageHeader } from '@/components/ui'
import { ApiRequestError, apiRequest } from '@/lib/api'
import { requireViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Product detail' }

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const viewer = await requireViewer('beauroi')
  const { productId } = await params
  let detail: ReturnType<typeof productDetailResponseSchema.parse>['data']
  try {
    detail = productDetailResponseSchema.parse(await apiRequest(`/products/${productId}`)).data
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'PRODUCT_NOT_FOUND') notFound()
    throw error
  }
  const { product, assignments, onboarding, implementation } = detail
  const admin = viewer.role === 'BEAUROI_ADMIN'
  return (
    <div className="space-y-7">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"
        href="/beauroi/products"
      >
        <ArrowLeft aria-hidden size={15} /> Back to products
      </Link>
      <PageHeader
        description="Shared catalog record, customer access, and linked delivery work."
        eyebrow={product.code}
        title={product.name}
      />
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-border bg-surface p-5 shadow-card">
          <Box aria-hidden className="text-accent" size={19} />
          <h2 className="mt-3 text-sm font-semibold">Catalog status</h2>
          <p className="mt-1 font-display text-xl font-semibold">{product.status}</p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-5 shadow-card">
          <Building2 aria-hidden className="text-accent" size={19} />
          <h2 className="mt-3 text-sm font-semibold">Assigned customers</h2>
          <p className="mt-1 font-display text-xl font-semibold">
            {assignments.filter((item) => item.status === 'ACTIVE').length}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-5 shadow-card">
          <CalendarDays aria-hidden className="text-accent" size={19} />
          <h2 className="mt-3 text-sm font-semibold">Created</h2>
          <p className="mt-1 text-sm">
            {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
              new Date(product.createdAt),
            )}
          </p>
          <p className="text-xs text-muted">by {detail.createdByName ?? 'Unavailable'}</p>
        </article>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-xl font-semibold">Product information</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          {product.description ?? 'No description has been added.'}
        </p>
        <p className="mt-4 text-xs text-subtle">
          Updated{' '}
          {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
            new Date(product.updatedAt),
          )}{' '}
          · {product.updatedByName ?? 'Actor unavailable'}
        </p>
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Product logo</h3>
          <p className="mt-1 text-sm text-muted">
            Product logo upload is unavailable until private storage is configured for catalog
            assets. Product management remains available without a logo.
          </p>
        </div>
      </section>
      <ProductDetailControls canManage={admin} product={product} />
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-xl font-semibold">Customer assignments</h2>
        {assignments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No customers have been assigned this product.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {assignments.map((assignment) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                key={assignment.id}
              >
                <div>
                  <Link
                    className="text-sm font-semibold text-accent hover:underline"
                    href={`/beauroi/customers/${assignment.organizationId}`}
                  >
                    {assignment.organizationName}
                  </Link>
                  <p className="text-xs text-muted">
                    {assignment.status} · assigned{' '}
                    {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                      new Date(assignment.createdAt),
                    )}
                  </p>
                </div>
                {admin && product.status === 'ACTIVE' && (
                  <CustomerProductToggle
                    active={assignment.status === 'ACTIVE'}
                    organizationId={assignment.organizationId}
                    productId={product.id}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <WorkflowLinks href="onboarding" rows={onboarding} title="Onboarding plans" />
        <WorkflowLinks
          href="implementation"
          rows={implementation}
          title="Implementation projects"
        />
      </div>
    </div>
  )
}

function WorkflowLinks({
  href,
  rows,
  title,
}: {
  href: 'onboarding' | 'implementation'
  rows: { id: string; name: string; organizationName: string }[]
  title: string
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No linked records yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => (
            <li className="py-3" key={row.id}>
              <Link
                className="text-sm font-semibold text-accent hover:underline"
                href={`/beauroi/${href}/${row.id}`}
              >
                {row.name}
              </Link>
              <p className="text-xs text-muted">{row.organizationName}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
