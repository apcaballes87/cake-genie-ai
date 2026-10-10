import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/client', () => ({ getAI: vi.fn() }));
vi.mock('@/lib/admin/aiPromptLabPricing', () => ({ runAiPromptLabPricing: vi.fn() }));

import { getAI } from '@/lib/ai/client';
import { runAiPromptLabPricing } from '@/lib/admin/aiPromptLabPricing';
import { AI_PROMPT_LAB_DECODE, AI_PROMPT_LAB_MODEL, AI_PROMPT_LAB_THINKING_LEVEL, runAiPromptLabAnalysis } from './aiPromptLab';
import { BOUNDING_BOX_GEOMETRY_PROMPT, BOUNDING_BOX_IDENTIFICATION_PROMPT, TWO_STEP_BOUNDING_BOXES_MODE } from './twoStepBoundingBoxDetector';

const request = {
  image: { data: Buffer.from('small image').toString('base64'), mimeType: 'image/png' },
  prompt: { sourceVersion: '', text: '' },
  mode: TWO_STEP_BOUNDING_BOXES_MODE,
  twoStepBoundingBoxes: { identificationPrompt: BOUNDING_BOX_IDENTIFICATION_PROMPT, boundingBoxPrompt: BOUNDING_BOX_GEOMETRY_PROMPT },
  settings: { model: AI_PROMPT_LAB_MODEL, thinkingLevel: AI_PROMPT_LAB_THINKING_LEVEL, ...AI_PROMPT_LAB_DECODE },
};

const acceptedIdentification = JSON.stringify({
  identification_version: TWO_STEP_BOUNDING_BOXES_MODE,
  elements: [{ element_id: 'gold_number', label: 'Gold number candle', category: 'candle', description: 'Gold candle on top.', belongs_to_cake_design: true, visible_count: 1 }],
  rejection: { isRejected: false, reason: '', message: '' },
});
const validGeometry = JSON.stringify({
  geometry_version: TWO_STEP_BOUNDING_BOXES_MODE,
  cake_diameter_line: { start: [400, 150], end: [400, 850] }, cake_height_line: { start: [400, 500], end: [900, 500] },
  toppers: [{ element_id: 'gold_number', label: 'Gold number candle', category: 'candle', box_2d: [100, 400, 390, 600], confidence: 0.9 }],
});

describe('Prompt Lab bounding-box detector execution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs two image calls, binds geometry to Step 1, and never prices', async () => {
    const generateContent = vi.fn().mockResolvedValueOnce({ text: acceptedIdentification }).mockResolvedValueOnce({ text: validGeometry });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(result).toMatchObject({ analysis: null, pricing: null, validationErrors: [], prompt: { executionMode: TWO_STEP_BOUNDING_BOXES_MODE } });
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[0][0].contents[0].parts).toEqual(expect.arrayContaining([expect.objectContaining({ inlineData: { mimeType: 'image/png', data: request.image.data } })]));
    expect(generateContent.mock.calls[1][0].contents[0].parts).toEqual(expect.arrayContaining([expect.objectContaining({ inlineData: { mimeType: 'image/png', data: request.image.data } }), expect.objectContaining({ text: expect.stringContaining('gold_number') })]));
    expect(runAiPromptLabPricing).not.toHaveBeenCalled();
  });

  it('retains raw Step 1 data and skips geometry when the image is rejected', async () => {
    const rejected = JSON.stringify({ identification_version: TWO_STEP_BOUNDING_BOXES_MODE, elements: [], rejection: { isRejected: true, reason: 'multiple cakes', message: 'Use a single cake.' } });
    const generateContent = vi.fn().mockResolvedValue({ text: rejected });
    vi.mocked(getAI).mockResolvedValue({ models: { generateContent } } as never);

    const result = await runAiPromptLabAnalysis(request);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ rawIdentificationResponse: rejected, rawBoundingBoxResponse: null, geometry: null, analysis: null, pricing: null });
  });
});
