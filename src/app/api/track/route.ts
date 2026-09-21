import { NextRequest, NextResponse } from 'next/server'
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EVENT_TYPES = new Set([
  'visit_start',
  'page_view',
  'add_to_cart',
  'checkout_start',
  'purchase',
  'email_captured',
])

const ALLOWED_DEVICE_TYPES = new Set(['mobile', 'desktop', 'tablet'])
const UTM_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const

function readString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

function readCountry(request: NextRequest): string | null {
  const candidate = [
    request.headers.get('x-vercel-ip-country'),
    request.headers.get('x-country'),
    request.headers.get('cf-ipcountry'),
  ]
    .map((value) => value?.trim().toUpperCase() || '')
    .find((value) => /^[A-Z]{2}$/.test(value))

  return candidate || null
}

function invalid(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>

  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return invalid('Invalid beacon payload.')
    }
    body = parsed as Record<string, unknown>
  } catch {
    return invalid('Invalid beacon payload.')
  }

  const eventType = readString(body.event_type, 50)
  if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
    return invalid('Unsupported event type.')
  }

  const anonymousUserId = readString(body.anonymous_user_id, 200)
  const sessionId = readString(body.session_id, 200)
  if (!anonymousUserId && !sessionId) {
    return invalid('A visitor or session identifier is required.')
  }

  const path = readString(body.path, 500)
  if (path && !path.startsWith('/')) {
    return invalid('Path must be a site-relative path.')
  }

  const deviceType = readString(body.device_type, 20)
  if (deviceType && !ALLOWED_DEVICE_TYPES.has(deviceType)) {
    return invalid('Unsupported device type.')
  }

  let authenticatedUserId: string | null = null
  try {
    // This is deliberately a separate cookie-backed client. Never use the
    // service-role client to inspect the caller's session.
    const userClient = await createServerSupabaseClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (user && !user.is_anonymous) {
      authenticatedUserId = user.id
    }
  } catch {
    // A beacon must remain useful for anonymous visitors if auth is unavailable.
  }

  const insertPayload: Record<string, string | null> = {
    user_id: authenticatedUserId,
    anonymous_user_id: anonymousUserId,
    session_id: sessionId,
    event_type: eventType,
    path,
    referrer: readString(body.referrer, 500),
    device_type: deviceType,
    country: readCountry(request),
  }

  for (const field of UTM_FIELDS) {
    insertPayload[field] = readString(body[field], 500)
  }

  try {
    const supabase = createAdminServerSupabaseClient()
    const { error } = await supabase
      .from('genie_visit_events')
      .insert(insertPayload)

    if (error) {
      console.error('[analytics] failed to insert visit event:', error.message)
      return NextResponse.json({ error: 'Could not record event.' }, { status: 500 })
    }
  } catch (error) {
    console.error('[analytics] unexpected beacon error:', error)
    return NextResponse.json({ error: 'Could not record event.' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
