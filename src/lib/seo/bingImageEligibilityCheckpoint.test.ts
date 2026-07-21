import { describe, expect, it } from 'vitest';

import {
  createBingImageEligibilityCheckpoint,
  parseBingImageEligibilityCheckpoint,
} from './bingImageEligibilityCheckpoint';

describe('Bing image eligibility checkpoint', () => {
  it('starts with an empty version 2 checkpoint', () => {
    expect(createBingImageEligibilityCheckpoint()).toMatchObject({
      version: 2,
      completed: {},
    });
  });

  it('discards legacy metadata-only completion records', () => {
    const result = parseBingImageEligibilityCheckpoint({
      version: 1,
      updatedAt: '2026-07-21T00:00:00.000Z',
      completed: {
        'https://example.com/image.webp': {
          status: 'already-eligible',
          sha256: 'legacy',
        },
      },
    });

    expect(result.resetLegacy).toBe(true);
    expect(result.checkpoint).toMatchObject({ version: 2, completed: {} });
  });

  it('preserves a valid public-verified version 2 checkpoint', () => {
    const checkpoint = {
      version: 2 as const,
      updatedAt: '2026-07-21T00:00:00.000Z',
      completed: {
        'https://example.com/image.webp': {
          status: 'updated' as const,
          sha256: 'abc123',
          verifiedAt: '2026-07-21T00:00:00.000Z',
          xRobotsTag: 'all',
          cfCacheStatus: 'MISS',
        },
      },
    };

    expect(parseBingImageEligibilityCheckpoint(checkpoint)).toEqual({
      checkpoint,
      resetLegacy: false,
    });
  });

  it('rejects malformed version 2 checkpoints', () => {
    expect(() => parseBingImageEligibilityCheckpoint({
      version: 2,
      updatedAt: null,
      completed: [],
    })).toThrow('Invalid Bing image eligibility checkpoint');

    expect(() => parseBingImageEligibilityCheckpoint({
      version: 2,
      updatedAt: '2026-07-21T00:00:00.000Z',
      completed: {
        'https://example.com/image.webp': {
          status: 'updated',
          sha256: 'abc123',
          verifiedAt: 'not-a-date',
          xRobotsTag: 'none',
          cfCacheStatus: 'HIT',
        },
      },
    })).toThrow('Invalid Bing image eligibility checkpoint');
  });
});
