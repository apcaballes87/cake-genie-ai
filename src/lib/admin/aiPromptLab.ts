import { createHash } from 'node:crypto';

import { AI_REQUEST_TIMEOUT_MS } from '@/lib/ai/analyzeCakeImage';
import {
  buildSearchAnalysisGenerationConfig,
  getAnalysisGenerationSizeSchema,
  postProcessSearchAnalysisResult,
} from '@/lib/admin/searchAnalysisContract';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { getAI } from '@/lib/ai/client';
import { getDynamicTypeEnums } from '@/lib/ai/utils';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { loadFallbackAnalysisPrompt } from '@/services/prompts/promptLoader';
import { isRejectedGeneratedCakeAnalysis } from '@/lib/ai/generatedAnalysisContract';
import { AI_THREE_BAND_SIZE_SCHEMA, INTEGRATED_BBOX_ANALYSIS_SIZE_SCHEMA } from '@/lib/ai/analysisSize';
import { runAiPromptLabPricing } from '@/lib/admin/aiPromptLabPricing';
import {
  assertCompiledAnalysisMatchesInventory,
  TWO_STEP_SCHEMA_COMPILER_PROMPT,
  TWO_STEP_V385_MODE,
  TWO_STEP_V385_TARGET_CHECKSUM,
  TWO_STEP_V385_TARGET_VERSION,
  TWO_STEP_VISUAL_INVENTORY_PROMPT,
  textOnlyCompilerRequestParts,
  validateVisualInventory,
  visualInventoryRequestParts,
  visualInventoryResponseSchema,
  type VisualInventory,
} from '@/lib/admin/twoStepCakeAnalysis';
import {
  GRID_SIZING_MODE,
  GRID_SIZING_EDITABLE_PROMPT,
  GRID_SIZING_OUTPUT_RULES,
  GRID_SIZING_PROMPT_MARKER_END,
  GRID_SIZING_PROMPT_MARKER_START,
  CARTESIAN_SIZING_EDITABLE_PROMPT,
  CARTESIAN_SIZING_MODE,
  CARTESIAN_SIZING_OUTPUT_RULES,
  CARTESIAN_SIZING_PROMPT,
  CARTESIAN_SIZING_PROMPT_MARKER_END,
  CARTESIAN_SIZING_PROMPT_MARKER_START,
  GRID_SIZING_ANCHOR_LOCATOR_PROMPT,
  addGridSizingToResponseSchema,
  appendGridSizingPrompt,
  appendGridSizingSystemRules,
  applyGridSizingToAnalysis,
  assertGridSizingPreserved,
  buildGridSizingPayload,
  buildGridSizingPayloadFromCalibratedLocator,
  createGridOverlay,
  createCartesianOverlay,
  gridSizingAnchorLocatorResponseSchema,
  gridSizingRowLocatorPrompt,
  gridSizingRowLocatorResponseSchema,
  type GridSizingBinding,
  type GridSizingPayload,
  type CoordinateSizingMode,
} from '@/lib/admin/gridSizing';
import { ThinkingLevel } from '@google/genai';
import {
  BOUNDING_BOX_GEOMETRY_PROMPT,
  BOUNDING_BOX_IDENTIFICATION_PROMPT,
  TWO_STEP_BOUNDING_BOXES_MODE,
  detectorGeometryRequestParts,
  detectorGeometryResponseSchema,
  detectorIdentificationRequestParts,
  detectorIdentificationResponseSchema,
  validateDetectorGeometry,
  validateDetectorIdentification,
  type DetectorGeometry,
  type DetectorIdentification,
} from '@/lib/admin/twoStepBoundingBoxDetector';
import {
  ONE_PASS_GEOMETRY_REFINED_MODE,
  ONE_PASS_GEOMETRY_REFINEMENT_PROMPT,
  buildRefinedGeometryManifest,
  refinedGeometryRequestParts,
  refinedGeometryResponseSchema,
  validateRefinedGeometry,
  type RefinedGeometry,
  type RefinedGeometryManifest,
} from '@/lib/admin/onePassGeometryRefinement';
import {
  ONE_PASS_GEOMETRY_COMBINED_MODE,
  ONE_PASS_GEOMETRY_COMBINED_PROMPT,
  attachCombinedGeometryToAnalysis,
  combinedGeometryRequestParts,
  combinedGeometryResponseSchema,
  validateOnePassGeometryCombinedResponse,
  type CombinedGeometry,
} from '@/lib/admin/onePassGeometryCombined';

export const AI_PROMPT_LAB_MODEL = 'gemini-3.5-flash-lite' as const;
export const AI_PROMPT_LAB_THINKING_LEVEL = 'LOW' as const;
export const AI_PROMPT_LAB_DECODE = { temperature: 0, topP: 1, topK: 1 } as const;
export type AiPromptLabDecoding = {
  temperature: number;
  topP: number;
  topK: number;
};
export const AI_PROMPT_LAB_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const AI_PROMPT_LAB_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const CAKE_ANALYSIS_LAB_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
] as const;
type CakeAnalysisModel = (typeof CAKE_ANALYSIS_LAB_MODELS)[number];
type CakeAnalysisThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

export type LabPromptRecord = {
  id: string;
  version: string;
  isActive: boolean;
  text: string;
  checksum: string;
};

class CakeAnalysisResponseError extends Error {
  constructor(message: string, public readonly rawResponse: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CakeAnalysisResponseError';
  }
}

/** Only Flash text/vision models already exercised by this Vertex project. */
export const AI_PROMPT_LAB_THINKING_LEVELS: Record<CakeAnalysisModel, readonly CakeAnalysisThinkingLevel[]> = {
  'gemini-3.5-flash-lite': ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'],
  'gemini-3.1-flash-lite': ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'],
  'gemini-2.5-flash': ['LOW', 'MEDIUM', 'HIGH'],
};

const THINKING_LEVELS: Record<CakeAnalysisThinkingLevel, ThinkingLevel> = {
  MINIMAL: ThinkingLevel.MINIMAL,
  LOW: ThinkingLevel.LOW,
  MEDIUM: ThinkingLevel.MEDIUM,
  HIGH: ThinkingLevel.HIGH,
};

function checksumAnalysisPrompt(promptText: string) {
  return createHash('sha256').update(promptText, 'utf8').digest('hex');
}

/** Read-only prompt selection kept local so the lab remains compatible with the production loader. */
async function getAiPromptLabPrompts(admin: ReturnType<typeof createAdminServerSupabaseClient>): Promise<LabPromptRecord[]> {
  try {
    const { data, error } = await admin
      .from('ai_prompts')
      .select('prompt_id, version, is_active, created_at, prompt_text')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      prompt_id: string | number;
      version: string | number | null;
      is_active: boolean | null;
      prompt_text: string | null;
    }>;
    const selected = [
      rows.find((row) => row.is_active && row.prompt_text),
      rows.find((row) => !row.is_active && row.prompt_text),
    ].filter((row): row is (typeof rows)[number] => Boolean(row));
    if (selected.length) {
      return selected.map((row) => ({
        id: String(row.prompt_id),
        version: String(row.version ?? 'unknown'),
        isActive: Boolean(row.is_active),
        text: row.prompt_text!,
        checksum: checksumAnalysisPrompt(row.prompt_text!),
      }));
    }
  } catch (error) {
    console.warn('Failed to fetch AI Prompt Lab prompt records:', error);
  }
  const text = loadFallbackAnalysisPrompt();
  return [{ id: 'fallback', version: 'fallback', isActive: true, text, checksum: checksumAnalysisPrompt(text) }];
}

export class AiPromptLabError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'AiPromptLabError';
  }
}

function labErrorMessages(error: unknown): string[] {
  const primary = error instanceof Error ? error.message : 'Unknown analysis error.';
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  const detail = cause instanceof Error ? cause.message : null;
  return detail && detail !== primary ? [primary, detail] : [primary];
}

