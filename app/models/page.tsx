'use client';
import { useEffect, useState } from 'react';
import {
  Cpu,
  ScanLine,
  Layers3,
  Orbit,
  Globe2,
  Target,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Info,
} from 'lucide-react';
import AppShell from '@/components/app-shell';
import { models as registry } from '@/lib/services/model-registry';
export default function Page() {
  const [models, setModels] = useState<any[]>(registry),
    [checked, setChecked] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/models');
      if (!r.ok) throw Error('Registry health check failed');
      const d = (await r.json()) as any;
      setModels(d.models);
      setChecked(new Date().toLocaleTimeString());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  const icons: any = {
    scan: ScanLine,
    target: Target,
    layers: Layers3,
    orbit: Orbit,
    globe: Globe2,
  };
  return (
    <AppShell active="Model registry">
      <main className="content-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">SPECIALISTS, WORKING TOGETHER</div>
            <h1>Model registry</h1>
            <p>The right tool for every remote-sensing task.</p>
          </div>
          <button className="secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Checking…' : 'Check health'}
          </button>
        </div>
        <div className="registry-banner">
          <Cpu size={25} />
          <div>
            <strong>5 specialist tools. One intelligent controller.</strong>
            <p>
              Selected by input configuration and query intent. Each tool has a
              replaceable service interface.
            </p>
          </div>
          <span className="status-pill complete">Demo adapters active</span>
        </div>
        <div className="notice">
          <Info size={17} />
          <p>
            Demo adapters are active. Trained AI weights are not bundled, domain
            adaptation has not been performed, and live inference is not
            connected. Real uploads receive metadata validation and safe
            abstention.
          </p>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="model-grid">
          {models.map((m) => {
            const Icon = icons[m.icon] || Cpu;
            return (
              <article className="model-card" key={m.id}>
                <div className="model-top">
                  <span className="model-icon">
                    <Icon size={25} />
                  </span>
                  <span className="status-pill complete">
                    <span className="live-dot" />
                    Active · demo
                  </span>
                </div>
                <h2>{m.name}</h2>
                <p>{m.description}</p>
                <div className="model-tags">
                  {m.capabilities.map((c: string) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                <dl>
                  <dt>Version</dt>
                  <dd>v{m.version}</dd>
                  <dt>Supported input</dt>
                  <dd>{m.input}</dd>
                  <dt>Health check</dt>
                  <dd>{checked || 'Checking…'}</dd>
                  <dt>Inference</dt>
                  <dd>Demo fixtures / metadata only</dd>
                </dl>
                <details>
                  <summary>Adaptation & integration</summary>
                  <p>{m.adaptation}</p>
                  <a href="/help#integration">
                    View integration guide <ArrowRight size={14} />
                  </a>
                </details>
              </article>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
