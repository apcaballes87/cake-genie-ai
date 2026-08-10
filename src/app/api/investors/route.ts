import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const normalizedEmail = normalizeEmail(email)

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from('investor_subscribers')
      .upsert(
        {
          email: normalizedEmail,
          is_active: true,
          source: 'investors-page',
          consented_at: new Date().toISOString(),
          unsubscribed_at: null,
        },
        { onConflict: 'email' },
      )

    if (error) {
      console.error('[investors] Failed to save subscriber:', error)
      return NextResponse.json(
        { success: false, error: 'Unable to save your email right now. Please try again later.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[investors] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to save your email right now. Please try again later.' },
      { status: 500 },
    )
  }
}
