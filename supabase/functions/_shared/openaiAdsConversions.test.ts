import { describe, expect, it, vi } from 'vitest';
import {
  buildOpenAIAdsOrderCreatedEvent,
  sendOpenAIAdsOrderCreated,
} from './openaiAdsConversions';

const item = (sourceSurface = 'customizing') => ({
  cake_type: '1 Tier',
  quantity: 2,
  customization_details: {
    commerce_snapshot: {
      product: {
        designSlug: 'pink-cake-1a2b',
        sourceSurface,
      },
    },
  },
});

describe('OpenAI Ads Conversions API payload', () => {
  it('sends paid and partial orders using feed slug IDs and the Pixel dedupe ID', () => {
    for (const paymentStatus of ['paid', 'partial']) {
      const event = buildOpenAIAdsOrderCreatedEvent({
        order_id: 'order-uuid',
        total_amount: '2499.50',
        payment_status: paymentStatus,
        cakegenie_order_items: [item()],
      }, 1770000000123);

      expect(event).toMatchObject({
        id: 'order-uuid',
        type: 'order_created',
        timestamp_ms: 1770000000123,
        source_url: 'https://genie.ph/order-confirmation',
        action_source: 'web',
        data: {
          type: 'contents',
          amount: 249950,
          currency: 'PHP',
          contents: [{
            id: 'pink-cake-1a2b',
            name: 'Custom Cake - 1 Tier',
            content_type: 'product',
            quantity: 2,
          }],
        },
      });
    }
  });

  it('does not emit payment-pending or failed orders', () => {
    for (const paymentStatus of ['pending', 'failed', 'refunded']) {
      expect(buildOpenAIAdsOrderCreatedEvent({
        order_id: 'order-uuid',
        total_amount: 1200,
        payment_status: paymentStatus,
      })).toBeNull();
    }
  });

  it('excludes non-feed commerce items and sends no customer identifiers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await sendOpenAIAdsOrderCreated({
      order_id: 'order-uuid',
      total_amount: 1200,
      payment_status: 'paid',
      cakegenie_order_items: [item('merchant_product')],
    }, { pixelId: 'pixel-id', apiKey: 'private-key' }, fetchMock);

    expect(result).toBe('sent');
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://bzr.openai.com/v1/events?pid=pixel-id');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer private-key' });
    const payload = JSON.parse(String(request.body));
    expect(payload.events[0].data.contents).toEqual([]);
    expect(JSON.stringify(payload)).not.toMatch(/email|phone|user_id|guest/i);
  });

  it('keeps OpenAI transport failures non-blocking', async () => {
    await expect(sendOpenAIAdsOrderCreated({
      order_id: 'order-uuid',
      total_amount: 1200,
      payment_status: 'paid',
    }, { pixelId: 'pixel-id', apiKey: 'private-key' }, async () => {
      throw new Error('network unavailable');
    })).resolves.toBe('failed');
  });
});
