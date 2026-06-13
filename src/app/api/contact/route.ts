import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPhone(phone: string): boolean {
  return /^[+\d\s()-]{7,25}$/.test(phone)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = normalizeString(body.name)
    const phone = normalizeString(body.phone)
    const email = normalizeString(body.email).toLowerCase()
    const message = normalizeString(body.message)

    if (!name || !phone || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Please fill in all required fields.' },
        { status: 400 },
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 },
      )
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid contact number.' },
        { status: 400 },
      )
    }

    if (message.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please tell us a bit more so we can help.' },
        { status: 400 },
      )
    }

    const { error } = await supabase.from('cakegenie_contact_messages').insert({
      name,
      phone,
      email,
      message,
      source: 'contact-page',
    })

    if (error) {
      console.error('[contact] Failed to save contact message:', error)
      return NextResponse.json(
        { success: false, error: 'Unable to send your message right now. Please try again later.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contact] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to send your message right now. Please try again later.' },
      { status: 500 },
    )
  }
}
