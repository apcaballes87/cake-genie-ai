import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/components/UI/AnimatedBlobs', () => ({ default: () => null }))
vi.mock('@/components/landing/LandingFooter', () => ({ LandingFooter: () => null }))
vi.mock('./PriceListHeader', () => ({ default: () => null }))
vi.mock('./PriceListBrowser', () => ({ default: () => null }))

function createEmptyQuery() {
  const query = {
    data: [],
    error: null,
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  return query
}

describe('price list SEO links', () => {
  it('server-renders a direct minimalist collection link', async () => {
    createClient.mockResolvedValue({ from: vi.fn(() => createEmptyQuery()) })
    const { default: PriceListPage } = await import('./page')

    const markup = renderToStaticMarkup(await PriceListPage())

    expect(markup).toContain('href="/collections/minimalist-cake"')
    expect(markup).toContain('Browse minimalist cake designs in Cebu')
  })
})
