import { describe, expect, it } from 'vitest'
import { getRefLoadStrategy, parsePersistedAnalysis } from './refLoadStrategy'

describe('refLoadStrategy', () => {
  it('returns load for a new forwarded ref when persisted state belongs to another image', () => {
    expect(getRefLoadStrategy({
      decodedUrl: 'https://example.com/new-cake.jpg',
      fromSaved: false,
      fromMerchant: false,
      persistedAnalysis: {
        imageRef: 'https://example.com/old-cake.jpg',
        result: { ok: true },
      },
      hasLiveAnalysisResult: true,
      lastProcessedRefUrl: 'https://example.com/old-cake.jpg',
    })).toBe('load')
  })

  it('returns reuse when the exact ref is already restored in live state', () => {
    expect(getRefLoadStrategy({
      decodedUrl: 'https://example.com/cake.jpg',
      fromSaved: false,
      fromMerchant: false,
      persistedAnalysis: {
        imageRef: 'https://example.com/cake.jpg',
        result: { ok: true },
      },
      hasLiveAnalysisResult: true,
      lastProcessedRefUrl: null,
    })).toBe('reuse')
  })

  it('returns skip when the same ref was already processed in this session', () => {
    expect(getRefLoadStrategy({
      decodedUrl: 'https://example.com/cake.jpg',
      fromSaved: false,
      fromMerchant: false,
      persistedAnalysis: null,
      hasLiveAnalysisResult: false,
      lastProcessedRefUrl: 'https://example.com/cake.jpg',
    })).toBe('skip')
  })

  it('forces load for saved or merchant overrides', () => {
    expect(getRefLoadStrategy({
      decodedUrl: 'https://example.com/cake.jpg',
      fromSaved: true,
      fromMerchant: false,
      persistedAnalysis: {
        imageRef: 'https://example.com/cake.jpg',
        result: { ok: true },
      },
      hasLiveAnalysisResult: true,
      lastProcessedRefUrl: 'https://example.com/cake.jpg',
    })).toBe('load')
  })

  it('returns null for malformed persisted analysis JSON', () => {
    expect(parsePersistedAnalysis('{bad json')).toBeNull()
  })
})