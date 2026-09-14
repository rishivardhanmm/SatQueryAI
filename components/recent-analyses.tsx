'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Analysis } from '@/lib/domain';
import { MODE_LABELS } from '@/lib/domain';
export default function RecentAnalyses() {
  const [rows, setRows] = useState<Analysis[]>([]);
  useEffect(() => {
    fetch('/api/history')
      .then(async (r) => {
        if (r.ok) setRows(((await r.json()) as Analysis[]).slice(0, 3));
      })
      .catch(() => {});
  }, []);
  if (!rows.length) return null;
  return (
    <section>
      <div className="section-heading">
        <h2>Recent analyses</h2>
        <a href="/history">
          View all <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="recent-records">
        {rows.map((a) => (
          <a key={a.id} href={'/workspace?id=' + a.id}>
            <img
              src={a.images[0]?.preview || '/satellite.jpg'}
              alt="Analysis thumbnail"
            />
            <span>
              <small>
                {MODE_LABELS[a.mode]} ·{' '}
                {new Date(a.createdAt).toLocaleDateString()}
              </small>
              <strong>{a.query}</strong>
            </span>
            <b>{a.status === 'abstained' ? 'Abstained' : a.confidence + '%'}</b>
            <ArrowUpRight size={17} />
          </a>
        ))}
      </div>
    </section>
  );
}
