
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import FloorPlanCanvas from '@/components/orcamentos/cameras/FloorPlanCanvas';
import ControlsPanel from '@/components/orcamentos/cameras/ControlsPanel';
import CameraList from '@/components/orcamentos/cameras/CameraList';
const FloorPlan3DView = dynamic(() => import('@/components/orcamentos/cameras/FloorPlan3DView'), { 
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg border shadow-xl">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2 text-sm font-medium">Carregando Visualização 3D...</span>
  </div>
});
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout, Box, Video, Eye, Save, ListChecks } from 'lucide-react';
import type { Camera, Wall, FloorPlan, DrawingMode, CameraPreset, Element as CftvElement, Measurement } from '@/lib/cftv-types';
import { useAuth } from '@/firebase/auth/use-user';
import { getProductsOnce, getClientsOnce, addQuote, getQuote, updateQuote, updateProduct, getSuppliers, getStockLocations } from '@/lib/firebase/firestore';
import type { Product, Client, QuoteData, QuoteItem, Supplier, StockLocation } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { calculateCftvMaterials } from '@/lib/cftv-calculator';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CalculatedItemsTable from '@/components/orcamentos/calculated-items-table';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import AddEditProductDialog from '@/components/produtos/add-edit-product-dialog';


const personSvgUrl = typeof window !== 'undefined' ? `data:image/svg+xml;base64,${window.btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><circle cx="25" cy="12" r="8" fill="#6b7280"/><ellipse cx="25" cy="35" rx="15" ry="10" fill="#6b7280"/></svg>')}` : '';
const carSvgUrl = 'https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/carro.png?alt=media&token=d5a0a6d7-25ec-464d-980b-e521ef5cce06';
const truckSvgUrl = 'https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/camin%C3%A3o.png?alt=media&token=2a8fbd2b-bda1-4947-8350-2ddcdf414212';
const treeSvgUrl = 'https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/arvore.png?alt=media&token=b418e962-f24f-4540-be71-3b3de878648d';

const round = (value: number) => Math.round(value * 100) / 100;

