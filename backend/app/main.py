import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .tools import step_to_stl, mesh_inspector  # noqa: F401 - registers tools on import
from .tools.registry import registry

START_TIME = time.time()

app = FastAPI(
    title="Riley's Tools — Unified Backend Service",
    description=(
        "Combined Render backend hosting Riley Davis's Python engineering & developer tools "
        "for rileydavis.vercel.app."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Mesh-Vertices", "X-Mesh-Faces"],
)

# Mount all registered tool routers automatically
for _meta, tool_router in registry.entries:
    app.include_router(tool_router)


@app.get("/")
def root() -> dict:
    return {
        "service": "rileys-tools-backend",
        "owner": "Riley Davis",
        "frontend": "https://rileydavis.vercel.app",
        "status": "online",
        "registered_tools_count": len(registry.entries),
        "docs": "/docs",
        "health": "/api/health",
        "tools_catalog": "/api/tools",
    }


@app.get("/health")
@app.get("/api/health")
def health_check() -> dict:
    return {
        "status": "healthy",
        "service": "rileys-tools-backend",
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "tools_registered": [meta.id for meta, _ in registry.entries],
    }


@app.get("/api/tools")
def list_tools() -> dict:
    return {
        "service": "rileys-tools-backend",
        "count": len(registry.entries),
        "tools": registry.list_metadata(),
    }
