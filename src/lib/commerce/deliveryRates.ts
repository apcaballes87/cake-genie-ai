import type { BasePriceCatalog } from '@/lib/pricing/basePriceCatalog';

export const DELIVERY_RATE_SERVICE_CITIES = [
  'Cebu City',
  'Mandaue City',
  'Lapu-Lapu City',
  'Talisay City',
  'Consolacion',
  'Cordova',
  'Liloan',
] as const;

export const DELIVERY_FEES_BY_CITY: Record<string, number> = {
  'Cebu City': 0,
  Cebu: 0,
  Mandaue: 50,
  'Mandaue City': 50,
  'Lapu-Lapu': 100,
  'Lapu-Lapu City': 100,
  'Lapu-lapu': 100,
  'Lapu-lapu City': 100,
  Cordova: 200,
  Consolacion: 200,
  Liloan: 300,
  Talisay: 150,
  'Talisay City': 150,
};

export const DELIVERY_FEES_BY_CITY_CAKES_AND_MEMORIES: Record<string, number> = {
  'Cebu City': 200,
  Cebu: 200,
  Mandaue: 250,
  'Mandaue City': 250,
  'Lapu-Lapu': 400,
  'Lapu-Lapu City': 400,
  'Lapu-lapu': 400,
  'Lapu-lapu City': 400,
  Cordova: 500,
  Consolacion: 500,
  Liloan: 600,
  Talisay: 300,
  'Talisay City': 300,
};

export type DeliveryRateCard = {
  city: (typeof DELIVERY_RATE_SERVICE_CITIES)[number];
  rate: number;
};

function resolveDeliveryFeeFromMap(
  city: string | null | undefined,
  rateMap: Record<string, number>,
): number {
  if (!city) return 0;

  if (rateMap[city] !== undefined) {
    return rateMap[city];
  }

  const normalizedCity = city.toLowerCase().trim();
  for (const [key, fee] of Object.entries(rateMap)) {
    if (key.toLowerCase() === normalizedCity) {
      return fee;
    }
  }

  for (const [key, fee] of Object.entries(rateMap)) {
    const keyLower = key.toLowerCase();
    if (normalizedCity.includes(keyLower) || keyLower.includes(normalizedCity)) {
      return fee;
    }
  }

  return 0;
}

export const getDeliveryFeeByCityForCatalog = (
  city: string | null | undefined,
  catalog: BasePriceCatalog = 'genie',
): number => {
  const rateMap = catalog === 'cakes_and_memories'
    ? DELIVERY_FEES_BY_CITY_CAKES_AND_MEMORIES
    : DELIVERY_FEES_BY_CITY;
  return resolveDeliveryFeeFromMap(city, rateMap);
};

export const getDeliveryFeeByCity = (city: string | null | undefined): number => {
  return getDeliveryFeeByCityForCatalog(city, 'genie');
};

export function getDeliveryRateCards(): DeliveryRateCard[] {
  return DELIVERY_RATE_SERVICE_CITIES.map((city) => ({
    city,
    rate: getDeliveryFeeByCity(city),
  }));
}

export function getDeliveryRateSummary(): {
  minFee: number;
  maxFee: number;
  lowestRateCity: DeliveryRateCard['city'];
  highestRateCity: DeliveryRateCard['city'];
} {
  const cards = getDeliveryRateCards();
  const [firstCard] = cards;

  if (!firstCard) {
    return {
      minFee: 0,
      maxFee: 0,
      lowestRateCity: 'Cebu City',
      highestRateCity: 'Cebu City',
    };
  }

  return cards.reduce(
    (summary, card) => ({
      minFee: Math.min(summary.minFee, card.rate),
      maxFee: Math.max(summary.maxFee, card.rate),
      lowestRateCity: card.rate < summary.minFee ? card.city : summary.lowestRateCity,
      highestRateCity: card.rate > summary.maxFee ? card.city : summary.highestRateCity,
    }),
    {
      minFee: firstCard.rate,
      maxFee: firstCard.rate,
      lowestRateCity: firstCard.city,
      highestRateCity: firstCard.city,
    },
  );
}
