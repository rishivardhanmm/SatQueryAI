'use client';
import { useEffect, useState, useRef } from 'react';
import {
  UploadCloud,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronRight,
  Layers3,
  Satellite,
  ArrowUp,
  Download,
  RotateCcw,
  Info,
  Loader2,
  Terminal,
  ShieldCheck,
  Sparkles,
  Plus,
  ScanLine,
} from 'lucide-react';
import AppShell from '@/components/app-shell';
import Viewer from '@/components/viewer';
import { Picker } from '@/components/controls';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { ImageInput, Mode, Analysis } from '@/lib/domain';
import { MODE_LABELS, SUGGESTIONS } from '@/lib/domain';
import { demoImages } from '@/lib/services/fixtures';
import { validateImages } from '@/lib/services/validation';
const stages = [
  'Understanding query',
  'Validating imagery',
  'Selecting specialist tools',
  'Loading spatial evidence',
  'Integrating evidence',
  'Response ready',
];
async function request(url: string, body?: unknown) {
  const r = await fetch(
    url,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = (await r.json()) as any;
  if (!r.ok) throw Error(data.error || 'Request failed');
  return data;
}
export default function Workspace() {
  const [mode, setMode] = useState<Mode>('auto'),
    [images, setImages] = useState<ImageInput[]>([]),
    [query, setQuery] = useState(''),
    [result, setResult] = useState<Analysis | null>(null),
    [messages, setMessages] = useState<Analysis[]>([]),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [stage, setStage] = useState(-1),
    [error, setError] = useState(''),
    [detail, setDetail] = useState<ImageInput | null>(null),
    [layers, setLayers] = useState([
      'base',
      'source1',
      'source2',
      'built',
      'water',
      'vegetation',
      'change',
    ]),
    [opacity, setOpacity] = useState(75),
    [tab, setTab] = useState('answer'),
    [demoOpen, setDemoOpen] = useState(false),
    [reporting, setReporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const validation = validateImages(images, mode);
  const demo = images.length > 0 && images.every((i) => i.demo);
  const runRef = useRef<(q: string) => Promise<any>>(async () => {});
  const loadDemo = (m: Mode) => {
    if (busy) return;
    setImages(demoImages(m));
    setMode('auto');
    setQuery(SUGGESTIONS[m][0]);
    setResult(null);
    setMessages([]);
    setError('');
    setDemoOpen(false);
  };
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const d = p.get('demo');
    if (d && ['single', 'change', 'fusion'].includes(d)) loadDemo(d as Mode);
    const id = p.get('id');
    if (id)
      request('/api/analysis/' + id)
        .then((a) => {
          setImages(a.images);
          setMode(a.mode);
          setResult(a);
          setMessages([a]);
          setQuery('');
        })
        .catch((e) => setError(e.message));
  }, []);
  const run = async (q = query) => {
    if (!q.trim() || busy) return;
    if (!images.length || !validation.ready) {
      setError('Add valid imagery before running an analysis.');
      return;
    }
    setBusy(true);
    setError('');
    setStage(0);
    const timer = setInterval(() => setStage((s) => Math.min(4, s + 1)), 480);
    try {
      const threshold = Number(
        localStorage.getItem('satquery-threshold') || 0.7,
      );
      const [a] = await Promise.all([
        request('/api/query', {
          query: q,
          mode,
          demo: demo ? validation.mode : undefined,
          imageIds: images.map((i) => i.id),
          modalities: Object.fromEntries(images.map((i) => [i.id, i.modality])),
          threshold,
        }),
        new Promise((resolve) => setTimeout(resolve, 2600)),
      ]);
      setResult(a);
      setMessages((m) => [...m, a]);
      setTab('answer');
      setQuery('');
      setStage(5);
      return { id: a.id, status: a.status, task: a.task };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      throw e;
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  };
  runRef.current = run;
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'run_satellite_analysis',
          title: 'Run satellite analysis',
          description:
            'Analyze the imagery currently loaded in the workspace and save the result.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', minLength: 1, maxLength: 2000 },
            },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: async (input: any) => {
            if (
              typeof input?.query !== 'string' ||
              !input.query.trim() ||
              input.query.length > 2000
            )
              throw Error('A query of 1–2000 characters is required');
            return runRef.current(input.query);
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  const upload = async (files: FileList | File[]) => {
    if (busy) return;
    setError('');
    const list = Array.from(files);
    if (list.length + (demo ? 0 : images.length) > 2) {
      setError('Upload at most two images. Remove an existing image first.');
      return;
    }
    setUploading(true);
    if (demo) {
      setImages([]);
      setResult(null);
      setMessages([]);
    }
    try {
      for (const file of list) {
        let preview: Blob | null = null;
        try {
          if (/\.tiff?$/i.test(file.name)) {
            if (file.size > 25 * 1024 * 1024) throw Error('File exceeds 25 MB');
            const { fromArrayBuffer } = await import('geotiff');
            const raster = await (
              await fromArrayBuffer(await file.arrayBuffer())
            ).getImage();
            if (raster.getWidth() * raster.getHeight() > 16000000)
              throw Error('Raster too large');
            const w = Math.min(900, raster.getWidth()),
              h = Math.max(
                1,
                Math.round((w * raster.getHeight()) / raster.getWidth()),
              );
            const bands = raster.getSamplesPerPixel();
            const values = await raster.readRasters({
              width: w,
              height: h,
              samples: Array.from({ length: Math.min(bands, 3) }, (_, i) => i),
              interleave: true,
            });
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            const pixels = ctx.createImageData(w, h);
            let max = 0;
            for (let i = 0; i < values.length; i++)
              if (Number.isFinite(values[i]))
                max = Math.max(max, Number(values[i]));
            for (let i = 0; i < w * h; i++) {
              for (let j = 0; j < 3; j++)
                pixels.data[i * 4 + j] = Math.max(
                  0,
                  Math.min(
                    255,
                    (Number(
                      values[i * Math.min(bands, 3) + Math.min(j, bands - 1)],
                    ) /
                      (max || 1)) *
                      255,
                  ),
                );
              pixels.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(pixels, 0, 0);
            preview = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/jpeg', 0.85),
            );
          }
        } catch {}
        const form = new FormData();
        form.append('file', file);
        if (preview) form.append('preview', preview, 'preview.jpg');
        const res = await fetch('/api/images', { method: 'POST', body: form }),
          data = (await res.json()) as any;
        if (!res.ok) throw Error(data.error);
        setImages((prev) => [...prev, data]);
        setResult(null);
        setMessages([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const report = async (format: 'pdf' | 'json') => {
    if (!result) return;
    setReporting(true);
    try {
      const response = await fetch(
        `/api/reports/${result.id}?format=${format}`,
      );
      if (!response.ok) throw Error('Report generation failed. Please retry.');
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `SatQuery-${result.id.slice(0, 8)}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReporting(false);
    }
  };
  return (
    <AppShell active="New analysis" wide>
      <div className="workspace-title">
        <div>
          <h1>
            Analysis workspace{' '}
            <span className="beta-tag">
              {demo ? 'CURATED DEMO' : 'NEW ANALYSIS'}
            </span>
          </h1>
          <p>
            {result
              ? `SQ-${result.id.slice(0, 8).toUpperCase()} · Saved to analysis history`
              : 'Ask a question. Let the right specialists take it from here.'}
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary" onClick={() => setDemoOpen(true)}>
            <Sparkles size={15} /> Demo datasets
          </button>
          {result && (
            <button
              className="primary"
              disabled={reporting}
              onClick={() => report('pdf')}
            >
              <Download size={15} />
              {reporting ? 'Generating…' : 'Generate report'}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={17} />
          {error}
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="workspace-grid">
        <aside className="input-panel">
          <div className="panel-heading">
            <Layers3 size={17} />
            <h2>Inputs & layers</h2>
            <span>{images.length}/2</span>
          </div>
          <div className="panel-section">
            <label className="field-label">INPUT CONFIGURATION</label>
            <Picker
              label="Input configuration"
              value={mode}
              onChange={(v) => {
                if (busy) return;
                setMode(v as Mode);
                setResult(null);
              }}
              options={Object.entries(MODE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <div
              className={'dropzone ' + (uploading ? 'loading' : '')}
              role="button"
              tabIndex={0}
              onClick={() => !uploading && fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                !uploading && upload(e.dataTransfer.files);
              }}
            >
              {uploading ? (
                <Loader2 className="spin" size={26} />
              ) : (
                <UploadCloud size={26} />
              )}
              <strong>
                {uploading ? 'Inspecting imagery…' : 'Drop your imagery here'}
              </strong>
              <span>
                or <u>browse files</u>
              </span>
              <small>GeoTIFF, TIFF, PNG, JPEG · 25 MB max</small>
            </div>
            <input
              hidden
              type="file"
              accept=".tif,.tiff,.png,.jpg,.jpeg"
              multiple
              ref={fileRef}
              onChange={(e) => e.target.files && upload(e.target.files)}
            />
            {images.length > 0 && (
              <div className="detected">
                <Sparkles size={13} />
                {MODE_LABELS[validation.mode]}{' '}
                {validation.ready && <CheckCircle2 size={13} />}
              </div>
            )}
            {images.map((im, i) => (
              <div className="image-card" key={im.id}>
                <div className="image-card-top">
                  <span className="file-order">
                    {images.length === 1
                      ? 'IMAGE'
                      : validation.mode === 'fusion'
                        ? i
                          ? 'SAR'
                          : 'OPTICAL'
                        : `TIME ${i + 1} / ${i ? 'AFTER' : 'BEFORE'}`}
                  </span>
                  <button
                    aria-label={'Remove ' + im.name}
                    disabled={busy}
                    onClick={() => {
                      setImages(images.filter((x) => x.id !== im.id));
                      setResult(null);
                      setMessages([]);
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
                <button className="file-summary" onClick={() => setDetail(im)}>
                  {im.preview ? (
                    <img src={im.preview} alt="Input thumbnail" />
                  ) : (
                    <FileImage size={27} />
                  )}
                  <span>
                    <strong>{im.name}</strong>
                    <small>
                      {im.format} · {(im.size / 1048576).toFixed(1)} MB
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
                <div className="file-meta">
                  {im.width} × {im.height} <span>{im.bands} bands</span>
                </div>
                {!demo && (
                  <Picker
                    value={im.modality}
                    label={'Modality for ' + im.name}
                    onChange={(v) => {
                      if (busy) return;
                      setImages(
                        images.map((x) =>
                          x.id === im.id ? { ...x, modality: v as any } : x,
                        ),
                      );
                      setResult(null);
                    }}
                    options={['Unknown', 'Optical', 'Multispectral', 'SAR'].map(
                      (v) => ({ value: v, label: v }),
                    )}
                  />
                )}
                <div className="crs-line">
                  {im.crs ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <AlertTriangle size={12} />
                  )}{' '}
                  {im.crs || 'No geographic metadata'}
                  <button
                    title="Inspect metadata"
                    onClick={() => setDetail(im)}
                  >
                    <Info size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {images.length > 0 && (
            <div className="panel-section">
              <div className="section-label">
                {images.length === 2
                  ? 'PAIR COMPATIBILITY'
                  : 'INPUT VALIDATION'}
                <span title="Co-registration aligns pixels to the same geographic location.">
                  <Info size={13} />
                </span>
              </div>
              <div className="validation-list">
                {validation.checks.map((c) => (
                  <div key={c.name} title={c.detail}>
                    <span>{c.name}</span>
                    <span className={c.status}>
                      {c.status === 'pass' ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <AlertTriangle size={13} />
                      )}{' '}
                      {c.status === 'pass'
                        ? 'Passed'
                        : c.status === 'fail'
                          ? 'Failed'
                          : 'Review'}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className={
                  'validation-status ' + (!validation.ready ? 'invalid' : '')
                }
              >
                <ShieldCheck size={15} />
                {validation.ready
                  ? demo
                    ? 'Ready for demo analysis'
                    : 'Metadata inspected'
                  : 'Resolve input issues'}
              </div>
              {validation.warnings.length > 0 && (
                <details className="warnings">
                  <summary>
                    {validation.warnings.length} validation notes
                  </summary>
                  {validation.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </details>
              )}
            </div>
          )}
          <div className="panel-section">
            <div className="section-label">
              MAP LAYERS <span>{layers.length}</span>
            </div>
            {[
              ['base', 'Source imagery', '#8d9eab'],
              ...(images.length > 0
                ? [
                    [
                      'source1',
                      images.length === 1
                        ? 'Image 1'
                        : validation.mode === 'fusion'
                          ? 'Optical layer'
                          : 'Time 1 / Before',
                      '#8d9eab',
                    ],
                  ]
                : []),
              ...(images.length > 1
                ? [
                    [
                      'source2',
                      validation.mode === 'fusion'
                        ? 'SAR layer'
                        : 'Time 2 / After',
                      '#9bb7ce',
                    ],
                  ]
                : []),
              ['built', 'Built-up regions', '#91dfb1'],
              ['water', 'Water regions', '#77bce8'],
              ['vegetation', 'Vegetation', '#b0cd79'],
              ['change', 'Change overlay', '#efaa6a'],
            ].map(([id, label, color]) => (
              <label className="layer-row" key={id}>
                <Checkbox
                  checked={layers.includes(id)}
                  onCheckedChange={(checked) =>
                    setLayers((l) =>
                      checked ? [...l, id] : l.filter((x) => x !== id),
                    )
                  }
                />
                <span style={{ background: color }} />
                {label}
              </label>
            ))}
            <div className="opacity-label">
              Evidence opacity <span>{opacity}%</span>
            </div>
            <Slider
              aria-label="Evidence opacity"
              value={[opacity]}
              onValueChange={(v) => setOpacity(Array.isArray(v) ? v[0] : v)}
            />
          </div>
          <div className="input-foot">
            <ShieldCheck size={15} /> Your imagery stays in this private
            workspace.
          </div>
        </aside>
        <div className="center-panel">
          <Viewer
            images={images}
            evidence={result?.evidence || []}
            layers={layers}
            opacity={opacity}
          />
          {demo && (
            <div className="demo-notice">
              <Info size={16} />
              <span>
                Illustrative demo. Dates, sensor pairs, masks and confidence are
                fixtures. The reference is Sentinel-2 imagery of Kolkata (2022).
              </span>
            </div>
          )}
          {result?.metrics.length ? (
            <div className="metrics-panel">
              <div className="section-label">
                SPATIAL MEASUREMENTS{' '}
                <span>
                  {result.demo ? 'FROM DEMO POLYGONS' : 'FROM SPATIAL OUTPUTS'}
                </span>
              </div>
              <div className="metrics-grid">
                {result.metrics.map((m, i) => (
                  <div className={i > 1 ? 'positive' : ''} key={m.label}>
                    <small>{m.label}</small>
                    <strong>{m.value}</strong>
                  </div>
                ))}
              </div>
              <small className="metrics-foot">
                {result.demo
                  ? 'Calculated with polygon geometry on the illustrative fixture grid.'
                  : 'Calculated by the specialist provider from spatial outputs.'}
              </small>
            </div>
          ) : (
            <div className="center-empty">
              <ScanLine size={22} />
              <span>
                <strong>Evidence lives here.</strong>
                <small>
                  Run an analysis to reveal spatial regions and measurements.
                </small>
              </span>
            </div>
          )}
        </div>
        <aside className="assistant-panel">
          <div className="panel-heading">
            <span className="assistant-mark">
              <Satellite size={18} />
            </span>
            <h2>SatQuery Assistant</h2>
            <span className="live-dot" />
          </div>
          <div className="assistant-scroll">
            {!result && !busy && (
              <div className="assistant-welcome">
                <div className="welcome-icon">
                  <Sparkles size={28} />
                </div>
                <h3>
                  What would you like
                  <br />
                  to understand?
                </h3>
                <p>
                  Ask about land cover, locate a region, or investigate change.
                  I’ll find the right workflow.
                </p>
                <div className="suggestion-label">TRY ASKING</div>
                {(SUGGESTIONS[validation.mode] || SUGGESTIONS.single).map(
                  (q) => (
                    <button
                      className="suggestion"
                      key={q}
                      onClick={() => setQuery(q)}
                    >
                      {q}
                      <ArrowUp size={14} />
                    </button>
                  ),
                )}
              </div>
            )}
            {busy && (
              <div className="processing" role="status">
                <h3>
                  <Loader2 className="spin" size={16} /> Orchestrating analysis
                </h3>
                {stages.map((s, i) => (
                  <div key={s} className={i <= stage ? 'done' : ''}>
                    {i < stage ? (
                      <CheckCircle2 size={14} />
                    ) : i === stage ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <span className="stage-dot" />
                    )}
                    {s}
                  </div>
                ))}
              </div>
            )}
            {result && !busy && (
              <>
                <div className="user-query">
                  <span className="avatar small">RV</span>
                  <p>{result.query}</p>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <TabsList className="result-tabs">
                    <TabsTrigger value="answer">Answer</TabsTrigger>
                    <TabsTrigger value="evidence">Evidence</TabsTrigger>
                    <TabsTrigger value="confidence">Confidence</TabsTrigger>
                    <TabsTrigger value="execution">Trace</TabsTrigger>
                  </TabsList>
                  <TabsContent value="answer">
                    <div className="answer-header">
                      <Sparkles size={17} />
                      <span>
                        {result.status === 'complete'
                          ? 'Analysis complete'
                          : 'Conclusion withheld'}
                      </span>
                      {result.confidence !== null && (
                        <b>{result.confidence}%</b>
                      )}
                    </div>
                    <div className="task-pill">{result.task}</div>
                    <p className="answer-text">{result.answer}</p>
                    {result.evidence.length > 0 && (
                      <div className="evidence-summary">
                        <CheckCircle2 size={16} />
                        <span>
                          {result.evidence.length} regions linked to spatial
                          evidence
                        </span>
                      </div>
                    )}
                    <div className="limitations">
                      <h4>
                        <ShieldCheck size={14} /> Confidence-aware analysis
                      </h4>
                      {result.limitations.map((l) => (
                        <p key={l}>{l}</p>
                      ))}
                    </div>
                    <div className="answer-actions">
                      <button
                        onClick={() => report('json')}
                        disabled={reporting}
                      >
                        <Download size={13} /> JSON
                      </button>
                      <button onClick={() => setTab('execution')}>
                        <Terminal size={13} /> Execution details
                      </button>
                    </div>
                  </TabsContent>
                  <TabsContent value="evidence">
                    <div className="result-section">
                      <h3>Spatial evidence</h3>
                      <p>Toggle the linked layers to inspect each region.</p>
                      {result.evidence.length === 0 ? (
                        <p>No evidence produced for this conclusion.</p>
                      ) : (
                        result.evidence.map((e) => (
                          <button
                            className="evidence-row"
                            key={e.id}
                            onClick={() =>
                              setLayers((l) =>
                                l.includes(e.kind)
                                  ? l.filter((x) => x !== e.kind)
                                  : [...l, e.kind],
                              )
                            }
                          >
                            <span>
                              {e.label}
                              <small>
                                {e.points.length} vertices · {e.area.toFixed(2)}{' '}
                                km²{' '}
                                {result.demo ? 'fixture area' : 'measured area'}
                              </small>
                            </span>
                            <CheckCircle2
                              size={16}
                              style={{
                                opacity: layers.includes(e.kind) ? 1 : 0.25,
                              }}
                            />
                          </button>
                        ))
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="confidence">
                    <div className="result-section">
                      <h3>Confidence assessment</h3>
                      {result.confidence === null ? (
                        <p>
                          Confidence is unavailable because inference was
                          withheld.
                        </p>
                      ) : (
                        <>
                          <div className="confidence-big">
                            {result.confidence}
                            <span>%</span>
                          </div>
                          <p>
                            {result.demo
                              ? 'Illustrative overall confidence'
                              : 'Provider confidence'}
                          </p>
                          {result.breakdown.map((b) => (
                            <div className="confidence-bar" key={b.label}>
                              <div>
                                {b.label}
                                <b>{b.value}%</b>
                              </div>
                              <Progress value={b.value} />
                            </div>
                          ))}
                          <p className="muted">
                            {result.demo
                              ? 'Demo scores are predefined examples, not calibrated model probabilities.'
                              : 'Review the provider limitations and calibration before operational use.'}
                          </p>
                        </>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="execution">
                    <div className="result-section">
                      <h3>Execution summary</h3>
                      <dl className="trace-meta">
                        <dt>Task</dt>
                        <dd>{result.task}</dd>
                        <dt>Input</dt>
                        <dd>{MODE_LABELS[result.mode]}</dd>
                        <dt>Status</dt>
                        <dd>{result.status}</dd>
                        <dt>Processing time</dt>
                        <dd>{result.duration.toFixed(2)} s</dd>
                      </dl>
                      <h4>Selected specialist tools</h4>
                      {result.tools.map((t) => (
                        <div className="tool-chip" key={t}>
                          <CheckCircle2 size={13} />
                          {t}
                        </div>
                      ))}
                      <h4>Permitted parameters</h4>
                      <pre>{`Tile size    ${result.parameters.tileSize} × ${result.parameters.tileSize}\nOverlap      ${result.parameters.overlap} px\nThreshold    ${result.parameters.threshold.toFixed(2)}`}</pre>
                      <h4>Observable execution log</h4>
                      {result.steps.map((s, i) => (
                        <div className="trace-step" key={i}>
                          <span>{String(i + 1).padStart(2, '0')}</span>
                          {s}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
                {messages.length > 1 && (
                  <details className="conversation-history">
                    <summary>{messages.length - 1} earlier questions</summary>
                    {messages.slice(0, -1).map((m) => (
                      <button key={m.id} onClick={() => setResult(m)}>
                        {m.query}
                      </button>
                    ))}
                  </details>
                )}
              </>
            )}
          </div>
          <form
            className="query-form"
            onSubmit={(e) => {
              e.preventDefault();
              run().catch(() => {});
            }}
          >
            <textarea
              aria-label="Ask about uploaded imagery"
              placeholder="Ask about the uploaded imagery…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  run().catch(() => {});
                }
              }}
            />
            <div>
              <span>
                {busy
                  ? 'Processing…'
                  : images.length
                    ? `${images.length} image${images.length > 1 ? 's' : ''} attached`
                    : 'Add imagery to begin'}
              </span>
              <button
                className="send-button"
                aria-label="Run analysis"
                disabled={
                  busy ||
                  uploading ||
                  !images.length ||
                  !validation.ready ||
                  !query.trim()
                }
              >
                <ArrowUp size={20} />
              </button>
            </div>
            <small>
              <ShieldCheck size={11} /> Evidence-grounded. Confidence-aware.
            </small>
          </form>
        </aside>
      </div>
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="metadata-dialog">
          <DialogTitle>Image metadata</DialogTitle>
          <DialogDescription>{detail?.name}</DialogDescription>
          {detail && (
            <dl className="metadata-grid">
              {Object.entries({
                Format: detail.format,
                Dimensions: `${detail.width} × ${detail.height}`,
                Bands: detail.bands,
                CRS: detail.crs || 'Unavailable',
                Resolution: detail.resolution?.join(' × ') || 'Unavailable',
                Bounds:
                  detail.bounds?.map((n) => n.toFixed(2)).join(', ') ||
                  'Unavailable',
                'Acquisition date': detail.date || 'Unavailable',
                Sensor: detail.sensor || 'Unknown',
                Modality: detail.modality,
                Size: (detail.size / 1048576).toFixed(2) + ' MB',
                Provenance: detail.demo
                  ? 'Illustrative demo metadata'
                  : 'Inspected file metadata',
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent>
          <DialogTitle>Choose a demo dataset</DialogTitle>
          <DialogDescription>
            Explore the complete workflow using curated illustrative evidence.
          </DialogDescription>
          {(['single', 'change', 'fusion'] as Mode[]).map((m) => (
            <button className="demo-choice" key={m} onClick={() => loadDemo(m)}>
              <Layers3 size={21} />
              <span>
                <strong>{MODE_LABELS[m]}</strong>
                <small>{SUGGESTIONS[m][0]}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
