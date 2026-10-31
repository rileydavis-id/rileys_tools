import base64
import io
import math
import time
from typing import Dict, List, Optional, Tuple
import cascadio
import numpy as np
import trimesh
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from .registry import ToolEndpointDoc, ToolMetadata, registry

router = APIRouter(prefix="/api/tools/step-to-stl", tags=["STEP to STL Converter"])


def _build_extruded_polygon_step(
    part_name: str,
    polygon_xz: List[Tuple[float, float]],
    depth_y: float,
) -> str:
    """
    Generate a 100% standards-compliant ISO-10303-21 AP214 STEP file using
    MANIFOLD_SOLID_BREP + ADVANCED_FACE + EDGE_LOOP + EDGE_CURVE + LINE
    for any 2D polygon in the XZ plane extruded along +Y by `depth_y`.
    Parsed natively by OpenCASCADE (cascadio), FreeCAD, SolidWorks, and Fusion 360.
    """
    n = len(polygon_xz)
    lines: List[str] = []
    eid = 100

    def next_id() -> int:
        nonlocal eid
        eid += 1
        return eid

    def fmt(val: float) -> str:
        return f"{round(val, 6):.6f}"

    # Create front (y=0) and back (y=depth_y) cartesian points & vertex points
    front_pts: List[int] = []
    back_pts: List[int] = []
    front_verts: List[int] = []
    back_verts: List[int] = []

    for x, z in polygon_xz:
        p_front = next_id()
        lines.append(f"#{p_front} = CARTESIAN_POINT('',({fmt(x)},0.0,{fmt(z)}));")
        v_front = next_id()
        lines.append(f"#{v_front} = VERTEX_POINT('',#{p_front});")
        front_pts.append(p_front)
        front_verts.append(v_front)

        p_back = next_id()
        lines.append(f"#{p_back} = CARTESIAN_POINT('',({fmt(x)},{fmt(depth_y)},{fmt(z)}));")
        v_back = next_id()
        lines.append(f"#{v_back} = VERTEX_POINT('',#{p_back});")
        back_pts.append(p_back)
        back_verts.append(v_back)

    def make_edge_curve(p_start: int, v_start: int, v_end: int, dx: float, dy: float, dz: float) -> int:
        length = math.sqrt(dx * dx + dy * dy + dz * dz)
        ux, uy, uz = dx / length, dy / length, dz / length
        d_id = next_id()
        lines.append(f"#{d_id} = DIRECTION('',({fmt(ux)},{fmt(uy)},{fmt(uz)}));")
        vec_id = next_id()
        lines.append(f"#{vec_id} = VECTOR('',#{d_id},1.0);")
        line_id = next_id()
        lines.append(f"#{line_id} = LINE('',#{p_start},#{vec_id});")
        ec_id = next_id()
        lines.append(f"#{ec_id} = EDGE_CURVE('',#{v_start},#{v_end},#{line_id},.T.);")
        return ec_id

    # Front perimeter edges (i -> (i+1)%n), Back perimeter edges (i -> (i+1)%n), Side edges (front_i -> back_i)
    front_edges: List[int] = []
    back_edges: List[int] = []
    side_edges: List[int] = []

    for i in range(n):
        j = (i + 1) % n
        x0, z0 = polygon_xz[i]
        x1, z1 = polygon_xz[j]
        dx, dz = x1 - x0, z1 - z0
        front_edges.append(make_edge_curve(front_pts[i], front_verts[i], front_verts[j], dx, 0.0, dz))
        back_edges.append(make_edge_curve(back_pts[i], back_verts[i], back_verts[j], dx, 0.0, dz))
        side_edges.append(make_edge_curve(front_pts[i], front_verts[i], back_verts[i], 0.0, depth_y, 0.0))

    advanced_faces: List[int] = []

    # 1. Front face (Y = 0, outward normal (0, -1, 0))
    front_oriented: List[int] = []
    for i in range(n):
        oe = next_id()
        lines.append(f"#{oe} = ORIENTED_EDGE('',*,*,#{front_edges[i]},.T.);")
        front_oriented.append(oe)
    el_front = next_id()
    lines.append(f"#{el_front} = EDGE_LOOP('',({','.join(f'#{x}' for x in front_oriented)}));")
    fb_front = next_id()
    lines.append(f"#{fb_front} = FACE_OUTER_BOUND('',#{el_front},.T.);")
    dir_ny = next_id()
    dir_ref_x = next_id()
    ax_front = next_id()
    pl_front = next_id()
    af_front = next_id()
    lines.append(f"#{dir_ny} = DIRECTION('',(0.0,-1.0,0.0));")
    lines.append(f"#{dir_ref_x} = DIRECTION('',(1.0,0.0,0.0));")
    lines.append(f"#{ax_front} = AXIS2_PLACEMENT_3D('',#{front_pts[0]},#{dir_ny},#{dir_ref_x});")
    lines.append(f"#{pl_front} = PLANE('',#{ax_front});")
    lines.append(f"#{af_front} = ADVANCED_FACE('',(#{fb_front}),#{pl_front},.T.);")
    advanced_faces.append(af_front)

    # 2. Back face (Y = depth_y, outward normal (0, 1, 0))
    back_oriented: List[int] = []
    for i in range(n - 1, -1, -1):
        oe = next_id()
        lines.append(f"#{oe} = ORIENTED_EDGE('',*,*,#{back_edges[i]},.F.);")
        back_oriented.append(oe)
    el_back = next_id()
    lines.append(f"#{el_back} = EDGE_LOOP('',({','.join(f'#{x}' for x in back_oriented)}));")
    fb_back = next_id()
    lines.append(f"#{fb_back} = FACE_OUTER_BOUND('',#{el_back},.T.);")
    dir_py = next_id()
    ax_back = next_id()
    pl_back = next_id()
    af_back = next_id()
    lines.append(f"#{dir_py} = DIRECTION('',(0.0,1.0,0.0));")
    lines.append(f"#{ax_back} = AXIS2_PLACEMENT_3D('',#{back_pts[0]},#{dir_py},#{dir_ref_x});")
    lines.append(f"#{pl_back} = PLANE('',#{ax_back});")
    lines.append(f"#{af_back} = ADVANCED_FACE('',(#{fb_back}),#{pl_back},.T.);")
    advanced_faces.append(af_back)

    # 3. Side faces around perimeter
    for i in range(n):
        j = (i + 1) % n
        x0, z0 = polygon_xz[i]
        x1, z1 = polygon_xz[j]
        dx, dz = x1 - x0, z1 - z0
        length = math.sqrt(dx * dx + dz * dz)
        # For CCW polygon in XZ, outward normal is (dz/length, 0, -dx/length)
        nx, nz = dz / length, -dx / length
        rx, rz = dx / length, dz / length

        oe1 = next_id()
        oe2 = next_id()
        oe3 = next_id()
        oe4 = next_id()
        lines.append(f"#{oe1} = ORIENTED_EDGE('',*,*,#{front_edges[i]},.F.);")
        lines.append(f"#{oe2} = ORIENTED_EDGE('',*,*,#{side_edges[i]},.T.);")
        lines.append(f"#{oe3} = ORIENTED_EDGE('',*,*,#{back_edges[i]},.T.);")
        lines.append(f"#{oe4} = ORIENTED_EDGE('',*,*,#{side_edges[j]},.F.);")
        el_side = next_id()
        lines.append(f"#{el_side} = EDGE_LOOP('',(#{oe1},#{oe2},#{oe3},#{oe4}));")
        fb_side = next_id()
        lines.append(f"#{fb_side} = FACE_OUTER_BOUND('',#{el_side},.T.);")
        d_norm = next_id()
        d_ref = next_id()
        ax_side = next_id()
        pl_side = next_id()
        af_side = next_id()
        lines.append(f"#{d_norm} = DIRECTION('',({fmt(nx)},0.0,{fmt(nz)}));")
        lines.append(f"#{d_ref} = DIRECTION('',({fmt(rx)},0.0,{fmt(rz)}));")
        lines.append(f"#{ax_side} = AXIS2_PLACEMENT_3D('',#{front_pts[i]},#{d_norm},#{d_ref});")
        lines.append(f"#{pl_side} = PLANE('',#{ax_side});")
        lines.append(f"#{af_side} = ADVANCED_FACE('',(#{fb_side}),#{pl_side},.T.);")
        advanced_faces.append(af_side)

    faces_refs = ",".join(f"#{fid}" for fid in advanced_faces)
    body = "\n".join(lines)

    return f"""ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Riley Tools CAD Sample - {part_name}'),'2;1');
FILE_NAME('{part_name}.step','2026-10-30T18:00:00',('Riley Davis'),('Riley Tools'),'OpenCASCADE','RileyToolsCAD','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN {{ 1 0 10303 214 1 1 1 1 }}'));
ENDSEC;
DATA;
#1 = APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#2);
#2 = APPLICATION_CONTEXT('core data for automotive mechanical design processes');
#3 = SHAPE_DEFINITION_REPRESENTATION(#4,#10);
#4 = PRODUCT_DEFINITION_SHAPE('','',#5);
#5 = PRODUCT_DEFINITION('design','',#6,#9);
#6 = PRODUCT_DEFINITION_FORMATION('','',#7);
#7 = PRODUCT('{part_name}','{part_name}','',(#8));
#8 = PRODUCT_CONTEXT('',#2,'mechanical');
#9 = PRODUCT_DEFINITION_CONTEXT('part definition',#2,'design');
#10 = ADVANCED_BREP_SHAPE_REPRESENTATION('',(#11,#15),#19);
#11 = AXIS2_PLACEMENT_3D('',#12,#13,#14);
#12 = CARTESIAN_POINT('',(0.,0.,0.));
#13 = DIRECTION('',(0.,0.,1.));
#14 = DIRECTION('',(1.,0.,-0.));
#15 = MANIFOLD_SOLID_BREP('{part_name}',#23);
#16 = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );
#17 = ( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );
#18 = ( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() );
#19 = ( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#22)) GLOBAL_UNIT_ASSIGNED_CONTEXT((#16,#17,#18)) REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY') );
#22 = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-05),#16,'distance_accuracy_value','confusion accuracy');
#23 = CLOSED_SHELL('',({faces_refs}));
{body}
ENDSEC;
END-ISO-10303-21;
"""


