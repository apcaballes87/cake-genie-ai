'use client'

import type { OpenAIAdsProductContent } from '@/lib/openaiAds/contents'

type OpenAIAdsEventData = Record<string, unknown>
type OpenAIAdsEventName = 'page_viewed' | 'contents_viewed' | 'items_added' | 'checkout_started' | 'order_created' | 'lead_created'
type OpenAIAdsPixelQueue = ((...args: unknown[]) => void) & { q?: unknown[][] }

declare global {
  interface Window {
    oaiq?: OpenAIAdsPixelQueue
    __genieOpenAIAdsPixelInitialized?: boolean
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID?.trim()
const PIXEL_SCRIPT_URL = 'https://bzrcdn.openai.com/sdk/oaiq.min.js'

function initializePixel(): OpenAIAdsPixelQueue | null {
  if (typeof window === 'undefined' || !PIXEL_ID) return null

  if (!window.oaiq) {
    const queue = ((...args: unknown[]) => {
      queue.q?.push(args)
    }) as OpenAIAdsPixelQueue
    queue.q = []
    window.oaiq = queue

    const script = document.createElement('script')
    script.async = true
    script.src = PIXEL_SCRIPT_URL
    document.head.appendChild(script)
  }

  if (!window.__genieOpenAIAdsPixelInitialized) {
    window.__genieOpenAIAdsPixelInitialized = true
    window.oaiq('init', { pixelId: PIXEL_ID })
  }

  return window.oaiq
}

/** Send an OpenAI Ads Pixel event without affecting the customer flow. */
export function trackOpenAIAdsEvent(
  eventName: OpenAIAdsEventName,
  data: OpenAIAdsEventData,
  eventId?: string,
): void {
  try {
    const options = eventId ? { event_id: eventId } : undefined
    initializePixel()?.('measure', eventName, data, options)
  } catch {
    // Ads measurement must never interrupt shopping or checkout.
  }
}

export function trackOpenAIAdsPageView(pathname: string): void {
  trackOpenAIAdsEvent('page_viewed', {
    type: 'contents',
    contents: [{ id: pathname, name: pathname, content_type: 'page' }],
  })
}

export function trackOpenAIAdsContentsViewed(input: {
  id: string
  name: string
}): void {
  trackOpenAIAdsEvent('contents_viewed', {
    type: 'contents',
    contents: [{ id: input.id, name: input.name, content_type: 'product' }],
  })
}

export function trackOpenAIAdsCartEvent(
  eventName: 'items_added' | 'checkout_started',
  contents: OpenAIAdsProductContent[],
): void {
  trackOpenAIAdsEvent(eventName, { type: 'contents', contents })
}

export function trackOpenAIAdsOrderCreated(input: {
  orderId: string
  amountPesos: number
  items: OpenAIAdsProductContent[]
}): void {
  const amountMinorUnits = Math.round(input.amountPesos * 100)
  if (!input.orderId || !Number.isFinite(amountMinorUnits) || amountMinorUnits < 0) return

  trackOpenAIAdsEvent('order_created', {
    type: 'contents',
    amount: amountMinorUnits,
    currency: 'PHP',
    contents: input.items,
  }, input.orderId)
}
