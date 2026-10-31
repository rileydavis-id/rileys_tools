import base64
import io
import time
import numpy as np
import trimesh
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .registry import ToolEndpointDoc, ToolMetadata, registry

router = APIRouter(prefix="/api/tools/mesh-inspector", tags=["3D Mesh Inspector & Unit Scaler"])


@router.post("/analyze")
async def analyze_and_scale_mesh(
    file: UploadFile = File(...),
    scale_factor: float = Form(1.0),
    fix_normals: bool = Form(True),
) -> dict:
    """Analyze a 3D mesh (.stl, .obj, .ply, .glb), optionally scale/repair it, and return STL + diagnostics."""
    t0 = time.perf_counter()
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    orig_name = file.filename or "mesh.stl"
    ext = orig_name.lower().rsplit(".", 1)[-1] if "." in orig_name else "stl"
    if ext not in {"stl", "obj", "ply", "glb", "off"}:
        ext = "stl"

    try:
        loaded = trimesh.load(io.BytesIO(raw_bytes), file_type=ext)
        if isinstance(loaded, trimesh.Scene):
            mesh = trimesh.util.concatenate(tuple(loaded.geometry.values()))
        else:
            mesh = loaded
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse 3D mesh: {exc}") from exc

    if mesh is None or len(mesh.faces) == 0:
        raise HTTPException(status_code=422, detail="Mesh contains no triangles.")

    if scale_factor != 1.0 and scale_factor > 0:
        mesh.apply_scale(scale_factor)

    if fix_normals:
        mesh.merge_vertices()
        trimesh.repair.fix_winding(mesh)

    stl_bytes: bytes = mesh.export(file_type="stl")
    bounds = mesh.bounds.tolist() if mesh.bounds is not None else [[0, 0, 0], [0, 0, 0]]
    extents = mesh.extents.tolist() if mesh.extents is not None else [0, 0, 0]
    center_mass = (
        [round(float(x), 3) for x in mesh.center_mass.tolist()]
        if mesh.is_watertight
        else [round(float(x), 3) for x in mesh.centroid.tolist()]
    )

    # Estimate PLA filament weight at 100% infill (1.24 g/cm³) and 20% infill
    vol_cm3 = ( float(abs(mesh.volume)) / 1000.0 ) if mesh.is_watertight else 0.0
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    base_stem = orig_name.rsplit(".", 1)[0] if "." in orig_name else orig_name
    return {
        "filename": f"{base_stem}_inspected.stl",
        "stl_base64": base64.b64encode(stl_bytes).decode("ascii"),
        "metrics": {
            "vertex_count": int(len(mesh.vertices)),
            "face_count": int(len(mesh.faces)),
            "euler_number": int(mesh.euler_number),
            "is_watertight": bool(mesh.is_watertight),
            "is_winding_consistent": bool(mesh.is_winding_consistent),
            "volume_mm3": round(float(abs(mesh.volume)) if mesh.is_watertight else 0.0, 3),
            "volume_cm3": round(vol_cm3, 3),
            "estimated_pla_grams_20pct": round(vol_cm3 * 1.24 * 0.28, 2),
            "Estimated_pla_grams_100pct": round(vol_cm3 * 1.24, 2),
            "surface_area_mm2": round(float(mesh.area), 3),
            "center_of_mass": center_mass,
            "bounding_box": {
                "min": [round(float(x), 3) for x in bounds[0]],
                "max": [round(float(x), 3) for x in bounds[1]],
                "extents": [round(float(x), 3) for x in extents],
            },
            "scale_factor_applied": scale_factor,
            "processing_time_ms": elapsed_ms,
        },
    }


registry.register(
    ToolMetadata(
        id="mesh-inspector",
        name="3D Mesh Printability Inspector & Unit Scaler",
        slug="mesh-inspector",
        category="CAD & 3D Manufacturing",
        description="Inspect STL/OBJ/PLY meshes for manifold watertightness, normal consistency, bounding dimensions, volume, PLA weight estimates, and mm/inch scaling.",
        version="1.0.0",
        status="active",
        icon="layers",
        tags=["STL", "Mesh Repair", "3D Printing", "Metrology"],
        endpoints=[
            ToolEndpointDoc("POST", "/api/tools/mesh-inspector/analyze", "Analyze, repair normals, and optionally scale a 3D mesh"),
        ],
    ),
    router,
)
