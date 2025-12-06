/**
 * Rounds down a price to the nearest "99" ending.
 * 
 * Rules:
 * 1. Only rounds prices that don't already end with "99"
 * 2. Never rounds below the specified minimum price (e.g., base price)
 * 
 * Examples:
 * - 1250 → 1199 (if minPrice allows)
 * - 1469 → 1399 (if minPrice allows)
 * - 1389 → 1299 (if minPrice allows)
 * - 1299 → 1299 (already ends with 99, no change)
 * - 1250 with minPrice=1200 → 1250 (would go below minPrice, so no rounding)
 * 
 * @param price - The original price
 * @param minPrice - Optional minimum price (e.g., base price). Defaults to 0.
 * @returns The price rounded down to the nearest "99", or original price if conditions aren't met
 */
export const roundDownToNearest99 = (price: number, minPrice: number = 0): number => {
    // Check if price already ends with 99
    const lastTwoDigits = price % 100;
    if (lastTwoDigits === 99) {
        return price; // Already ends with 99, no rounding needed
    }

    if (price < 100) {
        // For prices below 100, we can't apply the "99" logic meaningfully
        return price; // Return original price instead of 0
    }

    // Find the hundreds place: Math.floor(price / 100) * 100
    // Then subtract 1 to get to the nearest "99"
    const roundedDown = Math.floor(price / 100) * 100 - 1;

    // Ensure we don't go below the minimum price
    if (roundedDown < minPrice) {
        return price; // Return original price if rounding would go below minimum
    }

    return roundedDown;
};
