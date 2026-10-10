import {
  buildSearchAnalysisBatchInputLine,
  type QueueItem,
} from '@/lib/admin/searchAnalysisBatch';

export const CACHE_ANALYSIS_RERUN_MODEL = 'gemini-3.1-flash-lite' as const;

export type CacheAnalysisRerunRow = {
  id: string;
  p_hash: string;
  original_image_url: string | null;
  studio_edited_image_url: string | null;
  analysis_json?: unknown;
};

export type CacheAnalysisRerunItem = CacheAnalysisRerunRow & {
  source_image_url: string;
  source_kind: 'studio_edited' | 'original';
};

function nonBlankUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function selectCacheAnalysisRerunItems(
  rows: CacheAnalysisRerunRow[],
): CacheAnalysisRerunItem[] {
  return rows
    .map((row) => {
      const studioUrl = nonBlankUrl(row.studio_edited_image_url);
      const originalUrl = nonBlankUrl(row.original_image_url);
      if (studioUrl) {
        return { ...row, source_image_url: studioUrl, source_kind: 'studio_edited' as const };
      }
      if (originalUrl) {
        return { ...row, source_image_url: originalUrl, source_kind: 'original' as const };
      }
      return null;
    })
    .filter((row): row is CacheAnalysisRerunItem => row !== null)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function buildCacheAnalysisRerunInputLine(
  item: CacheAnalysisRerunItem,
  activePrompt: string,
  requestConfig: Record<string, unknown>,
  sizeSchema: Parameters<typeof buildSearchAnalysisBatchInputLine>[3],
) {
  const queueItem: QueueItem = {
    id: item.id,
    p_hash: item.p_hash,
    fingerprint_pipeline: null,
    source_image_url: item.source_image_url,
    normalized_image_url: item.source_image_url,
    storage_path: `cache-rerun/${item.id}`,
    status: 'queued',
    submission_ordinal: null,
  };

  return buildSearchAnalysisBatchInputLine(queueItem, activePrompt, requestConfig, sizeSchema);
}

export function buildAnalysisJsonOnlyUpdate(analysisJson: unknown) {
  return { analysis_json: analysisJson };
}
