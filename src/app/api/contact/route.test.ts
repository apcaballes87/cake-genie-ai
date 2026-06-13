import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const insertMock = vi.fn()
const fromMock = vi.fn(() => ({
  insert: insertMock,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: fromMock,
  })),
}))

describe('POST /api/contact', () => {
  beforeEach(() => {
    insertMock.mockReset()
    fromMock.mockClear()
  })

  it('rejects incomplete payloads', async () => {
    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', email: '', phone: '', message: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('stores valid contact messages', async () => {
    insertMock.mockResolvedValue({ error: null })

    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Alan',
        phone: '+63 908 940 8747',
        email: 'hello@example.com',
        message: 'I need help ordering a rush birthday cake for Cebu City delivery.',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('cakegenie_contact_messages')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alan',
        phone: '+63 908 940 8747',
        email: 'hello@example.com',
        source: 'contact-page',
      }),
    )
  })

  it('rejects invalid phone numbers before writing to the database', async () => {
    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Alan',
        phone: 'abc',
        email: 'hello@example.com',
        message: 'I need help ordering a rush birthday cake.',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toBe('Please enter a valid contact number.')
    expect(insertMock).not.toHaveBeenCalled()
  })
})
