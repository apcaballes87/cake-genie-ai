import type { AvailabilityType } from '@/lib/utils/availability';
import type { HybridAnalysisResult } from '@/types';
import { generateDesignDetails, isGenericDesignDescription } from '@/utils/designContentUtils';

export const AVAILABILITY_SENTENCES: Record<AvailabilityType, string> = {
  rush: 'This design is available for rush orders with preparation within 60 minutes.',
  'same-day': 'This design is available for same-day orders with 3 to 4 hours of preparation.',
  normal: 'This design requires at least one day of lead time.',
};

export const MIN_STORED_SEO_DESCRIPTION_WORDS = 130;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function sentenceKey(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAvailabilitySentences(text: string): string {
  let stripped = text.trim();

  for (const sentence of Object.values(AVAILABILITY_SENTENCES)) {
    stripped = stripped.replace(sentence, '').trim();
  }

  return stripped.replace(/\s+/g, ' ').trim();
}

export function appendAvailabilitySentence(
  description: string,
  availability: AvailabilityType,
): string {
  const base = description.trim();
  const sentence = AVAILABILITY_SENTENCES[availability];

  if (!base) return sentence;
  if (base.includes(sentence)) return base;

  return `${base.replace(/\s+$/, '')} ${sentence}`;
}

export function enrichStoredSeoDescription(input: {
  analysisResult: HybridAnalysisResult;
  availability: AvailabilityType;
  keywords?: string | null;
  rawDescription?: string | null;
  tags?: string[] | null;
}): string {
  const {
    analysisResult,
    availability,
    keywords,
    rawDescription,
    tags,
  } = input;

  const designContext = {
    analysis_json: analysisResult,
    availability,
    keywords: keywords || analysisResult.keyword || 'custom',
    tags: tags || analysisResult.tags || [],
  };
  const generatedDescription = stripAvailabilitySentences(generateDesignDetails(designContext));
  const cleanedRawDescription = stripAvailabilitySentences(rawDescription || '');
  const baseDescription = !isGenericDesignDescription(cleanedRawDescription)
    ? cleanedRawDescription
    : generatedDescription;

  const mergedSentences = splitSentences(baseDescription);
  const seenSentenceKeys = new Set(mergedSentences.map(sentenceKey));

  if (countWords(baseDescription) < MIN_STORED_SEO_DESCRIPTION_WORDS) {
    for (const sentence of splitSentences(generatedDescription)) {
      const key = sentenceKey(sentence);
      if (!key || seenSentenceKeys.has(key)) continue;

      mergedSentences.push(sentence);
      seenSentenceKeys.add(key);

      if (countWords(mergedSentences.join(' ')) >= MIN_STORED_SEO_DESCRIPTION_WORDS) {
        break;
      }
    }
  }

  const enrichedDescription = mergedSentences.join(' ').trim() || generatedDescription;
  return appendAvailabilitySentence(enrichedDescription, availability);
}
