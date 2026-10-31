# Riley's Tools (`rileys_tools`)

Unified Engineering & Python Tool Hub for **[rileydavis.vercel.app](https://rileydavis.vercel.app)** with a modular FastAPI backend hosted on **Render**.

## Architecture

- **Frontend (`/src`)**: React + TypeScript + Three.js WebGL application deployed to **Vercel** (`rileydavis.vercel.app`).
  - Interactive Tool Directory to pick and choose tools from a single dashboard.
  - **STEP → STL Converter & 3D CAD Visualizer**: Upload `.step` / `.stp` CAD solids (or test with 3 built-in ISO-10303-21 STEP mechanical parts), adjust OpenCASCADE tessellation deflection, inspect the resulting `.stl` mesh in an interactive Three.js 3D viewport (with CAD edge shading, wireframe, surface normals, X-ray mode, and real-time Z cross-section slicing), and download binary or ASCII `.stl` files.
  - **3D Mesh Printability Inspector & Unit Scaler**: Verify watertightness, normal winding consistency, center of mass, PLA filament mass estimates, and scale between `mm` and `inch`.
- **Unified Backend (`/backend`)**: FastAPI Python service deployed on **Render** (`rootDir: backend`).
  - Uses `cascadio` (OpenCASCADE C++ kernel bindings) + `trimesh` for fast, accurate B-Rep STEP to STL conversion.
  - Plug-and-play tool registry (`backend/app/tools/registry.py`): add any future Python backend tool by dropping a new router module into `backend/app/tools/` and registering it.

## Adding a New Tool to the Shared Render Service

1. Create `backend/app/tools/my_new_tool.py` with an `APIRouter(prefix="/api/tools/my-new-tool")`.
2. Call `registry.register(ToolMetadata(...), router)` and import the module in `backend/app/main.py`.
3. Add the corresponding UI component in `src/components/` and push to `main`.
