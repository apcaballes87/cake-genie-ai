import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/client', () => ({ getAI: vi.fn() }));
vi.mock('@/lib/admin/aiPromptLabPricing', () => ({ runAiPromptLabPricing: vi.fn() }));
vi.mock('@/lib/ai/utils', () => ({ getDynamicTypeEnums: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/admin/searchAnalysisContract', () => ({
  buildSearchAnalysisGenerationConfig: vi.fn(() => ({})),
  buildSearchAnalysisResponseSchema: vi.fn(() => ({ type: 'OBJECT', properties: {}, required: [] })),
  getAnalysisGenerationSizeSchema: vi.fn(() => 'line_ratio_v1'),
  postProcessSearchAnalysisResult: vi.fn((value) => value),
}));
vi.mock('@/lib/ai/generatedAnalysisContract', () => ({ isRejectedGeneratedCakeAnalysis: vi.fn((value) => value?.rejection?.isRejected === true) }));
vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: vi.fn(() => ({ from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [{ prompt_id: 'active', version: 'v9.1', is_active: true, prompt_text: 'Analyze the cake.' }], error: null }) }) }) }) })),
}));

import { getAI } from '@/lib/ai/client';
import { runAiPromptLabPricing } from '@/lib/admin/aiPromptLabPricing';
import { postProcessSearchAnalysisResult } from '@/lib/admin/searchAnalysisContract';
import { AI_PROMPT_LAB_DECODE, AI_PROMPT_LAB_MODEL, AI_PROMPT_LAB_THINKING_LEVEL, runAiPromptLabAnalysis } from './aiPromptLab';
import { ONE_PASS_GEOMETRY_COMBINED_MODE, ONE_PASS_GEOMETRY_COMBINED_PROMPT } from './onePassGeometryCombined';

const request = {
  image: { data: Buffer.from('small image').toString('base64'), mimeType: 'image/png' },
  prompt: { sourceVersion: 'v9.1', text: `Analyze the cake.\n\n${ONE_PASS_GEOMETRY_COMBINED_PROMPT}` },
  mode: ONE_PASS_GEOMETRY_COMBINED_MODE,
  settings: { model: AI_PROMPT_LAB_MODEL, thinkingLevel: AI_PROMPT_LAB_THINKING_LEVEL, ...AI_PROMPT_LAB_DECODE },
};

const baseline = { rejection: { isRejected: false, reason: '', message: '' }, main_toppers: [{ group_id: 'hero', type: 'number_candle', description: 'Gold number candle.' }], support_elements: [] };
const geometry = {
  geometry_version: ONE_PASS_GEOMETRY_COMBINED_MODE,
  cake_diameter_line: { start: [400, 100], end: [400, 900] },
  cake_height_line: { start: [400, 500], end: [850, 500] },
  elements: [{ element_id: 'gold_number_candle', label: 'Gold number candle', category: 'candle', description: 'One gold number candle.', belongs_to_cake_design: true, visible_count: 1, box_2d: [100, 420, 390, 570], confidence: 0.95 }],
};

describe('Prompt Lab true one-pass geometry execution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('makes exactly one Gemini call with the original image and retains baseline pricing', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify({ analysis: baseline, geometry }) });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);
    vi.mocked(runAiPromptLabPricing).mockResolvedValue({ total: 1234 } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].contents[0].parts).toEqual(expect.arrayContaining([expect.objectContaining({ inlineData: { mimeType: 'image/png', data: request.image.data } })]));
    expect(result).toMatchObject({ analysis: baseline, geometry, pricing: { total: 1234 }, validationErrors: [], prompt: { executionMode: ONE_PASS_GEOMETRY_COMBINED_MODE }, stageTimings: { combinedMs: expect.any(Number) } });
    expect(generateContent.mock.calls[0][0].config).not.toHaveProperty('gridSizing');
  });

  it('keeps validated analysis and pricing when geometry fails validation', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify({ analysis: baseline, geometry: { ...geometry, cake_height_line: { start: [400, 800], end: [850, 800] } } }) });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);
    vi.mocked(runAiPromptLabPricing).mockResolvedValue({ total: 1234 } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ analysis: baseline, geometry: null, pricing: { total: 1234 }, rawCombinedResponse: expect.any(String) });
    expect(result.validationErrors).toEqual(expect.arrayContaining([expect.stringMatching(/front-center/i)]));
  });

  it('validates geometry independently when nested analysis is malformed', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify({ analysis: baseline, geometry }) });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);
    vi.mocked(postProcessSearchAnalysisResult).mockImplementationOnce(() => {
      throw new Error('Invalid generated cake analysis: support_elements[0].size: must be a string');
    });

    const result = await runAiPromptLabAnalysis(request);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ analysis: null, geometry, pricing: null, rawCombinedResponse: expect.any(String) });
    expect(result.validationErrors).toEqual(expect.arrayContaining([expect.stringMatching(/support_elements\[0\]\.size/i)]));
  });

  it('keeps rejected combined output without pricing or geometry', async () => {
    const rejected = { rejection: { isRejected: true, reason: 'multiple_cakes', message: 'Use one cake.' }, main_toppers: [], support_elements: [] };
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify({ analysis: rejected, geometry: { geometry_version: ONE_PASS_GEOMETRY_COMBINED_MODE, elements: [] } }) });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ analysis: rejected, geometry: { elements: [] }, pricing: null, validationErrors: [] });
  });
});
