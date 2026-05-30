import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { 
  RotateCcw, AlertCircle
} from 'lucide-react';

interface Measurement {
  id: string;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  distance: number; // in mm
}

interface CADViewerProps {
  theme: 'light' | 'dark';
  modelType: string;
  uploadedFile: File | null;
  boundingRule: 'box' | 'cylinder';
  unit: 'mm' | 'in';
  onModelLoaded: (details: {
    volume: number; // mm^3
    surfaceArea: number; // mm^2
    boxDimensions: { x: number; y: number; z: number };
    cylinderDimensions: { radius: number; height: number; axis: 'x' | 'y' | 'z' };
    triangleCount: number;
  }) => void;
  isBlueprintMode: boolean;
  measureMode: boolean;
  setMeasureMode: (val: boolean) => void;
  measurements: Measurement[];
  setMeasurements: React.Dispatch<React.SetStateAction<Measurement[]>>;
}

export const CADViewer: React.FC<CADViewerProps> = ({
  theme,
  modelType,
  uploadedFile,
  boundingRule,
  unit,
  onModelLoaded,
  isBlueprintMode,
  measureMode,
  setMeasureMode,
  measurements,
  setMeasurements,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsContainerRef = useRef<HTMLDivElement>(null);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Lights & Helpers
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLight1Ref = useRef<THREE.DirectionalLight | null>(null);
  const dirLight2Ref = useRef<THREE.DirectionalLight | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);

  // CAD Mesh / Group References
  const modelGroupRef = useRef<THREE.Group>(new THREE.Group());
  const boundingMeshRef = useRef<THREE.Mesh | null>(null);
  const boundingEdgesRef = useRef<THREE.LineSegments | null>(null);

  // States
  const [activeModelData, setActiveModelData] = useState<THREE.BufferGeometry | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [currentModelName, setCurrentModelName] = useState<string>('');
  
  // Measurement Tool State
  const [firstMeasurePoint, setFirstMeasurePoint] = useState<THREE.Vector3 | null>(null);
  const [hoverMeasurePoint, setHoverMeasurePoint] = useState<THREE.Vector3 | null>(null);
  const [labelCoords, setLabelCoords] = useState<{ id: string; x: number; y: number; text: string }[]>([]);
  const [hoverLabelCoord, setHoverLabelCoord] = useState<{ x: number; y: number; text: string } | null>(null);

  // Initialize Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera (3D Perspective)
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(80, 80, 100);
    cameraRef.current = camera;

    // 3. Camera (2D Orthographic for Blueprints)
    const frustumSize = 120;
    const orthoCamera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    orthoCamera.position.set(0, 120, 0); // Default Top view
    orthoCamera.lookAt(0, 0, 0);
    orthoCameraRef.current = orthoCamera;

    // 4. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI; // Full rotation
    controlsRef.current = controls;

    // 6. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(100, 150, 50);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 500;
    const d = 100;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    scene.add(dirLight1);
    dirLight1Ref.current = dirLight1;

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.3); // cool fill light
    dirLight2.position.set(-100, -50, -100);
    scene.add(dirLight2);
    dirLight2Ref.current = dirLight2;

    // 7. Grid & Axes
    const gridHelper = new THREE.GridHelper(200, 50, 0x6366f1, 0x374151);
    gridHelper.position.y = -0.1; // slightly below z=0 plane
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    const axesHelper = new THREE.AxesHelper(30);
    // X axis - Red, Y axis - Green, Z axis - Blue
    scene.add(axesHelper);
    axesHelperRef.current = axesHelper;

    // Add model group
    scene.add(modelGroupRef.current);

    // 8. Render loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const activeCamera = isBlueprintMode ? orthoCameraRef.current : cameraRef.current;
      if (activeCamera && rendererRef.current && sceneRef.current) {
        if (!isBlueprintMode && controlsRef.current) {
          controlsRef.current.update();
        }
        rendererRef.current.render(sceneRef.current, activeCamera);
        updateLabelPositions();
      }
    };
    animate();

    // 9. Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current || !orthoCameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const aspect = w / h;

      cameraRef.current.aspect = aspect;
      cameraRef.current.updateProjectionMatrix();

      orthoCameraRef.current.left = (frustumSize * aspect) / -2;
      orthoCameraRef.current.right = (frustumSize * aspect) / 2;
      orthoCameraRef.current.top = frustumSize / 2;
      orthoCameraRef.current.bottom = frustumSize / -2;
      orthoCameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
    };
  }, [isBlueprintMode]);

  // Adjust theme lights and background colors
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (theme === 'dark') {
      scene.background = null; // transparent to inherit canvas styling or set clearColor
      if (rendererRef.current) {
        rendererRef.current.setClearColor(0x090c13, 1);
      }
      if (ambientLightRef.current) {
        ambientLightRef.current.color.setHex(0xffffff);
        ambientLightRef.current.intensity = 0.35;
      }
      if (dirLight1Ref.current) {
        dirLight1Ref.current.color.setHex(0xffffff);
        dirLight1Ref.current.intensity = 0.7;
      }
      if (dirLight2Ref.current) {
        dirLight2Ref.current.color.setHex(0x6366f1); // glowing indigo fill
        dirLight2Ref.current.intensity = 0.45;
      }
      if (gridHelperRef.current) {
        scene.remove(gridHelperRef.current);
        const gridHelper = new THREE.GridHelper(200, 50, 0x4f46e5, 0x1f2937);
        gridHelper.position.y = -0.1;
        scene.add(gridHelper);
        gridHelperRef.current = gridHelper;
      }
    } else {
      if (rendererRef.current) {
        rendererRef.current.setClearColor(0xe5e7eb, 1);
      }
      if (ambientLightRef.current) {
        ambientLightRef.current.color.setHex(0xffffff);
        ambientLightRef.current.intensity = 0.6;
      }
      if (dirLight1Ref.current) {
        dirLight1Ref.current.color.setHex(0xffffff);
        dirLight1Ref.current.intensity = 0.8;
      }
      if (dirLight2Ref.current) {
        dirLight2Ref.current.color.setHex(0xa5f3fc); // soft light blue fill
        dirLight2Ref.current.intensity = 0.25;
      }
      if (gridHelperRef.current) {
        scene.remove(gridHelperRef.current);
        const gridHelper = new THREE.GridHelper(200, 50, 0x9ca3af, 0xd1d5db);
        gridHelper.position.y = -0.1;
        scene.add(gridHelper);
        gridHelperRef.current = gridHelper;
      }
    }
  }, [theme]);

  // Load Model Geometry (built-in samples or upload)
  useEffect(() => {
    setModelLoading(true);
    setLoadingError(null);
    setMeasurements([]);
    setFirstMeasurePoint(null);
    setHoverMeasurePoint(null);

    // Clear previous model meshes inside group
    while (modelGroupRef.current.children.length > 0) {
      const child = modelGroupRef.current.children[0];
      modelGroupRef.current.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    if (uploadedFile) {
      // Parse uploaded STL file
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (!e.target?.result) throw new Error('File read empty');
          const loader = new STLLoader();
          const geometry = loader.parse(e.target.result as ArrayBuffer);
          setupCADModelMesh(geometry, uploadedFile.name);
        } catch (err: any) {
          console.error(err);
          setLoadingError(err.message || 'Failed to parse STL file');
          setModelLoading(false);
        }
      };
      reader.onerror = () => {
        setLoadingError('Error reading file');
        setModelLoading(false);
      };
      reader.readAsArrayBuffer(uploadedFile);
    } else {
      // Use built-in parametric sample shapes
      setCurrentModelName(modelType.toUpperCase());
      const geometry = generateSampleGeometry(modelType);
      setupCADModelMesh(geometry, modelType);
    }
  }, [modelType, uploadedFile]);

  // Setup Bounding Shapes Highlight
  useEffect(() => {
    if (!activeModelData || !sceneRef.current) return;
    drawBoundingOverlay();
  }, [activeModelData, boundingRule, boundingRule]);

  // Generate Sample Geometries
  const generateSampleGeometry = (type: string): THREE.BufferGeometry => {
    let meshGeometry: THREE.BufferGeometry;

    if (type === 'shaft') {
      // Stepped turning shaft: stack cylinder segments
      const group = new THREE.Group();

      const baseMat = new THREE.MeshStandardMaterial();
      
      const s1 = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 40, 32), baseMat);
      s1.position.y = 20;
      s1.castShadow = true;
      s1.receiveShadow = true;
      group.add(s1);

      const s2 = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 30, 32), baseMat);
      s2.position.y = 55;
      s2.castShadow = true;
      s2.receiveShadow = true;
      group.add(s2);

      const s3 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 20, 32), baseMat);
      s3.position.y = 80;
      s3.castShadow = true;
      s3.receiveShadow = true;
      group.add(s3);

      const s4 = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 10, 32), baseMat);
      s4.position.y = -5;
      s4.castShadow = true;
      s4.receiveShadow = true;
      group.add(s4);

      // Merge them into one BufferGeometry
      meshGeometry = mergeGroupGeometries(group);

    } else if (type === 'flange') {
      // Piping flange: disk with center cylinder bore and some satellite holes (represented as simple composite disk)
      const group = new THREE.Group();
      const baseMat = new THREE.MeshStandardMaterial();

      // Main disk
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(35, 35, 12, 48), baseMat);
      disk.castShadow = true;
      disk.receiveShadow = true;
      group.add(disk);

      // Center neck/hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 25, 48), baseMat);
      hub.position.y = 125/2 - 50; // offset a bit
      hub.position.y = 12.5; // flush top
      hub.castShadow = true;
      hub.receiveShadow = true;
      group.add(hub);

      // Let's merge them
      meshGeometry = mergeGroupGeometries(group);

    } else if (type === 'bracket') {
      // L-bracket: compose two boxes and a triangular rib
      const group = new THREE.Group();
      const baseMat = new THREE.MeshStandardMaterial();

      // Base plate
      const base = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 40), baseMat);
      base.position.set(0, 5, 0);
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      // Upright plate
      const upright = new THREE.Mesh(new THREE.BoxGeometry(10, 50, 40), baseMat);
      upright.position.set(-25, 25, 0);
      upright.castShadow = true;
      upright.receiveShadow = true;
      group.add(upright);

      // Support Rib (triangular shape)
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(40, 0);
      shape.lineTo(0, 40);
      shape.closePath();

      const extrudeSettings = { depth: 6, bevelEnabled: false };
      const ribGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      ribGeo.center(); // Center local coords
      const rib = new THREE.Mesh(ribGeo, baseMat);
      rib.position.set(-5, 30, 0);
      rib.rotation.y = Math.PI / 2; // align
      rib.castShadow = true;
      rib.receiveShadow = true;
      group.add(rib);

      meshGeometry = mergeGroupGeometries(group);

    } else {
      // Default: enclosure box
      const group = new THREE.Group();
      const baseMat = new THREE.MeshStandardMaterial();

      // Main box
      const body = new THREE.Mesh(new THREE.BoxGeometry(70, 35, 50), baseMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Mounting ears
      const ear1 = new THREE.Mesh(new THREE.BoxGeometry(15, 6, 25), baseMat);
      ear1.position.set(-42.5, -14.5, 0);
      ear1.castShadow = true;
      group.add(ear1);

      const ear2 = new THREE.Mesh(new THREE.BoxGeometry(15, 6, 25), baseMat);
      ear2.position.set(42.5, -14.5, 0);
      ear2.castShadow = true;
      group.add(ear2);

      meshGeometry = mergeGroupGeometries(group);
    }

    return meshGeometry;
  };

  // Merge geometries helper
  const mergeGroupGeometries = (group: THREE.Group): THREE.BufferGeometry => {
    const geometries: THREE.BufferGeometry[] = [];
    group.updateMatrixWorld(true);

    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const clonedGeom = child.geometry.clone();
        clonedGeom.applyMatrix4(child.matrixWorld);
        geometries.push(clonedGeom);
      }
    });

    if (geometries.length === 0) return new THREE.BufferGeometry();
    
    // Quick merge implementation (simple combination of buffers)
    // For our viewer, we can just merge attributes
    let totalVertices = 0;
    geometries.forEach((g) => {
      totalVertices += g.attributes.position.count;
    });

    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    
    let offset = 0;
    geometries.forEach((g) => {
      const posAttr = g.attributes.position;
      const normAttr = g.attributes.normal;
      
      for (let i = 0; i < posAttr.count; i++) {
        positions[offset * 3] = posAttr.getX(i);
        positions[offset * 3 + 1] = posAttr.getY(i);
        positions[offset * 3 + 2] = posAttr.getZ(i);

        if (normAttr) {
          normals[offset * 3] = normAttr.getX(i);
          normals[offset * 3 + 1] = normAttr.getY(i);
          normals[offset * 3 + 2] = normAttr.getZ(i);
        }
        offset++;
      }
      g.dispose();
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return merged;
  };

  // Configure loaded Mesh
  const setupCADModelMesh = (geometry: THREE.BufferGeometry, name: string) => {
    setCurrentModelName(name);
    
    // Compute normals if not present
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // Center model at origin
    geometry.center();

    // Material with high metallic finish for nice aesthetics
    const material = new THREE.MeshStandardMaterial({
      color: theme === 'dark' ? 0x94a3b8 : 0x475569,
      roughness: 0.15,
      metalness: 0.8,
      side: THREE.DoubleSide,
      wireframe: isBlueprintMode,
    });

    // Create Mesh
    const mainMesh = new THREE.Mesh(geometry, material);
    mainMesh.name = 'cad-mesh';
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    modelGroupRef.current.add(mainMesh);

    setActiveModelData(geometry);

    // Calculate metadata
    calculateCADMetrics(geometry);

    // Auto-fit camera
    fitCameraToModel();

    setModelLoading(false);
  };

  // Adjust Camera Position to encapsulate the loaded geometry
  const fitCameraToModel = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(modelGroupRef.current);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    // Zoom out slightly more
    cameraZ *= 1.8;

    camera.position.set(cameraZ * 0.8, cameraZ * 0.8, cameraZ);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();

    if (orthoCameraRef.current) {
      const aspect = containerRef.current!.clientWidth / containerRef.current!.clientHeight;
      const sizeFact = maxDim * 1.5;
      orthoCameraRef.current.left = (sizeFact * aspect) / -2;
      orthoCameraRef.current.right = (sizeFact * aspect) / 2;
      orthoCameraRef.current.top = sizeFact / 2;
      orthoCameraRef.current.bottom = sizeFact / -2;
      orthoCameraRef.current.position.set(0, maxDim * 1.5, 0); // look from top
      orthoCameraRef.current.lookAt(0, 0, 0);
      orthoCameraRef.current.updateProjectionMatrix();
    }
  };

  // Quick Orientation Camera Snaps
  const snapCamera = (orientation: string) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !activeModelData) return;

    const box = new THREE.Box3().setFromObject(modelGroupRef.current);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 1.8;

    // Linear transitions can be interpolated.
    // For immediate snap with cool damping effect:
    let targetPos = new THREE.Vector3();
    switch (orientation) {
      case 'front': targetPos.set(0, 0, dist); break;
      case 'back': targetPos.set(0, 0, -dist); break;
      case 'top': targetPos.set(0, dist, 0); break;
      case 'bottom': targetPos.set(0, -dist, 0); break;
      case 'left': targetPos.set(-dist, 0, 0); break;
      case 'right': targetPos.set(dist, 0, 0); break;
      case 'iso': default: targetPos.set(dist * 0.7, dist * 0.7, dist * 0.7); break;
    }

    // Set camera coordinates and look at center
    camera.position.copy(targetPos);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  // Calculate Volume, Surface Area, Bounding details
  const calculateCADMetrics = (geometry: THREE.BufferGeometry) => {
    const position = geometry.attributes.position;
    if (!position) return;

    let volume = 0;
    let surfaceArea = 0;
    const triangleCount = position.count / 3;

    // Bounding Box
    const bbox = geometry.boundingBox!;
    const boxDimensions = {
      x: bbox.max.x - bbox.min.x,
      y: bbox.max.y - bbox.min.y,
      z: bbox.max.z - bbox.min.z,
    };

    // Calculate Volume and Surface Area using Mesh Triangles
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();

    for (let i = 0; i < position.count; i += 3) {
      vA.fromBufferAttribute(position, i);
      vB.fromBufferAttribute(position, i + 1);
      vC.fromBufferAttribute(position, i + 2);

      // Volume of tetrahedron anchored to origin
      const tetraVolume = vA.dot(vB.cross(vC)) / 6.0;
      volume += tetraVolume;

      // Triangle surface area
      const ab = new THREE.Vector3().subVectors(vB, vA);
      const ac = new THREE.Vector3().subVectors(vC, vA);
      const crossProduct = new THREE.Vector3().crossVectors(ab, ac);
      surfaceArea += crossProduct.length() / 2.0;
    }

    volume = Math.abs(volume);

    // Bounding Cylinder fitting along standard axes
    // We iterate X, Y, Z to find the axis that yields the minimum enclosing cylinder volume
    const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
    let bestAxis: 'x' | 'y' | 'z' = 'y';
    let bestRadius = 9999;
    let bestHeight = 9999;
    let minCylinderVolume = Infinity;

    for (const axis of axes) {
      let height = boxDimensions[axis];
      let maxRadiusSq = 0;

      for (let i = 0; i < position.count; i++) {
        vA.fromBufferAttribute(position, i);
        let rSq = 0;
        if (axis === 'x') rSq = vA.y * vA.y + vA.z * vA.z;
        else if (axis === 'y') rSq = vA.x * vA.x + vA.z * vA.z;
        else rSq = vA.x * vA.x + vA.y * vA.y;

        if (rSq > maxRadiusSq) maxRadiusSq = rSq;
      }

      const radius = Math.sqrt(maxRadiusSq);
      const cylVol = Math.PI * maxRadiusSq * height;

      if (cylVol < minCylinderVolume) {
        minCylinderVolume = cylVol;
        bestAxis = axis;
        bestRadius = radius;
        bestHeight = height;
      }
    }

    onModelLoaded({
      volume,
      surfaceArea,
      boxDimensions,
      cylinderDimensions: {
        radius: bestRadius,
        height: bestHeight,
        axis: bestAxis,
      },
      triangleCount,
    });
  };

  // Draw Box or Cylinder Bounding Overlay
  const drawBoundingOverlay = () => {
    const scene = sceneRef.current;
    if (!scene || !activeModelData) return;

    // Remove previous bounding meshes
    if (boundingMeshRef.current) scene.remove(boundingMeshRef.current);
    if (boundingEdgesRef.current) scene.remove(boundingEdgesRef.current);

    const bbox = activeModelData.boundingBox!;
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    // semi-transparent light yellow color: color: 0xffff99, opacity: 0.2
    const boundingMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a, // light yellow
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevents depth fighting/clipping lines
    });

    const borderMat = new THREE.LineBasicMaterial({
      color: 0xeab308, // dark yellow border
      transparent: true,
      opacity: 0.6,
    });

    if (boundingRule === 'box') {
      const boxGeo = new THREE.BoxGeometry(size.x + 1, size.y + 1, size.z + 1); // add minor clearance
      const boxMesh = new THREE.Mesh(boxGeo, boundingMat);
      boxMesh.position.copy(center);
      
      const edges = new THREE.EdgesGeometry(boxGeo);
      const line = new THREE.LineSegments(edges, borderMat);
      line.position.copy(center);

      scene.add(boxMesh);
      scene.add(line);
      boundingMeshRef.current = boxMesh;
      boundingEdgesRef.current = line;
    } else {
      // Cylinder fitting.
      // Re-run the geometry axis solver to position the yellow overlay correctly.
      const position = activeModelData.attributes.position;
      const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
      let bestAxis: 'x' | 'y' | 'z' = 'y';
      let bestRadius = 0;
      let minCylinderVolume = Infinity;

      const v = new THREE.Vector3();
      for (const axis of axes) {
        let height = size[axis];
        let maxRadiusSq = 0;

        for (let i = 0; i < position.count; i++) {
          v.fromBufferAttribute(position, i);
          let rSq = 0;
          if (axis === 'x') rSq = v.y * v.y + v.z * v.z;
          else if (axis === 'y') rSq = v.x * v.x + v.z * v.z;
          else rSq = v.x * v.x + v.y * v.y;

          if (rSq > maxRadiusSq) maxRadiusSq = rSq;
        }

        const cylVol = Math.PI * maxRadiusSq * height;
        if (cylVol < minCylinderVolume) {
          minCylinderVolume = cylVol;
          bestAxis = axis;
          bestRadius = Math.sqrt(maxRadiusSq);
        }
      }

      const cylHeight = size[bestAxis] + 1; // clearance
      const cylRadius = bestRadius + 0.5;

      const cylGeo = new THREE.CylinderGeometry(cylRadius, cylRadius, cylHeight, 32);
      
      const cylMesh = new THREE.Mesh(cylGeo, boundingMat);
      cylMesh.position.copy(center);

      // Rotate cylinder to match solver axis (Default cylinder geometry extends along Y)
      if (bestAxis === 'x') {
        cylMesh.rotation.z = Math.PI / 2;
      } else if (bestAxis === 'z') {
        cylMesh.rotation.x = Math.PI / 2;
      }

      const edges = new THREE.EdgesGeometry(cylGeo);
      const line = new THREE.LineSegments(edges, borderMat);
      line.position.copy(center);
      line.rotation.copy(cylMesh.rotation);

      scene.add(cylMesh);
      scene.add(line);
      boundingMeshRef.current = cylMesh;
      boundingEdgesRef.current = line;
    }
  };

  // Interactive Click-to-Measure Tool Raycast click handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!measureMode || !sceneRef.current || !cameraRef.current || !canvasRef.current) return;

    // Get normalized device coordinates
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    const currentCamera = isBlueprintMode ? orthoCameraRef.current! : cameraRef.current;
    raycaster.setFromCamera(new THREE.Vector2(x, y), currentCamera);

    // Intersect with model group
    const intersects = raycaster.intersectObjects(modelGroupRef.current.children, true);

    if (intersects.length > 0) {
      const hitPoint = intersects[0].point;

      if (!firstMeasurePoint) {
        setFirstMeasurePoint(hitPoint.clone());
      } else {
        // Complete the measurement
        const distance = firstMeasurePoint.distanceTo(hitPoint);
        const newMeasure: Measurement = {
          id: Math.random().toString(36).substr(2, 9),
          p1: firstMeasurePoint,
          p2: hitPoint.clone(),
          distance,
        };

        setMeasurements(prev => [...prev, newMeasure]);
        setFirstMeasurePoint(null);
        setHoverMeasurePoint(null);
        setMeasureMode(false); // turn off measure mode
      }
    }
  };

  // Handle pointer hover during measurement
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!measureMode || !firstMeasurePoint || !sceneRef.current || !cameraRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    const currentCamera = isBlueprintMode ? orthoCameraRef.current! : cameraRef.current;
    raycaster.setFromCamera(new THREE.Vector2(x, y), currentCamera);

    const intersects = raycaster.intersectObjects(modelGroupRef.current.children, true);
    if (intersects.length > 0) {
      setHoverMeasurePoint(intersects[0].point.clone());
    } else {
      setHoverMeasurePoint(null);
    }
  };

  // Project 3D coordinate to HTML layer coordinate
  const project3DTo2D = (vector: THREE.Vector3) => {
    if (!cameraRef.current || !rendererRef.current || !containerRef.current) return { x: 0, y: 0 };
    
    const activeCamera = isBlueprintMode ? orthoCameraRef.current! : cameraRef.current;
    const vec = vector.clone().project(activeCamera);
    
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    return {
      x: (vec.x * .5 + .5) * w,
      y: (-(vec.y * .5) + .5) * h,
    };
  };

  // Convert distance number based on active units
  const formatDistance = (distMm: number) => {
    if (unit === 'in') {
      return `${(distMm / 25.4).toFixed(3)}"`;
    }
    return `${distMm.toFixed(1)} mm`;
  };

  // Project measurements to HTML overlay layer
  const updateLabelPositions = () => {
    // 1. Hover label
    if (firstMeasurePoint && hoverMeasurePoint) {
      const coords = project3DTo2D(firstMeasurePoint.clone().add(hoverMeasurePoint).multiplyScalar(0.5));
      const dist = firstMeasurePoint.distanceTo(hoverMeasurePoint);
      setHoverLabelCoord({
        x: coords.x,
        y: coords.y,
        text: formatDistance(dist),
      });
    } else {
      setHoverLabelCoord(null);
    }

    // 2. Static labels
    const staticCoords = measurements.map((m) => {
      const midPoint = m.p1.clone().add(m.p2).multiplyScalar(0.5);
      const coords = project3DTo2D(midPoint);
      return {
        id: m.id,
        x: coords.x,
        y: coords.y,
        text: formatDistance(m.distance),
      };
    });
    setLabelCoords(staticCoords);
  };

  // Render HTML markup lines for interactive overlays
  // (We draw them in SVG or CSS lines mapped on absolute viewport container)
  const renderSVGMeasurements = () => {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        {/* Draw active measurement draft */}
        {firstMeasurePoint && hoverMeasurePoint && (() => {
          const pt1 = project3DTo2D(firstMeasurePoint);
          const pt2 = project3DTo2D(hoverMeasurePoint);
          return (
            <g>
              <circle cx={pt1.x} cy={pt1.y} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
              <circle cx={pt2.x} cy={pt2.y} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
              <line 
                x1={pt1.x} y1={pt1.y} 
                x2={pt2.x} y2={pt2.y} 
                stroke="#ef4444" 
                strokeWidth="2" 
                strokeDasharray="4,4" 
              />
            </g>
          );
        })()}

        {/* Draw established measurements */}
        {measurements.map((m) => {
          const pt1 = project3DTo2D(m.p1);
          const pt2 = project3DTo2D(m.p2);
          return (
            <g key={m.id}>
              <circle cx={pt1.x} cy={pt1.y} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
              <circle cx={pt2.x} cy={pt2.y} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
              <line 
                x1={pt1.x} y1={pt1.y} 
                x2={pt2.x} y2={pt2.y} 
                stroke="#ef4444" 
                strokeWidth="2" 
              />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className={`viewport-container ${isBlueprintMode ? 'blueprint-mode-active' : ''}`} ref={containerRef}>
      
      {/* 3D Canvas */}
      <canvas 
        ref={canvasRef} 
        className="viewport-canvas"
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        style={{ cursor: measureMode ? 'crosshair' : 'grab' }}
      />

      {/* SVG overlay line drawings */}
      {renderSVGMeasurements()}

      {/* HTML absolute overlays labels */}
      <div ref={labelsContainerRef} className="absolute inset-0 pointer-events-none z-10" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        {/* Hover Label */}
        {hoverLabelCoord && (
          <div 
            style={{ 
              position: 'absolute', 
              left: `${hoverLabelCoord.x}px`, 
              top: `${hoverLabelCoord.y}px`, 
              transform: 'translate(-50%, -100%) translateY(-10px)',
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
              pointerEvents: 'none'
            }}
          >
            {hoverLabelCoord.text}
          </div>
        )}

        {/* Established Labels */}
        {labelCoords.map((coord) => (
          <div 
            key={coord.id}
            style={{ 
              position: 'absolute', 
              left: `${coord.x}px`, 
              top: `${coord.y}px`, 
              transform: 'translate(-50%, -100%) translateY(-8px)',
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
              pointerEvents: 'none'
            }}
          >
            {coord.text}
          </div>
        ))}
      </div>

      {/* Blueprint technical border overlay */}
      {isBlueprintMode && (
        <div className="blueprint-frame">
          <div className="blueprint-grid-labels">
            <span>A</span><span>B</span><span>C</span><span>D</span><span>E</span><span>F</span>
          </div>
          <div className="blueprint-border"></div>
          <div className="blueprint-title-block">
            <div className="blueprint-title-row">
              <span style={{ fontWeight: 'bold' }}>PROJECT TITLE:</span>
              <span className="blueprint-title">CAD VIEWER SUITE</span>
            </div>
            <div className="blueprint-title-row">
              <span>PART NAME: {currentModelName.toUpperCase()}</span>
              <span>SCALE: 1:1</span>
            </div>
            <div className="blueprint-title-row">
              <span>UNIT: {unit === 'mm' ? 'METRIC (mm)' : 'IMPERIAL (in)'}</span>
              <span>REV: A0</span>
            </div>
            <div className="blueprint-title-row">
              <span>DATE: {new Date().toLocaleDateString()}</span>
              <span>SHEET: 1 OF 1</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating orientation widget (Compass) */}
      {!isBlueprintMode && (
        <div className="orientation-gizmo">
          <div className="gizmo-title">Orientation</div>
          <div className="gizmo-grid">
            <button className="gizmo-btn" onClick={() => snapCamera('iso')} title="Isometric">ISO</button>
            <button className="gizmo-btn" onClick={() => snapCamera('top')} title="Top View">TOP</button>
            <button className="gizmo-btn" onClick={() => snapCamera('bottom')} title="Bottom View">BOT</button>
            <button className="gizmo-btn" onClick={() => snapCamera('front')} title="Front View">FRN</button>
            <button className="gizmo-btn" onClick={() => snapCamera('back')} title="Back View">BCK</button>
            <button className="gizmo-btn" onClick={() => snapCamera('left')} title="Left View">LFT</button>
            <button className="gizmo-btn" onClick={() => snapCamera('right')} title="Right View">RGT</button>
            <button className="gizmo-btn" onClick={() => fitCameraToModel()} title="Center View">
              <RotateCcw size={10} />
            </button>
          </div>
        </div>
      )}

      {/* Tool loading spinner */}
      {modelLoading && (
        <div 
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                borderTopColor: '#6366f1',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px auto'
              }}
            />
            Loading CAD Model...
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Error state */}
      {loadingError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 text-white" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 20 }}>
          <div className="text-center p-6 bg-red-950/40 rounded-xl border border-red-500/30 max-w-md" style={{ textAlign: 'center', padding: '24px', backgroundColor: 'rgba(28, 10, 10, 0.75)', border: '1px solid #ef4444', borderRadius: '12px', maxWidth: '380px' }}>
            <AlertCircle size={32} className="mx-auto text-red-500 mb-3" style={{ margin: '0 auto 12px auto', color: '#ef4444' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#ef4444', marginBottom: '8px' }}>File Load Failure</h4>
            <p style={{ fontSize: '12px', color: '#fca5a5', lineHeight: '1.4' }}>{loadingError}</p>
          </div>
        </div>
      )}

      {/* Measure Tool floating banner instruction */}
      {measureMode && (
        <div className="measure-instructions">
          <div className="measure-dot" />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px' }}>
              {firstMeasurePoint ? 'Select Second Measure Point' : 'Select Initial Measure Point'}
            </strong>
            <span style={{ color: 'var(--text-secondary)' }}>
              Click on any face or edge of the 3D model geometry.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
