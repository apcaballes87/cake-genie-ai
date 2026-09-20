/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronDown, Copy, ImagePlus, Loader2,
  Grid3X3, Play, RefreshCcw, ShieldCheck, Sparkles, Upload, X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import { supportTypeDisplayMap, topperTypeDisplayMap } from '@/components/TopperCard';
import { BoundingBoxGeometryEditor, type BoundingBoxGeometry } from '@/components/admin/BoundingBoxGeometryEditor';

const ENDPOINT = '/api/admin/ai-prompt-lab';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type PromptRecord = {
  id: string;
  version: string;
  isActive: boolean;
  text: string;
  checksum: string | null;
};

type CoordinateSizingMode = 'grid_20' | 'cartesian_4q';
type PromptLabSizingMode = CoordinateSizingMode | 'none';

type CoordinatePromptSettings = {
  editablePrompt: string;
  promptMarkerStart: string;
  promptMarkerEnd: string;
} | null;

type LabSettings = {
  models: Array<{ id: string; thinkingLevels: string[] }>;
  defaultModel: string;
  defaultThinkingLevel: string;
  decoding: { temperature: number; topP: number; topK: number };
  gridSizing: CoordinatePromptSettings;
  cartesianSizing: CoordinatePromptSettings;
  twoStep: {
    targetVersion: string;
    targetChecksum: string;
    targetAvailable: boolean;
    inventoryPrompt: string;
    compilerPrompt: string;
  } | null;
  twoStepBoundingBoxes: { identificationPrompt: string; boundingBoxPrompt: string } | null;
  onePassGeometryRefinement: { geometryPrompt: string } | null;
  onePassGeometryCombined: { combinedPrompt: string } | null;
};

