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

type LabSettings = {
  models: Array<{ id: string; thinkingLevels: string[] }>;
  defaultModel: string;
  defaultThinkingLevel: string;
  decoding: { temperature: number; topP: number; topK: number };
  twoStep: {
    targetVersion: string;
    targetChecksum: string;
    targetAvailable: boolean;
    inventoryPrompt: string;
    compilerPrompt: string;
  } | null;
};

type ImagePayload = { data: string; mimeType: string; name: string };
type LabResponse = Record<string, unknown>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
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
  return {
    models: models.length ? models : [{ id: 'gemini-3.5-flash-lite', thinkingLevels: ['LOW'] }],
    defaultModel: String(raw.defaultModel ?? raw.default_model ?? models[0]?.id ?? 'gemini-3.5-flash-lite'),
    defaultThinkingLevel: String(raw.defaultThinkingLevel ?? raw.default_thinking_level ?? models[0]?.thinkingLevels[0] ?? 'LOW'),
    decoding: { temperature: Number(decoding.temperature ?? 0), topP: Number(decoding.topP ?? decoding.top_p ?? 1), topK: Number(decoding.topK ?? decoding.top_k ?? 1) },
    twoStep: twoStep ? {
      targetVersion: String(twoStep.targetVersion ?? ''),
      targetChecksum: String(twoStep.targetChecksum ?? ''),
      targetAvailable: Boolean(twoStep.targetAvailable),
      inventoryPrompt: String(twoStep.inventoryPrompt ?? ''),
      compilerPrompt: String(twoStep.compilerPrompt ?? ''),
    } : null,
  };
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
      const geometry = item.size_line ?? item.bbox;
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
  if (typeof value !== 'string') return record(value);
  try { return record(JSON.parse(value)); } catch { return null; }
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

