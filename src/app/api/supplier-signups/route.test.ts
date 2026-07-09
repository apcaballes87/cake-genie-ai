import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const insertMock = vi.fn()
const uploadMock = vi.fn()
const getPublicUrlMock = vi.fn(() => ({
  data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/supplier-signup-images/test.jpg' },
}))
const fromTableMock = vi.fn(() => ({
  insert: insertMock,
}))
const fromStorageMock = vi.fn(() => ({
  upload: uploadMock,
  getPublicUrl: getPublicUrlMock,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: fromTableMock,
    storage: {
      from: fromStorageMock,
    },
  })),
}))

describe('POST /api/supplier-signups', () => {
  beforeEach(() => {
    vi.resetModules()
    insertMock.mockReset()
    uploadMock.mockReset()
    getPublicUrlMock.mockClear()
    fromTableMock.mockClear()
    fromStorageMock.mockClear()
    uploadMock.mockResolvedValue({ error: null })
    insertMock.mockResolvedValue({ error: null })
  })

  it('rejects incomplete submissions', async () => {
    const { POST } = await import('./route')
    const formData = new FormData()
    formData.append('name', 'Alex')

    const response = await POST(new NextRequest('http://localhost/api/supplier-signups', {
      method: 'POST',
      body: formData,
    }))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('stores valid supplier submissions without an image', async () => {
    const { POST } = await import('./route')
    const formData = new FormData()
    formData.append('name', 'Alex Santos')
    formData.append('contactNumber', '+63 917 123 4567')
    formData.append('businessName', 'Cebu Party Works')
    formData.append('description', 'We provide event coordination and styling for birthdays and weddings.')
    formData.append('businessType', 'coordinator')
    formData.append('facebookPage', 'facebook.com/cebupartyworks')

    const response = await POST(new NextRequest('http://localhost/api/supplier-signups', {
      method: 'POST',
      body: formData,
    }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(fromTableMock).toHaveBeenCalledWith('cakegenie_supplier_signups')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Alex Santos',
      contact_number: '+63 917 123 4567',
      business_name: 'Cebu Party Works',
      business_type: 'coordinator',
      facebook_page_url: 'https://facebook.com/cebupartyworks',
      image_url: null,
      source: 'supplier-signup-page',
    }))
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('uploads a valid image and stores its public URL', async () => {
    const { POST } = await import('./route')
    const formData = new FormData()
    formData.append('name', 'Mia Reyes')
    formData.append('contactNumber', '+63 917 987 6543')
    formData.append('businessName', 'Mia Bakes')
    formData.append('description', 'Custom cakes and dessert tables for birthdays, weddings, and corporate events.')
    formData.append('businessType', 'cakes')
    formData.append('image', new File(['fake-image'], 'cake.jpg', { type: 'image/jpeg' }))

    const response = await POST(new NextRequest('http://localhost/api/supplier-signups', {
      method: 'POST',
      body: formData,
    }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(fromStorageMock).toHaveBeenCalledWith('supplier-signup-images')
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}\/.+\.jpg$/),
      expect.objectContaining({ type: 'image/jpeg' }),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    )
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      image_bucket: 'supplier-signup-images',
      image_url: 'https://example.supabase.co/storage/v1/object/public/supplier-signup-images/test.jpg',
    }))
  })
})
