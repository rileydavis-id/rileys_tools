export interface ToolEndpoint {
  method: string;
  path: string;
  summary: string;
}

export interface ToolItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  version: string;
  status: 'active' | 'beta' | 'planned';
  icon: string;
  tags: string[];
  endpoints: ToolEndpoint[];
}

const DEFAULT_PROD_BACKEND = 'https://rileys-tools-backend.onrender.com';
const DEFAULT_DEV_BACKEND = 'http://localhost:8000';

export function getDefaultBackendUrl(): string {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return DEFAULT_DEV_BACKEND;
    }
  }
  return DEFAULT_PROD_BACKEND;
}

export const INITIAL_TOOLS: ToolItem[] = [
  {
    id: 'step-to-stl',
    name: 'STEP to STL Converter & 3D Visualizer',
    slug: 'step-to-stl',
    category: 'CAD & 3D Manufacturing',
    description:
      'Convert ISO-10303-21 (.step / .stp) CAD B-Rep solids into watertight .stl meshes using OpenCASCADE, with interactive 3D WebGL inspection, cross-section slicing, and mesh telemetry.',
    version: '1.0.0',
    status: 'active',
    icon: 'cube',
    tags: ['CAD', 'STEP', 'STL', 'OpenCASCADE', '3D Printing'],
    endpoints: [
      {
        method: 'POST',
        path: '/api/tools/step-to-stl/convert',
        summary: 'Convert STEP file to STL + return mesh metrics',
      },
      {
        method: 'POST',
        path: '/api/tools/step-to-stl/convert-raw',
        summary: 'Convert STEP file and stream raw binary STL',
      },
      {
        method: 'GET',
        path: '/api/tools/step-to-stl/samples',
        summary: 'List built-in sample STEP CAD models',
      },
    ],
  },
  {
    id: 'mesh-inspector',
    name: '3D Mesh Printability Inspector & Unit Scaler',
    slug: 'mesh-inspector',
    category: 'CAD & 3D Manufacturing',
    description:
      'Analyze STL/OBJ/PLY meshes for manifold watertightness, normal winding consistency, bounding box dimensions, PLA filament weight estimates, and mm/inch scaling.',
    version: '1.0.0',
    status: 'active',
    icon: 'layers',
    tags: ['STL', 'Mesh Repair', '3D Printing', 'Metrology'],
    endpoints: [
      {
        method: 'POST',
        path: '/api/tools/mesh-inspector/analyze',
        summary: 'Analyze, repair normals, and scale a 3D mesh',
      },
    ],
  },
  {
    id: 'gcode-estimator',
    name: 'G-Code Toolpath & Print Time Analyzer',
    slug: 'gcode-estimator',
    category: 'CAD & 3D Manufacturing',
    description:
      'Ready-to-activate slot on the shared Render backend for parsing 3D printer G-code layer times, retraction counts, and filament feed rates.',
    version: '0.1.0',
    status: 'planned',
    icon: 'cpu',
    tags: ['G-Code', 'CNC', 'FDM', 'Python Router'],
    endpoints: [
      {
        method: 'POST',
        path: '/api/tools/gcode-estimator/parse',
        summary: 'Planned endpoint on shared Render service',
      },
    ],
  },
];
