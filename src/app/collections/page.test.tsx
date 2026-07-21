import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDesignCategories, notFound } = vi.hoisted(() => ({
  getDesignCategories: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/services/supabaseService', () => ({
  getDesignCategories,
}))

vi.mock('next/navigation', () => ({
  notFound,
}))

vi.mock('./CollectionsClient', () => ({
  default: ({
    categories,
    currentPage,
    totalPages,
    totalCount,
    startIndex,
    featuredCollections,
  }: {
    categories: Array<{ slug: string; keyword: string }>
    currentPage: number
    totalPages: number
    totalCount: number
    startIndex: number
    featuredCollections?: ReactNode
  }) => (
    <main
      data-current-page={currentPage}
      data-total-pages={totalPages}
      data-total-count={totalCount}
      data-start-index={startIndex}
    >
      {featuredCollections}
      {categories.map((category) => (
        <a key={category.slug} href={`/collections/${category.slug}`}>
          {category.keyword}
        </a>
      ))}
    </main>
  ),
}))

const categories = Array.from({ length: 61 }, (_, index) => ({
  slug: `category-${index + 1}`,
  keyword: `Category ${index + 1}`,
  sample_image: `https://example.com/category-${index + 1}.jpg`,
  count: index + 1,
  collection_type: index < 3 ? 'entertainment' : 'occasion',
  trend_score: index < 3 ? 100 - index : null,
}))

describe('collections directory', () => {
  beforeEach(() => {
    getDesignCategories.mockReset()
    notFound.mockClear()
    getDesignCategories.mockResolvedValue({ data: categories, error: null })
  })

  it('server-renders the nine editorial links and only the first 30 categories on page one', async () => {
    const { default: CollectionsPage } = await import('./page')
    const markup = renderToStaticMarkup(await CollectionsPage({}))

    const featuredHrefs = Array.from(
      markup.matchAll(/href="(\/collections\/(?:bento-cake|minimalist-cake|katseye-cake|kuromi-cake|minecraft-cake|graduation-cake|debut-cake|30th-birthday-cake|senior-cake))"/g),
      (match) => match[1],
    )
    expect(featuredHrefs).toEqual([
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
    expect(markup).toContain('href="/collections/category-1"')
    expect(markup).toContain('href="/collections/category-30"')
    expect(markup).not.toContain('href="/collections/category-31"')
    expect(markup).toContain('data-total-count="61"')
  })

  it('renders the requested server slice without repeating the editorial block', async () => {
    const { default: CollectionsPage } = await import('./page')
    const markup = renderToStaticMarkup(await CollectionsPage({
      searchParams: Promise.resolve({ page: '2' }),
    }))

    expect(markup).toContain('data-current-page="2"')
    expect(markup).toContain('data-total-pages="3"')
    expect(markup).toContain('data-start-index="30"')
    expect(markup).toContain('href="/collections/category-31"')
    expect(markup).toContain('href="/collections/category-60"')
    expect(markup).not.toContain('href="/collections/category-30"')
    expect(markup).not.toContain('Featured Cake Collections')
  })

  it('uses a self-referencing canonical for every valid directory page', async () => {
    const { generateMetadata } = await import('./page')
    const firstPage = await generateMetadata({})
    const secondPage = await generateMetadata({ searchParams: Promise.resolve({ page: '2' }) })

    expect(firstPage.alternates?.canonical).toBe('https://genie.ph/collections')
    expect(secondPage.alternates?.canonical).toBe('https://genie.ph/collections?page=2')
    expect(secondPage.openGraph && 'url' in secondPage.openGraph ? secondPage.openGraph.url : null)
      .toBe('https://genie.ph/collections?page=2')
  })

  it('renders only the current schema slice with global list positions', async () => {
    const { default: CollectionsPage } = await import('./page')
    const markup = renderToStaticMarkup(await CollectionsPage({
      searchParams: Promise.resolve({ page: '2' }),
    }))
    const rawSchema = markup.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1]
    const schema = JSON.parse(rawSchema || '{}')

    expect(schema.url).toBe('https://genie.ph/collections?page=2')
    expect(schema.mainEntity.numberOfItems).toBe(61)
    expect(schema.mainEntity.itemListElement).toHaveLength(30)
    expect(schema.mainEntity.itemListElement[0].position).toBe(31)
    expect(schema.mainEntity.itemListElement[29].position).toBe(60)
  })

  it('normalizes malformed pages and returns a real 404 past the last page', async () => {
    const { default: CollectionsPage } = await import('./page')
    const invalidMarkup = renderToStaticMarkup(await CollectionsPage({
      searchParams: Promise.resolve({ page: '-4' }),
    }))

    expect(invalidMarkup).toContain('data-current-page="1"')
    await expect(CollectionsPage({ searchParams: Promise.resolve({ page: '4' }) }))
      .rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalledOnce()
  })
})
