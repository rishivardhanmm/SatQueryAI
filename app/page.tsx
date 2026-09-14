'use client';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Satellite,
  ScanLine,
  Layers3,
  History,
  Cpu,
  BookOpen,
  Settings,
  Bell,
  ChevronDown,
  Orbit,
  Command,
  Sparkles,
  CircleHelp,
  Globe2,
  Check,
  Activity,
} from 'lucide-react';
import RecentAnalyses from '@/components/recent-analyses';
import { useState, useEffect } from 'react';
const capabilities = [
  {
    icon: ScanLine,
    title: 'Find the evidence.',
    tag: 'VISUAL GROUNDING',
    description:
      'Connect your words to locations. Highlight water, buildings, and land-cover regions.',
    color: 'mint',
  },
  {
    icon: ScanLine,
    title: 'Ask. Locate. Understand.',
    tag: 'VISUAL QUESTION ANSWERING',
    description:
      'Turn a question into scene-level insight. Understand land cover, objects, and patterns.',
    color: 'green',
  },
  {
    icon: Layers3,
    title: 'See what changed.',
    tag: 'CHANGE INTELLIGENCE',
    description:
      'Compare two moments in time. Quantify urban growth, vegetation loss, and water change.',
    color: 'orange',
  },
  {
    icon: Orbit,
    title: 'Two sensors. One picture.',
    tag: 'OPTICAL + SAR FUSION',
    description:
      'See beyond the clouds. Combine optical detail with all-weather radar intelligence.',
    color: 'blue',
  },
];
export default function Home() {
  const [active] = useState('Overview');
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        location.href = '/workspace';
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
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
        <button
          className="primary wide"
          onClick={() => (location.href = '/workspace')}
        >
          <Plus size={18} /> New analysis <span>⌘ K</span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            [Globe2, 'Overview', '/'],
            [History, 'Analysis history', '/history'],
            [Cpu, 'Model registry', '/models'],
          ].map(([Icon, label, url]: any) => (
            <a
              key={label}
              className={label === active ? 'nav-item active' : 'nav-item'}
              href={url}
            >
              <Icon size={18} />
              {label}
              {label === 'Overview' && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="nav-label second">RESOURCES</div>
        <a className="nav-item" href="/help">
          <BookOpen size={18} />
          Documentation
          <ArrowUpRight size={14} />
        </a>
        <a className="nav-item" href="/settings">
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
      <div className="main">
        <header className="topbar">
          <div>
            Workspace <span>/</span> <strong>Overview</strong>
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
        <main className="dashboard">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR EARTH OBSERVATION WORKSPACE</div>
              <h1>A new perspective starts here.</h1>
              <p>
                From satellite imagery to decisions, with evidence at every
                step.
              </p>
            </div>
            <div className="date">
              <span className="live-dot" /> SYSTEMS READY
            </div>
          </div>
          <section className="hero">
            <div className="hero-image" />
            <div className="hero-grid" />
            <div className="hero-content">
              <div className="hero-kicker">
                <span className="live-dot" /> INTELLIGENCE, GROUNDED IN EVIDENCE
              </div>
              <h2>
                Satellite intelligence.
                <br />
                <span>In your own words.</span>
              </h2>
              <p>
                Ask satellite imagery. Get evidence-grounded answers.
                <br />
                Optical, multispectral, SAR, or two moments in time.
                <br />
                One workspace to make sense of it all.
              </p>
              <div className="hero-actions">
                <a className="primary" href="/workspace">
                  <Plus size={18} /> Start new analysis{' '}
                  <ArrowUpRight size={17} />
                </a>
                <a className="secondary" href="/workspace?demo=change">
                  <span className="play">▷</span> Try demo dataset
                </a>
              </div>
              <div className="hero-foot">
                <span>
                  <Check size={14} /> Sensor-aware analysis
                </span>
                <span>
                  <Check size={14} /> Auditable results
                </span>
              </div>
            </div>
            <div className="image-coordinate">
              <span className="crosshair">+</span>
              <span>
                EARTH OBSERVATION
                <br />
                <b>OPTICAL · TRUE COLOR</b>
              </span>
            </div>
            <div className="floating-evidence">
              <span className="live-dot" />
              <span>
                Evidence before answers
                <small>Every insight, spatially grounded.</small>
              </span>
              <ScanLine size={22} />
            </div>
          </section>
          <section className="capabilities">
            {capabilities.map(
              ({ icon: Icon, title, tag, description, color }) => (
                <a
                  href={
                    '/workspace?demo=' +
                    {
                      green: 'single',
                      mint: 'single',
                      orange: 'change',
                      blue: 'fusion',
                    }[color]
                  }
                  key={title}
                  className={'capability ' + color}
                >
                  <div className="cap-top">
                    <span className="cap-icon">
                      <Icon size={21} />
                    </span>
                    <ArrowUpRight size={18} />
                  </div>
                  <div className="cap-tag">{tag}</div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </a>
              ),
            )}
          </section>
          <section className="workflow">
            <span className="workflow-label">FROM QUESTION TO CLARITY</span>
            {[
              [Command, 'Your query'],
              [Sparkles, 'Intelligent agent'],
              [Cpu, 'Specialist models'],
              [ScanLine, 'Grounded evidence'],
            ].map(([Icon, label]: any, i) => (
              <div className="flow-item" key={label}>
                <Icon size={17} />
                <span>{label}</span>
                {i < 3 && <ArrowRight className="flow-arrow" size={16} />}
              </div>
            ))}
          </section>
          <RecentAnalyses />
          <section className="recent">
            <div className="section-heading">
              <div>
                <h2>
                  Explore the possibilities <span>DEMO COLLECTION</span>
                </h2>
                <p>
                  Start with a curated scenario. See the entire workflow in
                  action.
                </p>
              </div>
              <a href="/history">
                View analysis history <ArrowRight size={16} />
              </a>
            </div>
            <div className="demo-grid">
              {[
                {
                  title: 'Urban growth, made visible',
                  place: 'Bi-temporal observation',
                  mode: 'change',
                  tag: 'CHANGE ANALYSIS',
                  query: 'Has the built-up area increased?',
                  icon: Layers3,
                },
                {
                  title: 'Every landscape tells a story',
                  place: 'Single optical observation',
                  mode: 'single',
                  tag: 'SCENE UNDERSTANDING',
                  query: 'Describe the land cover in this scene.',
                  icon: ScanLine,
                },
                {
                  title: 'Intelligence beyond the clouds',
                  place: 'Complementary sensor observation',
                  mode: 'fusion',
                  tag: 'OPTICAL + SAR',
                  query: 'Identify water and built-up regions.',
                  icon: Orbit,
                },
              ].map((d) => (
                <a
                  className="demo-card"
                  href={'/workspace?demo=' + d.mode}
                  key={d.mode}
                >
                  <div className={'demo-thumb ' + d.mode}>
                    <span>{d.tag}</span>
                    <d.icon size={19} />
                  </div>
                  <div className="demo-body">
                    <small>{d.place}</small>
                    <h3>{d.title}</h3>
                    <p>{d.query}</p>
                    <div>
                      <span>
                        <span className="live-dot" /> Curated demo
                      </span>
                      <ArrowUpRight size={18} />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
          <footer>
            <span>
              <Satellite size={15} /> SatQuery AI <i>·</i> Built for a better
              understanding of Earth.
            </span>
            <span>
              <a href="/help#sources">
                Imagery: ESA / Copernicus · CC BY-SA 3.0 IGO
              </a>{' '}
              <span className="tricolor">━</span>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
