'use client';
import { useEffect, useState } from 'react';
import { Save, ShieldCheck, Info, CheckCircle2 } from 'lucide-react';
import AppShell from '@/components/app-shell';
import { Slider } from '@/components/ui/slider';
export default function Page() {
  const [threshold, setThreshold] = useState(70),
    [saved, setSaved] = useState(false);
  useEffect(
    () =>
      setThreshold(
        Math.round(
          Number(localStorage.getItem('satquery-threshold') || 0.7) * 100,
        ),
      ),
    [],
  );
  return (
    <AppShell active="Settings">
      <main className="content-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">MAKE THE WORKSPACE YOURS</div>
            <h1>Workspace settings</h1>
            <p>Set your confidence requirements for future analyses.</p>
          </div>
        </div>
        <div className="settings-layout">
          <section className="settings-card">
            <h2>Analysis preferences</h2>
            <p>These preferences apply to this browser.</p>
            <div className="setting-row">
              <div>
                <h3>Minimum confidence threshold</h3>
                <p>Results below this threshold are withheld.</p>
              </div>
              <strong>{threshold}%</strong>
            </div>
            <Slider
              aria-label="Minimum confidence threshold"
              value={[threshold]}
              min={50}
              max={99}
              onValueChange={(v) => {
                setThreshold(Array.isArray(v) ? v[0] : v);
                setSaved(false);
              }}
            />
            <div className="range-label">
              <span>50% · Exploratory</span>
              <span>99% · Strict</span>
            </div>
            <div className="notice">
              <Info size={17} />
              <p>
                A threshold above 89% causes the illustrative demo to abstain.
                Demo confidence is illustrative and uncalibrated.
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                localStorage.setItem(
                  'satquery-threshold',
                  String(threshold / 100),
                );
                setSaved(true);
              }}
            >
              {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}{' '}
              {saved ? 'Preferences saved' : 'Save preferences'}
            </button>
          </section>
          <section className="settings-card">
            <h2>Research workspace</h2>
            <div className="profile-setting">
              <span className="avatar">RV</span>
              <div>
                <h3>Personal workspace</h3>
                <p>Private site access is managed by Sites.</p>
              </div>
            </div>
            <div className="notice">
              <ShieldCheck size={18} />
              <p>
                Uploads and analysis history are stored in this private
                workspace. Application settings never expose model credentials.
              </p>
            </div>
            <h3>Service mode</h3>
            <p>Curated demo inference · Live metadata inspection</p>
            <a className="text-link" href="/models">
              Inspect the model registry →
            </a>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
