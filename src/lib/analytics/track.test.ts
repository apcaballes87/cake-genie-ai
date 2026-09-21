import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const signInAnonymouslyMock = vi.fn()
const sendBeaconMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: getSessionMock,
      signInAnonymously: signInAnonymouslyMock,
    },
  })),
}))

async function flushBeacon(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function readBeaconPayload(): Promise<Record<string, unknown>> {
  const blob = sendBeaconMock.mock.calls.at(-1)?.[1] as Blob
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
  return JSON.parse(text) as Record<string, unknown>
}

async function readBeaconBlob(blob: Blob): Promise<Record<string, unknown>> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
  return JSON.parse(text) as Record<string, unknown>
}

describe('storefront analytics beacon', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=launch')
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconMock.mockReturnValue(true),
    })
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(new Response(null, { status: 204 })))
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: 'anonymous-session-id', is_anonymous: true },
        },
      },
    })
    signInAnonymouslyMock.mockResolvedValue({
      data: { user: { id: 'anonymous-session-id', is_anonymous: true } },
    })
  })

  it('captures landing UTMs, strips them from the URL, and dedupes visit_start per session', async () => {
    const { trackBeacon } = await import('./track')

    trackBeacon('visit_start')
    await flushBeacon()
    trackBeacon('visit_start')
    await flushBeacon()

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('')
    expect(window.localStorage.getItem('genie_visitor_id')).toBeTruthy()
    expect(window.sessionStorage.getItem('genie_analytics_utm_v1')).toContain('tiktok')

    const payload = await readBeaconPayload()
    expect(payload).toMatchObject({
      event_type: 'visit_start',
      anonymous_user_id: expect.any(String),
      session_id: 'anonymous-session-id',
      utm_source: 'tiktok',
      utm_medium: 'paid_social',
      utm_campaign: 'launch',
    })
  })

  it('falls back to a keepalive request when sendBeacon cannot queue', async () => {
    sendBeaconMock.mockReturnValue(false)
    const { trackBeacon } = await import('./track')

    trackBeacon('page_view')
    await flushBeacon()

    expect(fetchMock).toHaveBeenCalledWith('/api/track', expect.objectContaining({
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
    }))
  })

  it('dedupes checkout_start and purchase markers without putting PII in the payload', async () => {
    const { trackBeacon } = await import('./track')

    trackBeacon('checkout_start')
    trackBeacon('checkout_start')
    trackBeacon('purchase', { dedupeKey: 'order-1' })
    trackBeacon('purchase', { dedupeKey: 'order-1' })
    await flushBeacon()

    expect(sendBeaconMock).toHaveBeenCalledTimes(2)
    const payloads = await Promise.all(
      sendBeaconMock.mock.calls.map(async (call) => readBeaconBlob(call[1] as Blob)),
    )
    expect(payloads.map((payload) => payload.event_type)).toEqual(['checkout_start', 'purchase'])
    expect(payloads.every((payload) => !('email' in payload))).toBe(true)
  })
})
