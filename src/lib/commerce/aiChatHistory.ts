import type { AiChatHistoryEntry } from '@/types';

type AiChatHistorySource = {
  ai_chat_history?: unknown;
  aiChatHistory?: unknown;
  chat_history?: unknown;
  chatHistory?: unknown;
} | null | undefined;

function normalizePrompt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStructuredEntry(value: unknown): AiChatHistoryEntry | null {
  if (!value || typeof value !== 'object') return null;

  const prompt = normalizePrompt((value as { prompt?: unknown }).prompt);
  if (!prompt) return null;

  return {
    prompt,
    referenceImageUrl: normalizeOptionalText((value as { referenceImageUrl?: unknown }).referenceImageUrl),
    referenceImageName: normalizeOptionalText((value as { referenceImageName?: unknown }).referenceImageName),
    createdAt: typeof (value as { createdAt?: unknown }).createdAt === 'string'
      ? (value as { createdAt: string }).createdAt
      : '',
  };
}

export function normalizeAiChatHistory(source: AiChatHistorySource): AiChatHistoryEntry[] {
  const structuredSource = source?.ai_chat_history ?? source?.aiChatHistory;
  if (Array.isArray(structuredSource)) {
    const structuredEntries = structuredSource
      .map(normalizeStructuredEntry)
      .filter((entry): entry is AiChatHistoryEntry => entry !== null);

    if (structuredEntries.length > 0) {
      return structuredEntries;
    }
  }

  const legacySource = source?.chat_history ?? source?.chatHistory;
  if (!Array.isArray(legacySource)) {
    return [];
  }

  return legacySource
    .map((entry) => normalizePrompt(entry))
    .filter((entry): entry is string => entry !== null)
    .map((prompt) => ({
      prompt,
      referenceImageUrl: null,
      referenceImageName: null,
      createdAt: '',
    }));
}

export function getLegacyChatHistory(entries: AiChatHistoryEntry[]): string[] {
  return entries
    .map((entry) => normalizePrompt(entry.prompt))
    .filter((entry): entry is string => entry !== null);
}
