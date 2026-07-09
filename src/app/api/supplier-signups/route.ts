import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPPLIER_TYPES = new Set([
  'cakes',
  'photo_video',
  'catering',
  'hosting',
  'band_music',
  'coordinator',
  'styling_decor',
  'flowers',
  'lights_sounds',
  'venue',
  'rentals',
  'mobile_bar',
  'entertainment',
  'hair_makeup',
  'invites_souvenirs',
  'transportation',
  'other',
])

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function normalizeFormString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeOptionalUrl(value: string): string | null {
  if (!value) return null
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
    const url = new URL(withProtocol)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

function isValidPhone(phone: string): boolean {
  return /^[+\d\s()-]{7,25}$/.test(phone)
}

function extensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'jpg'
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === 'object'
    && value !== null
    && 'arrayBuffer' in value
    && typeof value.arrayBuffer === 'function'
    && 'type' in value
    && typeof value.type === 'string'
    && 'size' in value
    && typeof value.size === 'number'
    && value.size > 0
  )
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const name = normalizeFormString(formData.get('name'))
    const contactNumber = normalizeFormString(formData.get('contactNumber'))
    const businessName = normalizeFormString(formData.get('businessName'))
    const description = normalizeFormString(formData.get('description'))
    const businessType = normalizeFormString(formData.get('businessType'))
    const facebookPage = normalizeOptionalUrl(normalizeFormString(formData.get('facebookPage')))
    const website = normalizeOptionalUrl(normalizeFormString(formData.get('website')))
    const extraLink = normalizeOptionalUrl(normalizeFormString(formData.get('extraLink')))
    const image = formData.get('image')

    if (!name || !contactNumber || !businessName || !description || !businessType) {
      return NextResponse.json(
        { success: false, error: 'Please fill in all required fields.' },
        { status: 400 },
      )
    }

    if (!isValidPhone(contactNumber)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid contact number.' },
        { status: 400 },
      )
    }

    if (!SUPPLIER_TYPES.has(businessType)) {
      return NextResponse.json(
        { success: false, error: 'Please choose a valid business type.' },
        { status: 400 },
      )
    }

    if (description.length < 20) {
      return NextResponse.json(
        { success: false, error: 'Please add a short description of your business.' },
        { status: 400 },
      )
    }

    let imageBucket: string | null = null
    let imagePath: string | null = null
    let imageUrl: string | null = null

    if (isUploadedFile(image)) {
      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        return NextResponse.json(
          { success: false, error: 'Please upload a JPG, PNG, WebP, or GIF image.' },
          { status: 400 },
        )
      }

      if (image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Please upload an image below 8 MB.' },
          { status: 400 },
        )
      }

      imageBucket = 'supplier-signup-images'
      imagePath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extensionFromMimeType(image.type)}`
      const { error: uploadError } = await supabase.storage
        .from(imageBucket)
        .upload(imagePath, image, {
          contentType: image.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('[supplier-signups] Failed to upload image:', uploadError)
        return NextResponse.json(
          { success: false, error: 'Unable to upload your image right now. Please try again later.' },
          { status: 500 },
        )
      }

      const { data } = supabase.storage.from(imageBucket).getPublicUrl(imagePath)
      imageUrl = data.publicUrl
    }

    const { error: insertError } = await supabase.from('cakegenie_supplier_signups').insert({
      name,
      contact_number: contactNumber,
      business_name: businessName,
      description,
      business_type: businessType,
      facebook_page_url: facebookPage,
      website_url: website,
      extra_link_url: extraLink,
      image_bucket: imageBucket,
      image_path: imagePath,
      image_url: imageUrl,
      source: 'supplier-signup-page',
    })

    if (insertError) {
      console.error('[supplier-signups] Failed to save signup:', insertError)
      return NextResponse.json(
        { success: false, error: 'Unable to send your signup right now. Please try again later.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[supplier-signups] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to send your signup right now. Please try again later.' },
      { status: 500 },
    )
  }
}
