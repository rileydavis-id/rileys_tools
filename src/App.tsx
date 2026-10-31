import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  FolderGit2,
  Globe,
  Home,
  Layers,
  PlusCircle,
  Search,
  Server,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react';
import { getDefaultBackendUrl, INITIAL_TOOLS, ToolItem } from './config';
import { StepToStlTool } from './components/StepToStlTool';
import { MeshInspectorTool } from './components/MeshInspectorTool';

type RouteView = 'home' | 'tools' | 'step-to-stl' | 'mesh-inspector';

function parsePathToView(pathname: string): RouteView {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/tools') return 'tools';
  if (clean === '/tools/step-to-stl') return 'step-to-stl';
  if (clean === '/tools/mesh-inspector') return 'mesh-inspector';
  return 'home';
}

function viewToPath(view: RouteView): string {
  switch (view) {
    case 'tools':
      return '/tools';
    case 'step-to-stl':
      return '/tools/step-to-stl';
    case 'mesh-inspector':
      return '/tools/mesh-inspector';
    default:
      return '/';
  }
}

export const App: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState<string>(getDefaultBackendUrl);
  const [view, setView] = useState<RouteView>(() =>
    typeof window !== 'undefined' ? parsePathToView(window.location.pathname) : 'home'
  );
  const [tools, setTools] = useState<ToolItem[]>(INITIAL_TOOLS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'waking'>('checking');
  const [backendLatencyMs, setBackendLatencyMs] = useState<number | null>(null);

  const [sharedStlBase64, setSharedStlBase64] = useState<string | null>(null);
  const [sharedStlFilename, setSharedStlFilename] = useState<string>('converted_part.stl');

  const navigate = (nextView: RouteView) => {
    setView(nextView);
    const nextPath = viewToPath(nextView);
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setView(parsePathToView(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkBackend = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${backendUrl}/api/tools`);
        if (!res.ok) throw new Error('Backend not ready');
        const data = await res.json();
        if (cancelled) return;
        const elapsed = Math.round(performance.now() - t0);
        setBackendLatencyMs(elapsed);
        setBackendStatus('online');
        if (Array.isArray(data.tools) && data.tools.length > 0) {
          const liveIds = new Set(data.tools.map((t: ToolItem) => t.id));
          const planned = INITIAL_TOOLS.filter((t) => !liveIds.has(t.id));
          setTools([...data.tools, ...planned]);
        }
      } catch {
        if (!cancelled) {
          setBackendStatus('waking');
        }
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backendUrl]);

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeToolsCount = tools.filter((t) => t.status === 'active').length;

  return (
    <div className="app-shell">
      {/* Top Global Navigation Bar */}
      <header className="top-navbar">
        <div className="brand-cluster" onClick={() => navigate('home')}>
          <div className="brand-logo mono">RD</div>
          <div>
            <div className="brand-title">
              Riley Davis <span className="brand-domain mono">rileydavis.vercel.app</span>
            </div>
            <div className="brand-subtitle">Software Engineering Portfolio &amp; Live Tool Lab</div>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Primary Navigation">
          <button
            type="button"
            className={`nav-tab ${view === 'home' ? 'active' : ''}`}
            onClick={() => navigate('home')}
          >
            <Home size={15} />
            <span>Portfolio Home</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${view === 'tools' ? 'active' : ''}`}
            onClick={() => navigate('tools')}
          >
            <Wrench size={15} />
            <span>Interactive Tools</span>
            <span className="nav-badge">{activeToolsCount} Live</span>
          </button>

          {(view === 'step-to-stl' || view === 'mesh-inspector') && (
            <button type="button" className="nav-tab active">
              <Box size={15} />
              <span>
                {view === 'step-to-stl' ? 'STEP → STL Converter' : '3D Mesh Inspector'}
              </span>
            </button>
          )}
        </nav>

        <div className="backend-status-cluster">
          <div className={`status-pill ${backendStatus}`}>
            <span className={`status-dot ${backendStatus === 'online' ? 'online' : 'waking'}`} />
            <span className="mono">
              {backendStatus === 'online'
                ? `Render API (${backendLatencyMs}ms)`
                : 'Render API Waking...'}
            </span>
          </div>
          <a
            href="https://github.com/rileydavis-id/rileys_tools"
            target="_blank"
            rel="noreferrer"
            className="api-docs-link mono"
            title="GitHub Repository"
          >
            <FolderGit2 size={13} />
            <span>GitHub</span>
          </a>
          <a
            href={`${backendUrl}/docs`}
            target="_blank"
            rel="noreferrer"
            className="api-docs-link mono"
            title="Open Unified Render FastAPI Swagger Docs"
          >
            <span>API /docs</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-container">
        {/* 1. PORTFOLIO HOME VIEW (/) */}
        {view === 'home' && (
          <div className="home-view">
            {/* Personal Engineer Hero Section */}
            <section className="portfolio-hero">
              <div className="portfolio-hero-content">
                <div className="availability-pill mono">
                  <span className="status-dot online" />
                  <span>RILEY DAVIS · SOFTWARE &amp; SYSTEMS ENGINEER</span>
                </div>

                <h1 className="portfolio-hero-title">
                  Building full-stack systems,{' '}
                  <span className="text-gradient">3D CAD pipelines</span>, and interactive Python
                  tools.
                </h1>

                <p className="portfolio-hero-bio">
                  Welcome to my personal engineering site and live tooling lab. Rather than just
                  static project screenshots, this site hosts{' '}
                  <strong>live, interactive engineering tools</strong> deployed on{' '}
                  <strong>Vercel</strong> and powered by a unified Python{' '}
                  <strong>FastAPI + OpenCASCADE</strong> backend on <strong>Render</strong>.
                </p>

                <div className="home-cta-row portfolio-cta-row">
                  <button
                    type="button"
                    className="btn-hero-primary"
                    onClick={() => navigate('tools')}
                  >
                    <Wrench size={17} />
                    <span>Explore Interactive Tools ({activeToolsCount} Live)</span>
                    <ArrowRight size={17} />
                  </button>

                  <a href="#featured-projects" className="btn-hero-secondary">
                    <Code2 size={17} />
                    <span>View Engineering Projects</span>
                  </a>

                  <a
                    href="https://github.com/rileydavis-id"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-hero-secondary"
                  >
                    <FolderGit2 size={17} />
                    <span>@rileydavis-id</span>
                  </a>
                </div>
              </div>

              {/* Right Interactive Terminal / Architecture Preview Card */}
              <div className="hero-terminal-card">
                <div className="terminal-topbar">
                  <div className="terminal-dots">
                    <span className="dot red" />
                    <span className="dot yellow" />
                    <span className="dot green" />
                  </div>
                  <span className="terminal-title mono">riley@engineering-lab:~</span>
                  <span className="terminal-badge mono">FastAPI + Three.js</span>
                </div>
                <div className="terminal-body mono">
                  <div className="term-line">
                    <span className="term-prompt">$</span> curl https://rileys-tools-backend.onrender.com/api/health
                  </div>
                  <div className="term-output">
                    {`{ "status": "healthy", "service": "rileys-tools-backend", "tools": ["step-to-stl", "mesh-inspector"] }`}
                  </div>
                  <div className="term-line">
                    <span className="term-prompt">$</span>stack --list
                  </div>
                  <div className="term-kv-grid">
                    <div>
                      <span className="term-key">Languages:</span> Python 3.12, TypeScript, SQL, C++
                    </div>
                    <div>
                      <span className="term-key">Backend:</span> FastAPI, OpenCASCADE, Trimesh, NumPy
                    </div>
                    <div>
                      <span className="term-key">Frontend:</span> React 19, Three.js WebGL, Vite
                    </div>
                    <div>
                      <span className="term-key">Cloud Infra:</span> Vercel CDN + Render Web Services
                    </div>
                  </div>
                  <div className="term-action-bar">
                    <button
                      type="button"
                      className="term-launch-btn mono"
                      onClick={() => navigate('tools')}
                    >
                      <span>&gt; cd /tools &amp;&amp; ./launch_interactive_suite.sh</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Engineering Focus & Technical Stack */}
            <section className="portfolio-section">
              <div className="section-heading-row">
                <div>
                  <span className="eyebrow mono">TECHNICAL FOCUS &amp; STACK</span>
                  <h2>What I Build &amp; Work With</h2>
                </div>
              </div>

              <div className="skills-bento-grid">
                <div className="skill-bento-card">
                  <div className="skill-icon-wrap">
                    <Server size={20} />
                  </div>
                  <h3>Python Backend &amp; APIs</h3>
                  <p>
                    Designing modular FastAPI services, high-throughput file processing endpoints,
                    and numerical computing pipelines hosted on Render.
                  </p>
                  <div className="tag-row">
                    <span className="tag-chip mono">Python 3.12</span>
                    <span className="tag-chip mono">FastAPI</span>
                    <span className="tag-chip mono">Uvicorn</span>
                    <span className="tag-chip mono">NumPy</span>
                  </div>
                </div>

                <div className="skill-bento-card">
                  <div className="skill-icon-wrap">
                    <Box size={20} />
                  </div>
                  <h3>CAD &amp; Computational Geometry</h3>
                  <p>
                    Programmatic B-Rep solid modeling, ISO-10303-21 STEP parsing, watertight mesh
                    tessellation, and 3D printability metrology.
                  </p>
                  <div className="tag-row">
                    <span className="tag-chip mono">OpenCASCADE</span>
                    <span className="tag-chip mono">Cascadio</span>
                    <span className="tag-chip mono">Trimesh</span>
                    <span className="tag-chip mono">STEP / STL</span>
                  </div>
                </div>

                <div className="skill-bento-card">
                  <div className="skill-icon-wrap">
                    <Globe size={20} />
                  </div>
                  <h3>Interactive Web &amp; 3D Graphics</h3>
                  <p>
                    Building responsive TypeScript interfaces and hardware-accelerated Three.js
                    WebGL viewports with custom shaders and clipping planes.
                  </p>
                  <div className="tag-row">
                    <span className="tag-chip mono">TypeScript</span>
                    <span className="tag-chip mono">React 19</span>
                    <span className="tag-chip mono">Three.js</span>
                    <span className="tag-chip mono">WebGL</span>
                  </div>
                </div>

                <div className="skill-bento-card">
                  <div className="skill-icon-wrap">
                    <Database size={20} />
                  </div>
                  <h3>Cloud &amp; CI/CD Automation</h3>
                  <p>
                    Zero-downtime Git-driven deployments across Vercel and Render using Blueprint
                    IaC configs and modular monorepo architectures.
                  </p>
                  <div className="tag-row">
                    <span className="tag-chip mono">Vercel</span>
                    <span className="tag-chip mono">Render</span>
                    <span className="tag-chip mono">Git / GitHub</span>
                    <span className="tag-chip mono">Linux</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Featured Engineering Projects & Live Tools */}
            <section id="featured-projects" className="portfolio-section">
              <div className="section-heading-row">
                <div>
                  <span className="eyebrow mono">FEATURED ENGINEERING PROJECTS</span>
                  <h2>Featured Systems &amp; Interactive Tools</h2>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate('tools')}
                >
                  <span>Open Full Tools Directory</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              <div className="projects-showcase-grid">
                {/* Project 1 */}
                <div className="project-showcase-card featured">
                  <div className="project-card-header">
                    <span className="project-type-badge mono">CAD PIPELINE · LIVE TOOL</span>
                    <span className="status-badge active">Live on Render + Vercel</span>
                  </div>
                  <h3>OpenCASCADE STEP-to-STL Converter &amp; 3D WebGL Visualizer</h3>
                  <p>
                    Full-stack CAD conversion utility that ingests ISO-10303-21 (<code>.step</code>{' '}
                    / <code>.stp</code>) B-Rep solid models on a Python FastAPI backend, tessellates
                    them with OpenCASCADE, normalizes units to millimeter scale, and renders the
                    resulting mesh in an interactive Three.js viewport with real-time Z-axis
                    cross-section slicing.
                  </p>
                  <div className="tag-row">
                    <span className="tag-chip mono">Python</span>
                    <span className="tag-chip mono">FastAPI</span>
                    <span className="tag-chip mono">OpenCASCADE</span>
                    <span className="tag-chip mono">Three.js</span>
                    <span className="tag-chip mono">TypeScript</span>
                  </div>
                  <div className="project-card-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => navigate('tools')}
                    >
                      <span>Go to Tools Section to Launch</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate('step-to-stl')}
                    >
                      <span>Open Subpage Directly</span>
                    </button>
                  </div>
                </div>

                {/* Project 2 */}
                <div className="project-showcase-card">
                  <div className="project-card-header">
                    <span className="project-type-badge mono">COMPUTATIONAL GEOMETRY</span>
                    <span className="status-badge active">Live on Render + Vercel</span>
                  </div>
                  <h3>3D Mesh Printability Inspector &amp; Metrology Engine</h3>
                  <p>
                    Analyzes triangle meshes (<code>.stl</code>, <code>.obj</code>,{' '}
                    <code>.ply</code>) for manifold watertightness, Euler characteristic, face
                    normal winding consistency, center of mass, PLA filament weight estimation, and
                    precision unit scaling (<code>mm</code> ↔ <code>inch</code>).
                  </p>
                  <div className="tag-row">
                    <span className="tag-chip mono">Trimesh</span>
                    <span className="tag-chip mono">NumPy</span>
                    <span className="tag-chip mono">WebGL Normals</span>
                    <span className="tag-chip mono">3D Printing</span>
                  </div>
                  <div className="project-card-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => navigate('tools')}
                    >
                      <span>View in Tools Section</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate('mesh-inspector')}
                    >
                      <span>Open Subpage Directly</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Bottom Callout to Tools Section */}
            <section className="tools-cta-banner">
              <div>
                <span className="eyebrow mono">INTERACTIVE TOOLING HUB</span>
                <h2>Ready to Try the Live Tools?</h2>
                <p>
                  Head over to the Tools directory to pick and launch any utility hosted on the
                  unified Render backend.
                </p>
              </div>
              <button
                type="button"
                className="btn-hero-primary"
                onClick={() => navigate('tools')}
              >
                <Wrench size={17} />
                <span>Go to Tools Section</span>
                <ArrowRight size={17} />
              </button>
            </section>
          </div>
        )}

        {/* 2. TOOLS DIRECTORY VIEW (/tools) */}
        {view === 'tools' && (
          <div className="catalog-view">
            <div className="subpage-topbar">
              <button
                type="button"
                className="btn-back"
                onClick={() => navigate('home')}
              >
                <ArrowLeft size={15} />
                <span>Back to Portfolio Home</span>
              </button>
              <span className="subpage-crumb mono">rileydavis.vercel.app / tools</span>
            </div>

            <div className="catalog-hero">
              <div>
                <span className="eyebrow mono">RILEY&apos;S INTERACTIVE TOOLS DIRECTORY</span>
                <h1>Select a Tool to Launch</h1>
                <p>
                  All tools below are hosted on <strong>rileydavis.vercel.app</strong> and powered
                  by the shared <strong>rileys-tools-backend</strong> Python service on Render.
                </p>
              </div>
              <div className="catalog-search-box">
                <Search size={16} className="text-muted" />
                <input
                  type="text"
                  placeholder="Search tools by name, tag, or format..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="tools-grid">
              {filteredTools.map((tool) => (
                <div key={tool.id} className={`tool-card ${tool.status}`}>
                  <div className="tool-card-top">
                    <div className="tool-icon-badge">
                      {tool.icon === 'cube' ? (
                        <Box size={20} />
                      ) : tool.icon === 'layers' ? (
                        <Layers size={20} />
                      ) : (
                        <Cpu size={20} />
                      )}
                    </div>
                    <div className="tool-meta-badges">
                      <span className="category-pill">{tool.category}</span>
                      <span className={`status-badge ${tool.status}`}>
                        {tool.status === 'active' ? 'Live on Render' : 'Ready Slot'}
                      </span>
                    </div>
                  </div>

                  <h3>{tool.name}</h3>
                  <p>{tool.description}</p>

                  <div className="tag-row">
                    {tool.tags.map((tag) => (
                      <span key={tag} className="tag-chip mono">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="endpoints-list">
                    {tool.endpoints.map((ep) => (
                      <div key={ep.path} className="endpoint-row mono">
                        <span className={`http-method ${ep.method.toLowerCase()}`}>
                          {ep.method}
                        </span>
                        <span className="endpoint-path">{ep.path}</span>
                      </div>
                    ))}
                  </div>

                  <div className="tool-card-footer">
                    {tool.id === 'step-to-stl' || tool.id === 'mesh-inspector' ? (
                      <button
                        type="button"
                        className="btn-primary tool-launch-btn"
                        onClick={() => navigate(tool.id as RouteView)}
                      >
                        <span>Open {tool.name.split('&')[0].trim()}</span>
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      <div className="planned-note mono">
                        <PlusCircle size={14} />
                        <span>
                          Add router in backend/app/tools/{tool.slug.replace('-', '_')}.py
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Architecture & Backend Config Footer */}
            <div className="architecture-banner">
              <div className="arch-col">
                <div className="panel-card-header">
                  <Terminal size={17} className="text-cyan" />
                  <h3>How to Add Any New Python Tool to the Shared Render Service</h3>
                </div>
                <ol className="arch-steps">
                  <li>
                    Create <code>backend/app/tools/your_new_tool.py</code> with an{' '}
                    <code>APIRouter(prefix=&quot;/api/tools/your-tool&quot;)</code>.
                  </li>
                  <li>
                    Call <code>registry.register(ToolMetadata(...), router)</code> at the bottom of
                    the file and import it in <code>backend/app/main.py</code>.
                  </li>
                  <li>
                    Commit &amp; push to GitHub — Render automatically redeploys the unified Python
                    backend and Vercel deploys the updated frontend to{' '}
                    <code>rileydavis.vercel.app</code>.
                  </li>
                </ol>
              </div>

              <div className="arch-col">
                <div className="panel-card-header">
                  <Activity size={17} className="text-cyan" />
                  <h3>Live Render Backend Endpoint Configuration</h3>
                </div>
                <p className="arch-desc">
                  Connected Render Service URL (override below for local or staging testing):
                </p>
                <div className="backend-input-row">
                  <Code2 size={16} className="text-cyan" />
                  <input
                    type="text"
                    className="mono"
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value.replace(/\/+$/, ''))}
                  />
                </div>
                <div className="arch-links">
                  <a href={`${backendUrl}/api/health`} target="_blank" rel="noreferrer">
                    <CheckCircle2 size={14} /> <span>Health Check JSON (/api/health)</span>
                  </a>
                  <a href={`${backendUrl}/api/tools`} target="_blank" rel="noreferrer">
                    <Server size={14} /> <span>Registered Tools Registry (/api/tools)</span>
                  </a>
                  <a href={`${backendUrl}/docs`} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> <span>Interactive OpenAPI Swagger (/docs)</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. STEP TO STL CONVERTER SUBPAGE (/tools/step-to-stl) */}
        {view === 'step-to-stl' && (
          <div className="tool-subpage">
            <div className="subpage-topbar">
              <button
                type="button"
                className="btn-back"
                onClick={() => navigate('tools')}
              >
                <ArrowLeft size={15} />
                <span>Back to Tools</span>
              </button>
              <div className="subpage-title-group">
                <Box size={16} className="text-cyan" />
                <span className="subpage-title">STEP to STL Converter &amp; 3D Visualizer</span>
                <span className="subpage-route-pill mono">/api/tools/step-to-stl</span>
              </div>
            </div>

            <StepToStlTool
              backendUrl={backendUrl}
              onSelectSharedStl={(stlB64, fname) => {
                setSharedStlBase64(stlB64);
                setSharedStlFilename(fname);
                navigate('mesh-inspector');
              }}
            />
          </div>
        )}

        {/* 4. 3D MESH INSPECTOR SUBPAGE (/tools/mesh-inspector) */}
        {view === 'mesh-inspector' && (
          <div className="tool-subpage">
            <div className="subpage-topbar">
              <button
                type="button"
                className="btn-back"
                onClick={() => navigate('tools')}
              >
                <ArrowLeft size={15} />
                <span>Back to Tools</span>
              </button>
              <div className="subpage-title-group">
                <Layers size={16} className="text-cyan" />
                <span className="subpage-title">
                  3D Mesh Printability Inspector &amp; Unit Scaler
                </span>
                <span className="subpage-route-pill mono">/api/tools/mesh-inspector</span>
              </div>
            </div>

            <MeshInspectorTool
              backendUrl={backendUrl}
              initialStlBase64={sharedStlBase64}
              initialFilename={sharedStlFilename}
            />
          </div>
        )}
      </main>

      {/* Global Portfolio Footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-left">
            <span className="brand-logo small mono">RD</span>
            <span>
              <strong>Riley Davis</strong> · Software Engineering Portfolio &amp; Unified Tool Hub
            </span>
          </div>
          <div className="footer-links mono">
            <button type="button" className="btn-link" onClick={() => navigate('home')}>
              Home
            </button>
            <button type="button" className="btn-link" onClick={() => navigate('tools')}>
              Tools ({activeToolsCount})
            </button>
            <a
              href="https://github.com/rileydavis-id/rileys_tools"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a href={`${backendUrl}/docs`} target="_blank" rel="noreferrer">
              Render API Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