export type AiPromptLabRequest = {
  image: { data?: unknown; mimeType?: unknown; name?: unknown };
  prompt: { sourceVersion?: unknown; checksum?: unknown; text?: unknown };
  mode?: unknown;
  twoStep?: { inventoryPrompt?: unknown; compilerPrompt?: unknown };
  twoStepBoundingBoxes?: { identificationPrompt?: unknown; boundingBoxPrompt?: unknown };
  onePassGeometryRefinement?: { geometryPrompt?: unknown };
  onePassGeometryCombined?: { promptText?: unknown };
  gridSizing?: unknown;
  sizingMode?: unknown;
  gridInstructionsInPrompt?: unknown;
  settings?: {
    model?: unknown;
    thinkingLevel?: unknown;
    temperature?: unknown;
    topP?: unknown;
    topK?: unknown;
  };
  useDiameterAnchorSizing?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AiPromptLabError(`Invalid ${name}.`);
  }
  return value;
}

function validatePromptLabDecoding(settings: Record<string, unknown>): AiPromptLabDecoding {
  const temperature = asFiniteNumber(settings.temperature, 'temperature');
  const topP = asFiniteNumber(settings.topP, 'top-p');
  const topK = asFiniteNumber(settings.topK, 'top-k');
  if (temperature < 0 || temperature > 2) {
    throw new AiPromptLabError('Temperature must be between 0 and 2.');
  }
  if (topP < 0 || topP > 1) {
    throw new AiPromptLabError('Top P must be between 0 and 1.');
  }
  if (!Number.isInteger(topK) || topK < 1 || topK > 100) {
    throw new AiPromptLabError('Top K must be a whole number between 1 and 100.');
  }
  return { temperature, topP, topK };
}

function normalizedPromptVersion(version: string) {
  return version.trim().replace(/^v/i, '');
}

export function validateAiPromptLabRequest(body: unknown) {
  if (!isRecord(body) || !isRecord(body.image) || !isRecord(body.prompt)) {
    throw new AiPromptLabError('A test image and prompt are required.');
  }
  const imageData = typeof body.image.data === 'string' ? body.image.data.trim() : '';
  const mimeType = typeof body.image.mimeType === 'string' ? body.image.mimeType.toLowerCase().trim() : '';
  const promptText = typeof body.prompt.text === 'string' ? body.prompt.text : '';
  const sourceVersion = typeof body.prompt.sourceVersion === 'string' ? body.prompt.sourceVersion.trim() : '';
  const settings = isRecord(body.settings) ? body.settings : {};
  const mode = body.mode === undefined || body.mode === 'one_pass'
    ? 'one_pass'
    : body.mode === TWO_STEP_V385_MODE
      ? TWO_STEP_V385_MODE
    : body.mode === TWO_STEP_BOUNDING_BOXES_MODE
      ? TWO_STEP_BOUNDING_BOXES_MODE
    : body.mode === ONE_PASS_GEOMETRY_REFINED_MODE
      ? ONE_PASS_GEOMETRY_REFINED_MODE
      : body.mode === ONE_PASS_GEOMETRY_COMBINED_MODE
        ? ONE_PASS_GEOMETRY_COMBINED_MODE
      : null;
  const twoStep = isRecord(body.twoStep) ? body.twoStep : {};
  const twoStepBoundingBoxes = isRecord(body.twoStepBoundingBoxes) ? body.twoStepBoundingBoxes : {};
  const onePassGeometryRefinement = isRecord(body.onePassGeometryRefinement) ? body.onePassGeometryRefinement : {};
  const requestedSizingMode = body.sizingMode === 'cartesian_4q'
    ? 'cartesian_4q'
    : body.sizingMode === 'grid_20' || body.gridSizing === true
      ? 'grid_20'
      : 'none';
  const sizingMode: CoordinateSizingMode | null = requestedSizingMode === 'none' ? null : requestedSizingMode;
  const gridSizing = sizingMode === 'grid_20';
  const gridInstructionsInPrompt = body.gridInstructionsInPrompt === true;

  if (!imageData || imageData.startsWith('data:')) throw new AiPromptLabError('Image data must be base64 without a data URL prefix.');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(imageData) || imageData.length % 4 !== 0) {
    throw new AiPromptLabError('Image data is not valid base64.');
  }
  if (!(AI_PROMPT_LAB_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new AiPromptLabError('Only JPEG, PNG, and WebP test images are supported.');
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(imageData, 'base64');
  } catch {
    throw new AiPromptLabError('Image data is not valid base64.');
  }
  // Buffer accepts malformed strings, so compare canonical size and reject empty input.
  if (!bytes.byteLength || bytes.byteLength > AI_PROMPT_LAB_MAX_IMAGE_BYTES) {
    throw new AiPromptLabError(`Test images must be between 1 byte and ${AI_PROMPT_LAB_MAX_IMAGE_BYTES / 1024 / 1024} MB.`, 413);
  }
  if (!mode) throw new AiPromptLabError('Unsupported Prompt Lab execution mode.');
  if (mode === 'one_pass' && !promptText.trim()) throw new AiPromptLabError('Prompt text is required.');
  if (sizingMode && body.useDiameterAnchorSizing === true) {
    throw new AiPromptLabError('Coordinate sizing already owns the experimental sizing contract.');
  }
  if (mode !== TWO_STEP_BOUNDING_BOXES_MODE && !sourceVersion) throw new AiPromptLabError('Prompt source version is required.');
  const model = typeof settings.model === 'string' ? settings.model as CakeAnalysisModel : null;
  if (!model || !(CAKE_ANALYSIS_LAB_MODELS as readonly string[]).includes(model)) {
    throw new AiPromptLabError('Unsupported Gemini model.');
  }
  const thinkingLevel = typeof settings.thinkingLevel === 'string'
    ? settings.thinkingLevel as CakeAnalysisThinkingLevel
    : null;
  if (!thinkingLevel || !AI_PROMPT_LAB_THINKING_LEVELS[model].includes(thinkingLevel)) {
    throw new AiPromptLabError(`Unsupported thinking level for ${model}.`);
  }
  const decoding = validatePromptLabDecoding(settings);
  const inventoryPrompt = typeof twoStep.inventoryPrompt === 'string' ? twoStep.inventoryPrompt : '';
  const compilerPrompt = typeof twoStep.compilerPrompt === 'string' ? twoStep.compilerPrompt : '';
  const identificationPrompt = typeof twoStepBoundingBoxes.identificationPrompt === 'string' ? twoStepBoundingBoxes.identificationPrompt : '';
  const boundingBoxPrompt = typeof twoStepBoundingBoxes.boundingBoxPrompt === 'string' ? twoStepBoundingBoxes.boundingBoxPrompt : '';
  const geometryPrompt = typeof onePassGeometryRefinement.geometryPrompt === 'string' ? onePassGeometryRefinement.geometryPrompt : '';
  if (mode === TWO_STEP_V385_MODE) {
    if (normalizedPromptVersion(sourceVersion) !== TWO_STEP_V385_TARGET_VERSION) {
      throw new AiPromptLabError(`Two-step mode is pinned to v${TWO_STEP_V385_TARGET_VERSION}.`);
    }
    if (!inventoryPrompt.trim() || !compilerPrompt.trim()) {
      throw new AiPromptLabError('Both two-step prompts are required.');
    }
    if (body.useDiameterAnchorSizing === true) {
      throw new AiPromptLabError('Two-step v3.85 mode already uses direct diameter sizing.');
    }
  }
  if (mode === TWO_STEP_BOUNDING_BOXES_MODE) {
    if (!identificationPrompt.trim() || !boundingBoxPrompt.trim()) throw new AiPromptLabError('Both bounding-box detector prompts are required.');
    if (sizingMode || body.gridSizing === true || body.useDiameterAnchorSizing === true) {
      throw new AiPromptLabError('Bounding-box detector mode cannot use coordinate sizing or diameter-anchor sizing.');
    }
  }
  if (mode === ONE_PASS_GEOMETRY_REFINED_MODE) {
    if (!geometryPrompt.trim()) throw new AiPromptLabError('A geometry refinement prompt is required.');
    if (sizingMode || body.gridSizing === true || body.useDiameterAnchorSizing === true) {
      throw new AiPromptLabError('One-pass geometry refinement cannot use grid, Cartesian, or diameter-anchor sizing.');
    }
  }
  if (mode === ONE_PASS_GEOMETRY_COMBINED_MODE) {
    if (!promptText.trim()) throw new AiPromptLabError('A combined analysis and geometry prompt is required.');
    if (sizingMode || body.gridSizing === true || body.useDiameterAnchorSizing === true) {
      throw new AiPromptLabError('True one-pass geometry cannot use grid, Cartesian, or diameter-anchor sizing.');
    }
  }

  return {
    imageData,
    mimeType,
    promptText,
    sourceVersion,
    model,
    thinkingLevel,
    decoding,
    checksum: typeof body.prompt.checksum === 'string' ? body.prompt.checksum : null,
    mode,
    twoStep: mode === TWO_STEP_V385_MODE ? { inventoryPrompt, compilerPrompt } : null,
    twoStepBoundingBoxes: mode === TWO_STEP_BOUNDING_BOXES_MODE ? { identificationPrompt, boundingBoxPrompt } : null,
    onePassGeometryRefinement: mode === ONE_PASS_GEOMETRY_REFINED_MODE ? { geometryPrompt } : null,
    onePassGeometryCombined: mode === ONE_PASS_GEOMETRY_COMBINED_MODE ? { promptText } : null,
    gridSizing,
    sizingMode,
    gridInstructionsInPrompt,
    useDiameterAnchorSizing: body.useDiameterAnchorSizing === true,
  };
}

