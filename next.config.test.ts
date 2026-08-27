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

  it('forwards the short Google reviews URL to Genie.ph on Google Maps', async () => {
    const redirects = await nextConfig.redirects?.()

    expect(redirects).toEqual(expect.arrayContaining([
      {
        source: '/google-reviews',
        destination: 'https://www.google.com/maps/place/Genie.ph/@10.3125689,123.8942337,18z/data=!4m8!3m7!1s0x33a999ad7bbf0375:0x113e78a16bc0a441!8m2!3d10.3125663!4d123.8955238!9m1!1b1!16s%2Fg%2F11z073yl0w?entry=ttu&g_ep=EgoyMDI2MDgyNC4wIKXMDSoASAFQAw%3D%3D',
        permanent: true,
      },
    ]))
  })
})
