import { describe, expect, it } from 'vitest'
import nextConfig from './next.config'

describe('SEO redirects', () => {
  it('permanently consolidates the weaker bento article', async () => {
    const redirects = await nextConfig.redirects?.()

    expect(redirects).toEqual(expect.arrayContaining([
      {
        source: '/blog/bento-cake-designs-guide-every-style-2026',
        destination: '/blog/bento-cake-guide-2026',
        permanent: true,
      },
    ]))
  })
})
