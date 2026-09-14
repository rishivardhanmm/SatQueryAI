'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Minus,
  Maximize,
  RotateCcw,
  Move,
  MapPin,
  Layers3,
  ScanLine,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import type { ImageInput, Evidence } from '@/lib/domain';
export default function Viewer({
  images,
  evidence,
  layers,
  opacity,
}: {
  images: ImageInput[];
  evidence: Evidence[];
  layers: string[];
  opacity: number;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [comparison, setComparison] = useState('overlay'),
    [swipe, setSwipe] = useState(50),
    [inspect, setInspect] = useState('Move over imagery to inspect pixels'),
    [full, setFull] = useState(false);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const ref = useRef<HTMLDivElement>(null);
  const first = images[0],
    second = images[1];
  const colors = {
    built: '#91dfb1',
    change: '#efaa6a',
    water: '#77bce8',
    vegetation: '#b0cd79',
  };
  const source = (i: ImageInput | undefined) => (
    <>
      {i?.preview ? (
        <img
          draggable={false}
          src={i.preview}
          alt={
            i.demo
              ? 'Sentinel-2 Kolkata reference, with illustrative demo layers'
              : i.name
          }
          style={{
            filter:
              i.modality === 'SAR' && i.demo
                ? 'grayscale(1) contrast(1.5)'
                : '',
          }}
        />
      ) : (
        <div className="no-preview">
          <Layers3 />
          <p>
            {i
              ? 'Preview unavailable. Metadata is available in the input panel.'
              : 'Upload imagery or select a demo to begin.'}
          </p>
        </div>
      )}
    </>
  );
  const overlay = (all = true) => (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className="evidence-svg"
      style={{ opacity: opacity / 100 }}
    >
      <defs>
        <pattern
          id="hatch"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <line x1="0" x2="0" y1="0" y2="12" stroke="#efaa6a" strokeWidth="3" />
        </pattern>
      </defs>
      {evidence
        .filter((e) => layers.includes(e.kind) && (all || e.kind !== 'change'))
        .map((e) => (
          <g key={e.id}>
            <polygon
              points={e.points
                .map((p) => p.map((x) => x * 1000).join(','))
                .join(' ')}
              fill={e.kind === 'change' ? 'url(#hatch)' : colors[e.kind] + '33'}
              stroke={colors[e.kind]}
              strokeWidth="3"
              strokeDasharray={e.kind === 'change' ? '9 4' : undefined}
            />
            <text
              x={e.points[0][0] * 1000}
              y={e.points[0][1] * 1000 - 10}
              fill={colors[e.kind]}
              fontSize="18"
              stroke="#10191b"
              strokeWidth="4"
              paintOrder="stroke"
            >
              {e.label}
            </text>
          </g>
        ))}
    </svg>
  );
  return (
    <div ref={ref} className={'viewer ' + (full ? 'viewer-full' : '')}>
      <div className="viewer-toolbar">
        <span>
          <MapPin size={15} />
          {first?.demo
            ? 'Kolkata · Reference scene'
            : first?.name || 'Imagery viewer'}
        </span>
        {second && (
          <Tabs
            value={comparison}
            onValueChange={(v) => setComparison(String(v))}
          >
            <TabsList>
              <TabsTrigger value="overlay">Overlay</TabsTrigger>
              <TabsTrigger value="swipe">Swipe</TabsTrigger>
              <TabsTrigger value="side">Side by side</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      <div
        className="map-surface"
        onWheel={(e) =>
          setZoom((z) =>
            Math.min(5, Math.max(1, z + (e.deltaY < 0 ? 0.15 : -0.15))),
          )
        }
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerMove={(e) => {
          if (drag.current) {
            setPan({
              x: drag.current.px + e.clientX - drag.current.x,
              y: drag.current.py + e.clientY - drag.current.y,
            });
          }
          const rect = e.currentTarget.getBoundingClientRect();
          const nx =
              ((e.clientX - rect.left - rect.width / 2 - pan.x) / zoom +
                rect.width / 2) /
              rect.width,
            ny =
              ((e.clientY - rect.top - rect.height / 2 - pan.y) / zoom +
                rect.height / 2) /
              rect.height;
          if (first) {
            if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
              setInspect('Outside imagery bounds');
              return;
            }
            const item =
              comparison === 'side' && second && nx >= 0.5 ? second : first;
            const localX = comparison === 'side' && second ? (nx * 2) % 1 : nx;
            const px = Math.floor(localX * item.width),
              py = Math.floor(ny * item.height);
            const b = item.bounds;
            setInspect(
              `Pixel ${px}, ${py}` +
                (b
                  ? ` · ${(b[0] + localX * (b[2] - b[0])).toFixed(1)}, ${(b[3] - ny * (b[3] - b[1])).toFixed(1)} ${first.demo ? '(fixture grid)' : ''}`
                  : ''),
            );
          }
        }}
      >
        <div
          className="map-transform"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          {comparison === 'side' && second ? (
            <div className="side-images">
              <div>
                {layers.includes('base') &&
                  layers.includes('source1') &&
                  source(first)}
                {overlay(false)}
                <b>Time 1 / Optical</b>
              </div>
              <div>
                {layers.includes('base') &&
                  layers.includes('source2') &&
                  source(second)}
                {overlay()}
                <b>Time 2 / {second.modality}</b>
              </div>
            </div>
          ) : (
            <>
              {layers.includes('base') &&
                layers.includes('source1') &&
                source(first)}
              {comparison === 'overlay' &&
                second &&
                layers.includes('base') &&
                layers.includes('source2') && (
                  <div
                    className="source-blend"
                    style={{ opacity: layers.includes('source1') ? 0.5 : 1 }}
                  >
                    {source(second)}
                  </div>
                )}
              {comparison === 'swipe' && second ? (
                <>
                  <div
                    className="swipe-image"
                    style={{ clipPath: `inset(0 0 0 ${swipe}%)` }}
                  >
                    {layers.includes('base') &&
                      layers.includes('source2') &&
                      source(second)}
                    {overlay()}
                  </div>
                  <div className="swipe-line" style={{ left: swipe + '%' }}>
                    <span>↔</span>
                  </div>
                </>
              ) : (
                overlay()
              )}
            </>
          )}
        </div>
        {!first && (
          <div className="empty-map">
            <ScanLine size={44} />
            <h3>Your next insight starts here.</h3>
            <p>Add an image to explore it spatially.</p>
          </div>
        )}
        <div className="map-buttons">
          <button
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
          >
            <Plus size={18} />
          </button>
          <button
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            <Minus size={18} />
          </button>
          <button
            title="Reset view"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <RotateCcw size={17} />
          </button>
          <button
            title={full ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => setFull(!full)}
          >
            <Maximize size={17} />
          </button>
        </div>
        <div className="north">
          N<span>↑</span>
        </div>
        {first && (
          <div className="map-source">
            {first.demo ? 'REFERENCE IMAGE · DEMO OVERLAYS' : 'SOURCE RASTER'}
            <small>
              {first.demo
                ? 'Copernicus Sentinel-2 · 2022'
                : first.crs || 'Not georeferenced'}
            </small>
          </div>
        )}
        <div className="zoom-tag">
          {Math.round(zoom * 100)}% <Move size={12} />
        </div>
      </div>
      {comparison === 'swipe' && second && (
        <div className="swipe-control">
          <span>Before / Optical</span>
          <Slider
            aria-label="Comparison split"
            value={[swipe]}
            onValueChange={(v) => setSwipe(Array.isArray(v) ? v[0] : v)}
          />
          <span>After / SAR</span>
        </div>
      )}
      <div className="map-bottom">
        <span>{inspect}</span>
        {first?.demo && (
          <a
            href="https://www.esa.int/ESA_Multimedia/Images/2023/02/Earth_from_Space_Kolkata_India"
            target="_blank"
            rel="noreferrer"
          >
            ESA / Copernicus · CC BY-SA 3.0 IGO
          </a>
        )}
      </div>
      {evidence.length > 0 && (
        <div className="legend">
          {[
            ['change', '▨', 'Changed region'],
            ['built', '□', 'Built-up'],
            ['water', '≈', 'Water'],
            ['vegetation', '◇', 'Vegetation'],
          ]
            .filter(
              ([k]) => layers.includes(k) && evidence.some((e) => e.kind === k),
            )
            .map(([k, s, label]) => (
              <span key={k} style={{ color: colors[k as keyof typeof colors] }}>
                {s} {label}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
