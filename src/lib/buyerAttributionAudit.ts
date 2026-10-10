export interface BuyerAttributionAuditTouch {
  source?: unknown;
  platform?: unknown;
  confidence?: unknown;
  landingPagePath?: unknown;
  landingPath?: unknown;
  landingUrl?: unknown;
  clickIdType?: unknown;
  category?: unknown;
  occurredAt?: unknown;
}

export interface BuyerAttributionAuditRecord {
  firstTouch?: BuyerAttributionAuditTouch | null;
  purchaseSession?: BuyerAttributionAuditTouch | null;
  ga?: {
    sessionNumber?: unknown;
  } | null;
}

export interface BuyerAttributionAuditOrder {
  order_id: string;
  order_number: string;
  user_id?: string | null;
  merchant_customer_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
  payment_status: string;
  order_status?: string | null;
  total_amount: number;
  buyer_first_touch_source?: string | null;
  buyer_first_touch_platform?: string | null;
  buyer_first_touch_confidence?: string | null;
  buyer_first_touch_landing_path?: string | null;
  buyer_purchase_session_source?: string | null;
  buyer_purchase_session_platform?: string | null;
  buyer_purchase_session_confidence?: string | null;
  buyer_attribution: BuyerAttributionAuditRecord | Record<string, unknown> | null;
  ga_purchase_mirrored_at: string | null;
  buyer?: { email: string | null } | null;
}

