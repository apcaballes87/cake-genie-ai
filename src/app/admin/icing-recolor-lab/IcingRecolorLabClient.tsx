'use client';

import NextImage from 'next/image';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, RotateCcw, SlidersHorizontal, Sparkles, Upload } from 'lucide-react';

import { COLORS } from '@/constants';
import { ICING_CONVERSION_PROMPT } from '@/lib/icingConversionPrompt';
import { buildAdjustedIcingLayer } from '@/lib/icingLayerComposite';
import { constrainDimensions, rgbToHsl } from '@/lib/instantIcingRecolor';
import { editCakeImage, fileToBase64 } from '@/services/geminiService';

type RenderStats = {
  renderDurationMs: number;
  width: number;
  height: number;
  scale: number;
  hasGeneratedLayer: boolean;
};

const PREVIEW_MAX_DIMENSION = 1200;
const DEFAULT_LAYER_COLOR = '#FF0000';
const ICING_LAYER_SYSTEM_INSTRUCTION = [
  'You are a precise cake image editor.',
  'Follow the user prompt exactly and return only one edited image.',
  'Preserve the exact original framing, crop, perspective, cake scale, and cake position from the uploaded image.',
  'Do not re-center, zoom, rotate, extend, or restage the cake composition.',
  'The output should work as a clean icing-only overlay layer when black pixels are keyed out.',
].join(' ');

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  const parsed = Number.parseInt(value, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function getLayerColorAdjustments(targetHex: string) {
  const baseRgb = hexToRgb(DEFAULT_LAYER_COLOR);
  const targetRgb = hexToRgb(targetHex);
  const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
  const targetHsl = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);

  return {
    hueShift: targetHsl.h - baseHsl.h,
    saturationShift: Math.round((targetHsl.s - baseHsl.s) * 100),
    lightnessShift: Math.round((targetHsl.l - baseHsl.l) * 100),
  };
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function loadImageElement(
  src: string,
  cache: Map<string, HTMLImageElement>
): Promise<HTMLImageElement> {
  const cached = cache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }

  return new Promise((resolve, reject) => {
    const image = cached ?? new window.Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
    };

    image.onload = () => {
      cleanup();
      cache.set(src, image);
      resolve(image);
    };

    image.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image asset: ${src.slice(0, 48)}...`));
    };

    if (!cached) {
      image.src = src;
    }
  });
}

export default function IcingRecolorLabClient() {
  const [baseImageUrl, setBaseImageUrl] = useState<string | null>(null);
  const [baseImageName, setBaseImageName] = useState<string | null>(null);
  const [originalImagePayload, setOriginalImagePayload] = useState<{
    data: string;
    mimeType: string;
  } | null>(null);
  const [promptText, setPromptText] = useState(ICING_CONVERSION_PROMPT);
  const [baseImageDimensions, setBaseImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [generatedLayerUrl, setGeneratedLayerUrl] = useState<string | null>(null);
  const [selectedLayerColor, setSelectedLayerColor] = useState(DEFAULT_LAYER_COLOR);
  const [generationDurationMs, setGenerationDurationMs] = useState<number | null>(null);
  const [renderStats, setRenderStats] = useState<RenderStats | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const generationRequestIdRef = useRef(0);

  function startGenerationRequest() {
    const requestId = generationRequestIdRef.current + 1;
    generationRequestIdRef.current = requestId;
    setIsGenerating(true);
    setGeneratedLayerUrl(null);
    setGenerationDurationMs(null);
    setErrorMessage(null);

    return requestId;
  }

  async function generateLayerFromPrompt(
    originalImage: { data: string; mimeType: string },
    requestId: number,
    promptOverride?: string
  ) {
    const trimmedPrompt = (promptOverride ?? promptText).trim();

    if (!trimmedPrompt) {
      throw new Error('Prompt is empty. Add a prompt before generating the Gemini layer.');
    }

    const startedAt = performance.now();
    const generatedLayer = await editCakeImage(
      trimmedPrompt,
      originalImage,
      [],
      [],
      null,
      ICING_LAYER_SYSTEM_INSTRUCTION,
      'gemini-2.5-flash-image',
      `icing-layer-${Date.now()}`,
      'icing-recolor-lab'
    );

    if (generationRequestIdRef.current !== requestId) {
      return;
    }

    setGeneratedLayerUrl(generatedLayer);
    setGenerationDurationMs(performance.now() - startedAt);
  }

  async function handleBaseImageUpload(file: File | null) {
    if (!file) return;

    const requestId = startGenerationRequest();

    try {
      const [baseImageDataUrl, originalImage] = await Promise.all([
        readFileAsDataUrl(file),
        fileToBase64(file),
      ]);

      if (generationRequestIdRef.current !== requestId) {
        return;
      }

      setBaseImageUrl(baseImageDataUrl);
      setBaseImageName(file.name);
      setOriginalImagePayload(originalImage);

      const tempImage = new window.Image();
      tempImage.onload = () => {
        if (generationRequestIdRef.current !== requestId) {
          return;
        }

        setBaseImageDimensions({
          width: tempImage.naturalWidth,
          height: tempImage.naturalHeight,
        });
      };
      tempImage.src = baseImageDataUrl;

      await generateLayerFromPrompt(originalImage, requestId);
    } catch (error) {
      if (generationRequestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to generate the Gemini icing layer.'
      );
    } finally {
      if (generationRequestIdRef.current === requestId) {
        setIsGenerating(false);
      }
    }
  }

  async function handleRegenerateLayer() {
    if (!originalImagePayload) {
      setErrorMessage('Upload a cake image before regenerating the Gemini layer.');
      return;
    }

    const requestId = startGenerationRequest();

    try {
      await generateLayerFromPrompt(originalImagePayload, requestId);
    } catch (error) {
      if (generationRequestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to regenerate the Gemini icing layer.'
      );
    } finally {
      if (generationRequestIdRef.current === requestId) {
        setIsGenerating(false);
      }
    }
  }

  function handleClearAll() {
    generationRequestIdRef.current += 1;
    setBaseImageUrl(null);
    setBaseImageName(null);
    setOriginalImagePayload(null);
    setPromptText(ICING_CONVERSION_PROMPT);
    setBaseImageDimensions(null);
    setGeneratedLayerUrl(null);
    setSelectedLayerColor(DEFAULT_LAYER_COLOR);
    setGenerationDurationMs(null);
    setRenderStats(null);
    setErrorMessage(null);
    setIsGenerating(false);
    imageCacheRef.current.clear();

    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  function handleDownloadPreview() {
    const canvas = previewCanvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'icing-layer-preview.png';
      anchor.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  const layerAdjustments = getLayerColorAdjustments(selectedLayerColor);

  useEffect(() => {
    let cancelled = false;

    async function renderPreview() {
      const previewCanvas = previewCanvasRef.current;
      if (!previewCanvas) return;

      if (!baseImageUrl) {
        const previewContext = previewCanvas.getContext('2d');
        previewContext?.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        setRenderStats(null);
        return;
      }

      setIsRendering(true);

      try {
        const startedAt = performance.now();
        const baseImage = await loadImageElement(baseImageUrl, imageCacheRef.current);
        const naturalWidth = baseImage.naturalWidth || baseImage.width;
        const naturalHeight = baseImage.naturalHeight || baseImage.height;
        const dimensions = constrainDimensions(
          naturalWidth,
          naturalHeight,
          PREVIEW_MAX_DIMENSION
        );

        const workCanvas = document.createElement('canvas');
        workCanvas.width = dimensions.width;
        workCanvas.height = dimensions.height;

        const workContext = workCanvas.getContext('2d', { willReadFrequently: true });
        if (!workContext) {
          throw new Error('Could not create working canvas context');
        }

        workContext.drawImage(baseImage, 0, 0, dimensions.width, dimensions.height);

        if (generatedLayerUrl) {
          const generatedLayerImage = await loadImageElement(
            generatedLayerUrl,
            imageCacheRef.current
          );
          const layerCanvas = document.createElement('canvas');
          layerCanvas.width = dimensions.width;
          layerCanvas.height = dimensions.height;

          const layerContext = layerCanvas.getContext('2d', { willReadFrequently: true });
          if (!layerContext) {
            throw new Error('Could not create generated layer context');
          }

          layerContext.drawImage(
            generatedLayerImage,
            0,
            0,
            dimensions.width,
            dimensions.height
          );

          const layerImageData = layerContext.getImageData(
            0,
            0,
            dimensions.width,
            dimensions.height
          );
          const adjustedLayer = buildAdjustedIcingLayer(layerImageData.data, {
            hueShift: layerAdjustments.hueShift,
            saturationShift: layerAdjustments.saturationShift,
            lightnessShift: layerAdjustments.lightnessShift,
          });
          const adjustedImageData = new ImageData(
            Uint8ClampedArray.from(adjustedLayer),
            dimensions.width,
            dimensions.height
          );

          layerContext.clearRect(0, 0, dimensions.width, dimensions.height);
          layerContext.putImageData(adjustedImageData, 0, 0);
          workContext.drawImage(layerCanvas, 0, 0);
        }

        const previewContext = previewCanvas.getContext('2d');
        if (!previewContext) {
          throw new Error('Could not create preview canvas context');
        }

        previewCanvas.width = dimensions.width;
        previewCanvas.height = dimensions.height;
        previewContext.clearRect(0, 0, dimensions.width, dimensions.height);
        previewContext.drawImage(workCanvas, 0, 0);

        if (!cancelled) {
          setRenderStats({
            renderDurationMs: performance.now() - startedAt,
            width: dimensions.width,
            height: dimensions.height,
            scale: dimensions.scale,
            hasGeneratedLayer: Boolean(generatedLayerUrl),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to render the layered preview.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    void renderPreview();

    return () => {
      cancelled = true;
    };
  }, [baseImageUrl, generatedLayerUrl, layerAdjustments.hueShift, layerAdjustments.lightnessShift, layerAdjustments.saturationShift]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">
              Internal Lab
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Gemini Icing Overlay Lab
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Upload one cake image and the lab automatically asks Gemini to generate the red
              icing conversion layer. The preview then keys out the black pixels and recolors only
              that generated top layer with the same color-swatch style used in the customizer.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatChip
              label="Layer Status"
              value={isGenerating ? 'Generating' : generatedLayerUrl ? 'Ready' : 'Waiting'}
              icon={Sparkles}
            />
            <StatChip
              label="Gemini Time"
              value={generationDurationMs ? `${Math.round(generationDurationMs)} ms` : '—'}
              icon={Loader2}
            />
            <StatChip
              label="Preview Size"
              value={renderStats ? `${renderStats.width} × ${renderStats.height}` : '—'}
              icon={SlidersHorizontal}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-6">
          <PanelCard
            title="Upload"
            description="Choose a cake image and the Gemini layer generation starts automatically."
          >
            <div className="space-y-4">
              <UploadField
                label="Cake image"
                helperText="The uploaded image becomes the base layer. Gemini generates a red icing-only layer from it using the current prompt shown below."
                fileName={baseImageName}
                buttonLabel={isGenerating ? 'Generating layer...' : 'Upload cake image'}
                onFileSelect={handleBaseImageUpload}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleRegenerateLayer}
                  disabled={!originalImagePayload || isGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? 'Generating Layer...' : 'Generate Layer'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPreview}
                  disabled={!baseImageUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Download Preview
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPromptText(ICING_CONVERSION_PROMPT)}
                  disabled={promptText === ICING_CONVERSION_PROMPT}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset Prompt
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset Lab
                </button>
              </div>
            </div>
          </PanelCard>

          <PanelCard
            title="Prompt"
            description="This prompt is the main reason Gemini either preserves the original image or re-synthesizes it. Edit it here, then regenerate against the same uploaded image."
          >
            <div className="space-y-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">Current prompt</span>
                <textarea
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  spellCheck={false}
                  rows={12}
                  className="min-h-[260px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />
              </label>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>Characters: {promptText.length}</span>
                <span>Use “Generate Layer” to test edits without re-uploading.</span>
              </div>
            </div>
          </PanelCard>

          <PanelCard
            title="Notes"
            description="This page is intentionally narrow and test-focused."
          >
            <ul className="space-y-2 text-sm leading-6 text-slate-600">
              <li>Gemini generates a red icing-only reference image using whatever prompt is currently in the prompt box.</li>
              <li>Black pixels from that generated image are automatically keyed out so the original decorations and background show through underneath.</li>
              <li>The color-circle picker recolors only the generated overlay layer, not the original uploaded image.</li>
            </ul>
          </PanelCard>
        </section>

        <section className="space-y-6">
          <PanelCard
            title="Preview"
            description="Compare the original base image, the plain Gemini-generated layer, and the final layered overlay result."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <PreviewFrame title="Original Image">
                {baseImageUrl ? (
                  <NextImage
                    src={baseImageUrl}
                    alt="Original uploaded cake"
                    width={baseImageDimensions?.width ?? 1200}
                    height={baseImageDimensions?.height ?? 1200}
                    unoptimized
                    className="max-h-[560px] h-auto w-full rounded-2xl bg-white object-contain"
                  />
                ) : (
                  <EmptyPreview copy="Upload a cake image to start the experiment." />
                )}
              </PreviewFrame>

              <PreviewFrame title="Generated Gemini Layer">
                {generatedLayerUrl ? (
                  <NextImage
                    src={generatedLayerUrl}
                    alt="Generated Gemini icing layer"
                    width={baseImageDimensions?.width ?? 1200}
                    height={baseImageDimensions?.height ?? 1200}
                    unoptimized
                    className="max-h-[560px] h-auto w-full rounded-2xl bg-black object-contain"
                  />
                ) : isGenerating ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
                    <p>Generating the plain Gemini layer...</p>
                  </div>
                ) : (
                  <EmptyPreview copy="The plain generated layer will appear here before transparency keying and color-swatch recolor." />
                )}
              </PreviewFrame>

              <PreviewFrame title="Layered Overlay Preview">
                {baseImageUrl ? (
                  <div className="relative">
                    <canvas
                      ref={previewCanvasRef}
                      className="max-h-[560px] w-full rounded-2xl bg-white object-contain"
                    />
                    {isGenerating ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-sm">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Gemini layer...
                        </div>
                      </div>
                    ) : null}
                    {!isGenerating && isRendering ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/55 backdrop-blur-sm">
                        <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                          Rendering preview...
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyPreview copy="The layered preview will appear here after upload and Gemini generation." />
                )}
              </PreviewFrame>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Layer Color Controls</h3>
                <p className="text-sm leading-6 text-slate-600">
                  These color circles affect only the Gemini-generated icing layer sitting above the original photo.
                </p>
              </div>
              <LayerColorSwatches
                selectedColor={selectedLayerColor}
                onSelectColor={setSelectedLayerColor}
              />
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Current Snapshot</h3>
              <dl className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <dt>Original dimensions</dt>
                  <dd className="font-medium text-slate-900">
                    {baseImageDimensions
                      ? `${baseImageDimensions.width} × ${baseImageDimensions.height}`
                      : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Generated overlay</dt>
                  <dd className="font-medium text-slate-900">
                    {generatedLayerUrl ? 'Ready' : isGenerating ? 'Generating' : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Selected layer color</dt>
                  <dd className="flex items-center gap-2 font-medium text-slate-900">
                    <span
                      className="h-4 w-4 rounded-full border border-slate-200"
                      style={{ backgroundColor: selectedLayerColor }}
                    />
                    {COLORS.find((color) => color.hex.toLowerCase() === selectedLayerColor.toLowerCase())?.name ?? selectedLayerColor}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Preview render time</dt>
                  <dd className="font-medium text-slate-900">
                    {renderStats ? `${Math.round(renderStats.renderDurationMs)} ms` : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Effective scale</dt>
                  <dd className="font-medium text-slate-900">
                    {renderStats ? `${Math.round(renderStats.scale * 100)}%` : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </PanelCard>
        </section>
      </div>
    </div>
  );
}

function PanelCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function LayerColorSwatches({
  selectedColor,
  onSelectColor,
}: {
  selectedColor: string;
  onSelectColor: (colorHex: string) => void;
}) {
  const selectedColorName = COLORS.find(
    (color) => color.hex.toLowerCase() === selectedColor.toLowerCase()
  )?.name ?? 'Custom';

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/90 p-3">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 shrink-0 rounded-full border-2 border-white shadow-md ring-1 ring-slate-100"
          style={{ backgroundColor: selectedColor }}
          aria-hidden="true"
        />
        <div className="w-px self-stretch bg-slate-100" />
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 py-0.5 px-1 min-w-max">
            {COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => onSelectColor(color.hex)}
                className="group relative flex shrink-0 flex-col items-center gap-1 transition-transform active:scale-95"
                title={color.name}
                aria-label={`Select ${color.name} color`}
              >
                <div
                  className={`h-[27px] w-[27px] rounded-full border shadow-sm transition-all md:h-8 md:w-8 ${
                    selectedColor.toLowerCase() === color.hex.toLowerCase()
                      ? 'border-slate-300 ring-2 ring-slate-300'
                      : 'border-slate-100 group-hover:shadow-md group-hover:ring-2 group-hover:ring-purple-200'
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  {color.hex.toLowerCase() === '#ffffff' ? (
                    <span className="block h-full w-full rounded-full border border-slate-300" />
                  ) : null}
                </div>
                <span className="text-[7px] font-medium whitespace-nowrap text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                  {color.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Selected: <span className="font-medium text-slate-700">{selectedColorName}</span>
      </p>
    </div>
  );
}

function UploadField({
  label,
  helperText,
  fileName,
  buttonLabel,
  onFileSelect,
}: {
  label: string;
  helperText: string;
  fileName: string | null;
  buttonLabel: string;
  onFileSelect: (file: File | null) => void;
}) {
  return (
    <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <span className="text-sm font-medium text-slate-900">{label}</span>
          <p className="text-xs leading-5 text-slate-500">{helperText}</p>
          {fileName ? (
            <p className="text-xs font-medium text-slate-700">Loaded: {fileName}</p>
          ) : null}
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
          <Upload className="h-4 w-4" />
          {buttonLabel}
        </div>
      </div>
      <input
        type="file"
        accept="image/png,image/webp,image/jpeg"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
        className="sr-only"
      />
    </label>
  );
}

function PreviewFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,249,255,0.82))] p-3">
        {children}
      </div>
    </div>
  );
}

function EmptyPreview({ copy }: { copy: string }) {
  return (
    <div className="mx-auto max-w-sm text-center text-sm leading-6 text-slate-500">
      {copy}
    </div>
  );
}