type ImagePayload = { data: string; mimeType: string; name: string };
type LabResponse = Record<string, unknown>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function toBoundingBoxGeometry(value: unknown): BoundingBoxGeometry | null {
  const geometry = record(value);
  if (!geometry) return null;
  const sourceElements = Array.isArray(geometry.elements) ? geometry.elements : Array.isArray(geometry.toppers) ? geometry.toppers : null;
  if (!sourceElements || !record(geometry.cake_diameter_line) || !record(geometry.cake_height_line)) return null;
  return {
    cake_diameter_line: geometry.cake_diameter_line as BoundingBoxGeometry['cake_diameter_line'],
    cake_height_line: geometry.cake_height_line as BoundingBoxGeometry['cake_height_line'],
    elements: sourceElements.map(record).filter((item): item is Record<string, unknown> => Boolean(item)).map((item) => ({
      element_id: String(item.element_id ?? ''), label: String(item.label ?? item.type ?? item.element_id ?? ''),
      category: typeof item.category === 'string' ? item.category : typeof item.type === 'string' ? item.type : undefined,
      box_2d: item.box_2d as [number, number, number, number], confidence: Number(item.confidence),
    })),
  };
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function typeLabel(type: unknown, kind: 'topper' | 'support'): string {
  if (typeof type !== 'string' || !type) return 'Unclassified item';
  const labels: Record<string, string> = kind === 'topper' ? topperTypeDisplayMap : supportTypeDisplayMap;
  return labels[type] ?? titleCase(type);
}

function colorValues(item: Record<string, unknown>): string[] {
  const colors = Array.isArray(item.colors) ? item.colors : [item.color];
  return colors.filter((color): color is string => typeof color === 'string' && color.trim().length > 0);
}

function isCssColor(value: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^(?:rgb|hsl)a?\(/i.test(value);
}

function php(value: unknown): string {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? `₱${number.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—';
}

function formatElapsed(milliseconds: number) {
  const totalTenths = Math.floor(milliseconds / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${totalTenths % 10}`;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}

function normalizePrompts(json: Record<string, unknown>): PromptRecord[] {
  const candidates = Array.isArray(json.prompts) ? json.prompts : Array.isArray(json.data) ? json.data : [];
  return candidates.map(record).filter((value): value is Record<string, unknown> => Boolean(value)).map((item) => ({
    id: String(item.id ?? item.version ?? ''),
    version: String(item.version ?? ''),
    isActive: Boolean(item.isActive ?? item.is_active),
    text: String(item.text ?? item.prompt ?? item.prompt_text ?? ''),
    checksum: item.checksum ?? item.md5 ?? null ? String(item.checksum ?? item.md5) : null,
  }));
}

function normalizeSettings(json: Record<string, unknown>): LabSettings {
  const raw = record(json.settings) ?? {};
  const objectModels = (Array.isArray(raw.models) ? raw.models : []).map(record).filter((item): item is Record<string, unknown> => Boolean(item)).map((item) => {
    const modelThinkingLevels = item.thinkingLevels ?? item.thinking_levels;
    return {
      id: String(item.id ?? item.model ?? ''),
      thinkingLevels: (Array.isArray(modelThinkingLevels) ? modelThinkingLevels : []).map(String),
    };
  }).filter((item) => item.id);
  const levelsByModel = record(raw.thinkingLevelsByModel ?? raw.thinking_levels_by_model) ?? {};
  const stringModels = (Array.isArray(raw.models) ? raw.models : []).filter((item): item is string => typeof item === 'string').map((id) => ({
    id,
    thinkingLevels: (Array.isArray(levelsByModel[id]) ? levelsByModel[id] : []).map(String),
  }));
  const models = objectModels.length ? objectModels : stringModels;
  const decoding = record(raw.decoding ?? raw.decode) ?? {};
  const twoStep = record(raw.twoStep);
  const twoStepBoundingBoxes = record(raw.twoStepBoundingBoxes);
  const onePassGeometryRefinement = record(raw.onePassGeometryRefinement);
  const onePassGeometryCombined = record(raw.onePassGeometryCombined);
  const gridSizing = record(raw.gridSizing);
  const cartesianSizing = record(raw.cartesianSizing);
  const normalizeCoordinateSettings = (value: Record<string, unknown> | null): CoordinatePromptSettings => value ? {
    editablePrompt: String(value.editablePrompt ?? ''),
    promptMarkerStart: String(value.promptMarkerStart ?? ''),
    promptMarkerEnd: String(value.promptMarkerEnd ?? ''),
  } : null;
  return {
    models: models.length ? models : [{ id: 'gemini-3.5-flash-lite', thinkingLevels: ['LOW'] }],
    defaultModel: String(raw.defaultModel ?? raw.default_model ?? models[0]?.id ?? 'gemini-3.5-flash-lite'),
    defaultThinkingLevel: String(raw.defaultThinkingLevel ?? raw.default_thinking_level ?? models[0]?.thinkingLevels[0] ?? 'LOW'),
    decoding: { temperature: Number(decoding.temperature ?? 0), topP: Number(decoding.topP ?? decoding.top_p ?? 1), topK: Number(decoding.topK ?? decoding.top_k ?? 1) },
    gridSizing: normalizeCoordinateSettings(gridSizing),
    cartesianSizing: normalizeCoordinateSettings(cartesianSizing),
    twoStep: twoStep ? {
      targetVersion: String(twoStep.targetVersion ?? ''),
      targetChecksum: String(twoStep.targetChecksum ?? ''),
      targetAvailable: Boolean(twoStep.targetAvailable),
      inventoryPrompt: String(twoStep.inventoryPrompt ?? ''),
      compilerPrompt: String(twoStep.compilerPrompt ?? ''),
    } : null,
    twoStepBoundingBoxes: twoStepBoundingBoxes ? {
      identificationPrompt: String(twoStepBoundingBoxes.identificationPrompt ?? ''),
      boundingBoxPrompt: String(twoStepBoundingBoxes.boundingBoxPrompt ?? ''),
    } : null,
    onePassGeometryRefinement: onePassGeometryRefinement ? {
      geometryPrompt: String(onePassGeometryRefinement.geometryPrompt ?? ''),
    } : null,
    onePassGeometryCombined: onePassGeometryCombined ? {
      combinedPrompt: String(onePassGeometryCombined.combinedPrompt ?? ''),
    } : null,
  };
}

function stripCoordinateInstructions(prompt: string, coordinate: CoordinatePromptSettings): string {
  if (!coordinate?.promptMarkerStart || !coordinate.promptMarkerEnd) return prompt.trim();
  const start = prompt.indexOf(coordinate.promptMarkerStart);
  if (start < 0) return prompt.trim();
  const end = prompt.indexOf(coordinate.promptMarkerEnd, start);
  if (end < 0) return prompt.slice(0, start).trim();
  return `${prompt.slice(0, start)}${prompt.slice(end + coordinate.promptMarkerEnd.length)}`.trim();
}

function withCoordinateInstructions(prompt: string, coordinate: CoordinatePromptSettings): string {
  const base = stripCoordinateInstructions(prompt, coordinate);
  return coordinate?.editablePrompt.trim() ? [base, coordinate.editablePrompt.trim()].filter(Boolean).join('\n\n') : base;
}

function stripAllCoordinateInstructions(prompt: string, settings: LabSettings | null): string {
  if (!settings) return prompt.trim();
  return stripCoordinateInstructions(
    stripCoordinateInstructions(prompt, settings.gridSizing),
    settings.cartesianSizing,
  );
}

function ValueGrid({ title, data, children }: { title: string; data: Record<string, unknown> | null; children?: ReactNode }) {
  if (!data) return null;
  return <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-bold text-gray-900">{title}</h3><dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">{Object.entries(data).map(([key, value]) => <div key={key}><dt className="text-xs font-medium capitalize text-gray-500">{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</dt><dd className="mt-0.5 break-words font-medium text-gray-900">{display(value)}</dd></div>)}</dl>{children}</section>;
}

function ItemCards({ title, items }: { title: string; items: Record<string, unknown>[] }) {
  return <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-bold text-gray-900">{title} <span className="font-normal text-gray-500">({items.length})</span></h3>{items.length ? <div className="grid gap-3 sm:grid-cols-2">{items.map((item, index) => <div key={`${title}-${index}`} className="rounded-xl bg-violet-50 p-3 text-sm">{Object.entries(item).filter(([key, value]) => typeof value !== 'object' || key === 'selectedRule').slice(0, 8).map(([key, value]) => <p key={key} className="flex gap-2"><span className="min-w-24 text-xs capitalize text-gray-500">{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</span><span className="break-words font-medium text-gray-800">{display(value)}</span></p>)}</div>)}</div> : <p className="text-sm text-gray-500">No {title.toLowerCase()} detected.</p>}</section>;
}

function AnalysisItemCards({ title, items, kind, priceKeyPrefix, itemPrices }: { title: string; items: Record<string, unknown>[]; kind: 'topper' | 'support'; priceKeyPrefix?: string; itemPrices?: Record<string, number> }) {
  const totalQuantity = items.reduce((total, item) => total + (typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1), 0);
  return <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
    <h3 className="mb-3 text-sm font-bold text-gray-900">{title} <span className="font-normal text-gray-500">({items.length}{items.length ? ` item${items.length === 1 ? '' : 's'} · ${totalQuantity} total` : ''})</span></h3>
    {items.length ? <div className="space-y-2">{items.map((item, index) => {
      const description = typeof item.description === 'string' && item.description.trim() ? item.description : typeLabel(item.type, kind);
      const colors = colorValues(item);
      const sizing = item.coverage ?? item.size;
      const geometry = item.geometry ?? item.size_line ?? item.bbox;
      const itemPrice = itemPrices?.[`${priceKeyPrefix ?? kind}:${index}`];
      return <article key={`${title}-${index}`} className="overflow-hidden rounded-xl border border-purple-100 bg-white shadow-sm">
        <div className="flex items-start gap-3 bg-purple-50/70 p-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold text-slate-900">{titleCase(description)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-500">
              <span>{typeLabel(item.type, kind)}</span>
              {typeof sizing === 'string' && <><span className="text-slate-300">•</span><span className="capitalize">{sizing}</span></>}
              {typeof item.quantity === 'number' && <><span className="text-slate-300">•</span><span>× {item.quantity}</span></>}
            </div>
          </div>
          {Number.isFinite(itemPrice) && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{php(itemPrice)}</span>}
        </div>
        <div className="grid gap-x-4 gap-y-2 p-3 text-xs sm:grid-cols-2">
          <p><span className="text-slate-500">Type</span><br /><code className="break-words text-[11px] text-slate-800">{display(item.type)}</code></p>
          {typeof item.material === 'string' && <p><span className="text-slate-500">Material</span><br /><span className="font-medium text-slate-800">{titleCase(item.material)}</span></p>}
          {typeof item.classification === 'string' && <p><span className="text-slate-500">Classification</span><br /><span className="font-medium capitalize text-slate-800">{item.classification}</span></p>}
          {typeof item.subtype === 'string' && <p><span className="text-slate-500">Subtype</span><br /><span className="font-medium capitalize text-slate-800">{titleCase(item.subtype)}</span></p>}
          {colors.length > 0 && <p className="sm:col-span-2"><span className="text-slate-500">Color{colors.length === 1 ? '' : 's'}</span><br /><span className="mt-1 flex flex-wrap gap-1.5">{colors.map((color, colorIndex) => <span key={`${color}-${colorIndex}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">{isCssColor(color) && <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color }} />}{color}</span>)}</span></p>}
        </div>
        {Boolean(geometry) && <details className="border-t border-purple-100 px-3 py-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-slate-700">Sizing geometry</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px]">{JSON.stringify(geometry, null, 2)}</pre></details>}
      </article>;
    })}</div> : <p className="text-sm text-gray-500">No {title.toLowerCase()} detected.</p>}
  </section>;
}

function parseRawAnalysis(value: unknown): Record<string, unknown> | null {
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  const response = record(parsed);
  return record(response?.analysis) ?? response;
}

function UnvalidatedAnalysisNotice({ rawAnalysis }: { rawAnalysis: Record<string, unknown> | null }) {
  const rawToppers = list(rawAnalysis?.main_toppers ?? rawAnalysis?.mainToppers);
  const rawSupport = list(rawAnalysis?.support_elements ?? rawAnalysis?.supportElements);
  const rawMessages = list(rawAnalysis?.cake_messages ?? rawAnalysis?.messages);
  return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
    <h3 className="text-sm font-bold text-amber-950">Post-processed cake analysis unavailable</h3>
    <p className="mt-1 text-sm text-amber-900">The raw model JSON was received, but it did not pass the storefront validation contract. Its items are intentionally not rendered as validated toppers or priced.</p>
    {rawAnalysis && <p className="mt-3 text-sm font-medium text-amber-950">Raw response inventory: {rawToppers.length} main toppers · {rawSupport.length} support elements · {rawMessages.length} messages</p>}
  </section>;
}

function formatGridBox(value: unknown): string {
  const box = record(value);
  const topLeft = gridPoint(box?.top_left);
  const bottomRight = gridPoint(box?.bottom_right);
  if (!topLeft || !bottomRight) return '—';
  return `(${topLeft.x.toFixed(2)}, ${topLeft.y.toFixed(2)}) → (${bottomRight.x.toFixed(2)}, ${bottomRight.y.toFixed(2)})`;
}

function GridSizingSummary({ value, coordinateMode }: { value: Record<string, unknown> | null; coordinateMode: CoordinateSizingMode }) {
  if (!value) return null;
  const items = list(value?.items);
  const isCartesian = coordinateMode === 'cartesian_4q';
  return <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
    <div className="flex items-start gap-2">
      <Grid3X3 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
      <div><h3 className="text-sm font-bold text-cyan-950">{isCartesian ? 'Cartesian plane bbox-area sizing' : '20×20 grid bbox-area sizing'}</h3><p className="mt-1 text-xs text-cyan-900">Every size-bearing priced row must return a valid representative bbox. Ratios and categories below are recalculated by the application from box area ÷ cake area.</p></div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-white p-3 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-cyan-700">Top-tier diameter</p><p className="font-bold text-cyan-950">{display(value.diameter_units)} {isCartesian ? 'coordinate units' : 'grid units'}</p></div>
        <div><p className="text-xs text-cyan-700">Top-tier height</p><p className="font-bold text-cyan-950">{display(value.height_units)} {isCartesian ? 'coordinate units' : 'grid units'}</p></div>
        <div><p className="text-xs text-cyan-700">Cake reference area</p><p className="font-bold text-cyan-950">{display(value.cake_reference_area_units)} grid²</p></div>
        <div><p className="text-xs text-cyan-700">Method</p><p className="font-bold text-cyan-950">Box area ÷ cake area</p></div>
    </div>
    {items.length > 0 && <div className="mt-3 overflow-x-auto rounded-xl border border-cyan-200 bg-white"><table className="min-w-full text-left text-xs"><thead className="bg-cyan-100 text-cyan-950"><tr><th className="px-3 py-2">Box · item</th><th className="px-3 py-2">Snapped {isCartesian ? 'Cartesian' : 'grid'} bbox: top-left → bottom-right</th><th className="px-3 py-2">Box area</th><th className="px-3 py-2">Area ratio</th><th className="px-3 py-2">Category</th></tr></thead><tbody>{items.map((item, index) => { const color = GRID_MEASUREMENT_COLORS[index % GRID_MEASUREMENT_COLORS.length]; return <tr key={String(item.source_group_id ?? index)} className="border-t border-cyan-100"><td className="max-w-52 px-3 py-2 font-medium text-slate-800"><div className="flex items-start gap-2"><span aria-label={`Box ${index + 1}`} className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[11px] font-bold" style={{ borderColor: color, color }}>{index + 1}</span><span>{display(item.description)}</span></div></td><td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600">{formatGridBox(item.bbox)}</td><td className="px-3 py-2 text-slate-600">{display(item.bbox_area_units)} {isCartesian ? 'coordinate²' : 'grid²'}</td><td className="px-3 py-2 font-mono text-slate-600">{typeof item.ratio === 'number' ? item.ratio.toFixed(4) : display(item.ratio)}</td><td className="px-3 py-2 font-bold capitalize text-cyan-800">{display(item.category)}</td></tr>; })}</tbody></table></div>}
  </section>;
}

const GRID_LABELS = Array.from({ length: 20 }, (_, index) => index + 1);
const GRID_LINES = Array.from({ length: 21 }, (_, index) => index);
const CARTESIAN_COORDINATES = Array.from({ length: 21 }, (_, index) => index - 10);
const GRID_MEASUREMENT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

function gridPoint(value: unknown): { x: number; y: number } | null {
  const point = record(value);
  const x = Number(point?.x);
  const y = Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function overlayPoint(value: unknown, coordinateMode: CoordinateSizingMode): { x: number; y: number } | null {
  const point = gridPoint(value);
  if (!point) return null;
  return coordinateMode === 'cartesian_4q'
    ? { x: point.x + 10, y: 10 - point.y }
    : point;
}

function openImageDataUrl(dataUrl: string) {
  const [header, encoded] = dataUrl.split(',', 2);
  const mimeType = /^data:([^;]+);base64$/i.exec(header ?? '')?.[1];
  if (!mimeType || !encoded) return;
  const binary = window.atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function TestImagePreview({ src, coordinateMode, gridSizing }: { src: string; coordinateMode: CoordinateSizingMode; gridSizing: Record<string, unknown> | null }) {
  const diameter = record(gridSizing?.cake_top_diameter);
  const diameterStart = overlayPoint(diameter?.start, coordinateMode);
  const diameterEnd = overlayPoint(diameter?.end, coordinateMode);
  const height = record(gridSizing?.cake_top_height);
  const heightStart = overlayPoint(height?.start, coordinateMode);
  const heightEnd = overlayPoint(height?.end, coordinateMode);
  const measurements = list(gridSizing?.items);
  const isCartesian = coordinateMode === 'cartesian_4q';
  return <div className="relative flex max-h-[480px] justify-center overflow-hidden bg-gray-100 p-2">
    <div className="relative inline-block max-w-full align-top">
      <img src={src} alt="Uploaded cake for prompt test" className="block max-h-[464px] max-w-full object-contain" />
      <svg aria-label={isCartesian ? 'Cartesian four quadrant coordinate plane' : '20 by 20 reference grid'} role="img" viewBox="0 0 20 20" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {isCartesian ? <>
          {CARTESIAN_COORDINATES.map((coordinate) => <line key={`cart-v-${coordinate}`} x1={coordinate + 10} y1="0" x2={coordinate + 10} y2="20" stroke="white" strokeOpacity="0.66" strokeWidth={coordinate % 5 === 0 ? 0.1 : 0.04} />)}
          {CARTESIAN_COORDINATES.map((coordinate) => <line key={`cart-h-${coordinate}`} x1="0" y1={10 - coordinate} x2="20" y2={10 - coordinate} stroke="white" strokeOpacity="0.66" strokeWidth={coordinate % 5 === 0 ? 0.1 : 0.04} />)}
          {CARTESIAN_COORDINATES.filter((coordinate) => coordinate !== -10 && coordinate !== 10).map((coordinate) => <text key={`cart-x-${coordinate}`} x={coordinate + 10} y="0.7" textAnchor="middle" fontSize="0.5" fontWeight="700" fill="white" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">{coordinate > 0 ? `+${coordinate}` : coordinate}</text>)}
          {CARTESIAN_COORDINATES.filter((coordinate) => coordinate !== -10 && coordinate !== 10).map((coordinate) => <text key={`cart-y-${coordinate}`} x="0.65" y={10 - coordinate + 0.2} textAnchor="middle" fontSize="0.5" fontWeight="700" fill="white" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">{coordinate > 0 ? `+${coordinate}` : coordinate}</text>)}
          <line x1="10" y1="0" x2="10" y2="20" stroke="#00e676" strokeOpacity="0.9" strokeWidth="0.14" />
          <line x1="0" y1="10" x2="20" y2="10" stroke="#00e676" strokeOpacity="0.9" strokeWidth="0.14" />
          <text x="10.35" y="9.5" fontSize="0.55" fontWeight="700" fill="#00e676" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">[0,0]</text>
          <text x="19.5" y="9.5" textAnchor="end" fontSize="0.55" fontWeight="700" fill="#00e676" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">+x</text>
          <text x="10.35" y="0.7" fontSize="0.55" fontWeight="700" fill="#00e676" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">+y</text>
          <text x="0.5" y="9.5" fontSize="0.55" fontWeight="700" fill="#00e676" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">-x</text>
          <text x="10.35" y="19.5" fontSize="0.55" fontWeight="700" fill="#00e676" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">-y</text>
        </> : <>
          {GRID_LINES.map((line) => <line key={`v-${line}`} x1={line} y1="0" x2={line} y2="20" stroke="white" strokeOpacity="0.72" strokeWidth={line % 5 === 0 ? 0.08 : 0.04} />)}
          {GRID_LINES.map((line) => <line key={`h-${line}`} x1="0" y1={line} x2="20" y2={line} stroke="white" strokeOpacity="0.72" strokeWidth={line % 5 === 0 ? 0.08 : 0.04} />)}
          {GRID_LABELS.map((label) => <text key={`top-${label}`} x={label - 0.5} y="0.7" textAnchor="middle" fontSize="0.55" fontWeight="700" fill="white" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">{label}</text>)}
          {GRID_LABELS.map((label) => <text key={`left-${label}`} x="0.55" y={label - 0.3} textAnchor="middle" fontSize="0.55" fontWeight="700" fill="white" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">{label}</text>)}
        </>}
        <rect x="0.08" y="0.08" width="19.84" height="19.84" fill="none" stroke="#ffeb3b" strokeOpacity="0.9" strokeWidth="0.1" />
        {diameterStart && diameterEnd && <g><line x1={diameterStart.x} y1={diameterStart.y} x2={diameterEnd.x} y2={diameterEnd.y} stroke="#22c55e" strokeOpacity="0.88" strokeWidth="0.16" /><text x={(diameterStart.x + diameterEnd.x) / 2} y={Math.max(1, diameterStart.y - 0.35)} textAnchor="middle" fontSize="0.55" fontWeight="700" fill="#22c55e" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">D</text></g>}
        {heightStart && heightEnd && <g><line x1={heightStart.x} y1={heightStart.y} x2={heightEnd.x} y2={heightEnd.y} stroke="#a855f7" strokeOpacity="0.88" strokeWidth="0.16" /><text x={Math.min(19.4, heightStart.x + 0.35)} y={(heightStart.y + heightEnd.y) / 2} textAnchor="middle" fontSize="0.55" fontWeight="700" fill="#a855f7" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">H</text></g>}
        {measurements.map((item, index) => {
          const box = record(item.bbox);
          const topLeft = overlayPoint(box?.top_left, coordinateMode);
          const bottomRight = overlayPoint(box?.bottom_right, coordinateMode);
          if (!topLeft || !bottomRight) return null;
          const color = GRID_MEASUREMENT_COLORS[index % GRID_MEASUREMENT_COLORS.length];
          const left = Math.min(topLeft.x, bottomRight.x);
          const top = Math.min(topLeft.y, bottomRight.y);
          const width = Math.max(0.15, Math.abs(bottomRight.x - topLeft.x));
          const boxHeight = Math.max(0.15, Math.abs(bottomRight.y - topLeft.y));
          return <g key={String(item.source_group_id ?? index)}>
            <rect x={left} y={top} width={width} height={boxHeight} fill={color} fillOpacity="0.28" stroke={color} strokeOpacity="0.95" strokeWidth="0.12" /><circle cx={topLeft.x} cy={topLeft.y} r="0.18" fill={color} stroke="white" strokeWidth="0.06" /><circle cx={bottomRight.x} cy={bottomRight.y} r="0.18" fill={color} stroke="white" strokeWidth="0.06" />
            <text x={Math.min(19.5, left + 0.2)} y={Math.max(0.9, top + 0.7)} fontSize="0.55" fontWeight="700" fill={color} stroke="black" strokeOpacity="0.8" strokeWidth="0.08" paintOrder="stroke">{index + 1}</text>
          </g>;
        })}
      </svg>
    </div>
  </div>;
}

function RawResponsePanel({ title, value }: { title: string; value: unknown }) {
  return <section className="rounded-2xl border border-gray-200 bg-slate-950 p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-white">{title}</h3><button onClick={() => { void navigator.clipboard.writeText(typeof value === 'string' ? value : JSON.stringify(value ?? { message: 'No response returned.' }, null, 2)); toast.success('Raw response copied'); }} className="inline-flex items-center gap-1 text-xs font-medium text-violet-200 hover:text-white"><Copy className="h-3.5 w-3.5" />Copy</button></div><pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">{typeof value === 'string' ? value : JSON.stringify(value ?? { message: 'No response returned.' }, null, 2)}</pre></section>;
}

function PricingSummary({ pricing, priceOptions, priceItems }: { pricing: Record<string, unknown> | null; priceOptions: Record<string, unknown>[]; priceItems: Record<string, unknown>[] }) {
  if (!pricing) return <p className="mt-4 border-t border-violet-100 pt-4 text-sm text-gray-500">No price is shown until analysis passes validation.</p>;
  return <div className="mt-4 border-t border-violet-100 pt-4">
    <h4 className="mb-2 text-sm font-bold text-gray-900">Storefront-equivalent price</h4>
    <div className="grid grid-cols-3 gap-3 rounded-xl bg-emerald-50 p-3 text-center">
      <div><p className="text-xs text-emerald-800">Base</p><p className="font-bold">{php(pricing.basePrice)}</p></div>
      <div><p className="text-xs text-emerald-800">Add-ons</p><p className="font-bold">{php(pricing.addOnPrice)}</p></div>
      <div><p className="text-xs text-emerald-800">Total</p><p className="font-bold text-emerald-700">{php(pricing.total)}</p></div>
    </div>
    {priceOptions.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{priceOptions.map((option, index) => <div key={index} className={`rounded-lg border p-3 text-sm ${option.recommended || option.isCheapest ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}><strong>{display(option.size ?? option.label)}</strong><span className="float-right font-bold">{php(option.total ?? option.totalPrice)}</span><p className="mt-1 text-xs text-gray-500">Base {php(option.base ?? option.basePrice)} · Add-ons {php(option.addons ?? option.addOnPrice)}</p></div>)}</div>}
    {priceItems.length > 0 && <details className="mt-3 rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer text-xs font-semibold text-gray-700">Pricing rule trace ({priceItems.length})</summary><div className="mt-3"><ItemCards title="Matched rule details" items={priceItems} /></div></details>}
  </div>;
}

export default function AIPromptLabClient() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [settings, setSettings] = useState<LabSettings | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [promptText, setPromptText] = useState('');
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [run, setRun] = useState<LabResponse | null>(null);
  const [model, setModel] = useState('gemini-3.5-flash-lite');
  const [thinkingLevel, setThinkingLevel] = useState('LOW');
  const [temperature, setTemperature] = useState(0);
  const [topP, setTopP] = useState(1);
  const [topK, setTopK] = useState(1);
  const [sizingMode, setSizingMode] = useState<PromptLabSizingMode>('grid_20');
  const [mode, setMode] = useState<'one_pass' | 'two_step_v385' | 'two_step_bounding_boxes' | 'one_pass_geometry_refined' | 'one_pass_geometry_combined'>('one_pass');
  const [inventoryPrompt, setInventoryPrompt] = useState('');
  const [compilerPrompt, setCompilerPrompt] = useState('');
  const [identificationPrompt, setIdentificationPrompt] = useState('');
  const [boundingBoxPrompt, setBoundingBoxPrompt] = useState('');
  const [geometryPrompt, setGeometryPrompt] = useState('');
  const [editableBoundingBoxGeometry, setEditableBoundingBoxGeometry] = useState<BoundingBoxGeometry | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const runStartedAt = useRef<number | null>(null);

  const adminFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('x-admin-pin', ADMIN_IMAGE_STUDIO_PIN);
    return fetch(input, { ...init, headers });
  }, []);

  const applyConfiguration = useCallback((json: Record<string, unknown>) => {
    const nextPrompts = normalizePrompts(json);
    const nextSettings = normalizeSettings(json);
    setPrompts(nextPrompts); setSettings(nextSettings);
    const active = nextPrompts.find((prompt) => prompt.isActive) ?? nextPrompts[0];
    setSelectedVersion(active?.version ?? ''); setPromptText(withCoordinateInstructions(stripAllCoordinateInstructions(active?.text ?? '', nextSettings), nextSettings.gridSizing));
    setModel(nextSettings.defaultModel); setThinkingLevel(nextSettings.defaultThinkingLevel);
    setTemperature(nextSettings.decoding.temperature); setTopP(nextSettings.decoding.topP); setTopK(nextSettings.decoding.topK);
    setInventoryPrompt(nextSettings.twoStep?.inventoryPrompt ?? '');
    setCompilerPrompt(nextSettings.twoStep?.compilerPrompt ?? '');
    setIdentificationPrompt(nextSettings.twoStepBoundingBoxes?.identificationPrompt ?? '');
    setBoundingBoxPrompt(nextSettings.twoStepBoundingBoxes?.boundingBoxPrompt ?? '');
    setGeometryPrompt(nextSettings.onePassGeometryRefinement?.geometryPrompt ?? '');
  }, []);

  const loadConfiguration = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const response = await adminFetch(ENDPOINT);
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(json.error ?? 'Could not load Prompt Lab settings.'));
      applyConfiguration(json);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load Prompt Lab settings.'); }
    finally { setLoadingConfig(false); }
  }, [adminFetch, applyConfiguration]);

  useEffect(() => { if (authenticated) void loadConfiguration(); }, [authenticated, loadConfiguration]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    if (!running || runStartedAt.current === null) return;
    const tick = () => setElapsedMs(Date.now() - (runStartedAt.current ?? Date.now()));
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [running]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImage(null); setPreviewUrl(null); setRun(null); setEditableBoundingBoxGeometry(null); setSizingMode('grid_20'); setMode('one_pass');
    const active = prompts.find((prompt) => prompt.isActive) ?? prompts[0];
    setSelectedVersion(active?.version ?? ''); setPromptText(withCoordinateInstructions(stripAllCoordinateInstructions(active?.text ?? '', settings), settings?.gridSizing ?? null));
    setInventoryPrompt(settings?.twoStep?.inventoryPrompt ?? ''); setCompilerPrompt(settings?.twoStep?.compilerPrompt ?? '');
    setIdentificationPrompt(settings?.twoStepBoundingBoxes?.identificationPrompt ?? ''); setBoundingBoxPrompt(settings?.twoStepBoundingBoxes?.boundingBoxPrompt ?? '');
    setGeometryPrompt(settings?.onePassGeometryRefinement?.geometryPrompt ?? '');
    if (settings) { setModel(settings.defaultModel); setThinkingLevel(settings.defaultThinkingLevel); setTemperature(settings.decoding.temperature); setTopP(settings.decoding.topP); setTopK(settings.decoding.topK); }
    if (fileInput.current) fileInput.current.value = '';
  };

  const chooseFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) { toast.error('Use a JPG, PNG, or WebP image.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error('Test images must be 10 MB or smaller.'); return; }
    try {
      const dataUrl = await readDataUrl(file);
      const comma = dataUrl.indexOf(',');
      if (comma < 0) throw new Error('Could not read image payload.');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setImage({ data: dataUrl.slice(comma + 1), mimeType: file.type, name: file.name });
      setPreviewUrl(URL.createObjectURL(file)); setRun(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load image.'); }
  }, [previewUrl]);

  // Let an admin paste a screenshot straight into a fresh lab session without
  // stealing ordinary text paste from the prompt editor or a form field.
  useEffect(() => {
    if (!authenticated) return;
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'));
      const file = imageItem?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void chooseFile(file);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [authenticated, chooseFile]);

  const selectedPrompt = prompts.find((prompt) => prompt.version === selectedVersion);
  const thinkingOptions = settings?.models.find((item) => item.id === model)?.thinkingLevels ?? ['LOW'];
  const coordinatePromptSettings = sizingMode === 'cartesian_4q' ? settings?.cartesianSizing ?? null : sizingMode === 'grid_20' ? settings?.gridSizing ?? null : null;
  const combinedPromptFor = (prompt: PromptRecord | undefined) => [stripAllCoordinateInstructions(prompt?.text ?? '', settings), settings?.onePassGeometryCombined?.combinedPrompt ?? ''].filter(Boolean).join('\n\n');
  const selectPrompt = (version: string) => { const prompt = prompts.find((item) => item.version === version); setSelectedVersion(version); setPromptText(mode === 'one_pass_geometry_refined' ? stripAllCoordinateInstructions(prompt?.text ?? '', settings) : mode === 'one_pass_geometry_combined' ? combinedPromptFor(prompt) : withCoordinateInstructions(stripAllCoordinateInstructions(prompt?.text ?? '', settings), coordinatePromptSettings)); setRun(null); };
  const selectSizingMode = (nextSizingMode: PromptLabSizingMode) => {
    setSizingMode(nextSizingMode);
    setPromptText(withCoordinateInstructions(stripAllCoordinateInstructions(promptText, settings), nextSizingMode === 'cartesian_4q' ? settings?.cartesianSizing ?? null : nextSizingMode === 'grid_20' ? settings?.gridSizing ?? null : null));
    setRun(null);
  };
  const selectMode = (nextMode: 'one_pass' | 'two_step_v385' | 'two_step_bounding_boxes' | 'one_pass_geometry_refined' | 'one_pass_geometry_combined') => {
    setMode(nextMode); setRun(null);
    setEditableBoundingBoxGeometry(null);
    if (nextMode === 'two_step_v385') {
      const target = prompts.find((prompt) => /^v?3\.85$/i.test(prompt.version));
      setSelectedVersion(target?.version ?? '3.85'); setPromptText(target?.text ?? '');
    } else if (nextMode === 'one_pass_geometry_refined') {
      const selected = prompts.find((prompt) => prompt.version === selectedVersion) ?? prompts.find((prompt) => prompt.isActive) ?? prompts[0];
      setSelectedVersion(selected?.version ?? '');
      setPromptText(stripAllCoordinateInstructions(selected?.text ?? '', settings));
    } else if (nextMode === 'one_pass_geometry_combined') {
      const selected = prompts.find((prompt) => prompt.version === selectedVersion) ?? prompts.find((prompt) => prompt.isActive) ?? prompts[0];
      setSelectedVersion(selected?.version ?? '');
      setPromptText(combinedPromptFor(selected));
    } else if (nextMode === 'one_pass') {
      const selected = prompts.find((prompt) => prompt.version === selectedVersion) ?? prompts.find((prompt) => prompt.isActive) ?? prompts[0];
      setSelectedVersion(selected?.version ?? '');
      setPromptText(withCoordinateInstructions(stripAllCoordinateInstructions(selected?.text ?? '', settings), sizingMode === 'cartesian_4q' ? settings?.cartesianSizing ?? null : sizingMode === 'grid_20' ? settings?.gridSizing ?? null : null));
    }
  };

  const execute = async () => {
    if (!image) { toast.error('Upload a test image first.'); return; }
    if ((mode === 'one_pass' || mode === 'one_pass_geometry_refined' || mode === 'one_pass_geometry_combined') && !promptText.trim()) { toast.error('Enter a prompt before testing.'); return; }
    if (mode === 'two_step_v385' && (!inventoryPrompt.trim() || !compilerPrompt.trim())) { toast.error('Both two-step prompts are required.'); return; }
    if (mode === 'two_step_bounding_boxes' && (!identificationPrompt.trim() || !boundingBoxPrompt.trim())) { toast.error('Both bounding-box detector prompts are required.'); return; }
    if (mode === 'one_pass_geometry_refined' && !geometryPrompt.trim()) { toast.error('Enter a geometry prompt before testing.'); return; }
    runStartedAt.current = Date.now(); setElapsedMs(0); setRunning(true); setRun(null); setEditableBoundingBoxGeometry(null);
    try {
      const response = await adminFetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        image, prompt: { sourceVersion: selectedVersion, checksum: selectedPrompt?.checksum, text: promptText },
        mode, twoStep: mode === 'two_step_v385' ? { inventoryPrompt, compilerPrompt } : undefined,
        twoStepBoundingBoxes: mode === 'two_step_bounding_boxes' ? { identificationPrompt, boundingBoxPrompt } : undefined,
        onePassGeometryRefinement: mode === 'one_pass_geometry_refined' ? { geometryPrompt } : undefined,
        settings: { model, thinkingLevel, temperature, topP, topK }, ...((mode === 'two_step_bounding_boxes' || mode === 'one_pass_geometry_refined' || mode === 'one_pass_geometry_combined') ? {} : { sizingMode, gridSizing: sizingMode === 'grid_20', gridInstructionsInPrompt: Boolean(coordinatePromptSettings?.editablePrompt) }),
      }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(json.error ?? json.message ?? 'Prompt test failed.'));
      setRun(json); setEditableBoundingBoxGeometry(toBoundingBoxGeometry(json.geometry)); toast.success('Prompt test complete. Nothing was saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Prompt test failed.'); }
    finally {
      if (runStartedAt.current !== null) setElapsedMs(Date.now() - runStartedAt.current);
      runStartedAt.current = null;
      setRunning(false);
    }
  };

  if (!authenticated) return <main className="mx-auto max-w-md px-5 pt-16"><form onSubmit={(event) => { event.preventDefault(); if (pin === ADMIN_IMAGE_STUDIO_PIN) setAuthenticated(true); else toast.error('Invalid PIN'); }} className="rounded-3xl border border-white bg-white p-8 shadow-xl"><ShieldCheck className="mb-4 h-10 w-10 text-violet-600" /><h1 className="text-2xl font-bold text-gray-950">AI Prompt Lab</h1><p className="mt-2 text-sm leading-6 text-gray-600">Private, non-persistent analysis tests. Enter the admin PIN to continue.</p><input type="password" value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="one-time-code" placeholder="Admin PIN" className="mt-6 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200" /><button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"><ShieldCheck className="h-4 w-4" />Open secure lab</button></form></main>;

  const analysis = record(run?.postProcessedAnalysis ?? run?.analysis ?? run?.processedAnalysis);
  const raw = run?.rawModelResponse ?? run?.rawResponse ?? run?.raw;
  const rawAnalysis = parseRawAnalysis(raw);
  const rawPricing = record(run?.pricing ?? run?.priceResult ?? run?.price);
  const metadata = record(run?.metadata ?? run?.execution);
  const effectiveSettings = record(run?.effectiveSettings);
  const returnedPrompt = record(run?.prompt);
  const twoStepRun = String(returnedPrompt?.executionMode ?? '').startsWith('two_step_v385');
  const boundingBoxRun = String(returnedPrompt?.executionMode ?? '') === 'two_step_bounding_boxes';
  const refinedGeometryRun = String(returnedPrompt?.executionMode ?? '') === 'one_pass_geometry_refined';
  const combinedGeometryRun = String(returnedPrompt?.executionMode ?? '') === 'one_pass_geometry_combined';
  const gridSizingResult = record(run?.gridSizing);
  const gridOverlayPreview = typeof run?.gridOverlayPreview === 'string' && run.gridOverlayPreview.startsWith('data:image/')
    ? run.gridOverlayPreview
    : null;
  const visualInventory = record(run?.inventory);
  const stageTimings = record(run?.stageTimings);
  const rawInventoryResponse = run?.rawInventoryResponse;
  const rawCompilerResponse = run?.rawCompilerResponse ?? raw;
  const identification = record(run?.identification);
  const rawIdentificationResponse = run?.rawIdentificationResponse;
  const rawBoundingBoxResponse = run?.rawBoundingBoxResponse ?? raw;
  const rawAnalysisResponse = run?.rawAnalysisResponse ?? raw;
  const rawGeometryResponse = run?.rawGeometryResponse ?? raw;
  const rawCombinedResponse = run?.rawCombinedResponse ?? raw;
  const combinedGeometry = record(run?.geometry);
  const refinedManifest = record(run?.manifest);
  const geometrySkipReason = typeof run?.geometrySkipReason === 'string' ? run.geometrySkipReason : null;
  const validationErrors = Array.isArray(run?.validationErrors) ? run.validationErrors : Array.isArray(run?.errors) ? run.errors : [run?.error, run?.validationError].filter(Boolean);
  const pricingErrors = Array.isArray(run?.pricingErrors) ? run.pricingErrors : [run?.pricingError].filter(Boolean);
  const errors = [...validationErrors, ...pricingErrors];
  const cake = analysis ? { cakeType: analysis.cakeType ?? analysis.cake_type, cakeThickness: analysis.cakeThickness ?? analysis.cake_thickness, cakeSize: analysis.cakeSize ?? analysis.cake_size, coverage: analysis.coverage, icing: analysis.icing ?? analysis.icingDesign ?? analysis.icing_design } : null;
  const toppers = list(analysis?.mainToppers ?? analysis?.toppers ?? analysis?.main_toppers);
  const support = list(analysis?.supportElements ?? analysis?.support_elements);
  const messages = list(analysis?.cake_messages ?? analysis?.messages);
  const priceOptions = list(rawPricing?.options ?? rawPricing?.baseSizeOptions ?? rawPricing?.basePriceOptions ?? rawPricing?.sizes)
    .map((option) => option.isLowest ? { ...option, isCheapest: true } : option);
  const lowestPriceOption = priceOptions.find((option) => option.isLowest || option.isCheapest || option.recommended) ?? priceOptions[0];
  const pricing = rawPricing ? {
    ...rawPricing,
    basePrice: rawPricing.basePrice ?? rawPricing.base ?? lowestPriceOption?.basePrice ?? lowestPriceOption?.base,
    addOnPrice: rawPricing.addOnPrice ?? rawPricing.addons ?? lowestPriceOption?.addOnPrice ?? lowestPriceOption?.addons,
    total: rawPricing.total ?? rawPricing.totalPrice ?? lowestPriceOption?.total ?? lowestPriceOption?.totalPrice,
  } : null;
  const priceItems = list(rawPricing?.items ?? rawPricing?.trace ?? rawPricing?.pricingTrace ?? rawPricing?.lineItems);
  const analysisItemPrices = record(rawPricing?.analysisItemPrices) as Record<string, number> | null ?? {};
  const resultsIntro = <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-gray-900">3. Test results</h2><p className="text-sm text-gray-500">{boundingBoxRun ? 'Identification manifest → image geometry → editable annotation' : refinedGeometryRun ? 'One-pass analysis → frozen priced-row manifest → precise geometry' : combinedGeometryRun ? 'One Gemini response → baseline analysis + exhaustive geometry' : 'Raw model response → validated analysis → final price'}</p></div>{run && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}</div>{!run && <div className="flex min-h-40 items-center justify-center text-center text-sm text-gray-500">Run a test to inspect the full response and storefront-equivalent price.</div>}</div>;
  const executionMetadata = run ? <ValueGrid title="Execution metadata" data={{ mode: returnedPrompt?.executionMode, sourcePromptVersion: returnedPrompt?.sourceVersion ?? run.promptVersion ?? selectedVersion, targetPromptVersion: returnedPrompt?.targetVersion, targetPromptChecksum: returnedPrompt?.targetChecksum, submittedPromptChecksum: returnedPrompt?.checksum ?? run.promptChecksum ?? selectedPrompt?.checksum, sourcePromptChecksum: returnedPrompt?.sourceChecksum, inventoryPromptChecksum: returnedPrompt?.inventoryChecksum ?? returnedPrompt?.identificationPromptChecksum, compilerPromptChecksum: returnedPrompt?.compilerChecksum ?? returnedPrompt?.boundingBoxPromptChecksum ?? returnedPrompt?.geometryPromptChecksum, combinedPromptChecksum: returnedPrompt?.combinedPromptChecksum, promptEdited: returnedPrompt?.isEdited, sizingSchema: returnedPrompt?.sizeSchema, model: effectiveSettings?.model ?? metadata?.model ?? run.model ?? model, thinkingLevel: effectiveSettings?.thinkingLevel ?? metadata?.thinkingLevel ?? run.thinkingLevel, analysisTime: stageTimings?.analysisMs ?? stageTimings?.inventoryMs ?? stageTimings?.identificationMs, geometryTime: stageTimings?.geometryMs ?? stageTimings?.compilerMs ?? stageTimings?.boundingBoxMs, combinedTime: stageTimings?.combinedMs, executionTime: stageTimings?.totalMs ?? metadata?.executionTimeMs ?? metadata?.durationMs ?? run.executionTimeMs, validation: run.validationStatus ?? (boundingBoxRun || refinedGeometryRun ? (editableBoundingBoxGeometry ? 'passed' : 'not available') : combinedGeometryRun ? (combinedGeometry ? 'passed' : 'not available') : (analysis ? 'passed' : 'not available')) }} /> : null;
  const twoStepDetails = twoStepRun ? <>
    {visualInventory ? <><ValueGrid title="Step 1 · Validated visual inventory" data={{ cake: visualInventory.cake, messages: list(visualInventory.messages).length, uncertainties: Array.isArray(visualInventory.uncertainties) ? visualInventory.uncertainties.length : 0, rejection: visualInventory.rejection }} /><ItemCards title="Observed groups" items={list(visualInventory.observed_groups)} /></> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h3 className="font-bold">Step 1 visual inventory unavailable</h3><p className="mt-1">The compiler did not run, so no storefront analysis or price was produced.</p></section>}
    <RawResponsePanel title="Step 1 · Raw visual inventory" value={rawInventoryResponse} />
    <RawResponsePanel title="Step 2 · Raw schema compiler response" value={rawCompilerResponse} />
  </> : null;
  const boundingBoxDetails = boundingBoxRun ? <>
    {identification ? <><ValueGrid title="Step 1 · Validated element identification" data={{ rejection: identification.rejection, elements: list(identification.elements).length }} /><ItemCards title="Identified cake-design elements" items={list(identification.elements)} /></> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h3 className="font-bold">Step 1 identification unavailable</h3><p className="mt-1">Geometry did not run because the identification response was invalid.</p></section>}
    {editableBoundingBoxGeometry && previewUrl ? <BoundingBoxGeometryEditor imageSrc={previewUrl} geometry={editableBoundingBoxGeometry} onChange={setEditableBoundingBoxGeometry} /> : null}
    <RawResponsePanel title="Step 1 · Raw element identification" value={rawIdentificationResponse} />
    <RawResponsePanel title="Step 2 · Raw bounding-box geometry" value={rawBoundingBoxResponse} />
  </> : null;
  const refinedGeometryDetails = refinedGeometryRun ? <>
    {refinedManifest ? <ValueGrid title="Frozen priced-row manifest" data={{ rows: list(refinedManifest.elements).length }} /> : null}
    {geometrySkipReason ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h3 className="font-bold">Geometry skipped</h3><p className="mt-1">{geometrySkipReason}</p></section> : null}
    {editableBoundingBoxGeometry && previewUrl ? <BoundingBoxGeometryEditor imageSrc={previewUrl} geometry={editableBoundingBoxGeometry} onChange={setEditableBoundingBoxGeometry} /> : null}
    <RawResponsePanel title="Step 1 · Raw one-pass analysis" value={rawAnalysisResponse} />
    <RawResponsePanel title="Step 2 · Raw precise geometry" value={rawGeometryResponse} />
  </> : null;
  const combinedGeometryDetails = combinedGeometryRun ? <>
    {combinedGeometry ? <ValueGrid title="Single-call exhaustive geometry" data={{ elements: list(combinedGeometry.elements).length, geometryVersion: combinedGeometry.geometry_version, diameterLine: combinedGeometry.cake_diameter_line, heightLine: combinedGeometry.cake_height_line }} /> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h3 className="font-bold">Combined geometry unavailable</h3><p className="mt-1">The single response did not produce validated geometry.</p></section>}
    {editableBoundingBoxGeometry && previewUrl ? <BoundingBoxGeometryEditor imageSrc={previewUrl} geometry={editableBoundingBoxGeometry} onChange={setEditableBoundingBoxGeometry} /> : null}
    <RawResponsePanel title="Raw combined analysis + geometry response" value={rawCombinedResponse} />
  </> : null;

  return <main className="mx-auto max-w-7xl px-4 sm:px-6">
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-700"><Sparkles className="h-4 w-4" />ADMIN-ONLY · NON-PERSISTENT</div><h1 className="text-3xl font-bold tracking-tight text-gray-950">AI Prompt Lab</h1><p className="mt-1 max-w-2xl text-sm text-gray-600">Test one image against a prompt, inspect every stage, and calculate price without touching customer sessions or production data.</p></div>
      <button onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"><RefreshCcw className="h-4 w-4" />New test</button>
    </header>
    <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950"><ShieldCheck className="mr-2 inline h-4 w-4 text-violet-700" /><strong>Safe test session:</strong> uploaded image and results exist only in this browser/request. This tool cannot save cache rows, carts, orders, pricing rules, or prompts.</div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="space-y-5">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-gray-900">1. Test image</h2><p className="text-sm text-gray-500">JPG, PNG, or WebP · max 10 MB · paste with ⌘V / Ctrl+V, drop, or upload · not stored</p></div>
          {previewUrl ? <div className="relative">{(mode === 'two_step_bounding_boxes' || mode === 'one_pass_geometry_refined' || mode === 'one_pass_geometry_combined' || sizingMode === 'none') ? <img src={previewUrl} alt="Selected cake test image" className="block max-h-[620px] w-full object-contain" /> : <TestImagePreview src={previewUrl} coordinateMode={sizingMode} gridSizing={gridSizingResult} />}<button onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setImage(null); setEditableBoundingBoxGeometry(null); }} className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white" aria-label="Remove image"><X className="h-4 w-4" /></button><div className="border-t border-cyan-100 bg-cyan-50 px-4 py-2 text-xs text-cyan-900"><p>{boundingBoxRun || mode === 'two_step_bounding_boxes' ? 'The original photo is sent to both detector stages. Step 2 receives the validated Step 1 element manifest and returns only normalized 0–1000 geometry; it is never priced or persisted.' : refinedGeometryRun || mode === 'one_pass_geometry_refined' ? 'The original photo is sent first to normal one-pass analysis, then to precise geometry with only its frozen validated priced rows. Exact geometry is review-only; the price below remains the one-pass baseline.' : combinedGeometryRun || mode === 'one_pass_geometry_combined' ? 'The original photo is sent once to Gemini for baseline analysis and exhaustive normalized geometry. Geometry is review-only; the normal one-pass price remains authoritative.' : sizingMode === 'none' ? 'The original photo is sent directly to Gemini with no coordinate overlay or grid-sizing contract.' : twoStepRun ? `The original photo is sent to visual inventory; the labeled ${sizingMode === 'cartesian_4q' ? 'Cartesian-plane' : '20×20'} overlay is sent to Gemini’s calibrated geometry and per-row coordinate locators.` : `The labeled ${sizingMode === 'cartesian_4q' ? 'Cartesian-plane' : '20×20'} overlay is sent once to Gemini for one-pass analysis. The raw response bboxes are the exact coordinates shown, sized, and priced here.`}{gridSizingResult && !boundingBoxRun && !refinedGeometryRun && !combinedGeometryRun ? ' Colored boxes show representative topper coordinates; green D and purple H mark the top-tier diameter and height.' : ''}</p>{gridOverlayPreview && !boundingBoxRun && !refinedGeometryRun && !combinedGeometryRun && sizingMode !== 'none' && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1"><button type="button" onClick={() => openImageDataUrl(gridOverlayPreview)} className="font-semibold text-cyan-800 underline underline-offset-2 hover:text-cyan-950">Open generated Gemini {sizingMode === 'cartesian_4q' ? 'Cartesian' : 'grid'} image</button><a href={gridOverlayPreview} download={`prompt-lab-gemini-${sizingMode === 'cartesian_4q' ? 'cartesian' : 'grid'}-preview.jpg`} className="font-semibold text-cyan-800 underline underline-offset-2 hover:text-cyan-950">Download JPEG</a></div>}</div></div> : <button onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDropTarget(true); }} onDragLeave={() => setIsDropTarget(false)} onDrop={(event) => { event.preventDefault(); setIsDropTarget(false); void chooseFile(event.dataTransfer.files[0]); }} className={`m-4 flex min-h-72 w-[calc(100%-2rem)] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition ${isDropTarget ? 'border-violet-500 bg-violet-50' : 'border-violet-200 bg-violet-50/40 hover:border-violet-400'}`}><ImagePlus className="mb-3 h-10 w-10 text-violet-500" /><span className="font-semibold text-gray-800">Paste a cake image anywhere with ⌘V / Ctrl+V</span><span className="mt-1 text-sm text-gray-500">or drop one here / browse from this device</span><span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"><Upload className="h-4 w-4" />Choose image</span></button>}
          <input ref={fileInput} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-gray-900">2. Prompt & model</h2><p className="text-sm text-gray-500">Only settings shown here are sent to Gemini.<br /><span className="font-medium text-amber-700">Experiments are uncached and non-persistent</span></p></div>{loadingConfig && <Loader2 className="h-5 w-5 animate-spin text-violet-600" />}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Analysis mode<select value={mode} onChange={(event) => selectMode(event.target.value as 'one_pass' | 'two_step_v385' | 'two_step_bounding_boxes' | 'one_pass_geometry_refined' | 'one_pass_geometry_combined')} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"><option value="one_pass">One-pass analysis</option><option value="one_pass_geometry_combined">True one-pass analysis + geometry</option><option value="one_pass_geometry_refined">One-pass analysis + precise geometry</option><option value="two_step_v385" disabled={!settings?.twoStep?.targetAvailable}>Two-step visual inventory → v3.85 compiler{settings?.twoStep?.targetAvailable ? '' : ' (unavailable)'}</option><option value="two_step_bounding_boxes">Two-step element identification → bounding boxes</option></select></label>
            {(mode === 'one_pass' || mode === 'one_pass_geometry_refined' || mode === 'one_pass_geometry_combined') ? <label className="text-sm font-medium text-gray-700">Prompt version<div className="relative mt-1"><select value={selectedVersion} onChange={(event) => selectPrompt(event.target.value)} disabled={loadingConfig} className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm focus:border-violet-500 focus:outline-none"><option value="">Select prompt</option>{prompts.map((prompt) => <option key={prompt.id} value={prompt.version}>v{prompt.version} {prompt.isActive ? '— active' : '— staged'}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" /></div></label> : mode === 'two_step_v385' ? <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-950"><strong>Target contract</strong><br /><span className="text-xs">v{settings?.twoStep?.targetVersion} · {settings?.twoStep?.targetChecksum}</span></div> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950"><strong>Detector experiment</strong><br /><span className="text-xs">No production prompt, sizing, or pricing</span></div>}
            <label className="text-sm font-medium text-gray-700">Gemini model<div className="relative mt-1"><select value={model} onChange={(event) => { setModel(event.target.value); setThinkingLevel(settings?.models.find((item) => item.id === event.target.value)?.thinkingLevels[0] ?? 'LOW'); }} className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm focus:border-violet-500 focus:outline-none">{settings?.models.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" /></div></label>
            <label className="text-sm font-medium text-gray-700">Thinking level<select value={thinkingLevel} onChange={(event) => setThinkingLevel(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none">{thinkingOptions.map((level) => <option key={level}>{level}</option>)}</select></label>
            {mode !== 'two_step_bounding_boxes' && mode !== 'one_pass_geometry_refined' && mode !== 'one_pass_geometry_combined' ? <label className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm text-cyan-950 sm:col-span-2"><span className="font-medium">Coordinate sizing system</span><select value={sizingMode} onChange={(event) => selectSizingMode(event.target.value as PromptLabSizingMode)} className="mt-1 w-full rounded-lg border border-cyan-300 bg-white px-3 py-2.5 text-sm focus:border-cyan-600 focus:outline-none"><option value="none">No overlay · original image</option><option value="grid_20">20×20 reference grid</option><option value="cartesian_4q">Cartesian plane · 4 quadrants</option></select><span className="mt-1 block text-xs text-cyan-800">No overlay keeps normal one-pass analysis. Grid and Cartesian modes add a measurement overlay and app-side bbox sizing.</span></label> : null}
          </div>
          {mode === 'one_pass' ? <label className="mt-4 block text-sm font-medium text-gray-700">Editable prompt <span className="font-normal text-gray-500">{selectedPrompt?.checksum ? `· source checksum ${selectedPrompt.checksum}` : ''}</span><textarea value={promptText} onChange={(event) => { setPromptText(event.target.value); setRun(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-violet-500 focus:outline-none" placeholder="Prompt text loads after sign-in." /></label> : mode === 'one_pass_geometry_combined' ? <label className="mt-4 block text-sm font-medium text-gray-700">Editable combined analysis + geometry prompt<textarea value={promptText} onChange={(event) => { setPromptText(event.target.value); setRun(null); setEditableBoundingBoxGeometry(null); }} rows={18} className="mt-1 w-full resize-y rounded-xl border border-emerald-300 p-3 font-mono text-xs leading-5 focus:border-emerald-600 focus:outline-none" /></label> : mode === 'one_pass_geometry_refined' ? <div className="mt-4 space-y-4"><label className="block text-sm font-medium text-gray-700">Step 1 · Editable one-pass analysis prompt<textarea value={promptText} onChange={(event) => { setPromptText(event.target.value); setRun(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-violet-500 focus:outline-none" /></label><label className="block text-sm font-medium text-gray-700">Step 2 · Editable precise-geometry prompt<textarea value={geometryPrompt} onChange={(event) => { setGeometryPrompt(event.target.value); setRun(null); setEditableBoundingBoxGeometry(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-emerald-600 focus:outline-none" /></label></div> : mode === 'two_step_v385' ? <div className="mt-4 space-y-4"><label className="block text-sm font-medium text-gray-700">Step 1 · Editable visual-inventory prompt<textarea value={inventoryPrompt} onChange={(event) => { setInventoryPrompt(event.target.value); setRun(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-violet-500 focus:outline-none" /></label><label className="block text-sm font-medium text-gray-700">Step 2 · Editable schema-compiler prompt<textarea value={compilerPrompt} onChange={(event) => { setCompilerPrompt(event.target.value); setRun(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-violet-500 focus:outline-none" /></label></div> : <div className="mt-4 space-y-4"><label className="block text-sm font-medium text-gray-700">Step 1 · Editable element-identification prompt<textarea value={identificationPrompt} onChange={(event) => { setIdentificationPrompt(event.target.value); setRun(null); setEditableBoundingBoxGeometry(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-emerald-600 focus:outline-none" /></label><label className="block text-sm font-medium text-gray-700">Step 2 · Editable bounding-box prompt<textarea value={boundingBoxPrompt} onChange={(event) => { setBoundingBoxPrompt(event.target.value); setRun(null); setEditableBoundingBoxGeometry(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-emerald-600 focus:outline-none" /></label></div>}
          <div className="mt-4 grid grid-cols-3 gap-3"><label className="text-xs font-medium text-gray-600">Temperature<input type="number" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" /></label><label className="text-xs font-medium text-gray-600">Top P<input type="number" min="0" max="1" step="0.05" value={topP} onChange={(event) => setTopP(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" /></label><label className="text-xs font-medium text-gray-600">Top K<input type="number" min="1" max="100" step="1" value={topK} onChange={(event) => setTopK(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" /></label></div>
          <button disabled={running || loadingConfig || !image || ((mode === 'one_pass' || mode === 'one_pass_geometry_refined' || mode === 'one_pass_geometry_combined') ? !promptText.trim() : mode === 'two_step_v385' ? !settings?.twoStep?.targetAvailable || !inventoryPrompt.trim() || !compilerPrompt.trim() : !identificationPrompt.trim() || !boundingBoxPrompt.trim()) || (mode === 'one_pass_geometry_refined' && !geometryPrompt.trim())} onClick={() => void execute()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300">{running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}{running ? `Running Gemini · ${formatElapsed(elapsedMs)}` : mode === 'two_step_bounding_boxes' ? 'Run bounding-box detector' : mode === 'one_pass_geometry_combined' ? 'Run true one-pass analysis + geometry' : mode === 'one_pass_geometry_refined' ? 'Run analysis + precise geometry' : mode === 'two_step_v385' ? 'Run two-step experiment' : 'Run experiment'}</button>
        </div>
        {resultsIntro}{executionMetadata}
      </section>
      <section className="space-y-5">{run && <>
        {errors.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="mb-2 flex items-center gap-2 font-bold"><AlertCircle className="h-4 w-4" />Warnings / errors</div>{errors.map((error, index) => <p key={index}>{display(error)}</p>)}</div>}
        {twoStepDetails}
        {boundingBoxDetails}
        {refinedGeometryDetails}
        {combinedGeometryDetails}
        {!boundingBoxRun && <>{!refinedGeometryRun && !combinedGeometryRun && sizingMode !== 'none' && <GridSizingSummary value={gridSizingResult} coordinateMode={sizingMode} />}{analysis ? <><ValueGrid title="Post-processed cake analysis" data={cake}><PricingSummary pricing={pricing} priceOptions={priceOptions} priceItems={priceItems} /></ValueGrid><AnalysisItemCards title="Main toppers" items={toppers} kind="topper" priceKeyPrefix="main_toppers" itemPrices={analysisItemPrices} /><AnalysisItemCards title="Support elements" items={support} kind="support" priceKeyPrefix="support_elements" itemPrices={analysisItemPrices} /><ItemCards title="Messages" items={messages} /></> : <UnvalidatedAnalysisNotice rawAnalysis={rawAnalysis} />}{!twoStepRun && !refinedGeometryRun && !combinedGeometryRun && <RawResponsePanel title="Raw model response" value={raw} />}</>}
      </>}</section>
    </div>
  </main>;
}
