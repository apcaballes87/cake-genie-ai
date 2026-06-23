import { ThinkingLevel, Type } from '@google/genai';

import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { CAKE_MESSAGE_TYPES } from '@/constants/pricingEnums';

type TypeEnums = {
  mainTopperTypes: string[];
  supportElementTypes: string[];
};

export const SEARCH_ANALYSIS_REJECTION_REASONS = [
  'not_a_cake',
  'multiple_cakes',
  'cake_slice_only',
  'complex_sculpture',
  'large_wedding_cake',
  'selfie',
  'payment_receipt',
] as const;

export const SEARCH_ANALYSIS_ICING_BASES = ['soft_icing', 'fondant'] as const;
export const SEARCH_ANALYSIS_COLOR_TYPES = ['single', 'gradient', 'multicolor'] as const;

export function buildSearchAnalysisResponseSchema(typeEnums: TypeEnums) {
  return {
    type: Type.OBJECT,
    properties: {
      cakeType: { type: Type.STRING },
      cakeThickness: { type: Type.STRING },
      main_toppers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: typeEnums.mainTopperTypes },
            material: { type: Type.STRING }, group_id: { type: Type.STRING },
            classification: { type: Type.STRING, enum: ['hero', 'support'] },
            size: { type: Type.STRING, enum: ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] },
            quantity: { type: Type.INTEGER }, digits: { type: Type.INTEGER },
            description: { type: Type.STRING },
          },
          required: ['type', 'material', 'group_id', 'classification', 'size', 'quantity', 'description'],
        },
      },
      support_elements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: typeEnums.supportElementTypes },
            material: { type: Type.STRING }, group_id: { type: Type.STRING },
            color: { type: Type.STRING }, colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            size: { type: Type.STRING, enum: ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] },
            quantity: { type: Type.INTEGER }, description: { type: Type.STRING },
          },
          required: ['type', 'material', 'group_id', 'color', 'size', 'quantity', 'description'],
        },
      },
      cake_messages: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            type: { type: Type.STRING, enum: [...CAKE_MESSAGE_TYPES] },
            color: { type: Type.STRING },
            position: { type: Type.STRING, enum: ['top', 'side', 'base_board'] },
          },
          required: ['text', 'type', 'color', 'position'],
        },
      },
      icing_design: {
        type: Type.OBJECT,
        properties: {
          base: { type: Type.STRING, enum: [...SEARCH_ANALYSIS_ICING_BASES] },
          color_type: { type: Type.STRING, enum: [...SEARCH_ANALYSIS_COLOR_TYPES] },
          colors: {
            type: Type.OBJECT,
            properties: {
              side: {
                type: Type.STRING,
                description: 'REQUIRED. Customer-facing dominant color. The swatch filter reads this. Must be a hex from the approved palette. See CATEGORY 5 side color rules.',
              },
              top: { type: Type.STRING },
              gumpasteBaseBoardColor: { type: Type.STRING },
            },
            required: process.env.ENFORCE_SIDE_COLOR === 'true' ? ['side'] : [],
          },
          drip: { type: Type.BOOLEAN }, border_top: { type: Type.BOOLEAN },
          border_base: { type: Type.BOOLEAN }, gumpasteBaseBoard: { type: Type.BOOLEAN },
        },
        required: ['base', 'color_type', 'colors'],
      },
      keyword: { type: Type.STRING },
      alt_text: {
        type: Type.STRING,
        description: 'One factual visual sentence, ideally 80-140 characters and never more than 160. Character and franchise names are allowed when visually relevant.',
      },
      seo_title: { type: Type.STRING, description: 'SEO optimized title for the cake product.' },
      seo_description: {
        type: Type.STRING,
        description: 'Natural customer-facing cake description in 5 to 7 sentences. Do not include availability or lead-time claims.',
      },
      rejection: {
        type: Type.OBJECT,
        properties: {
          isRejected: { type: Type.BOOLEAN },
          reason: {
            type: Type.STRING,
            enum: [...SEARCH_ANALYSIS_REJECTION_REASONS],
          },
          message: { type: Type.STRING },
        },
        required: ['isRejected', 'message'],
      },
    },
    required: [
      'cakeType',
      'cakeThickness',
      'main_toppers',
      'support_elements',
      'cake_messages',
      'icing_design',
      'keyword',
      'alt_text',
      'seo_title',
      'seo_description',
      'rejection',
    ],
  };
}

export function buildSearchAnalysisGenerationConfig(typeEnums: TypeEnums) {
  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    responseSchema: buildSearchAnalysisResponseSchema(typeEnums),
    temperature: 0,
    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
  };
}

export function postProcessSearchAnalysisResult<T extends object>(result: T): T {
  const mutableResult = result as T & Record<string, unknown>;
  delete mutableResult.is_tall_proportion;

  for (const key of ['main_toppers', 'support_elements', 'cake_messages']) {
    if (Array.isArray(mutableResult[key])) {
      (mutableResult[key] as Array<Record<string, unknown>>).forEach((item) => { item.x = 0; item.y = 0; });
    }
  }
  return result;
}
