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

export type DeliveryRateCard = {
  city: (typeof DELIVERY_RATE_SERVICE_CITIES)[number];
  rate: number;
};

export const getDeliveryFeeByCity = (city: string | null | undefined): number => {
  if (!city) return 0;

  if (DELIVERY_FEES_BY_CITY[city] !== undefined) {
    return DELIVERY_FEES_BY_CITY[city];
  }

  const normalizedCity = city.toLowerCase().trim();
  for (const [key, fee] of Object.entries(DELIVERY_FEES_BY_CITY)) {
    if (key.toLowerCase() === normalizedCity) {
      return fee;
    }
  }

  for (const [key, fee] of Object.entries(DELIVERY_FEES_BY_CITY)) {
    const keyLower = key.toLowerCase();
    if (normalizedCity.includes(keyLower) || keyLower.includes(normalizedCity)) {
      return fee;
    }
  }

  return 0;
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