function GridSizingSummary({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return null;
  const items = list(value?.items);
  return <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
    <div className="flex items-start gap-2">
      <Grid3X3 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
      <div><h3 className="text-sm font-bold text-cyan-950">20×20 grid bbox-area sizing</h3><p className="mt-1 text-xs text-cyan-900">The colored boxes and cake reference lines are drawn on the single Test image from returned coordinates. Ratios and categories below were recalculated by the application.</p></div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-white p-3 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-cyan-700">Top-tier diameter</p><p className="font-bold text-cyan-950">{display(value.diameter_units)} grid units</p></div>
        <div><p className="text-xs text-cyan-700">Top-tier height</p><p className="font-bold text-cyan-950">{display(value.height_units)} grid units</p></div>
        <div><p className="text-xs text-cyan-700">Cake reference area</p><p className="font-bold text-cyan-950">{display(value.cake_reference_area_units)} grid²</p></div>
        <div><p className="text-xs text-cyan-700">Method</p><p className="font-bold text-cyan-950">Box area ÷ cake area</p></div>
    </div>
    {items.length > 0 && <div className="mt-3 overflow-x-auto rounded-xl border border-cyan-200 bg-white"><table className="min-w-full text-left text-xs"><thead className="bg-cyan-100 text-cyan-950"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Grid box: top-left → bottom-right</th><th className="px-3 py-2">Box area</th><th className="px-3 py-2">Area ratio</th><th className="px-3 py-2">Category</th></tr></thead><tbody>{items.map((item, index) => <tr key={String(item.source_group_id ?? index)} className="border-t border-cyan-100"><td className="max-w-52 px-3 py-2 font-medium text-slate-800">{display(item.description)}</td><td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600">{formatGridBox(item.bbox)}</td><td className="px-3 py-2 text-slate-600">{display(item.bbox_area_units)} grid²</td><td className="px-3 py-2 font-mono text-slate-600">{typeof item.ratio === 'number' ? item.ratio.toFixed(4) : display(item.ratio)}</td><td className="px-3 py-2 font-bold capitalize text-cyan-800">{display(item.category)}</td></tr>)}</tbody></table></div>}
  </section>;
}

const GRID_LABELS = Array.from({ length: 20 }, (_, index) => index + 1);
const GRID_LINES = Array.from({ length: 21 }, (_, index) => index);
const GRID_MEASUREMENT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

function gridPoint(value: unknown): { x: number; y: number } | null {
  const point = record(value);
  const x = Number(point?.x);
  const y = Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function TestImagePreview({ src, showGrid, gridSizing }: { src: string; showGrid: boolean; gridSizing: Record<string, unknown> | null }) {
  const diameter = record(gridSizing?.cake_top_diameter);
  const diameterStart = gridPoint(diameter?.start);
  const diameterEnd = gridPoint(diameter?.end);
  const height = record(gridSizing?.cake_top_height);
  const heightStart = gridPoint(height?.start);
  const heightEnd = gridPoint(height?.end);
  const measurements = list(gridSizing?.items);
  return <div className="relative flex max-h-[480px] justify-center overflow-hidden bg-gray-100 p-2">
    <div className="relative inline-block max-w-full align-top">
      <img src={src} alt="Uploaded cake for prompt test" className="block max-h-[464px] max-w-full object-contain" />
      {showGrid && <svg aria-label="20 by 20 reference grid" role="img" viewBox="0 0 20 20" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {GRID_LINES.map((line) => <line key={`v-${line}`} x1={line} y1="0" x2={line} y2="20" stroke="white" strokeOpacity="0.72" strokeWidth={line % 5 === 0 ? 0.08 : 0.04} />)}
        {GRID_LINES.map((line) => <line key={`h-${line}`} x1="0" y1={line} x2="20" y2={line} stroke="white" strokeOpacity="0.72" strokeWidth={line % 5 === 0 ? 0.08 : 0.04} />)}
        {GRID_LABELS.map((label) => <text key={`top-${label}`} x={label - 0.5} y="0.7" textAnchor="middle" fontSize="0.55" fontWeight="700" fill="white" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">{label}</text>)}
        {GRID_LABELS.map((label) => <text key={`left-${label}`} x="0.55" y={label - 0.3} textAnchor="middle" fontSize="0.55" fontWeight="700" fill="white" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">{label}</text>)}
        <rect x="0.08" y="0.08" width="19.84" height="19.84" fill="none" stroke="#ffeb3b" strokeOpacity="0.9" strokeWidth="0.1" />
        {diameterStart && diameterEnd && <g><line x1={diameterStart.x} y1={diameterStart.y} x2={diameterEnd.x} y2={diameterEnd.y} stroke="#22c55e" strokeOpacity="0.88" strokeWidth="0.16" /><text x={(diameterStart.x + diameterEnd.x) / 2} y={Math.max(1, diameterStart.y - 0.35)} textAnchor="middle" fontSize="0.55" fontWeight="700" fill="#22c55e" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">D</text></g>}
        {heightStart && heightEnd && <g><line x1={heightStart.x} y1={heightStart.y} x2={heightEnd.x} y2={heightEnd.y} stroke="#a855f7" strokeOpacity="0.88" strokeWidth="0.16" /><text x={Math.min(19.4, heightStart.x + 0.35)} y={(heightStart.y + heightEnd.y) / 2} textAnchor="middle" fontSize="0.55" fontWeight="700" fill="#a855f7" stroke="black" strokeOpacity="0.72" strokeWidth="0.08" paintOrder="stroke">H</text></g>}
        {measurements.map((item, index) => {
          const box = record(item.bbox);
          const topLeft = gridPoint(box?.top_left);
          const bottomRight = gridPoint(box?.bottom_right);
          if (!topLeft || !bottomRight) return null;
          const color = GRID_MEASUREMENT_COLORS[index % GRID_MEASUREMENT_COLORS.length];
          const left = Math.min(topLeft.x, bottomRight.x);
          const top = Math.min(topLeft.y, bottomRight.y);
          const width = Math.max(0.15, Math.abs(bottomRight.x - topLeft.x));
          const height = Math.max(0.15, Math.abs(bottomRight.y - topLeft.y));
          return <g key={String(item.source_group_id ?? index)}>
            <rect x={left} y={top} width={width} height={height} fill={color} fillOpacity="0.28" stroke={color} strokeOpacity="0.95" strokeWidth="0.12" />
            <circle cx={topLeft.x} cy={topLeft.y} r="0.18" fill={color} stroke="white" strokeWidth="0.06" />
            <circle cx={bottomRight.x} cy={bottomRight.y} r="0.18" fill={color} stroke="white" strokeWidth="0.06" />
            <text x={Math.min(19.5, left + 0.2)} y={Math.max(0.9, top + 0.7)} fontSize="0.55" fontWeight="700" fill={color} stroke="black" strokeOpacity="0.8" strokeWidth="0.08" paintOrder="stroke">{index + 1}</text>
          </g>;
        })}
      </svg>}
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
  const [diameterMode, setDiameterMode] = useState(false);
  const [gridSizing, setGridSizing] = useState(true);
  const [mode, setMode] = useState<'one_pass' | 'two_step_v385'>('one_pass');
  const [inventoryPrompt, setInventoryPrompt] = useState('');
  const [compilerPrompt, setCompilerPrompt] = useState('');
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
    setSelectedVersion(active?.version ?? ''); setPromptText(active?.text ?? '');
    setModel(nextSettings.defaultModel); setThinkingLevel(nextSettings.defaultThinkingLevel);
    setTemperature(nextSettings.decoding.temperature); setTopP(nextSettings.decoding.topP); setTopK(nextSettings.decoding.topK);
    setInventoryPrompt(nextSettings.twoStep?.inventoryPrompt ?? '');
    setCompilerPrompt(nextSettings.twoStep?.compilerPrompt ?? '');
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
    setImage(null); setPreviewUrl(null); setRun(null); setDiameterMode(false); setGridSizing(true); setMode('one_pass');
    const active = prompts.find((prompt) => prompt.isActive) ?? prompts[0];
    setSelectedVersion(active?.version ?? ''); setPromptText(active?.text ?? '');
    setInventoryPrompt(settings?.twoStep?.inventoryPrompt ?? ''); setCompilerPrompt(settings?.twoStep?.compilerPrompt ?? '');
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
  const stagedDiameterPrompt = prompts.find((prompt) => !prompt.isActive && /^v?3\.84$/i.test(prompt.version));
  const stagedDiameter = Boolean(stagedDiameterPrompt);
  const productionEquivalent = mode === 'one_pass' && Boolean(selectedPrompt?.isActive
    && promptText === selectedPrompt.text
    && model === settings?.defaultModel
    && thinkingLevel === settings?.defaultThinkingLevel
    && !diameterMode
    && !gridSizing);
  const selectPrompt = (version: string) => { const prompt = prompts.find((item) => item.version === version); setSelectedVersion(version); setPromptText(prompt?.text ?? ''); setRun(null); };
  const selectMode = (nextMode: 'one_pass' | 'two_step_v385') => {
    setMode(nextMode); setRun(null); setDiameterMode(false);
    if (nextMode === 'two_step_v385') {
      const target = prompts.find((prompt) => /^v?3\.85$/i.test(prompt.version));
      setSelectedVersion(target?.version ?? '3.85'); setPromptText(target?.text ?? '');
    }
  };

  // Direct-diameter sizing is a v3.84-only test preset. Selecting it changes only
  // this local test source; it has no prompt activation or persistence side effect.
  useEffect(() => {
    if (diameterMode && stagedDiameterPrompt && selectedVersion !== stagedDiameterPrompt.version) {
      setSelectedVersion(stagedDiameterPrompt.version);
      setPromptText(stagedDiameterPrompt.text);
      setRun(null);
    }
  }, [diameterMode, selectedVersion, stagedDiameterPrompt]);

  const execute = async () => {
    if (!image) { toast.error('Upload a test image first.'); return; }
    if (mode === 'one_pass' && !promptText.trim()) { toast.error('Enter a prompt before testing.'); return; }
    if (mode === 'two_step_v385' && (!inventoryPrompt.trim() || !compilerPrompt.trim())) { toast.error('Both two-step prompts are required.'); return; }
    runStartedAt.current = Date.now(); setElapsedMs(0); setRunning(true); setRun(null);
    try {
      const response = await adminFetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        image, prompt: { sourceVersion: selectedVersion, checksum: selectedPrompt?.checksum, text: promptText },
        mode, twoStep: mode === 'two_step_v385' ? { inventoryPrompt, compilerPrompt } : undefined,
        settings: { model, thinkingLevel, temperature, topP, topK }, gridSizing, useDiameterAnchorSizing: mode === 'one_pass' && diameterMode,
      }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(json.error ?? json.message ?? 'Prompt test failed.'));
      setRun(json); toast.success('Prompt test complete. Nothing was saved.');
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
  const gridSizingResult = record(run?.gridSizing);
  const visualInventory = record(run?.inventory);
  const stageTimings = record(run?.stageTimings);
  const rawInventoryResponse = run?.rawInventoryResponse;
  const rawCompilerResponse = run?.rawCompilerResponse ?? raw;
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
  const resultsIntro = <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-gray-900">3. Test results</h2><p className="text-sm text-gray-500">Raw model response → validated analysis → final price</p></div>{run && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}</div>{!run && <div className="flex min-h-40 items-center justify-center text-center text-sm text-gray-500">Run a test to inspect the full response and storefront-equivalent price.</div>}</div>;
  const executionMetadata = run ? <ValueGrid title="Execution metadata" data={{ mode: returnedPrompt?.executionMode, sourcePromptVersion: returnedPrompt?.sourceVersion ?? run.promptVersion ?? selectedVersion, targetPromptVersion: returnedPrompt?.targetVersion, targetPromptChecksum: returnedPrompt?.targetChecksum, submittedPromptChecksum: returnedPrompt?.checksum ?? run.promptChecksum ?? selectedPrompt?.checksum, sourcePromptChecksum: returnedPrompt?.sourceChecksum, inventoryPromptChecksum: returnedPrompt?.inventoryChecksum, compilerPromptChecksum: returnedPrompt?.compilerChecksum, promptEdited: returnedPrompt?.isEdited, sizingSchema: returnedPrompt?.sizeSchema, model: effectiveSettings?.model ?? metadata?.model ?? run.model ?? model, thinkingLevel: effectiveSettings?.thinkingLevel ?? metadata?.thinkingLevel ?? run.thinkingLevel ?? thinkingLevel, inventoryTime: stageTimings?.inventoryMs, compilerTime: stageTimings?.compilerMs, executionTime: stageTimings?.totalMs ?? metadata?.executionTimeMs ?? metadata?.durationMs ?? run.executionTimeMs, validation: run.validationStatus ?? (analysis ? 'passed' : 'not available') }} /> : null;
  const twoStepDetails = twoStepRun ? <>
    {visualInventory ? <><ValueGrid title="Step 1 · Validated visual inventory" data={{ cake: visualInventory.cake, messages: list(visualInventory.messages).length, uncertainties: Array.isArray(visualInventory.uncertainties) ? visualInventory.uncertainties.length : 0, rejection: visualInventory.rejection }} /><ItemCards title="Observed groups" items={list(visualInventory.observed_groups)} /></> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h3 className="font-bold">Step 1 visual inventory unavailable</h3><p className="mt-1">The compiler did not run, so no storefront analysis or price was produced.</p></section>}
    <RawResponsePanel title="Step 1 · Raw visual inventory" value={rawInventoryResponse} />
    <RawResponsePanel title="Step 2 · Raw schema compiler response" value={rawCompilerResponse} />
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
          {previewUrl ? <div className="relative"><TestImagePreview src={previewUrl} showGrid={gridSizing} gridSizing={gridSizingResult} /><button onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setImage(null); }} className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white" aria-label="Remove image"><X className="h-4 w-4" /></button>{gridSizing && <p className="border-t border-cyan-100 bg-cyan-50 px-4 py-2 text-xs text-cyan-900">The same labeled 20×20 overlay will be sent to Gemini for this test.{gridSizingResult ? ' Colored boxes show representative topper coordinates; green D and purple H mark the top-tier diameter and height.' : ''}</p>}</div> : <button onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDropTarget(true); }} onDragLeave={() => setIsDropTarget(false)} onDrop={(event) => { event.preventDefault(); setIsDropTarget(false); void chooseFile(event.dataTransfer.files[0]); }} className={`m-4 flex min-h-72 w-[calc(100%-2rem)] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition ${isDropTarget ? 'border-violet-500 bg-violet-50' : 'border-violet-200 bg-violet-50/40 hover:border-violet-400'}`}><ImagePlus className="mb-3 h-10 w-10 text-violet-500" /><span className="font-semibold text-gray-800">Paste a cake image anywhere with ⌘V / Ctrl+V</span><span className="mt-1 text-sm text-gray-500">or drop one here / browse from this device</span><span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"><Upload className="h-4 w-4" />Choose image</span></button>}
          <input ref={fileInput} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-gray-900">2. Prompt & model</h2><p className="text-sm text-gray-500">Only settings shown here are sent to Gemini.<br /><span className={productionEquivalent ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>{productionEquivalent ? 'Production-equivalent configuration · uncached and non-persistent' : mode === 'two_step_v385' ? 'Experimental two-step v3.85 compiler · uncached and non-persistent' : 'Experiment configuration · differs from production'}</span></p></div>{loadingConfig && <Loader2 className="h-5 w-5 animate-spin text-violet-600" />}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Analysis mode<select value={mode} onChange={(event) => selectMode(event.target.value as 'one_pass' | 'two_step_v385')} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"><option value="one_pass">One-pass analysis</option><option value="two_step_v385" disabled={!settings?.twoStep?.targetAvailable}>Two-step visual inventory → v3.85 compiler{settings?.twoStep?.targetAvailable ? '' : ' (unavailable)'}</option></select></label>
            {mode === 'one_pass' ? <label className="text-sm font-medium text-gray-700">Prompt version<div className="relative mt-1"><select value={selectedVersion} onChange={(event) => selectPrompt(event.target.value)} disabled={loadingConfig} className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm focus:border-violet-500 focus:outline-none"><option value="">Select prompt</option>{prompts.map((prompt) => <option key={prompt.id} value={prompt.version}>v{prompt.version} {prompt.isActive ? '— active' : '— staged'}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" /></div></label> : <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-950"><strong>Target contract</strong><br /><span className="text-xs">v{settings?.twoStep?.targetVersion} · {settings?.twoStep?.targetChecksum}</span></div>}
            <label className="text-sm font-medium text-gray-700">Gemini model<div className="relative mt-1"><select value={model} onChange={(event) => { setModel(event.target.value); setThinkingLevel(settings?.models.find((item) => item.id === event.target.value)?.thinkingLevels[0] ?? 'LOW'); }} className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm focus:border-violet-500 focus:outline-none">{settings?.models.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" /></div></label>
            <label className="text-sm font-medium text-gray-700">Thinking level<select value={thinkingLevel} onChange={(event) => setThinkingLevel(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none">{thinkingOptions.map((level) => <option key={level}>{level}</option>)}</select></label>
            {mode === 'one_pass' && <label className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-950"><input checked={diameterMode} disabled={!stagedDiameter} onChange={(event) => setDiameterMode(event.target.checked)} type="checkbox" className="h-4 w-4 accent-violet-600" /><span><strong>v3.84 diameter anchors</strong><br /><span className="text-xs text-violet-700">{stagedDiameter ? 'Test-only; never activates v3.84.' : 'Unavailable: v3.84 is not staged.'}</span></span></label>}
            <label className="flex items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm text-cyan-950 sm:col-span-2"><input checked={gridSizing} onChange={(event) => { setGridSizing(event.target.checked); setRun(null); }} type="checkbox" className="h-4 w-4 accent-cyan-600" /><span><strong>20×20 reference-grid bbox-area sizing</strong><br /><span className="text-xs text-cyan-800">Overlay the image before analysis and recalculate representative item categories using box area ÷ top-tier diameter × height. Lab-only; no prompt or cache changes.</span></span></label>
          </div>
          {mode === 'one_pass' ? <label className="mt-4 block text-sm font-medium text-gray-700">Editable prompt <span className="font-normal text-gray-500">{selectedPrompt?.checksum ? `· source checksum ${selectedPrompt.checksum}` : ''}</span><textarea value={promptText} onChange={(event) => { setPromptText(event.target.value); setRun(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-violet-500 focus:outline-none" placeholder="Prompt text loads after sign-in." /></label> : <div className="mt-4 space-y-4"><label className="block text-sm font-medium text-gray-700">Step 1 · Editable visual-inventory prompt<textarea value={inventoryPrompt} onChange={(event) => { setInventoryPrompt(event.target.value); setRun(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-violet-500 focus:outline-none" /></label><label className="block text-sm font-medium text-gray-700">Step 2 · Editable schema-compiler prompt<textarea value={compilerPrompt} onChange={(event) => { setCompilerPrompt(event.target.value); setRun(null); }} rows={12} className="mt-1 w-full resize-y rounded-xl border border-gray-300 p-3 font-mono text-xs leading-5 focus:border-violet-500 focus:outline-none" /></label></div>}
          <div className="mt-4 grid grid-cols-3 gap-3"><label className="text-xs font-medium text-gray-600">Temperature<input type="number" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" /></label><label className="text-xs font-medium text-gray-600">Top P<input type="number" min="0" max="1" step="0.05" value={topP} onChange={(event) => setTopP(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" /></label><label className="text-xs font-medium text-gray-600">Top K<input type="number" min="1" step="1" value={topK} onChange={(event) => setTopK(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" /></label></div>
          <button disabled={running || loadingConfig || !image || (mode === 'one_pass' ? !promptText.trim() : !settings?.twoStep?.targetAvailable || !inventoryPrompt.trim() || !compilerPrompt.trim())} onClick={() => void execute()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300">{running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}{running ? `Running Gemini · ${formatElapsed(elapsedMs)}` : productionEquivalent ? 'Run production-equivalent test' : mode === 'two_step_v385' ? 'Run two-step experiment' : 'Run experiment'}</button>
        </div>
        {resultsIntro}{executionMetadata}
      </section>
      <section className="space-y-5">{run && <>
        {errors.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="mb-2 flex items-center gap-2 font-bold"><AlertCircle className="h-4 w-4" />Warnings / errors</div>{errors.map((error, index) => <p key={index}>{display(error)}</p>)}</div>}
        {twoStepDetails}
        <GridSizingSummary value={gridSizingResult} />
        {analysis ? <><ValueGrid title="Post-processed cake analysis" data={cake}><PricingSummary pricing={pricing} priceOptions={priceOptions} priceItems={priceItems} /></ValueGrid><AnalysisItemCards title="Main toppers" items={toppers} kind="topper" priceKeyPrefix="main_toppers" itemPrices={analysisItemPrices} /><AnalysisItemCards title="Support elements" items={support} kind="support" priceKeyPrefix="support_elements" itemPrices={analysisItemPrices} /><ItemCards title="Messages" items={messages} /></> : <UnvalidatedAnalysisNotice rawAnalysis={rawAnalysis} />}
        {!twoStepRun && <RawResponsePanel title="Raw model response" value={raw} />}
      </>}</section>
    </div>
  </main>;
}
