import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  Box,
  Compass,
  Eye,
  Grid,
  Layers,
  Maximize2,
  RotateCcw,
  Scissors,
  Sparkles,
} from 'lucide-react';

export type ShadingMode = 'studio' | 'edges' | 'wireframe' | 'normals' | 'xray';

interface StlViewer3DProps {
  stlBase64: string | null;
  partName?: string;
  extents?: [number, number, number];
}

export const StlViewer3D: React.FC<StlViewer3DProps> = ({
  stlBase64,
  partName = 'model.stl',
  extents,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const bboxHelperRef = useRef<THREE.Box3Helper | null>(null);
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 500));
  const maxHeightRef = useRef<number>(100);
  const radiusRef = useRef<number>(60);

  const [shadingMode, setShadingMode] = useState<ShadingMode>('edges');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showBbox, setShowBbox] = useState<boolean>(true);
  const [clipPercent, setClipPercent] = useState<number>(100);

  // Initialize Three.js WebGL scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0f17');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 5000);
    camera.position.set(110, 85, 110);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.6;
    controlsRef.current = controls;

    // Studio CAD 3-point lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(140, 220, 160);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    fillLight.position.set(-150, 90, -120);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.5);
    rimLight.position.set(0, -140, 100);
    scene.add(rimLight);

    // Millimeter build plate grid (160x160mm with 10mm major divisions)
    const grid = new THREE.GridHelper(180, 18, 0x38bdf8, 0x1e293b);
    grid.position.y = -0.05;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Subtle axes indicator at build-plate corner
    const axes = new THREE.AxesHelper(28);
    axes.position.set(-85, 0.1, -85);
    scene.add(axes);

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    let reqId = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 480;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Load STL geometry when stlBase64 or shadingMode changes
  useEffect(() => {
    const scene = sceneRef.current;
    const meshGroup = meshGroupRef.current;
    if (!scene || !meshGroup) return;

    // Clear previous meshes
    while (meshGroup.children.length > 0) {
      const child = meshGroup.children[0];
      meshGroup.remove(child);
    }
    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    if (!stlBase64) return;

    // Decode base64 STL into ArrayBuffer
    const binaryStr = window.atob(stlBase64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const loader = new STLLoader();
    const geometry = loader.parse(bytes.buffer);

    // CAD STEP coordinates are typically Z-up; rotate X by -90deg so Z-up maps to Three.js Y-up
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const bbox = geometry.boundingBox!;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    // Center X and Z at 0, place bottom on build plate Y = 0
    geometry.translate(-center.x, -bbox.min.y, -center.z);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const updatedBox = geometry.boundingBox!;
    const maxY = Math.max(updatedBox.max.y, 1);
    maxHeightRef.current = maxY;
    clipPlaneRef.current.constant = (clipPercent / 100) * maxY + 0.05;

    let mainMaterial: THREE.Material;
    if (shadingMode === 'normals') {
      mainMaterial = new THREE.MeshNormalMaterial({
        flatShading: false,
        side: THREE.DoubleSide,
        clippingPlanes: [clipPlaneRef.current],
      });
    } else if (shadingMode === 'wireframe') {
      mainMaterial = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        clippingPlanes: [clipPlaneRef.current],
      });
    } else if (shadingMode === 'xray') {
      mainMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        metalness: 0.1,
        roughness: 0.15,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
        clippingPlanes: [clipPlaneRef.current],
      });
    } else {
      mainMaterial = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        metalness: 0.38,
        roughness: 0.32,
        flatShading: false,
        side: THREE.DoubleSide,
        clippingPlanes: [clipPlaneRef.current],
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
    }

    const solidMesh = new THREE.Mesh(geometry, mainMaterial);
    meshGroup.add(solidMesh);

    if (shadingMode === 'edges') {
      // Crisp CAD feature-edge overlay + subtle triangle tessellation lines
      const wireGeo = new THREE.WireframeGeometry(geometry);
      const wireMat = new THREE.LineBasicMaterial({
        color: 0x083344,
        transparent: true,
        opacity: 0.38,
        clippingPlanes: [clipPlaneRef.current],
      });
      const wireSegments = new THREE.LineSegments(wireGeo, wireMat);
      meshGroup.add(wireSegments);

      const edgesGeo = new THREE.EdgesGeometry(geometry, 18);
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.85,
        clippingPlanes: [clipPlaneRef.current],
      });
      const edgeSegments = new THREE.LineSegments(edgesGeo, edgesMat);
      meshGroup.add(edgeSegments);
    }

    const boxHelper = new THREE.Box3Helper(updatedBox, new THREE.Color(0xf59e0b));
    boxHelper.visible = showBbox;
    scene.add(boxHelper);
    bboxHelperRef.current = boxHelper;

    // Fit camera smoothly to bounding sphere
    const sphere = geometry.boundingSphere;
    if (sphere && cameraRef.current && controlsRef.current) {
      const r = Math.max(sphere.radius, 15);
      radiusRef.current = r;
      const targetY = updatedBox.max.y * 0.45;
      controlsRef.current.target.set(0, targetY, 0);
      cameraRef.current.position.set(r * 1.9, targetY + r * 1.25, r * 1.9);
      cameraRef.current.updateProjectionMatrix();
      controlsRef.current.update();
    }
  }, [stlBase64, shadingMode]);

  // Sync toggles
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  useEffect(() => {
    if (bboxHelperRef.current) {
      bboxHelperRef.current.visible = showBbox;
    }
  }, [showBbox]);

  useEffect(() => {
    clipPlaneRef.current.constant = (clipPercent / 100) * maxHeightRef.current + 0.05;
  }, [clipPercent]);

  const setCameraView = (preset: 'iso' | 'front' | 'top' | 'right') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const r = radiusRef.current * 2.2;
    const cy = maxHeightRef.current * 0.45;
    controlsRef.current.target.set(0, cy, 0);
    if (preset === 'iso') {
      cameraRef.current.position.set(r * 0.85, cy + r * 0.65, r * 0.85);
    } else if (preset === 'front') {
      cameraRef.current.position.set(0, cy, r * 1.2);
    } else if (preset === 'top') {
      cameraRef.current.position.set(0, cy + r * 1.35, 0.01);
    } else if (preset === 'right') {
      cameraRef.current.position.set(r * 1.2, cy, 0);
    }
    cameraRef.current.updateProjectionMatrix();
    controlsRef.current.update();
  };

  return (
    <div className="viewer-wrapper">
      {/* Top Floating Viewport Toolbar */}
      <div className="viewer-toolbar">
        <div className="viewer-toolbar-group">
          <span className="toolbar-label">Shading</span>
          <button
            type="button"
            className={`toolbar-btn ${shadingMode === 'edges' ? 'active' : ''}`}
            onClick={() => setShadingMode('edges')}
            title="CAD Shaded with Feature & Tessellation Edges"
          >
            <Layers size={14} />
            <span>CAD + Edges</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${shadingMode === 'studio' ? 'active' : ''}`}
            onClick={() => setShadingMode('studio')}
            title="Smooth Metallic Studio Shading"
          >
            <Sparkles size={14} />
            <span>Studio</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${shadingMode === 'wireframe' ? 'active' : ''}`}
            onClick={() => setShadingMode('wireframe')}
            title="Pure STL Triangle Mesh Wireframe"
          >
            <Box size={14} />
            <span>Wireframe</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${shadingMode === 'normals' ? 'active' : ''}`}
            onClick={() => setShadingMode('normals')}
            title="Inspect Surface Normal Vectors"
          >
            <Compass size={14} />
            <span>Normals</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${shadingMode === 'xray' ? 'active' : ''}`}
            onClick={() => setShadingMode('xray')}
            title="X-Ray Translucent Internal Inspection"
          >
            <Eye size={14} />
            <span>X-Ray</span>
          </button>
        </div>

        <div className="viewer-toolbar-group">
          <span className="toolbar-label">Camera</span>
          <button type="button" className="toolbar-btn" onClick={() => setCameraView('iso')}>
            Iso
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setCameraView('front')}>
            Front
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setCameraView('top')}>
            Top
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setCameraView('right')}>
            Right
          </button>
        </div>

        <div className="viewer-toolbar-group">
          <button
            type="button"
            className={`toolbar-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid((v) => !v)}
            title="Toggle 10mm Build Plate Grid"
          >
            <Grid size={14} />
            <span>Grid</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${showBbox ? 'active' : ''}`}
            onClick={() => setShowBbox((v) => !v)}
            title="Toggle Bounding Box Envelope"
          >
            <Maximize2 size={14} />
            <span>Bounds</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${autoRotate ? 'active' : ''}`}
            onClick={() => setAutoRotate((v) => !v)}
            title="Toggle Turntable Auto-Rotation"
          >
            <RotateCcw size={14} />
            <span>Spin</span>
          </button>
        </div>
      </div>

      {/* Main Three.js Canvas Mount */}
      <div className="viewer-canvas" ref={mountRef} />

      {/* Bottom HUD Overlay: Part badge + Cross-section Z-slicer */}
      <div className="viewer-hud-bottom">
        <div className="viewer-part-badge">
          <span className="status-dot online" />
          <span className="mono">{partName}</span>
          {extents && (
            <span className="dim-pill mono">
              {extents[0]} × {extents[1]} × {extents[2]} mm
            </span>
          )}
        </div>

        <div className="slicer-control">
          <Scissors size={14} className="text-cyan" />
          <span className="toolbar-label">Z-Section Slice: {clipPercent}%</span>
          <input
            type="range"
            min={5}
            max={100}
            value={clipPercent}
            onChange={(e) => setClipPercent(Number(e.target.value))}
            aria-label="Z Cross-Section Slice Plane"
          />
          {clipPercent < 100 && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setClipPercent(100)}
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
