import { cleanup, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsBoundary } from './AnalyticsBoundary'
import { resetAnalyticsStateForTests } from '@/lib/analytics'

const navigationState = vi.hoisted(() => ({
  pathname: '/',
  search: '',
}))

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isAuthenticated: false,
}))

const syncBuyerAttributionForCurrentPageMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/lib/buyerAttribution', () => ({
  syncBuyerAttributionForCurrentPage: (...args: unknown[]) =>
    syncBuyerAttributionForCurrentPageMock(...args),
}))

function setLocation(path: string): void {
  window.history.pushState({}, '', path)
}

function clearInternalTrafficCookie(): void {
  document.cookie = 'genie_internal_traffic=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

describe('AnalyticsBoundary', () => {
  const gtagMock = vi.fn()
  const clarityMock = vi.fn()

  beforeEach(() => {
    cleanup()
    resetAnalyticsStateForTests()
    gtagMock.mockReset()
    clarityMock.mockReset()
    ;(window as typeof window & { gtag?: typeof gtagMock }).gtag = gtagMock
    ;(window as typeof window & { clarity?: typeof clarityMock }).clarity = clarityMock
    authState.user = null
    authState.isAuthenticated = false
    syncBuyerAttributionForCurrentPageMock.mockReset()
    syncBuyerAttributionForCurrentPageMock.mockResolvedValue(null)
    clearInternalTrafficCookie()
    document.title = 'Genie.ph Test'
    navigationState.pathname = '/'
    navigationState.search = ''
    setLocation('/')
  })

  it('does not initialize GA4 on excluded routes', () => {
    document.cookie = 'genie_internal_traffic=1; path=/'
    navigationState.pathname = '/admin/search-analysis'
    setLocation('/admin/search-analysis')

    render(<AnalyticsBoundary enabled measurementId="G-TEST123" />)

    expect(gtagMock).not.toHaveBeenCalled()
    expect(clarityMock).toHaveBeenCalledWith('set', 'internal_user', 'true')
  })

  it('sets the internal_user property before the first public page_view when the cookie is present', async () => {
    document.cookie = 'genie_internal_traffic=1; path=/'

    render(<AnalyticsBoundary enabled measurementId="G-TEST123" />)

    await waitFor(() => {
      expect(gtagMock).toHaveBeenCalledWith('set', 'user_properties', {
        internal_user: 'true',
      })
    })

    expect(clarityMock).toHaveBeenCalledWith('set', 'internal_user', 'true')
    expect(gtagMock).toHaveBeenCalledWith('config', 'G-TEST123', {
      send_page_view: false,
      ignore_referrer: false,
    })
    expect(syncBuyerAttributionForCurrentPageMock).toHaveBeenCalledWith('G-TEST123')
    expect(gtagMock).toHaveBeenCalledWith('event', 'page_view', {
      page_location: 'http://localhost:3000/',
      page_path: '/',
      page_title: 'Genie.ph Test',
    })
  })

  it('sets GA4 user_id for authenticated users', async () => {
    authState.user = { id: 'user-123' }
    authState.isAuthenticated = true

    render(<AnalyticsBoundary enabled measurementId="G-TEST123" />)

    await waitFor(() => {
      expect(gtagMock).toHaveBeenCalledWith('config', 'G-TEST123', {
        send_page_view: false,
        ignore_referrer: false,
        user_id: 'user-123',
      })
    })
  })

  it('sends manual pageviews only for public route transitions', async () => {
    const { rerender } = render(<AnalyticsBoundary enabled measurementId="G-TEST123" />)

    await waitFor(() => {
      expect(
        gtagMock.mock.calls.filter(([command, eventName]) => command === 'event' && eventName === 'page_view')
      ).toHaveLength(1)
    })

    navigationState.pathname = '/admin/image-studio'
    navigationState.search = ''
    setLocation('/admin/image-studio')
    rerender(<AnalyticsBoundary enabled measurementId="G-TEST123" />)

    expect(
      gtagMock.mock.calls.filter(([command, eventName]) => command === 'event' && eventName === 'page_view')
    ).toHaveLength(1)

    navigationState.pathname = '/blog'
    navigationState.search = 'q=bento'
    setLocation('/blog?q=bento')
    rerender(<AnalyticsBoundary enabled measurementId="G-TEST123" />)

    await waitFor(() => {
      const pageViewCalls = gtagMock.mock.calls.filter(
        ([command, eventName]) => command === 'event' && eventName === 'page_view'
      )

      expect(pageViewCalls).toHaveLength(2)
      expect(pageViewCalls[1]).toEqual([
        'event',
        'page_view',
        {
          page_location: 'http://localhost:3000/blog?q=bento',
          page_path: '/blog?q=bento',
          page_title: 'Genie.ph Test',
        },
      ])
    })
  })
})
