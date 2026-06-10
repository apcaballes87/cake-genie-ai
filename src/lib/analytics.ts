// SSR-safe GA4 event push. Prefer the real gtag helper when available and
// otherwise queue the event command until gtag.js hydrates.
// GA4 measurement ID G-C28QNPRWFK is loaded in src/app/layout.tsx.

export type GA4EventParams = Record<string, unknown>;

export function trackEvent(name: string, params: GA4EventParams = {}): void {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    };

    if (typeof w.gtag === 'function') {
        w.gtag('event', name, params);
        return;
    }

    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(['event', name, params]);
}

// ---------- GA4 Ecommerce wrappers (PHP by default) ----------

export const trackViewItem = (item: {
    item_id: string;
    item_name: string;
    price?: number;
    item_category?: string;
}): void =>
    trackEvent('view_item', {
        currency: 'PHP',
        value: item.price ?? 0,
        items: [item],
    });

export const trackViewItemList = (itemListName: string, items: Array<{
    item_id: string;
    item_name: string;
    price?: number;
    item_category?: string;
}>): void =>
    trackEvent('view_item_list', {
        item_list_name: itemListName,
        items: items,
    });

export const trackSelectItem = (item: {
    item_list_name: string;
    item_id: string;
    item_name: string;
}): void =>
    trackEvent('select_item', {
        item_list_name: item.item_list_name,
        items: [{ item_id: item.item_id, item_name: item.item_name }],
    });

export const trackAddToCart = (item: {
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
}): void =>
    trackEvent('add_to_cart', {
        currency: 'PHP',
        value: item.price * item.quantity,
        items: [item],
    });

export const trackBeginCheckout = (value: number, itemCount: number): void =>
    trackEvent('begin_checkout', {
        currency: 'PHP',
        value,
        items_count: itemCount,
    });

export const trackAddPaymentInfo = (value: number, paymentType: string): void =>
    trackEvent('add_payment_info', {
        currency: 'PHP',
        value,
        payment_type: paymentType,
    });

// ---------- Custom engagement events ----------

export const trackSearch = (query: string, source: string): void =>
    trackEvent('search', { search_term: query, source });

export const trackImageUpload = (source: 'landing' | 'customizing' | 'header'): void =>
    trackEvent('image_upload', { source });

export const trackSignUp = (method: string, source: string): void =>
    trackEvent('sign_up', { method, source });
