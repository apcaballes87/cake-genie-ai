import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('homepage PageSpeed regressions', () => {
  it('keeps the mobile LCP carousel stable until explicit user input', () => {
    const source = readSource('src/app/LandingClient.tsx')
    const carousel = readSource('src/app/HeroProductPeekCarouselEmbla.tsx')
    const hook = source.slice(
      source.indexOf('function useShouldMountCarousel'),
      source.indexOf('function HeroProductPeekCarouselPlaceholder'),
    )
    const placeholder = source.slice(
      source.indexOf('function HeroProductPeekCarouselPlaceholder'),
      source.indexOf('function HeroProductPeekCarousel('),
    )

    expect(hook).toContain("'pointerdown'")
    expect(hook).toContain("'touchstart'")
    expect(hook).toContain("'keydown'")
    expect(hook).not.toContain("'scroll'")
    expect(hook).not.toContain('setTimeout(activate')
    expect(placeholder).not.toContain('aria-label={`${product.title} example`}')
    expect(placeholder).toContain('isCenter || hasLoadedCenterProduct')
    expect(placeholder).toContain('setHasLoadedCenterProduct(true)')
    // The site uses an 85% mobile root font size, so 2rem yields a measured
    // 27.2px target and still clears Lighthouse's 24px minimum.
    expect(carousel).toContain('h-8 w-8')
  })

  it('preloads only the mobile LCP image plus the desktop-only LCP image', () => {
    const source = readSource('src/app/page.tsx')
    const landingClient = readSource('src/app/LandingClient.tsx')
    const preloadCount = source.match(/rel="preload"/g)?.length ?? 0
    const demoImage = landingClient.slice(
      landingClient.indexOf('src={displayedImageSrc}'),
      landingClient.indexOf('style={{ opacity: imgVisible'),
    )

    expect(preloadCount).toBe(2)
    expect(source).toContain('HOMEPAGE_ASSETS.heroProducts.minimalist')
    expect(source).toContain('HOMEPAGE_ASSETS.transition')
    expect(source).toContain('media="(min-width: 768px)"')
    expect(demoImage).toContain('loading="lazy"')
    expect(demoImage).toContain('fetchPriority="low"')
    expect(landingClient).toContain('if (entry.isIntersecting) setHasActivatedDemo(true)')
    expect(landingClient).toContain('hasActivatedDemo ? (')
    expect(landingClient).toContain('if (!priceHeading) return')
    expect(landingClient).not.toContain('if (!priceHeading || !rushHeading) return')
  })

  it('allows browser zoom and defers the analytics payload', () => {
    const layout = readSource('src/app/layout.tsx')

    expect(layout).not.toContain('maximumScale')
    expect(layout).not.toContain('userScalable')
    expect(layout).toContain('strategy="lazyOnload"')
  })

  it('keeps public homepage data cookie-free and isolates query-string reads', () => {
    const page = readSource('src/app/page.tsx')
    const landingClient = readSource('src/app/LandingClient.tsx')

    expect(page).toContain('createPublicServerSupabaseClient')
    expect(page).not.toContain("@/lib/supabase/server")
    expect(landingClient).toContain('const HomepageQueryCapture')
    expect(landingClient).toContain('<HomepageQueryCapture onUploadRequested={openUploaderFromQuery} />')
    expect(landingClient).not.toContain('useState(() => searchParams.get')
  })
})
