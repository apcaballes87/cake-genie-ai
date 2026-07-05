import type {
  BuyerAttributionGaSnapshot,
  BuyerAttributionRecord,
  BuyerAttributionTouch,
} from '@/types';

export const BUYER_ATTRIBUTION_STORAGE_KEY = 'buyer_attribution_v1';

type GoogleTag = (...args: unknown[]) => void;

const GTAG_GET_TIMEOUT_MS = 400;

function createEmptyRecord(): BuyerAttributionRecord {
  return {
    version: 1,
    firstTouch: null,
    firstNonDirectTouch: null,
    latestTouch: null,
    latestNonDirectTouch: null,
    purchaseSession: null,
    ga: {
      clientId: null,
      sessionId: null,
      sessionNumber: null,
      lastResolvedAt: null,
    },
    latestTouchSessionId: null,
    latestNonDirectTouchSessionId: null,
  };
}

function getGoogleTag(): GoogleTag | null {
  if (typeof window === 'undefined') return null;
  const gtag = (window as typeof window & { gtag?: GoogleTag }).gtag;
  return typeof gtag === 'function' ? gtag : null;
}

function normalizeHost(host: string | null): string | null {
  if (!host) return null;
  return host.replace(/^www\./i, '').toLowerCase();
}

function safeParseUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function classifyBuyerAttributionTouch(params: {
  locationHref: string;
  referrer: string;
  origin?: string;
  now?: string;
}): BuyerAttributionTouch {
  const now = params.now ?? new Date().toISOString();
  const currentUrl = new URL(params.locationHref);
  const referrerUrl = safeParseUrl(params.referrer);
  const origin = params.origin ?? currentUrl.origin;

  const utmSource = currentUrl.searchParams.get('utm_source')?.trim() || null;
  const utmMedium = currentUrl.searchParams.get('utm_medium')?.trim() || null;
  const utmCampaign = currentUrl.searchParams.get('utm_campaign')?.trim() || null;
  const entrySource =
    currentUrl.searchParams.get('entry_source')?.trim() ||
    currentUrl.searchParams.get('source')?.trim() ||
    null;
  const hasGclid = currentUrl.searchParams.has('gclid');
  const hasFbclid = currentUrl.searchParams.has('fbclid');
  const hasTtclid = currentUrl.searchParams.has('ttclid');

  const referrerHost = normalizeHost(referrerUrl?.host ?? null);
  const isExternalReferrer = Boolean(
    referrerUrl &&
      referrerUrl.origin !== origin,
  );

  let source = '(direct)';
  let medium = '(none)';
  let campaign = utmCampaign;
  let clickIdType: BuyerAttributionTouch['clickIdType'] = null;
  let category: BuyerAttributionTouch['category'] = 'direct';

  if (utmSource || utmMedium || utmCampaign || hasGclid || hasFbclid || hasTtclid || entrySource) {
    category = 'campaign';

    if (hasGclid) {
      source = utmSource || 'google';
      medium = utmMedium || 'cpc';
      clickIdType = 'gclid';
    } else if (hasFbclid) {
      source = utmSource || 'facebook';
      medium = utmMedium || 'paid_social';
      clickIdType = 'fbclid';
    } else if (hasTtclid) {
      source = utmSource || 'tiktok';
      medium = utmMedium || 'paid_social';
      clickIdType = 'ttclid';
    } else if (entrySource) {
      source = utmSource || entrySource;
      medium = utmMedium || 'internal_handoff';
    } else {
      source = utmSource || '(direct)';
      medium = utmMedium || '(none)';
    }
  } else if (isExternalReferrer && referrerHost) {
    category = 'referral';
    source = referrerHost;
    medium = 'referral';
  }

  return {
    source,
    medium,
    campaign,
    entrySource,
    referrerHost,
    clickIdType,
    category,
    landingPath: `${currentUrl.pathname}${currentUrl.search}`,
    landingUrl: currentUrl.toString(),
    occurredAt: now,
  };
}

