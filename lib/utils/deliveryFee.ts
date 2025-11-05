// lib/utils/deliveryFee.ts

import { CartItem } from '../../types';

const STANDARD_DELIVERY_FEE = 150; // ₱150 standard delivery fee

/**
 * Calculate delivery fee based on cart items.
 * Bento cakes get free delivery.
 * All other cakes pay standard delivery fee.
 */
export function calculateDeliveryFee(items: CartItem[]): number {
  // If no items, no delivery fee
  if (!items || items.length === 0) {
    return 0;
  }

  // Check if all items are Bento cakes
  const allBentoCakes = items.every(item => {
    // Check if the type string contains "Bento"
    return item.type === 'Bento' || item.type.toLowerCase().includes('bento');
  });

  // If all items are Bento cakes, delivery is free
  if (allBentoCakes) {
    return 0;
  }

  // Otherwise, charge standard delivery fee
  return STANDARD_DELIVERY_FEE;
}

/**
 * Check if cart qualifies for free delivery
 */
export function hasFreeDelivery(items: CartItem[]): boolean {
  return calculateDeliveryFee(items) === 0;
}

/**
 * Get delivery fee message for display
 */
export function getDeliveryFeeMessage(items: CartItem[]): string {
  const fee = calculateDeliveryFee(items);

  if (fee === 0) {
    const allBento = items.every(item =>
      item.type === 'Bento' || item.type.toLowerCase().includes('bento')
    );

    if (allBento) {
      return 'Free delivery for Bento cakes! 🎉';
    }
    return 'Free delivery!';
  }

  return '';
}
