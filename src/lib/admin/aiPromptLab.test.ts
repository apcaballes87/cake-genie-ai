import { describe, expect, it } from 'vitest';

import {
  AI_PROMPT_LAB_DECODE,
  AI_PROMPT_LAB_MODEL,
  AI_PROMPT_LAB_THINKING_LEVEL,
  AiPromptLabError,
  isAiPromptLabProductionEquivalent,
  validateAiPromptLabRequest,
} from './aiPromptLab';
import {
  TWO_STEP_SCHEMA_COMPILER_PROMPT,
  TWO_STEP_V385_MODE,
  TWO_STEP_VISUAL_INVENTORY_PROMPT,
} from './twoStepCakeAnalysis';

const validRequest = {
  image: { data: Buffer.from('small image').toString('base64'), mimeType: 'image/png' },
  prompt: { sourceVersion: 'v3.84', text: 'Analyze this cake.' },
  settings: { model: AI_PROMPT_LAB_MODEL, thinkingLevel: AI_PROMPT_LAB_THINKING_LEVEL, ...AI_PROMPT_LAB_DECODE },
};

describe('AI Prompt Lab request validation', () => {
  it('accepts the configured Flash models and only their supported thinking levels', () => {
    expect(validateAiPromptLabRequest(validRequest)).toMatchObject({
      mimeType: 'image/png',
      sourceVersion: 'v3.84',
      promptText: 'Analyze this cake.',
    });
    expect(validateAiPromptLabRequest({
      ...validRequest,
      settings: { ...AI_PROMPT_LAB_DECODE, model: 'gemini-2.5-flash', thinkingLevel: 'HIGH' },
    })).toMatchObject({ model: 'gemini-2.5-flash', thinkingLevel: 'HIGH' });
    expect(validateAiPromptLabRequest({
      ...validRequest,
      settings: { ...AI_PROMPT_LAB_DECODE, model: 'gemini-3.1-flash-lite', thinkingLevel: 'MINIMAL' },
    })).toMatchObject({ model: 'gemini-3.1-flash-lite', thinkingLevel: 'MINIMAL' });
  });

  it.each([
    ['model', 'gemini-1.5-flash'],
    ['thinkingLevel', 'NONE'],
    ['temperature', 0.2],
    ['topP', 0.5],
    ['topK', 2],
  ])('rejects unsupported %s', (field, value) => {
    const request = structuredClone(validRequest);
    (request.settings as Record<string, unknown>)[field] = value;
    expect(() => validateAiPromptLabRequest(request)).toThrow(AiPromptLabError);
  });

  it('rejects unsupported image types and data URLs', () => {
    expect(() => validateAiPromptLabRequest({
      ...validRequest,
      image: { data: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
    })).toThrow(/base64/i);
    expect(() => validateAiPromptLabRequest({
      ...validRequest,
      image: { data: validRequest.image.data, mimeType: 'image/gif' },
    })).toThrow(/JPEG, PNG, and WebP/i);
  });

  it('uses the runtime production path only for the unchanged active production configuration', () => {
    const input = validateAiPromptLabRequest({
      ...validRequest,
      prompt: { sourceVersion: 'v3.83', text: 'Analyze this cake.' },
    });
    const activePrompt = { id: 'prompt-1', version: 'v3.83', text: 'Analyze this cake.', checksum: 'checksum', isActive: true };

    expect(isAiPromptLabProductionEquivalent(input, activePrompt)).toBe(true);
    expect(isAiPromptLabProductionEquivalent({ ...input, promptText: 'Edited prompt.' }, activePrompt)).toBe(false);
    expect(isAiPromptLabProductionEquivalent({ ...input, model: 'gemini-2.5-flash' }, activePrompt)).toBe(false);
    expect(isAiPromptLabProductionEquivalent(input, { ...activePrompt, isActive: false })).toBe(false);
  });

  it('accepts a complete two-step request only for the v3.85 target contract', () => {
    expect(validateAiPromptLabRequest({
      ...validRequest,
      mode: TWO_STEP_V385_MODE,
      prompt: { sourceVersion: 'v3.85', text: '' },
      twoStep: { inventoryPrompt: TWO_STEP_VISUAL_INVENTORY_PROMPT, compilerPrompt: TWO_STEP_SCHEMA_COMPILER_PROMPT },
    })).toMatchObject({
      mode: TWO_STEP_V385_MODE,
      sourceVersion: 'v3.85',
      twoStep: { inventoryPrompt: TWO_STEP_VISUAL_INVENTORY_PROMPT, compilerPrompt: TWO_STEP_SCHEMA_COMPILER_PROMPT },
    });

    expect(() => validateAiPromptLabRequest({
      ...validRequest,
      mode: TWO_STEP_V385_MODE,
      prompt: { sourceVersion: 'v3.84', text: '' },
      twoStep: { inventoryPrompt: TWO_STEP_VISUAL_INVENTORY_PROMPT, compilerPrompt: TWO_STEP_SCHEMA_COMPILER_PROMPT },
    })).toThrow(/pinned to v3\.85/);

    expect(() => validateAiPromptLabRequest({
      ...validRequest,
      mode: TWO_STEP_V385_MODE,
      prompt: { sourceVersion: 'v3.85', text: '' },
      twoStep: { inventoryPrompt: '', compilerPrompt: TWO_STEP_SCHEMA_COMPILER_PROMPT },
    })).toThrow(/Both two-step prompts are required/);
  });

  it('accepts grid sizing for both one-pass and two-step lab requests', () => {
    expect(validateAiPromptLabRequest({
      ...validRequest,
      gridSizing: true,
    })).toMatchObject({ gridSizing: true, mode: 'one_pass' });

    expect(validateAiPromptLabRequest({
      ...validRequest,
      gridSizing: true,
      mode: TWO_STEP_V385_MODE,
      prompt: { sourceVersion: 'v3.85', text: '' },
      twoStep: { inventoryPrompt: TWO_STEP_VISUAL_INVENTORY_PROMPT, compilerPrompt: TWO_STEP_SCHEMA_COMPILER_PROMPT },
    })).toMatchObject({ gridSizing: true, mode: TWO_STEP_V385_MODE });

    expect(() => validateAiPromptLabRequest({
      ...validRequest,
      gridSizing: true,
      useDiameterAnchorSizing: true,
    })).toThrow(/already owns/);
  });
});