function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function writeStoredValue(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

export function readBuyerAttribution(): BuyerAttributionRecord {
  const raw = readStoredValue(BUYER_ATTRIBUTION_STORAGE_KEY);
  if (!raw) return createEmptyRecord();

  try {
    const parsed = JSON.parse(raw) as Partial<BuyerAttributionRecord>;
    const empty = createEmptyRecord();
    return {
      ...empty,
      ...parsed,
      ga: {
        ...empty.ga,
        ...(parsed.ga ?? {}),
      },
    };
  } catch {
    return createEmptyRecord();
  }
}

export function saveBuyerAttribution(record: BuyerAttributionRecord): void {
  writeStoredValue(BUYER_ATTRIBUTION_STORAGE_KEY, JSON.stringify(record));
}

function gtagGetValue(
  measurementId: string,
  fieldName: string,
): Promise<unknown> {
  const gtag = getGoogleTag();
  if (!gtag) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      resolve(value ?? null);
    };

    const timeoutId = window.setTimeout(() => finish(null), GTAG_GET_TIMEOUT_MS);

    try {
      gtag('get', measurementId, fieldName, (value: unknown) => {
        window.clearTimeout(timeoutId);
        finish(value);
      });
    } catch {
      window.clearTimeout(timeoutId);
      finish(null);
    }
  });
}

export async function resolveGaAttributionSnapshot(
  measurementId: string,
): Promise<BuyerAttributionGaSnapshot> {
  const [clientIdValue, sessionIdValue, sessionNumberValue] = await Promise.all([
    gtagGetValue(measurementId, 'client_id'),
    gtagGetValue(measurementId, 'session_id'),
    gtagGetValue(measurementId, 'session_number'),
  ]);

  const sessionId =
    sessionIdValue == null || sessionIdValue === ''
      ? null
      : String(sessionIdValue);
  const sessionNumber =
    sessionNumberValue == null || sessionNumberValue === ''
      ? null
      : Number(sessionNumberValue);

  return {
    clientId:
      clientIdValue == null || clientIdValue === ''
        ? null
        : String(clientIdValue),
    sessionId,
    sessionNumber: Number.isFinite(sessionNumber) ? sessionNumber : null,
    lastResolvedAt: new Date().toISOString(),
  };
}

export function updateBuyerAttributionRecord(params: {
  current: BuyerAttributionRecord;
  touch: BuyerAttributionTouch;
  ga: BuyerAttributionGaSnapshot;
}): BuyerAttributionRecord {
  const { current, touch, ga } = params;
  const next: BuyerAttributionRecord = {
    ...current,
    ga,
  };
  const sessionId = ga.sessionId;
  const isDirect = touch.category === 'direct';

  if (!next.firstTouch) {
    next.firstTouch = touch;
  }

  if (!isDirect && !next.firstNonDirectTouch) {
    next.firstNonDirectTouch = touch;
  }

  if (!next.latestTouch || (sessionId && next.latestTouchSessionId !== sessionId)) {
    next.latestTouch = touch;
    next.latestTouchSessionId = sessionId;
  }

  if (
    !isDirect &&
    (
      !next.latestNonDirectTouch ||
      (sessionId && next.latestNonDirectTouchSessionId !== sessionId)
    )
  ) {
    next.latestNonDirectTouch = touch;
    next.latestNonDirectTouchSessionId = sessionId;
  }

  return next;
}

export async function syncBuyerAttributionForCurrentPage(
  measurementId: string,
): Promise<BuyerAttributionRecord> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return createEmptyRecord();
  }

  const current = readBuyerAttribution();
  const touch = classifyBuyerAttributionTouch({
    locationHref: window.location.href,
    referrer: document.referrer || '',
    origin: window.location.origin,
  });
  const ga = await resolveGaAttributionSnapshot(measurementId);
  const next = updateBuyerAttributionRecord({ current, touch, ga });
  saveBuyerAttribution(next);
  return next;
}

export async function prepareBuyerAttributionForCheckout(
  measurementId: string,
): Promise<BuyerAttributionRecord> {
  const synced = await syncBuyerAttributionForCurrentPage(measurementId);
  const next: BuyerAttributionRecord = {
    ...synced,
    purchaseSession: synced.latestTouch,
  };
  saveBuyerAttribution(next);
  return next;
}
