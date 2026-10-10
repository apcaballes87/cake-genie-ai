import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  inventory: vi.fn(),
  failureTable: null as string | null,
  from: vi.fn(),
}))

vi.mock('@/lib/sitemap/indexability', () => ({ getSitemapInventory: mocks.inventory }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mocks.from }),
}))

const dataByTable: Record<string, unknown[]> = {
  cakegenie_merchant_products: [
    { slug: 'rose-cake', image_url: 'https://cdn.example.com/rose.webp', merchant: { slug: 'active-bakery', is_active: true } },
    { slug: 'hidden-cake', image_url: 'https://cdn.example.com/hidden.webp', merchant: { slug: 'closed-bakery', is_active: false } },
  ],
  blogs: [{ slug: 'cake-guide', image: 'https://cdn.example.com/blog.webp' }],
  cakegenie_collections: [{
    slug: 'rose-cake', name: 'Rose cakes', description: null, tags: ['rose'], sample_image: null,
    item_count: 8, publication_status: 'published', is_indexable: true,
  }],
}

function queryFor(table: string) {
  const query = {
    eq: () => query,
    not: () => query,
    gte: () => query,
    range: () => query,
    returns: async () => mocks.failureTable === table
      ? { data: null, error: { message: 'database unavailable' } }
      : { data: dataByTable[table] ?? [], error: null },
  }
  return { select: () => query }
}

describe('image sitemap', () => {
  beforeEach(() => {
    mocks.failureTable = null
    mocks.from.mockImplementation(queryFor)
    mocks.inventory.mockResolvedValue({
      customizedCakes: [{ slug: 'rose-cake-1234', image_url: 'https://cdn.example.com/design.webp', keywords: 'rose cake' }],
      sharedDesigns: [{ url_slug: 'shared-rose-cake-5678', image_url: 'https://cdn.example.com/shared.webp' }],
    })
  })

  it('includes eligible shared designs and omits inactive merchant products and deprecated image tags', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('/customizing/shared-rose-cake-5678')
    expect(xml).toContain('/shop/active-bakery/rose-cake')
    expect(xml).not.toContain('/shop/closed-bakery/hidden-cake')
    expect(xml).toContain('/collections/rose-cake')
    expect(xml).not.toMatch(/<image:(?:title|caption|geo_location|license)>/)
  })

  it('returns an uncached error when a database read fails', async () => {
    mocks.failureTable = 'blogs'
    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).not.toContain('<urlset')
  })
})
