// SSR-safe analytics queue. Events stay local until the analytics boundary
// marks the current route as trackable and the client analytics tags are ready.

export type GA4EventParams = Record<string, unknown>

export interface GA4Item {
  item_id: string
  item_name: string
  price?: number
  quantity?: number
  item_category?: string
}

type TrackableRouteState = 'unknown' | 'trackable' | 'excluded'

interface PendingAnalyticsEvent {
  name: string
  params: GA4EventParams
}

type GoogleTag = (...args: unknown[]) => void
type ClarityTagValue = string | string[]
type ClarityCommand = (...args: unknown[]) => void

let analyticsReady = false
let routeState: TrackableRouteState = 'unknown'
let pendingEvents: PendingAnalyticsEvent[] = []

function getGoogleTag(): GoogleTag | null {
  if (typeof window === 'undefined') return null

  const gtag = (window as typeof window & { gtag?: GoogleTag }).gtag
  return typeof gtag === 'function' ? gtag : null
}

function getClarity(): ClarityCommand | null {
  if (typeof window === 'undefined') return null

  const clarity = (window as typeof window & { clarity?: ClarityCommand }).clarity
  return typeof clarity === 'function' ? clarity : null
}

function toClarityEventName(name: string): string | null {
  switch (name) {
    case 'search':
      return 'API Search'
    case 'image_upload':
      return 'API Image Upload'
    case 'sign_up':
      return 'API Sign Up'
    case 'start_design':
      return 'API Start Design'
    case 'update_design':
      return 'API Update Design'
    case 'add_to_cart':
      return 'API Add to Cart'
    case 'begin_checkout':
      return 'API Begin Checkout'
    case 'add_payment_info':
      return 'API Add Payment Info'
    case 'purchase':
      return 'API Purchase'
    default:
      return null
  }
}

function sendClarityEvent(name: string): void {
  const clarityEventName = toClarityEventName(name)
  if (!clarityEventName) return

  const clarity = getClarity()
  if (!clarity) return

  clarity('event', clarityEventName)
}

function flushPendingEvents(): void {
  if (!analyticsReady || routeState !== 'trackable') return

  const gtag = getGoogleTag()
  if (!gtag) return

  const eventsToFlush = pendingEvents
  pendingEvents = []

  for (const event of eventsToFlush) {
    gtag('event', event.name, event.params)
    sendClarityEvent(event.name)
  }
}

export function setAnalyticsRouteTracking(trackable: boolean): void {
  routeState = trackable ? 'trackable' : 'excluded'

  if (!trackable) {
    pendingEvents = []
    return
  }

  flushPendingEvents()
}

export function markAnalyticsReady(): void {
  analyticsReady = true
  flushPendingEvents()
}

export function markAnalyticsNotReady(): void {
  analyticsReady = false
}

export function resetAnalyticsStateForTests(): void {
  analyticsReady = false
  routeState = 'unknown'
  pendingEvents = []
}

export function setClarityTag(key: string, value: ClarityTagValue): void {
  const clarity = getClarity()
  if (!clarity) return

  clarity('set', key, value)
}

export function trackEvent(name: string, params: GA4EventParams = {}): void {
  if (typeof window === 'undefined') return
  if (routeState === 'excluded') return

  if (!analyticsReady || routeState !== 'trackable') {
    pendingEvents.push({ name, params })
    return
  }

  const gtag = getGoogleTag()
  if (!gtag) {
    pendingEvents.push({ name, params })
    return
  }

  gtag('event', name, params)
  sendClarityEvent(name)
}

export function sendPageView(params: {
  page_location: string
  page_path: string
  page_title?: string
}): void {
  trackEvent('page_view', params)
}

// ---------- GA4 Ecommerce wrappers (PHP by default) ----------

export const trackViewItem = (item: GA4Item): void =>
  trackEvent('view_item', {
    currency: 'PHP',
    value: item.price ?? 0,
    items: [item],
  })

export const trackViewItemList = (itemListName: string, items: GA4Item[]): void =>
  trackEvent('view_item_list', {
    item_list_name: itemListName,
    items,
  })

export const trackSelectItem = (item: {
  item_list_name: string
  item_id: string
  item_name: string
}): void =>
  trackEvent('select_item', {
    item_list_name: item.item_list_name,
    items: [{ item_id: item.item_id, item_name: item.item_name }],
  })

export const trackAddToCart = (item: Required<Pick<GA4Item, 'item_id' | 'item_name' | 'price' | 'quantity'>>): void =>
  trackEvent('add_to_cart', {
    currency: 'PHP',
    value: item.price * item.quantity,
    items: [item],
  })

export const trackBeginCheckout = (value: number, itemCount: number): void =>
  trackEvent('begin_checkout', {
    currency: 'PHP',
    value,
    items_count: itemCount,
  })

export const trackAddPaymentInfo = (value: number, paymentType: string): void =>
  trackEvent('add_payment_info', {
    currency: 'PHP',
    value,
    payment_type: paymentType,
  })

export const trackPurchase = (args: {
  transactionId: string
  value: number
  items: GA4Item[]
  coupon?: string
}): void =>
  trackEvent('purchase', {
    transaction_id: args.transactionId,
    value: args.value,
    currency: 'PHP',
    coupon: args.coupon,
    items: args.items,
  })

// ---------- Custom engagement events ----------

export const trackSearch = (query: string, uiSource: string): void =>
  trackEvent('search', { search_term: query, ui_source: uiSource })

export const trackImageUpload = (uiSource: 'landing' | 'customizing' | 'header'): void =>
  trackEvent('image_upload', { ui_source: uiSource })

export const trackSignUp = (method: string, uiSource: string): void =>
  trackEvent('sign_up', { method, ui_source: uiSource })

export const trackStartDesign = (uiSource: string): void =>
  trackEvent('start_design', {
    event_category: 'ecommerce_funnel',
    event_label: uiSource,
    ui_source: uiSource,
  })

export const trackUpdateDesign = (): void =>
  trackEvent('update_design', {
    event_category: 'ecommerce_funnel',
  })
