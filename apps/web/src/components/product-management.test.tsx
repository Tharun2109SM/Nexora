import type { ProductRecord } from '@nexora/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  ProductDetailControls,
  ProductManagementControls,
  ProductPortfolio,
  ProductSubscriptionForm,
} from './product-management'

const product: ProductRecord = {
  code: 'NEXORA_OPS',
  createdAt: '2026-09-14T10:00:00.000Z',
  description: 'Product operations platform',
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Nexora Ops',
  status: 'ACTIVE',
}

describe('product management UI', () => {
  it('renders the real product catalog with a detail link but no protected fields', () => {
    const html = renderToStaticMarkup(<ProductPortfolio products={[product]} />)
    expect(html).toContain('Nexora Ops')
    expect(html).toContain('NEXORA_OPS')
    expect(html).toContain('ACTIVE')
    expect(html).toContain(`/beauroi/products/${product.id}`)
    expect(html).not.toContain('created_by')
    expect(html).not.toMatch(/token_hash|logo_object_key|internal_note|requirement_summary/i)
  })

  it('renders an honest empty state', () => {
    const html = renderToStaticMarkup(<ProductPortfolio products={[]} />)
    expect(html).toContain('No products yet')
    expect(html).toContain('Beau Roi administrator')
  })

  it('keeps product creation controls out of the employee view', () => {
    const html = renderToStaticMarkup(<ProductManagementControls canCreate={false} />)
    expect(html).toContain('Read-only product catalog')
    expect(html).not.toContain('Create active product')
    expect(html).not.toContain('name="code"')
  })

  it('shows the creation form for administrators', () => {
    const html = renderToStaticMarkup(<ProductManagementControls canCreate />)
    expect(html).toContain('Create active product')
    expect(html).toContain('name="code"')
  })

  it('renders the customer provisioning action only in the admin workspace', () => {
    const html = renderToStaticMarkup(
      <ProductSubscriptionForm
        options={{
          organizations: [{ id: product.id, name: 'Customer A' }],
          products: [{ code: product.code, id: product.id, name: product.name }],
          staff: [],
          subscriptions: [],
        }}
      />,
    )
    expect(html).toContain('Make a product available to a customer')
    expect(html).toContain('Make available')
    expect(html).toContain('Customer A')
  })

  it('keeps catalog mutation controls out of the employee detail view', () => {
    const html = renderToStaticMarkup(<ProductDetailControls canManage={false} product={product} />)
    expect(html).toContain('Only Beau Roi administrators')
    expect(html).not.toContain('Archive product')
    expect(html).not.toContain('Save changes')
  })

  it('shows edit and archive controls to Beau Roi administrators', () => {
    const html = renderToStaticMarkup(<ProductDetailControls canManage product={product} />)
    expect(html).toContain('Save changes')
    expect(html).toContain('Archive product')
    expect(html).not.toMatch(/token_hash|logo_object_key|internal_note|requirement_summary/i)
  })
})
