'use client';
import { useEffect, useState } from 'react';
import {
  History,
  Search,
  Plus,
  Copy,
  Trash2,
  Download,
  ArrowUpRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import AppShell from '@/components/app-shell';
import { Picker } from '@/components/controls';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import type { Analysis } from '@/lib/domain';
import { MODE_LABELS } from '@/lib/domain';
export default function Page() {
  const [rows, setRows] = useState<Analysis[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [mode, setMode] = useState('all'),
    [confidence, setConfidence] = useState('all'),
    [date, setDate] = useState(''),
    [deleting, setDeleting] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/history'),
        d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      setRows(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const filtered = rows.filter(
    (r) =>
      (mode === 'all' || r.mode === mode) &&
      (confidence === 'all' ||
        (confidence === 'high' && (r.confidence || 0) >= 80) ||
        (confidence === 'low' && (r.confidence || 0) < 80)) &&
      (!date || r.createdAt.slice(0, 10) === date) &&
      (r.query.toLowerCase().includes(search.toLowerCase()) ||
        r.id.includes(search)),
  );
  const duplicate = async (id: string) => {
    setBusy(true);
    try {
      const r = await fetch('/api/analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        }),
        d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      location.href = '/workspace?id=' + d.id;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/analysis/' + deleting, { method: 'DELETE' });
      if (!r.ok) throw Error('Unable to delete this analysis');
      setRows(rows.filter((r) => r.id !== deleting));
      setDeleting(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell active="Analysis history">
      <main className="content-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR RESEARCH, TRACEABLE</div>
            <h1>Analysis history</h1>
            <p>Every question, every piece of evidence. Ready to revisit.</p>
          </div>
          <a className="primary" href="/workspace">
            <Plus size={17} />
            New analysis
          </a>
        </div>
        <div className="filterbar">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search analyses"
              placeholder="Search query or analysis ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Picker
            value={mode}
            label="Analysis type filter"
            onChange={setMode}
            options={[
              { value: 'all', label: 'All input types' },
              ...Object.entries(MODE_LABELS)
                .filter(([k]) => k !== 'auto')
                .map(([value, label]) => ({ value, label })),
            ]}
          />
          <Picker
            value={confidence}
            label="Confidence filter"
            onChange={setConfidence}
            options={[
              { value: 'all', label: 'All confidence' },
              { value: 'high', label: 'High · ≥80%' },
              { value: 'low', label: 'Low / unavailable' },
            ]}
          />
          <input
            aria-label="Filter by date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            className="icon-button"
            aria-label="Refresh history"
            onClick={load}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={load}>Retry</button>
          </div>
        )}
        {loading ? (
          <div className="page-empty">
            <Loader2 className="spin" />
            <p>Loading your analyses…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="page-empty">
            <History size={40} />
            <h2>
              {rows.length
                ? 'No matching analyses'
                : 'Your research starts here.'}
            </h2>
            <p>
              {rows.length
                ? 'Adjust your filters to find another analysis.'
                : 'Completed and abstained analyses are saved automatically.'}
            </p>
            <a className="primary" href="/workspace?demo=change">
              Try a demo analysis <ArrowUpRight size={16} />
            </a>
          </div>
        ) : (
          <>
            <div className="table-caption">
              {filtered.length} analyses{' '}
              <span>Newest first · Stored in your private workspace</span>
            </div>
            <div className="history-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Analysis</TableHead>
                    <TableHead>Input / Task</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <a
                          href={'/workspace?id=' + a.id}
                          className="history-query"
                        >
                          <img
                            src={a.images[0]?.preview || '/satellite.jpg'}
                            alt="Analysis thumbnail"
                          />
                          <span>
                            <strong>{a.query}</strong>
                            <small>
                              SQ-{a.id.slice(0, 8).toUpperCase()}
                              {a.demo ? ' · DEMO' : ''}
                            </small>
                          </span>
                        </a>
                      </TableCell>
                      <TableCell>
                        <strong>{MODE_LABELS[a.mode]}</strong>
                        <small>{a.task}</small>
                        <small title={a.tools.join(', ')}>
                          {a.tools.length} specialist tools
                        </small>
                      </TableCell>
                      <TableCell>
                        {new Date(a.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="confidence-pill">
                          {a.confidence === null
                            ? 'Unavailable'
                            : a.confidence + '%'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={'status-pill ' + a.status}>
                          {a.status === 'complete' ? 'Completed' : 'Abstained'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="row-actions">
                          <a
                            title="Open analysis"
                            href={'/workspace?id=' + a.id}
                          >
                            <ArrowUpRight size={16} />
                          </a>
                          <button
                            title="Duplicate analysis"
                            disabled={busy}
                            onClick={() => duplicate(a.id)}
                          >
                            <Copy size={15} />
                          </button>
                          <a
                            title="Download PDF"
                            href={'/api/reports/' + a.id + '?format=pdf'}
                            download
                          >
                            <Download size={15} />
                          </a>
                          <button
                            title="Delete analysis"
                            disabled={busy}
                            onClick={() => setDeleting(a.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <AlertDialog
          open={!!deleting}
          onOpenChange={(v) => !v && setDeleting(null)}
        >
          <AlertDialogContent>
            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved answer and execution record will be removed. Original
              uploaded imagery is retained.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <button className="secondary" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                className="primary danger"
                onClick={remove}
                disabled={busy}
              >
                {busy ? 'Deleting…' : 'Delete analysis'}
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AppShell>
  );
}
