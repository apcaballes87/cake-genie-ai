'use client'

import { useLayoutEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  INTERNAL_TRAFFIC_COOKIE_NAME,
  INTERNAL_TRAFFIC_COOKIE_VALUE,
  isAnalyticsTrackablePath,
} from '@/lib/analyticsRoutes'
import {
  markAnalyticsReady,
  sendPageView,
  setClarityTag,
  setAnalyticsRouteTracking,
} from '@/lib/analytics'

interface AnalyticsBoundaryProps {
  enabled: boolean
  measurementId: string
}

type GoogleTag = (...args: unknown[]) => void

function hasInternalTrafficCookie(): boolean {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${INTERNAL_TRAFFIC_COOKIE_NAME}=${INTERNAL_TRAFFIC_COOKIE_VALUE}`)
}

function shouldIgnoreReferrer(referrer: string, pathname: string): boolean {
  const isXendit = referrer.includes('xendit.co')
  const isGooglePay = referrer.includes('pay.google.com') || referrer.includes('accounts.google.com')
  const isOrderConfirmation = pathname.includes('/order-confirmation')

  return isXendit || isGooglePay || isOrderConfirmation
}

export function AnalyticsBoundary({ enabled, measurementId }: AnalyticsBoundaryProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamString = searchParams.toString()

  useLayoutEffect(() => {
    if (!enabled) return

    const isTrackable = isAnalyticsTrackablePath(pathname)
    const isInternalUser = hasInternalTrafficCookie()

    setAnalyticsRouteTracking(isTrackable)

    if (isInternalUser) {
      setClarityTag('internal_user', 'true')
    }

    if (!isTrackable || typeof window === 'undefined') {
      return
    }

    const gtag = (window as typeof window & { gtag?: GoogleTag }).gtag
    if (typeof gtag !== 'function') {
      return
    }

    const referrer = document.referrer || ''
    const ignoreReferrer = shouldIgnoreReferrer(referrer, pathname || '')

    gtag('set', 'user_properties', {
      internal_user: isInternalUser ? 'true' : 'false',
    })

    gtag('config', measurementId, {
      send_page_view: false,
      ignore_referrer: ignoreReferrer,
    })

    markAnalyticsReady()

    const pagePath = searchParamString ? `${pathname}?${searchParamString}` : pathname
    sendPageView({
      page_location: window.location.href,
      page_path: pagePath,
      page_title: document.title,
    })
  }, [enabled, measurementId, pathname, searchParamString])

  return null
}