/**
 * Uses the same runtime prompt loader and generation defaults as /api/ai/analyze.
 * The lab still disables prompt-cache writes and rejected-upload persistence so a
 * submitted test image never creates durable state.
 */
export function isAiPromptLabProductionEquivalent(
  input: ReturnType<typeof validateAiPromptLabRequest>,
  sourcePrompt: LabPromptRecord,
) {
  return input.mode === 'one_pass'
    && sourcePrompt.isActive
    && input.promptText === sourcePrompt.text
    && input.model === AI_PROMPT_LAB_MODEL
    && input.thinkingLevel === AI_PROMPT_LAB_THINKING_LEVEL
    && input.decoding.temperature === AI_PROMPT_LAB_DECODE.temperature
    && input.decoding.topP === AI_PROMPT_LAB_DECODE.topP
    && input.decoding.topK === AI_PROMPT_LAB_DECODE.topK
    && !input.sizingMode
    && !input.useDiameterAnchorSizing;
}

export async function getAiPromptLabConfiguration(): Promise<{ prompts: LabPromptRecord[]; settings: Record<string, unknown> }> {
  const admin = createAdminServerSupabaseClient();
  const prompts = await getAiPromptLabPrompts(admin);
  return {
    prompts,
    settings: {
      models: [...CAKE_ANALYSIS_LAB_MODELS],
      thinkingLevelsByModel: AI_PROMPT_LAB_THINKING_LEVELS,
      defaultModel: AI_PROMPT_LAB_MODEL,
      defaultThinkingLevel: AI_PROMPT_LAB_THINKING_LEVEL,
      decode: AI_PROMPT_LAB_DECODE,
      sentToGemini: ['model', 'thinkingLevel', 'temperature', 'topP', 'topK'],
      gridSizing: {
        mode: GRID_SIZING_MODE,
        available: true,
        editablePrompt: GRID_SIZING_EDITABLE_PROMPT,
        promptMarkerStart: GRID_SIZING_PROMPT_MARKER_START,
        promptMarkerEnd: GRID_SIZING_PROMPT_MARKER_END,
      },
      cartesianSizing: {
        mode: CARTESIAN_SIZING_MODE,
        available: true,
        editablePrompt: CARTESIAN_SIZING_EDITABLE_PROMPT,
        promptMarkerStart: CARTESIAN_SIZING_PROMPT_MARKER_START,
        promptMarkerEnd: CARTESIAN_SIZING_PROMPT_MARKER_END,
      },
      diameterAnchorSizingAvailable: prompts.some((prompt) => !prompt.isActive && /^v?3\.84$/i.test(prompt.version)),
      twoStep: {
        mode: TWO_STEP_V385_MODE,
        targetVersion: TWO_STEP_V385_TARGET_VERSION,
        targetChecksum: TWO_STEP_V385_TARGET_CHECKSUM,
        targetAvailable: prompts.some((prompt) => normalizedPromptVersion(prompt.version) === TWO_STEP_V385_TARGET_VERSION
          && prompt.isActive
          && prompt.checksum === TWO_STEP_V385_TARGET_CHECKSUM),
        inventoryPrompt: TWO_STEP_VISUAL_INVENTORY_PROMPT,
        compilerPrompt: TWO_STEP_SCHEMA_COMPILER_PROMPT,
      },
      twoStepBoundingBoxes: {
        mode: TWO_STEP_BOUNDING_BOXES_MODE,
        identificationPrompt: BOUNDING_BOX_IDENTIFICATION_PROMPT,
        boundingBoxPrompt: BOUNDING_BOX_GEOMETRY_PROMPT,
      },
      onePassGeometryRefinement: {
        mode: ONE_PASS_GEOMETRY_REFINED_MODE,
        geometryPrompt: ONE_PASS_GEOMETRY_REFINEMENT_PROMPT,
      },
      onePassGeometryCombined: {
        mode: ONE_PASS_GEOMETRY_COMBINED_MODE,
        combinedPrompt: ONE_PASS_GEOMETRY_COMBINED_PROMPT,
      },
    },
  };
}

async function runTwoStepBoundingBoxDetector(
  input: ReturnType<typeof validateAiPromptLabRequest>,
  requestContext: Request | undefined,
) {
  const startedAt = performance.now();
  let rawIdentificationResponse: string | null = null;
  let rawBoundingBoxResponse: string | null = null;
  let identification: DetectorIdentification | null = null;
  let geometry: DetectorGeometry | null = null;
  let identificationMs: number | null = null;
  let boundingBoxMs: number | null = null;
  const prompts = input.twoStepBoundingBoxes!;
  const metadata = () => ({
    executionMode: TWO_STEP_BOUNDING_BOXES_MODE,
    identificationPromptChecksum: checksumAnalysisPrompt(prompts.identificationPrompt),
    boundingBoxPromptChecksum: checksumAnalysisPrompt(prompts.boundingBoxPrompt),
    isEdited: prompts.identificationPrompt !== BOUNDING_BOX_IDENTIFICATION_PROMPT || prompts.boundingBoxPrompt !== BOUNDING_BOX_GEOMETRY_PROMPT,
  });
  try {
    const aiClient = await getAI(requestContext);
    const firstStartedAt = performance.now();
    const identificationResponse = await aiClient.models.generateContent({
      model: input.model,
      contents: [{ role: 'user', parts: detectorIdentificationRequestParts(input.mimeType, input.imageData, prompts.identificationPrompt) }],
      config: { responseMimeType: 'application/json', responseSchema: detectorIdentificationResponseSchema(), ...input.decoding, thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] }, abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS) },
    });
    rawIdentificationResponse = (identificationResponse.text || '').trim();
    identificationMs = Math.round(performance.now() - firstStartedAt);
    identification = validateDetectorIdentification(JSON.parse(rawIdentificationResponse));
    if (identification.rejection.isRejected) {
      return { rawResponse: rawIdentificationResponse, rawIdentificationResponse, rawBoundingBoxResponse, identification, geometry, analysis: null, pricing: null, executionTimeMs: Math.round(performance.now() - startedAt), stageTimings: { identificationMs, boundingBoxMs, totalMs: Math.round(performance.now() - startedAt) }, effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false }, prompt: metadata(), validationErrors: [], pricingErrors: [] };
    }
    const secondStartedAt = performance.now();
    const geometryResponse = await aiClient.models.generateContent({
      model: input.model,
      contents: [{ role: 'user', parts: detectorGeometryRequestParts(input.mimeType, input.imageData, prompts.boundingBoxPrompt, identification) }],
      config: { responseMimeType: 'application/json', responseSchema: detectorGeometryResponseSchema(), ...input.decoding, thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] }, abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS) },
    });
    rawBoundingBoxResponse = (geometryResponse.text || '').trim();
    boundingBoxMs = Math.round(performance.now() - secondStartedAt);
    geometry = validateDetectorGeometry(JSON.parse(rawBoundingBoxResponse), identification);
    return { rawResponse: rawBoundingBoxResponse, rawIdentificationResponse, rawBoundingBoxResponse, identification, geometry, analysis: null, pricing: null, executionTimeMs: Math.round(performance.now() - startedAt), stageTimings: { identificationMs, boundingBoxMs, totalMs: Math.round(performance.now() - startedAt) }, effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false }, prompt: metadata(), validationErrors: [], pricingErrors: [] };
  } catch (error) {
    return { rawResponse: rawBoundingBoxResponse ?? rawIdentificationResponse, rawIdentificationResponse, rawBoundingBoxResponse, identification, geometry, analysis: null, pricing: null, executionTimeMs: Math.round(performance.now() - startedAt), stageTimings: { identificationMs, boundingBoxMs, totalMs: Math.round(performance.now() - startedAt) }, effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false }, prompt: metadata(), validationErrors: labErrorMessages(error), pricingErrors: [] };
  }
}

