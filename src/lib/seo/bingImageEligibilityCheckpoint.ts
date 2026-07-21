export type BingImageEligibilityCheckpointEntry = {
  status: 'updated' | 'already-eligible';
  sha256: string | null;
  verifiedAt: string;
  xRobotsTag: string;
  cfCacheStatus: string | null;
};

export type BingImageEligibilityCheckpoint = {
  version: 2;
  updatedAt: string;
  completed: Record<string, BingImageEligibilityCheckpointEntry>;
};

export function createBingImageEligibilityCheckpoint(): BingImageEligibilityCheckpoint {
  return {
    version: 2,
    updatedAt: new Date(0).toISOString(),
    completed: {},
  };
}

export function parseBingImageEligibilityCheckpoint(
  value: unknown,
): { checkpoint: BingImageEligibilityCheckpoint; resetLegacy: boolean } {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid Bing image eligibility checkpoint.');
  }

  const candidate = value as {
    version?: unknown;
    updatedAt?: unknown;
    completed?: unknown;
  };

  if (candidate.version === 1) {
    return {
      checkpoint: createBingImageEligibilityCheckpoint(),
      resetLegacy: true,
    };
  }

  if (
    candidate.version !== 2
    || typeof candidate.updatedAt !== 'string'
    || !candidate.completed
    || typeof candidate.completed !== 'object'
    || Array.isArray(candidate.completed)
  ) {
    throw new Error('Invalid Bing image eligibility checkpoint.');
  }

  const entriesAreValid = Object.entries(candidate.completed as Record<string, unknown>)
    .every(([url, value]) => {
      if (!url.startsWith('https://') || !value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
      }

      const entry = value as Partial<BingImageEligibilityCheckpointEntry>;
      return (entry.status === 'updated' || entry.status === 'already-eligible')
        && (entry.sha256 === null || typeof entry.sha256 === 'string')
        && typeof entry.verifiedAt === 'string'
        && Number.isFinite(Date.parse(entry.verifiedAt))
        && typeof entry.xRobotsTag === 'string'
        && entry.xRobotsTag.toLowerCase().split(/[;,]/).some((directive) => directive.trim() === 'all')
        && (entry.cfCacheStatus === null || typeof entry.cfCacheStatus === 'string');
    });

  if (!entriesAreValid) {
    throw new Error('Invalid Bing image eligibility checkpoint.');
  }

  return {
    checkpoint: candidate as BingImageEligibilityCheckpoint,
    resetLegacy: false,
  };
}
