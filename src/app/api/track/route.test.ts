import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const fromMock = vi.fn()
const insertMock = vi.fn()
const getUserMock = vi.fn()

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: vi.fn(() => ({ from: fromMock })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}))

describe('POST /api/track', () => {
  beforeEach(() => {
    vi.resetModules()
    fromMock.mockReset()
    insertMock.mockReset()
    getUserMock.mockReset()
    fromMock.mockReturnValue({ insert: insertMock })
    insertMock.mockResolvedValue({ error: null })
    getUserMock.mockResolvedValue({ data: { user: null } })
  })

  it('validates and inserts schema-supported fields with the authenticated user from the session', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'auth-user-id', is_anonymous: false } },
    })

    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vercel-ip-country': 'ph',
      },
      body: JSON.stringify({
        event_type: 'checkout_start',
        user_id: 'spoofed-user-id',
        anonymous_user_id: 'visitor-id',
        session_id: 'session-id',
        path: '/cart',
        referrer: 'https://www.facebook.com/',
        utm_source: 'facebook',
        utm_medium: 'paid_social',
        utm_campaign: 'mothers-day',
        utm_term: null,
        utm_content: 'story-ad-1',
        device_type: 'mobile',
        order_id: 'must-not-be-inserted',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(204)
    expect(fromMock).toHaveBeenCalledWith('genie_visit_events')
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'auth-user-id',
      anonymous_user_id: 'visitor-id',
      session_id: 'session-id',
      event_type: 'checkout_start',
      path: '/cart',
      referrer: 'https://www.facebook.com/',
      device_type: 'mobile',
      country: 'PH',
      utm_source: 'facebook',
      utm_medium: 'paid_social',
      utm_campaign: 'mothers-day',
      utm_term: null,
      utm_content: 'story-ad-1',
    })
  })

  it('does not assign user_id to anonymous auth sessions', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'anonymous-auth-id', is_anonymous: true } },
    })

    const { POST } = await import('./route')
    const response = await POST(new NextRequest('http://localhost/api/track', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'visit_start',
        anonymous_user_id: 'visitor-id',
        session_id: 'anonymous-auth-id',
        path: '/',
        device_type: 'desktop',
      }),
    }))

    expect(response.status).toBe(204)
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }))
  })

  it('rejects unsupported events and payloads without an identity', async () => {
    const { POST } = await import('./route')

    const unsupported = await POST(new NextRequest('http://localhost/api/track', {
      method: 'POST',
      body: JSON.stringify({ event_type: 'email_address', session_id: 'session-id' }),
    }))
    const missingIdentity = await POST(new NextRequest('http://localhost/api/track', {
      method: 'POST',
      body: JSON.stringify({ event_type: 'page_view', path: '/' }),
    }))

    expect(unsupported.status).toBe(400)
    expect(missingIdentity.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