export interface BuyerAttributionJourneyRow extends BuyerAttributionAuditOrder {
  buyerKey: string;
  firstTouchSource: string;
  firstTouchPlatform: string;
  firstTouchConfidence: string;
  firstLandingPage: string;
  purchaseSessionSource: string;
  purchaseSessionPlatform: string;
  purchaseSessionConfidence: string;
  sessionsBeforePurchase: number | null;
  purchaseOrdinal: number;
  lifetimePurchaseCount: number;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function getTouch(record: BuyerAttributionAuditRecord | Record<string, unknown> | null, key: 'firstTouch' | 'purchaseSession'):
  BuyerAttributionAuditTouch | null {
  const rawTouch = asRecord(record)?.[key];
  return asRecord(rawTouch) as BuyerAttributionAuditTouch | null;
}

export function sanitizeLandingPagePath(value: unknown): string | null {
  const rawValue = asString(value);
  if (!rawValue) return null;

  let path = rawValue;
  try {
    if (/^https?:\/\//i.test(rawValue)) {
      path = new URL(rawValue).pathname;
    }
  } catch {
    return null;
  }

  path = path.split('?')[0].split('#')[0].trim();
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function legacyPlatform(
  touch: BuyerAttributionAuditTouch | null,
  source: string | null,
): string {
  const touchPlatform = asString(touch?.platform);
  if (touchPlatform) return touchPlatform;

  const clickIdType = asString(touch?.clickIdType);
  if (clickIdType === 'gclid' || clickIdType === 'gbraid' || clickIdType === 'wbraid') return 'google_unknown';
  if (clickIdType === 'fbclid') return 'meta_unknown';
  if (clickIdType === 'ttclid') return 'tiktok';

  const normalizedSource = source?.toLowerCase() ?? '';
  if (normalizedSource === '(direct)') return 'direct';
  if (normalizedSource === 'google' || normalizedSource.startsWith('google.')) return 'google';
  if (normalizedSource === 'facebook' || normalizedSource.endsWith('.facebook.com')) return 'facebook';
  if (normalizedSource === 'instagram' || normalizedSource.endsWith('.instagram.com')) return 'instagram';
  if (normalizedSource === 'tiktok' || normalizedSource.endsWith('.tiktok.com')) return 'tiktok';
  if (normalizedSource) return 'referral';
  return 'unknown';
}

function legacyConfidence(
  touch: BuyerAttributionAuditTouch | null,
  platform: string,
  source: string | null,
): string {
  const touchConfidence = asString(touch?.confidence);
  if (touchConfidence) return touchConfidence;
  if (asString(touch?.clickIdType)) return 'click_id';
  if (platform === 'direct' || source === '(direct)') return 'direct';
  if (platform === 'internal') return 'internal';
  if (asString(touch?.category) === 'referral') return 'referrer';
  if (source) return 'explicit_utm';
  return 'unknown';
}

function buyerKey(row: BuyerAttributionAuditOrder): string {
  if (row.user_id) return `user:${row.user_id}`;
  if (row.merchant_customer_id) return `merchant_customer:${row.merchant_customer_id}`;
  const email = row.buyer?.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  return `order:${row.order_id}`;
}

function compareOrders(left: BuyerAttributionAuditOrder, right: BuyerAttributionAuditOrder): number {
  return left.created_at.localeCompare(right.created_at) || left.order_id.localeCompare(right.order_id);
}

export function buildBuyerAttributionJourney(
  rows: BuyerAttributionAuditOrder[],
): BuyerAttributionJourneyRow[] {
  const sortedRows = [...rows].sort(compareOrders);
  const rowsByBuyer = new Map<string, BuyerAttributionAuditOrder[]>();

  for (const row of sortedRows) {
    const key = buyerKey(row);
    const buyerRows = rowsByBuyer.get(key) ?? [];
    buyerRows.push(row);
    rowsByBuyer.set(key, buyerRows);
  }

  return sortedRows.map((row) => {
    const key = buyerKey(row);
    const buyerRows = rowsByBuyer.get(key) ?? [row];
    const ordinal = buyerRows.findIndex((candidate) => candidate.order_id === row.order_id) + 1;
    const record = row.buyer_attribution;
    const firstTouch = getTouch(record, 'firstTouch');
    const purchaseSession = getTouch(record, 'purchaseSession');
    const firstTouchSource = row.buyer_first_touch_source ?? asString(firstTouch?.source);
    const purchaseSessionSource = row.buyer_purchase_session_source ?? asString(purchaseSession?.source);
    const firstTouchPlatform = row.buyer_first_touch_platform
      ?? legacyPlatform(firstTouch, firstTouchSource);
    const purchaseSessionPlatform = row.buyer_purchase_session_platform
      ?? legacyPlatform(purchaseSession, purchaseSessionSource);
    const ga = asRecord(record)?.ga as { sessionNumber?: unknown } | null | undefined;
    const sessionNumber = typeof ga?.sessionNumber === 'number' && Number.isFinite(ga.sessionNumber)
      ? ga.sessionNumber
      : null;

    return {
      ...row,
      buyerKey: key,
      firstTouchSource: firstTouchSource ?? '(missing)',
      firstTouchPlatform: firstTouchPlatform || 'unknown',
      firstTouchConfidence: row.buyer_first_touch_confidence
        ?? legacyConfidence(firstTouch, firstTouchPlatform || 'unknown', firstTouchSource),
      firstLandingPage: sanitizeLandingPagePath(
        row.buyer_first_touch_landing_path
          ?? firstTouch?.landingPagePath
          ?? firstTouch?.landingPath
          ?? firstTouch?.landingUrl,
      ) ?? '(missing)',
      purchaseSessionSource: purchaseSessionSource ?? '(missing)',
      purchaseSessionPlatform: purchaseSessionPlatform || 'unknown',
      purchaseSessionConfidence: row.buyer_purchase_session_confidence
        ?? legacyConfidence(purchaseSession, purchaseSessionPlatform || 'unknown', purchaseSessionSource),
      sessionsBeforePurchase: sessionNumber === null ? null : Math.max(0, sessionNumber - 1),
      purchaseOrdinal: ordinal,
      lifetimePurchaseCount: buyerRows.length,
    };
  });
}

export function isWithinAuditDateRange(
  createdAt: string,
  from: string | null,
  to: string | null,
): boolean {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return false;

  if (from) {
    const fromTimestamp = Date.parse(`${from}T00:00:00Z`);
    if (Number.isFinite(fromTimestamp) && timestamp < fromTimestamp) return false;
  }

  if (to) {
    const toTimestamp = Date.parse(`${to}T23:59:59.999Z`);
    if (Number.isFinite(toTimestamp) && timestamp > toTimestamp) return false;
  }

  return true;
}
