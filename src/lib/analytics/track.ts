'use client'

import { createClient } from '@/lib/supabase/client'

export const BEACON_EVENT_TYPES = [
  'visit_start',
  'page_view',
  'add_to_cart',
  'checkout_start',
  'purchase',
  'email_captured',
] as const

export type BeaconEventType = typeof BEACON_EVENT_TYPES[number]

export interface TrackBeaconOptions {
  /** A client-only dedupe key for events such as a purchase/order attempt. */
  dedupeKey?: string
}

interface StoredUtmParameters {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
}

interface AuthUserSnapshot {
  id: string
  is_anonymous?: boolean
}

interface BeaconPayload extends StoredUtmParameters {
  anonymous_user_id: string
  session_id: string
  event_type: BeaconEventType
  path: string
  referrer: string | null
  device_type: 'mobile' | 'desktop' | 'tablet'
}

const VISITOR_ID_KEY = 'genie_visitor_id'
const SESSION_ID_KEY = 'genie_analytics_session_id_v1'
const SESSION_ACTIVITY_KEY = 'genie_analytics_session_activity_v1'
const VISIT_START_SENT_KEY = 'genie_analytics_visit_start_sent_v1'
const VISIT_START_PENDING_KEY = 'genie_analytics_visit_start_pending_v1'
const UTM_KEY = 'genie_analytics_utm_v1'
const SESSION_WINDOW_MS = 30 * 60 * 1000
const MAX_FIELD_LENGTH = 500
const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const

let anonymousAuthPromise: Promise<AuthUserSnapshot | null> | null = null

