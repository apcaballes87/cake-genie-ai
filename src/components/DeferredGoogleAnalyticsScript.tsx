'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

const FALLBACK_DELAY_MS = 20_000
const POST_INTERACTION_DELAY_MS = 1_000

/**
 * GA4 is useful for attribution, but its full runtime is not required to paint
 * or use the page. The inline gtag queue is installed by the root layout, so
 * page views and early events wait safely until this script loads.
 */
export function DeferredGoogleAnalyticsScript({ measurementId }: { measurementId: string }) {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    let interactionTimer: number | undefined

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'touchstart',
      'keydown',
      'scroll',
    ]

    const removeListeners = () => {
      events.forEach((eventName) => window.removeEventListener(eventName, scheduleAfterInteraction))
    }

    const load = () => {
      removeListeners()
      window.clearTimeout(fallbackTimer)
      setShouldLoad(true)
    }

    function scheduleAfterInteraction() {
      removeListeners()
      if (interactionTimer === undefined) {
        interactionTimer = window.setTimeout(load, POST_INTERACTION_DELAY_MS)
      }
    }

    events.forEach((eventName) =>
      window.addEventListener(eventName, scheduleAfterInteraction, { once: true, passive: true }),
    )
    const fallbackTimer = window.setTimeout(load, FALLBACK_DELAY_MS)

    return () => {
      removeListeners()
      if (interactionTimer !== undefined) window.clearTimeout(interactionTimer)
      window.clearTimeout(fallbackTimer)
    }
  }, [])

  if (!shouldLoad) return null

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  )
}
