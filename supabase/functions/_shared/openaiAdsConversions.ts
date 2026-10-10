import {
  buildOpenAIAdsProductContents,
  type OpenAIAdsProductContent,
} from '../../../src/lib/openaiAds/contents.ts';

export interface OpenAIAdsOrderItemLike {
  cake_type?: string | null;
  quantity?: number | string | null;
  customization_details?: unknown;
}

export interface OpenAIAdsOrderLike {
  order_id: string;
  total_amount: number | string;
  payment_status: string;
  cakegenie_order_items?: OpenAIAdsOrderItemLike[] | null;
}

export interface OpenAIAdsOrderCreatedEvent {
  id: string;
  type: 'order_created';
  timestamp_ms: number;
  source_url: string;
  action_source: 'web';
  data: {
    type: 'contents';
    amount: number;
    currency: 'PHP';
    contents: OpenAIAdsProductContent[];
  };
}

export function buildOpenAIAdsOrderCreatedEvent(
  order: OpenAIAdsOrderLike,
  timestampMs = Date.now(),
): OpenAIAdsOrderCreatedEvent | null {
  if (order.payment_status !== 'paid' && order.payment_status !== 'partial') return null;
  if (!order.order_id || !Number.isFinite(timestampMs)) return null;

  const amountPesos = Number(order.total_amount);
  if (!Number.isFinite(amountPesos) || amountPesos < 0) return null;

  return {
    id: order.order_id,
    type: 'order_created',
    timestamp_ms: Math.floor(timestampMs),
    source_url: 'https://genie.ph/order-confirmation',
    action_source: 'web',
    data: {
      type: 'contents',
      amount: Math.round(amountPesos * 100),
      currency: 'PHP',
      contents: buildOpenAIAdsProductContents(order.cakegenie_order_items ?? []),
    },
  };
}

export async function sendOpenAIAdsOrderCreated(
  order: OpenAIAdsOrderLike,
  config: { pixelId?: string | null; apiKey?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<'sent' | 'disabled' | 'skipped' | 'failed'> {
  const event = buildOpenAIAdsOrderCreatedEvent(order);
  if (!event) return 'skipped';

  const pixelId = config.pixelId?.trim();
  const apiKey = config.apiKey?.trim();
  if (!pixelId || !apiKey) return 'disabled';

  try {
    const response = await fetchImpl(
      `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: [event] }),
      },
    );
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
