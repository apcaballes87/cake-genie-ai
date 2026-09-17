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
import { AI_THREE_BAND_SIZE_SCHEMA } from '@/lib/ai/analysisSize';
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
  GRID_SIZING_OUTPUT_RULES,
  addGridSizingToResponseSchema,
  appendGridSizingPrompt,
  appendGridSizingSystemRules,
  applyGridSizingToAnalysis,
  assertGridSizingPreserved,
  buildGridSizingPayload,
  createGridOverlay,
  type GridSizingPayload,
} from '@/lib/admin/gridSizing';
import { ThinkingLevel } from '@google/genai';

export const AI_PROMPT_LAB_MODEL = 'gemini-3.5-flash-lite' as const;
export const AI_PROMPT_LAB_THINKING_LEVEL = 'LOW' as const;
export const AI_PROMPT_LAB_DECODE = { temperature: 0, topP: 1, topK: 1 } as const;
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
  gridSizing?: unknown;
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
      : null;
  const twoStep = isRecord(body.twoStep) ? body.twoStep : {};
  const gridSizing = body.gridSizing === true;

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
  if (gridSizing && body.useDiameterAnchorSizing === true) {
    throw new AiPromptLabError('Grid sizing already owns the experimental sizing contract.');
  }
  if (!sourceVersion) throw new AiPromptLabError('Prompt source version is required.');
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
  if (asFiniteNumber(settings.temperature, 'temperature') !== AI_PROMPT_LAB_DECODE.temperature
    || asFiniteNumber(settings.topP, 'top-p') !== AI_PROMPT_LAB_DECODE.topP
    || asFiniteNumber(settings.topK, 'top-k') !== AI_PROMPT_LAB_DECODE.topK) {
    throw new AiPromptLabError('Unsupported decoding configuration.');
  }
  const inventoryPrompt = typeof twoStep.inventoryPrompt === 'string' ? twoStep.inventoryPrompt : '';
  const compilerPrompt = typeof twoStep.compilerPrompt === 'string' ? twoStep.compilerPrompt : '';
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

  return {
    imageData,
    mimeType,
    promptText,
    sourceVersion,
    model,
    thinkingLevel,
    checksum: typeof body.prompt.checksum === 'string' ? body.prompt.checksum : null,
    mode,
    twoStep: mode === TWO_STEP_V385_MODE ? { inventoryPrompt, compilerPrompt } : null,
    gridSizing,
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
  return sourcePrompt.isActive
    && input.promptText === sourcePrompt.text
    && input.model === AI_PROMPT_LAB_MODEL
    && input.thinkingLevel === AI_PROMPT_LAB_THINKING_LEVEL
    && !input.gridSizing
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
      gridSizing: { mode: GRID_SIZING_MODE, available: true },
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
    },
  };
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
  options: { required?: boolean } = {},
) {
  const baseConfig = buildSearchAnalysisGenerationConfig(typeEnums, 'ai_diameter_anchor');
  return addGridSizingToResponseSchema(
    baseConfig.responseSchema as unknown as Record<string, unknown>,
    options,
  );
}

function splitGridSizingResponse(
  value: unknown,
): { analysis: Record<string, unknown>; gridSizing: GridSizingPayload | null } {
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
  const gridSizing = buildGridSizingPayload(value.grid_sizing, bindings);
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
  return { analysis, gridSizing };
}

