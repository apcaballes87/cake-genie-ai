'use client';

import { useRef, useState } from 'react';

export type BoundingBoxGeometry = {
  cake_diameter_line: { start: [number, number]; end: [number, number] };
  cake_height_line: { start: [number, number]; end: [number, number] };
  elements: Array<{ element_id: string; label: string; category?: string; box_2d: [number, number, number, number]; confidence: number }>;
};

type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type Drag = { elementId: string; handle: Handle | 'move'; start: { x: number; y: number }; box: [number, number, number, number] };

const clamp = (value: number) => Math.max(0, Math.min(1000, value));
// Keep the geometry legible without obscuring small cake details. The handles
// retain their larger hit area, so thin visual strokes do not reduce usability.
const MEASUREMENT_STROKE_WIDTH = 1.5;
const BOX_STROKE_WIDTH = 1.25;
const HANDLE_STROKE_WIDTH = 1.25;
const handlePositions: Array<{ handle: Handle; x: (box: [number, number, number, number]) => number; y: (box: [number, number, number, number]) => number }> = [
  { handle: 'nw', x: (box) => box[1], y: (box) => box[0] }, { handle: 'n', x: (box) => (box[1] + box[3]) / 2, y: (box) => box[0] }, { handle: 'ne', x: (box) => box[3], y: (box) => box[0] },
  { handle: 'e', x: (box) => box[3], y: (box) => (box[0] + box[2]) / 2 }, { handle: 'se', x: (box) => box[3], y: (box) => box[2] }, { handle: 's', x: (box) => (box[1] + box[3]) / 2, y: (box) => box[2] },
  { handle: 'sw', x: (box) => box[1], y: (box) => box[2] }, { handle: 'w', x: (box) => box[1], y: (box) => (box[0] + box[2]) / 2 },
];

export function boxMetrics(box: [number, number, number, number], diameter: BoundingBoxGeometry['cake_diameter_line'] | null) {
  const width = box[3] - box[1]; const height = box[2] - box[0];
  const diameterLength = diameter ? Math.hypot(diameter.end[1] - diameter.start[1], diameter.end[0] - diameter.start[0]) : 0;
  return { widthRatio: diameterLength > 0 ? width / diameterLength : null, areaRatio: diameterLength > 0 ? (width * height) / (Math.PI * (diameterLength / 2) ** 2) : null };
}

export function updateBoxForPointer(box: [number, number, number, number], handle: Handle | 'move', point: { x: number; y: number }, start: { x: number; y: number }) {
  let [top, left, bottom, right] = box;
  if (handle === 'move') {
    const dx = point.x - start.x; const dy = point.y - start.y; const width = right - left; const height = bottom - top;
    left = clamp(left + dx); top = clamp(top + dy); right = left + width; bottom = top + height;
    if (right > 1000) { right = 1000; left = right - width; }
    if (bottom > 1000) { bottom = 1000; top = bottom - height; }
  } else {
    if (handle.includes('n')) top = Math.min(clamp(point.y), bottom - 1);
    if (handle.includes('s')) bottom = Math.max(clamp(point.y), top + 1);
    if (handle.includes('w')) left = Math.min(clamp(point.x), right - 1);
    if (handle.includes('e')) right = Math.max(clamp(point.x), left + 1);
  }
  return [top, left, bottom, right] as [number, number, number, number];
}

