export const GA4_MEASUREMENT_ID = 'G-C28QNPRWFK'
export const CLARITY_PROJECT_ID = 'te894qldzn'
export const INTERNAL_TRAFFIC_COOKIE_NAME = 'genie_internal_traffic'
export const INTERNAL_TRAFFIC_COOKIE_VALUE = '1'
export const INTERNAL_TRAFFIC_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const ANALYTICS_EXCLUDED_EXACT_PATHS = new Set([
  '/similarity-debugger',
])

export function isAnalyticsSuppressedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/admin')) return true
  return ANALYTICS_EXCLUDED_EXACT_PATHS.has(pathname)
}

export function isAnalyticsTrackablePath(pathname: string | null | undefined): boolean {
  return !isAnalyticsSuppressedPath(pathname)
}

export function shouldMarkInternalTraffic(pathname: string | null | undefined): boolean {
  return isAnalyticsSuppressedPath(pathname)
}

export function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null

  const encodedName = `${encodeURIComponent(name)}=`
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName))

  if (!cookie) return null

  return decodeURIComponent(cookie.slice(encodedName.length))
}

export function hasInternalTrafficCookie(cookieHeader: string): boolean {
  return readCookieValue(cookieHeader, INTERNAL_TRAFFIC_COOKIE_NAME) === INTERNAL_TRAFFIC_COOKIE_VALUE
}
