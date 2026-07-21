import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDesignCategories = vi.fn()

vi.mock('@/services/supabaseService', () => ({
  getDesignCategories,
}))

vi.mock('./CollectionsClient', () => ({
  default: ({ initialPage, featuredCollections }: { initialPage: number; featuredCollections: React.ReactNode }) => (
    <main data-initial-page={initialPage}>{featuredCollections}</main>
  ),
}))

describe('collections directory', () => {
  beforeEach(() => {
    getDesignCategories.mockReset()
    getDesignCategories.mockResolvedValue({ data: [], error: null })
  })

  it('server-renders all nine featured collection anchors in the approved order', async () => {
    const { default: CollectionsPage } = await import('./page')
    const markup = renderToStaticMarkup(await CollectionsPage({}))

    const hrefs = Array.from(markup.matchAll(/href="([^"]+)"/g), (match) => match[1])
    expect(hrefs).toEqual([
      '/collections/bento-cake',
      '/collections/minimalist-cake',
      '/collections/katseye-cake',
      '/collections/kuromi-cake',
      '/collections/minecraft-cake',
      '/collections/graduation-cake',
      '/collections/debut-cake',
      '/collections/30th-birthday-cake',
      '/collections/senior-cake',
    ])
    expect(markup).toContain('Featured Cake Collections')
  })

  it('passes a validated initial page without relying on client search params', async () => {
    const { default: CollectionsPage } = await import('./page')

    const requestedMarkup = renderToStaticMarkup(await CollectionsPage({
      searchParams: Promise.resolve({ page: '2' }),
    }))
    const invalidMarkup = renderToStaticMarkup(await CollectionsPage({
      searchParams: Promise.resolve({ page: '-4' }),
    }))

    expect(requestedMarkup).toContain('data-initial-page="2"')
    expect(invalidMarkup).toContain('data-initial-page="1"')
  })
})
