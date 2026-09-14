'use client';
import {
  Satellite,
  Plus,
  Globe2,
  History,
  Cpu,
  BookOpen,
  Settings,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  ArrowLeft,
} from 'lucide-react';
export default function AppShell({
  active,
  children,
  wide = false,
}: {
  active: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Satellite size={24} />
          </span>
          <span>
            SatQuery <b>AI</b>
            <small>EARTH OBSERVATION INTELLIGENCE</small>
          </span>
        </a>
        <a className="primary wide" href="/workspace">
          <Plus size={18} /> New analysis
        </a>
        <div className="nav-label">WORKSPACE</div>
        {[
          [Globe2, 'Overview', '/'],
          [History, 'Analysis history', '/history'],
          [Cpu, 'Model registry', '/models'],
        ].map(([Icon, label, url]: any) => (
          <a
            key={label}
            className={'nav-item ' + (active === label ? 'active' : '')}
            href={url}
          >
            <Icon size={18} />
            {label}
            {active === label && <span className="nav-dot" />}
          </a>
        ))}
        <div className="nav-label">RESOURCES</div>
        <a
          className={'nav-item ' + (active === 'Documentation' ? 'active' : '')}
          href="/help"
        >
          <BookOpen size={18} />
          Documentation
          <ArrowUpRight size={14} />
        </a>
        <a
          className={'nav-item ' + (active === 'Settings' ? 'active' : '')}
          href="/settings"
        >
          <Settings size={18} />
          Settings
        </a>
        <div className="sidebar-bottom">
          <div className="system">
            <span className="live-dot" /> Demo services operational
            <small>5 specialist tools available</small>
          </div>
          <a href="/settings" className="profile">
            <span className="avatar">RV</span>
            <span>
              Research workspace<small>Personal workspace</small>
            </span>
            <ChevronDown size={15} />
          </a>
        </div>
      </aside>
      <div className={'main ' + (wide ? 'workspace-main' : '')}>
        <header className="topbar">
          <div>
            <a href="/">Workspace</a> <span>/</span> <strong>{active}</strong>
          </div>
          <div className="top-actions">
            <span className="sih">
              <span /> SIH 2026 · PS 26167
            </span>
            <a href="/help" aria-label="Help">
              <CircleHelp size={18} />
            </a>
            <a className="avatar small" href="/settings">
              RV
            </a>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <a href="/">Overview</a>
          <a href="/workspace">Analyze</a>
          <a href="/history">History</a>
          <a href="/models">Models</a>
          <a href="/settings">Settings</a>
        </nav>
        {children}
      </div>
    </div>
  );
}