const emptyUtm = (): StoredUtmParameters => ({
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
})

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined'
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeStorage(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // Analytics must never affect the customer flow.
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `genie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

function readOrCreateVisitorId(): string {
  if (!canUseBrowserStorage()) return createId()

  const existing = readStorage(window.localStorage, VISITOR_ID_KEY)
  if (existing) return existing

  const next = createId()
  writeStorage(window.localStorage, VISITOR_ID_KEY, next)
  return next
}

function normalizeUtmValue(value: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized.slice(0, MAX_FIELD_LENGTH) : null
}

function readStoredUtm(): StoredUtmParameters {
  if (!canUseBrowserStorage()) return emptyUtm()

  const raw = readStorage(window.sessionStorage, UTM_KEY)
  if (!raw) return emptyUtm()

  try {
    const parsed = JSON.parse(raw) as Partial<StoredUtmParameters>
    return UTM_KEYS.reduce<StoredUtmParameters>((result, key) => {
      result[key] = normalizeUtmValue(typeof parsed[key] === 'string' ? parsed[key] : null)
      return result
    }, emptyUtm())
  } catch {
    return emptyUtm()
  }
}

/**
 * Save landing UTMs for the current browser session and remove only those
 * parameters from the visible URL. Buyer attribution is synchronized before
 * this function runs from AnalyticsBoundary, so its first-touch URL remains
 * intact in the existing attribution record.
 */
export function captureUtmParametersFromLocation(): void {
  if (!canUseBrowserStorage()) return

  try {
    const url = new URL(window.location.href)
    const next = readStoredUtm()
    let changed = false
    let foundUtm = false

    for (const key of UTM_KEYS) {
      if (!url.searchParams.has(key)) continue
      foundUtm = true
      next[key] = normalizeUtmValue(url.searchParams.get(key))
      url.searchParams.delete(key)
      changed = true
    }

    if (foundUtm) {
      writeStorage(window.sessionStorage, UTM_KEY, JSON.stringify(next))
    }

    if (changed) {
      const visibleUrl = `${url.pathname}${url.search}${url.hash}`
      window.history.replaceState(window.history.state, '', visibleUrl)
    }
  } catch {
    // URL/storage restrictions must not affect navigation or checkout.
  }
}

function getDeviceType(): BeaconPayload['device_type'] {
  if (typeof navigator === 'undefined') return 'desktop'

  const userAgent = navigator.userAgent || ''
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

async function resolveAuthUser(bootstrapAnonymous: boolean): Promise<AuthUserSnapshot | null> {
  if (anonymousAuthPromise) return anonymousAuthPromise

  const resolve = async (): Promise<AuthUserSnapshot | null> => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) return session.user

      if (!bootstrapAnonymous) return null

      const { data: { user } } = await supabase.auth.signInAnonymously()
      return user ?? null
    } catch {
      return null
    }
  }

  const promise = resolve()
  if (bootstrapAnonymous) {
    anonymousAuthPromise = promise
    void promise.finally(() => {
      if (anonymousAuthPromise === promise) anonymousAuthPromise = null
    })
  }

  return promise
}

function getSessionId(user: AuthUserSnapshot | null): string {
  if (!canUseBrowserStorage()) return user?.id || createId()

  const now = Date.now()
  const existing = readStorage(window.sessionStorage, SESSION_ID_KEY)
  const lastActivity = Number(readStorage(window.sessionStorage, SESSION_ACTIVITY_KEY) || 0)
  const expired = !existing || !Number.isFinite(lastActivity) || now - lastActivity > SESSION_WINDOW_MS

  // Anonymous cart rows are RLS-owned by the Supabase anonymous auth UUID.
  // Reuse it exactly so event rows can be joined to guest carts. Once a guest
  // becomes registered, retaining the existing session id also preserves the
  // pre-login journey.
  const sessionId = user?.is_anonymous
    ? user.id
    : existing && !expired
      ? existing
      : createId()

  writeStorage(window.sessionStorage, SESSION_ID_KEY, sessionId)
  writeStorage(window.sessionStorage, SESSION_ACTIVITY_KEY, String(now))
  return sessionId
}

function hasDedupeMarker(eventType: BeaconEventType, sessionId: string, dedupeKey?: string): boolean {
  if (!canUseBrowserStorage()) return false

  if (eventType === 'visit_start') {
    return readStorage(window.sessionStorage, VISIT_START_SENT_KEY) === sessionId
  }

  if (eventType === 'checkout_start') {
    return readStorage(window.sessionStorage, `genie_analytics_checkout_start_${sessionId}`) === '1'
  }

  if (eventType === 'purchase' && dedupeKey) {
    return readStorage(window.sessionStorage, `genie_analytics_purchase_${dedupeKey}`) === '1'
  }

  return false
}

function setDedupeMarker(eventType: BeaconEventType, sessionId: string, dedupeKey?: string): void {
  if (!canUseBrowserStorage()) return

  if (eventType === 'visit_start') {
    writeStorage(window.sessionStorage, VISIT_START_SENT_KEY, sessionId)
    return
  }

  if (eventType === 'checkout_start') {
    writeStorage(window.sessionStorage, `genie_analytics_checkout_start_${sessionId}`, '1')
    return
  }

  if (eventType === 'purchase' && dedupeKey) {
    writeStorage(window.sessionStorage, `genie_analytics_purchase_${dedupeKey}`, '1')
  }
}

function buildPayload(eventType: BeaconEventType, user: AuthUserSnapshot | null): BeaconPayload {
  captureUtmParametersFromLocation()
  const utm = readStoredUtm()
  const sessionId = getSessionId(user)

  return {
    ...utm,
    anonymous_user_id: readOrCreateVisitorId(),
    session_id: sessionId,
    event_type: eventType,
    path: window.location.pathname || '/',
    referrer: document.referrer ? document.referrer.slice(0, MAX_FIELD_LENGTH) : null,
    device_type: getDeviceType(),
  }
}

async function deliver(payload: BeaconPayload): Promise<void> {
  const body = JSON.stringify(payload)

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const queued = navigator.sendBeacon(
        '/api/track',
        new Blob([body], { type: 'application/json' }),
      )
      if (queued) return
    }
  } catch {
    // Fall back to fetch below. The request is still fire-and-forget.
  }

  try {
    const response = await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'same-origin',
      keepalive: true,
    })

    if (!response.ok) {
      console.debug('[analytics] beacon rejected', response.status)
    }
  } catch (error) {
    console.debug('[analytics] beacon unavailable', error)
  }
}

async function sendBeaconEvent(eventType: BeaconEventType, options: TrackBeaconOptions): Promise<void> {
  const isVisitStart = eventType === 'visit_start'

  if (isVisitStart && canUseBrowserStorage()) {
    if (readStorage(window.sessionStorage, VISIT_START_PENDING_KEY) === '1') return
    writeStorage(window.sessionStorage, VISIT_START_PENDING_KEY, '1')
  }

  try {
    const user = await resolveAuthUser(isVisitStart)
    const payload = buildPayload(eventType, user)

    if (hasDedupeMarker(eventType, payload.session_id, options.dedupeKey)) return

    setDedupeMarker(eventType, payload.session_id, options.dedupeKey)
    await deliver(payload)
  } finally {
    if (isVisitStart && canUseBrowserStorage()) {
      removeStorage(window.sessionStorage, VISIT_START_PENDING_KEY)
    }
  }
}

/** Fire a beacon without ever putting analytics on the customer-critical path. */
export function trackBeacon(eventType: BeaconEventType, options: TrackBeaconOptions = {}): void {
  if (!canUseBrowserStorage()) return
  void sendBeaconEvent(eventType, options).catch((error) => {
    console.debug('[analytics] beacon failed', error)
  })
}
