export interface PersistedAnalysisSnapshot {
  imageRef?: string | null
  result?: unknown | null
}

export function parsePersistedAnalysis(raw: string | null): PersistedAnalysisSnapshot | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as PersistedAnalysisSnapshot
  } catch {
    return null
  }
}

export type RefLoadStrategy = 'skip' | 'reuse' | 'load'

interface RefLoadStrategyOptions {
  decodedUrl: string | null
  fromSaved: boolean
  fromMerchant: boolean
  persistedAnalysis: PersistedAnalysisSnapshot | null
  hasLiveAnalysisResult: boolean
  lastProcessedRefUrl: string | null
}

export function getRefLoadStrategy({
  decodedUrl,
  fromSaved,
  fromMerchant,
  persistedAnalysis,
  hasLiveAnalysisResult,
  lastProcessedRefUrl,
}: RefLoadStrategyOptions): RefLoadStrategy {
  if (!decodedUrl) return 'skip'
  if (fromSaved || fromMerchant) return 'load'
  if (lastProcessedRefUrl === decodedUrl) return 'skip'

  const hasMatchingPersistedAnalysis =
    persistedAnalysis?.imageRef === decodedUrl &&
    !!persistedAnalysis.result &&
    hasLiveAnalysisResult

  if (hasMatchingPersistedAnalysis) {
    return 'reuse'
  }

  return 'load'
}