'use client';

import { useEffect } from 'react';
import { trackOpenAIAdsContentsViewed } from '@/lib/analytics/openaiAdsPixel';

export function OpenAIAdsContentsViewed({
  itemId,
  name,
}: {
  itemId: string;
  name: string;
}) {
  useEffect(() => {
    trackOpenAIAdsContentsViewed({ id: itemId, name });
  }, [itemId, name]);

  return null;
}
