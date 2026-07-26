import { isValidRedirect } from '@/lib/utils/urlHelpers';

export const CART_RETURN_TO_QUERY_PARAM = 'returnTo';

export function buildCartReturnUrl(returnTo: string): string {
    return `/cart?${CART_RETURN_TO_QUERY_PARAM}=${encodeURIComponent(returnTo)}`;
}

export function getCustomizerCartReturnUrl(returnTo: string | null): string | null {
    if (typeof returnTo !== 'string' || !isValidRedirect(returnTo)) return null;

    try {
        const url = new URL(returnTo, 'https://genie.ph');
        const isCustomizerPath =
            url.pathname === '/customizing' ||
            url.pathname.startsWith('/customizing/');

        return isCustomizerPath ? returnTo : null;
    } catch {
        return null;
    }
}
