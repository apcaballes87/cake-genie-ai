import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  markAnalyticsReady,
  resetAnalyticsStateForTests,
  setAnalyticsRouteTracking,
  getAnalyticsValueBucket,
  trackCartRequirementMissing,
  trackCheckoutPlaceOrderClicked,
  trackCustomizerAddToCartBlocked,
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

  it('tracks non-sensitive customizer add-to-cart blockers', () => {
    setAnalyticsRouteTracking(true)
    markAnalyticsReady()

    trackCustomizerAddToCartBlocked({
      sourceSurface: 'analysis_cache',
      designSlug: 'birthday-cake-1234',
      reason: 'price_missing',
      hasPendingDesignChanges: true,
    })

    expect(gtagMock).toHaveBeenCalledWith('event', 'customizer_add_to_cart_blocked', {
      event_category: 'ecommerce_funnel',
      source_surface: 'analysis_cache',
      design_slug: 'birthday-cake-1234',
      blocked_reason: 'price_missing',
      has_pending_design_changes: true,
    })
    expect(clarityMock).toHaveBeenCalledWith('event', 'API Customizer Add to Cart Blocked')
  })

  it('tracks checkout intent and missing requirements without private field values', () => {
    setAnalyticsRouteTracking(true)
    markAnalyticsReady()

    const base = {
      flowType: 'full_payment' as const,
      fulfillmentType: 'delivery' as const,
      itemCount: 2,
      valueBucket: getAnalyticsValueBucket(2499),
      isGuest: true,
    }

    trackCheckoutPlaceOrderClicked(base)
    trackCartRequirementMissing({
      ...base,
      missingLabels: ['Date of Event', 'Delivery Address'],
    })

    expect(gtagMock).toHaveBeenNthCalledWith(1, 'event', 'checkout_place_order_clicked', {
      event_category: 'ecommerce_funnel',
      flow_type: 'full_payment',
      fulfillment_type: 'delivery',
      items_count: 2,
      value_bucket: '2000_2999',
      is_guest: true,
    })
    expect(gtagMock).toHaveBeenNthCalledWith(2, 'event', 'cart_requirement_missing', {
      event_category: 'ecommerce_funnel',
      flow_type: 'full_payment',
      fulfillment_type: 'delivery',
      items_count: 2,
      value_bucket: '2000_2999',
      is_guest: true,
      missing_requirements: ['Date of Event', 'Delivery Address'],
    })
    expect(clarityMock).toHaveBeenCalledWith('event', 'API Checkout Place Order Clicked')
    expect(clarityMock).toHaveBeenCalledWith('event', 'API Cart Requirement Missing')
  })
})
