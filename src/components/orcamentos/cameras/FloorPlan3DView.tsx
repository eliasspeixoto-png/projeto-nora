'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FloorPlan, Camera as CftvCamera, Element as CftvElement, Wall } from '@/lib/cftv-types';
import { RotateCw, Play, Pause } from 'lucide-react';

interface FloorPlan3DViewProps {
  floorPlan: FloorPlan;
  onCameraSelect: (camera: CftvCamera | null) => void;
  onElementSelect: (el: CftvElement | null) => void;
  selectedCameraId?: string | null;
  selectedElementId?: string | null;
  selectedIds?: string[];
}

const FloorPlan3DView: React.FC<FloorPlan3DViewProps> = ({ 
  floorPlan, 
  onCameraSelect, 
  onElementSelect,
  selectedCameraId,
  selectedElementId,
  selectedIds = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);

  // Sync autoRotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffffff');
    scene.fog = new THREE.FogExp2('#ffffff', 0.0005);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    camera.position.set(50, 50, 50);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    scene.add(dirLight);

    // Ground
    const groundGeom = new THREE.PlaneGeometry(2000, 2000);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(200, 200, 0xcccccc, 0xeeeeee);
    grid.position.y = 0.01;
    scene.add(grid);

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      controls.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // Sync Logic
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear previous dynamic objects
    scene.children.filter(c => c.name === 'dynamic-obj').forEach(c => scene.remove(c));

    const scale = floorPlan.scale || 50;

    // Helper to create camera models
    const createCameraModel = (cam: CftvCamera, isSelected: boolean) => {
      const group = new THREE.Group();
      const bodyColor = isSelected ? '#fbbf24' : '#f8fafc';
      const lensColor = '#1e293b';

      if (cam.type === 'bullet') {
        const bodyGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 16);
        bodyGeom.rotateX(Math.PI / 2);
        const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: bodyColor }));
        group.add(bodyMesh);

        const lensGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
        lensGeom.rotateX(Math.PI / 2);
        lensGeom.translate(0, 0, 0.3);
        const lensMesh = new THREE.Mesh(lensGeom, new THREE.MeshStandardMaterial({ color: lensColor }));
        group.add(lensMesh);

        const mountGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.2, 8);
        mountGeom.translate(0, -0.2, -0.1);
        const mountMesh = new THREE.Mesh(mountGeom, new THREE.MeshStandardMaterial({ color: bodyColor }));
        group.add(mountMesh);
      } else {
        const bodyGeom = new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: bodyColor }));
        group.add(bodyMesh);

        const coverGeom = new THREE.SphereGeometry(0.2, 16, 16);
        coverGeom.translate(0, 0.05, 0);
        const coverMesh = new THREE.Mesh(coverGeom, new THREE.MeshStandardMaterial({ 
          color: lensColor,
          transparent: true,
          opacity: 0.8
        }));
        group.add(coverMesh);
      }

      if (isSelected) {
        const ringGeom = new THREE.RingGeometry(0.4, 0.45, 32);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({ color: '#fbbf24', side: THREE.DoubleSide }));
        ringMesh.position.y = -0.1;
        group.add(ringMesh);
        
        const light = new THREE.PointLight('#fbbf24', 0.5, 2);
        light.position.y = 0.5;
        group.add(light);
      }

      return group;
    };

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
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };
    const shadowTexture = createContactShadowTexture();

    // Helper to create labels
    const createLabel = (text: string, color: string) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Group();
      
      canvas.width = 256;
      canvas.height = 64;
      
      // Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(0, 0, 256, 64, 12);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px font-sans, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.toUpperCase(), 128, 32);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ 
          map: texture, 
          transparent: true,
          depthTest: false 
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.5, 0.4, 1);
      return sprite;
    };

    // Helper to create element models
    const createElementModel = (el: CftvElement, isSelected: boolean) => {
      const group = new THREE.Group();
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
        group.add(shadowMesh);
      }

      const h = el.height || 1.5;
      const color = isSelected ? '#fbbf24' : (el.color || '#64748b');
      const matParams = { color: color, roughness: 0.3, metalness: 0.1 };

      if (el.type === 'furniture' && el.subtype === 'sofa') {
        const sh = h * 0.8;
        
        // Assento (Base)
        const seatGeom = new THREE.BoxGeometry(sw, sh * 0.4, sd);
        const seatMesh = new THREE.Mesh(seatGeom, new THREE.MeshStandardMaterial({ map: sofaTexture, ...matParams }));
        seatMesh.position.y = (sh * 0.4) / 2;
        group.add(seatMesh);
        
        // Encosto
        const backGeom = new THREE.BoxGeometry(sw, sh * 0.6, sd * 0.2);
        const backMesh = new THREE.Mesh(backGeom, new THREE.MeshStandardMaterial(matParams));
        backMesh.position.set(0, (sh * 0.4) + (sh * 0.6) / 2, -sd * 0.4);
        group.add(backMesh);
        
        // Braços
        const armGeom = new THREE.BoxGeometry(sw * 0.15, sh * 0.25, sd * 0.9);
        [[-sw * 0.42, 0.05], [sw * 0.42, 0.05]].forEach(([x, z]) => {
          const armMesh = new THREE.Mesh(armGeom, new THREE.MeshStandardMaterial(matParams));
          armMesh.position.set(x, (sh * 0.4) + (sh * 0.25) / 2, z);
          group.add(armMesh);
        });
      } else if (el.type === 'bathroom' && el.subtype === 'toilet') {
        const tw = sw * 0.45; // Relativo ao tamanho do elemento
        const td = sd * 0.65;
        const th = h * 0.4;
        
        const toiletMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.05 });

        // Vaso (Corpo)
        const bowlGeom = new THREE.CylinderGeometry(tw * 0.45, tw * 0.35, th, 16);
        const bowlMesh = new THREE.Mesh(bowlGeom, toiletMat);
        bowlMesh.position.y = th / 2;
        group.add(bowlMesh);
        
        // Tampa (com textura)
        const lidGeom = new THREE.BoxGeometry(tw * 0.85, 0.04, td * 0.75);
        const lidMesh = new THREE.Mesh(lidGeom, new THREE.MeshStandardMaterial({ map: toiletTexture, roughness: 0.2 }));
        lidMesh.position.set(0, th, 0.05);
        group.add(lidMesh);
        
        // Caixa Acoplada
        const tankGeom = new THREE.BoxGeometry(tw * 0.9, th * 1.2, td * 0.25);
        const tankMesh = new THREE.Mesh(tankGeom, toiletMat);
        tankMesh.position.set(0, (th * 1.2) / 2 + 0.05, -td * 0.35);
        group.add(tankMesh);
      } else if (el.type === 'person') {
        const bodyGeom = new THREE.CapsuleGeometry(0.2, h - 0.4, 4, 8);
        const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color }));
        bodyMesh.position.y = h / 2;
        group.add(bodyMesh);

        const headGeom = new THREE.SphereGeometry(0.15, 12, 12);
        const headMesh = new THREE.Mesh(headGeom, new THREE.MeshStandardMaterial({ color }));
        headMesh.position.y = h - 0.15;
        group.add(headMesh);
      } else if (el.type === 'vehicle' || el.subtype === 'car' || el.subtype === 'truck') {
        const bodyGeom = new THREE.BoxGeometry(sw, h * 0.7, sd);
        const bodyMesh = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color }));
        bodyMesh.position.y = (h * 0.7) / 2 + 0.2;
        group.add(bodyMesh);

        const cabinGeom = new THREE.BoxGeometry(sw * 0.6, h * 0.4, sd * 0.8);
        const cabinMesh = new THREE.Mesh(cabinGeom, new THREE.MeshStandardMaterial({ color, opacity: 0.8, transparent: true }));
        cabinMesh.position.y = h * 0.7 + (h * 0.4) / 2;
        group.add(cabinMesh);
        
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          const wheelGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12);
          wheelGeom.rotateZ(Math.PI / 2);
          const wheelMesh = new THREE.Mesh(wheelGeom, new THREE.MeshStandardMaterial({ color: '#111827' }));
          wheelMesh.position.set(sx * sw * 0.35, 0.2, sz * sd * 0.35);
          group.add(wheelMesh);
        });
      } else {
        const geom = new THREE.BoxGeometry(sw, h, sd);
        const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color }));
        mesh.position.y = h / 2;
        group.add(mesh);
      }

      if (isSelected) {
        const box = new THREE.BoxHelper(group, '#fbbf24');
        group.add(box);
      }

      return group;
    };

    // Render Walls
    floorPlan.walls.forEach((wall: Wall) => {
      const isSelected = !!(selectedIds.includes(wall.id) || (wall.groupId && selectedIds.includes(wall.groupId)));
      const dx = (wall.x2 - wall.x1);
      const dy = (wall.y2 - wall.y1);
      const length = Math.sqrt(dx * dx + dy * dy);
      const h = wall.height || 2.8;
      const wallGeom = new THREE.BoxGeometry(length / scale, h, 0.15); // Espessura fixa ou wall.thickness / scale
      const wallMat = new THREE.MeshStandardMaterial({ 
        color: isSelected ? '#fbbf24' : '#4b5563',
        transparent: isSelected,
        opacity: isSelected ? 0.8 : 1
      });
      const wallMesh = new THREE.Mesh(wallGeom, wallMat);
      
      wallMesh.position.set(((wall.x1 + wall.x2) / (2 * scale)), h / 2, ((wall.y1 + wall.y2) / (2 * scale)));
      wallMesh.rotation.y = -Math.atan2(dy, dx);
      wallMesh.name = 'dynamic-obj';
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      scene.add(wallMesh);

      if (isSelected) {
          const helper = new THREE.BoxHelper(wallMesh, '#fbbf24');
          helper.name = 'dynamic-obj';
          scene.add(helper);
      }
    });

    // Render Elements
    floorPlan.elements.forEach((el: CftvElement) => {
      if (el.type === 'text') return;
      const isSelected = !!(selectedIds.includes(el.id) || (el.groupId && selectedIds.includes(el.groupId)));
      const model = createElementModel(el, isSelected);
      
      model.position.set(el.x / scale, 0, el.y / scale);
      model.rotation.y = -el.rotation * Math.PI / 180;
      model.name = 'dynamic-obj';
      model.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      scene.add(model);

      if (isSelected) {
        const h = el.height || 1.5;
        const label = createLabel(el.name || el.type, '#fbbf24');
        label.position.set(el.x / scale, h + 0.5, el.y / scale);
        label.name = 'dynamic-obj';
        scene.add(label);
      }
    });

    // Render Cameras and FOV Cones
    floorPlan.cameras.forEach((cam: CftvCamera) => {
      const isSelected = !!(cam.id === selectedCameraId || selectedIds.includes(cam.id) || (cam.groupId && selectedIds.includes(cam.groupId)));
      
      const camModel = createCameraModel(cam, isSelected);
      camModel.position.set(cam.x / scale, cam.z, cam.y / scale);
      
      const rotY = -cam.rotation * Math.PI / 180;
      const rotX = -cam.tilt * Math.PI / 180;
      camModel.rotation.order = 'YXZ';
      camModel.rotation.set(rotX, rotY, 0);
      
      camModel.name = 'dynamic-obj';
      scene.add(camModel);

      if (isSelected) {
        const label = createLabel(cam.name || `Câmera ${cam.id.slice(-4)}`, '#fbbf24');
        label.position.set(cam.x / scale, cam.z + 0.8, cam.y / scale);
        label.name = 'dynamic-obj';
        scene.add(label);
      }

      if (cam.showFov) {
        const fovRadius = cam.dori || 20;
        const hAngleRad = cam.horizontalAngle * Math.PI / 180;
        
        const fovGeom = new THREE.ConeGeometry(
            fovRadius * Math.tan(hAngleRad / 2), 
            fovRadius, 
            32, 1, true
        );
        // Align cone forward axis to +Z and move apex to origin
        fovGeom.rotateX(-Math.PI / 2);
        fovGeom.translate(0, 0, fovRadius / 2);
        
        const fovMat = new THREE.MeshStandardMaterial({ 
            color: cam.fovColor, 
            transparent: true, 
            opacity: isSelected ? 0.4 : 0.15, 
            side: THREE.DoubleSide, 
            depthWrite: false,
            emissive: cam.fovColor,
            emissiveIntensity: isSelected ? 0.5 : 0.1
        });
        const fovMesh = new THREE.Mesh(fovGeom, fovMat);
        fovMesh.position.set(cam.x / scale, cam.z, cam.y / scale);
        
        fovMesh.rotation.order = 'YXZ';
        fovMesh.rotation.set(rotX, rotY, 0);
        
        fovMesh.name = 'dynamic-obj';
        scene.add(fovMesh);
      }
    });

  }, [floorPlan, selectedCameraId, selectedElementId, selectedIds]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-white rounded-lg border shadow-xl">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Floating Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-2 rounded-full shadow-lg backdrop-blur-md border border-slate-200 transition-all pointer-events-auto ${
            autoRotate ? 'bg-primary text-primary-foreground' : 'bg-white/90 text-slate-700 hover:bg-white'
          }`}
          title={autoRotate ? "Pausar Rotação" : "Auto-Rotacionar"}
        >
          {autoRotate ? <Pause className="w-5 h-5" /> : <RotateCw className="w-5 h-5" />}
        </button>
      </div>

      <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 text-[10px] font-mono pointer-events-none flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        VISUALIZAÇÃO 3D INTERATIVA • ARRASTE PARA GIRAR • SCROLL PARA ZOOM
      </div>
    </div>
  );
};

export default FloorPlan3DView;
