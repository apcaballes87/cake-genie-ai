import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/client', () => ({ getAI: vi.fn() }));
vi.mock('@/lib/admin/aiPromptLabPricing', () => ({ runAiPromptLabPricing: vi.fn() }));
vi.mock('@/lib/ai/utils', () => ({ getDynamicTypeEnums: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/admin/searchAnalysisContract', () => ({
  buildSearchAnalysisGenerationConfig: vi.fn(() => ({})),
  getAnalysisGenerationSizeSchema: vi.fn(() => 'line_ratio_v1'),
  postProcessSearchAnalysisResult: vi.fn((value) => value),
}));
vi.mock('@/lib/ai/generatedAnalysisContract', () => ({ isRejectedGeneratedCakeAnalysis: vi.fn((value) => value?.rejection?.isRejected === true) }));
vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: vi.fn(() => ({ from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [{ prompt_id: 'active', version: 'v9.1', is_active: true, prompt_text: 'Analyze the cake.' }], error: null }) }) }) }) })),
}));

import { getAI } from '@/lib/ai/client';
import { runAiPromptLabPricing } from '@/lib/admin/aiPromptLabPricing';
import { AI_PROMPT_LAB_DECODE, AI_PROMPT_LAB_MODEL, AI_PROMPT_LAB_THINKING_LEVEL, runAiPromptLabAnalysis } from './aiPromptLab';
import { ONE_PASS_GEOMETRY_REFINED_MODE, ONE_PASS_GEOMETRY_REFINEMENT_PROMPT } from './onePassGeometryRefinement';

const request = {
  image: { data: Buffer.from('small image').toString('base64'), mimeType: 'image/png' },
  prompt: { sourceVersion: 'v9.1', text: 'Analyze the cake.' },
  mode: ONE_PASS_GEOMETRY_REFINED_MODE,
  onePassGeometryRefinement: { geometryPrompt: ONE_PASS_GEOMETRY_REFINEMENT_PROMPT },
  settings: { model: AI_PROMPT_LAB_MODEL, thinkingLevel: AI_PROMPT_LAB_THINKING_LEVEL, ...AI_PROMPT_LAB_DECODE },
};

const baseline = { rejection: { isRejected: false }, main_toppers: [{ group_id: 'hero', type: 'number_candle', description: 'Gold number candle.' }], support_elements: [] };
const geometry = {
  geometry_version: ONE_PASS_GEOMETRY_REFINED_MODE,
  cake_diameter_line: { start: [400, 100], end: [400, 900] },
  cake_height_line: { start: [400, 500], end: [850, 500] },
  elements: [{ element_id: 'main_toppers__hero', role: 'main_toppers', group_id: 'hero', type: 'number_candle', description: 'Gold number candle.', label: 'Main topper · number candle', box_2d: [100, 420, 390, 570], confidence: 0.95 }],
};

describe('Prompt Lab one-pass precise geometry execution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs baseline analysis then frozen-manifest geometry on the original image while retaining baseline pricing', async () => {
    const generateContent = vi.fn().mockResolvedValueOnce({ text: JSON.stringify(baseline) }).mockResolvedValueOnce({ text: JSON.stringify(geometry) });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);
    vi.mocked(runAiPromptLabPricing).mockResolvedValue({ total: 1234 } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[0][0].contents[0].parts).toEqual(expect.arrayContaining([expect.objectContaining({ inlineData: { mimeType: 'image/png', data: request.image.data } })]));
    expect(generateContent.mock.calls[1][0].contents[0].parts).toEqual(expect.arrayContaining([expect.objectContaining({ inlineData: { mimeType: 'image/png', data: request.image.data } }), expect.objectContaining({ text: expect.stringContaining('main_toppers__hero') })]));
    expect(result).toMatchObject({ analysis: { main_toppers: baseline.main_toppers }, geometry, pricing: { total: 1234 }, validationErrors: [], prompt: { executionMode: ONE_PASS_GEOMETRY_REFINED_MODE } });
    expect(runAiPromptLabPricing).toHaveBeenCalledWith(expect.objectContaining({ main_toppers: baseline.main_toppers }));
  });

  it('keeps validated analysis and baseline pricing when geometry is malformed', async () => {
    const generateContent = vi.fn().mockResolvedValueOnce({ text: JSON.stringify(baseline) }).mockResolvedValueOnce({ text: JSON.stringify({ ...geometry, elements: [] }) });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);
    vi.mocked(runAiPromptLabPricing).mockResolvedValue({ total: 1234 } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(result).toMatchObject({ analysis: { main_toppers: baseline.main_toppers }, geometry: null, pricing: { total: 1234 }, rawGeometryResponse: expect.any(String) });
    expect(result.validationErrors).toEqual(expect.arrayContaining([expect.stringMatching(/cover every frozen/i)]));
  });

  it('retains a rejected baseline response and does not request geometry', async () => {
    const rejected = { rejection: { isRejected: true }, main_toppers: [], support_elements: [] };
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(rejected) });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ analysis: rejected, geometry: null, pricing: null, geometrySkipReason: expect.stringMatching(/rejected/i) });
  });

  it('skips geometry when a valid baseline has no priced rows', async () => {
    const noRows = { rejection: { isRejected: false }, main_toppers: [], support_elements: [] };
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(noRows) });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);
    vi.mocked(runAiPromptLabPricing).mockResolvedValue({ total: 500 } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ analysis: noRows, geometry: null, pricing: { total: 500 }, geometrySkipReason: expect.stringMatching(/no priced/i) });
  });
});
