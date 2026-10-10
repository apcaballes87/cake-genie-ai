import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOpenAIAdsProductContents } from '@/lib/openaiAds/contents';

describe('OpenAI Ads Pixel order deduplication', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID', 'pixel-id');
    document.head.innerHTML = '';
    delete (window as Window & { oaiq?: unknown }).oaiq;
    delete (window as Window & { __genieOpenAIAdsPixelInitialized?: boolean }).__genieOpenAIAdsPixelInitialized;
  });

  it('uses the same order ID and feed item slug as the server conversion event', async () => {
    const pixelCalls: unknown[][] = [];
    const pixel = (...args: unknown[]) => pixelCalls.push(args);
    Object.assign(window, {
      oaiq: pixel,
      __genieOpenAIAdsPixelInitialized: true,
    });

    const { trackOpenAIAdsOrderCreated } = await import('./openaiAdsPixel');
    trackOpenAIAdsOrderCreated({
      orderId: 'order-uuid',
      amountPesos: 1999,
      items: buildOpenAIAdsProductContents([{
        cake_type: '1 Tier',
        quantity: 1,
        customization_details: {
          commerce_snapshot: {
            product: { designSlug: 'birthday-cake-a1b2', sourceSurface: 'customizing' },
          },
        },
      }]),
    });

    expect(pixelCalls).toEqual([[
      'measure',
      'order_created',
      {
        type: 'contents',
        amount: 199900,
        currency: 'PHP',
        contents: [{
          id: 'birthday-cake-a1b2',
          name: 'Custom Cake - 1 Tier',
          content_type: 'product',
          quantity: 1,
        }],
      },
      { event_id: 'order-uuid' },
    ]]);
  });
});
