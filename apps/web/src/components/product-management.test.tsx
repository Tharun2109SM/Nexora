import type { ProductRecord } from '@nexora/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
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
  it('renders the real product catalog without exposing internal identifiers', () => {
    const html = renderToStaticMarkup(<ProductPortfolio products={[product]} />)
    expect(html).toContain('Nexora Ops')
    expect(html).toContain('NEXORA_OPS')
    expect(html).toContain('ACTIVE')
    expect(html).not.toContain(product.id)
    expect(html).not.toContain('created_by')
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
})