const defaultFloorPlan: FloorPlan = {
  id: '1',
  name: 'Novo Projeto CFTV',
  width: 50,
  height: 30,
  scale: 20,
  floors: 1,
  walls: [],
  cameras: [],
  elements: [],
  measurements: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

const getCameraCalculatedProps = (camera: Partial<Camera>) => {
    const sensorDimensions: Record<string, { h: number, v: number }> = {
      '1/4"': { h: 3.2, v: 2.4 },
      '1/3"': { h: 4.8, v: 3.6 },
      '1/2.8"': { h: 4.8, v: 3.6 },
      '1/2.7"': { h: 5.27, v: 3.96 },
      '1/2.5"': { h: 5.76, v: 4.29 },
      '1/1.8"': { h: 7.18, v: 5.32 },
      '1"': { h: 12.8, v: 9.6 },
    };

    const sensor = sensorDimensions[camera.sensorSize || '1/2.8"'] || sensorDimensions['1/2.8"'];
    let focalLength = 2.8;

    if (camera.lensType === '3.6mm') focalLength = 3.6;
    else if (camera.lensType === 'varifocal') focalLength = camera.varifocalFocalLength || 2.8;

    // FOV = 2 * atan(h / (2 * f))
    const hAngleRad = 2 * Math.atan(sensor.h / (2 * focalLength));
    const vAngleRad = 2 * Math.atan(sensor.v / (2 * focalLength));
    
    let newHorizontalAngle = hAngleRad * 180 / Math.PI;
    let newVerticalAngle = vAngleRad * 180 / Math.PI;
    
    // DORI base: 2MP = ~25m identification reach (at 250px/m)
    // Formula approximation: reach = (resolution_width_px / 250) * (focal_length / sensor_width_mm)
    const resWidth = camera.resolution === '2MP' ? 1920 : camera.resolution === '4MP' ? 2688 : camera.resolution === '8MP' ? 3840 : 4000;
    let newDori = (resWidth / 250) * (focalLength / sensor.h);
    
    // Safety multiplier (DORI in security software is often optimistic, we keep it technical)
    newDori *= 0.8; 

    return {
        dori: parseFloat(newDori.toFixed(1)),
        horizontalAngle: parseFloat(newHorizontalAngle.toFixed(1)),
        verticalAngle: parseFloat(newVerticalAngle.toFixed(1)),
    };
};

export default function CftvPlannerPage() {
  const [floorPlan, _setFloorPlan] = useState<FloorPlan>(defaultFloorPlan);
  const [history, setHistory] = useState<FloorPlan[]>([]);
  const [redoHistory, setRedoHistory] = useState<FloorPlan[]>([]);
  const floorPlanRef = useRef(floorPlan);

  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 50, y: 50 });
  const mainCanvasContainerRef = useRef<HTMLDivElement>(null);
  const [mainCanvasSize, setMainCanvasSize] = useState({ width: 0, height: 0 });
  
  const setFloorPlan = useCallback((updater: React.SetStateAction<FloorPlan>) => {
      const currentState = floorPlanRef.current;
      setHistory(prev => [...prev, currentState]);
      setRedoHistory([]);
      _setFloorPlan(updater);
  }, []);
  
  useEffect(() => {
    floorPlanRef.current = floorPlan;
  }, [floorPlan]);

  useEffect(() => {
    if (!mainCanvasContainerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setMainCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });

    resizeObserver.observe(mainCanvasContainerRef.current);

    return () => resizeObserver.disconnect();
  }, []);
  
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [selectedElement, setSelectedElement] = useState<CftvElement | null>(null);
  const [selectedWall, setSelectedWall] = useState<Wall | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('select');
  const [showCameraList, setShowCameraList] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clipboard, setClipboard] = useState<any | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [isProductDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  const [manufacturer, setManufacturer] = useState<string>('all');
  const [cableType, setCableType] = useState<'coaxial' | 'utp'>('utp');
  const [technologyType, setTechnologyType] = useState<string>('cabeada');
  const [ipSystemType, setIpSystemType] = useState<'nvr-poe' | 'nvr-no-poe' | 'dvr'>('nvr-poe');

  const [manualItems, setManualItems] = useState<QuoteItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [installments, setInstallments] = useState<number>(1);
  const [interestRate, setInterestRate] = useState<number>(0);

  const { userProfile, company, firebase } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams?.get('id');
  const isEditing = !!quoteId;

  const normalizeString = (str: string | null | undefined) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  useEffect(() => {
    if (!userProfile?.companyId || !firebase.db) {
        setIsLoading(false);
        return;
    }
    const { db } = firebase;
    const companyId = userProfile.companyId;

    async function loadInitialData() {
      try {
        const [productsData, clientsData, suppliersData, locationsData] = await Promise.all([
          getProductsOnce(db, companyId, 'Ativo'),
          getClientsOnce(db, companyId),
          new Promise<Supplier[]>(res => getSuppliers(db, companyId, res, console.error)),
          new Promise<StockLocation[]>(res => getStockLocations(db, companyId, res, console.error)),
        ]);
        setProducts(productsData);
        setClients(clientsData);
        setSuppliers(suppliersData);
        setLocations(locationsData);

        if (isEditing && quoteId) {
          const existingQuote = await getQuote(db, quoteId);
          if (existingQuote && existingQuote.cftvDetails) {
            const floorPlanData: FloorPlan = {
                id: existingQuote.id,
                name: `Projeto - ${existingQuote.quoteNumber}`,
                cameras: existingQuote.cftvDetails.cameras || [],
                walls: existingQuote.cftvDetails.walls || [],
                elements: existingQuote.cftvDetails.elements || [],
                measurements: existingQuote.cftvDetails.measurements || [],
                width: existingQuote.cftvDetails.width || 50,
                height: existingQuote.cftvDetails.height || 30,
                scale: existingQuote.cftvDetails.scale || 20,
                floors: 1,
                backgroundImage: existingQuote.cftvDetails.backgroundImage,
                createdAt: new Date(existingQuote.date),
                updatedAt: new Date()
            };
            _setFloorPlan(floorPlanData);
            setSelectedClientId(existingQuote.clientId);
            setDiscountPercentage(existingQuote.discount || 0);
            setInstallments(existingQuote.installments || 1);
            setInterestRate(existingQuote.interestRate || 0);
            setManualItems(existingQuote.cftvDetails.manualItems || []);

          } else {
             toast({ variant: "destructive", title: "Erro", description: "Orçamento CFTV não encontrado." });
             router.push('/orcamentos');
          }
        }
        
      } catch (error) {
        toast({ variant: "destructive", title: "Erro ao Carregar Dados" });
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, [userProfile?.companyId, firebase.db, toast, isEditing, quoteId, router]);
  
  const filteredCameraProducts = useMemo(() => {
    let cameraProducts = products.filter(p => p.segment === 'CÂMERAS');

    if (manufacturer !== 'all') {
      cameraProducts = cameraProducts.filter(p => p.manufacturer === manufacturer);
    }
    
    if (technologyType !== 'all') {
        cameraProducts = cameraProducts.filter(p => {
          const description = (p.description || '').toLowerCase();
          if (technologyType === 'ip') {
            return description.includes('ip');
          }
          if (technologyType === 'wifi') {
            return description.includes('wi-fi') || description.includes('wifi');
          }
          if (technologyType === 'cabeada') {
            return !description.includes('ip') && !description.includes('wi-fi') && !description.includes('wifi');
          }
          return true;
        });
    }

    return cameraProducts;
  }, [products, manufacturer, technologyType]);

  const allManufacturers = useMemo(() => {
    const mans = filteredCameraProducts.map(p => p.manufacturer || 'Outros');
    return mans.filter((v, i, a) => a.indexOf(v) === i);
  }, [filteredCameraProducts]);

  const handleTechnologyTypeChange = (type: string) => {
    setTechnologyType(type);
    if (type === 'ip' || type === 'wifi') {
      setCableType('utp');
    } else if (type === 'cabeada') {
      setCableType('coaxial');
    }
  };

  const handleGroup = useCallback(() => {
    if (selectedIds.length < 2) return;
    const groupId = `group_${Date.now()}`;
    setFloorPlan(prev => ({
        ...prev,
        cameras: prev.cameras.map(c => selectedIds.includes(c.id) ? { ...c, groupId } : c),
        elements: prev.elements.map(e => selectedIds.includes(e.id) ? { ...e, groupId } : e),
        walls: prev.walls.map(w => selectedIds.includes(w.id) ? { ...w, groupId } : w),
    }));
  }, [selectedIds, setFloorPlan]);

  const handleUngroup = useCallback(() => {
    setFloorPlan(prev => ({
        ...prev,
        cameras: prev.cameras.map(c => selectedIds.includes(c.id) || (c.groupId && selectedIds.includes(c.groupId)) ? { ...c, groupId: undefined } : c),
        elements: prev.elements.map(e => selectedIds.includes(e.id) || (e.groupId && selectedIds.includes(e.groupId)) ? { ...e, groupId: undefined } : e),
        walls: prev.walls.map(w => selectedIds.includes(w.id) || (w.groupId && selectedIds.includes(w.groupId)) ? { ...w, groupId: undefined } : w),
    }));
  }, [selectedIds, setFloorPlan]);

  const allItems = useMemo(() => {
    const combined = new Map<string, QuoteItem>();

    // 1. Get calculated material items
    const materialItems = calculateCftvMaterials(floorPlan.cameras, floorPlan.elements, products, cableType, technologyType, ipSystemType);
    materialItems.forEach(item => {
        combined.set(item.product.id, { ...item });
    });

    // 2. Get camera items
    const cameraItems = floorPlan.cameras.map(cam => {
      const product = products.find(p => p.id === cam.productId);
      const price = product?.sellingPrice || 0;
      const servicePrice = product?.servicePrice || 0;
      return {
        id: cam.id,
        product: product || { id: cam.productId, description: cam.name } as Product,
        quantity: 1,
        materialPrice: price,
        servicePrice: servicePrice,
        total: price + servicePrice,
      };
    });
    
    // Aggregate cameras by product ID
    cameraItems.forEach(item => {
        const existing = combined.get(item.product.id);
        if (existing) {
            existing.quantity += item.quantity;
            existing.total += item.total;
        } else {
            combined.set(item.product.id, { ...item });
        }
    });

    // 3. Apply manual items as overrides
    manualItems.forEach(manualItem => {
        // This will override the entire calculated item or add a new one.
        combined.set(manualItem.product.id, manualItem);
    });
    
    return Array.from(combined.values());
  }, [floorPlan.cameras, floorPlan.elements, products, cableType, manualItems, technologyType, ipSystemType]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setRedoHistory(prev => [floorPlanRef.current, ...prev]);
    _setFloorPlan(lastState);
    setHistory(prev => prev.slice(0, -1));
  }, [history]);

  const handleRedo = useCallback(() => {
    if (redoHistory.length === 0) return;
    const nextState = redoHistory[0];
    setHistory(prev => [...prev, floorPlanRef.current]);
    _setFloorPlan(nextState);
    setRedoHistory(prev => prev.slice(1));
  }, [redoHistory]);

  const handleScaleChange = useCallback((newScale: number) => {
    setFloorPlan(prev => ({
      ...prev,
      scale: newScale,
    }));
  }, [setFloorPlan]);

  const handleCameraAddModel = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
        toast({ title: "Produto não encontrado!", variant: "destructive" });
        return;
    }

    const desc = product.description.toLowerCase();
    
    let resolution: Camera['resolution'] = '4MP'; // Default
    if (desc.includes('2mp')) resolution = '2MP';
    else if (desc.includes('8mp')) resolution = '8MP';
    else if (desc.includes('12mp')) resolution = '12MP';

    let lensType: Camera['lensType'] = '2.8mm'; // Default
    if (desc.includes('3.6mm')) lensType = '3.6mm';
    else if (desc.includes('varifocal')) lensType = 'varifocal';

    const type: Camera['type'] = desc.includes('bullet') ? 'bullet' : 'dome';
    const isInternal = type === 'dome';

    const irMatch = desc.match(/(?:ir)?\s*(\d{2,3})m/);
    const irDistance = irMatch ? parseInt(irMatch[1], 10) : 30;

    const partialCamera = { resolution, lensType, varifocalFocalLength: lensType === 'varifocal' ? 2.8 : undefined };
    const calculatedProps = getCameraCalculatedProps(partialCamera);

    const newCamera: Camera = {
        id: `cam_${Date.now()}`,
        type: type,
        name: product.description,
        x: floorPlanRef.current.width / 2,
        y: floorPlanRef.current.height / 2,
        z: 2.8,
        resolution: resolution,
        ...calculatedProps,
        rotation: 0,
        tilt: -30,
        floor: 1,
        fovColor: isInternal ? '#3b82f6' : '#10b981',
        showFov: true,
        irDistance: irDistance,
        lensType: lensType,
        varifocalFocalLength: lensType === 'varifocal' ? 2.8 : undefined,
        isInternal: isInternal,
        productId: product.id,
    };

    setFloorPlan(prev => ({
        ...prev,
        cameras: [...prev.cameras, newCamera],
        updatedAt: new Date()
    }));
    
    setSelectedCamera(newCamera);
    setDrawingMode('select');
  }, [products, toast, setFloorPlan]);

  const handleCameraAdd = useCallback((x: number, y: number) => {
    const newCamera: Camera = {
      id: `cam_${Date.now()}`,
      type: 'dome',
      name: `Câmera ${floorPlan.cameras.length + 1}`,
      x,
      y,
      z: 2.8,
      resolution: '4MP',
      dori: 20 * 0.4, // Redução de 60%
      horizontalAngle: 105,
      verticalAngle: 56,
      rotation: 0,
      tilt: -30,
      floor: 1,
      fovColor: '#3b82f6',
      showFov: true,
      irDistance: 30,
      lensType: '2.8mm',
      sensorSize: '1/2.8"',
      varifocalFocalLength: 2.8,
      isInternal: true,
    };
    
    setFloorPlan(prev => ({
      ...prev,
      cameras: [...prev.cameras, newCamera],
      updatedAt: new Date()
    }));
    
    setSelectedCamera(newCamera);
    setDrawingMode('select');
  }, [floorPlan.cameras.length, setFloorPlan]);

  const handleElementAdd = useCallback((preset: Partial<CftvElement>) => {
    let newElement: CftvElement = {
      id: `elem_${Date.now()}`,
      type: preset.type || 'square',
      name: preset.name || 'Novo Elemento',
      x: preset.x ?? floorPlanRef.current.width / 2, // Center if not provided
      y: preset.y ?? floorPlanRef.current.height / 2, // Center if not provided
      z: 0,
      rotation: 0,
      width: 1,
      height: 0,
      depth: 1,
      ...preset,
      color: preset.color || '#6b7280', // Default color if not provided
    };

    if (newElement.type === 'text') {
        newElement = {
            ...newElement,
            name: 'Novo Texto',
            text: 'Texto Editável',
            fontSize: 14,
            width: 5,
            depth: 1,
            height: 0,
            color: '#333333',
        };
    } else {
        const dimensionsMap: Record<string, {width: number, depth: number, height: number, svgUrl?: string}> = {
          'person': { width: 0.6, depth: 0.4, height: 1.7, svgUrl: personSvgUrl },
          'car': { width: 4.5, depth: 1.8, height: 1.5, svgUrl: carSvgUrl },
          'truck': { width: 6.5, depth: 2.5, height: 2.4, svgUrl: truckSvgUrl },
          'tree': { width: 3, depth: 3, height: 5, svgUrl: treeSvgUrl },
          'sofa': { width: 2.0, depth: 0.9, height: 0.8 },
          'table': { width: 1.6, depth: 0.8, height: 0.75 },
          'chair': { width: 0.5, depth: 0.5, height: 0.9 },
          'bed': { width: 1.9, depth: 2.0, height: 0.6 },
          'door': { width: 0.8, depth: 0.05, height: 2.1 },
          'window': { width: 1.2, depth: 0.1, height: 1.0 },
          'dvr': { width: 0.6, depth: 0.45, height: 0.15 },
        };

        const subtype = newElement.subtype || newElement.type;
        if (dimensionsMap[subtype]) {
          const dims = dimensionsMap[subtype];
          newElement.width = dims.width;
          newElement.depth = dims.depth;
          newElement.height = dims.height;
          if (dims.svgUrl) {
            newElement.svgUrl = dims.svgUrl;
          }
        }

        if (!preset.color) {
          const defaultColors: Record<string, string> = {
            'vehicle': '#3b82f6',
            'furniture': '#8b4513',
            'person': '#ef4444',
            'tree': '#22c55e',
            'door': '#a16207',
            'window': '#06b6d4',
            'dvr': '#4b5563',
          };
          newElement.color = defaultColors[newElement.type] || '#6b7280';
        }

        if (!preset.name) {
          newElement.name = newElement.subtype 
            ? `${newElement.subtype.charAt(0).toUpperCase() + newElement.subtype.slice(1)}`
            : `${newElement.type.charAt(0).toUpperCase() + newElement.type.slice(1)}`;
        }
    }

    setFloorPlan(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }));
    setDrawingMode('select');
  }, [setFloorPlan]);

  const handleCameraUpdate = useCallback((updatedCamera: Camera) => {
    const oldCamera = floorPlanRef.current.cameras.find(c => c.id === updatedCamera.id);
    
    // Only recalculate if a relevant property has changed
    if (oldCamera && (
        oldCamera.resolution !== updatedCamera.resolution ||
        oldCamera.lensType !== updatedCamera.lensType ||
        oldCamera.sensorSize !== updatedCamera.sensorSize ||
        oldCamera.varifocalFocalLength !== updatedCamera.varifocalFocalLength
    )) {
        const calculatedProps = getCameraCalculatedProps(updatedCamera);
        updatedCamera = { ...updatedCamera, ...calculatedProps, dori: oldCamera.dori, rotation: oldCamera.rotation };
    }
    
    setFloorPlan(prev => ({
      ...prev,
      cameras: prev.cameras.map(cam =>
        cam.id === updatedCamera.id ? updatedCamera : cam
      ),
      updatedAt: new Date()
    }));
    
    setSelectedCamera(updatedCamera);
  }, [setFloorPlan]);

  const handleElementUpdate = useCallback((updatedElement: CftvElement) => {
    setFloorPlan(prev => ({
        ...prev,
        elements: prev.elements.map(elem =>
            elem.id === updatedElement.id ? updatedElement : elem
        )
    }));
    setSelectedElement(updatedElement);
  }, [setFloorPlan]);

  const handleWallUpdate = useCallback((updatedWall: Wall) => {
    setFloorPlan(prev => ({
      ...prev,
      walls: prev.walls.map(wall => 
        wall.id === updatedWall.id ? updatedWall : wall
      ),
      updatedAt: new Date()
    }));
    setSelectedWall(updatedWall);
  }, [setFloorPlan]);

  const handleCameraDelete = useCallback((cameraId: string) => {
    setFloorPlan(prev => ({
      ...prev,
      cameras: prev.cameras.filter(cam => cam.id !== cameraId),
      updatedAt: new Date()
    }));
    
    if (selectedCamera?.id === cameraId) {
      setSelectedCamera(null);
    }
  }, [selectedCamera, setFloorPlan]);

  const handleElementDelete = useCallback((elementId: string) => {
    setFloorPlan(prev => ({
      ...prev,
      elements: prev.elements.filter(elem => elem.id !== elementId)
    }));
    if (selectedElement?.id === elementId) {
      setSelectedElement(null);
    }
  }, [selectedElement, setFloorPlan]);

  const handleReorder = useCallback((id: string, direction: 'front' | 'back') => {
    setFloorPlan(prev => {
        // Elements
        const elemIdx = prev.elements.findIndex(el => el.id === id);
        if (elemIdx !== -1) {
            const elements = [...prev.elements];
            const [item] = elements.splice(elemIdx, 1);
            if (direction === 'front') elements.push(item);
            else elements.unshift(item);
            return { ...prev, elements };
        }
        
        // Cameras
        const camIdx = prev.cameras.findIndex(c => c.id === id);
        if (camIdx !== -1) {
            const cameras = [...prev.cameras];
            const [item] = cameras.splice(camIdx, 1);
            if (direction === 'front') cameras.push(item);
            else cameras.unshift(item);
            return { ...prev, cameras };
        }
        
        // Walls (individual or group)
        const wallIdx = prev.walls.findIndex(w => w.id === id);
        if (wallIdx !== -1) {
            const walls = [...prev.walls];
            const wall = walls[wallIdx];
            if (wall.groupId) {
                const groupWalls = walls.filter(w => w.groupId === wall.groupId);
                const otherWalls = walls.filter(w => w.groupId !== wall.groupId);
                if (direction === 'front') return { ...prev, walls: [...otherWalls, ...groupWalls] };
                else return { ...prev, walls: [...groupWalls, ...otherWalls] };
            } else {
                const [item] = walls.splice(wallIdx, 1);
                if (direction === 'front') walls.push(item);
                else walls.unshift(item);
                return { ...prev, walls };
            }
        }
        
        return prev;
    });
  }, [setFloorPlan]);

  const handleWallAdd = useCallback((wall: Wall) => {
    setFloorPlan(prev => ({
      ...prev,
      walls: [...prev.walls, wall],
      updatedAt: new Date()
    }));
  }, [setFloorPlan]);

  const handleWallRemove = useCallback((wallId: string) => {
    setFloorPlan(prev => ({
      ...prev,
      walls: prev.walls.filter(wall => wall.id !== wallId),
      updatedAt: new Date()
    }));
    if (selectedWall?.id === wallId) {
        setSelectedWall(null);
    }
  }, [selectedWall, setFloorPlan]);

  const handleCameraRotate = useCallback((id: string, rotation: number) => {
    const camera = floorPlan.cameras.find(c => c.id === id);
    if(camera) {
        handleCameraUpdate({ ...camera, rotation });
    }
  }, [floorPlan.cameras, handleCameraUpdate]);
  
  const handleElementRotate = useCallback((id: string, rotation: number) => {
    const element = floorPlan.elements.find(e => e.id === id);
    if(element) {
        handleElementUpdate({ ...element, rotation });
    }
  }, [floorPlan.elements, handleElementUpdate]);
  
  const handleMeasurementAdd = useCallback((measurement: Measurement) => {
    setFloorPlan(prev => ({
        ...prev,
        measurements: [...prev.measurements, measurement]
    }));
  }, [setFloorPlan]);

  const handleMeasurementRemove = useCallback((id: string) => {
    setFloorPlan(prev => ({
        ...prev,
        measurements: prev.measurements.filter(m => m.id !== id)
    }));
  }, [setFloorPlan]);

  const handleCopy = useCallback(() => {
    const itemsToCopy = [
        ...floorPlan.cameras.filter(c => selectedIds.includes(c.id)).map(c => ({ ...c, _itemType: 'camera' })),
        ...floorPlan.elements.filter(e => selectedIds.includes(e.id)).map(e => ({ ...e, _itemType: 'element' })),
        ...floorPlan.walls.filter(w => selectedIds.includes(w.id) || (w.groupId && selectedIds.includes(w.groupId))).map(w => ({ ...w, _itemType: 'wall' }))
    ];
    if (itemsToCopy.length > 0) {
      setClipboard(itemsToCopy);
    }
  }, [floorPlan, selectedIds]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    const items = Array.isArray(clipboard) ? clipboard : [clipboard] as any[];
    
    const offset = 1;
    const timestamp = Date.now();
    const newCameras: Camera[] = [];
    const newElements: CftvElement[] = [];
    const newWalls: Wall[] = [];
    const groupMapping = new Map<string, string>();

    items.forEach((item, index) => {
        let newGroupId = item.groupId;
        if (item.groupId) {
            if (!groupMapping.has(item.groupId)) {
                groupMapping.set(item.groupId, `${item.groupId}_copy_${timestamp}`);
            }
            newGroupId = groupMapping.get(item.groupId);
        }

        if (item._itemType === 'camera' || (item.type && ['dome', 'bullet', 'spy_dome'].includes(item.type))) {
            newCameras.push({ ...item, id: `cam_${timestamp}_${index}`, x: (item.x || 0) + offset, y: (item.y || 0) + offset, groupId: newGroupId });
        } else if (item._itemType === 'element' || (item.type && !['dome', 'bullet', 'spy_dome'].includes(item.type) && item.x1 === undefined)) {
            newElements.push({ ...item, id: `el_${timestamp}_${index}`, x: (item.x || 0) + offset, y: (item.y || 0) + offset, groupId: newGroupId });
        } else if (item._itemType === 'wall' || item.x1 !== undefined) {
             const newWall: Wall = { ...item, id: `wall_${timestamp}_${index}`, x1: item.x1 + offset, y1: item.y1 + offset, x2: item.x2 + offset, y2: item.y2 + offset, groupId: newGroupId };
             if (item.controlPoint) {
                 newWall.controlPoint = { x: item.controlPoint.x + offset, y: item.controlPoint.y + offset };
             }
             newWalls.push(newWall);
        }
    });

    setFloorPlan(prev => ({
        ...prev,
        cameras: [...prev.cameras, ...newCameras],
        elements: [...prev.elements, ...newElements],
        walls: [...prev.walls, ...newWalls],
        updatedAt: new Date()
    }));
    
    setSelectedIds([...newCameras.map(c => c.id), ...newElements.map(e => e.id), ...newWalls.map(w => w.id)]);
  }, [clipboard, setFloorPlan]);

  const handleDeleteKeyPress = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    setFloorPlan(prev => {
        // Expand selection to include all members of selected groups
        const groupIds = new Set(
            [...prev.cameras, ...prev.elements, ...prev.walls]
            .filter(i => selectedIds.includes(i.id) && i.groupId)
            .map(i => i.groupId!)
        );
        
        const isSelected = (id: string, groupId?: string) => 
            selectedIds.includes(id) || (groupId && groupIds.has(groupId));

        return {
            ...prev,
            cameras: prev.cameras.filter(c => !isSelected(c.id, c.groupId)),
            elements: prev.elements.filter(e => !isSelected(e.id, e.groupId)),
            walls: prev.walls.filter(w => !isSelected(w.id, w.groupId)),
            updatedAt: new Date()
        };
    });
    setSelectedIds([]);
  }, [selectedIds, setFloorPlan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o foco estiver em um input ou textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'v':
            e.preventDefault();
            handlePaste();
            break;
          case 'x':
            e.preventDefault();
            handleCopy();
            handleDeleteKeyPress();
            break;
          case 'z':
            if (e.shiftKey) {
                e.preventDefault();
                handleRedo();
            } else {
                e.preventDefault();
                handleUndo();
            }
            break;
        }
      } else {
        switch (e.key.toLowerCase()) {
          case 'v': setDrawingMode('select'); break;
          case 'h': setDrawingMode('pan'); break;
          case 'c': setDrawingMode('camera'); break;
          case 'w': setDrawingMode('wall'); break;
          case 'm': setDrawingMode('measure'); break;
          case 'e': setDrawingMode('delete'); break;
          case 'delete':
          case 'backspace':
            handleDeleteKeyPress();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleDeleteKeyPress, handleUndo, handleRedo]);

  const handleAddPresetCamera = useCallback((preset: CameraPreset) => {
    const isInternal = preset.type === 'dome';
    let fovColor = '#3b82f6'; // default blue for dome
    if (preset.type === 'bullet') {
        fovColor = '#10b981'; // green
    } else if (preset.type === 'spy_dome') {
        fovColor = '#f59e0b'; // amber
    }
    
    const newCamera: Camera = {
      id: `cam_${Date.now()}`,
      type: preset.type,
      name: preset.name,
      x: floorPlan.width / 2,
      y: floorPlan.height / 2,
      z: preset.defaultHeight,
      resolution: preset.resolution,
      dori: preset.dori,
      horizontalAngle: preset.horizontalAngle,
      verticalAngle: preset.verticalAngle,
      rotation: 0,
      tilt: -30,
      floor: 1,
      fovColor: fovColor,
      showFov: true,
      irDistance: 30,
      lensType: '2.8mm',
      varifocalFocalLength: 2.8,
      isInternal: !['bullet', 'spy_dome'].includes(preset.type),
    };
    
    setFloorPlan(prev => ({
      ...prev,
      cameras: [...prev.cameras, newCamera],
      updatedAt: new Date()
    }));
    
    setSelectedCamera(newCamera);
    setDrawingMode('select');
  }, [floorPlan.width, floorPlan.height, setFloorPlan]);
  
  const handleWallSelect = (wall: Wall | null) => {
    setSelectedWall(wall);
    setSelectedCamera(null);
    setSelectedElement(null);
  };
  
  const handleElementSelect = (element: CftvElement | null) => {
    setSelectedElement(element);
    setSelectedCamera(null);
    setSelectedWall(null);
  };

  const handleCameraSelect = (camera: Camera | null) => {
    setSelectedCamera(camera);
    setSelectedElement(null);
    setSelectedWall(null);
  };

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(floorPlan, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `cftv-projeto-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [floorPlan]);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedPlan = JSON.parse(content);
        _setFloorPlan({
          ...defaultFloorPlan,
          ...importedPlan,
          createdAt: new Date(importedPlan.createdAt),
          updatedAt: new Date()
        });
        toast({ title: 'Projeto importado com sucesso!' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro ao importar arquivo' });
      }
    };
    reader.readAsText(file);
  }, [toast]);
  
  const handleItemChange = (itemId: string, newQuantityStr: number | string) => {
    // Find the item in the displayed list, which is `allItems`
    const itemToUpdate = allItems.find(i => i.id === itemId);
    if (!itemToUpdate) return;
    
    const newQuantity = typeof newQuantityStr === 'string' ? parseFloat(newQuantityStr) : newQuantityStr;
    // Allow setting to 0, but not negative or NaN
    if (isNaN(newQuantity) || newQuantity < 0) return;

    // Create the updated item, which will be our manual override.
    // Use a consistent ID for manual items based on product ID to avoid duplicates
    const updatedItem: QuoteItem = {
      ...itemToUpdate,
      id: `manual-${itemToUpdate.product.id}`,
      quantity: newQuantity,
      total: round(newQuantity * (itemToUpdate.materialPrice + (itemToUpdate.servicePrice || 0)))
    };
    
    setManualItems(prevManualItems => {
        const existingIndex = prevManualItems.findIndex(item => item.product.id === itemToUpdate.product.id);

        if (existingIndex > -1) {
            const newManualItems = [...prevManualItems];
            newManualItems[existingIndex] = updatedItem;
            return newManualItems;
        } else {
            return [...prevManualItems, updatedItem];
        }
    });
  };

  const handleDeleteItem = (itemId: string) => {
    setManualItems(prev => prev.filter(item => item.id !== itemId));
  };
  
  const handleEditItem = useCallback((product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  }, []);

  const onProductSaved = useCallback(async (productData: Omit<Product, 'id' | 'companyId'>, productId?: string) => {
    if (!company?.id || !productId || !firebase.db) return;
    try {
        await updateProduct(firebase.db, productId, { ...productData, companyId: company.id });
        toast({ title: "Sucesso!", description: "Item atualizado com sucesso." });
        
        setProducts(prevProducts => prevProducts.map(p => 
            p.id === productId ? { ...p, ...productData, id: productId, companyId: company.id } as Product : p
        ));
        
        setProductDialogOpen(false);
        setEditingProduct(undefined);
    } catch (e) {
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as alterações no item."});
    }
  }, [company, firebase.db, toast]);

  const handleSave = useCallback(async () => {
    if (!selectedClientId || !userProfile || !company || allItems.length === 0) {
        toast({
            variant: "destructive",
            title: "Dados Incompletos",
            description: "Por favor, selecione um cliente e adicione câmeras ou itens ao projeto."
        });
        return;
    }
    
    setIsSaving(true);
    try {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) throw new Error("Cliente não encontrado.");

        const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);
        const discountAmount = (subtotal * discountPercentage) / 100;
        const totalAfterDiscount = subtotal - discountAmount;

        const cftvDetailsToSave = JSON.parse(JSON.stringify({
            cameras: floorPlan.cameras,
            walls: floorPlan.walls,
            elements: floorPlan.elements,
            measurements: floorPlan.measurements,
            width: floorPlan.width,
            height: floorPlan.height,
            scale: floorPlan.scale,
            backgroundImage: floorPlan.backgroundImage,
            manualItems: manualItems,
        }, (key, value) => (value === undefined ? null : value)));


        const quoteData: QuoteData = {
            clientId: selectedClientId,
            clientName: client.name,
            companyId: company.id,
            companyName: company.name,
            items: allItems,
            total: totalAfterDiscount,
            discount: discountPercentage,
            status: 'draft',
            serviceType: 'CFTV',
            cftvDetails: cftvDetailsToSave,
            installments: installments,
            interestRate: interestRate,
        };

        if (!firebase.db || !firebase.auth) {
          throw new Error("Firebase não está inicializado.");
        }

        if (isEditing && quoteId) {
            await updateQuote(firebase.db, firebase.auth, quoteId, quoteData);
            toast({ title: 'Sucesso!', description: 'Projeto CFTV atualizado.'});
            router.push(`/orcamentos/details/${quoteId}`);
        } else {
            const { id: newQuoteId } = await addQuote(firebase.db, firebase.auth, quoteData);
            toast({ title: 'Sucesso!', description: 'Projeto salvo como um novo orçamento.'});
            router.push(`/orcamentos/details/${newQuoteId}`);
        }
    } catch(err: any) {
        toast({ variant: "destructive", title: "Erro ao Salvar", description: err.message });
    } finally {
        setIsSaving(false);
    }
  }, [allItems, floorPlan, selectedClientId, userProfile, company, clients, firebase, toast, router, discountPercentage, installments, interestRate, isEditing, quoteId, manualItems]);

  const handleRectangleDimensionsUpdate = useCallback((groupId: string, newDimensions: { width: number; height: number }) => {
    setFloorPlan(prev => {
        const groupWalls = prev.walls.filter(w => w.groupId === groupId);
        if (groupWalls.length < 4) return prev;

        const allX = groupWalls.flatMap(w => [w.x1, w.x2]);
        const allY = groupWalls.flatMap(w => [w.y1, w.y2]);
        const oldMinX = Math.min(...allX);
        const oldMinY = Math.min(...allY);
        
        const { width, height } = newDimensions;

        const newMaxX = oldMinX + width;
        const newMaxY = oldMinY + height;

        const updatedWalls = prev.walls.map(wall => {
            if (wall.groupId !== groupId) return wall;

            let newWall = { ...wall };

            if (Math.abs(wall.x1 - Math.min(...allX)) < 0.01) newWall.x1 = oldMinX;
            else if (Math.abs(wall.x1 - Math.max(...allX)) < 0.01) newWall.x1 = newMaxX;
            if (Math.abs(wall.y1 - Math.min(...allY)) < 0.01) newWall.y1 = oldMinY;
            else if (Math.abs(wall.y1 - Math.max(...allY)) < 0.01) newWall.y1 = newMaxY;
            
            if (Math.abs(wall.x2 - Math.min(...allX)) < 0.01) newWall.x2 = oldMinX;
            else if (Math.abs(wall.x2 - Math.max(...allX)) < 0.01) newWall.x2 = newMaxX;
            if (Math.abs(wall.y2 - Math.min(...allY)) < 0.01) newWall.y2 = oldMinY;
            else if (Math.abs(wall.y2 - Math.max(...allY)) < 0.01) newWall.y2 = newMaxY;
            
            return newWall;
        });

        return { ...prev, walls: updatedWalls, updatedAt: new Date() };
    });
  }, [setFloorPlan]);
  
  const selectedRectangleDimensions = useMemo(() => {
    if (!selectedWall || !selectedWall.groupId?.startsWith('rect_')) return null;
    const groupWalls = floorPlan.walls.filter(w => w.groupId === selectedWall.groupId);
    if (groupWalls.length < 4) return null;
    const allX = groupWalls.flatMap(w => [w.x1, w.x2]);
    const allY = groupWalls.flatMap(w => [w.y1, w.y2]);
    const width = Math.max(...allX) - Math.min(...allX);
    const height = Math.max(...allY) - Math.min(...allY);
    return { width, height };
  }, [selectedWall, floorPlan.walls]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const canScroll = target.closest('[data-scrollable="true"]');
    if (!canScroll) {
        event.preventDefault();
    }
  }, []);


  if (isLoading) {
    return <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /> Carregando...</div>
  }

  return (
    <div className="flex flex-col h-full overflow-y-hidden bg-background" onWheel={handleWheel}>
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 bg-background shadow-2xl shadow-primary/5 border border-border/40 rounded-[1.2rem] sticky top-4 z-20 mx-4 md:mx-8 mt-6">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-[1rem] bg-primary shadow-xl shadow-primary/30 text-white">
                    <Video className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                    <h1 className="font-bold tracking-tighter flex items-center gap-2 text-2xl text-primary uppercase">
                        Calculadora de Câmeras
                    </h1>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {isSaving && <Loader2 className="animate-spin text-primary h-5 w-5 mr-2" />}
                <Button type="button" variant="outline" className="h-9 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px] border-border/40 hover:bg-muted bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700" onClick={() => router.back()}>
                    Cancelar
                </Button>
                <Button type="button" className="h-9 px-8 rounded-xl font-bold uppercase tracking-widest bg-primary hover:scale-[1.02] active:scale-95 transition-all text-[10px] shadow-2xl shadow-primary/30" onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Projeto
                </Button>
            </div>
        </header>

      <div className="flex-1 flex flex-col gap-6 overflow-y-auto p-4 md:p-8" data-scrollable="true">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 min-h-[calc(100vh-200px)]">
          <main ref={mainCanvasContainerRef} className="flex flex-col h-full bg-background/95 backdrop-blur-3xl rounded-[2.5rem] border border-border/40 shadow-premium p-8 relative">
              <div className="flex items-center justify-between mb-6">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold tracking-tighter text-primary uppercase">Planta Técnica Interativa</h2>
                        <p className="text-[10px] text-primary/40 font-bold uppercase tracking-[0.2em]">Posicionamento e Ângulo de Visão</p>
                    </div>
              </div>

              <div className="flex-1 relative min-h-0">
                <FloorPlanCanvas
                  floorPlan={floorPlan}
                  setFloorPlan={setFloorPlan}
                  selectedCamera={selectedCamera}
                  selectedElement={selectedElement}
                  selectedWall={selectedWall}
                  drawingMode={drawingMode}
                  onDrawingModeChange={setDrawingMode}
                  onCameraAdd={handleCameraAdd}
                  onElementAdd={handleElementAdd}
                  onCameraSelect={handleCameraSelect}
                  onElementSelect={handleElementSelect}
                  onWallSelect={handleWallSelect}
                  onCameraUpdate={handleCameraUpdate}
                  onElementUpdate={handleElementUpdate}
                  onWallUpdate={handleWallUpdate}
                  onCameraDelete={handleCameraDelete}
                  onElementDelete={handleElementDelete}
                  onCameraRotate={handleCameraRotate}
                  onElementRotate={handleElementRotate}
                  onWallAdd={handleWallAdd}
                  onWallRemove={handleWallRemove}
                  onMeasurementAdd={handleMeasurementAdd}
                  onMeasurementRemove={handleMeasurementRemove}
                  backgroundImage={floorPlan.backgroundImage}
                  onImageUpload={(image) => setFloorPlan(prev => ({ ...prev, backgroundImage: image }))}
                  onImageRemove={() => setFloorPlan(prev => ({ ...prev, backgroundImage: undefined }))}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  clipboard={clipboard}
                  setClipboard={setClipboard}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  interactive={true}
                  zoom={zoom}
                  setZoom={setZoom}
                  viewOffset={viewOffset}
                  setViewOffset={setViewOffset}
                  onGroup={handleGroup}
                  onUngroup={handleUngroup}
                  onReorder={handleReorder}
                />
              </div>
          </main>
          <ControlsPanel
            selectedCamera={selectedCamera}
            selectedWall={selectedWall}
            selectedElement={selectedElement}
            walls={floorPlan.walls}
            cameras={floorPlan.cameras}
            elements={floorPlan.elements}
            floorPlan={floorPlan}
            onCameraUpdate={handleCameraUpdate}
            onWallUpdate={handleWallUpdate}
            onElementUpdate={handleElementUpdate}
            onCameraDelete={handleCameraDelete}
            onWallRemove={handleWallRemove}
            onElementDelete={handleElementDelete}
            onReorder={handleReorder}
            onExport={handleExport}
            onImport={handleImport}
            onSave={handleSave}
            onAddPresetCamera={handleAddPresetCamera}
            onAddElementPreset={handleElementAdd}
            onAddCameraFromModel={handleCameraAddModel}
            clients={clients}
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
            isSaving={isSaving}
            cameraProducts={filteredCameraProducts}
            measurements={floorPlan.measurements}
            onMeasurementRemove={handleMeasurementRemove}
            scale={floorPlan.scale}
            onScaleChange={handleScaleChange}
            showMeasurements={showMeasurements}
            onShowMeasurementsChange={setShowMeasurements}
            manufacturer={manufacturer}
            onManufacturerChange={setManufacturer}
            allManufacturers={allManufacturers}
            cableType={cableType}
            onCableTypeChange={setCableType}
            technologyType={technologyType}
            onTechnologyTypeChange={handleTechnologyTypeChange}
            ipSystemType={ipSystemType}
            onIpSystemTypeChange={setIpSystemType}
            selectedRectangleDimensions={selectedRectangleDimensions}
            onRectangleDimensionsUpdate={handleRectangleDimensionsUpdate}
            selectedIds={selectedIds}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
          <Card className="border-none bg-background/95 backdrop-blur-3xl rounded-[2.5rem] shadow-premium overflow-hidden">
            <CardHeader className="pb-4 pt-8 px-8 border-b border-border/40 bg-muted/30">
                <CardTitle className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    <ListChecks className="h-4 w-4 opacity-40" /> Lista de Materiais e Valores
                </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <CalculatedItemsTable 
                items={allItems}
                setItems={setManualItems}
                onItemChange={handleItemChange}
                onDeleteItem={handleDeleteItem}
                onEditItem={handleEditItem}
                onSaveQuote={handleSave}
                discountPercentage={discountPercentage}
                setDiscountPercentage={setDiscountPercentage}
                installments={installments}
                setInstallments={setInstallments}
                interestRate={interestRate}
                setInterestRate={setInterestRate}
              />
            </CardContent>
          </Card>
          <Card className="border-none bg-background/95 backdrop-blur-3xl rounded-[2.5rem] shadow-premium overflow-hidden">
            <CardHeader className="pb-4 pt-8 px-8 border-b border-border/40 bg-muted/30">
                <CardTitle className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    <Eye className="h-4 w-4 opacity-40" /> Preview do Projeto
                </CardTitle>
            </CardHeader>
             <CardContent className="p-4 h-[350px] relative">
                 <FloorPlanCanvas
                    floorPlan={floorPlan}
                    setFloorPlan={() => {}}
                    isMinimap={true}
                    interactive={false}
                    mainViewPort={{
                        zoom: zoom,
                        offset: viewOffset,
                        width: mainCanvasSize.width,
                        height: mainCanvasSize.height,
                    }}
                    selectedCamera={null}
                    selectedElement={null}
                    selectedWall={null}
                    drawingMode='select'
                    selectedIds={[]}
                    onSelectionChange={() => {}}
                 />
            </CardContent>
          </Card>
        </div>
      </div>
      <AddEditProductDialog
        isOpen={isProductDialogOpen}
        setOpen={setProductDialogOpen}
        onProductSaved={onProductSaved}
        product={editingProduct}
        suppliers={suppliers}
        locations={locations}
    />
    </div>
  );
}
