import { describe, expect, it } from 'vitest'
import { getAddToCartBlockLabel, getAddToCartBlockReason } from './customizerAddToCart'

describe('customizer add-to-cart guard', () => {
  it('prioritizes the actionable state that actually prevents a click', () => {
    expect(getAddToCartBlockReason({ isAnalyzing: true, isLoading: true, price: null })).toBe('analysis_in_progress')
    expect(getAddToCartBlockReason({ isLoading: true, price: null })).toBe('pricing_in_progress')
    expect(getAddToCartBlockReason({ error: 'Pricing failed', price: 1200 })).toBe('pricing_error')
    expect(getAddToCartBlockReason({ price: 1200, hasCakeInfo: false })).toBe('cake_info_missing')
    expect(getAddToCartBlockReason({ price: 1200, hasCakeInfo: true })).toBeNull()
  })

  it('keeps analytics enums separate from user-facing labels', () => {
    expect(getAddToCartBlockLabel('analysis_in_progress')).toBe('Wait for analysis to finish before buying')
    expect(getAddToCartBlockLabel('pricing_error')).toBe('Resolve the pricing issue before buying')
  })
})
