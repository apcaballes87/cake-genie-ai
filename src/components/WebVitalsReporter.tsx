'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { trackEvent } from '@/lib/analytics'
import { buildWebVitalEventParams, type GenieWebVitalMetric } from '@/lib/webVitals'

export function WebVitalsReporter() {
  const pathname = usePathname() || '/'
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const reportMetric = useCallback((metric: GenieWebVitalMetric) => {
    trackEvent('web_vital', buildWebVitalEventParams(metric, pathnameRef.current))
  }, [])

  useReportWebVitals(reportMetric)
  return null
}