def _build_l_bracket_step() -> str:
    """60×40×50 mm CNC L-Bracket with internal chamfered gusset and stepped mounting lip."""
    polygon_xz = [
        (0.0, 0.0),
        (60.0, 0.0),
        (60.0, 10.0),
        (48.0, 10.0),
        (48.0, 14.0),
        (22.0, 14.0),
        (14.0, 22.0),
        (14.0, 50.0),
        (0.0, 50.0),
    ]
    return _build_extruded_polygon_step("CNC_Mounting_Bracket", polygon_xz, depth_y=36.0)


def _build_t_slot_extrusion_step() -> str:
    """T-Block Heavy Machine Shoe / Dovetail Clamp Block."""
    polygon_xz = [
        (0.0, 0.0),
        (50.0, 0.0),
        (50.0, 12.0),
        (35.0, 12.0),
        (35.0, 28.0),
        (44.0, 28.0),
        (44.0, 38.0),
        (6.0, 38.0),
        (6.0, 28.0),
        (15.0, 28.0),
        (15.0, 12.0),
        (0.0, 12.0),
    ]
    return _build_extruded_polygon_step("T_Slot_Clamp_Block", polygon_xz, depth_y=45.0)


def _build_hex_prism_step() -> str:
    """Hexagonal Heavy Flange Coupling in ISO-10303-21 STEP format."""
    radius = 24.0
    polygon_xz = [
        (round(radius * math.cos(math.radians(60 * k)), 4), round(radius * math.sin(math.radians(60 * k)), 4))
        for k in range(6)
    ]
    return _build_extruded_polygon_step("Hex_Flange_Coupler", polygon_xz, depth_y=28.0)


