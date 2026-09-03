/**
 * Canonical sizing for analyses produced after the three-band pricing release.
 *
 * Unmarked persisted analyses predate this release, so their `small` and
 * `medium` values retain their former six-band meanings at the input boundary.
 * Never normalize an unmarked object in place: cached JSON and cart/order
 * payloads are historical records.
 */
export const ANALYSIS_SIZE_SCHEMA = 'three_band_v1' as const;

export const CANONICAL_ANALYSIS_SIZES = ['small', 'medium', 'large'] as const;
export type CanonicalAnalysisSize = typeof CANONICAL_ANALYSIS_SIZES[number];

export const LEGACY_ANALYSIS_SIZES = ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] as const;
export type LegacyAnalysisSize = typeof LEGACY_ANALYSIS_SIZES[number];

export type AnalysisSizeSchema = typeof ANALYSIS_SIZE_SCHEMA;

const LEGACY_TO_CANONICAL_SIZE: Record<LegacyAnalysisSize, CanonicalAnalysisSize> = {
  tiny: 'small',
  xsmall: 'small',
  small: 'medium',
  medium: 'medium',
  large: 'large',
  xlarge: 'large',
};

export function isCanonicalAnalysisSize(value: unknown): value is CanonicalAnalysisSize {
  return typeof value === 'string'
    && CANONICAL_ANALYSIS_SIZES.includes(value.trim().toLowerCase() as CanonicalAnalysisSize);
}

export function isLegacyAnalysisSize(value: unknown): value is LegacyAnalysisSize {
  return typeof value === 'string'
    && LEGACY_ANALYSIS_SIZES.includes(value.trim().toLowerCase() as LegacyAnalysisSize);
}

/** Maps one legacy six-band size to its canonical three-band equivalent. */
export function normalizeLegacyAnalysisSize(value: unknown): CanonicalAnalysisSize | undefined {
  if (!isLegacyAnalysisSize(value)) return undefined;
  return LEGACY_TO_CANONICAL_SIZE[value.trim().toLowerCase() as LegacyAnalysisSize];
}

/**
 * Normalizes a value that is already known to be in the current schema.
 * This deliberately does not reinterpret `small` or `medium` as legacy;
 * callers processing an unmarked analysis must use
 * `normalizeAnalysisForThreeBandSizing` instead.
 */
export function normalizeCanonicalAnalysisSize(value: unknown): CanonicalAnalysisSize | undefined {
  if (!isCanonicalAnalysisSize(value)) return undefined;
  return value.trim().toLowerCase() as CanonicalAnalysisSize;
}

type SizedItem = { size?: unknown; [key: string]: unknown };
type SizeSchemaAnalysis = {
  analysis_size_schema?: unknown;
  main_toppers?: unknown;
  support_elements?: unknown;
};

function normalizeLegacySizedItems(items: unknown): unknown {
  if (!Array.isArray(items)) return items;

  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const sizedItem = item as SizedItem;
    const size = normalizeLegacyAnalysisSize(sizedItem.size);
    return size ? { ...sizedItem, size } : { ...sizedItem };
  });
}

/** Returns a detached payload with six-band labels collapsed, without adding a marker. */
export function normalizeLegacyAnalysisPayload<T extends SizeSchemaAnalysis>(analysis: T): T {
  return {
    ...analysis,
    main_toppers: normalizeLegacySizedItems(analysis.main_toppers),
    support_elements: normalizeLegacySizedItems(analysis.support_elements),
  } as T;
}

/**
 * Marks new analyses as canonical and converts every unmarked historical
 * analysis into a detached, canonical in-memory copy.
 */
export function normalizeAnalysisForThreeBandSizing<T extends SizeSchemaAnalysis>(analysis: T): T {
  if (analysis.analysis_size_schema === ANALYSIS_SIZE_SCHEMA) return analysis;

  return {
    ...normalizeLegacyAnalysisPayload(analysis),
    analysis_size_schema: ANALYSIS_SIZE_SCHEMA,
  } as T;
}

/**
 * Before the pricing migration runs, six-band rows still exist. Canonical
 * state can safely resolve against their higher source band. Once migration
 * removes those rows this returns the requested canonical band unchanged.
 */
export function getLegacySourceSizeForCanonicalSize(
  value: unknown,
): LegacyAnalysisSize | undefined {
  switch (normalizeCanonicalAnalysisSize(value)) {
    case 'small':
      return 'xsmall';
    case 'medium':
      return 'medium';
    case 'large':
      return 'xlarge';
    default:
      return undefined;
  }
}