function twoStepPromptMetadata(
  sourcePrompt: LabPromptRecord,
  input: ReturnType<typeof validateAiPromptLabRequest>,
  sizeSchema: string | undefined,
) {
  const prompts = input.twoStep!;
  return {
    sourceVersion: sourcePrompt.version,
    sourceChecksum: sourcePrompt.checksum,
    targetVersion: TWO_STEP_V385_TARGET_VERSION,
    targetChecksum: TWO_STEP_V385_TARGET_CHECKSUM,
    inventoryChecksum: checksumAnalysisPrompt(prompts.inventoryPrompt),
    compilerChecksum: checksumAnalysisPrompt(prompts.compilerPrompt),
    sourceChecksumMatches: input.checksum === null || input.checksum === sourcePrompt.checksum,
    isEdited: prompts.inventoryPrompt !== TWO_STEP_VISUAL_INVENTORY_PROMPT
      || prompts.compilerPrompt !== TWO_STEP_SCHEMA_COMPILER_PROMPT,
    sizeSchema,
    executionMode: 'two_step_v385_experiment',
  };
}

function requireTwoStepTargetPrompt(prompts: LabPromptRecord[]) {
  const target = prompts.find((prompt) => normalizedPromptVersion(prompt.version) === TWO_STEP_V385_TARGET_VERSION);
  if (!target) throw new AiPromptLabError(`v${TWO_STEP_V385_TARGET_VERSION} is not available in the Prompt Lab.`, 422);
  if (!target.isActive || target.checksum !== TWO_STEP_V385_TARGET_CHECKSUM
    || checksumAnalysisPrompt(target.text) !== TWO_STEP_V385_TARGET_CHECKSUM) {
    throw new AiPromptLabError(`Two-step mode requires the verified active v${TWO_STEP_V385_TARGET_VERSION} prompt.`, 422);
  }
  return target;
}

function gridAnalysisResponseSchema(
  typeEnums: Awaited<ReturnType<typeof getDynamicTypeEnums>>,
  sizingMode: CoordinateSizingMode = 'grid_20',
  options: { required?: boolean } = {},
) {
  const baseConfig = buildSearchAnalysisGenerationConfig(typeEnums, 'ai_diameter_anchor');
  return addGridSizingToResponseSchema(
    baseConfig.responseSchema as unknown as Record<string, unknown>,
    { ...options, coordinateSystem: sizingMode },
  );
}

export function splitGridSizingResponse(
  value: unknown,
  options: { validateGeometry?: boolean; coordinateSystem?: CoordinateSizingMode } = {},
): { analysis: Record<string, unknown>; gridSizing: GridSizingPayload | null } {
  const coordinateSystem = options.coordinateSystem ?? 'grid_20';
  if (!isRecord(value)) throw new AiPromptLabError('Grid sizing response must be a JSON object.');
  if (value.grid_sizing === undefined) {
    const rejection = isRecord(value.rejection) ? value.rejection : null;
    if (rejection?.isRejected === true) return { analysis: { ...value }, gridSizing: null };
    throw new AiPromptLabError('Accepted grid sizing response must include grid_sizing.');
  }

  const bindings = (['main_toppers', 'support_elements'] as const).flatMap((role) => {
    const rows = value[role];
    if (!Array.isArray(rows)) throw new AiPromptLabError(`${role} must be an array for grid sizing.`);
    return rows.map((row, index) => {
      if (!isRecord(row)) throw new AiPromptLabError(`${role}[${index}] must be an object for grid sizing.`);
      return {
        source_group_id: row.group_id,
        role,
        description: row.description,
        measurement: row.grid_sizing,
      };
    });
  });
  // One-pass analysis emits provisional row geometry only because its response
  // schema requires the grid shape. The calibrated locator below is the sole
  // geometry authority there, so a bad provisional box must not prevent that
  // locator from correcting the result. The two-step compiler still validates
  // and preserves its grid geometry exactly.
  const gridSizing = options.validateGeometry === false
    ? null
    : buildGridSizingPayload(value.grid_sizing, bindings, coordinateSystem);
  const analysis = { ...value };
  delete analysis.grid_sizing;
  for (const role of ['main_toppers', 'support_elements'] as const) {
    const rows = value[role];
    if (!Array.isArray(rows)) continue;
    analysis[role] = rows.map((row) => {
      if (!isRecord(row)) return row;
      const next = { ...row };
      delete next.grid_sizing;
      return next;
    });
  }
  // Grid mode has no use for cake-message geometry. If a model still returns
  // a 0–20 grid bbox here, drop it rather than sending it into the independent
  // storefront contract, whose optional message bbox uses 0–1000 pixels.
  const messages = value.cake_messages;
  if (Array.isArray(messages)) {
    analysis.cake_messages = messages.map((message) => {
      if (!isRecord(message)) return message;
      const next = { ...message };
      delete next.bbox;
      return next;
    });
  }
  return { analysis, gridSizing };
}

function gridPromptMetadata(
  sourcePrompt: LabPromptRecord,
  input: ReturnType<typeof validateAiPromptLabRequest>,
  promptText: string,
  executionMode: string,
) {
  const sizingMode = input.sizingMode ?? 'grid_20';
  return {
    sourceVersion: sourcePrompt.version,
    sourceChecksum: sourcePrompt.checksum,
    checksum: checksumAnalysisPrompt(promptText),
    sourceChecksumMatches: input.checksum === null || input.checksum === sourcePrompt.checksum,
    isEdited: true,
    sizeSchema: sizingMode === 'cartesian_4q' ? CARTESIAN_SIZING_MODE : GRID_SIZING_MODE,
    executionMode,
    gridSizing: sizingMode === 'grid_20',
    sizingMode,
  };
}

async function runGridSizingCoordinatePass(
  aiClient: Awaited<ReturnType<typeof getAI>>,
  input: ReturnType<typeof validateAiPromptLabRequest>,
  overlay: Awaited<ReturnType<typeof createGridOverlay>>,
  bindings: Omit<GridSizingBinding, 'measurement'>[],
  sizingMode: CoordinateSizingMode = 'grid_20',
) {
  const anchorPrompt = sizingMode === 'cartesian_4q'
    ? CARTESIAN_SIZING_PROMPT
    : GRID_SIZING_ANCHOR_LOCATOR_PROMPT;
  const geometryResponse = await aiClient.models.generateContent({
    model: input.model,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: overlay.mimeType, data: overlay.imageData } },
        { text: anchorPrompt },
      ],
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: gridSizingAnchorLocatorResponseSchema(sizingMode),
      ...input.decoding,
      thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
      abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    },
  });
  const rawGeometryResponse = (geometryResponse.text || '').trim();
  const rowResponses = await Promise.all(bindings.map(async (binding, index) => {
    if (typeof binding.source_group_id !== 'string' || !binding.source_group_id.trim()) {
      throw new AiPromptLabError(`Coordinate target ${index + 1} is missing a group_id.`);
    }
    const response = await aiClient.models.generateContent({
      model: input.model,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: overlay.mimeType, data: overlay.imageData } },
          { text: sizingMode === 'cartesian_4q'
            ? `${CARTESIAN_SIZING_EDITABLE_PROMPT}\n\nTARGET ${index + 1} OF ${bindings.length}\ngroup_id: ${JSON.stringify(binding.source_group_id)}\nrole: ${binding.role ?? 'observed cake group'}\ndescription: ${JSON.stringify(binding.description)}\nReturn only this target's tight grid_sizing.bbox using signed Cartesian coordinates.`
            : gridSizingRowLocatorPrompt(binding, index + 1, bindings.length) },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: gridSizingRowLocatorResponseSchema(binding.source_group_id, sizingMode),
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    return (response.text || '').trim();
  }));
  const parsedGeometryResponse = JSON.parse(rawGeometryResponse);
  const parsedRowResponses = rowResponses.map((response, index) => {
    try {
      return JSON.parse(response);
    } catch {
      throw new AiPromptLabError(`Coordinate target ${index + 1} returned invalid JSON.`);
    }
  });
  return {
    rawResponse: JSON.stringify({ geometry: parsedGeometryResponse, rows: parsedRowResponses }),
    gridSizing: buildGridSizingPayloadFromCalibratedLocator(parsedGeometryResponse, parsedRowResponses, bindings, sizingMode),
  };
}