function gridPromptMetadata(
  sourcePrompt: LabPromptRecord,
  input: ReturnType<typeof validateAiPromptLabRequest>,
  promptText: string,
  executionMode: string,
) {
  return {
    sourceVersion: sourcePrompt.version,
    sourceChecksum: sourcePrompt.checksum,
    checksum: checksumAnalysisPrompt(promptText),
    sourceChecksumMatches: input.checksum === null || input.checksum === sourcePrompt.checksum,
    isEdited: true,
    sizeSchema: GRID_SIZING_MODE,
    executionMode,
    gridSizing: true,
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
  const augmentedPrompt = appendGridSizingPrompt(input.promptText);

  try {
    const overlay = await createGridOverlay(input.imageData);
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
        systemInstruction: appendGridSizingSystemRules(SYSTEM_INSTRUCTION),
        responseSchema: gridAnalysisResponseSchema(typeEnums, { required: false }),
        ...AI_PROMPT_LAB_DECODE,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawResponse = (response.text || '').trim();
    const { analysis: rawAnalysis, gridSizing: rawGridSizing } = splitGridSizingResponse(JSON.parse(rawResponse));
    const preValidationApplied = rawGridSizing
      ? applyGridSizingToAnalysis(rawAnalysis, rawGridSizing)
      : null;
    const validatedAnalysis = postProcessSearchAnalysisResult(
      preValidationApplied?.analysis ?? rawAnalysis,
      typeEnums,
      'ai_diameter_anchor',
    ) as unknown as Record<string, unknown>;
    const applied = rawGridSizing
      ? applyGridSizingToAnalysis(validatedAnalysis, rawGridSizing)
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
      analysis,
      gridSizing: applied?.gridSizing ?? null,
      gridOverlayPreview,
      pricing,
      executionTimeMs: Math.round(performance.now() - startedAt),
      effectiveSettings: { ...AI_PROMPT_LAB_DECODE, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: gridPromptMetadata(sourcePrompt, input, augmentedPrompt, 'grid_sizing_one_pass_experiment'),
      validationErrors: [],
      pricingErrors,
    };
  } catch (error) {
    return {
      rawResponse,
      analysis: null,
      gridSizing: null,
      gridOverlayPreview,
      pricing: null,
      executionTimeMs: Math.round(performance.now() - startedAt),
      effectiveSettings: { ...AI_PROMPT_LAB_DECODE, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
      prompt: gridPromptMetadata(sourcePrompt, input, augmentedPrompt, 'grid_sizing_one_pass_experiment'),
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
  const augmentedInventoryPrompt = appendGridSizingPrompt(input.twoStep!.inventoryPrompt);
  const augmentedCompilerPrompt = [
    input.twoStep!.compilerPrompt.trim(),
    GRID_SIZING_OUTPUT_RULES.trim(),
    'The compiler has no image. Copy the validated grid_sizing measurements from the immutable visual inventory exactly, then use them as the sizing authority for the final storefront rows.',
  ].join('\n\n');
  const augmentedReferencePrompt = appendGridSizingPrompt(sourcePrompt.text);
  const promptMetadata = () => ({
    ...gridPromptMetadata(sourcePrompt, input, `${augmentedInventoryPrompt}\n\n${augmentedCompilerPrompt}`, 'two_step_v385_grid_experiment'),
    targetVersion: TWO_STEP_V385_TARGET_VERSION,
    targetChecksum: TWO_STEP_V385_TARGET_CHECKSUM,
    inventoryChecksum: checksumAnalysisPrompt(augmentedInventoryPrompt),
    compilerChecksum: checksumAnalysisPrompt(augmentedCompilerPrompt),
    sourceChecksumMatches: input.checksum === null || input.checksum === sourcePrompt.checksum,
  });

  try {
    const overlay = await createGridOverlay(input.imageData);
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
        parts: visualInventoryRequestParts(overlay.mimeType, overlay.imageData, augmentedInventoryPrompt),
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: visualInventoryResponseSchema(true),
        systemInstruction: appendGridSizingSystemRules('Record only the supplied image evidence in the visual inventory.'),
        ...AI_PROMPT_LAB_DECODE,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawInventoryResponse = (inventoryResponse.text || '').trim();
    inventoryTimeMs = Math.round(performance.now() - stageOneStartedAt);
    let inventoryGridSizing: GridSizingPayload | null = null;
    try {
      inventory = validateVisualInventory(JSON.parse(rawInventoryResponse));
      if (!inventory.grid_sizing) throw new Error('Step 1 did not return grid_sizing.');
      inventoryGridSizing = buildGridSizingPayload(
        inventory.grid_sizing,
        inventory.observed_groups.map((group) => ({
          source_group_id: group.group_id,
          role: null,
          description: group.description,
          measurement: group.grid_sizing,
        })),
      );
    } catch (error) {
      throw stageError('Step 1 visual inventory', error, rawInventoryResponse);
    }

    const stageTwoStartedAt = performance.now();
    const compilerConfig = buildSearchAnalysisGenerationConfig(typeEnums, 'ai_diameter_anchor');
    const compilerResponse = await aiClient.models.generateContent({
      model: input.model,
      contents: [{
        role: 'user',
        parts: textOnlyCompilerRequestParts(augmentedCompilerPrompt, inventory, augmentedReferencePrompt),
      }],
      config: {
        ...compilerConfig,
        systemInstruction: appendGridSizingSystemRules('Compile only from the immutable visual inventory supplied in the request.'),
        responseSchema: addGridSizingToResponseSchema(
          compilerConfig.responseSchema as unknown as Record<string, unknown>,
        ),
        ...AI_PROMPT_LAB_DECODE,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawCompilerResponse = (compilerResponse.text || '').trim();
    compilerTimeMs = Math.round(performance.now() - stageTwoStartedAt);

    const { analysis: rawAnalysis, gridSizing: compiledGridSizing } = splitGridSizingResponse(JSON.parse(rawCompilerResponse));
    if (!compiledGridSizing) throw new Error('Step 2 did not return grid_sizing.');
    if (!inventoryGridSizing) throw new Error('Step 1 did not produce normalized grid sizing.');
    assertGridSizingPreserved(inventoryGridSizing, compiledGridSizing);
    assertCompiledAnalysisMatchesInventory(inventory, rawAnalysis);
    const preValidationApplied = applyGridSizingToAnalysis(rawAnalysis, compiledGridSizing);
    const validatedAnalysis = postProcessSearchAnalysisResult(
      preValidationApplied.analysis,
      typeEnums,
      'ai_diameter_anchor',
    ) as unknown as Record<string, unknown>;
    const applied = applyGridSizingToAnalysis(validatedAnalysis, compiledGridSizing);
    const analysis = {
      ...applied.analysis,
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
      inventory,
      analysis,
      gridSizing: applied.gridSizing,
      gridOverlayPreview,
      pricing,
      executionTimeMs: Math.round(performance.now() - startedAt),
      stageTimings: { inventoryMs: inventoryTimeMs, compilerMs: compilerTimeMs, totalMs: Math.round(performance.now() - startedAt) },
      effectiveSettings: { ...AI_PROMPT_LAB_DECODE, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
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
      effectiveSettings: { ...AI_PROMPT_LAB_DECODE, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
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
        ...AI_PROMPT_LAB_DECODE,
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
        ...AI_PROMPT_LAB_DECODE,
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
      effectiveSettings: { ...AI_PROMPT_LAB_DECODE, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
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
      effectiveSettings: { ...AI_PROMPT_LAB_DECODE, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
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
        ...AI_PROMPT_LAB_DECODE,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[input.thinkingLevel] },
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    });
    rawResponse = (response.text || '').trim();
    const result = postProcessSearchAnalysisResult(JSON.parse(rawResponse), typeEnums, sizeSchema);
    return {
      result: { ...result, analysis_size_schema: AI_THREE_BAND_SIZE_SCHEMA },
      rawResponse,
      effectiveSettings: { ...AI_PROMPT_LAB_DECODE, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
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

/** Executes an isolated analysis request. It never creates Gemini prompt cache entries or persistence records. */
export async function runAiPromptLabAnalysis(body: unknown, requestContext?: Request) {
  const input = validateAiPromptLabRequest(body);
  const { prompts } = await getAiPromptLabConfiguration();
  const sourcePrompt = prompts.find((prompt) => normalizedPromptVersion(prompt.version) === normalizedPromptVersion(input.sourceVersion));
  if (!sourcePrompt) throw new AiPromptLabError('Selected prompt is not available in the lab.', 422);
  if (input.mode === TWO_STEP_V385_MODE) {
    const targetPrompt = requireTwoStepTargetPrompt(prompts);
    if (targetPrompt.version !== sourcePrompt.version) {
      throw new AiPromptLabError(`Two-step mode is pinned to v${TWO_STEP_V385_TARGET_VERSION}.`, 422);
    }
    if (input.gridSizing) {
      return runGridTwoStepAiPromptLabAnalysis(input, targetPrompt, requestContext);
    }
    return runTwoStepAiPromptLabAnalysis(input, targetPrompt, requestContext);
  }
  if (input.gridSizing) {
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
      effectiveSettings: { ...AI_PROMPT_LAB_DECODE, model: input.model, thinkingLevel: input.thinkingLevel, usedPromptCache: false },
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
