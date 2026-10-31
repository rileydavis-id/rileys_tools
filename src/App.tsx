import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Box,
  CheckCircle2,
  Code2,
  Cpu,
  ExternalLink,
  Layers,
  PlusCircle,
  Search,
  Server,
  Terminal,
  Wrench,
} from 'lucide-react';
import { getDefaultBackendUrl, INITIAL_TOOLS, ToolItem } from './config';
import { StepToStlTool } from './components/StepToStlTool';
import { MeshInspectorTool } from './components/MeshInspectorTool';

type ActiveTab = 'step-to-stl' | 'mesh-inspector' | 'catalog';

export const App: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState<string>(getDefaultBackendUrl);
  const [activeTab, setActiveTab] = useState<ActiveTab>('step-to-stl');
  const [tools, setTools] = useState<ToolItem[]>(INITIAL_TOOLS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'waking'>('checking');
  const [backendLatencyMs, setBackendLatencyMs] = useState<number | null>(null);

  const [sharedStlBase64, setSharedStlBase64] = useState<string | null>(null);
  const [sharedStlFilename, setSharedStlFilename] = useState<string>('converted_part.stl');

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
          // Merge live tools from Render backend with planned catalog items
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

  return (
    <div className="app-shell">
      {/* Top Global Header */}
      <header className="top-navbar">
        <div className="brand-cluster" onClick={() => setActiveTab('catalog')}>
          <div className="brand-logo">
            <Wrench size={18} />
          </div>
          <div>
            <div className="brand-title">
              RILEY DAVIS <span className="brand-domain mono">rileydavis.vercel.app</span>
            </div>
            <div className="brand-subtitle">
              Unified Python Engineering & CAD Tool Hub · Hosted on Vercel + Render
            </div>
          </div>
        </div>

        {/* Center Navigation Pills */}
        <nav className="nav-tabs" aria-label="Tool Navigation">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'step-to-stl' ? 'active' : ''}`}
            onClick={() => setActiveTab('step-to-stl')}
          >
            <Box size={15} />
            <span>STEP → STL Converter</span>
            <span className="nav-badge">3D CAD</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'mesh-inspector' ? 'active' : ''}`}
            onClick={() => setActiveTab('mesh-inspector')}
          >
            <Layers size={15} />
            <span>3D Mesh Inspector</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <Server size={15} />
            <span>All Tools & Render Hub ({tools.length})</span>
          </button>
        </nav>

        {/* Right Render Backend Status Pill */}
        <div className="backend-status-cluster">
          <div className={`status-pill ${backendStatus}`}>
            <span className={`status-dot ${backendStatus === 'online' ? 'online' : 'waking'}`} />
            <span className="mono">
              {backendStatus === 'online'
                ? `Render API Online (${backendLatencyMs}ms)`
                : 'Connecting to Render API...'}
            </span>
          </div>
          <a
            href={`${backendUrl}/docs`}
            target="_blank"
            rel="noreferrer"
            className="api-docs-link mono"
            title="Open Unified Render FastAPI Swagger Docs"
          >
            <span>/docs</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-container">
        {activeTab === 'step-to-stl' && (
          <StepToStlTool
            backendUrl={backendUrl}
            onSelectSharedStl={(stlB64, fname) => {
              setSharedStlBase64(stlB64);
              setSharedStlFilename(fname);
              setActiveTab('mesh-inspector');
            }}
          />
        )}

        {activeTab === 'mesh-inspector' && (
          <MeshInspectorTool
            backendUrl={backendUrl}
            initialStlBase64={sharedStlBase64}
            initialFilename={sharedStlFilename}
          />
        )}

        {activeTab === 'catalog' && (
          <div className="catalog-view">
            <div className="catalog-hero">
              <div>
                <span className="eyebrow mono">UNIFIED TOOL ARCHITECTURE</span>
                <h1>Riley&apos;s Engineering &amp; Python Tool Directory</h1>
                <p>
                  Every frontend tool on <strong>rileydavis.vercel.app</strong> connects to a single
                  modular FastAPI service on Render. Adding a new Python tool takes one router file
                  in <code>backend/app/tools/</code>.
                </p>
              </div>
              <div className="catalog-search-box">
                <Search size={16} className="text-muted" />
                <input
                  type="text"
                  placeholder="Filter tools by name, tag, or CAD format..."
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
                        <span className={`http-method ${ep.method.toLowerCase()}`}>{ep.method}</span>
                        <span className="endpoint-path">{ep.path}</span>
                      </div>
                    ))}
                  </div>

                  <div className="tool-card-footer">
                    {tool.id === 'step-to-stl' || tool.id === 'mesh-inspector' ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setActiveTab(tool.id as ActiveTab)}
                      >
                        <span>Launch {tool.name.split('&')[0].trim()}</span>
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      <div className="planned-note mono">
                        <PlusCircle size={14} />
                        <span>Add router in backend/app/tools/{tool.slug.replace('-', '_')}.py</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Architecture & How to Add Tools Guide */}
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
                    <code>rileydavis.vercel.app</code>!
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
      </main>
    </div>
  );
};
