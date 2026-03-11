import { describe, expect, it } from 'vitest';
import type { CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, SupportElementUI } from '@/types';
import { buildPricingUiStateKey } from './usePricing';

describe('buildPricingUiStateKey', () => {
  const baseState = {
    mainToppers: [{ id: 'topper-1', type: 'figurine', size: 'medium', quantity: 1, description: '', isEnabled: true }] as MainTopperUI[],
    supportElements: [{ id: 'support-1', type: 'stars', size: 'small', quantity: 2, description: '', isEnabled: true }] as SupportElementUI[],
    cakeMessages: [{ id: 'message-1', type: 'icing_text', text: 'Happy Birthday', quantity: 1, isEnabled: true }] as CakeMessageUI[],
    icingDesign: { frosting_finish: 'smooth' } as IcingDesignUI,
    cakeInfo: { type: '1 Tier', size: '6 in', thickness: '4 in', flavor: 'chocolate' } as CakeInfoUI,
  };

  it('returns the same key for equivalent pricing inputs', () => {
    expect(buildPricingUiStateKey(baseState)).toBe(buildPricingUiStateKey({
      ...baseState,
      mainToppers: [...baseState.mainToppers],
      supportElements: [...baseState.supportElements],
      cakeMessages: [...baseState.cakeMessages],
      icingDesign: { ...baseState.icingDesign },
      cakeInfo: { ...baseState.cakeInfo },
    }));
  });

  it('changes the key when pricing-relevant state changes', () => {
    const originalKey = buildPricingUiStateKey(baseState);
    const updatedKey = buildPricingUiStateKey({
      ...baseState,
      cakeInfo: { ...baseState.cakeInfo, size: '8 in' },
    });

    expect(updatedKey).not.toBe(originalKey);
  });

  it('returns a stable idle key when pricing inputs are not ready', () => {
    expect(buildPricingUiStateKey(null)).toBe('no-pricing-ui-state');
  });
});