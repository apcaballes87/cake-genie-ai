import type { AvailabilityType } from '@/lib/utils/availability';

const AVAILABILITY_SENTENCES: Record<AvailabilityType, string> = {
  rush: 'This design is available for rush orders with preparation within 60 minutes.',
  'same-day': 'This design is available for same-day orders with 3 to 4 hours of preparation.',
  normal: 'This design requires at least one day of lead time.',
};

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
