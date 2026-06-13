import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const selectMock = vi.fn()
const eqMock = vi.fn()
const maybeSingleMock = vi.fn()
const insertMock = vi.fn()
const upsertMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: fromMock,
  })),
}))

describe('POST /api/newsletter', () => {
  beforeEach(() => {
    vi.resetModules()
    selectMock.mockReset()
    eqMock.mockReset()
    maybeSingleMock.mockReset()
    insertMock.mockReset()
    upsertMock.mockReset()
    fromMock.mockReset()
    
    // Set up standard mock chain
    fromMock.mockReturnValue({
      select: selectMock.mockReturnValue({
        eq: eqMock.mockReturnValue({
          maybeSingle: maybeSingleMock,
        }),
      }),
      insert: insertMock,
      upsert: upsertMock,
    })
  })

  it('rejects invalid email address', async () => {
    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid-email' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toBe('Invalid email address.')
  })

  it('rejects missing email values', async () => {
    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toBe('Email is required.')
  })

  it('registers new subscriber and returns a new discount code', async () => {
    maybeSingleMock.mockResolvedValue({ data: null }) // no existing subscriber
    insertMock.mockResolvedValue({ error: null }) // successfully insert code
    upsertMock.mockResolvedValue({ error: null }) // successfully save subscriber

    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.code).toMatch(/^GENIE[A-Z2-9]{7}$/)
    expect(fromMock).toHaveBeenCalledWith('cakegenie_newsletter_subscribers')
    expect(fromMock).toHaveBeenCalledWith('discount_codes')
  })

  it('returns existing code for already subscribed email', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { discount_code: 'GENIEEXISTS' },
    })

    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'existing@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.code).toBe('GENIEEXISTS')
    expect(insertMock).not.toHaveBeenCalled()
  })
})
