'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FloorPlanCanvas from '@/components/orcamentos/cameras/FloorPlanCanvas';
import ControlsPanel from '@/components/orcamentos/cameras/ControlsPanel';
import type { Camera, Wall, FloorPlan, DrawingMode, CameraPreset, Element as CftvElement, Measurement } from '@/lib/cftv-types';
import { useAuth } from '@/firebase/auth/use-user';
import { getProductsOnce, getClientsOnce, addQuote } from '@/lib/firebase/firestore';
import type { Product, Client, QuoteData, QuoteItem } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { calculateCftvMaterials } from '@/lib/cftv-calculator';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import CalculatedItemsTable from '@/components/orcamentos/calculated-items-table';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";


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

export default function CftvPlannerPage() {
  const [floorPlan, _setFloorPlan] = useState<FloorPlan>(defaultFloorPlan);
  const [history, setHistory] = useState<FloorPlan[]>([]);
  const [redoHistory, setRedoHistory] = useState<FloorPlan[]>([]);
  const floorPlanRef = useRef(floorPlan);

  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 50, y: 50 });
  const mainCanvasContainerRef = useRef<HTMLDivElement>(null);
  const [mainCanvasSize, setMainCanvasSize] = useState({ width: 0, height: 0 });
  
  const setFloorPlan = (updater: React.SetStateAction<FloorPlan>) => {
      const currentState = floorPlanRef.current;
      setHistory(prev => [...prev, currentState]);
      setRedoHistory([]);
      _setFloorPlan(updater);
  };
  
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
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('select');
  const [showCameraList, setShowCameraList] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clipboard, setClipboard] = useState<Camera | CftvElement | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  const [manufacturer, setManufacturer] = useState<string>('all');
  const [technologyType, setTechnologyType] = useState<string>('cabeada');
  const [ipSystemType, setIpSystemType] = useState<'nvr-poe' | 'nvr-no-poe' | 'dvr'>('nvr-poe');
  const [cableType, setCableType] = useState<'coaxial' | 'utp'>('utp');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [manualItems, setManualItems] = useState<QuoteItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [installments, setInstallments] = useState<number>(1);
  const [interestRate, setInterestRate] = useState<number>(0);

  const { userProfile, company, firebase } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!userProfile?.companyId || !firebase.db) {
        setIsLoading(false);
        return;
    }
    const { db } = firebase;
    const companyId = userProfile.companyId;

    async function loadInitialData() {
      try {
        const [productsData, clientsData] = await Promise.all([
          getProductsOnce(db, companyId),
          getClientsOnce(db, companyId),
        ]);
        setProducts(productsData);
        setClients(clientsData);
      } catch (error) {
        toast({ variant: "destructive", title: "Erro ao carregar dados" });
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, [userProfile?.companyId, firebase.db, toast]);
  
  const allManufacturers = useMemo(() => {
    return Array.from(new Set(products.map(p => p.manufacturer).filter(Boolean) as string[])).sort();
  }, [products]);

  const filteredCameraProducts = useMemo(() => {
    const cameraProducts = products.filter(p => p.segment === 'CÂMERAS');
    if (manufacturer === 'all') {
      return cameraProducts;
    }
    return cameraProducts.filter(p => p.manufacturer === manufacturer);
  }, [products, manufacturer]);

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
  }, []);

  const handleCameraAdd = useCallback((x: number, y: number) => {
    const newCamera: Camera = {
      id: `cam_${Date.now()}`,
      type: 'dome',
      name: `Câmera ${floorPlan.cameras.length + 1}`,
      x,
      y,
      z: 2.8,
      resolution: '4MP',
      dori: 20,
      horizontalAngle: 105,
      verticalAngle: 56,
      rotation: 0,
      tilt: -30,
      floor: 1,
      fovColor: '#3b82f6',
      showFov: true,
      irDistance: 30,
      lensType: '2.8mm',
      varifocalFocalLength: 2.8,
      isInternal: true,
    };
    
    setFloorPlan(prev => ({
      ...prev,
      cameras: [...prev.cameras, newCamera],
      updatedAt: new Date()
    }));
    
    setSelectedCamera(newCamera);
  }, [floorPlan.cameras.length]);

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
          'truck': { width: 6.5, depth: 2.5, height: 3.0, svgUrl: truckSvgUrl },
          'tree': { width: 3, depth: 3, height: 5, svgUrl: treeSvgUrl },
          'sofa': { width: 2.0, depth: 0.9, height: 0.8 },
          'table': { width: 1.6, depth: 0.8, height: 0.75 },
          'chair': { width: 0.5, depth: 0.5, height: 0.9 },
          'bed': { width: 1.9, depth: 2.0, height: 0.6 },
          'door': { width: 0.8, depth: 0.05, height: 2.1 },
          'window': { width: 1.2, depth: 0.1, height: 1.0 },
          'dvr': { width: 0.4, depth: 0.3, height: 0.1 },
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
  }, []);

  const handleCameraUpdate = useCallback((updatedCamera: Camera) => {
    setFloorPlan(prev => ({
      ...prev,
      cameras: prev.cameras.map(cam => 
        cam.id === updatedCamera.id ? updatedCamera : cam
      ),
      updatedAt: new Date()
    }));
    
    setSelectedCamera(updatedCamera);
  }, []);

  const handleElementUpdate = useCallback((updatedElement: CftvElement) => {
    setFloorPlan(prev => ({
        ...prev,
        elements: prev.elements.map(elem =>
            elem.id === updatedElement.id ? updatedElement : elem
        )
    }));
    setSelectedElement(updatedElement);
  }, []);

  const handleWallUpdate = useCallback((updatedWall: Wall) => {
    setFloorPlan(prev => ({
      ...prev,
      walls: prev.walls.map(wall => 
        wall.id === updatedWall.id ? updatedWall : wall
      ),
      updatedAt: new Date()
    }));
    setSelectedWall(updatedWall);
  }, []);

  const handleCameraDelete = useCallback((cameraId: string) => {
    setFloorPlan(prev => ({
      ...prev,
      cameras: prev.cameras.filter(cam => cam.id !== cameraId),
      updatedAt: new Date()
    }));
    
    if (selectedCamera?.id === cameraId) {
      setSelectedCamera(null);
    }
  }, [selectedCamera]);

  const handleElementDelete = useCallback((elementId: string) => {
    setFloorPlan(prev => ({
      ...prev,
      elements: prev.elements.filter(elem => elem.id !== elementId)
    }));
    if (selectedElement?.id === elementId) {
      setSelectedElement(null);
    }
  }, [selectedElement]);

  const handleWallAdd = useCallback((wall: Wall) => {
    setFloorPlan(prev => ({
      ...prev,
      walls: [...prev.walls, wall],
      updatedAt: new Date()
    }));
  }, []);

  const handleWallRemove = useCallback((wallId: string) => {
    setFloorPlan(prev => ({
      ...prev,
      walls: prev.walls.filter(wall => wall.id !== wallId),
      updatedAt: new Date()
    }));
    if (selectedWall?.id === wallId) {
        setSelectedWall(null);
    }
  }, [selectedWall]);

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
  }, []);

  const handleMeasurementRemove = useCallback((id: string) => {
    setFloorPlan(prev => ({
        ...prev,
        measurements: prev.measurements.filter(m => m.id !== id)
    }));
  }, []);

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
  }, [floorPlan.width, floorPlan.height]);
  
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
  
  const handleItemChange = (itemId: string, newQuantity: string | number) => {
    setManualItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const quantity = typeof newQuantity === 'string' ? parseFloat(newQuantity) : newQuantity;
        if (isNaN(quantity) || quantity < 0) return item;
        return {
          ...item,
          quantity,
          total: round((item.materialPrice + (item.servicePrice || 0)) * quantity)
        }
      }
      return item;
    }))
  };

  const handleDeleteItem = (itemId: string) => {
    setManualItems(prev => prev.filter(item => item.id !== itemId));
  };
  
  const allItems = useMemo(() => {
    const cameraItems: QuoteItem[] = floorPlan.cameras.map(cam => {
      const product = filteredCameraProducts.find(p => p.description.toLowerCase().includes(cam.name.toLowerCase()));
      const price = product?.sellingPrice || 0;
      const servicePrice = 150;

      const itemProduct: Product = product || {
          id: `manual-${cam.id}`,
          item: 'N/A-CÂMERA',
          description: cam.name,
          unit: 'UNID',
          materialPrice: 0,
          sellingPrice: price,
          servicePrice: servicePrice,
          segment: 'CÂMERAS',
          status: 'Ativo',
          companyId: company?.id || '',
      };
      
      return {
          id: cam.id,
          product: itemProduct,
          quantity: 1,
          materialPrice: price,
          servicePrice: servicePrice,
          total: price + servicePrice,
      };
    });
    
    const materialItems = calculateCftvMaterials(floorPlan.cameras, floorPlan.elements, products, cableType, technologyType, ipSystemType);

    const combined = new Map<string, QuoteItem>();

    materialItems.forEach(item => {
      const productId = item.product?.id || (item as any).productId || 'unknown';
      if (combined.has(productId)) {
          const existing = combined.get(productId)!;
          existing.quantity += item.quantity;
          existing.total += (item.total || 0);
      } else {
          combined.set(productId, { ...item });
      }
    });

    cameraItems.forEach(item => {
      combined.set(item.id, { ...item });
    });

    manualItems.forEach(item => {
        const productId = item.product?.id || (item as any).productId || 'manual-item';
        if (combined.has(productId)) {
            const existing = combined.get(productId)!;
            existing.quantity += item.quantity;
            existing.total += (item.total || 0);
        } else {
            combined.set(productId, { ...item });
        }
    });
    
    return Array.from(combined.values());
  }, [floorPlan.cameras, floorPlan.elements, products, cableType, manualItems, filteredCameraProducts, company]);

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

        await addQuote(firebase.db, firebase.auth, quoteData);
        toast({ title: 'Sucesso!', description: 'Projeto salvo como um novo orçamento.'});
        router.push('/orcamentos');
    } catch(err: any) {
        toast({ variant: "destructive", title: "Erro ao Salvar", description: err.message });
    } finally {
        setIsSaving(false);
    }
  }, [allItems, floorPlan, selectedClientId, userProfile, company, clients, products, firebase, toast, router, discountPercentage, installments, interestRate]);

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
  }, []);
  
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

  if (isLoading) {
    return <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /> Carregando...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top section for drawing */}
      <div className="grid grid-cols-1" style={{ height: '65vh' }}>
        <div className="grid grid-cols-[320px_1fr] gap-4 h-full">
            <div className="flex flex-col gap-4">
                <ControlsPanel
                    selectedCamera={selectedCamera}
                    selectedWall={selectedWall}
                    selectedElement={selectedElement}
                    walls={floorPlan.walls}
                    elements={floorPlan.elements}
                    cameras={floorPlan.cameras}
                    floorPlan={floorPlan}
                    onCameraUpdate={handleCameraUpdate}
                    onWallUpdate={handleWallUpdate}
                    onElementUpdate={handleElementUpdate}
                    onCameraDelete={handleCameraDelete}
                    onWallRemove={handleWallRemove}
                    onElementDelete={handleElementDelete}
                    onGroup={() => {}}
                    onUngroup={() => {}}
                    onExport={handleExport}
                    onImport={handleImport}
                    onSave={handleSave}
                    onAddPresetCamera={handleAddPresetCamera}
                    onAddElementPreset={handleElementAdd}
                    onAddCameraFromModel={() => {}}
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
                    onTechnologyTypeChange={setTechnologyType}
                    ipSystemType={ipSystemType}
                    onIpSystemTypeChange={setIpSystemType}
                    selectedRectangleDimensions={selectedRectangleDimensions}
                    onRectangleDimensionsUpdate={handleRectangleDimensionsUpdate}
                    selectedIds={selectedIds}
                />
            </div>
            <main ref={mainCanvasContainerRef} className="relative h-full bg-muted/40 rounded-lg border">
                <FloorPlanCanvas
                    floorPlan={floorPlan}
                    setFloorPlan={setFloorPlan}
                    selectedCamera={selectedCamera}
                    selectedElement={selectedElement}
                    selectedWall={selectedWall}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
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
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    interactive={true}
                    zoom={zoom}
                    setZoom={setZoom}
                    viewOffset={viewOffset}
                    setViewOffset={setViewOffset}
                />
            </main>
        </div>
      </div>

      {/* Bottom summary section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
            <CardHeader><CardTitle>Itens do Orçamento</CardTitle></CardHeader>
            <CardContent>
                <CalculatedItemsTable 
                    items={allItems}
                    setItems={setManualItems}
                    onItemChange={handleItemChange}
                    onDeleteItem={handleDeleteItem}
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
        <Card>
            <CardHeader><CardTitle>Visualização</CardTitle></CardHeader>
            <CardContent className="h-[400px] relative">
                 <FloorPlanCanvas
                    floorPlan={floorPlan}
                    setFloorPlan={() => {}}
                    selectedIds={[]}
                    onSelectionChange={() => {}}
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
                 />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