export function BoundingBoxGeometryEditor({ imageSrc, geometry, onChange }: { imageSrc: string; geometry: BoundingBoxGeometry; onChange: (geometry: BoundingBoxGeometry) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const pointForEvent = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current; const matrix = svg?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: clamp(point.x), y: clamp(point.y) };
  };
  const beginDrag = (event: React.PointerEvent<SVGElement>, elementId: string, handle: Handle | 'move', box: [number, number, number, number]) => {
    const point = pointForEvent(event as React.PointerEvent<SVGSVGElement>); if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId); setDrag({ elementId, handle, start: point, box });
  };
  const moveDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return; const point = pointForEvent(event); if (!point) return;
    const nextBox = updateBoxForPointer(drag.box, drag.handle, point, drag.start);
    onChange({ ...geometry, elements: geometry.elements.map((item) => item.element_id === drag.elementId ? { ...item, box_2d: nextBox } : item) });
  };
  const stopDrag = (event: React.PointerEvent<SVGSVGElement>) => { if (drag) event.currentTarget.releasePointerCapture?.(event.pointerId); setDrag(null); };

  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
    <h3 className="text-sm font-bold text-emerald-950">Step 2 · Editable bounding-box geometry</h3>
    <p className="mt-1 text-xs text-emerald-900">Drag a box or any of its eight handles. H measures the front-center cake wall from the base to the visible top front edge. Coordinates are normalized [y, x] tuples and changes exist only in this browser.</p>
    <div className="mt-3 overflow-auto rounded-xl border border-emerald-200 bg-white p-2">
      <div className="relative inline-block max-w-full">
        {/* The SVG shares the image rectangle, so its 0–1000 viewBox is the exact normalized photo space. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="Cake image with editable bounding boxes" className="block max-h-[620px] max-w-full select-none" draggable={false} />
        <svg ref={svgRef} viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full touch-none" onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
          {[{ line: geometry.cake_diameter_line, color: '#16a34a', label: 'D' }, { line: geometry.cake_height_line, color: '#0284c7', label: 'H' }].map(({ line, color, label }) => <g key={label}><line x1={line.start[1]} y1={line.start[0]} x2={line.end[1]} y2={line.end[0]} stroke={color} strokeWidth={MEASUREMENT_STROKE_WIDTH} vectorEffect="non-scaling-stroke" /><text x={(line.start[1] + line.end[1]) / 2} y={(line.start[0] + line.end[0]) / 2 - 12} fill={color} fontSize="30" fontWeight="700">{label}</text></g>)}
          {geometry.elements.map((item, index) => {
            const [top, left, bottom, right] = item.box_2d; const color = ['#7c3aed', '#db2777', '#ea580c', '#0891b2'][index % 4];
            return <g key={item.element_id}><rect x={left} y={top} width={right - left} height={bottom - top} fill={`${color}22`} stroke={color} strokeWidth={BOX_STROKE_WIDTH} vectorEffect="non-scaling-stroke" onPointerDown={(event) => beginDrag(event, item.element_id, 'move', item.box_2d)} className="cursor-move" /><text x={left} y={Math.max(28, top - 10)} fill={color} fontSize="26" fontWeight="700">{index + 1}. {item.label}</text>{handlePositions.map(({ handle, x, y }) => <circle key={handle} cx={x(item.box_2d)} cy={y(item.box_2d)} r="12" fill="white" stroke={color} strokeWidth={HANDLE_STROKE_WIDTH} vectorEffect="non-scaling-stroke" className="cursor-pointer" onPointerDown={(event) => beginDrag(event, item.element_id, handle, item.box_2d)} />)}</g>;
          })}
        </svg>
      </div>
    </div>
    <div className="mt-3 overflow-x-auto rounded-xl border border-emerald-200 bg-white"><table className="min-w-full text-left text-xs"><thead className="bg-emerald-100 text-emerald-950"><tr><th className="px-3 py-2">Element</th><th className="px-3 py-2">Box [ymin, xmin, ymax, xmax]</th><th className="px-3 py-2">Width ratio</th><th className="px-3 py-2">Area ratio</th></tr></thead><tbody>{geometry.elements.map((item) => { const metrics = boxMetrics(item.box_2d, geometry.cake_diameter_line); return <tr key={item.element_id} className="border-t border-emerald-100"><td className="px-3 py-2 font-medium">{item.label}</td><td className="px-3 py-2 font-mono">[{item.box_2d.map((value) => value.toFixed(1)).join(', ')}]</td><td className="px-3 py-2 font-mono">{metrics.widthRatio?.toFixed(4) ?? '—'}</td><td className="px-3 py-2 font-mono">{metrics.areaRatio?.toFixed(4) ?? '—'}</td></tr>; })}</tbody></table></div>
  </section>;
}
