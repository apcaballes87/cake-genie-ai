declare const Deno: any;

export type PaymentMode = 'live' | 'test';

/**
 * Payment mode is decided by the server, never by the request. It used to come
 * from the browser (localStorage "xendit_payment_mode"), which let a caller pick
 * the Xendit test key and "pay" with simulated money.
 *
 * Defaults to live. Set the XENDIT_PAYMENT_MODE secret to "test" only on
 * non-production projects.
 */
export function resolvePaymentMode(): PaymentMode {
  return Deno.env.get('XENDIT_PAYMENT_MODE') === 'test' ? 'test' : 'live';
}

export function getXenditSecretKey(mode: PaymentMode): string | undefined {
  return mode === 'live'
    ? (Deno.env.get('XENDIT_LIVE_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'))
    : (Deno.env.get('XENDIT_TEST_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'));
}
