import type {
  ChatPageAddOn,
  ChatPageContext,
  ChatPageKind,
  ChatPageSelection,
} from './types';

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]{0,119}$/i;
const SAFE_SELECTION_TEXT = /^[\p{L}\p{N}\s_"'&+.,()/-]{1,100}$/u;
const MAX_ADD_ONS = 50;
const MAX_FLAVORS = 3;

function optionalSafeText(value: unknown, maxLength = 100): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().slice(0, maxLength);
  return text && SAFE_SELECTION_TEXT.test(text) ? text : null;
}

function requiredSafeText(value: unknown, maxLength = 100): string | null {
  return optionalSafeText(value, maxLength);
}

function safePathname(value: unknown): string {
  if (typeof value !== 'string') return '/';

  try {
    const parsed = value.startsWith('/')
      ? new URL(value, 'https://genie.ph')
      : new URL(value);
    if (parsed.origin !== 'https://genie.ph') return '/';
    const pathname = parsed.pathname.replace(/\/{2,}/g, '/').slice(0, 300);
    return pathname.startsWith('/') ? pathname : '/';
  } catch {
    return '/';
  }
}

function derivePageKind(pathname: string): ChatPageKind {
  if (/^\/customizing(?:\/|$)/.test(pathname)) return 'customizer';
  if (/^\/shop\/[^/]+\/[^/]+\/?$/.test(pathname)) return 'merchant_product';
  if (/^\/designs\/[^/]+\/?$/.test(pathname)) return 'shared_design';
  if (pathname === '/price-list' || pathname === '/cake-price-calculator') return 'price_list';
  if (pathname === '/delivery-rates') return 'delivery_rates';
  if (pathname === '/contact') return 'contact';
  if (pathname === '/faq') return 'faq';
  if (pathname === '/how-to-order') return 'how_to_order';
  return 'other';
}

function getDesignSlug(pathname: string, value: unknown): string | null {
  const routeSlug = pathname.match(/^\/(?:customizing|designs)\/([^/]+)\/?$/)?.[1] ?? null;
  const candidate = routeSlug ?? (typeof value === 'string' ? value.trim() : '');
  return candidate && SAFE_SEGMENT.test(candidate) ? candidate : null;
}

function sanitizeAddOn(value: unknown): ChatPageAddOn | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!['main_topper', 'support_element', 'cake_message'].includes(String(raw.kind))) return null;

  const type = requiredSafeText(raw.type, 80);
  const description = requiredSafeText(raw.description, 160);
  if (!type || !description) return null;

  const rawQuantity = typeof raw.quantity === 'number' && Number.isFinite(raw.quantity)
    ? Math.trunc(raw.quantity)
    : null;

  return {
    kind: raw.kind as ChatPageAddOn['kind'],
    type,
    description,
    size: optionalSafeText(raw.size, 40),
    subtype: optionalSafeText(raw.subtype, 60),
    quantity: rawQuantity === null ? null : Math.min(Math.max(rawQuantity, 0), 100),
    text: optionalSafeText(raw.text, 120),
  };
}

function sanitizeSelection(value: unknown): ChatPageSelection | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const cakeType = requiredSafeText(raw.cakeType, 60);
  const cakeSize = requiredSafeText(raw.cakeSize, 60);
  const cakeThickness = requiredSafeText(raw.cakeThickness, 30);
  if (!cakeType || !cakeSize || !cakeThickness) return null;

  const icingBase = raw.icingBase === 'soft_icing' || raw.icingBase === 'fondant'
    ? raw.icingBase
    : null;
  const flavors = Array.isArray(raw.flavors)
    ? raw.flavors.flatMap((item) => {
        const flavor = optionalSafeText(item, 60);
        return flavor ? [flavor] : [];
      }).slice(0, MAX_FLAVORS)
    : [];
  const enabledAddOns = Array.isArray(raw.enabledAddOns)
    ? raw.enabledAddOns.flatMap((item) => {
        const addOn = sanitizeAddOn(item);
        return addOn ? [addOn] : [];
      }).slice(0, MAX_ADD_ONS)
    : [];
  const rawFeatures = raw.icingFeatures && typeof raw.icingFeatures === 'object'
    ? raw.icingFeatures as Record<string, unknown>
    : {};

  return {
    cakeType,
    cakeSize,
    cakeThickness,
    icingBase,
    flavors,
    icingFeatures: {
      drip: rawFeatures.drip === true,
      gumpasteBaseBoard: rawFeatures.gumpasteBaseBoard === true,
    },
    enabledAddOns,
  };
}

export function sanitizeChatPageContext(value: unknown): ChatPageContext {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const pathname = safePathname(raw.pathname ?? raw.url);
  const pageKind = derivePageKind(pathname);
  const merchantProductId = optionalSafeText(raw.merchantProductId, 100);

  return {
    pageKind,
    pathname,
    designSlug: getDesignSlug(pathname, raw.designSlug),
    merchantProductId: merchantProductId && SAFE_SEGMENT.test(merchantProductId)
      ? merchantProductId
      : null,
    selection: pageKind === 'customizer' ? sanitizeSelection(raw.selection) : null,
  };
}

type BrowserAgentModel = {
  design?: { slug?: unknown; productId?: unknown };
  selection?: {
    cakeType?: unknown;
    cakeSize?: unknown;
    cakeThickness?: unknown;
    icingBase?: unknown;
    flavors?: unknown;
  };
  configuration?: {
    mainToppers?: unknown;
    supportElements?: unknown;
    cakeMessages?: unknown;
    icingDesign?: unknown;
  };
};

function browserAddOns(model: BrowserAgentModel): ChatPageAddOn[] {
  const configuration = model.configuration ?? {};
  const result: ChatPageAddOn[] = [];

  const append = (items: unknown, kind: ChatPageAddOn['kind']) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as Record<string, unknown>;
      result.push({
        kind,
        type: String(raw.type ?? ''),
        description: String(raw.description ?? raw.text ?? ''),
        size: typeof raw.size === 'string' ? raw.size : typeof raw.coverage === 'string' ? raw.coverage : null,
        subtype: typeof raw.subtype === 'string' ? raw.subtype : null,
        quantity: typeof raw.quantity === 'number' ? raw.quantity : null,
        text: typeof raw.text === 'string' ? raw.text : null,
      });
    }
  };

  append(configuration.mainToppers, 'main_topper');
  append(configuration.supportElements, 'support_element');
  append(configuration.cakeMessages, 'cake_message');
  return result;
}

export function getBrowserChatPageContext(): ChatPageContext | null {
  if (typeof window === 'undefined') return null;

  let model: BrowserAgentModel = {};
  const modelScript = document.getElementById('customizer-agent-model');
  if (modelScript?.textContent) {
    try {
      model = JSON.parse(modelScript.textContent) as BrowserAgentModel;
    } catch {
      model = {};
    }
  }

  const selection = model.selection;
  const configuration = model.configuration;
  return sanitizeChatPageContext({
    pathname: window.location.pathname,
    designSlug: model.design?.slug,
    merchantProductId: model.design?.productId,
    selection: selection ? {
      cakeType: selection.cakeType,
      cakeSize: selection.cakeSize,
      cakeThickness: selection.cakeThickness,
      icingBase: selection.icingBase,
      flavors: selection.flavors,
      icingFeatures: configuration?.icingDesign,
      enabledAddOns: browserAddOns(model),
    } : null,
  });
}
