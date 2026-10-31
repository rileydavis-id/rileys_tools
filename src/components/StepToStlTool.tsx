import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  FileCode,
  FileUp,
  Play,
  RefreshCw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { StlViewer3D } from './StlViewer3D';

interface StepSampleInfo {
  id: string;
  name: string;
  filename: string;
  description: string;
}

interface ConversionMetrics {
  vertex_count: number;
  face_count: number;
  is_watertight: boolean;
  volume_mm3: number;
  surface_area_mm2: number;
  bounding_box: {
    min: [number, number, number];
    max: [number, number, number];
    extents: [number, number, number];
  };
  input_size_bytes: number;
  output_size_bytes: number;
  conversion_time_ms: number;
  linear_deflection: number;
  angular_deflection: number;
}

interface ConversionResponse {
  filename: string;
  source_filename: string;
  export_format: string;
  stl_base64: string;
  metrics: ConversionMetrics;
}

const DEFAULT_SAMPLES: StepSampleInfo[] = [
  {
    id: 'cnc-l-bracket',
    name: 'CNC Gusseted L-Bracket',
    filename: 'cnc_mounting_bracket.step',
    description:
      '60×36×50 mm structural mounting bracket with a 45° internal stress-relief gusset and stepped toe.',
  },
  {
    id: 't-slot-clamp',
    name: 'T-Slot Mill Table Clamp Block',
    filename: 't_slot_clamp_block.step',
    description:
      '50×45×38 mm T-profile machine table fixture block in ISO-10303-21 AP214 B-Rep format.',
  },
  {
    id: 'hex-flange',
    name: 'Hexagonal Drive Coupler',
    filename: 'hex_flange_coupler.step',
    description: '48 mm across-corners hexagonal mechanical drive prism (28 mm length).',
  },
];

interface StepToStlToolProps {
  backendUrl: string;
  onSelectSharedStl?: (stlBase64: string, filename: string) => void;
}

