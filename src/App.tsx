import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  Code2,
  Cpu,
  ExternalLink,
  FolderGit2,
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
      {/* Clean Top Navigation Bar */}
      <header className="top-navbar">
        <div className="brand-cluster" onClick={() => navigate('home')}>
          <div className="brand-logo">
            <Wrench size={17} />
          </div>
          <div className="brand-title">
            RILEY DAVIS <span className="brand-domain mono">rileydavis.vercel.app</span>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Primary Navigation">
          <button
            type="button"
            className={`nav-tab ${view === 'home' ? 'active' : ''}`}
            onClick={() => navigate('home')}
          >
            <Home size={15} />
            <span>Home</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${view === 'tools' ? 'active' : ''}`}
            onClick={() => navigate('tools')}
          >
            <Server size={15} />
            <span>Tools</span>
            <span className="nav-badge">{tools.length}</span>
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
                ? `Render API Online (${backendLatencyMs}ms)`
                : 'Render API Waking...'}
            </span>
          </div>
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
        {/* 1. HOME VIEW (/) */}
        {view === 'home' && (
          <div className="home-view">
            <section className="home-hero">
              <div className="home-hero-badge mono">
                <Sparkles size={13} className="text-cyan" />
                <span>RILEY DAVIS · ENGINEERING &amp; PYTHON TOOL SUITE</span>
              </div>

              <h1 className="home-hero-title">
                Custom Engineering &amp; Python Tools,{' '}
                <span className="text-gradient">All in One Place.</span>
              </h1>

              <p className="home-hero-subtitle">
                A unified web workspace hosted on <strong>Vercel</strong> and powered by a single
                modular Python FastAPI service on <strong>Render</strong>. Browse the tool catalog
                to convert CAD models, inspect 3D geometry, and run custom Python utilities right in
                your browser.
              </p>

              <div className="home-cta-row">
                <button
                  type="button"
                  className="btn-hero-primary"
                  onClick={() => navigate('tools')}
                >
                  <span>Explore Tools ({activeToolsCount} Live)</span>
                  <ArrowRight size={18} />
                </button>

                <a
                  href="https://github.com/rileydavis-id/rileys_tools"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-hero-secondary"
                >
                  <FolderGit2 size={17} />
                  <span>GitHub Repository</span>
                </a>
              </div>

              <div className="home-stats-strip">
                <div className="home-stat-item">
                  <span className="home-stat-value mono">{activeToolsCount}</span>
                  <span className="home-stat-label">Active Python Tools</span>
                </div>
                <div className="home-stat-divider" />
                <div className="home-stat-item">
                  <span className="home-stat-value mono">OpenCASCADE</span>
                  <span className="home-stat-label">3D CAD B-Rep Kernel</span>
                </div>
                <div className="home-stat-divider" />
                <div className="home-stat-item">
                  <span className="home-stat-value mono">
                    {backendStatus === 'online' ? `${backendLatencyMs} ms` : 'Online'}
                  </span>
                  <span className="home-stat-label">Render Backend Status</span>
                </div>
              </div>
            </section>

            {/* Featured Tool Callout */}
            <section className="home-featured-section">
              <div className="featured-banner">
                <div className="featured-banner-left">
                  <span className="eyebrow mono">FEATURED TOOL</span>
                  <h2>STEP to STL Converter &amp; Interactive 3D Visualizer</h2>
                  <p>
                    Upload ISO-10303-21 (<code>.step</code> / <code>.stp</code>) solid models or
                    load built-in sample mechanical parts. Tessellate with OpenCASCADE on Render and
                    verify the mesh with 5 shading modes and real-time Z-axis cross-section slicing.
                  </p>
                  <div className="featured-banner-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => navigate('tools')}
                    >
                      <span>Go to Tools Section</span>
                      <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate('step-to-stl')}
                    >
                      <Box size={15} />
                      <span>Open STEP → STL Converter Directly</span>
                    </button>
                  </div>
                </div>

                <div className="featured-highlights-grid">
                  <div className="highlight-mini-card">
                    <Box size={18} className="text-cyan" />
                    <h4>OpenCASCADE B-Rep</h4>
                    <p>True CAD solid to manifold triangle mesh conversion in millimeters.</p>
                  </div>
                  <div className="highlight-mini-card">
                    <Layers size={18} className="text-cyan" />
                    <h4>Three.js 3D Inspector</h4>
                    <p>Orbit, pan, zoom, inspect normals, and slice cross-sections in WebGL.</p>
                  </div>
                  <div className="highlight-mini-card">
                    <Server size={18} className="text-cyan" />
                    <h4>Unified Render Backend</h4>
                    <p>Single FastAPI service hosting all Python tool routers in one place.</p>
                  </div>
                  <div className="highlight-mini-card">
                    <Terminal size={18} className="text-cyan" />
                    <h4>Plug &amp; Play Expansion</h4>
                    <p>Drop a new Python router into backend/app/tools/ and push to main.</p>
                  </div>
                </div>
              </div>
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
                <span>Back to Home</span>
              </button>
              <span className="subpage-crumb mono">rileydavis.vercel.app / tools</span>
            </div>

            <div className="catalog-hero">
              <div>
                <span className="eyebrow mono">TOOLS DIRECTORY</span>
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
    </div>
  );
};
