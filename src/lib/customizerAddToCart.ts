export type AddToCartBlockReason =
  | 'add_to_cart_in_flight'
  | 'analysis_in_progress'
  | 'pricing_in_progress'
  | 'pricing_error'
  | 'price_missing'
  | 'cake_info_missing'

export interface AddToCartGuardState {
  isAdding?: boolean
  isAnalyzing?: boolean
  isLoading?: boolean
  error?: string | null
  price?: number | null
  hasCakeInfo?: boolean
}

/**
 * Keep the CTA presentation, click guard, and telemetry on the same reason.
 * The values are intentionally stable analytics enums, not user-facing copy.
 */
export function getAddToCartBlockReason(state: AddToCartGuardState): AddToCartBlockReason | null {
  if (state.isAdding) return 'add_to_cart_in_flight'
  if (state.isAnalyzing) return 'analysis_in_progress'
  if (state.error) return 'pricing_error'
  if (state.isLoading) return 'pricing_in_progress'
  if (state.price == null) return 'price_missing'
  if (state.hasCakeInfo === false) return 'cake_info_missing'
  return null
}

export function getAddToCartBlockLabel(reason: AddToCartBlockReason | null): string | undefined {
  switch (reason) {
    case 'add_to_cart_in_flight': return 'Adding this cake to your cart'
    case 'analysis_in_progress': return 'Wait for analysis to finish before buying'
    case 'pricing_in_progress': return 'Price is still calculating'
    case 'pricing_error': return 'Resolve the pricing issue before buying'
    case 'price_missing': return 'Upload or select a cake design first'
    case 'cake_info_missing': return 'Cake details are still loading'
    default: return undefined
  }
}