SAMPLE_PARTS: Dict[str, dict] = {
    "cnc-l-bracket": {
        "id": "cnc-l-bracket",
        "name": "CNC Gusseted L-Bracket",
        "filename": "cnc_mounting_bracket.step",
        "description": "60×36×50 mm structural mounting bracket with a 45° internal stress-relief gusset and stepped toe.",
        "builder": _build_l_bracket_step,
    },
    "t-slot-clamp": {
        "id": "t-slot-clamp",
        "name": "T-Slot Mill Table Clamp Block",
        "filename": "t_slot_clamp_block.step",
        "description": "50×45×38 mm T-profile machine table fixture block in ISO-10303-21 AP214 B-Rep format.",
        "builder": _build_t_slot_extrusion_step,
    },
    "hex-flange": {
        "id": "hex-flange",
        "name": "Hexagonal Drive Coupler",
        "filename": "hex_flange_coupler.step",
        "description": "48 mm across-corners hexagonal mechanical drive prism (28 mm length).",
        "builder": _build_hex_prism_step,
    },
}


def convert_step_bytes_to_mesh(
    step_bytes: bytes,
    filename: str,
    linear_deflection: float = 0.1,
    angular_deflection: float = 0.5,
) -> trimesh.Trimesh:
    """Convert STEP (.step / .stp), IGES (.igs / .iges), or STL bytes into a unified trimesh.Trimesh object."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "step"

    if ext == "stl":
        loaded = trimesh.load(io.BytesIO(step_bytes), file_type="stl")
        if isinstance(loaded, trimesh.Scene):
            loaded = trimesh.util.concatenate(tuple(loaded.geometry.values()))
        if isinstance(loaded, trimesh.Trimesh) and len(loaded.faces) > 0:
            return loaded

    file_type = "iges" if ext in {"igs", "iges"} else "step"
    glb_bytes = cascadio.load(
        step_bytes,
        file_type=file_type,
        tol_linear=max(0.005, min(linear_deflection, 5.0)),
        tol_angular=max(0.05, min(angular_deflection, 2.0)),
        use_parallel=False,
    )

    mesh: Optional[trimesh.Trimesh] = None
    if glb_bytes:
        scene_or_mesh = trimesh.load(io.BytesIO(glb_bytes), file_type="glb")
        if isinstance(scene_or_mesh, trimesh.Scene):
            if len(scene_or_mesh.geometry) > 0:
                mesh = trimesh.util.concatenate(tuple(scene_or_mesh.geometry.values()))
        elif isinstance(scene_or_mesh, trimesh.Trimesh):
            mesh = scene_or_mesh

    if mesh is None or len(mesh.faces) == 0:
        raise ValueError(
            "Unable to extract 3D solid or surface geometry from the provided STEP file. "
            "Please verify it is a valid ISO-10303-21 (.step / .stp) CAD model."
        )

    # cascadio exports glTF/GLB in meters per glTF 2.0 spec; scale back to CAD millimeters (mm)
    mesh.apply_scale(1000.0)
    mesh.merge_vertices()
    return mesh


@router.get("/samples")
def list_sample_parts() -> dict:
    """Return available sample STEP files so users can test without a local CAD file."""
    return {
        "samples": [
            {
                "id": item["id"],
                "name": item["name"],
                "filename": item["filename"],
                "description": item["description"],
            }
            for item in SAMPLE_PARTS.values()
        ]
    }


@router.get("/samples/{sample_id}")
def get_sample_part(sample_id: str) -> dict:
    """Return the raw ISO-10303-21 STEP file contents for a sample part."""
    sample = SAMPLE_PARTS.get(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_id}' not found")
    step_content = sample["builder"]()
    return {
        "id": sample["id"],
        "name": sample["name"],
        "filename": sample["filename"],
        "description": sample["description"],
        "step_content": step_content,
    }


@router.post("/convert")
async def convert_step_to_stl(
    file: UploadFile = File(...),
    linear_deflection: float = Form(0.1),
    angular_deflection: float = Form(0.5),
    export_format: str = Form("binary"),
) -> dict:
    """Convert an uploaded .step / .stp file to .stl and return base64 STL + mesh analytics."""
    t0 = time.perf_counter()
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    orig_name = file.filename or "model.step"
    base_stem = orig_name.rsplit(".", 1)[0] if "." in orig_name else orig_name
    out_filename = f"{base_stem}.stl"

    try:
        mesh = convert_step_bytes_to_mesh(
            raw_bytes,
            filename=orig_name,
            linear_deflection=linear_deflection,
            angular_deflection=angular_deflection,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CAD kernel conversion error: {exc}") from exc

    file_type = "stl_ascii" if export_format.lower() == "ascii" else "stl"
    stl_bytes: bytes = mesh.export(file_type=file_type)
    if isinstance(stl_bytes, str):
        stl_bytes = stl_bytes.encode("utf-8")

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    bounds = mesh.bounds.tolist() if mesh.bounds is not None else [[0, 0, 0], [0, 0, 0]]
    extents = mesh.extents.tolist() if mesh.extents is not None else [0, 0, 0]

    return {
        "filename": out_filename,
        "source_filename": orig_name,
        "export_format": "ascii" if file_type == "stl_ascii" else "binary",
        "stl_base64": base64.b64encode(stl_bytes).decode("ascii"),
        "metrics": {
            "vertex_count": int(len(mesh.vertices)),
            "face_count": int(len(mesh.faces)),
            "is_watertight": bool(mesh.is_watertight),
            "volume_mm3": round(float(abs(mesh.volume)) if mesh.is_watertight else 0.0, 3),
            "surface_area_mm2": round(float(mesh.area), 3),
            "bounding_box": {
                "min": [round(float(x), 3) for x in bounds[0]],
                "max": [round(float(x), 3) for x in bounds[1]],
                "extents": [round(float(x), 3) for x in extents],
            },
            "input_size_bytes": len(raw_bytes),
            "output_size_bytes": len(stl_bytes),
            "conversion_time_ms": elapsed_ms,
            "linear_deflection": linear_deflection,
            "angular_deflection": angular_deflection,
        },
    }


@router.post("/convert-raw")
async def convert_step_to_stl_raw(
    file: UploadFile = File(...),
    linear_deflection: float = Form(0.1),
    angular_deflection: float = Form(0.5),
) -> Response:
    """Convert an uploaded .step / .stp file and stream back raw binary STL bytes."""
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    orig_name = file.filename or "model.step"
    base_stem = orig_name.rsplit(".", 1)[0] if "." in orig_name else orig_name
    out_filename = f"{base_stem}.stl"

    try:
        mesh = convert_step_bytes_to_mesh(
            raw_bytes,
            filename=orig_name,
            linear_deflection=linear_deflection,
            angular_deflection=angular_deflection,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    stl_bytes: bytes = mesh.export(file_type="stl")
    return Response(
        content=stl_bytes,
        media_type="model/stl",
        headers={
            "Content-Disposition": f'attachment; filename="{out_filename}"',
            "X-Mesh-Vertices": str(len(mesh.vertices)),
            "X-Mesh-Faces": str(len(mesh.faces)),
        },
    )


registry.register(
    ToolMetadata(
        id="step-to-stl",
        name="STEP to STL Converter & 3D Visualizer",
        slug="step-to-stl",
        category="CAD & 3D Manufacturing",
        description="Convert ISO-10303-21 (.step / .stp) CAD B-Rep solids into watertight .stl meshes using OpenCASCADE, with interactive 3D mesh inspection.",
        version="1.0.0",
        status="active",
        icon="cube",
        tags=["CAD", "STEP", "STL", "OpenCASCADE", "3D Printing"],
        endpoints=[
            ToolEndpointDoc("POST", "/api/tools/step-to-stl/convert", "Convert STEP file to STL + return mesh metrics"),
            ToolEndpointDoc("POST", "/api/tools/step-to-stl/convert-raw", "Convert STEP file and return binary STL stream"),
            ToolEndpointDoc("GET", "/api/tools/step-to-stl/samples", "List built-in sample STEP CAD models"),
            ToolEndpointDoc("GET", "/api/tools/step-to-stl/samples/{sample_id}", "Fetch raw STEP file for a sample part"),
        ],
    ),
    router,
)
