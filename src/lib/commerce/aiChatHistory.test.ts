import { describe, expect, it } from 'vitest';
import { getLegacyChatHistory, normalizeAiChatHistory } from './aiChatHistory';

describe('aiChatHistory', () => {
  it('keeps structured AI chat history entries when present', () => {
    const result = normalizeAiChatHistory({
      ai_chat_history: [
        {
          prompt: 'make the side pink',
          referenceImageUrl: 'https://example.com/reference.webp',
          referenceImageName: 'pink-cake.webp',
          createdAt: '2026-07-05T10:00:00.000Z',
        },
      ],
      chat_history: ['legacy prompt'],
    });

    expect(result).toEqual([
      {
        prompt: 'make the side pink',
        referenceImageUrl: 'https://example.com/reference.webp',
        referenceImageName: 'pink-cake.webp',
        createdAt: '2026-07-05T10:00:00.000Z',
      },
    ]);
  });

  it('falls back to legacy prompt-only history when structured history is absent', () => {
    const result = normalizeAiChatHistory({
      chat_history: [' add bows ', '', 'change the color to blue'],
    });

    expect(result).toEqual([
      {
        prompt: 'add bows',
        referenceImageUrl: null,
        referenceImageName: null,
        createdAt: '',
      },
      {
        prompt: 'change the color to blue',
        referenceImageUrl: null,
        referenceImageName: null,
        createdAt: '',
      },
    ]);
  });

  it('derives the legacy prompt mirror from structured entries', () => {
    expect(
      getLegacyChatHistory([
        {
          prompt: 'add sprinkles',
          referenceImageUrl: null,
          referenceImageName: null,
          createdAt: '2026-07-05T10:00:00.000Z',
        },
        {
          prompt: ' change topper to butterfly ',
          referenceImageUrl: 'https://example.com/butterfly.webp',
          referenceImageName: 'butterfly.webp',
          createdAt: '2026-07-05T10:01:00.000Z',
        },
      ]),
    ).toEqual(['add sprinkles', 'change topper to butterfly']);
  });
});
