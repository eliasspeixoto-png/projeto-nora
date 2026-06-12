'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Maximize2, X, RotateCw } from 'lucide-react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FloorPlan, Camera as CftvCamera, Element as CftvElement, Wall } from '@/lib/cftv-types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Camera3DPreviewProps {
  camera: CftvCamera;
  floorPlan: FloorPlan;
  width?: number;
  height?: number;
}

const Camera3DPreview: React.FC<Camera3DPreviewProps> = ({ 
  camera, 
  floorPlan, 
  width = 320, 
  height = 180 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const threeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [isFullScreen, setIsFullScreen] = React.useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Reset container
    containerRef.current.innerHTML = '';

    // Initialize Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffffff');
    scene.fog = new THREE.FogExp2('#ffffff', 0.005);
    sceneRef.current = scene;

    // Initialize Camera
    // Focal length simulation: FOV varies with sensor and focal length
    // For simplicity, we use a default FOV based on camera.horizontalAngle
    const fov = camera.verticalAngle || 60; 
    const aspect = width / height;
    const threeCamera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    threeCameraRef.current = threeCamera;

    // Initialize Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: '#ffffff', 
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid Helper
    const grid = new THREE.GridHelper(100, 100, 0xcccccc, 0xeeeeee);
    grid.position.y = 0.01;
    scene.add(grid);

    // Render Function
    const animate = () => {
      if (!renderer || !scene || !threeCamera) return;
      requestAnimationFrame(animate);
      renderer.render(scene, threeCamera);
    };
    animate();

    return () => {
      renderer.dispose();
    };
  }, [width, height, camera.id]); // Re-init on camera change or resize

  useEffect(() => {
    const scene = sceneRef.current;
    const threeCamera = threeCameraRef.current;
    if (!scene || !threeCamera) return;

    // Clear previous objects (except lights and ground)
    const objectsToRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.name === 'dynamic-obj') objectsToRemove.push(obj);
    });
    const textureLoader = new THREE.TextureLoader();
    const sofaTexture = textureLoader.load('/assets/3d/sofa.png');
    const toiletTexture = textureLoader.load('/assets/3d/toilet.png');
    
    // Soft Contact Shadow Texture
    const createContactShadowTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) return null;
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(0,0,0,0.4)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(canvas);
    };
    const shadowTexture = createContactShadowTexture();

    objectsToRemove.forEach(obj => scene.remove(obj));

    const scale = floorPlan.scale || 50; // pixels per meter

    // Update Camera Position and Rotation
    // Map units: pixels to meters
    threeCamera.position.set(camera.x / scale, camera.z, camera.y / scale);
    
    // Rotation mapping:
    // camera.rotation 0 in UI is facing South (down)
    // In Three.js, rotation.y 0 is facing towards Z+ (back)
    const rotY = -camera.rotation * Math.PI / 180;
    const rotX = camera.tilt * Math.PI / 180;
    
    threeCamera.rotation.order = 'YXZ';
    threeCamera.rotation.set(rotX, rotY, 0);

    // Render Walls
    floorPlan.walls.forEach((wall: Wall) => {
      const dx = (wall.x2 - wall.x1);
      const dy = (wall.y2 - wall.y1);
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const height = wall.height || 2.8;

      const wallGeom = new THREE.BoxGeometry(length / scale, height, 0.15); 
      const wallMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1' });
      const wallMesh = new THREE.Mesh(wallGeom, wallMat);
      
      wallMesh.position.set(
        ((wall.x1 + wall.x2) / (2 * scale)), 
        height / 2, 
        ((wall.y1 + wall.y2) / (2 * scale))
      );
      wallMesh.rotation.y = -angle;
      wallMesh.name = 'dynamic-obj';
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      scene.add(wallMesh);
    });

    // Render Elements
    floorPlan.elements.forEach((el: CftvElement) => {
      if (el.type === 'text') return;
      const h = el.height || 1.5;
      const elColor = el.color || '#94a3b8';
      const elGroup = new THREE.Group();

      // Adding Contact Shadow
      const sw = (el.width || 100) / scale;
      const sd = (el.depth || 100) / scale;

      if (shadowTexture) {
        const shadowGeom = new THREE.PlaneGeometry(sw, sd);
        const shadowMat = new THREE.MeshBasicMaterial({ 
          map: shadowTexture, 
          transparent: true, 
          depthWrite: false,
          opacity: 0.5 
        });
        const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.02; // Just above ground
        shadowMesh.scale.set(1.5, 1.5, 1);
        elGroup.add(shadowMesh);
      }
      
      const matParams = { color: elColor, roughness: 0.3, metalness: 0.1 };

      if (el.type === 'furniture' && el.subtype === 'sofa') {
        const sh = h * 0.8;
        const seatGeom = new THREE.BoxGeometry(sw, sh * 0.4, sd);
        const seatMesh = new THREE.Mesh(seatGeom, new THREE.MeshStandardMaterial({ map: sofaTexture, ...matParams }));
        seatMesh.position.y = (sh * 0.4) / 2;
        elGroup.add(seatMesh);
        const backGeom = new THREE.BoxGeometry(sw, sh * 0.6, sd * 0.2);
        const backMesh = new THREE.Mesh(backGeom, new THREE.MeshStandardMaterial(matParams));
        backMesh.position.set(0, (sh * 0.4) + (sh * 0.6) / 2, -sd * 0.4);
        elGroup.add(backMesh);
        const armGeom = new THREE.BoxGeometry(sw * 0.15, sh * 0.25, sd * 0.9);
        [[-sw * 0.42, 0.05], [sw * 0.42, 0.05]].forEach(([x, z]) => {
          const armMesh = new THREE.Mesh(armGeom, new THREE.MeshStandardMaterial(matParams));
          armMesh.position.set(x, (sh * 0.4) + (sh * 0.25) / 2, z);
          elGroup.add(armMesh);
        });
      } else if (el.type === 'bathroom' && el.subtype === 'toilet') {
        const tw = sw * 0.45;
        const td = sd * 0.65;
        const th = h * 0.4;
        const toiletMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.05 });
        const bowlGeom = new THREE.CylinderGeometry(tw * 0.45, tw * 0.35, th, 16);
        const bowlMesh = new THREE.Mesh(bowlGeom, toiletMat);
        bowlMesh.position.y = th / 2;
        elGroup.add(bowlMesh);
        const lidGeom = new THREE.BoxGeometry(tw * 0.85, 0.04, td * 0.75);
        const lidMesh = new THREE.Mesh(lidGeom, new THREE.MeshStandardMaterial({ map: toiletTexture, roughness: 0.2 }));
        lidMesh.position.set(0, th, 0.05);
        elGroup.add(lidMesh);
        const tankGeom = new THREE.BoxGeometry(tw * 0.9, th * 1.2, td * 0.25);
        const tankMesh = new THREE.Mesh(tankGeom, toiletMat);
        tankMesh.position.set(0, (th * 1.2) / 2 + 0.05, -td * 0.35);
        elGroup.add(tankMesh);
      } else if (el.type === 'person') {
        const bodyGeom = new THREE.CapsuleGeometry(0.2, h - 0.4, 4, 8);
        const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: elColor }));
        bodyMesh.position.y = h / 2;
        elGroup.add(bodyMesh);

        const headGeom = new THREE.SphereGeometry(0.15, 12, 12);
        const headMesh = new THREE.Mesh(headGeom, new THREE.MeshStandardMaterial({ color: elColor }));
        headMesh.position.y = h - 0.15;
        elGroup.add(headMesh);
      } else if (el.type === 'vehicle' || el.subtype === 'car' || el.subtype === 'truck') {
        const bodyGeom = new THREE.BoxGeometry(sw, h * 0.7, sd);
        const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: elColor }));
        bodyMesh.position.y = (h * 0.7) / 2 + 0.2;
        elGroup.add(bodyMesh);

        const cabinGeom = new THREE.BoxGeometry(sw * 0.6, h * 0.4, sd * 0.8);
        const cabinMesh = new THREE.Mesh(cabinGeom, new THREE.MeshStandardMaterial({ color: elColor, opacity: 0.8, transparent: true }));
        cabinMesh.position.y = h * 0.7 + (h * 0.4) / 2;
        elGroup.add(cabinMesh);
        
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          const wheelGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12);
          wheelGeom.rotateZ(Math.PI / 2);
          const wheelMesh = new THREE.Mesh(wheelGeom, new THREE.MeshStandardMaterial({ color: '#111827' }));
          wheelMesh.position.set(sx * sw * 0.35, 0.2, sz * sd * 0.35);
          elGroup.add(wheelMesh);
        });
      } else {
        const geom = new THREE.BoxGeometry(sw, h, sd);
        const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: elColor }));
        mesh.position.y = h / 2;
        elGroup.add(mesh);
      }

      elGroup.position.set(el.x / scale, 0, el.y / scale);
      elGroup.rotation.y = -(el.rotation || 0) * Math.PI / 180;
      elGroup.name = 'dynamic-obj';
      elGroup.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      scene.add(elGroup);
    });

    // Render Camera Model (Self)
    const camGroup = new THREE.Group();
    const bodyColor = '#f8fafc';
    const lensColor = '#1e293b';

    if (camera.type === 'bullet') {
      const bodyGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 16);
      bodyGeom.rotateX(Math.PI / 2);
      camGroup.add(new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: bodyColor })));
      const lensGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
      lensGeom.rotateX(Math.PI / 2);
      lensGeom.translate(0, 0, 0.3);
      camGroup.add(new THREE.Mesh(lensGeom, new THREE.MeshStandardMaterial({ color: lensColor })));
      const mountGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.2, 8);
      mountGeom.translate(0, -0.2, -0.1);
      camGroup.add(new THREE.Mesh(mountGeom, new THREE.MeshStandardMaterial({ color: bodyColor })));
    } else {
      const bodyGeom = new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      camGroup.add(new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: bodyColor })));
      const coverGeom = new THREE.SphereGeometry(0.2, 16, 16);
      coverGeom.translate(0, 0.05, 0);
      camGroup.add(new THREE.Mesh(coverGeom, new THREE.MeshStandardMaterial({ color: lensColor, transparent: true, opacity: 0.8 })));
    }
    camGroup.position.set(camera.x / scale, camera.z, camera.y / scale);
    camGroup.rotation.order = 'YXZ';
    camGroup.rotation.set(rotX, rotY, 0);
    camGroup.name = 'dynamic-obj';
    scene.add(camGroup);

    // Render FOV Cone in 3D (Improved Pyramidal)
    const fovRadius = camera.dori || 20;
    const hAngleRad = camera.horizontalAngle * Math.PI / 180;
    
    const fovGeom = new THREE.ConeGeometry(
        fovRadius * Math.tan(hAngleRad / 2), 
        fovRadius, 
        32, 1, true
    );
    // Align cone forward axis to +Z and move apex to origin
    fovGeom.rotateX(-Math.PI / 2);
    fovGeom.translate(0, 0, fovRadius / 2);
    
    const fovMat = new THREE.MeshStandardMaterial({ 
        color: camera.fovColor || '#3b82f6',
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
        emissive: camera.fovColor || '#3b82f6',
        emissiveIntensity: 0.2
    });
    const fovMesh = new THREE.Mesh(fovGeom, fovMat);
    fovMesh.position.set(camera.x / scale, camera.z, camera.y / scale);
    fovMesh.rotation.order = 'YXZ';
    fovMesh.rotation.set(rotX, rotY, 0);
    
    fovMesh.name = 'dynamic-obj';
    scene.add(fovMesh);

  }, [floorPlan, camera.x, camera.y, camera.z, camera.rotation, camera.tilt, camera.fovColor, camera.horizontalAngle, camera.verticalAngle, camera.dori]);

  // Calculate target distance for overlay
  const targetDistance = useMemo(() => {
    const tiltRad = Math.abs(camera.tilt) * Math.PI / 180;
    if (tiltRad < 0.05) return '∞';
    const dist = camera.z / Math.tan(tiltRad);
    return `${dist.toFixed(1)}m`;
  }, [camera.z, camera.tilt]);

  return (
    <div 
      className="relative rounded-lg overflow-hidden border border-border bg-slate-100 shadow-inner group cursor-pointer"
      onClick={() => setIsFullScreen(true)}
    >
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
        <span className="text-white text-[10px] font-medium bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/20">
            Clique para ampliar 3D
        </span>
      </div>
      <div className="absolute inset-0 pointer-events-none border-[12px] border-black/10 border-double mix-blend-overlay opacity-20" />
      <div className="absolute top-2 left-2 flex flex-col gap-0.5 pointer-events-none">
        <div className="bg-black/60 text-emerald-400 text-[10px] px-2 py-0.5 rounded backdrop-blur-sm font-mono flex items-center gap-1.5 border border-emerald-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LIVE: {camera.name}
        </div>
        <div className="bg-black/40 text-white/70 text-[8px] px-1.5 py-0.5 rounded backdrop-blur-sm font-mono lowercase flex justify-between gap-4">
          <span>{camera.resolution} · {camera.lensType} · {camera.sensorSize || '1/2.8"'}</span>
          <span className="text-emerald-400">TGT: {targetDistance}</span>
        </div>
      </div>
      
      {/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/20 pointer-events-none" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/20 pointer-events-none" />
      
      {/* Reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-4 h-0.5 bg-white/20" />
        <div className="w-0.5 h-4 bg-white/20" />
      </div>

      {/* Maximize Button */}
      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogTrigger asChild>
          <button 
            className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-md backdrop-blur-sm transition-colors border border-white/10"
            title="Expandir Visualização 3D"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[90vw] w-full max-h-[90vh] h-[80vh] p-0 overflow-hidden bg-slate-950 border-slate-800">
          <DialogHeader className="absolute top-4 left-4 z-50 pointer-events-none">
            <DialogTitle className="text-white text-sm font-mono flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SIMULAÇÃO 3D PROFISSIONAL: {camera.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="w-full h-full relative">
            <Camera3DPreviewInternal 
              camera={camera} 
              floorPlan={floorPlan} 
              width={window.innerWidth * 0.85} 
              height={window.innerHeight * 0.75} 
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Internal component for the 3D scene to allow multiple instances or resizing
const Camera3DPreviewInternal: React.FC<Camera3DPreviewProps> = ({ 
    camera, 
    floorPlan, 
    width = 320, 
    height = 180 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const threeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#ffffff');
        scene.fog = new THREE.FogExp2('#ffffff', 0.005);
        sceneRef.current = scene;

        const fov = camera.verticalAngle || 60; 
        const aspect = width / height;
        const threeCamera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
        threeCameraRef.current = threeCamera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        
        const controls = new OrbitControls(threeCamera, renderer.domElement);
        controls.enableDamping = true;
        controlsRef.current = controls;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(2048, 2048);
        scene.add(dirLight);

        const groundGeom = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const grid = new THREE.GridHelper(200, 200, 0xcccccc, 0xeeeeee);
        grid.position.y = 0.01;
        scene.add(grid);

        const animate = () => {
          if (!rendererRef.current || !sceneRef.current || !threeCameraRef.current) return;
          if (controlsRef.current) controlsRef.current.update();
          rendererRef.current.render(sceneRef.current, threeCameraRef.current);
          requestAnimationFrame(animate);
        };
        animate();

        return () => {
            renderer.dispose();
        };
    }, [width, height, camera.id]);

    useEffect(() => {
        const scene = sceneRef.current;
        const threeCamera = threeCameraRef.current;
        if (!scene || !threeCamera) return;

        scene.children.filter(c => c.name === 'dynamic-obj').forEach(c => scene.remove(c));
        
        const textureLoader = new THREE.TextureLoader();
        const sofaTexture = textureLoader.load('/assets/3d/sofa.png');
        const toiletTexture = textureLoader.load('/assets/3d/toilet.png');

        // Soft Contact Shadow Texture
        const createContactShadowTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext('2d');
            if (!context) return null;
            const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(0,0,0,0.4)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(canvas);
        };
        const shadowTexture = createContactShadowTexture();

        const scale = floorPlan.scale || 50;
        threeCamera.position.set(camera.x / scale, camera.z, camera.y / scale);
        const rotY = -camera.rotation * Math.PI / 180;
        const rotX = -camera.tilt * Math.PI / 180;
        threeCamera.rotation.order = 'YXZ';
        threeCamera.rotation.set(rotX, rotY, 0);

        floorPlan.walls.forEach((wall: Wall) => {
            const dx = (wall.x2 - wall.x1);
            const dy = (wall.y2 - wall.y1);
            const length = Math.sqrt(dx * dx + dy * dy);
            const wallGeom = new THREE.BoxGeometry(length / scale, wall.height || 2.8, 0.15);
            const wallMesh = new THREE.Mesh(wallGeom, new THREE.MeshStandardMaterial({ color: '#4b5563' }));
            wallMesh.position.set(((wall.x1 + wall.x2) / (2 * scale)), (wall.height || 2.8) / 2, ((wall.y1 + wall.y2) / (2 * scale)));
            wallMesh.rotation.y = -Math.atan2(dy, dx);
            wallMesh.name = 'dynamic-obj';
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            scene.add(wallMesh);
        });

        floorPlan.elements.forEach((el: CftvElement) => {
            if (el.type === 'text') return;
            const h = el.height || 1.5;
            const elColor = el.color || '#64748b';
            const elGroup = new THREE.Group();

            // Adding Contact Shadow
            const sw = (el.width || 100) / scale;
            const sd = (el.depth || 100) / scale;

            if (shadowTexture) {
                const shadowGeom = new THREE.PlaneGeometry(sw, sd);
                const shadowMat = new THREE.MeshBasicMaterial({ 
                    map: shadowTexture, 
                    transparent: true, 
                    depthWrite: false,
                    opacity: 0.5 
                });
                const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
                shadowMesh.rotation.x = -Math.PI / 2;
                shadowMesh.position.y = 0.02; // Just above ground
                shadowMesh.scale.set(1.5, 1.5, 1);
                elGroup.add(shadowMesh);
            }

            const matParams = { color: elColor, roughness: 0.3, metalness: 0.1 };

            if (el.type === 'furniture' && el.subtype === 'sofa') {
                const sh = h * 0.8;
                const seatGeom = new THREE.BoxGeometry(sw, sh * 0.4, sd);
                const seatMesh = new THREE.Mesh(seatGeom, new THREE.MeshStandardMaterial({ map: sofaTexture, ...matParams }));
                seatMesh.position.y = (sh * 0.4) / 2;
                elGroup.add(seatMesh);
                const backGeom = new THREE.BoxGeometry(sw, sh * 0.6, sd * 0.2);
                const backMesh = new THREE.Mesh(backGeom, new THREE.MeshStandardMaterial(matParams));
                backMesh.position.set(0, (sh * 0.4) + (sh * 0.6) / 2, -sd * 0.4);
                elGroup.add(backMesh);
                const armGeom = new THREE.BoxGeometry(sw * 0.15, sh * 0.25, sd * 0.9);
                [[-sw * 0.42, 0.05], [sw * 0.42, 0.05]].forEach(([x, z]) => {
                  const armMesh = new THREE.Mesh(armGeom, new THREE.MeshStandardMaterial(matParams));
                  armMesh.position.set(x, (sh * 0.4) + (sh * 0.25) / 2, z);
                  elGroup.add(armMesh);
                });
              } else if (el.type === 'bathroom' && el.subtype === 'toilet') {
                const tw = sw * 0.45;
                const td = sd * 0.65;
                const th = h * 0.4;
                const toiletMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.05 });
                const bowlGeom = new THREE.CylinderGeometry(tw * 0.45, tw * 0.35, th, 16);
                const bowlMesh = new THREE.Mesh(bowlGeom, toiletMat);
                bowlMesh.position.y = th / 2;
                elGroup.add(bowlMesh);
                const lidGeom = new THREE.BoxGeometry(tw * 0.85, 0.04, td * 0.75);
                const lidMesh = new THREE.Mesh(lidGeom, new THREE.MeshStandardMaterial({ map: toiletTexture, roughness: 0.2 }));
                lidMesh.position.set(0, th, 0.05);
                elGroup.add(lidMesh);
                const tankGeom = new THREE.BoxGeometry(tw * 0.9, th * 1.2, td * 0.25);
                const tankMesh = new THREE.Mesh(tankGeom, toiletMat);
                tankMesh.position.set(0, (th * 1.2) / 2 + 0.05, -td * 0.35);
                elGroup.add(tankMesh);
            } else if (el.type === 'person') {
                const bodyGeom = new THREE.CapsuleGeometry(0.2, h - 0.4, 4, 8);
                const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: elColor }));
                bodyMesh.position.y = h / 2;
                elGroup.add(bodyMesh);
                const headGeom = new THREE.SphereGeometry(0.15, 12, 12);
                const headMesh = new THREE.Mesh(headGeom, new THREE.MeshStandardMaterial({ color: elColor }));
                headMesh.position.y = h - 0.15;
                elGroup.add(headMesh);
            } else if (el.type === 'vehicle' || el.subtype === 'car' || el.subtype === 'truck') {
                const bodyGeom = new THREE.BoxGeometry(sw, h * 0.7, sd);
                const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: elColor }));
                bodyMesh.position.y = (h * 0.7) / 2 + 0.2;
                elGroup.add(bodyMesh);
                const cabinGeom = new THREE.BoxGeometry(sw * 0.6, h * 0.4, sd * 0.8);
                const cabinMesh = new THREE.Mesh(cabinGeom, new THREE.MeshStandardMaterial({ color: elColor, opacity: 0.8, transparent: true }));
                cabinMesh.position.y = h * 0.7 + (h * 0.4) / 2;
                elGroup.add(cabinMesh);
                [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
                    const wheelGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12);
                    wheelGeom.rotateZ(Math.PI / 2);
                    const wheelMesh = new THREE.Mesh(wheelGeom, new THREE.MeshStandardMaterial({ color: '#111827' }));
                    wheelMesh.position.set(sx * sw * 0.35, 0.2, sz * sd * 0.35);
                    elGroup.add(wheelMesh);
                });
            } else {
                const geom = new THREE.BoxGeometry(sw, h, sd);
                const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: elColor }));
                mesh.position.y = h / 2;
                elGroup.add(mesh);
            }

            elGroup.position.set(el.x / scale, 0, el.y / scale);
            elGroup.rotation.y = -el.rotation * Math.PI / 180;
            elGroup.name = 'dynamic-obj';
            elGroup.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
            scene.add(elGroup);
        });

        // Camera Model (Self)
        const camGroup = new THREE.Group();
        const bodyColor = '#f8fafc';
        const lensColor = '#1e293b';
        if (camera.type === 'bullet') {
            const bodyGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 16);
            bodyGeom.rotateX(Math.PI / 2);
            camGroup.add(new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: bodyColor })));
            const lensGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
            lensGeom.rotateX(Math.PI / 2);
            lensGeom.translate(0, 0, 0.3);
            camGroup.add(new THREE.Mesh(lensGeom, new THREE.MeshStandardMaterial({ color: lensColor })));
            const mountGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.2, 8);
            mountGeom.translate(0, -0.2, -0.1);
            camGroup.add(new THREE.Mesh(mountGeom, new THREE.MeshStandardMaterial({ color: bodyColor })));
        } else {
            const bodyGeom = new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
            camGroup.add(new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: bodyColor })));
            const coverGeom = new THREE.SphereGeometry(0.2, 16, 16);
            coverGeom.translate(0, 0.05, 0);
            camGroup.add(new THREE.Mesh(coverGeom, new THREE.MeshStandardMaterial({ color: lensColor, transparent: true, opacity: 0.8 })));
        }
        camGroup.position.set(camera.x / scale, camera.z, camera.y / scale);
        camGroup.rotation.order = 'YXZ';
        camGroup.rotation.set(rotX, rotY, 0);
        camGroup.name = 'dynamic-obj';
        scene.add(camGroup);

        const fovRadius = camera.dori || 20;
        const fovGeom = new THREE.ConeGeometry(fovRadius * Math.tan((camera.horizontalAngle * Math.PI / 180) / 2), fovRadius, 32, 1, true);
        // Align cone forward axis to +Z and move apex to origin
        fovGeom.rotateX(-Math.PI / 2);
        fovGeom.translate(0, 0, fovRadius / 2);
        const fovMesh = new THREE.Mesh(fovGeom, new THREE.MeshStandardMaterial({ color: camera.fovColor, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false, emissive: camera.fovColor, emissiveIntensity: 0.1 }));
        fovMesh.position.set(camera.x / scale, camera.z, camera.y / scale);
        fovMesh.rotation.order = 'YXZ';
        fovMesh.rotation.set(rotX, rotY, 0);
        fovMesh.name = 'dynamic-obj';
        scene.add(fovMesh);

    }, [floorPlan, camera.x, camera.y, camera.z, camera.rotation, camera.tilt, camera.fovColor, camera.horizontalAngle, camera.verticalAngle, camera.dori]);

    return <div ref={containerRef} className="w-full h-full" />;
};

export default Camera3DPreview;