function attachGridSizingToInventory(inventory: VisualInventory, gridSizing: GridSizingPayload): VisualInventory {
  const measurements = new Map(gridSizing.items.map((item) => [item.source_group_id, { bbox: item.bbox }]));
  return {
    ...inventory,
    grid_sizing: {
      version: gridSizing.version,
      cake_top_diameter: gridSizing.cake_top_diameter,
      cake_top_height: gridSizing.cake_top_height,
    },
    observed_groups: inventory.observed_groups.map((group) => {
      const measurement = measurements.get(group.group_id);
      return measurement ? { ...group, grid_sizing: measurement } : group;
    }),
  };
}

async function runGridOnePassAiPromptLabAnalysis(
  input: ReturnType<typeof validateAiPromptLabRequest>,
  sourcePrompt: LabPromptRecord,
  requestContext: Request | undefined,
) {
  const startedAt = performance.now();
  let rawResponse: string | null = null;
  let gridOverlayPreview: string | null = null;
  const augmentedPrompt = input.gridInstructionsInPrompt
    ? input.promptText
    : appendGridSizingPrompt(input.promptText, input.sizingMode ?? 'grid_20');

  try {
    const overlay = input.sizingMode === 'cartesian_4q'
      ? await createCartesianOverlay(input.imageData)
      : await createGridOverlay(input.imageData);
    gridOverlayPreview = overlay.previewDataUrl;
    const admin = createAdminServerSupabaseClient();
    const [aiClient, typeEnums] = await Promise.all([
      getAI(requestContext),
      getDynamicTypeEnums(admin),
    ]);
    const response = await aiClient.models.generateContent({
      model: input.model,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: overlay.mimeType, data: overlay.imageData } },
          { text: augmentedPrompt },
        ],
      }],
      config: {
        ...buildSearchAnalysisGenerationConfig(typeEnums, 'ai_diameter_anchor'),
        systemInstruction: appendGridSizingSystemRules(SYSTEM_INSTRUCTION, input.sizingMode ?? 'grid_20'),
        responseSchema: gridAnalysisResponseSchema(typeEnums, input.sizingMode ?? 'grid_20'),
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawResponse = (response.text || '').trim();
    // The one-pass response itself is the coordinate authority. Do not make a
    // second locator request and silently replace the raw bboxes the operator
    // is reviewing in Prompt Lab.
    const { analysis: rawAnalysis, gridSizing } = splitGridSizingResponse(JSON.parse(rawResponse), { coordinateSystem: input.sizingMode ?? 'grid_20' });
    const preValidationApplied = gridSizing
      ? applyGridSizingToAnalysis(rawAnalysis, gridSizing, input.sizingMode ?? 'grid_20')
      : null;
    const validatedAnalysis = postProcessSearchAnalysisResult(
      preValidationApplied?.analysis ?? rawAnalysis,
      typeEnums,
      'ai_diameter_anchor',
    ) as unknown as Record<string, unknown>;
    const applied = gridSizing
      ? applyGridSizingToAnalysis(validatedAnalysis, gridSizing, input.sizingMode ?? 'grid_20')
      : null;
    const analysis = {
      ...(applied?.analysis ?? validatedAnalysis),
      analysis_size_schema: AI_THREE_BAND_SIZE_SCHEMA,
    };

    let pricing: Awaited<ReturnType<typeof runAiPromptLabPricing>> | null = null;
    const pricingErrors: string[] = [];
    if (!isRejectedGeneratedCakeAnalysis(analysis as never)) {
      try {
        pricing = await runAiPromptLabPricing(analysis as never);
      } catch (pricingError) {
        pricingErrors.push(pricingError instanceof Error ? pricingError.message : 'Unknown pricing error.');
      }
    }
    return {
      rawResponse,
      effectiveUserPrompt: augmentedPrompt,
      analysis,
      gridSizing: applied?.gridSizing ?? null,
      gridOverlayPreview,
      pricing,
      executionTimeMs: Math.round(performance.now() - startedAt),
      effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: gridPromptMetadata(sourcePrompt, input, augmentedPrompt, 'grid_sizing_one_pass_raw_coordinates_experiment'),
      validationErrors: [],
      pricingErrors,
    };
  } catch (error) {
    return {
      rawResponse,
      effectiveUserPrompt: augmentedPrompt,
      analysis: null,
      gridSizing: null,
      gridOverlayPreview,
      pricing: null,
      executionTimeMs: Math.round(performance.now() - startedAt),
      effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: gridPromptMetadata(sourcePrompt, input, augmentedPrompt, 'grid_sizing_one_pass_raw_coordinates_experiment'),
      validationErrors: labErrorMessages(error),
      pricingErrors: [],
    };
  }
}

function stageError(stage: 'Step 1 visual inventory' | 'Step 2 schema compiler', error: unknown, rawResponse: string | null) {
  const detail = error instanceof Error ? error : new Error('Unknown analysis error.');
  return new CakeAnalysisResponseError(`${stage} failed: ${detail.message}`, rawResponse ?? '', detail);
}