export const StepToStlTool: React.FC<StepToStlToolProps> = ({
  backendUrl,
  onSelectSharedStl,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [samples] = useState<StepSampleInfo[]>(DEFAULT_SAMPLES);
  const [activeSampleId, setActiveSampleId] = useState<string>('cnc-l-bracket');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawStepPreview, setRawStepPreview] = useState<string>('');
  const [showStepSource, setShowStepSource] = useState<boolean>(false);

  const [linearDeflection, setLinearDeflection] = useState<number>(0.1);
  const [angularDeflection, setAngularDeflection] = useState<number>(0.5);
  const [exportFormat, setExportFormat] = useState<'binary' | 'ascii'>('binary');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResponse | null>(null);

  const runConversionWithFile = async (
    fileToConvert: File,
    linDef: number = linearDeflection,
    angDef: number = angularDeflection,
    fmt: 'binary' | 'ascii' = exportFormat
  ) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', fileToConvert);
      formData.append('linear_deflection', String(linDef));
      formData.append('angular_deflection', String(angDef));
      formData.append('export_format', fmt);

      const response = await fetch(`${backendUrl}/api/tools/step-to-stl/convert`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          errBody.detail || `Backend returned HTTP ${response.status} during STEP conversion.`
        );
      }

      const data: ConversionResponse = await response.json();
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to convert STEP file.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadSampleAndConvert = async (sampleId: string) => {
    setActiveSampleId(sampleId);
    setLoading(true);
    setError(null);
    try {
      const sampleRes = await fetch(`${backendUrl}/api/tools/step-to-stl/samples/${sampleId}`);
      if (!sampleRes.ok) {
        throw new Error(`Could not fetch sample '${sampleId}' from Render backend.`);
      }
      const sampleData = await sampleRes.json();
      const stepText: string = sampleData.step_content;
      setRawStepPreview(stepText);

      const blob = new Blob([stepText], { type: 'application/step' });
      const fileObj = new File([blob], sampleData.filename, { type: 'application/step' });
      setSelectedFile(fileObj);

      await runConversionWithFile(fileObj);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not reach Render backend to load sample STEP part.';
      setError(msg);
      setLoading(false);
    }
  };

  // Automatically load and convert the default CNC L-Bracket STEP part on mount
  useEffect(() => {
    loadSampleAndConvert('cnc-l-bracket');
  }, [backendUrl]);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setActiveSampleId('');
    setSelectedFile(file);
    if (file.size < 512 * 1024 && !file.name.toLowerCase().endsWith('.stl')) {
      const text = await file.text();
      setRawStepPreview(text.slice(0, 8000));
    } else {
      setRawStepPreview('');
    }
    await runConversionWithFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      await handleFileChange(dropped);
    }
  };

  const handleDownloadStl = () => {
    if (!result) return;
    const binaryStr = window.atob(result.stl_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadStepSource = () => {
    if (!rawStepPreview || !selectedFile) return;
    const blob = new Blob([rawStepPreview], { type: 'application/step' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="tool-workspace">
      {/* Left Control Column */}
      <div className="tool-sidebar-panel">
        {/* Card 1: Upload or Sample Picker */}
        <div className="panel-card">
          <div className="panel-card-header">
            <FileUp size={16} className="text-cyan" />
            <h3>1. Select or Upload CAD Model (.STEP / .STP)</h3>
          </div>

          <div
            className="upload-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".step,.stp,.igs,.iges,.stl"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
            <FileCode size={26} className="text-cyan" />
            <div className="upload-title">
              {selectedFile ? selectedFile.name : 'Drop .step / .stp file here or click to browse'}
            </div>
            <div className="upload-subtitle">
              Supports ISO-10303-21 AP203 / AP214 / AP242 (.step, .stp) & IGES
            </div>
          </div>

          <div className="sample-section">
            <div className="section-label">
              <Sparkles size={13} className="text-cyan" />
              <span>Or Instant-Test with Built-In ISO-10303-21 STEP Parts:</span>
            </div>
            <div className="sample-buttons">
              {samples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`sample-btn ${activeSampleId === s.id ? 'active' : ''}`}
                  onClick={() => loadSampleAndConvert(s.id)}
                  disabled={loading}
                >
                  <div className="sample-btn-top">
                    <span className="sample-name">{s.name}</span>
                    <span className="sample-ext mono">.STEP</span>
                  </div>
                  <div className="sample-desc">{s.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: OpenCASCADE Tessellation Parameters */}
        <div className="panel-card">
          <div className="panel-card-header">
            <Sliders size={16} className="text-cyan" />
            <h3>2. OpenCASCADE Tessellation & Export</h3>
          </div>

          <div className="preset-row">
            <button
              type="button"
              className={`preset-chip ${linearDeflection === 0.02 ? 'active' : ''}`}
              onClick={() => {
                setLinearDeflection(0.02);
                setAngularDeflection(0.2);
                if (selectedFile) runConversionWithFile(selectedFile, 0.02, 0.2, exportFormat);
              }}
            >
              Ultra Fine (0.02mm)
            </button>
            <button
              type="button"
              className={`preset-chip ${linearDeflection === 0.1 ? 'active' : ''}`}
              onClick={() => {
                setLinearDeflection(0.1);
                setAngularDeflection(0.5);
                if (selectedFile) runConversionWithFile(selectedFile, 0.1, 0.5, exportFormat);
              }}
            >
              Standard (0.10mm)
            </button>
            <button
              type="button"
              className={`preset-chip ${linearDeflection === 0.5 ? 'active' : ''}`}
              onClick={() => {
                setLinearDeflection(0.5);
                setAngularDeflection(0.9);
                if (selectedFile) runConversionWithFile(selectedFile, 0.5, 0.9, exportFormat);
              }}
            >
              Draft (0.50mm)
            </button>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Linear Deflection (Chord Tolerance)</span>
              <span className="mono">{linearDeflection.toFixed(2)} mm</span>
            </div>
            <input
              type="range"
              min={0.01}
              max={1.0}
              step={0.01}
              value={linearDeflection}
              onChange={(e) => setLinearDeflection(Number(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Angular Deflection</span>
              <span className="mono">{angularDeflection.toFixed(2)} rad</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.05}
              value={angularDeflection}
              onChange={(e) => setAngularDeflection(Number(e.target.value))}
            />
          </div>

          <div className="format-toggle-row">
            <span>Output STL Encoding:</span>
            <div className="segmented-control">
              <button
                type="button"
                className={exportFormat === 'binary' ? 'active' : ''}
                onClick={() => setExportFormat('binary')}
              >
                Binary STL
              </button>
              <button
                type="button"
                className={exportFormat === 'ascii' ? 'active' : ''}
                onClick={() => setExportFormat('ascii')}
              >
                ASCII STL
              </button>
            </div>
          </div>

          <div className="action-buttons-stack">
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedFile || loading}
              onClick={() => selectedFile && runConversionWithFile(selectedFile)}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Converting on Render Python Backend...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Re-Tessellate STEP → STL</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-download"
              disabled={!result || loading}
              onClick={handleDownloadStl}
            >
              <Download size={16} />
              <span>
                Download {result ? result.filename : '.STL'}
                {result ? ` (${formatBytes(result.metrics.output_size_bytes)})` : ''}
              </span>
            </button>

            {result && onSelectSharedStl && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onSelectSharedStl(result.stl_base64, result.filename)}
              >
                <Cpu size={15} />
                <span>Send Mesh to Printability Inspector →</span>
              </button>
            )}
          </div>

          {rawStepPreview && (
            <div className="step-source-box">
              <div className="step-source-header">
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setShowStepSource((v) => !v)}
                >
                  <Code2 size={14} />
                  <span>
                    {showStepSource ? 'Hide' : 'Inspect'} Raw ISO-10303-21 STEP B-Rep Source
                  </span>
                </button>
                <button type="button" className="btn-link" onClick={handleDownloadStepSource}>
                  Download .STEP
                </button>
              </div>
              {showStepSource && (
                <pre className="step-code-preview mono">{rawStepPreview}</pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Interactive 3D Visualizer + CAD Telemetry */}
      <div className="tool-main-panel">
        {error && (
          <div className="alert-banner error">
            <AlertCircle size={18} />
            <div>
              <strong>Conversion Notice:</strong> {error}
            </div>
          </div>
        )}

        <div className="visualizer-card">
          <div className="visualizer-header">
            <div>
              <h2>3D STL Mesh Confirmation Viewport</h2>
              <p>
                Orbit (Left Drag) · Pan (Right Drag) · Zoom (Scroll) · Use Z-Section Slice below to
                inspect internal walls
              </p>
            </div>
            {result && (
              <div className="watertight-badge">
                <CheckCircle2 size={15} className="text-emerald" />
                <span>
                  {result.metrics.is_watertight ? 'Watertight Manifold Solid' : 'Surface Shell Mesh'}
                </span>
                <span className="latency-tag mono">{result.metrics.conversion_time_ms} ms</span>
              </div>
            )}
          </div>

          <StlViewer3D
            stlBase64={result?.stl_base64 || null}
            partName={result?.filename || 'Waiting for conversion...'}
            extents={result?.metrics.bounding_box.extents}
          />
        </div>

        {/* Metrology & Telemetry Grid */}
        {result && (
          <div className="telemetry-grid">
            <div className="telemetry-card">
              <span className="telemetry-label">Bounding Envelope (X × Y × Z)</span>
              <span className="telemetry-value mono">
                {result.metrics.bounding_box.extents[0]} × {result.metrics.bounding_box.extents[1]}{' '}
                × {result.metrics.bounding_box.extents[2]} mm
              </span>
              <span className="telemetry-sub">ISO-10303-21 Millimeter Scale</span>
            </div>

            <div className="telemetry-card">
              <span className="telemetry-label">Tessellated Geometry</span>
              <span className="telemetry-value mono">
                {result.metrics.face_count.toLocaleString()} tris
              </span>
              <span className="telemetry-sub">
                {result.metrics.vertex_count.toLocaleString()} merged vertices
              </span>
            </div>

            <div className="telemetry-card">
              <span className="telemetry-label">Computed Solid Volume</span>
              <span className="telemetry-value mono">
                {(result.metrics.volume_mm3 / 1000).toFixed(2)} cm³
              </span>
              <span className="telemetry-sub">
                {result.metrics.volume_mm3.toLocaleString()} mm³
              </span>
            </div>

            <div className="telemetry-card">
              <span className="telemetry-label">Total Surface Area</span>
              <span className="telemetry-value mono">
                {(result.metrics.surface_area_mm2 / 100).toFixed(2)} cm²
              </span>
              <span className="telemetry-sub">
                {result.metrics.surface_area_mm2.toLocaleString()} mm²
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
