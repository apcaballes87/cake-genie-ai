import { describe, expect, it } from 'vitest';
import { buildKnowledgeBase, buildSystemPrompt } from '@/lib/chatbot/knowledge';

describe('buildKnowledgeBase', () => {
  const kb = buildKnowledgeBase([
    { slug: 'minimalist-cake', name: 'Minimalist Cake' },
    { slug: 'dinosaur-cake', name: 'Dinosaur Cake' },
  ]);

  it('uses the owner-confirmed business rules', () => {
    expect(kb).toContain('Lapu-Lapu City: ₱200');
    expect(kb).toMatch(/Cavite.*PICKUP ONLY/s);
    expect(kb).toContain('before 4 PM');
    expect(kb).toMatch(/Mocha is NOT available/);
    expect(kb).toContain('₱400');
    expect(kb).toContain('8" round, 4" tall');
  });

  it('gives the bot the price list, ordering steps, and image pricing', () => {
    expect(kb).toContain('https://genie.ph/price-list');
    expect(kb).toContain('https://genie.ph/how-to-order');
    expect(kb).toMatch(/send the cake photo right here in this chat/);
  });

  it('lists featured and database collection links', () => {
    expect(kb).toContain('https://genie.ph/collections/minimalist-cake');
    expect(kb).toContain('dinosaur-cake = Dinosaur Cake');
  });

  it('falls back to the collections index when none are loaded', () => {
    expect(buildKnowledgeBase()).toContain('https://genie.ph/collections');
  });

  it('puts the knowledge base inside the system prompt', () => {
    expect(buildSystemPrompt()).toContain('Genie.ph facts');
  });
});