async function runGridTwoStepAiPromptLabAnalysis(
  input: ReturnType<typeof validateAiPromptLabRequest>,
  sourcePrompt: LabPromptRecord,
  requestContext: Request | undefined,
) {
  const startedAt = performance.now();
  let rawInventoryResponse: string | null = null;
  let rawCompilerResponse: string | null = null;
  let gridOverlayPreview: string | null = null;
  let inventory: VisualInventory | null = null;
  let inventoryTimeMs: number | null = null;
  let compilerTimeMs: number | null = null;
  const augmentedInventoryPrompt = input.twoStep!.inventoryPrompt;
  const coordinateSystem = input.sizingMode ?? 'grid_20';
  const coordinateOutputRules = coordinateSystem === 'cartesian_4q'
    ? CARTESIAN_SIZING_OUTPUT_RULES
    : GRID_SIZING_OUTPUT_RULES;
  const augmentedCompilerPrompt = [
    input.twoStep!.compilerPrompt.trim(),
    coordinateOutputRules.trim(),
    `The compiler has no image. Copy the validated ${coordinateSystem === 'cartesian_4q' ? 'Cartesian' : 'grid'} measurements from the immutable visual inventory exactly, then use them as the sizing authority for the final storefront rows.`,
  ].join('\n\n');
  const augmentedReferencePrompt = sourcePrompt.text;
  const promptMetadata = () => ({
    ...gridPromptMetadata(sourcePrompt, input, `${augmentedInventoryPrompt}\n\n${augmentedCompilerPrompt}`, 'two_step_v385_grid_experiment'),
    targetVersion: TWO_STEP_V385_TARGET_VERSION,
    targetChecksum: TWO_STEP_V385_TARGET_CHECKSUM,
    inventoryChecksum: checksumAnalysisPrompt(augmentedInventoryPrompt),
    compilerChecksum: checksumAnalysisPrompt(augmentedCompilerPrompt),
    sourceChecksumMatches: input.checksum === null || input.checksum === sourcePrompt.checksum,
  });

  try {
    const overlay = coordinateSystem === 'cartesian_4q'
      ? await createCartesianOverlay(input.imageData)
      : await createGridOverlay(input.imageData);
    gridOverlayPreview = overlay.previewDataUrl;
    const admin = createAdminServerSupabaseClient();
    const [aiClient, typeEnums] = await Promise.all([
      getAI(requestContext),
      getDynamicTypeEnums(admin),
    ]);
    const stageOneStartedAt = performance.now();
    const inventoryResponse = await aiClient.models.generateContent({
      model: input.model,
      contents: [{
        role: 'user',
        // Inventory identifies cake elements from the unmodified photo. The
        // subsequent coordinate pass alone receives the numbered grid image.
        parts: visualInventoryRequestParts(input.mimeType, input.imageData, augmentedInventoryPrompt),
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: visualInventoryResponseSchema(),
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawInventoryResponse = (inventoryResponse.text || '').trim();
    inventoryTimeMs = Math.round(performance.now() - stageOneStartedAt);
    try {
      inventory = validateVisualInventory(JSON.parse(rawInventoryResponse));
    } catch (error) {
      throw stageError('Step 1 visual inventory', error, rawInventoryResponse);
    }

    const coordinatePass = inventory.rejection.isRejected
      ? null
      : await runGridSizingCoordinatePass(
        aiClient,
        input,
        overlay,
        inventory.observed_groups
          .filter((group) => group.requires_priced_row)
          .map((group) => ({ source_group_id: group.group_id, role: null, description: group.description })),
        coordinateSystem,
      );
    const inventoryWithGridSizing = coordinatePass
      ? attachGridSizingToInventory(inventory, coordinatePass.gridSizing)
      : inventory;

    const stageTwoStartedAt = performance.now();
    const compilerConfig = buildSearchAnalysisGenerationConfig(typeEnums, 'ai_diameter_anchor');
    const compilerResponse = await aiClient.models.generateContent({
      model: input.model,
      contents: [{
        role: 'user',
        parts: textOnlyCompilerRequestParts(augmentedCompilerPrompt, inventoryWithGridSizing, augmentedReferencePrompt),
      }],
      config: {
        ...compilerConfig,
        systemInstruction: appendGridSizingSystemRules('Compile only from the immutable visual inventory supplied in the request.', coordinateSystem),
        responseSchema: addGridSizingToResponseSchema(
          compilerConfig.responseSchema as unknown as Record<string, unknown>,
          { required: !inventory.rejection.isRejected, coordinateSystem },
        ),
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawCompilerResponse = (compilerResponse.text || '').trim();
    compilerTimeMs = Math.round(performance.now() - stageTwoStartedAt);

    const { analysis: rawAnalysis, gridSizing: compiledGridSizing } = splitGridSizingResponse(JSON.parse(rawCompilerResponse), { coordinateSystem });
    if (coordinatePass && !compiledGridSizing) throw new Error('Step 2 did not return grid_sizing.');
    if (coordinatePass && compiledGridSizing) assertGridSizingPreserved(coordinatePass.gridSizing, compiledGridSizing, coordinateSystem);
    assertCompiledAnalysisMatchesInventory(inventoryWithGridSizing, rawAnalysis);
    const preValidationApplied = compiledGridSizing
      ? applyGridSizingToAnalysis(rawAnalysis, compiledGridSizing, coordinateSystem)
      : null;
    const validatedAnalysis = postProcessSearchAnalysisResult(
      preValidationApplied?.analysis ?? rawAnalysis,
      typeEnums,
      'ai_diameter_anchor',
    ) as unknown as Record<string, unknown>;
    const applied = compiledGridSizing
      ? applyGridSizingToAnalysis(validatedAnalysis, compiledGridSizing, coordinateSystem)
      : null;
    const analysis = {
      ...(applied?.analysis ?? validatedAnalysis),
      analysis_size_schema: AI_THREE_BAND_SIZE_SCHEMA,
    };
    let pricing: Awaited<ReturnType<typeof runAiPromptLabPricing>> | null = null;
    const pricingErrors: string[] = [];
    if (!isRejectedGeneratedCakeAnalysis(analysis as never)) {
      try {
        pricing = await runAiPromptLabPricing(analysis as never);
      } catch (pricingError) {
        pricingErrors.push(pricingError instanceof Error ? pricingError.message : 'Unknown pricing error.');
      }
    }
    return {
      rawResponse: rawCompilerResponse,
      rawInventoryResponse,
      rawCompilerResponse,
      inventory: inventoryWithGridSizing,
      analysis,
      gridSizing: applied?.gridSizing ?? null,
      gridOverlayPreview,
      pricing,
      executionTimeMs: Math.round(performance.now() - startedAt),
      stageTimings: { inventoryMs: inventoryTimeMs, compilerMs: compilerTimeMs, totalMs: Math.round(performance.now() - startedAt) },
      effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: promptMetadata(),
      validationErrors: [],
      pricingErrors,
    };
  } catch (error) {
    const rawResponse = rawCompilerResponse ?? rawInventoryResponse ?? (error instanceof CakeAnalysisResponseError ? error.rawResponse : null);
    return {
      rawResponse,
      rawInventoryResponse,
      rawCompilerResponse,
      inventory,
      analysis: null,
      gridSizing: null,
      gridOverlayPreview,
      pricing: null,
      executionTimeMs: Math.round(performance.now() - startedAt),
      stageTimings: { inventoryMs: inventoryTimeMs, compilerMs: compilerTimeMs, totalMs: Math.round(performance.now() - startedAt) },
      effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: promptMetadata(),
      validationErrors: labErrorMessages(error),
      pricingErrors: [],
    };
  }
}

async function runTwoStepAiPromptLabAnalysis(
  input: ReturnType<typeof validateAiPromptLabRequest>,
  sourcePrompt: LabPromptRecord,
  requestContext: Request | undefined,
) {
  const startedAt = performance.now();
  let rawInventoryResponse: string | null = null;
  let rawCompilerResponse: string | null = null;
  let inventory: VisualInventory | null = null;
  let inventoryTimeMs: number | null = null;
  let compilerTimeMs: number | null = null;
  const sizeSchema = getAnalysisGenerationSizeSchema(TWO_STEP_V385_TARGET_VERSION);
  const promptMetadata = () => twoStepPromptMetadata(sourcePrompt, input, sizeSchema);

  try {
    const admin = createAdminServerSupabaseClient();
    const [aiClient, typeEnums] = await Promise.all([
      getAI(requestContext),
      getDynamicTypeEnums(admin),
    ]);
    const stageOneStartedAt = performance.now();
    const inventoryResponse = await aiClient.models.generateContent({
      model: input.model,
      contents: [{
        role: 'user',
        parts: visualInventoryRequestParts(input.mimeType, input.imageData, input.twoStep!.inventoryPrompt),
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: visualInventoryResponseSchema(),
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawInventoryResponse = (inventoryResponse.text || '').trim();
    inventoryTimeMs = Math.round(performance.now() - stageOneStartedAt);
    try {
      inventory = validateVisualInventory(JSON.parse(rawInventoryResponse));
    } catch (error) {
      throw stageError('Step 1 visual inventory', error, rawInventoryResponse);
    }

    const stageTwoStartedAt = performance.now();
    const compilerConfig = { ...buildSearchAnalysisGenerationConfig(
      typeEnums,
      sizeSchema,
    ) };
    // The v3.85 text below is taxonomy reference, not a competing image-analysis system instruction.
    delete (compilerConfig as { systemInstruction?: unknown }).systemInstruction;
    const compilerResponse = await aiClient.models.generateContent({
      model: input.model,
      // Deliberately text-only: stage two must not see image bytes or MIME data.
      contents: [{
        role: 'user',
        parts: textOnlyCompilerRequestParts(input.twoStep!.compilerPrompt, inventory, sourcePrompt.text),
      }],
      config: {
        ...compilerConfig,
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawCompilerResponse = (compilerResponse.text || '').trim();
    compilerTimeMs = Math.round(performance.now() - stageTwoStartedAt);
    let analysis: ReturnType<typeof postProcessSearchAnalysisResult>;
    try {
      analysis = postProcessSearchAnalysisResult(JSON.parse(rawCompilerResponse), typeEnums, sizeSchema);
      assertCompiledAnalysisMatchesInventory(inventory, analysis);
    } catch (error) {
      throw stageError('Step 2 schema compiler', error, rawCompilerResponse);
    }

    let pricing: Awaited<ReturnType<typeof runAiPromptLabPricing>> | null = null;
    const pricingErrors: string[] = [];
    if (!isRejectedGeneratedCakeAnalysis(analysis)) {
      try {
        pricing = await runAiPromptLabPricing({ ...analysis, analysis_size_schema: AI_THREE_BAND_SIZE_SCHEMA });
      } catch (pricingError) {
        pricingErrors.push(pricingError instanceof Error ? pricingError.message : 'Unknown pricing error.');
      }
    }
    return {
      rawResponse: rawCompilerResponse,
      rawInventoryResponse,
      rawCompilerResponse,
      inventory,
      analysis: { ...analysis, analysis_size_schema: AI_THREE_BAND_SIZE_SCHEMA },
      pricing,
      executionTimeMs: Math.round(performance.now() - startedAt),
      stageTimings: { inventoryMs: inventoryTimeMs, compilerMs: compilerTimeMs, totalMs: Math.round(performance.now() - startedAt) },
      effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: promptMetadata(),
      validationErrors: [],
      pricingErrors,
    };
  } catch (error) {
    const rawResponse = rawCompilerResponse ?? rawInventoryResponse ?? (error instanceof CakeAnalysisResponseError ? error.rawResponse : null);
    return {
      rawResponse,
      rawInventoryResponse,
      rawCompilerResponse,
      inventory,
      analysis: null,
      pricing: null,
      executionTimeMs: Math.round(performance.now() - startedAt),
      stageTimings: { inventoryMs: inventoryTimeMs, compilerMs: compilerTimeMs, totalMs: Math.round(performance.now() - startedAt) },
      effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: promptMetadata(),
      validationErrors: labErrorMessages(error),
      pricingErrors: [],
    };
  }
}

async function runOnePassAiPromptLabAnalysis(
  input: ReturnType<typeof validateAiPromptLabRequest>,
  sourcePrompt: LabPromptRecord,
  requestContext: Request | undefined,
) {
  let rawResponse = '';
  const admin = createAdminServerSupabaseClient();
  const [aiClient, typeEnums] = await Promise.all([
    getAI(requestContext),
    getDynamicTypeEnums(admin),
  ]);
  const sizeSchema = input.useDiameterAnchorSizing
    ? 'ai_diameter_anchor'
    : getAnalysisGenerationSizeSchema(sourcePrompt.version);
  try {
    const response = await aiClient.models.generateContent({
      model: input.model,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: input.mimeType, data: input.imageData } },
          { text: input.promptText },
        ],
      }],
      config: {
        ...buildSearchAnalysisGenerationConfig(typeEnums, sizeSchema),
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawResponse = (response.text || '').trim();
    const result = postProcessSearchAnalysisResult(JSON.parse(rawResponse), typeEnums, sizeSchema);
    return {
      result: {
        ...result,
        analysis_size_schema: sizeSchema === 'integrated_bbox_v1'
          ? INTEGRATED_BBOX_ANALYSIS_SIZE_SCHEMA
          : AI_THREE_BAND_SIZE_SCHEMA,
      },
      rawResponse,
      effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      sizeSchema,
    };
  } catch (error) {
    throw new CakeAnalysisResponseError(
      error instanceof Error ? error.message : 'Invalid response format from AI.',
      rawResponse,
      { cause: error },
    );
  }
}

async function runOnePassGeometryRefinedAiPromptLabAnalysis(
  input: ReturnType<typeof validateAiPromptLabRequest>,
  sourcePrompt: LabPromptRecord,
  requestContext: Request | undefined,
) {
  const startedAt = performance.now();
  let rawAnalysisResponse: string | null = null;
  let rawGeometryResponse: string | null = null;
  let analysis: Record<string, unknown> | null = null;
  let manifest: RefinedGeometryManifest | null = null;
  let geometry: RefinedGeometry | null = null;
  let analysisMs: number | null = null;
  let geometryMs: number | null = null;
  const geometryPrompt = input.onePassGeometryRefinement!.geometryPrompt;
  const metadata = () => ({
    sourceVersion: sourcePrompt.version,
    sourceChecksum: sourcePrompt.checksum,
    checksum: checksumAnalysisPrompt(input.promptText),
    sourceChecksumMatches: input.checksum === null || input.checksum === sourcePrompt.checksum,
    geometryPromptChecksum: checksumAnalysisPrompt(geometryPrompt),
    isEdited: input.promptText !== sourcePrompt.text || geometryPrompt !== ONE_PASS_GEOMETRY_REFINEMENT_PROMPT,
    executionMode: ONE_PASS_GEOMETRY_REFINED_MODE,
  });
  const result = (
    pricing: Awaited<ReturnType<typeof runAiPromptLabPricing>> | null,
    pricingErrors: string[],
    validationErrors: string[],
    geometrySkipReason: string | null = null,
  ) => ({
    rawResponse: rawGeometryResponse ?? rawAnalysisResponse,
    rawAnalysisResponse,
    rawGeometryResponse,
    analysis,
    manifest,
    geometry,
    geometrySkipReason,
    pricing,
    executionTimeMs: Math.round(performance.now() - startedAt),
    stageTimings: { analysisMs, geometryMs, totalMs: Math.round(performance.now() - startedAt) },
    effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
    prompt: metadata(),
    validationErrors,
    pricingErrors,
  });

  const analysisStartedAt = performance.now();
  try {
    const execution = await runOnePassAiPromptLabAnalysis(input, sourcePrompt, requestContext);
    rawAnalysisResponse = execution.rawResponse;
    analysis = execution.result as Record<string, unknown>;
    analysisMs = Math.round(performance.now() - analysisStartedAt);
  } catch (error) {
    rawAnalysisResponse = error instanceof CakeAnalysisResponseError ? error.rawResponse : null;
    analysisMs = Math.round(performance.now() - analysisStartedAt);
    return result(null, [], labErrorMessages(error));
  }

  let pricing: Awaited<ReturnType<typeof runAiPromptLabPricing>> | null = null;
  const pricingErrors: string[] = [];
  if (analysis && !isRejectedGeneratedCakeAnalysis(analysis as never)) {
    try {
      pricing = await runAiPromptLabPricing(analysis as never);
    } catch (error) {
      pricingErrors.push(error instanceof Error ? error.message : 'Unknown pricing error.');
    }
  }
  if (!analysis || isRejectedGeneratedCakeAnalysis(analysis as never)) {
    return result(pricing, pricingErrors, [], 'The baseline analysis rejected this image, so geometry was not requested.');
  }

  try {
    manifest = buildRefinedGeometryManifest(analysis);
  } catch (error) {
    return result(pricing, pricingErrors, labErrorMessages(error));
  }
  if (!manifest.elements.length) {
    return result(pricing, pricingErrors, [], 'The baseline analysis has no priced topper or support rows to locate.');
  }

  const geometryStartedAt = performance.now();
  try {
    const aiClient = await getAI(requestContext);
    const response = await aiClient.models.generateContent({
      model: input.model,
      contents: [{ role: 'user', parts: refinedGeometryRequestParts(input.mimeType, input.imageData, geometryPrompt, manifest) }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: refinedGeometryResponseSchema(),
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawGeometryResponse = (response.text || '').trim();
    geometry = validateRefinedGeometry(JSON.parse(rawGeometryResponse), manifest);
    geometryMs = Math.round(performance.now() - geometryStartedAt);
    return result(pricing, pricingErrors, []);
  } catch (error) {
    geometryMs = Math.round(performance.now() - geometryStartedAt);
    return result(pricing, pricingErrors, labErrorMessages(error));
  }
}

async function runOnePassGeometryCombinedAiPromptLabAnalysis(
  input: ReturnType<typeof validateAiPromptLabRequest>,
  sourcePrompt: LabPromptRecord,
  requestContext: Request | undefined,
) {
  const startedAt = performance.now();
  let rawCombinedResponse: string | null = null;
  let analysis: Record<string, unknown> | null = null;
  let geometry: CombinedGeometry | null = null;
  let combinedMs: number | null = null;
  let pricing: Awaited<ReturnType<typeof runAiPromptLabPricing>> | null = null;
  const pricingErrors: string[] = [];
  const validationErrors: string[] = [];
  const combinedPrompt = input.promptText;
  const metadata = () => ({
    sourceVersion: sourcePrompt.version,
    sourceChecksum: sourcePrompt.checksum,
    checksum: checksumAnalysisPrompt(combinedPrompt),
    combinedPromptChecksum: checksumAnalysisPrompt(combinedPrompt),
    sourceChecksumMatches: input.checksum === null || input.checksum === sourcePrompt.checksum,
    isEdited: combinedPrompt !== sourcePrompt.text,
    executionMode: ONE_PASS_GEOMETRY_COMBINED_MODE,
  });
  const result = (validationErrors: string[] = []) => ({
    rawResponse: rawCombinedResponse,
    rawCombinedResponse,
    analysis,
    geometry,
    pricing,
    executionTimeMs: Math.round(performance.now() - startedAt),
    stageTimings: { combinedMs, totalMs: Math.round(performance.now() - startedAt) },
    effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
    prompt: metadata(),
    validationErrors,
    pricingErrors,
  });

  const combinedStartedAt = performance.now();
  try {
    const admin = createAdminServerSupabaseClient();
    const [aiClient, typeEnums] = await Promise.all([
      getAI(requestContext),
      getDynamicTypeEnums(admin),
    ]);
    const sizeSchema = getAnalysisGenerationSizeSchema(sourcePrompt.version);
    const response = await aiClient.models.generateContent({
      model: input.model,
      contents: [{ role: 'user', parts: combinedGeometryRequestParts(input.mimeType, input.imageData, combinedPrompt) }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: combinedGeometryResponseSchema(typeEnums, sizeSchema),
        ...input.decoding,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawCombinedResponse = (response.text || '').trim();
    combinedMs = Math.round(performance.now() - combinedStartedAt);
    const parsed = JSON.parse(rawCombinedResponse) as unknown;
    const rawAnalysis = isRecord(parsed) && isRecord(parsed.analysis) ? parsed.analysis : null;
    if (!rawAnalysis) throw new AiPromptLabError('combined response analysis must be an object.');
    try {
      analysis = {
        ...(postProcessSearchAnalysisResult(rawAnalysis, typeEnums, sizeSchema) as unknown as Record<string, unknown>),
        analysis_size_schema: AI_THREE_BAND_SIZE_SCHEMA,
      };
    } catch (error) {
      validationErrors.push(...labErrorMessages(error));
    }
    if (analysis && !isRejectedGeneratedCakeAnalysis(analysis as never)) {
      try {
        pricing = await runAiPromptLabPricing(analysis as never);
      } catch (pricingError) {
        pricingErrors.push(pricingError instanceof Error ? pricingError.message : 'Unknown pricing error.');
      }
    }
    try {
      geometry = validateOnePassGeometryCombinedResponse(parsed).geometry;
    } catch (error) {
      validationErrors.push(...labErrorMessages(error));
    }
    if (analysis && geometry) {
      analysis = attachCombinedGeometryToAnalysis(analysis, geometry);
    }
    return result(validationErrors);
  } catch (error) {
    combinedMs = combinedMs ?? Math.round(performance.now() - combinedStartedAt);
    return result(labErrorMessages(error));
  }
}

/** Executes an isolated analysis request. It never creates Gemini prompt cache entries or persistence records. */
export async function runAiPromptLabAnalysis(body: unknown, requestContext?: Request) {
  const input = validateAiPromptLabRequest(body);
  if (input.mode === TWO_STEP_BOUNDING_BOXES_MODE) {
    return runTwoStepBoundingBoxDetector(input, requestContext);
  }
  const { prompts } = await getAiPromptLabConfiguration();
  const sourcePrompt = prompts.find((prompt) => normalizedPromptVersion(prompt.version) === normalizedPromptVersion(input.sourceVersion));
  if (!sourcePrompt) throw new AiPromptLabError('Selected prompt is not available in the lab.', 422);
  if (input.mode === ONE_PASS_GEOMETRY_REFINED_MODE) {
    return runOnePassGeometryRefinedAiPromptLabAnalysis(input, sourcePrompt, requestContext);
  }
  if (input.mode === ONE_PASS_GEOMETRY_COMBINED_MODE) {
    return runOnePassGeometryCombinedAiPromptLabAnalysis(input, sourcePrompt, requestContext);
  }
  if (input.mode === TWO_STEP_V385_MODE) {
    const targetPrompt = requireTwoStepTargetPrompt(prompts);
    if (targetPrompt.version !== sourcePrompt.version) {
      throw new AiPromptLabError(`Two-step mode is pinned to v${TWO_STEP_V385_TARGET_VERSION}.`, 422);
    }
    if (input.sizingMode) {
      return runGridTwoStepAiPromptLabAnalysis(input, targetPrompt, requestContext);
    }
    return runTwoStepAiPromptLabAnalysis(input, targetPrompt, requestContext);
  }
  if (input.sizingMode) {
    return runGridOnePassAiPromptLabAnalysis(input, sourcePrompt, requestContext);
  }
  if (input.useDiameterAnchorSizing && (sourcePrompt.isActive || !/^v?3\.84$/i.test(sourcePrompt.version))) {
    throw new AiPromptLabError('Direct diameter-anchor sizing is only available with the staged v3.84 prompt.', 422);
  }

  const startedAt = performance.now();
  const sourceChecksumMatches = input.checksum === null || input.checksum === sourcePrompt.checksum;
  const submittedChecksum = checksumAnalysisPrompt(input.promptText);
  const productionEquivalent = isAiPromptLabProductionEquivalent(input, sourcePrompt);
  try {
    const execution = await runOnePassAiPromptLabAnalysis(input, sourcePrompt, requestContext);
    let pricing: Awaited<ReturnType<typeof runAiPromptLabPricing>> | null = null;
    const pricingErrors: string[] = [];
    if (!isRejectedGeneratedCakeAnalysis(execution.result)) {
      try {
        pricing = await runAiPromptLabPricing(execution.result);
      } catch (pricingError) {
        // A valid analysis is still valuable diagnostic output when database pricing is incomplete.
        pricingErrors.push(pricingError instanceof Error ? pricingError.message : 'Unknown pricing error.');
      }
    }
    return {
      rawResponse: execution.rawResponse,
      analysis: execution.result,
      pricing,
      executionTimeMs: Math.round(performance.now() - startedAt),
      effectiveSettings: execution.effectiveSettings,
      prompt: {
        sourceVersion: sourcePrompt.version,
        sourceChecksum: sourcePrompt.checksum,
        checksum: submittedChecksum,
        sourceChecksumMatches,
        isEdited: input.promptText !== sourcePrompt.text,
        sizeSchema: execution.sizeSchema,
        executionMode: productionEquivalent ? 'production_equivalent_uncached' : 'experiment',
      },
      validationErrors: [],
      pricingErrors,
    };
  } catch (error) {
    const rawResponse = error instanceof CakeAnalysisResponseError ? error.rawResponse : null;
    return {
      rawResponse,
      analysis: null,
      pricing: null,
      executionTimeMs: Math.round(performance.now() - startedAt),
      effectiveSettings: { ...input.decoding, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: {
        sourceVersion: sourcePrompt.version,
        sourceChecksum: sourcePrompt.checksum,
        checksum: submittedChecksum,
        sourceChecksumMatches,
        isEdited: input.promptText !== sourcePrompt.text,
        sizeSchema: input.useDiameterAnchorSizing ? 'ai_diameter_anchor' : undefined,
        executionMode: productionEquivalent ? 'production_equivalent_uncached' : 'experiment',
      },
      validationErrors: labErrorMessages(error),
      pricingErrors: [],
    };
  }
}

/** Useful to prove no image bytes are persisted in the lab boundary. */
export function fingerprintAiPromptLabImageForTests(imageData: string) {
  return createHash('sha256').update(imageData, 'base64').digest('hex');
}
