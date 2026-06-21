'use client'

import { useEffect } from 'react'

const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)'

function shouldBlockMobilePageZoom() {
  return (
    typeof window !== 'undefined'
    && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches
    && !document.body.classList.contains('genie-image-zoom-open')
  )
}

export default function MobileGestureGuard() {
  useEffect(() => {
    const preventGesture = (event: Event) => {
      if (!shouldBlockMobilePageZoom()) {
        return
      }

      event.preventDefault()
    }

    const preventMultiTouchZoom = (event: TouchEvent) => {
      if (!shouldBlockMobilePageZoom() || event.touches.length < 2) {
        return
      }

      event.preventDefault()
    }

    document.addEventListener('gesturestart', preventGesture as EventListener, { passive: false })
    document.addEventListener('gesturechange', preventGesture as EventListener, { passive: false })
    document.addEventListener('gestureend', preventGesture as EventListener, { passive: false })
    document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', preventGesture as EventListener)
      document.removeEventListener('gesturechange', preventGesture as EventListener)
      document.removeEventListener('gestureend', preventGesture as EventListener)
      document.removeEventListener('touchmove', preventMultiTouchZoom)
    }
  }, [])

  return null
}
