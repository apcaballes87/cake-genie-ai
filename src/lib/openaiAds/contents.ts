export interface OpenAIAdsProductContent {
  id: string;
  name: string;
  content_type: 'product';
  quantity: number;
}

interface OpenAIAdsOrderOrCartItem {
  cake_type?: string | null;
  quantity?: number | string | null;
  customization_details?: unknown;
}

function parseDetails(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function getFeedDesignSlug(value: unknown): string | null {
  const details = parseDetails(value);
  if (!details) return null;

  const snapshot = parseDetails(details.commerce_snapshot ?? details.commerceSnapshot);
  const product = snapshot ? parseDetails(snapshot.product) : null;
  if (!product || (product.sourceSurface && product.sourceSurface !== 'customizing')) return null;

  const slug = typeof product.designSlug === 'string' ? product.designSlug.trim() : '';
  return /^[a-z0-9][a-z0-9_-]{0,199}$/i.test(slug) ? slug : null;
}

/** Product IDs here are the exact stable slug IDs used by the Ads catalog CSV. */
export function buildOpenAIAdsProductContents(
  items: OpenAIAdsOrderOrCartItem[],
): OpenAIAdsProductContent[] {
  return items.flatMap((item) => {
    const id = getFeedDesignSlug(item.customization_details);
    if (!id) return [];

    const quantity = Math.floor(Number(item.quantity ?? 1));
    if (!Number.isFinite(quantity) || quantity < 1) return [];

    return [{
      id,
      name: `Custom Cake - ${item.cake_type?.trim() || 'Design'}`,
      content_type: 'product' as const,
      quantity,
    }];
  });
}
