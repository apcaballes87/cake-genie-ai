import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const upsertMock = vi.fn()
const fromMock = vi.fn(() => ({ upsert: upsertMock }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}))

describe('POST /api/investors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    upsertMock.mockResolvedValue({ error: null })
  })

  it('rejects an invalid email address', async () => {
    const { POST } = await import('./route')
    const response = await POST(new NextRequest('http://localhost/api/investors', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, error: 'Please enter a valid email address.' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('normalizes and upserts an investor subscriber', async () => {
    const { POST } = await import('./route')
    const response = await POST(new NextRequest('http://localhost/api/investors', {
      method: 'POST',
      body: JSON.stringify({ email: '  Investor@Example.com ' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(fromMock).toHaveBeenCalledWith('investor_subscribers')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'investor@example.com',
        is_active: true,
        source: 'investors-page',
        unsubscribed_at: null,
      }),
      { onConflict: 'email' },
    )
  })

  it('does not expose database errors to the subscriber', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'database unavailable' } })
    const { POST } = await import('./route')
    const response = await POST(new NextRequest('http://localhost/api/investors', {
      method: 'POST',
      body: JSON.stringify({ email: 'investor@example.com' }),
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Unable to save your email right now. Please try again later.',
    })
  })
})
