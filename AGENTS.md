# Riley's Tools (`rileys_tools`) — Project Rules

## 1. Documentation & Commit Hygiene
- **Always update `README.md`** on every change (including the **Site Map**, **Active Tools**, and **Project Changelog & Git Commit Log** table).
- **Always include multi-line commit notes** (`git commit -m "Summary" -m "Detailed notes..."`) when committing and pushing to `https://github.com/rileydavis-id/rileys_tools`.

## 2. Vercel (`rileydavis.vercel.app`) & Render (`rileys-tools-backend`) Invariants
- **Monorepo Separation**:
  - The root Vite + React + Three.js app deploys to **Vercel** (`rileydavis.vercel.app`, scope `rileydavis`).
  - The `backend/` FastAPI service deploys to **Render** (`https://rileys-tools-backend.onrender.com`, service ID `srv-dbiku8utlv9c73b131v0`, `rootDir: backend`).
  - Never remove `backend/` from `.vercelignore` and do not run `vercel link` without verifying `vercel.json` retains the Vite SPA configuration (`framework: "vite"`, `outputDirectory: "dist"`, and the `/(.*) -> /index.html` SPA rewrite).
- **Adding New Tools**:
  1. Create a router in `backend/app/tools/<tool_name>.py` and register it with `registry.register(ToolMetadata(...), router)`.
  2. Import the new module in `backend/app/main.py`.
  3. Add the corresponding UI component in `src/components/` and route in `src/App.tsx`.
- **CAD Unit Scaling**:
  - `cascadio.load()` outputs glTF/GLB geometry in **meters** per the glTF 2.0 spec. Always scale converted CAD meshes by `×1000.0` (`mesh.apply_scale(1000.0)`) when exporting to `.stl` so dimensions remain in **millimeters (mm)**.
