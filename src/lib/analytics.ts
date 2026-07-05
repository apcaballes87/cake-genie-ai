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
    case 'customizer_add_to_cart_clicked':
      return 'API Customizer Add to Cart Clicked'
    case 'customizer_add_to_cart_blocked':
      return 'API Customizer Add to Cart Blocked'
    case 'customizer_cart_redirect_started':
      return 'API Customizer Cart Redirect Started'
    case 'cart_requirement_missing':
      return 'API Cart Requirement Missing'
    case 'checkout_place_order_clicked':
      return 'API Checkout Place Order Clicked'
    case 'checkout_create_order_failed':
      return 'API Checkout Create Order Failed'
    case 'checkout_payment_handoff_failed':
      return 'API Checkout Payment Handoff Failed'
    case 'checkout_redirect_started':
      return 'API Checkout Redirect Started'
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

type CustomizerSourceSurface = 'merchant_product' | 'analysis_cache' | 'uploaded_image' | 'unknown'

interface CustomizerFunnelBase {
  sourceSurface: CustomizerSourceSurface
  designSlug?: string | null
  hasPendingDesignChanges?: boolean
}

export function trackCustomizerAddToCartClicked(params: CustomizerFunnelBase & {
  priceBucket: string
}): void {
  trackEvent('customizer_add_to_cart_clicked', {
    event_category: 'ecommerce_funnel',
    source_surface: params.sourceSurface,
    design_slug: params.designSlug || undefined,
    price_bucket: params.priceBucket,
    has_pending_design_changes: Boolean(params.hasPendingDesignChanges),
  })
}

export function trackCustomizerAddToCartBlocked(params: CustomizerFunnelBase & {
  reason: string
}): void {
  trackEvent('customizer_add_to_cart_blocked', {
    event_category: 'ecommerce_funnel',
    source_surface: params.sourceSurface,
    design_slug: params.designSlug || undefined,
    blocked_reason: params.reason,
    has_pending_design_changes: Boolean(params.hasPendingDesignChanges),
  })
}

export function trackCustomizerCartRedirectStarted(params: CustomizerFunnelBase & {
  priceBucket: string
  clickToRedirectMs?: number
}): void {
  trackEvent('customizer_cart_redirect_started', {
    event_category: 'ecommerce_funnel',
    source_surface: params.sourceSurface,
    design_slug: params.designSlug || undefined,
    price_bucket: params.priceBucket,
    has_pending_design_changes: Boolean(params.hasPendingDesignChanges),
    click_to_redirect_ms: params.clickToRedirectMs,
  })
}

type CheckoutFlowType = 'full_payment' | 'downpayment_50' | 'split_with_friends'
type CheckoutFulfillmentType = 'delivery' | 'pickup'

interface CheckoutFunnelBase {
  flowType: CheckoutFlowType
  fulfillmentType: CheckoutFulfillmentType
  itemCount: number
  valueBucket: string
  isGuest: boolean
}

export function getAnalyticsValueBucket(value: number | null | undefined): string {
  if (!value || value <= 0) return 'unknown'
  if (value < 1000) return 'under_1000'
  if (value < 2000) return '1000_1999'
  if (value < 3000) return '2000_2999'
  if (value < 5000) return '3000_4999'
  return '5000_plus'
}

export function trackCartRequirementMissing(params: CheckoutFunnelBase & {
  missingLabels: string[]
}): void {
  trackEvent('cart_requirement_missing', {
    event_category: 'ecommerce_funnel',
    flow_type: params.flowType,
    fulfillment_type: params.fulfillmentType,
    items_count: params.itemCount,
    value_bucket: params.valueBucket,
    is_guest: params.isGuest,
    missing_requirements: params.missingLabels,
  })
}

export function trackCheckoutPlaceOrderClicked(params: CheckoutFunnelBase): void {
  trackEvent('checkout_place_order_clicked', {
    event_category: 'ecommerce_funnel',
    flow_type: params.flowType,
    fulfillment_type: params.fulfillmentType,
    items_count: params.itemCount,
    value_bucket: params.valueBucket,
    is_guest: params.isGuest,
  })
}

export function trackCheckoutCreateOrderFailed(params: CheckoutFunnelBase): void {
  trackEvent('checkout_create_order_failed', {
    event_category: 'ecommerce_funnel',
    flow_type: params.flowType,
    fulfillment_type: params.fulfillmentType,
    items_count: params.itemCount,
    value_bucket: params.valueBucket,
    is_guest: params.isGuest,
  })
}

export function trackCheckoutPaymentHandoffFailed(params: CheckoutFunnelBase): void {
  trackEvent('checkout_payment_handoff_failed', {
    event_category: 'ecommerce_funnel',
    flow_type: params.flowType,
    fulfillment_type: params.fulfillmentType,
    items_count: params.itemCount,
    value_bucket: params.valueBucket,
    is_guest: params.isGuest,
  })
}

export function trackCheckoutRedirectStarted(params: CheckoutFunnelBase): void {
  trackEvent('checkout_redirect_started', {
    event_category: 'ecommerce_funnel',
    flow_type: params.flowType,
    fulfillment_type: params.fulfillmentType,
    items_count: params.itemCount,
    value_bucket: params.valueBucket,
    is_guest: params.isGuest,
  })
}
