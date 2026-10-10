import { describe, expect, it } from 'vitest';

import {
  AI_PROMPT_LAB_DECODE,
  AI_PROMPT_LAB_MODEL,
  AI_PROMPT_LAB_THINKING_LEVEL,
  AiPromptLabError,
  isAiPromptLabProductionEquivalent,
  splitGridSizingResponse,
  validateAiPromptLabRequest,
} from './aiPromptLab';
import {
  TWO_STEP_SCHEMA_COMPILER_PROMPT,
  TWO_STEP_V385_MODE,
  TWO_STEP_VISUAL_INVENTORY_PROMPT,
} from './twoStepCakeAnalysis';
import { BOUNDING_BOX_GEOMETRY_PROMPT, BOUNDING_BOX_IDENTIFICATION_PROMPT, TWO_STEP_BOUNDING_BOXES_MODE } from './twoStepBoundingBoxDetector';
import { ONE_PASS_GEOMETRY_REFINED_MODE, ONE_PASS_GEOMETRY_REFINEMENT_PROMPT } from './onePassGeometryRefinement';
import { ONE_PASS_GEOMETRY_COMBINED_MODE, ONE_PASS_GEOMETRY_COMBINED_PROMPT } from './onePassGeometryCombined';

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

  it('accepts editable decoding settings and returns them to the execution layer', () => {
    expect(validateAiPromptLabRequest({
      ...validRequest,
      settings: { ...validRequest.settings, temperature: 0.5, topP: 0.9, topK: 20 },
    })).toMatchObject({ decoding: { temperature: 0.5, topP: 0.9, topK: 20 } });
  });

  it.each([
    ['model', 'gemini-1.5-flash'],
    ['thinkingLevel', 'NONE'],
    ['temperature', -0.1],
    ['temperature', 2.1],
    ['topP', -0.1],
    ['topP', 1.1],
    ['topK', 0],
    ['topK', 1.5],
    ['topK', 101],
  ])('rejects invalid %s', (field, value) => {
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
    expect(isAiPromptLabProductionEquivalent({
      ...input,
      decoding: { temperature: 0.5, topP: 0.9, topK: 20 },
    }, activePrompt)).toBe(false);
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

  it('accepts the Cartesian plane as the second coordinate sizing option', () => {
    expect(validateAiPromptLabRequest({
      ...validRequest,
      sizingMode: 'cartesian_4q',
    })).toMatchObject({ sizingMode: 'cartesian_4q', gridSizing: false });
  });

  it('accepts an explicit no-overlay one-pass request', () => {
    expect(validateAiPromptLabRequest({ ...validRequest, sizingMode: 'none' })).toMatchObject({
      mode: 'one_pass',
      sizingMode: null,
      gridSizing: false,
    });
  });

  it('keeps the bounding-box detector independent from source prompts and coordinate sizing', () => {
    const request = {
      image: validRequest.image,
      prompt: { sourceVersion: '', text: '' },
      mode: TWO_STEP_BOUNDING_BOXES_MODE,
      twoStepBoundingBoxes: { identificationPrompt: BOUNDING_BOX_IDENTIFICATION_PROMPT, boundingBoxPrompt: BOUNDING_BOX_GEOMETRY_PROMPT },
      settings: validRequest.settings,
    };
    expect(validateAiPromptLabRequest(request)).toMatchObject({ mode: TWO_STEP_BOUNDING_BOXES_MODE, sourceVersion: '', twoStepBoundingBoxes: request.twoStepBoundingBoxes });
    expect(() => validateAiPromptLabRequest({ ...request, sizingMode: 'grid_20' })).toThrow(/cannot use coordinate sizing/i);
    expect(() => validateAiPromptLabRequest({ ...request, useDiameterAnchorSizing: true })).toThrow(/cannot use coordinate sizing/i);
    expect(() => validateAiPromptLabRequest({ ...request, twoStepBoundingBoxes: { identificationPrompt: '', boundingBoxPrompt: BOUNDING_BOX_GEOMETRY_PROMPT } })).toThrow(/Both bounding-box detector prompts/i);
  });

  it('keeps one-pass precise geometry separate from grid, Cartesian, and diameter-anchor sizing', () => {
    const request = {
      ...validRequest,
      mode: ONE_PASS_GEOMETRY_REFINED_MODE,
      onePassGeometryRefinement: { geometryPrompt: ONE_PASS_GEOMETRY_REFINEMENT_PROMPT },
    };
    expect(validateAiPromptLabRequest(request)).toMatchObject({
      mode: ONE_PASS_GEOMETRY_REFINED_MODE,
      sizingMode: null,
      onePassGeometryRefinement: { geometryPrompt: ONE_PASS_GEOMETRY_REFINEMENT_PROMPT },
    });
    expect(() => validateAiPromptLabRequest({ ...request, sizingMode: 'grid_20' })).toThrow(/cannot use grid/i);
    expect(() => validateAiPromptLabRequest({ ...request, useDiameterAnchorSizing: true })).toThrow(/cannot use grid/i);
  });

  it('keeps true one-pass geometry separate from grid, Cartesian, and diameter-anchor sizing', () => {
    const request = {
      ...validRequest,
      mode: ONE_PASS_GEOMETRY_COMBINED_MODE,
      prompt: { sourceVersion: 'v3.84', text: ONE_PASS_GEOMETRY_COMBINED_PROMPT },
    };
    expect(validateAiPromptLabRequest(request)).toMatchObject({ mode: ONE_PASS_GEOMETRY_COMBINED_MODE, sizingMode: null, onePassGeometryCombined: { promptText: ONE_PASS_GEOMETRY_COMBINED_PROMPT } });
    expect(() => validateAiPromptLabRequest({ ...request, sizingMode: 'grid_20' })).toThrow(/true one-pass geometry/i);
    expect(() => validateAiPromptLabRequest({ ...request, useDiameterAnchorSizing: true })).toThrow(/true one-pass geometry/i);
  });

  it('keeps the raw one-pass grid geometry as the displayed and priced authority', () => {
    const result = splitGridSizingResponse({
      grid_sizing: {
        version: 'grid_sizing_v2',
        cake_top_diameter: { start: { x: 4, y: 8 }, end: { x: 16, y: 8 } },
        cake_top_height: { start: { x: 5, y: 8 }, end: { x: 5, y: 12 } },
      },
      main_toppers: [{
        group_id: 'hero',
        description: 'Hero topper',
        grid_sizing: { bbox: { top_left: { x: 5, y: 7 }, bottom_right: { x: 9, y: 13 } } },
      }],
      support_elements: [],
      cake_messages: [{
        text: 'Happy Birthday', type: 'cardstock', color: '#000000', position: 'top',
        bbox: { x: 2, y: 3, width: 4, height: 1 },
      }],
    });

    expect(result.gridSizing?.items).toEqual([expect.objectContaining({
      source_group_id: 'hero',
      bbox: { top_left: { x: 5, y: 7 }, bottom_right: { x: 9, y: 13 } },
    })]);
    expect(result.analysis.main_toppers).toEqual([{ group_id: 'hero', description: 'Hero topper' }]);
    expect(result.analysis.cake_messages).toEqual([{ text: 'Happy Birthday', type: 'cardstock', color: '#000000', position: 'top' }]);
  });
});
