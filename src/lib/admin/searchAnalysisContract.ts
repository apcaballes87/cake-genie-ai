import { ThinkingLevel, Type } from '@google/genai';

import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import {
  GENERATED_ANALYSIS_CAKE_THICKNESSES,
  GENERATED_ANALYSIS_CAKE_TYPES,
  GENERATED_ANALYSIS_CLASSIFICATIONS,
  GENERATED_ANALYSIS_COLOR_HEXES,
  GENERATED_ANALYSIS_COLOR_TYPES,
  GENERATED_ANALYSIS_ICING_BASES,
  GENERATED_ANALYSIS_MATERIALS,
  GENERATED_ANALYSIS_MESSAGE_POSITIONS,
  GENERATED_ANALYSIS_MESSAGE_TYPES,
  GENERATED_ANALYSIS_REJECTION_REASONS,
  GENERATED_ANALYSIS_SIZES,
  GENERATED_MAIN_TOPPER_TYPES,
  GENERATED_SUPPORT_ELEMENT_TYPES,
  mergeGeneratedAnalysisSubtypeMap,
  validateGeneratedCakeAnalysisResult,
  type GeneratedAnalysisTypeEnums,
  type GeneratedCakeAnalysisResult,
} from '@/lib/ai/generatedAnalysisContract';

export const SEARCH_ANALYSIS_REJECTION_REASONS = GENERATED_ANALYSIS_REJECTION_REASONS;
export const SEARCH_ANALYSIS_ICING_BASES = GENERATED_ANALYSIS_ICING_BASES;
export const SEARCH_ANALYSIS_COLOR_TYPES = GENERATED_ANALYSIS_COLOR_TYPES;

export function buildSearchAnalysisResponseSchema(typeEnums: GeneratedAnalysisTypeEnums) {
  const mainTopperTypes = typeEnums.mainTopperTypes.filter(
    (type) => GENERATED_MAIN_TOPPER_TYPES.includes(type as never),
  );
  const supportElementTypes = typeEnums.supportElementTypes.filter(
    (type) => GENERATED_SUPPORT_ELEMENT_TYPES.includes(type as never),
  );
  const subtypes = [...new Set(
    Object.values(mergeGeneratedAnalysisSubtypeMap(typeEnums.subtypesByType)).flat(),
  )];
  const subtypeProperty = subtypes.length
    ? { subtype: { type: Type.STRING, enum: subtypes } }
    : {};

  return {
    type: Type.OBJECT,
    properties: {
      cakeType: { type: Type.STRING, enum: ['', ...GENERATED_ANALYSIS_CAKE_TYPES] },
      cakeThickness: { type: Type.STRING, enum: ['', ...GENERATED_ANALYSIS_CAKE_THICKNESSES] },
      main_toppers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: mainTopperTypes },
            material: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MATERIALS] },
            group_id: { type: Type.STRING },
            classification: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_CLASSIFICATIONS] },
            size: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_SIZES] },
            quantity: { type: Type.INTEGER },
            description: { type: Type.STRING },
            color: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            },
            ...subtypeProperty,
          },
          required: ['type', 'material', 'group_id', 'classification', 'size', 'quantity', 'description'],
        },
      },
      support_elements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: supportElementTypes },
            material: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MATERIALS] },
            group_id: { type: Type.STRING },
            color: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            },
            size: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_SIZES] },
            quantity: { type: Type.INTEGER },
            description: { type: Type.STRING },
            ...subtypeProperty,
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
            type: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MESSAGE_TYPES] },
            color: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            position: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MESSAGE_POSITIONS] },
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
                enum: [...GENERATED_ANALYSIS_COLOR_HEXES],
                description: 'REQUIRED. Customer-facing dominant color. The swatch filter reads this. Must be a hex from the approved palette. See CATEGORY 5 side color rules.',
              },
              top: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
              gumpasteBaseBoardColor: {
                type: Type.STRING,
                enum: [...GENERATED_ANALYSIS_COLOR_HEXES],
              },
            },
            required: ['side', 'top'],
          },
          drip: { type: Type.BOOLEAN }, border_top: { type: Type.BOOLEAN },
          border_base: { type: Type.BOOLEAN },
          gumpasteBaseBoard: {
            type: Type.BOOLEAN,
            description: 'REQUIRED. True only when visual construction cues show that the cake board surface is fully or mostly covered by one continuous fondant/gumpaste layer. Board color alone does not decide this.',
          },
        },
        required: [
          'base',
          'color_type',
          'colors',
          'drip',
          'border_top',
          'border_base',
          'gumpasteBaseBoard',
        ],
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
            enum: ['', ...SEARCH_ANALYSIS_REJECTION_REASONS],
          },
          message: { type: Type.STRING },
        },
        required: ['isRejected', 'reason', 'message'],
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

export function buildSearchAnalysisGenerationConfig(typeEnums: GeneratedAnalysisTypeEnums) {
  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    responseSchema: buildSearchAnalysisResponseSchema(typeEnums),
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  };
}

export function postProcessSearchAnalysisResult(
  result: unknown,
  typeEnums: GeneratedAnalysisTypeEnums,
): GeneratedCakeAnalysisResult {
  return validateGeneratedCakeAnalysisResult(result, typeEnums);
}
