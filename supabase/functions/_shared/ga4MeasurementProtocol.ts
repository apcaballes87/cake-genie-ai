import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupabaseAdminClient = ReturnType<typeof createClient>;

interface BuyerAttributionTouchLike {
  occurredAt?: string | null;
}

interface BuyerAttributionLike {
  ga?: {
    clientId?: string | null;
    sessionId?: string | null;
  } | null;
  purchaseSession?: BuyerAttributionTouchLike | null;
}

interface MirrorOrderItemLike {
  cake_type: string;
  cake_size: string;
  final_price: number | string | null;
  quantity: number | string | null;
}

interface MirrorOrderLike {
  order_id: string;
  order_number: string;
  total_amount: number | string;
  user_id?: string | null;
  discount_code_id?: string | null;
  ga_purchase_mirrored_at?: string | null;
  buyer_attribution?: BuyerAttributionLike | Record<string, unknown> | null;
  cakegenie_order_items?: MirrorOrderItemLike[] | null;
}

interface MirrorOrderPurchaseParams {
  supabaseAdmin: SupabaseAdminClient;
  order: MirrorOrderLike;
  measurementId: string;
  apiSecret: string;
}

const MEASUREMENT_PROTOCOL_URL = 'https://www.google-analytics.com/mp/collect';
const SESSION_ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalizeNumber(value: number | string | null | undefined): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isSessionIdUsable(
  sessionId: string | null | undefined,
  occurredAt: string | null | undefined,
): boolean {
  if (!sessionId || !/^\d+$/.test(sessionId)) return false;
  if (!occurredAt) return false;

  const startedAt = Date.parse(occurredAt);
  if (!Number.isFinite(startedAt)) return false;

  return Date.now() - startedAt <= SESSION_ATTRIBUTION_WINDOW_MS;
}

export async function mirrorOrderPurchaseToGa4(
  params: MirrorOrderPurchaseParams,
): Promise<{ mirrored: boolean; skippedReason?: string }> {
  const { supabaseAdmin, order, measurementId, apiSecret } = params;

  if (order.ga_purchase_mirrored_at) {
    return { mirrored: false, skippedReason: 'already_mirrored' };
  }

  const buyerAttribution = (order.buyer_attribution ?? {}) as BuyerAttributionLike;
  const clientId = buyerAttribution.ga?.clientId ?? null;
  if (!clientId) {
    return { mirrored: false, skippedReason: 'missing_client_id' };
  }

  const sessionId = buyerAttribution.ga?.sessionId ?? null;
  const sessionOccurredAt = buyerAttribution.purchaseSession?.occurredAt ?? null;
  const usableSessionId = isSessionIdUsable(sessionId, sessionOccurredAt)
    ? sessionId
    : null;

  const payload: Record<string, unknown> = {
    client_id: clientId,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: order.order_number,
          value: normalizeNumber(order.total_amount),
          currency: 'PHP',
          ...(order.discount_code_id ? { coupon: order.discount_code_id } : {}),
          ...(usableSessionId ? { session_id: Number(usableSessionId) } : {}),
          items: (order.cakegenie_order_items ?? []).map((item) => ({
            item_id: `${item.cake_type}_${item.cake_size}`,
            item_name: `Custom Cake - ${item.cake_type}`,
            item_category: item.cake_type,
            price: normalizeNumber(item.final_price),
            quantity: normalizeNumber(item.quantity),
          })),
        },
      },
    ],
  };

  if (order.user_id) {
    payload.user_id = order.user_id;
  }

  const response = await fetch(
    `${MEASUREMENT_PROTOCOL_URL}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`GA4 Measurement Protocol error: ${response.status} ${responseText}`);
  }

  const mirroredAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('cakegenie_orders')
    .update({
      ga_purchase_mirrored_at: mirroredAt,
    })
    .eq('order_id', order.order_id)
    .is('ga_purchase_mirrored_at', null);

  if (error) {
    throw error;
  }

  return { mirrored: true };
}
