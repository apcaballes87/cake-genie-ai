import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  markAnalyticsReady,
  resetAnalyticsStateForTests,
  setAnalyticsRouteTracking,
  trackImageUpload,
  trackSearch,
} from './analytics'

describe('analytics helper', () => {
  const gtagMock = vi.fn()
  const clarityMock = vi.fn()

  beforeEach(() => {
    resetAnalyticsStateForTests()
    gtagMock.mockReset()
    clarityMock.mockReset()
    ;(window as typeof window & { gtag?: typeof gtagMock }).gtag = gtagMock
    ;(window as typeof window & { clarity?: typeof clarityMock }).clarity = clarityMock
  })

  it('queues events until analytics is configured on a trackable route', () => {
    setAnalyticsRouteTracking(true)

    trackSearch('bento cake', 'landing')
    expect(gtagMock).not.toHaveBeenCalled()
    expect(clarityMock).not.toHaveBeenCalled()

    markAnalyticsReady()

    expect(gtagMock).toHaveBeenCalledWith('event', 'search', {
      search_term: 'bento cake',
      ui_source: 'landing',
    })
    expect(clarityMock).toHaveBeenCalledWith('event', 'API Search')
  })

  it('drops events on excluded routes instead of queueing them', () => {
    setAnalyticsRouteTracking(false)
    markAnalyticsReady()

    trackImageUpload('landing')

    expect(gtagMock).not.toHaveBeenCalled()
    expect(clarityMock).not.toHaveBeenCalled()
  })

  it('clears any queued events if the route is later classified as excluded', () => {
    trackSearch('custom cake', 'autocomplete_enter')
    setAnalyticsRouteTracking(false)
    markAnalyticsReady()

    expect(gtagMock).not.toHaveBeenCalled()
    expect(clarityMock).not.toHaveBeenCalled()
  })
})
