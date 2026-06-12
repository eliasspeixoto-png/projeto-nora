
      'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { Camera as CftvCamera, Wall, Element as CftvElement, Measurement, DrawingMode, ElementType, FloorPlan } from '@/lib/cftv-types';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  Grid3x3,
  Hand,
  Combine,
  Ungroup,
  MousePointer2,
  Camera as CameraIcon,
  Ruler,
  Eraser,
  Shapes,
  Image as ImageIcon,
  Undo,
  Redo,
  Square,
  Circle,
  Triangle,
  Orbit,
  Spline,
  Type as TypeIcon,
  RectangleHorizontal,
  GitFork,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
// DxfParser importado dinamicamente no handleFileUpload

function hexToRgba(hex: string, alpha: number): string {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const Z_OFFSET_FACTOR = -0.15;

const getElementSVG = (type: string, subtype: string | undefined, color: string): string => {
  if (typeof window === 'undefined') return ''; // Avoid calling btoa on server
  
  const safeColor = color || '#6b7280';
  // Create a slightly lighter color for highlights if it's a hex
  const lighterColor = safeColor.length === 7 ? `${safeColor}cc` : safeColor;
  const darkerColor = safeColor.length === 7 ? `${safeColor}ff` : safeColor; // Full opacity for "darker" areas

  switch (type) {
    case 'person':
      return '/assets/elements/person.png';
    
    case 'vehicle':
      if (subtype === 'car') {
        return '';
      } else if (subtype === 'truck') {
        return '';
      }
      break;
    
    case 'tree':
      return '';
    
    case 'dvr':
      return '/assets/elements/dvr.png';
    
    default:
        return '';
  }
  return '';
};


interface FloorPlanCanvasProps {
  floorPlan: FloorPlan;
  setFloorPlan: (updater: React.SetStateAction<FloorPlan>) => void;
  selectedCamera: CftvCamera | null;
  selectedElement: CftvElement | null;
  selectedWall: Wall | null;
  drawingMode: DrawingMode;
  onDrawingModeChange?: (mode: DrawingMode) => void;
  onCameraAdd?: (x: number, y: number) => void;
  onElementAdd?: (element: Partial<CftvElement>) => void;
  onCameraSelect?: (camera: CftvCamera | null) => void;
  onElementSelect?: (element: CftvElement | null) => void;
  onWallSelect?: (wall: Wall | null) => void;
  onCameraUpdate?: (camera: CftvCamera) => void;
  onElementUpdate?: (element: CftvElement) => void;
  onWallUpdate?: (wall: Wall) => void;
  onCameraDelete?: (id: string) => void;
  onElementDelete?: (id: string) => void;
  onCameraRotate?: (id: string, rotation: number) => void;
  onElementRotate?: (id: string, rotation: number) => void;
  onWallAdd?: (wall: Wall) => void;
  onWallRemove?: (id: string) => void;
  onMeasurementAdd?: (measurement: Measurement) => void;
  onMeasurementRemove?: (id: string) => void;
  onImageUpload?: (image: string) => void;
  onImageRemove?: () => void;
  backgroundImage?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  clipboard?: CftvCamera | CftvElement | null;
  setClipboard?: (item: CftvCamera | CftvElement | null) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  interactive?: boolean;
  zoom?: number;
  setZoom?: React.Dispatch<React.SetStateAction<number>>;
  viewOffset?: { x: number; y: number };
  setViewOffset?: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
  onGroup?: () => void;
  onUngroup?: () => void;
  onReorder?: (id: string, direction: 'front' | 'back') => void;
  isMinimap?: boolean;
  mainViewPort?: {
    zoom: number;
    offset: { x: number; y: number };
    width: number;
    height: number;
  };
}

const ToolbarButton = ({ title, isActive, onClick, className, children }: { title: string, isActive: boolean, onClick: () => void, className?: string, children: React.ReactNode }) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <button
                onClick={onClick}
                className={`p-2 rounded-md ${isActive ? "bg-primary/20 text-primary" : "hover:bg-muted"} ${className || ""}`}
                title={title}
            >
                {children}
            </button>
        </TooltipTrigger>
        <TooltipContent side="right"><p>{title}</p></TooltipContent>
    </Tooltip>
);

function findIntersection(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): { x: number; y: number } | null {
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) {
        return null; // As linhas são paralelas ou colineares
    }
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { 
        const pt = {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1),
        };
        return pt;
    }
    return null;
}

export default function FloorPlanCanvas({
  floorPlan,
  setFloorPlan,
  selectedCamera,
  selectedElement,
  selectedWall,
  drawingMode,
  onDrawingModeChange,
  onCameraAdd,
  onElementAdd,
  onCameraSelect,
  onElementSelect,
  onWallSelect,
  onCameraUpdate,
  onElementUpdate,
  onWallUpdate,
  onCameraDelete,
  onElementDelete,
  onCameraRotate,
  onElementRotate,
  onWallAdd,
  onWallRemove,
  onMeasurementAdd,
  onMeasurementRemove,
  onImageUpload,
  onImageRemove,
  backgroundImage,
  onUndo,
  onRedo,
  clipboard,
  setClipboard,
  interactive = true,
  zoom: zoomProp,
  setZoom: setZoomProp,
  viewOffset: viewOffsetProp,
  setViewOffset: setViewOffsetProp,
  isMinimap = false,
  selectedIds = [],
  onSelectionChange,
  mainViewPort,
  onGroup,
  onUngroup,
  onReorder,
}: FloorPlanCanvasProps) {
  const { width, height, scale, cameras, walls, elements, measurements } = floorPlan;

  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const didCenterRef = useRef(false);

  const [internalZoom, setInternalZoom] = useState(1);
  const [internalViewOffset, setInternalViewOffset] = useState({ x: 50, y: 50 });
  const [imageCache, setImageCache] = useState(new Map<string, HTMLImageElement | 'loading'>());
  const [bgImageObject, setBgImageObject] = useState<HTMLImageElement | null>(null);

  const [eraserSize, setEraserSize] = useState(20);
  const [isErasing, setIsErasing] = useState(false);


  const zoom = zoomProp ?? internalZoom;
  const setZoom = setZoomProp ?? setInternalZoom;
  const viewOffset = viewOffsetProp ?? internalViewOffset;
  const setViewOffset = setViewOffsetProp ?? setInternalViewOffset;

  const [isDragging, setIsDragging] = useState(false); // for panning
  const [draggedObject, setDraggedObject] = useState<{ id: string; type: 'camera' | 'element' | 'wall' | 'wall_group' } | null>(null); // for moving objects
  const [draggedWallHandle, setDraggedWallHandle] = useState<'start' | 'end' | null>(null);
  const [rotatingObject, setRotatingObject] = useState<{ 
    id: string; 
    type: 'camera' | 'element' | 'wall_group' | 'multi'; 
    centerX: number; 
    centerY: number;
    initialMouseAngle?: number;
    originalItems?: any[];
  } | null>(null);
  const [resizingObject, setResizingObject] = useState<{ groupId: string; handle: string; } | null>(null);
  const [rotatingCameraId, setRotatingCameraId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [wallChainStart, setWallChainStart] = useState<{ x: number; y: number } | null>(null);
  const [wallControlPoint, setWallControlPoint] = useState<{ x: number; y: number } | null>(null);
  const [measurePoints, setMeasurePoints] = useState<{ x: number; y: number }[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [elementShape, setElementShape] = useState<ElementType | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(true); // From props or own state
  const [rectangleStart, setRectangleStart] = useState<{ x: number; y: number } | null>(null);
  const [currentChainIds, setCurrentChainIds] = useState<string[]>([]);
  const [resizingPolygonHandle, setResizingPolygonHandle] = useState<{ groupId: string; vertex: { x: number; y: number } } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  useEffect(() => {
    if (!backgroundImage) {
      setBgImageObject(null);
      return;
    }
  
    const img = new Image();
    img.src = backgroundImage;
    
    const handleLoad = () => {
      setBgImageObject(img);
    };

    const handleError = () => {
      console.error("Failed to load background image from data URL.");
      setBgImageObject(null);
      if (setFloorPlan) {
        setFloorPlan(prev => {
          if (prev.backgroundImage) {
            return { ...prev, backgroundImage: undefined };
          }
          return prev;
        });
      }
      if (toast) {
        toast({
          variant: "destructive",
          title: "Erro ao Carregar Imagem",
          description: "O arquivo pode estar corrompido ou em um formato não suportado.",
        });
      }
    };
    
    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);

    // Cleanup function
    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundImage]);

  useEffect(() => {
    const loadSvgForElement = async (element: CftvElement) => {
      const builtInSvgUrl = getElementSVG(element.type, element.subtype, element.color);
      const finalSvgUrl = element.svgUrl || builtInSvgUrl;
      
      if (!finalSvgUrl || imageCache.get(finalSvgUrl) === 'loading') {
        return;
      }
      
      // If the color changed, we want to reload/re-generate the SVG image
      // But imageCache is keyed by the data URL string, which now contains the color.
      // So this naturally handles color changes.
      
      if (imageCache.has(finalSvgUrl)) {
          return;
      }

      setImageCache(prev => new Map(prev).set(finalSvgUrl, 'loading'));

      try {
        const img = new Image();
        img.src = finalSvgUrl;
        img.onload = () => {
          setImageCache(prev => new Map(prev).set(finalSvgUrl, img));
        };
        img.onerror = () => {
          throw new Error('Image failed to load');
        }
      } catch (e) {
        console.error('Failed to load or render SVG:', e);
        setImageCache(prev => {
            const newCache = new Map(prev);
            if (newCache.get(finalSvgUrl) === 'loading') {
                newCache.delete(finalSvgUrl);
            }
            return newCache;
        });
      }
    };

    elements.forEach(loadSvgForElement);
  }, [elements, imageCache]);


  const drawGrid2D = useCallback((ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, zoom: number, viewOffset: { x: number; y: number }) => {
    if (!showGrid || isMinimap) return;

    const planCanvasX = viewOffset.x;
    const planCanvasY = viewOffset.y;
    const planCanvasWidth = width * scale * zoom;
    const planCanvasHeight = height * scale * zoom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(planCanvasX, planCanvasY, planCanvasWidth, planCanvasHeight);
    ctx.clip();

    const gridSize = 1 * scale * zoom;

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let x = viewOffset.x % gridSize; x < canvasWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    for (let y = viewOffset.y % gridSize; y < canvasHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    ctx.restore();
}, [width, height, scale, showGrid, isMinimap]);

  const drawElements2D = useCallback((ctx: CanvasRenderingContext2D, zoom: number, viewOffset: { x: number; y: number }) => {
    elements.forEach(element => {
      const x = element.x * scale * zoom + viewOffset.x;
      const y = element.y * scale * zoom + viewOffset.y;
      const isSelected = selectedIds.includes(element.id);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((element.rotation * Math.PI) / 180);

      const elemWidth = element.width * scale * zoom;
      const elemDepth = element.depth * scale * zoom;
      
      const builtInSvgUrl = getElementSVG(element.type, element.subtype, element.color);
      const finalSvgUrl = element.svgUrl || builtInSvgUrl;
      
      if (finalSvgUrl) {
          const cachedImage = imageCache.get(finalSvgUrl);
          if (cachedImage instanceof HTMLImageElement && cachedImage.complete) {
              ctx.drawImage(cachedImage, -elemWidth / 2, -elemDepth / 2, elemWidth, elemDepth);
          } else {
              // Placeholder while loading
              ctx.fillStyle = element.color || 'rgba(200, 200, 200, 0.5)';
              ctx.globalAlpha = 0.5;
              ctx.fillRect(-elemWidth / 2, -elemDepth / 2, elemWidth, elemDepth);
              ctx.globalAlpha = 1.0;
              ctx.strokeStyle = '#999';
              ctx.strokeRect(-elemWidth / 2, -elemDepth / 2, elemWidth, elemDepth);
          }
      } else {
            const drawDoor = (openAngle = 45) => {
                const doorWidth = elemWidth;
                const doorDepth = elemDepth; // Wall thickness
                
                ctx.fillStyle = element.color || '#a16207';
                // Door panel
                ctx.fillRect(-doorDepth/2, 0, doorDepth, -doorWidth);
                
                // Arc
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, doorWidth, 0, (openAngle * Math.PI) / 180, false);
                ctx.lineTo(0,0);
                ctx.closePath();
                ctx.strokeStyle = element.color || '#a16207';
                ctx.lineWidth = 1;
                ctx.setLineDash([3,3]);
                ctx.stroke();
                ctx.setLineDash([]);
            };
            
            switch (element.type) {
                case 'text':
                    ctx.fillStyle = element.color || '#000000';
                    const fontSize = (element.fontSize || 14) * zoom;
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    const textLines = (element.text || '').split('\n');
                    const lineHeight = fontSize * 1.2;
                    textLines.forEach((line, index) => {
                        const textMetrics = ctx.measureText(line);
                        // Center the block of text horizontally, but draw lines from top to bottom
                        const textBlockHeight = textLines.length * lineHeight;
                        ctx.fillText(line, -textMetrics.width / 2, -textBlockHeight / 2 + (index * lineHeight));
                    });
                    break;
                case 'dvr':
                    const dvrWidth = elemWidth;
                    const dvrDepth = elemDepth;
                    ctx.fillStyle = element.color || '#4b5563'; // gray-600
                    ctx.fillRect(-dvrWidth/2, -dvrDepth/2, dvrWidth, dvrDepth);
                    ctx.fillStyle = 'rgba(0,255,0,0.6)';
                    ctx.beginPath();
                    ctx.arc(-dvrWidth/4, 0, dvrWidth * 0.05, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,255,0.6)';
                    ctx.beginPath();
                    ctx.arc(dvrWidth/4, 0, dvrWidth * 0.05, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                default:
                    ctx.fillStyle = element.color || '#9ca3af'; // gray-400
                    ctx.fillRect(-elemWidth / 2, -elemDepth / 2, elemWidth, elemDepth);
            }
        }

      ctx.restore();

      if (isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        let selectionWidth = elemWidth;
        let selectionHeight = elemDepth;
        
        const padding = 5;
        ctx.strokeRect(
          x - (selectionWidth / 2) - padding, y - (selectionHeight / 2) - padding,
          selectionWidth + padding*2, selectionHeight + padding*2
        );
        ctx.setLineDash([]);
      }
    });
  }, [elements, selectedElement, scale, imageCache]);

  const drawMeasurements2D = useCallback((ctx: CanvasRenderingContext2D, zoom: number, viewOffset: { x: number; y: number }) => {
    if (!showMeasurements) return;

    measurements.forEach(measurement => {
      if (measurement.points.length < 2) return;

      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      for (let i = 0; i < measurement.points.length - 1; i++) {
        const p1 = measurement.points[i];
        const p2 = measurement.points[i + 1];

        const x1 = p1.x * scale * zoom + viewOffset.x;
        const y1 = p1.y * scale * zoom + viewOffset.y;
        const x2 = p2.x * scale * zoom + viewOffset.x;
        const y2 = p2.y * scale * zoom + viewOffset.y;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        ctx.fillStyle = '#7c3aed';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${distance.toFixed(2)}m`, midX, midY - 10);
      }

      ctx.setLineDash([]);
    });

    if (measurePoints.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);

      for (let i = 0; i < measurePoints.length - 1; i++) {
        const p1 = measurePoints[i];
        const p2 = measurePoints[i + 1];

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const worldX1 = (p1.x - viewOffset.x) / (scale * zoom);
        const worldY1 = (p1.y - viewOffset.y) / (scale * zoom);
        const worldX2 = (p2.x - viewOffset.x) / (scale * zoom);
        const worldY2 = (p2.y - viewOffset.y) / (scale * zoom);
        const distance = Math.sqrt(
          Math.pow(worldX2 - worldX1, 2) + Math.pow(worldY2 - worldY1, 2)
        );

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        ctx.fillStyle = '#059669';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${distance.toFixed(2)}m`, midX, midY - 5);
      }

      ctx.setLineDash([]);
    }
  }, [measurements, measurePoints, scale, showMeasurements]);

  const draw2D = useCallback((e?: React.MouseEvent) => {
    const canvas = canvas2DRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    let localZoom = zoom;
    let localViewOffset = viewOffset;

    if (isMinimap) {
      const planWidth = width * scale;
      const planHeight = height * scale;
      if (planWidth > 0 && planHeight > 0 && canvasWidth > 0 && canvasHeight > 0) {
        const autoZoom = Math.min(canvasWidth / planWidth, canvasHeight / planHeight) * 0.9;
        localZoom = autoZoom;
        
        const newViewOffsetX = (canvasWidth - planWidth * localZoom) / 2;
        const newViewOffsetY = (canvasHeight - planHeight * localZoom) / 2;
        localViewOffset = { x: newViewOffsetX, y: newViewOffsetY };
      }
    }
    
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (bgImageObject) {
      const planWidth = width * scale * localZoom;
      const planHeight = height * scale * localZoom;
      ctx.drawImage(bgImageObject, localViewOffset.x, localViewOffset.y, planWidth, planHeight);
    }
    
    drawGrid2D(ctx, canvasWidth, canvasHeight, localZoom, localViewOffset);

    // Draw drawing area border
    if (!isMinimap) {
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.lineWidth = 1;
      ctx.strokeRect(localViewOffset.x, localViewOffset.y, width * scale * localZoom, height * scale * localZoom);
    }
    
    drawElements2D(ctx, localZoom, localViewOffset);

    walls.forEach(wall => {
      const isSelected = selectedIds.includes(wall.id) || (wall.groupId && selectedIds.includes(wall.groupId));
      const x1 = wall.x1 * scale * localZoom + localViewOffset.x;
      const y1 = wall.y1 * scale * localZoom + localViewOffset.y;
      const x2 = wall.x2 * scale * localZoom + localViewOffset.x;
      const y2 = wall.y2 * scale * localZoom + localViewOffset.y;

      ctx.strokeStyle = isSelected ? '#3b82f6' : (wall.color || '#000000');
      const baseThickness = 3;
      ctx.lineWidth = Math.max(2, isSelected ? baseThickness + 2 : baseThickness);


      if (wall.lineStyle === 'dashed') {
          ctx.setLineDash([8 * localZoom, 8 * localZoom]);
      } else if (wall.lineStyle === 'dotted') {
          ctx.setLineDash([2 * localZoom, 6 * localZoom]);
      } else {
          ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);

      if (wall.controlPoint) {
        const cpX = wall.controlPoint.x * scale * localZoom + localViewOffset.x;
        const cpY = wall.controlPoint.y * scale * localZoom + localViewOffset.y;
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      } else {
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      ctx.setLineDash([]);

      const wallLength = Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2));
        if (showMeasurements && localZoom > 0.4 && !isMinimap) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            ctx.save();
            ctx.translate(midX, midY);
            let angle = Math.atan2(y2 - y1, x2 - x1);
            if (angle < -Math.PI / 2 || angle > Math.PI / 2) {
                angle += Math.PI;
            }
            ctx.rotate(angle);
            
            const text = `${wallLength.toFixed(2)}m`;
            const textMetrics = ctx.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = 12; // Approximation for 12px font

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(-textWidth / 2 - 4, 0, textWidth + 8, -textHeight - 4);


            ctx.fillStyle = '#374151';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(text, 0, -5);
            ctx.restore();
        }

        if (isSelected && !isMinimap && !selectedWall?.groupId) {
            const handleRadius = 8;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(x1, y1, handleRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(x2, y2, handleRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    });

    // Helper to calculate collective bounding box for rotation handle
    let selMinX = Infinity, selMinY = Infinity, selMaxX = -Infinity, selMaxY = -Infinity;
    let hasSelection = false;

    if (selectedIds.length > 0) {
        cameras.forEach(c => {
            if (selectedIds.includes(c.id)) {
                selMinX = Math.min(selMinX, c.x - 0.5); selMinY = Math.min(selMinY, c.y - 0.5);
                selMaxX = Math.max(selMaxX, c.x + 0.5); selMaxY = Math.max(selMaxY, c.y + 0.5);
                hasSelection = true;
            }
        });
        elements.forEach(e => {
            if (selectedIds.includes(e.id)) {
                selMinX = Math.min(selMinX, e.x - e.width/2); selMinY = Math.min(selMinY, e.y - e.depth/2);
                selMaxX = Math.max(selMaxX, e.x + e.width/2); selMaxY = Math.max(selMaxY, e.y + e.depth/2);
                hasSelection = true;
            }
        });
        walls.forEach(w => {
            if (selectedIds.includes(w.id) || (w.groupId && selectedIds.includes(w.groupId))) {
                selMinX = Math.min(selMinX, w.x1, w.x2); selMinY = Math.min(selMinY, w.y1, w.y2);
                selMaxX = Math.max(selMaxX, w.x1, w.x2); selMaxY = Math.max(selMaxY, w.y1, w.y2);
                hasSelection = true;
            }
        });
    }

    if (hasSelection && !isDragging) {
        const handleSize = 10;
        const centerX = (selMinX + selMaxX) / 2;
        const centerY = (selMinY + selMaxY) / 2;
        const handleY = selMinY - 30 / (scale * zoom);
        
        const canvasCenterX = centerX * scale * zoom + viewOffset.x;
        const canvasHandleY = handleY * scale * zoom + viewOffset.y;

        // Bounding box outline
        ctx.strokeStyle = '#3b82f6';
        ctx.setLineDash([2, 5]);
        ctx.lineWidth = 1;
        ctx.strokeRect(
            selMinX * scale * zoom + viewOffset.x,
            selMinY * scale * zoom + viewOffset.y,
            (selMaxX - selMinX) * scale * zoom,
            (selMaxY - selMinY) * scale * zoom
        );
        ctx.setLineDash([]);

        // Rotation line
        ctx.beginPath();
        ctx.moveTo(canvasCenterX, selMinY * scale * zoom + viewOffset.y);
        ctx.lineTo(canvasCenterX, canvasHandleY);
        ctx.stroke();

        // Rotation handle
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(canvasCenterX, canvasHandleY, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    if (selectionBox) {
        ctx.strokeStyle = '#3b82f6';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.strokeRect(selectionBox.x1, selectionBox.y1, selectionBox.x2 - selectionBox.x1, selectionBox.y2 - selectionBox.y1);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(selectionBox.x1, selectionBox.y1, selectionBox.x2 - selectionBox.x1, selectionBox.y2 - selectionBox.y1);
        ctx.setLineDash([]);
    }
    
    if (selectedWall?.groupId) {
      if (selectedWall.groupId.startsWith('rect_')) {
        const groupWalls = walls.filter(w => w.groupId === selectedWall.groupId);
        if (groupWalls.length === 4) { // It's a rectangle
            const allX = groupWalls.flatMap(w => [w.x1, w.x2]);
            const allY = groupWalls.flatMap(w => [w.y1, w.y2]);
            const minX = Math.min(...allX);
            const minY = Math.min(...allY);
            const maxX = Math.max(...allX);
            const maxY = Math.max(...allY);

            const handleSize = 8;
            const handles = [
                { x: minX, y: minY, name: 'top-left' }, { x: maxX, y: minY, name: 'top-right' },
                { x: minX, y: maxY, name: 'bottom-left' }, { x: maxX, y: maxY, name: 'bottom-right' },
                { x: (minX + maxX) / 2, y: minY, name: 'top-middle' }, { x: (minX + maxX) / 2, y: maxY, name: 'bottom-middle' },
                { x: minX, y: (minY + maxY) / 2, name: 'left-middle' }, { x: maxX, y: (minY + maxY) / 2, name: 'right-middle' },
            ];

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;

            handles.forEach(handle => {
                const canvasX = handle.x * scale * localZoom + localViewOffset.x;
                const canvasY = handle.y * scale * localZoom + localViewOffset.y;
                ctx.beginPath();
                ctx.rect(canvasX - handleSize / 2, canvasY - handleSize / 2, handleSize, handleSize);
                ctx.fill();
                ctx.stroke();
            });
          }
      } else { // Polygon
        const groupWalls = walls.filter(w => w.groupId === selectedWall.groupId);
        const vertices = new Map<string, {x: number, y: number}>();
        groupWalls.forEach(w => {
            vertices.set(`${w.x1.toFixed(3)},${w.y1.toFixed(3)}`, {x: w.x1, y: w.y1});
            vertices.set(`${w.x2.toFixed(3)},${w.y2.toFixed(3)}`, {x: w.x2, y: w.y2});
        });
        const uniqueVertices = Array.from(vertices.values());
        const handleRadius = 5;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        uniqueVertices.forEach(vertex => {
            const canvasX = vertex.x * scale * localZoom + localViewOffset.x;
            const canvasY = vertex.y * scale * localZoom + localViewOffset.y;
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, handleRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
      }
    }
    
    const obstacles3D = [
        ...walls.map(wall => ({ ...wall, height: 999 })), 
        ...elements.filter(el => el.type !== 'text').flatMap(el => {
            const { x: cx, y: cy, width: w, depth: d, rotation } = el;
            const elemHeight = el.height || 1.5;
            const elemRotationRad = rotation * Math.PI / 180;
            const cosR = Math.cos(elemRotationRad);
            const sinR = Math.sin(elemRotationRad);
            const corners = [
                { x: -w/2, y: -d/2 }, { x: w/2, y: -d/2 },
                { x: w/2, y: d/2 }, { x: -w/2, y: d/2 }
            ].map(p => ({
                x: cx + p.x * cosR - p.y * sinR,
                y: cy + p.x * sinR + p.y * cosR
            }));
            const sides = [];
            for (let i = 0; i < 4; i++) {
                sides.push({ 
                    id: `${el.id}-side-${i}`, 
                    x1: corners[i].x, y1: corners[i].y, 
                    x2: corners[(i + 1) % 4].x, y2: corners[(i + 1) % 4].y, 
                    height: elemHeight
                });
            }
            return sides;
        })
    ];

    cameras.forEach(camera => {
      const isSelected = selectedIds.includes(camera.id);
      if (camera.showFov) {
          const zOffsetX = camera.z * scale * localZoom * Z_OFFSET_FACTOR;
          const zOffsetY = camera.z * scale * localZoom * Z_OFFSET_FACTOR;
          const iconCanvasX = (camera.x * scale * localZoom + localViewOffset.x) + zOffsetX;
          const iconCanvasY = (camera.y * scale * localZoom + localViewOffset.y) + zOffsetY;

          const lowerRayAngleRad = (camera.tilt - camera.verticalAngle / 2) * Math.PI / 180;
          let tanLowerAngle = 0;
          if (lowerRayAngleRad < 0) {
              tanLowerAngle = Math.tan(-lowerRayAngleRad);
          }
          
          let blindSpotRadiusMeters = 0;
          if (tanLowerAngle > 0.001 && camera.z > 0) {
              blindSpotRadiusMeters = camera.z / tanLowerAngle;
          }

          const upperRayAngleRad = (camera.tilt + camera.verticalAngle / 2) * Math.PI / 180;
          let geometricReach = Infinity;
          if (upperRayAngleRad < 0) {
              const tanUpperAngle = Math.tan(-upperRayAngleRad);
              if (tanUpperAngle > 0.001) {
                  geometricReach = camera.z / tanUpperAngle;
              }
          }

          const calculateFovPathPoints = (radius: number, obstacles: typeof obstacles3D, geometricReachForCalc: number) => {
              const startAngle = camera.rotation - camera.horizontalAngle / 2;
              const endAngle = camera.rotation + camera.horizontalAngle / 2;
              const angleStep = 2; // Degrees
              const points: {x: number, y: number}[] = [];
              // Note: Removed zOffsetX/zOffsetY to align FOV with ground/walls

              for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
                  const angleRad = (angle - 90) * Math.PI / 180;
                  const rayDirX = Math.cos(angleRad);
                  const rayDirY = Math.sin(angleRad);
                  let closestDist = radius;
      
                  obstacles.forEach(obstacle => {
                      const intersection = findIntersection(
                          camera.x, camera.y,
                          camera.x + rayDirX * radius, camera.y + rayDirY * radius,
                          obstacle.x1, obstacle.y1, obstacle.x2, obstacle.y2
                      );
      
                      if (intersection) {
                          const dist = Math.sqrt(Math.pow(intersection.x - camera.x, 2) + Math.pow(intersection.y - camera.y, 2));
                          
                          if (dist > radius) return;

                          const h_cam = camera.z;
                          const h_obs = obstacle.height;
                          
                          // Only block the ray if the object is TALLER than the camera.
                          // Shorter objects cast shadows that ARE drawn separately.
                          if (h_obs >= h_cam) {
                              if (dist < closestDist) {
                                  closestDist = dist;
                              }
                          }
                      }
                  });
      
                  points.push({
                      x: (camera.x + rayDirX * closestDist) * scale * localZoom + localViewOffset.x,
                      y: (camera.y + rayDirY * closestDist) * scale * localZoom + localViewOffset.y
                  });
              }
              return points;
          };
          
          const doriLevels = [
              { level: 'detection', alpha: 0.15, factor: 1.0 },
              { level: 'observation', alpha: 0.25, factor: 0.75 },
              { level: 'recognition', alpha: 0.35, factor: 0.5 },
              { level: 'identification', alpha: 0.45, factor: 0.25 },
          ];

          const blindSpotPoints = blindSpotRadiusMeters > 0 ? calculateFovPathPoints(blindSpotRadiusMeters, [], geometricReach) : [];
          
          const fovApexX = (camera.x * scale * localZoom + localViewOffset.x) + zOffsetX;
          const fovApexY = (camera.y * scale * localZoom + localViewOffset.y) + zOffsetY;

          doriLevels.forEach(({ alpha, factor }) => {
              const radius = Math.min(camera.dori * factor, geometricReach);
              const fovPoints = calculateFovPathPoints(radius, obstacles3D, geometricReach);
              
              if (fovPoints.length > 1) {
                  ctx.beginPath();
                  // Arque externo
                  ctx.moveTo(fovPoints[0].x, fovPoints[0].y);
                  for (let i = 1; i < fovPoints.length; i++) ctx.lineTo(fovPoints[i].x, fovPoints[i].y);
                  
                  // Ponto cego (furo)
                  if (blindSpotPoints.length > 1) {
                      for (let i = blindSpotPoints.length - 1; i >= 0; i--) {
                          ctx.lineTo(blindSpotPoints[i].x, blindSpotPoints[i].y);
                      }
                  } else {
                      ctx.lineTo(fovApexX, fovApexY);
                  }
                  
                  ctx.closePath();
                  ctx.fillStyle = hexToRgba(camera.fovColor, alpha);
                  ctx.fill();
              }
          });

          ctx.save();
          // Clip to the FOV cone, but only consider WALLS as blockers for the clip itself
          // This ensures elements don't block their own shadows' clipping path
          const maxRadius = Math.min(camera.dori, geometricReach);
          const wallObstacles = walls.map(w => ({ ...w, id: `clip-${w.id}`, height: 999 }));
          const clipPoints = calculateFovPathPoints(maxRadius, wallObstacles, geometricReach);
          
          if (clipPoints.length > 1) {
              ctx.beginPath();
              ctx.moveTo(clipPoints[0].x, clipPoints[0].y);
              for (let i = 1; i < clipPoints.length; i++) ctx.lineTo(clipPoints[i].x, clipPoints[i].y);
              if (blindSpotPoints.length > 1) {
                  for (let i = blindSpotPoints.length - 1; i >= 0; i--) ctx.lineTo(blindSpotPoints[i].x, blindSpotPoints[i].y);
              } else {
                  ctx.lineTo(fovApexX, fovApexY);
              }
              ctx.closePath();
              ctx.clip();
          }

          // Group elements and walls for shadow projection
          const obstacleGroups = new Map<string, any[]>();
          
          // Add elements
          obstacles3D.forEach(obs => {
              if (obs.height > 0 && obs.height < camera.z) {
                  const parentId = obs.id.split('-side-')[0];
                  if (!obstacleGroups.has(parentId)) obstacleGroups.set(parentId, []);
                  obstacleGroups.get(parentId)!.push(obs);
              }
          });

          // Add walls that are lower than camera height
          walls.forEach(w => {
            if (w.height > 0 && w.height < camera.z) {
                if (!obstacleGroups.has(`wall-${w.id}`)) obstacleGroups.set(`wall-${w.id}`, []);
                obstacleGroups.get(`wall-${w.id}`)!.push({
                    x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, height: w.height
                });
            }
          });

          obstacleGroups.forEach((sides) => {
              const h_obs = sides[0].height;
              const h_cam = camera.z;
              const h_diff = Math.max(0.1, h_cam - h_obs);
              const factor = h_cam / h_diff;

              ctx.beginPath();
              sides.forEach(s => {
                  const p1 = {
                      x: camera.x + (s.x1 - camera.x) * factor,
                      y: camera.y + (s.y1 - camera.y) * factor
                  };
                  const p2 = {
                      x: camera.x + (s.x2 - camera.x) * factor,
                      y: camera.y + (s.y2 - camera.y) * factor
                  };

                  const c1 = { x: s.x1 * scale * localZoom + localViewOffset.x, y: s.y1 * scale * localZoom + localViewOffset.y };
                  const c2 = { x: s.x2 * scale * localZoom + localViewOffset.x, y: s.y2 * scale * localZoom + localViewOffset.y };
                  const cp1 = { x: p1.x * scale * localZoom + localViewOffset.x, y: p1.y * scale * localZoom + localViewOffset.y };
                  const cp2 = { x: p2.x * scale * localZoom + localViewOffset.x, y: p2.y * scale * localZoom + localViewOffset.y };

                  ctx.moveTo(c1.x, c1.y);
                  ctx.lineTo(c2.x, c2.y);
                  ctx.lineTo(cp2.x, cp2.y);
                  ctx.lineTo(cp1.x, cp1.y);
              });
              
              // Unified fill with gradient for a premium volumetric look
              const firstSide = sides[0];
              const p_end = {
                x: camera.x + (firstSide.x1 - camera.x) * factor,
                y: camera.y + (firstSide.y1 - camera.y) * factor
              };
              const cp_end = { 
                x: p_end.x * scale * localZoom + localViewOffset.x, 
                y: p_end.y * scale * localZoom + localViewOffset.y 
              };
              const cp_start = {
                x: firstSide.x1 * scale * localZoom + localViewOffset.x,
                y: firstSide.y1 * scale * localZoom + localViewOffset.y
              };
              
              const grd = ctx.createLinearGradient(cp_start.x, cp_start.y, cp_end.x, cp_end.y);
              grd.addColorStop(0, 'rgba(239, 68, 68, 0.65)'); // Stronger Red (Rose-500)
              grd.addColorStop(1, 'rgba(239, 68, 68, 0.1)');
              
              ctx.fillStyle = grd;
              ctx.fill();
          });
          ctx.restore();
      }
  });


    // Draw cables
    const dvr = elements.find(el => el.type === 'dvr');
    if (dvr && !isMinimap) {
        const dvrX = dvr.x * scale * localZoom + localViewOffset.x;
        const dvrY = dvr.y * scale * localZoom + localViewOffset.y;

        ctx.strokeStyle = 'rgba(107, 114, 128, 0.5)'; // gray-500
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        cameras.forEach(camera => {
            const iconX = (camera.x * scale * localZoom + localViewOffset.x);
            const iconY = (camera.y * scale * localZoom + localViewOffset.y);

            ctx.beginPath();
            ctx.moveTo(dvrX, dvrY);
            ctx.lineTo(iconX, iconY);
            ctx.stroke();
        });

        ctx.setLineDash([]);
    }

    cameras.forEach(camera => {
      const baseX = camera.x * scale * localZoom + localViewOffset.x;
      const baseY = camera.y * scale * localZoom + localViewOffset.y;
      
      const zOffsetX = camera.z * scale * localZoom * Z_OFFSET_FACTOR;
      const zOffsetY = camera.z * scale * localZoom * Z_OFFSET_FACTOR;
      
      const iconX = baseX + zOffsetX;
      const iconY = baseY + zOffsetY;

      const size = 7.5 * Math.min(localZoom, 2);
      const isSelected = selectedCamera?.id === camera.id;
      
      // Draw pole/line
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(iconX, iconY);
      ctx.strokeStyle = '#9ca3af'; // gray-400
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw base on ground
      ctx.fillStyle = '#cbd5e1'; // slate-300
      ctx.beginPath();
      ctx.arc(baseX, baseY, 4, 0, Math.PI * 2);
      ctx.fill();
      
      const shadowOffset = camera.z * 0.5 * (scale * localZoom) * 0.15;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.beginPath();
      ctx.arc(iconX + shadowOffset, iconY + shadowOffset, size, 0, Math.PI * 2);
      ctx.fill();

      if (camera.type === 'bullet') {
        ctx.save();
        ctx.translate(iconX, iconY);
        ctx.rotate((camera.rotation - 90) * Math.PI / 180);
        
        ctx.strokeStyle = isSelected ? '#1d4ed8' : '#374151';
        ctx.lineWidth = 1.5;

        const bodyLength = size * 1.6;
        const bodyWidth = size;
        
        ctx.fillStyle = isSelected ? '#60a5fa' : '#9ca3af';
        ctx.fillRect(-bodyWidth * 0.3, bodyLength / 2, bodyWidth * 0.6, size * 0.3);
        ctx.strokeRect(-bodyWidth * 0.3, bodyLength / 2, bodyWidth * 0.6, size * 0.3);

        ctx.fillStyle = isSelected ? '#3b82f6' : '#6b7280';
        ctx.beginPath();
        // Body (oriented horizontally)
        ctx.roundRect(-bodyLength / 2, -bodyWidth / 2, bodyLength, bodyWidth, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#2563eb' : '#4b5563';
        // Bracket/Mount
        ctx.fillRect(-bodyLength / 2, -bodyWidth / 3, bodyLength / 4, bodyWidth * 0.6);
        ctx.strokeRect(-bodyLength / 2, -bodyWidth / 3, bodyLength / 4, bodyWidth * 0.6);

        ctx.fillStyle = isSelected ? '#fff' : '#1f2937';
        // Lens (pointing right)
        ctx.beginPath();
        ctx.arc(bodyLength / 2.8, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      } else { // dome and spy_dome
          ctx.save();
          ctx.translate(iconX, iconY);

          // Main housing
          ctx.fillStyle = isSelected ? '#60a5fa' : '#9ca3af'; // A bit darker for the housing
          ctx.strokeStyle = isSelected ? '#1d4ed8' : '#4b5563';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Dome glass
          ctx.fillStyle = camera.type === 'spy_dome' ? 'rgba(20, 30, 40, 0.7)' : '#ffffff'; // Tinted for spy
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
          ctx.fill();
          
          // Rotate only the lens part
          ctx.rotate((camera.rotation - 90) * Math.PI / 180);

          // Lens
          const lensSize = camera.type === 'spy_dome' ? size * 0.2 : size * 0.3;
          const lensOffset = size * 0.3;
          ctx.fillStyle = '#111827';
          ctx.beginPath();
          ctx.arc(lensOffset, 0, lensSize, 0, Math.PI * 2);
          ctx.fill();
          
          // Lens glare for standard dome
          if (camera.type === 'dome') {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.beginPath();
              ctx.arc(lensOffset + lensSize * 0.2, -lensSize * 0.2, lensSize * 0.3, 0, Math.PI * 2);
              ctx.fill();
          }
          
          ctx.restore();
      }

      if (isSelected && camera.showFov && !isMinimap) {
        const handleRadius = 8;
        const angleRad = (camera.rotation - 90) * Math.PI / 180;
        const handleDistance = camera.dori * scale * localZoom;
        
        const handleCenterX = iconX + Math.cos(angleRad) * handleDistance;
        const handleCenterY = iconY + Math.sin(angleRad) * handleDistance;
        
        // Draw a line to the handle
        ctx.beginPath();
        ctx.moveTo(iconX, iconY);
        ctx.lineTo(handleCenterX, handleCenterY);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw the handle circle
        ctx.beginPath();
        ctx.arc(handleCenterX, handleCenterY, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (localZoom > 0.3 && isSelected) {
        ctx.fillStyle = '#1e40af';
        ctx.font = `bold ${10 * Math.min(localZoom, 1)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(camera.name, iconX, iconY - size - 5);
      }
    });

    if (selectedElement && !isMinimap) {
        const centerX = selectedElement.x * scale * localZoom + viewOffset.x;
        const centerY = selectedElement.y * scale * localZoom + viewOffset.y;
        const handleDistance = 30;
        const handleRadius = 6;
        
        const handleX = centerX;
        const handleY = centerY - handleDistance;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(handleX, handleY);
        ctx.strokeStyle = '#a1a1aa';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#fafafa';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    if (rotatingObject) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const currentObject = cameras.find(c => c.id === rotatingObject.id) || elements.find(e => e.id === rotatingObject.id);
        if (currentObject) {
            const angle = currentObject.rotation;
            ctx.fillText(`${angle.toFixed(0)}°`, mousePos.x, mousePos.y - 15);
        }
    }

    if (rotatingCameraId) {
        const camera = cameras.find(c => c.id === rotatingCameraId);
        if (camera) {
            const zOffsetX = camera.z * scale * localZoom * Z_OFFSET_FACTOR;
            const zOffsetY = camera.z * scale * localZoom * Z_OFFSET_FACTOR;
            const iconX = (camera.x * scale * localZoom + localViewOffset.x) + zOffsetX;
            const iconY = (camera.y * scale * localZoom + localViewOffset.y) + zOffsetY;
    
            const dx = mousePos.x - iconX;
            const dy = mousePos.y - iconY;
    
            const currentAngle = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            // Display both angle and distance
            const distanceText = `Distância: ${camera.dori.toFixed(1)}m`;
            const angleText = `Ângulo: ${currentAngle.toFixed(0)}°`;
            ctx.fillText(distanceText, mousePos.x, mousePos.y - 30);
            ctx.fillText(angleText, mousePos.x, mousePos.y - 15);
        }
    }

    drawMeasurements2D(ctx, localZoom, localViewOffset);

    if (drawingMode === 'wall' && wallStart) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(wallStart.x, wallStart.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const worldX1 = (wallStart.x - localViewOffset.x) / (scale * localZoom);
      const worldY1 = (wallStart.y - localViewOffset.y) / (scale * localZoom);
      const worldX2 = (mousePos.x - localViewOffset.x) / (scale * localZoom);
      const worldY2 = (mousePos.y - localViewOffset.y) / (scale * localZoom);

      const distance = Math.sqrt(Math.pow(worldX2 - worldX1, 2) + Math.pow(worldY2 - worldY1, 2));

      if (distance > 0) {
        const midX = (wallStart.x + mousePos.x) / 2;
        const midY = (wallStart.y + mousePos.y) / 2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(midX - 25, midY - 20, 50, 20);
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${distance.toFixed(2)}m`, midX, midY - 5);
      }
    } else if (drawingMode === 'rectangle' && rectangleStart && e) {
        const worldX1 = (rectangleStart.x - viewOffset.x) / (scale * localZoom);
        const worldY1 = (rectangleStart.y - viewOffset.y) / (scale * localZoom);
        const worldX2 = (mousePos.x - viewOffset.x) / (scale * localZoom);
        const worldY2 = (mousePos.y - viewOffset.y) / (scale * localZoom);
        
        let rectW = Math.abs(worldX2 - worldX1);
        let rectH = Math.abs(worldY2 - worldY1);
        if (e.shiftKey) { // Assuming 'e' is available from a mouse event
            rectW = rectH = Math.max(rectW, rectH);
        }

        const canvasStartX = rectangleStart.x;
        const canvasStartY = rectangleStart.y;
        const canvasW = rectW * scale * localZoom;
        const canvasH = rectH * scale * localZoom;
        
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(canvasStartX, canvasStartY, worldX2 > worldX1 ? canvasW : -canvasW, worldY2 > worldY1 ? canvasH : -canvasH);
        ctx.setLineDash([]);
        
        // Draw dimensions
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        ctx.save();
        ctx.translate(canvasStartX + (worldX2 > worldX1 ? canvasW/2 : -canvasW/2), canvasStartY);
        ctx.fillRect(-25, -18, 50, 16);
        ctx.fillStyle = '#374151';
        ctx.fillText(`${rectW.toFixed(2)}m`, 0, -5);
        ctx.restore();
        
        ctx.save();
        ctx.translate(canvasStartX, canvasStartY + (worldY2 > worldY1 ? canvasH/2 : -canvasH/2));
        ctx.rotate(-Math.PI / 2);
        ctx.fillRect(-25, -18, 50, 16);
        ctx.fillStyle = '#374151';
        ctx.fillText(`${rectH.toFixed(2)}m`, 0, -5);
        ctx.restore();
    } else if (drawingMode === 'arc_wall' && wallStart && wallControlPoint) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(wallStart.x, wallStart.y);
        ctx.quadraticCurveTo(mousePos.x, mousePos.y, wallControlPoint.x, wallControlPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (isMinimap && mainViewPort) {
      // Calculate viewport rectangle in world coordinates
      const worldLeft = -mainViewPort.offset.x / (scale * mainViewPort.zoom);
      const worldTop = -mainViewPort.offset.y / (scale * mainViewPort.zoom);
      const worldWidth = mainViewPort.width / (scale * mainViewPort.zoom);
      const worldHeight = mainViewPort.height / (scale * mainViewPort.zoom);
      
      // Convert world coordinates to minimap canvas coordinates
      const minimapRectX = worldLeft * scale * localZoom + localViewOffset.x;
      const minimapRectY = worldTop * scale * localZoom + localViewOffset.y;
      const minimapRectWidth = worldWidth * scale * localZoom;
      const minimapRectHeight = worldHeight * scale * localZoom;
      
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // red-500
      ctx.lineWidth = 2 / localZoom; // Make line width consistent regardless of zoom
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.beginPath();
      ctx.rect(minimapRectX, minimapRectY, minimapRectWidth, minimapRectHeight);
      ctx.stroke();
      ctx.fill();
    }
    
    if (floorPlan.erasedPaths) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        floorPlan.erasedPaths.forEach(path => {
            if (path.points.length < 2) return;
            ctx.lineWidth = path.size * scale * localZoom;
            ctx.beginPath();
            const startPoint = path.points[0];
            ctx.moveTo(startPoint.x * scale * localZoom + localViewOffset.x, startPoint.y * scale * localZoom + localViewOffset.y);
            for (let i = 1; i < path.points.length; i++) {
                const point = path.points[i];
                ctx.lineTo(point.x * scale * localZoom + localViewOffset.x, point.y * scale * localZoom + localViewOffset.y);
            }
            ctx.stroke();
        });
        ctx.restore();
    }
    // END: Erasing logic

    // Draw eraser cursor
    if (drawingMode === 'delete' && !isMinimap) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(mousePos.x - eraserSize / 2, mousePos.y - eraserSize / 2, eraserSize, eraserSize);
        ctx.setLineDash([]);
    }

  }, [width, height, scale, zoom, viewOffset, walls, cameras, selectedCamera, selectedWall, drawingMode, wallStart, wallControlPoint, drawGrid2D, drawElements2D, drawMeasurements2D, bgImageObject, elements, selectedElement, mousePos, measurements, rotatingObject, showMeasurements, rectangleStart, showGrid, isMinimap, mainViewPort, imageCache, rotatingCameraId, floorPlan.erasedPaths, eraserSize]);
  
  // ... (the rest of the component's functions)
  const handleCopy = useCallback(() => {
    const selectedObject = selectedCamera || selectedElement;
    if (selectedObject && setClipboard) {
      setClipboard(selectedObject);
      toast({ title: "Objeto copiado!" });
    }
  }, [selectedCamera, selectedElement, setClipboard, toast]);

  const handleCut = useCallback(() => {
    const selectedObject = selectedCamera || selectedElement;
    if (selectedObject && setClipboard) {
      setClipboard(selectedObject);
      if (selectedCamera && onCameraDelete) onCameraDelete(selectedCamera.id);
      if (selectedElement && onElementDelete) onElementDelete(selectedElement.id);
      toast({ title: "Objeto recortado!" });
    }
  }, [selectedCamera, selectedElement, setClipboard, onCameraDelete, onElementDelete, toast]);

  const handlePaste = useCallback(() => {
    if (clipboard && setFloorPlan) {
      const newId = `${'dori' in clipboard ? 'cam' : 'elem'}_${Date.now()}`;
      const pastedObject = { 
        ...clipboard, 
        id: newId, 
        x: (mousePos.x - viewOffset.x) / (scale * zoom), 
        y: (mousePos.y - viewOffset.y) / (scale * zoom),
      };
      
      setFloorPlan(prev => {
        if ('dori' in pastedObject) { // It's a CftvCamera
          return { ...prev, cameras: [...prev.cameras, pastedObject as CftvCamera] };
        } else { // It's an Element
          return { ...prev, elements: [...prev.elements, pastedObject as CftvElement] };
        }
      });

      toast({ title: "Objeto colado!" });
    }
  }, [clipboard, mousePos, viewOffset, scale, zoom, setFloorPlan, toast]);
  
  const nudgeSelection = useCallback((key: string) => {
    const nudgeAmount = 0.1; // in world units
    const updated = (obj: CftvCamera | CftvElement | Wall) => {
        let { x, y } = 'x' in obj ? obj : { x: (obj.x1 + obj.x2) / 2, y: (obj.y1 + obj.y2) / 2 };
        
        let dx = 0, dy = 0;
        if (key === 'ArrowUp') dy = -nudgeAmount;
        if (key === 'ArrowDown') dy = nudgeAmount;
        if (key === 'ArrowLeft') dx = -nudgeAmount;
        if (key === 'ArrowRight') dx = nudgeAmount;

        if ('x1' in obj) { // It's a Wall
            return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy };
        } else { // It's a CftvCamera or Element
            return { ...obj, x: x + dx, y: y + dy };
        }
    };

    if (selectedCamera && onCameraUpdate) {
        onCameraUpdate(updated(selectedCamera) as CftvCamera);
    } else if (selectedElement && onElementUpdate) {
        onElementUpdate(updated(selectedElement) as CftvElement);
    } else if (selectedWall && onWallUpdate) {
        onWallUpdate(updated(selectedWall) as Wall);
    }
  }, [selectedCamera, selectedElement, selectedWall, onCameraUpdate, onElementUpdate, onWallUpdate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!interactive) return;

        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            return;
        }

        const isCtrl = e.ctrlKey || e.metaKey;

        if (isCtrl) {
            switch (e.key.toLowerCase()) {
                case 'z': e.preventDefault(); onUndo?.(); break;
                case 'y': e.preventDefault(); onRedo?.(); break;
                case '=': // For '+' key without shift
                case '+':
                    e.preventDefault();
                    if (drawingMode === 'delete') {
                        setEraserSize(s => Math.min(s + 5, 100));
                        toast({ title: `Tamanho da borracha: ${Math.min(eraserSize + 5, 100)}` });
                    } else {
                        setZoom(z => Math.min(z + 0.2, 5));
                    }
                    break;
                case '-':
                    e.preventDefault();
                    if (drawingMode === 'delete') {
                        setEraserSize(s => Math.max(s - 5, 5));
                        toast({ title: `Tamanho da borracha: ${Math.max(eraserSize - 5, 5)}` });
                    } else {
                        setZoom(z => Math.max(z - 0.2, 0.1));
                    }
                    break;
                case 'c':
                    e.preventDefault();
                    if ((selectedCamera || selectedElement) && setClipboard) {
                        setClipboard(selectedCamera || selectedElement);
                        toast({ title: "Objeto copiado!" });
                    }
                    break;
                case 'v':
                    e.preventDefault();
                    if (clipboard && setFloorPlan) {
                      const newId = `${'dori' in clipboard ? 'cam' : 'elem'}_${Date.now()}`;
                      const pastedObject = { 
                        ...clipboard, 
                        id: newId, 
                        x: (mousePos.x - viewOffset.x) / (scale * zoom), 
                        y: (mousePos.y - viewOffset.y) / (scale * zoom),
                      };
                      
                      setFloorPlan(prev => {
                        if ('dori' in pastedObject) {
                            return { ...prev, cameras: [...prev.cameras, pastedObject as CftvCamera] };
                        } else {
                            return { ...prev, elements: [...prev.elements, pastedObject as CftvElement] };
                        }
                      });
                      toast({ title: "Objeto colado!" });
                    }
                    break;
                case '[': // Send to back
                    e.preventDefault();
                    setFloorPlan(prev => {
                        if (selectedCamera) {
                            const list = [...prev.cameras];
                            const index = list.findIndex(c => c.id === selectedCamera.id);
                            if (index > 0) {
                                const [item] = list.splice(index, 1);
                                list.unshift(item);
                                return { ...prev, cameras: list };
                            }
                        } else if (selectedElement) {
                            const list = [...prev.elements];
                            const index = list.findIndex(item => item.id === selectedElement.id);
                            if (index > 0) {
                                const [item] = list.splice(index, 1);
                                list.unshift(item);
                                return { ...prev, elements: list };
                            }
                        }
                        return prev;
                    });
                    toast({title: "Enviado para trás"});
                    break;
                case ']': // Send to front
                    e.preventDefault();
                    setFloorPlan(prev => {
                        if (selectedCamera) {
                            const list = [...prev.cameras];
                            const index = list.findIndex(c => c.id === selectedCamera.id);
                            if (index !== -1 && index < list.length - 1) {
                                const [item] = list.splice(index, 1);
                                list.push(item);
                                return { ...prev, cameras: list };
                            }
                        } else if (selectedElement) {
                            const list = [...prev.elements];
                            const index = list.findIndex(item => item.id === selectedElement.id);
                             if (index !== -1 && index < list.length - 1) {
                                const [item] = list.splice(index, 1);
                                list.push(item);
                                return { ...prev, elements: list };
                            }
                        }
                        return prev;
                    });
                    toast({title: "Enviado para frente"});
                    break;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case 'delete': case 'backspace':
                    if (drawingMode !== 'delete') { // Prevent self-deletion
                        if (selectedCamera) onCameraDelete?.(selectedCamera.id);
                        else if (selectedElement) onElementDelete?.(selectedElement.id);
                        else if (selectedWall && onWallRemove) {
                            if (selectedWall.groupId) {
                                walls.forEach(w => {
                                    if (w.groupId === selectedWall.groupId) {
                                        onWallRemove(w.id);
                                    }
                                });
                            } else {
                                onWallRemove(selectedWall.id);
                            }
                        }
                    }
                    break;
                case 'escape':
                    onDrawingModeChange?.('select'); onCameraSelect?.(null); onElementSelect?.(null); onWallSelect?.(null);
                    setWallStart(null); setWallChainStart(null); setMeasurePoints([]);
                    break;
                case 'arrowup': case 'arrowdown': case 'arrowleft': case 'arrowright':
                    e.preventDefault();
                    nudgeSelection(e.key);
                    break;
                case 'v': onDrawingModeChange?.('select'); break;
                case 'c': onDrawingModeChange?.('camera'); break;
                case 'w': onDrawingModeChange?.('wall'); break;
                case 'a': onDrawingModeChange?.('arc_wall'); break;
                case 'm': onDrawingModeChange?.('measure'); break;
                case 't': onDrawingModeChange?.('text'); break;
                case 'r': onDrawingModeChange?.('rectangle'); break;
                case 'e': onDrawingModeChange?.('delete'); break;
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    interactive, onUndo, onRedo, setZoom, nudgeSelection, onDrawingModeChange, 
    onCameraSelect, onElementSelect, onWallSelect, onCameraDelete, onElementDelete, onWallRemove,
    selectedCamera, selectedElement, selectedWall, walls,
    clipboard, setClipboard, setFloorPlan, mousePos, viewOffset, scale, zoom, toast, drawingMode, eraserSize
  ]);

  useEffect(() => {
    draw2D();
  }, [draw2D]);
  
  useEffect(() => {
    const canvas = canvas2DRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      if (!didCenterRef.current && rect.width > 0 && !isMinimap) {
        const planWidth = width * scale * zoom;
        const planHeight = height * scale * zoom;
        setViewOffset({
          x: (rect.width - planWidth) / 2,
          y: (rect.height - planHeight) / 2,
        });
        didCenterRef.current = true;
      }

      draw2D();
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [draw2D, isMinimap, scale, setViewOffset, width, height, zoom]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !setFloorPlan) return;

    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = async (loadEvent) => {
        try {
          const dxfContent = loadEvent.target?.result as string;
          const { default: DxfParser } = await import('dxf-parser');
          const parser = new DxfParser();
          const dxf = parser.parseSync(dxfContent);
          
          if (!dxf || !dxf.entities) {
            throw new Error("Não foi possível analisar o arquivo DXF.");
          }

          const newWalls: Wall[] = dxf.entities
            .filter((entity: any) => entity.type === 'LINE')
            .map((entity: any, index: number) => ({
              id: `dxf_wall_${Date.now()}_${index}`,
              x1: entity.vertices[0].x / 100, // Assumindo que o DXF está em cm, convertendo para metros
              y1: entity.vertices[0].y / 100,
              x2: entity.vertices[1].x / 100,
              y2: entity.vertices[1].y / 100,
              height: 3,
              thickness: 0.2,
              color: '#000000',
              lineStyle: 'solid',
            }));

          if (newWalls.length === 0) {
            toast({
              variant: 'default',
              title: 'Nenhuma linha encontrada',
              description: 'O arquivo DXF foi lido, mas não continha nenhuma entidade do tipo LINHA para importar como parede.',
            });
            return;
          }

          setFloorPlan(prev => {
            const allPointsX = newWalls.flatMap(w => [w.x1, w.x2]);
            const allPointsY = newWalls.flatMap(w => [w.y1, w.y2]);
            const minX = Math.min(...allPointsX);
            const maxX = Math.max(...allPointsX);
            const minY = Math.min(...allPointsY);
            const maxY = Math.max(...allPointsY);

            // Ajusta o tamanho da planta para caber o desenho importado com uma margem
            const newWidth = Math.max(prev.width, maxX - minX + 10);
            const newHeight = Math.max(prev.height, maxY - minY + 10);

            // Centraliza o desenho importado
            const wallsWithOffset = newWalls.map(w => ({
              ...w,
              x1: w.x1 - minX + 5,
              y1: w.y1 - minY + 5,
              x2: w.x2 - minX + 5,
              y2: w.y2 - minY + 5,
            }));

            return {
                ...prev,
                walls: [...prev.walls, ...wallsWithOffset],
                width: newWidth,
                height: newHeight,
                updatedAt: new Date()
            };
          });

          toast({
            title: 'DXF Importado com Sucesso!',
            description: `${newWalls.length} paredes foram adicionadas à planta.`,
          });

        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Erro ao Importar DXF',
            description: error.message || 'Ocorreu um erro ao processar o arquivo. Verifique se ele é válido.',
          });
        }
      };
      reader.readAsText(file);

    } else if (file.type.startsWith('image/') && onImageUpload) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({
                variant: 'destructive',
                title: 'Arquivo muito grande',
                description: 'Por favor, selecione uma imagem com menos de 5MB.'
            });
            return;
        }
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            if (loadEvent.target?.result) {
                onImageUpload(loadEvent.target.result as string);
            }
        };
        reader.onerror = () => {
            toast({
                variant: 'destructive',
                title: 'Erro de Leitura',
                description: 'Não foi possível ler o arquivo de imagem.'
            });
        };
        reader.readAsDataURL(file);
    } else {
        toast({
            variant: 'destructive',
            title: 'Formato não suportado',
            description: 'Por favor, selecione um arquivo de imagem (PNG, JPG) ou DXF.',
        });
    }
  };
  
  const handleMouseDown2D = (e: React.MouseEvent) => {
    if (!interactive || !onCameraSelect || !onElementSelect || !onWallSelect || !onCameraRotate || !onElementRotate || !onWallUpdate || !onCameraUpdate || !onElementUpdate || !onWallRemove || !onCameraDelete || !onElementDelete || !onWallAdd || !onMeasurementAdd || !onDrawingModeChange || !onElementAdd) return;

    const rect = canvas2DRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawingMode === 'pan') {
        setIsDragging(true);
        setDragStart({ x, y });
        return;
    }

    if (drawingMode === 'delete') {
        setIsErasing(true);
        const worldX = (x - viewOffset.x) / (scale * zoom);
        const worldY = (y - viewOffset.y) / (scale * zoom);
        const newPath = { 
            points: [{ x: worldX, y: worldY }],
            size: eraserSize / (scale * zoom) // Store eraser size in world units
        };
        setFloorPlan(prev => ({
            ...prev,
            erasedPaths: [...(prev.erasedPaths || []), newPath]
        }));
        return;
    }

    // Multi-selection rotation handle detection
    if (selectedIds.length > 0) {
        let selMinX = Infinity, selMinY = Infinity, selMaxX = -Infinity, selMaxY = -Infinity;
        let hasSelection = false;
        cameras.forEach(c => { if (selectedIds.includes(c.id)) { selMinX = Math.min(selMinX, c.x - 0.5); selMinY = Math.min(selMinY, c.y - 0.5); selMaxX = Math.max(selMaxX, c.x + 0.5); selMaxY = Math.max(selMaxY, c.y + 0.5); hasSelection = true; } });
        elements.forEach(e => { if (selectedIds.includes(e.id)) { selMinX = Math.min(selMinX, e.x - e.width/2); selMinY = Math.min(selMinY, e.y - e.depth/2); selMaxX = Math.max(selMaxX, e.x + e.width/2); selMaxY = Math.max(selMaxY, e.y + e.depth/2); hasSelection = true; } });
        walls.forEach(w => { if (selectedIds.includes(w.id) || (w.groupId && selectedIds.includes(w.groupId))) { selMinX = Math.min(selMinX, w.x1, w.x2); selMinY = Math.min(selMinY, w.y1, w.y2); selMaxX = Math.max(selMaxX, w.x1, w.x2); selMaxY = Math.max(selMaxY, w.y1, w.y2); hasSelection = true; } });

        if (hasSelection) {
            const centerX = (selMinX + selMaxX) / 2;
            const centerY = (selMinY + selMaxY) / 2;
            const handleY = selMinY - 30 / (scale * zoom);
            const canvasCenterX = centerX * scale * zoom + viewOffset.x;
            const canvasHandleY = handleY * scale * zoom + viewOffset.y;
            const handleRadius = 10;

            if (Math.sqrt(Math.pow(x - canvasCenterX, 2) + Math.pow(y - canvasHandleY, 2)) <= handleRadius) {
                const initialMouseAngle = Math.atan2(y - (centerY * scale * zoom + viewOffset.y), x - canvasCenterX);
                const originalItems = [
                    ...cameras.filter(c => selectedIds.includes(c.id)).map(c => ({ ...c, type: 'camera' })),
                    ...elements.filter(e => selectedIds.includes(e.id)).map(e => ({ ...e, type: 'element' })),
                    ...walls.filter(w => selectedIds.includes(w.id) || (w.groupId && selectedIds.includes(w.groupId))).map(w => ({ ...w, type: 'wall' }))
                ];
                setRotatingObject({ 
                    id: 'multi', 
                    type: 'multi', 
                    centerX, 
                    centerY,
                    initialMouseAngle,
                    originalItems
                });
                return;
            }
        }
    }

    if (selectedElement) {
        const centerX = selectedElement.x * scale * zoom + viewOffset.x;
        const centerY = selectedElement.y * scale * zoom + viewOffset.y;
        const handleDistance = 30;
        const handleRadius = 6;
        const handleX = centerX;
        const handleY = centerY - handleDistance;
        if (Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2)) <= handleRadius) {
            setRotatingObject({ id: selectedElement.id, type: 'element', centerX, centerY });
            return;
        }
    }

    if (drawingMode === 'select') {
      if (selectedCamera && selectedCamera.showFov) {
        const handleRadius = 8;
        const zOffsetX = selectedCamera.z * scale * zoom * Z_OFFSET_FACTOR;
        const zOffsetY = selectedCamera.z * scale * zoom * Z_OFFSET_FACTOR;
        const iconX = (selectedCamera.x * scale * zoom + viewOffset.x) + zOffsetX;
        const iconY = (selectedCamera.y * scale * zoom + viewOffset.y) + zOffsetY;
        const angleRad = (selectedCamera.rotation - 90) * Math.PI / 180;
        const handleDistance = selectedCamera.dori * scale * zoom;
        const handleX = iconX + Math.cos(angleRad) * handleDistance;
        const handleY = iconY + Math.sin(angleRad) * handleDistance;


        if (Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2)) <= handleRadius) {
            setRotatingCameraId(selectedCamera.id);
            return;
        }
      }
      if (selectedWall?.groupId) {
          if (selectedWall.groupId.startsWith('rect_')) {
            const groupWalls = walls.filter(w => w.groupId === selectedWall.groupId);
            const allX = groupWalls.flatMap(w => [w.x1, w.x2]);
            const allY = groupWalls.flatMap(w => [w.y1, w.y2]);
            const minX = Math.min(...allX); const minY = Math.min(...allY);
            const maxX = Math.max(...allX); const maxY = Math.max(...allY);

            const handleSize = 8;
            const handles = [
                { x: minX, y: minY, name: 'top-left' }, { x: maxX, y: minY, name: 'top-right' },
                { x: minX, y: maxY, name: 'bottom-left' }, { x: maxX, y: maxY, name: 'bottom-right' },
                { x: (minX + maxX) / 2, y: minY, name: 'top-middle' }, { x: (minX + maxX) / 2, y: maxY, name: 'bottom-middle' },
                { x: minX, y: (minY + maxY) / 2, name: 'left-middle' }, { x: maxX, y: (minY + maxY) / 2, name: 'right-middle' },
            ];

            for (const handle of handles) {
                const canvasX = handle.x * scale * zoom + viewOffset.x;
                const canvasY = handle.y * scale * zoom + viewOffset.y;
                if (x >= canvasX - handleSize / 2 && x <= canvasX + handleSize / 2 && y >= canvasY - handleSize / 2 && y <= canvasY + handleSize / 2) {
                    setResizingObject({ groupId: selectedWall.groupId, handle: handle.name });
                    return;
                }
            }
          } else { // Polygon
            const groupWalls = walls.filter(w => w.groupId === selectedWall.groupId);
            const vertices = new Map<string, {x: number, y: number}>();
            groupWalls.forEach(w => {
                vertices.set(`${w.x1.toFixed(3)},${w.y1.toFixed(3)}`, {x: w.x1, y: w.y1});
                vertices.set(`${w.x2.toFixed(3)},${w.y2.toFixed(3)}`, {x: w.x2, y: w.y2});
            });
            const uniqueVertices = Array.from(vertices.values());
            const handleRadius = 5;
             for (const vertex of uniqueVertices) {
                const canvasX = vertex.x * scale * zoom + viewOffset.x;
                const canvasY = vertex.y * scale * zoom + viewOffset.y;
                if (Math.sqrt(Math.pow(x - canvasX, 2) + Math.pow(y - canvasY, 2)) <= handleRadius) {
                    setResizingPolygonHandle({ groupId: selectedWall.groupId, vertex });
                    return;
                }
            }
          }
      }

      if (selectedWall && !selectedWall.groupId) {
          const handleRadius = 8;
          const x1 = selectedWall.x1 * scale * zoom + viewOffset.x;
          const y1 = selectedWall.y1 * scale * zoom + viewOffset.y;
          const x2 = selectedWall.x2 * scale * zoom + viewOffset.x;
          const y2 = selectedWall.y2 * scale * zoom + viewOffset.y;

          if (Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2)) <= handleRadius) {
              setDraggedWallHandle('start');
              return;
          }
          if (Math.sqrt(Math.pow(x - x2, 2) + Math.pow(y - y2, 2)) <= handleRadius) {
              setDraggedWallHandle('end');
              return;
          }
      }
      
      const hitRadiusCam = 7.5 * Math.min(zoom, 2);
      const clickedCamera = cameras.find(camera => {
        const zOffsetX = camera.z * scale * zoom * Z_OFFSET_FACTOR;
        const zOffsetY = camera.z * scale * zoom * Z_OFFSET_FACTOR;
        const icX = (camera.x * scale * zoom + viewOffset.x) + zOffsetX;
        const icY = (camera.y * scale * zoom + viewOffset.y) + zOffsetY;
        return Math.sqrt(Math.pow(x - icX, 2) + Math.pow(y - icY, 2)) <= hitRadiusCam;
      });
      if (clickedCamera) {
        if (e.shiftKey && onSelectionChange) {
            const ids = clickedCamera.groupId 
                ? [...cameras, ...elements, ...walls].filter(i => i.groupId === clickedCamera.groupId).map(i => i.id)
                : [clickedCamera.id];
            const allIn = ids.every(id => selectedIds.includes(id));
            if (allIn) {
                onSelectionChange(selectedIds.filter(id => !ids.includes(id)));
            } else {
                const combined = [...selectedIds, ...ids];
                onSelectionChange(combined.filter((v, i, a) => a.indexOf(v) === i));
            }
        } else {
            onCameraSelect(clickedCamera);
            const ids = clickedCamera.groupId 
                ? [...cameras, ...elements, ...walls].filter(i => i.groupId === clickedCamera.groupId).map(i => i.id)
                : [clickedCamera.id];
            onSelectionChange?.(ids);
        }
        setDraggedObject({ id: clickedCamera.id, type: 'camera' });
        setDragStart({ x, y });
        setIsDragging(false);
        return;
      }

      const clickedElement = elements.find(element => {
        const elemX = element.x * scale * zoom + viewOffset.x;
        const elemY = element.y * scale * zoom + viewOffset.y;
        const distance = Math.sqrt(Math.pow(x - elemX, 2) + Math.pow(y - elemY, 2));
        const elemWidth = element.width * scale * zoom;
        const elemHeight = element.depth * scale * zoom;
        const hitRadiusElem = Math.max(elemWidth, elemHeight) * 0.7;
        return distance <= Math.max(hitRadiusElem, 10 * Math.min(zoom, 2));
      });

      if (clickedElement) {
        if (e.shiftKey && onSelectionChange) {
            const ids = clickedElement.groupId 
                ? [...cameras, ...elements, ...walls].filter(i => i.groupId === clickedElement.groupId).map(i => i.id)
                : [clickedElement.id];
            const allIn = ids.every(id => selectedIds.includes(id));
            if (allIn) {
                onSelectionChange(selectedIds.filter(id => !ids.includes(id)));
            } else {
                const combined = [...selectedIds, ...ids];
                onSelectionChange(combined.filter((v, i, a) => a.indexOf(v) === i));
            }
        } else {
            onElementSelect(clickedElement);
            const ids = clickedElement.groupId 
                ? [...cameras, ...elements, ...walls].filter(i => i.groupId === clickedElement.groupId).map(i => i.id)
                : [clickedElement.id];
            onSelectionChange?.(ids);
        }
        setDraggedObject({ id: clickedElement.id, type: 'element' });
        setDragStart({ x, y });
        setIsDragging(false);
        return;
      }

      const clickTolerance = 5;
      const clickedWall = walls.find(wall => {
        const x1 = wall.x1 * scale * zoom + viewOffset.x; const y1 = wall.y1 * scale * zoom + viewOffset.y;
        const x2 = wall.x2 * scale * zoom + viewOffset.x; const y2 = wall.y2 * scale * zoom + viewOffset.y;
        const lenSq = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        if (lenSq === 0) return false;
        const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lenSq;
        const tClamped = Math.max(0, Math.min(1, t));
        const closestX = x1 + tClamped * (x2 - x1); const closestY = y1 + tClamped * (y2 - y1);
        return Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2) < clickTolerance * clickTolerance;
      });

      if (clickedWall && !draggedWallHandle) {
        if (e.shiftKey && onSelectionChange) {
            const ids = clickedWall.groupId 
                ? walls.filter(w => w.groupId === clickedWall.groupId).map(w => w.id)
                : [clickedWall.id];
            
            const allIn = ids.every(id => selectedIds.includes(id));
            if (allIn) {
                onSelectionChange(selectedIds.filter(id => !ids.includes(id)));
            } else {
                const combined = [...selectedIds, ...ids];
                onSelectionChange(combined.filter((v, i, a) => a.indexOf(v) === i));
            }
        } else {
            onWallSelect(clickedWall);
            const ids = clickedWall.groupId 
                ? walls.filter(w => w.groupId === clickedWall.groupId).map(w => w.id)
                : [clickedWall.id];
            onSelectionChange?.(ids);
        }

        if (clickedWall.groupId) {
          setDraggedObject({ id: clickedWall.groupId, type: 'wall_group' });
        } else {
          setDraggedObject({ id: clickedWall.id, type: 'wall' });
        }
        setDragStart({ x, y });
        setIsDragging(false);
        return;
      }

      // Inicia caixa de seleção ou pan
      if (!clickedCamera && !clickedElement && !clickedWall && !draggedWallHandle) {
          if (drawingMode === 'select') {
              setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
              if (!e.shiftKey) onSelectionChange?.([]);
              return;
          } else if (drawingMode === 'pan' || drawingMode === 'select') {
              // No pan ou select (se não iniciou caixa acima), faz o pan de fallback
              onCameraSelect(null);
              onElementSelect(null);
              onWallSelect(null);
              setDraggedObject(null);
              setIsDragging(true);
              setDragStart({ x, y });
              return;
          }
      }
      
      // If nothing is clicked and not handled above, just clear
      if (!clickedCamera && !clickedElement && !clickedWall && !draggedWallHandle) {
          onCameraSelect(null);
          onElementSelect(null);
          onWallSelect(null);
          if (!e.shiftKey) onSelectionChange?.([]);
      }
    } else if (drawingMode === 'camera' && onCameraAdd) {
      const worldX = (mousePos.x - viewOffset.x) / (scale * zoom);
      const worldY = (mousePos.y - viewOffset.y) / (scale * zoom);
      onCameraAdd(worldX, worldY);
      onDrawingModeChange('select');
    } else if (drawingMode === 'rectangle') {
        setRectangleStart({ x, y });
    } else if ((drawingMode === 'text' || drawingMode === 'element') && onElementAdd) {
        const worldX = (x - viewOffset.x) / (scale * zoom);
        const worldY = (y - viewOffset.y) / (scale * zoom);
        onElementAdd({
            type: drawingMode === 'text' ? 'text' : (elementShape || 'square'),
            subtype: drawingMode === 'text' ? 'label' : undefined,
            x: worldX,
            y: worldY,
        });
        onDrawingModeChange('select');
        setElementShape(null);
    } else if (drawingMode === 'wall' && onWallAdd) {
        const newPoint = { x, y };
        if (!wallStart) {
            setWallStart(newPoint);
            setWallChainStart(newPoint);
            setCurrentChainIds([]);
        } else {
            const worldMouseX = (newPoint.x - viewOffset.x) / (scale * zoom);
            const worldMouseY = (newPoint.y - viewOffset.y) / (scale * zoom);
            const chainStartWorldX = (wallChainStart!.x - viewOffset.x) / (scale * zoom);
            const chainStartWorldY = (wallChainStart!.y - viewOffset.y) / (scale * zoom);

            const distanceToStart = Math.sqrt(Math.pow(worldMouseX - chainStartWorldX, 2) + Math.pow(worldMouseY - chainStartWorldY, 2));
            const isClosing = wallChainStart && distanceToStart <= 0.2;

            const worldX1 = (wallStart.x - viewOffset.x) / (scale * zoom);
            const worldY1 = (wallStart.y - viewOffset.y) / (scale * zoom);
            
            let worldX2, worldY2;

            if (isClosing) {
                worldX2 = chainStartWorldX;
                worldY2 = chainStartWorldY;
                const closingWall: Wall = {
                    id: `wall_${Date.now()}`,
                    x1: worldX1, y1: worldY1, x2: worldX2, y2: worldY2,
                    height: 3, thickness: 0.2, lineStyle: 'solid', color: '#000000'
                };
                
                const groupId = `poly_${Date.now()}`;
                
                setFloorPlan(prev => {
                    const wallsWithGroup = prev.walls.map(w => 
                        currentChainIds.includes(w.id) ? { ...w, groupId } : w
                    );
                    return {
                        ...prev,
                        walls: [...wallsWithGroup, { ...closingWall, groupId }]
                    };
                });
                
                setWallStart(null);
                setWallChainStart(null);
                setCurrentChainIds([]);
                onDrawingModeChange('select');
            } else {
                worldX2 = (newPoint.x - viewOffset.x) / (scale * zoom);
                worldY2 = (newPoint.y - viewOffset.y) / (scale * zoom);
                const newWall: Wall = {
                    id: `wall_${Date.now()}`,
                    x1: worldX1, y1: worldY1, x2: worldX2, y2: worldY2,
                    height: 3, thickness: 0.2, lineStyle: 'solid', color: '#000000'
                };
                onWallAdd(newWall);
                setCurrentChainIds(prev => [...prev, newWall.id]);
                setWallStart(newPoint);
            }
        }
    } else if (drawingMode === 'arc_wall' && onWallAdd) {
        const newPoint = { x, y };
        if (!wallStart) { // First click: start point
            setWallStart(newPoint);
            setWallControlPoint(null);
        } else if (!wallControlPoint) { // Second click: end point
            setWallControlPoint(newPoint); // Temporarily store the end point
        } else { // Third click: control point for the curve
            const worldX1 = (wallStart.x - viewOffset.x) / (scale * zoom);
            const worldY1 = (wallStart.y - viewOffset.y) / (scale * zoom);
            const worldX2 = (wallControlPoint.x - viewOffset.x) / (scale * zoom);
            const worldY2 = (wallControlPoint.y - viewOffset.y) / (scale * zoom);
            const worldCPX = (newPoint.x - viewOffset.x) / (scale * zoom);
            const worldCPY = (newPoint.y - viewOffset.y) / (scale * zoom);

            onWallAdd({
                id: `wall_${Date.now()}`,
                x1: worldX1, y1: worldY1, x2: worldX2, y2: worldY2,
                height: 3, thickness: 0.2, lineStyle: 'solid', color: '#000000',
                controlPoint: { x: worldCPX, y: worldCPY }
            });
            
            setWallStart(null);
            setWallControlPoint(null);
            onDrawingModeChange('select');
        }
    } else if (drawingMode === 'measure') {
      if (measurePoints.length === 0) {
        setMeasurePoints([{ x, y }]);
      } else {
        setMeasurePoints([...measurePoints, { x, y }]);
      }
    }
  };

  const handleMouseMove2D = (e: React.MouseEvent) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    if (!interactive) {
        setMousePos({ x, y });
        return;
    }

    let worldX = (x - viewOffset.x) / (scale * zoom);
    let worldY = (y - viewOffset.y) / (scale * zoom);

    // 1. Wall Vertex Snapping
    if (!e.ctrlKey && (drawingMode === 'wall' || drawingMode === 'arc_wall' || drawingMode === 'rectangle' || isDragging)) {
        const SNAP_THRESHOLD_CANVAS = 15;
        const SNAP_THRESHOLD_WORLD = SNAP_THRESHOLD_CANVAS / (scale * zoom);
        let minDistanceSq = SNAP_THRESHOLD_WORLD * SNAP_THRESHOLD_WORLD;
        
        walls.forEach(w => {
            const d1Sq = Math.pow(worldX - w.x1, 2) + Math.pow(worldY - w.y1, 2);
            const d2Sq = Math.pow(worldX - w.x2, 2) + Math.pow(worldY - w.y2, 2);
            if (d1Sq < minDistanceSq) { minDistanceSq = d1Sq; worldX = w.x1; worldY = w.y1; }
            if (d2Sq < minDistanceSq) { minDistanceSq = d2Sq; worldX = w.x2; worldY = w.y2; }
        });
    }

    // 2. Angle Snapping (Shift key for 45 deg increments)
    if (e.shiftKey && wallStart && (drawingMode === 'wall' || drawingMode === 'arc_wall')) {
        const startWorldX = (wallStart.x - viewOffset.x) / (scale * zoom);
        const startWorldY = (wallStart.y - viewOffset.y) / (scale * zoom);
        const dx = worldX - startWorldX;
        const dy = worldY - startWorldY;
        const angle = Math.atan2(dy, dx);
        const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.sqrt(dx * dx + dy * dy);
        worldX = startWorldX + Math.cos(snappedAngle) * dist;
        worldY = startWorldY + Math.sin(snappedAngle) * dist;
    }

    // Update mousePos with snapped coordinates (converted back to canvas space)
    const snappedX = worldX * scale * zoom + viewOffset.x;
    const snappedY = worldY * scale * zoom + viewOffset.y;
    setMousePos({ x: snappedX, y: snappedY });

    if (selectionBox) {
        setSelectionBox({ ...selectionBox, x2: x, y2: y });
        return;
    }

    const canvas = canvas2DRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return;

    if (isErasing && drawingMode === 'delete') {
        const worldX = (x - viewOffset.x) / (scale * zoom);
        const worldY = (y - viewOffset.y) / (scale * zoom);

        setFloorPlan(prev => {
            const newPaths = [...(prev.erasedPaths || [])];
            if (newPaths.length === 0) return prev;
            const lastPath = newPaths[newPaths.length - 1];
            lastPath.points.push({ x: worldX, y: worldY });
            return { ...prev, erasedPaths: newPaths };
        });
        return; // Skip redraw, let state handle it
    }
    
    if (rotatingCameraId && onCameraUpdate) {
      const camera = cameras.find(c => c.id === rotatingCameraId);
      if (camera) {
        const zOffsetX = camera.z * scale * zoom * Z_OFFSET_FACTOR;
        const zOffsetY = camera.z * scale * zoom * Z_OFFSET_FACTOR;
        const iconX = (camera.x * scale * zoom + viewOffset.x) + zOffsetX;
        const iconY = (camera.y * scale * zoom + viewOffset.y) + zOffsetY;

        const dx = x - iconX;
        const dy = y - iconY;
        
        // NEW: Calculate distance for DORI
        const newCanvasDistance = Math.sqrt(dx * dx + dy * dy);
        const newDori = newCanvasDistance / (scale * zoom);

        let newRotation = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
        
        if (e.shiftKey) {
            newRotation = Math.round(newRotation / 15) * 15;
        }
        
        onCameraUpdate({ 
            ...camera,
            dori: parseFloat(newDori.toFixed(1)), // NEW
            rotation: parseFloat(newRotation.toFixed(1)) 
        });
      }
      return;
    }

    if (resizingPolygonHandle) {
        const worldX = (x - viewOffset.x) / (scale * zoom);
        const worldY = (y - viewOffset.y) / (scale * zoom);

        const { groupId, vertex: oldVertex } = resizingPolygonHandle;

        setFloorPlan(prev => ({
            ...prev,
            walls: prev.walls.map(w => {
                if (w.groupId === groupId) {
                    if (Math.abs(w.x1 - oldVertex.x) < 0.01 && Math.abs(w.y1 - oldVertex.y) < 0.01) {
                        return { ...w, x1: worldX, y1: worldY };
                    }
                    if (Math.abs(w.x2 - oldVertex.x) < 0.01 && Math.abs(w.y2 - oldVertex.y) < 0.01) {
                        return { ...w, x2: worldX, y2: worldY };
                    }
                }
                return w;
            })
        }));
        
        setResizingPolygonHandle({ groupId, vertex: { x: worldX, y: worldY } });
        return;
    }


    if (rotatingObject && rotatingObject.type === 'element' && onElementRotate) {
        const angle = Math.atan2(y - rotatingObject.centerY, x - rotatingObject.centerX) * 180 / Math.PI + 90;
        let finalAngle = Math.round(angle);
        if (e.shiftKey) {
            finalAngle = Math.round(finalAngle / 15) * 15;
        }
        onElementRotate(rotatingObject.id, finalAngle);
        return;
    }

    if (rotatingObject && rotatingObject.type === 'multi' && rotatingObject.originalItems) {
        const mouseAngle = Math.atan2(y - (rotatingObject.centerY * scale * zoom + viewOffset.y), x - (rotatingObject.centerX * scale * zoom + viewOffset.x));
        let deltaAngle = mouseAngle - rotatingObject.initialMouseAngle!;
        
        if (e.shiftKey) {
            deltaAngle = Math.round((deltaAngle * 180 / Math.PI) / 15) * 15 * Math.PI / 180;
        }

        const cosA = Math.cos(deltaAngle);
        const sinA = Math.sin(deltaAngle);
        const cx = rotatingObject.centerX;
        const cy = rotatingObject.centerY;

        const updatedWalls: any[] = [];
        const updatedCameras: any[] = [];
        const updatedElements: any[] = [];

        rotatingObject.originalItems.forEach(item => {
            if (item.type === 'camera') {
                const rx = cx + (item.x - cx) * cosA - (item.y - cy) * sinA;
                const ry = cy + (item.x - cx) * sinA + (item.y - cy) * cosA;
                const rot = (item.rotation + deltaAngle * 180 / Math.PI) % 360;
                updatedCameras.push({ ...item, x: rx, y: ry, rotation: rot });
            } else if (item.type === 'element') {
                const rx = cx + (item.x - cx) * cosA - (item.y - cy) * sinA;
                const ry = cy + (item.x - cx) * sinA + (item.y - cy) * cosA;
                const rot = (item.rotation + deltaAngle * 180 / Math.PI) % 360;
                updatedElements.push({ ...item, x: rx, y: ry, rotation: rot });
            } else if (item.type === 'wall') {
                const nx1 = cx + (item.x1 - cx) * cosA - (item.y1 - cy) * sinA;
                const ny1 = cy + (item.x1 - cx) * sinA + (item.y1 - cy) * cosA;
                const nx2 = cx + (item.x2 - cx) * cosA - (item.y2 - cy) * sinA;
                const ny2 = cy + (item.x2 - cx) * sinA + (item.y2 - cy) * cosA;
                let uWall = { ...item, x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
                if (item.controlPoint) {
                    const ncx = cx + (item.controlPoint.x - cx) * cosA - (item.controlPoint.y - cy) * sinA;
                    const ncy = cy + (item.controlPoint.x - cx) * sinA + (item.controlPoint.y - cy) * cosA;
                    uWall.controlPoint = { x: ncx, y: ncy };
                }
                updatedWalls.push(uWall);
            }
        });

        setFloorPlan(prev => ({
            ...prev,
            cameras: prev.cameras.map(c => updatedCameras.find(uc => uc.id === c.id) || c),
            elements: prev.elements.map(e => updatedElements.find(ue => ue.id === e.id) || e),
            walls: prev.walls.map(w => updatedWalls.find(uw => uw.id === w.id) || w),
        }));
        return;
    }
    if (resizingObject) {
        const worldX = (x - viewOffset.x) / (scale * zoom);
        const worldY = (y - viewOffset.y) / (scale * zoom);
        
        const groupWalls = walls.filter(w => w.groupId === resizingObject.groupId);
        if (groupWalls.length !== 4) return;
        
        const allOldX = groupWalls.flatMap(w => [w.x1, w.x2]);
        const allOldY = groupWalls.flatMap(w => [w.y1, w.y2]);
        let oldMinX = Math.min(...allOldX); let oldMinY = Math.min(...allOldY);
        let oldMaxX = Math.max(...allOldX); let oldMaxY = Math.max(...allOldY);
    
        let newMinX = oldMinX, newMinY = oldMinY, newMaxX = oldMaxX, newMaxY = oldMaxY;
    
        switch (resizingObject.handle) {
            case 'top-left': newMinX = worldX; newMinY = worldY; break;
            case 'top-right': newMaxX = worldX; newMinY = worldY; break;
            case 'bottom-left': newMinX = worldX; newMaxY = worldY; break;
            case 'bottom-right': newMaxX = worldX; newMaxY = worldY; break;
            case 'top-middle': newMinY = worldY; break;
            case 'bottom-middle': newMaxY = worldY; break;
            case 'left-middle': newMinX = worldX; break;
            case 'right-middle': newMaxX = worldX; break;
        }
        
        if (newMinX > newMaxX) [newMinX, newMaxX] = [newMaxX, newMinX];
        if (newMinY > newMaxY) [newMinY, newMaxY] = [newMaxY, newMinY];
    
        const updatedWalls = walls.map(wall => {
            if (wall.groupId !== resizingObject.groupId) return wall;

            const isTopWall = wall.y1 === oldMinY && wall.y2 === oldMinY;
            const isBottomWall = wall.y1 === oldMaxY && wall.y2 === oldMaxY;
            const isLeftWall = wall.x1 === oldMinX && wall.x2 === oldMinX;
            const isRightWall = wall.x1 === oldMaxX && wall.x2 === oldMaxX;
    
            if (isTopWall) return { ...wall, x1: newMinX, y1: newMinY, x2: newMaxX, y2: newMinY };
            if (isRightWall) return { ...wall, x1: newMaxX, y1: newMinY, x2: newMaxX, y2: newMaxY };
            if (isBottomWall) return { ...wall, x1: newMaxX, y1: newMaxY, x2: newMinX, y2: newMaxY };
            if (isLeftWall) return { ...wall, x1: newMinX, y1: newMaxY, x2: newMinX, y2: newMinY };
            
            return wall;
        });
    
        setFloorPlan(prev => ({ ...prev, walls: updatedWalls }));
        return;
    }
    if (draggedWallHandle && selectedWall && onWallUpdate) {
        const worldX = (x - viewOffset.x) / (scale * zoom);
        const worldY = (y - viewOffset.y) / (scale * zoom);
        if (draggedWallHandle === 'start') {
            onWallUpdate({ ...selectedWall, x1: worldX, y1: worldY });
        } else {
            onWallUpdate({ ...selectedWall, x2: worldX, y2: worldY });
        }
        return;
    }
    
    if (isDragging || draggedObject) {
      const worldDeltaX = (x - dragStart.x) / (scale * zoom);
      const worldDeltaY = (y - dragStart.y) / (scale * zoom);
  
      if (isDragging) {
        setViewOffset(prev => ({ x: prev.x + (x - dragStart.x), y: prev.y + (y - dragStart.y) }));
      } else if (draggedObject) {
        if (draggedObject.type === 'camera' && onCameraUpdate) {
          const camera = cameras.find(c => c.id === draggedObject.id);
          if (camera) onCameraUpdate({ ...camera, x: camera.x + worldDeltaX, y: camera.y + worldDeltaY });
        } else if (draggedObject.type === 'element' && onElementUpdate) {
          const element = elements.find(el => el.id === draggedObject.id);
          if (element) onElementUpdate({ ...element, x: element.x + worldDeltaX, y: element.y + worldDeltaY });
        } else if (draggedObject.type === 'wall' && onWallUpdate) {
          const wall = walls.find(w => w.id === draggedObject.id);
          if (wall) {
            const updatedWall: Wall = {
              ...wall,
              x1: wall.x1 + worldDeltaX,
              y1: wall.y1 + worldDeltaY,
              x2: wall.x2 + worldDeltaX,
              y2: wall.y2 + worldDeltaY,
            };
            if (wall.controlPoint) {
              updatedWall.controlPoint = {
                x: wall.controlPoint.x + worldDeltaX,
                y: wall.controlPoint.y + worldDeltaY,
              };
            }
            onWallUpdate(updatedWall);
          }
        } else if (draggedObject.type === 'wall_group' && onWallUpdate) {
            walls.forEach(wall => {
              if (wall.groupId === draggedObject.id) {
                const updatedWall: Wall = {
                  ...wall,
                  x1: wall.x1 + worldDeltaX,
                  y1: wall.y1 + worldDeltaY,
                  x2: wall.x2 + worldDeltaX,
                  y2: wall.y2 + worldDeltaY,
                };
                if (wall.controlPoint) {
                  updatedWall.controlPoint = {
                    x: wall.controlPoint.x + worldDeltaX,
                    y: wall.controlPoint.y + worldDeltaY,
                  };
                }
                onWallUpdate(updatedWall);
              }
            });
        }
      }
      setDragStart({ x, y });
    }

    draw2D(e);
  };


  const handleMouseUp2D = (e: React.MouseEvent) => {
    if (!interactive) return;

    if (selectionBox && onSelectionChange) {
        const sx1 = Math.min(selectionBox.x1, selectionBox.x2);
        const sy1 = Math.min(selectionBox.y1, selectionBox.y2);
        const sx2 = Math.max(selectionBox.x1, selectionBox.x2);
        const sy2 = Math.max(selectionBox.y1, selectionBox.y2);
        
        const worldX1 = (sx1 - viewOffset.x) / (scale * zoom);
        const worldY1 = (sy1 - viewOffset.y) / (scale * zoom);
        const worldX2 = (sx2 - viewOffset.x) / (scale * zoom);
        const worldY2 = (sy2 - viewOffset.y) / (scale * zoom);

        const newSelectedIds: string[] = [];
        
        cameras.forEach(c => {
            if (c.x >= worldX1 && c.x <= worldX2 && c.y >= worldY1 && c.y <= worldY2) {
                newSelectedIds.push(c.id);
            }
        });
        
        elements.forEach(el => {
            if (el.x >= worldX1 && el.x <= worldX2 && el.y >= worldY1 && el.y <= worldY2) {
                newSelectedIds.push(el.id);
            }
        });
        
        walls.forEach(w => {
            const p1In = w.x1 >= worldX1 && w.x1 <= worldX2 && w.y1 >= worldY1 && w.y1 <= worldY2;
            const p2In = w.x2 >= worldX1 && w.x2 <= worldX2 && w.y2 >= worldY1 && w.y2 <= worldY2;
            if (p1In && p2In) {
                newSelectedIds.push(w.id);
            }
        });

        const combined = e.shiftKey ? [...selectedIds, ...newSelectedIds] : newSelectedIds;
        onSelectionChange(combined.filter((v, i, a) => a.indexOf(v) === i));
        setSelectionBox(null);
        return;
    }

    if (isErasing) {
        setIsErasing(false);
    }
    if (draggedWallHandle) setDraggedWallHandle(null);
    if (draggedObject) setDraggedObject(null);
    if (isDragging) setIsDragging(false);
    if (rotatingObject) setRotatingObject(null);
    if (resizingObject) setResizingObject(null);
    if (resizingPolygonHandle) setResizingPolygonHandle(null);
    if (rotatingCameraId) setRotatingCameraId(null);


    if (drawingMode === 'rectangle' && rectangleStart && setFloorPlan && onDrawingModeChange) {
        const worldStartX = (rectangleStart.x - viewOffset.x) / (scale * zoom);
        const worldStartY = (rectangleStart.y - viewOffset.y) / (scale * zoom);
        const worldEndX = (mousePos.x - viewOffset.x) / (scale * zoom);
        const worldEndY = (mousePos.y - viewOffset.y) / (scale * zoom);
        
        let newMinX = Math.min(worldStartX, worldEndX);
        let newMinY = Math.min(worldStartY, worldEndY);
        let newMaxX = Math.max(worldStartX, worldEndX);
        let newMaxY = Math.max(worldStartY, worldEndY);

        if (e.shiftKey) {
            const size = Math.max(newMaxX - newMinX, newMaxY - newMinY);
            newMaxX = newMinX + size;
            newMaxY = newMinY + size;
        }

        const groupId = `rect_${Date.now()}`;
        const newWalls: Wall[] = [
            { id: `wall_rect_1_${Date.now()}`, groupId, x1: newMinX, y1: newMinY, x2: newMaxX, y2: newMinY, height: 3, thickness: 0.2, color: '#000000', lineStyle: 'solid' },
            { id: `wall_rect_2_${Date.now()}`, groupId, x1: newMaxX, y1: newMinY, x2: newMaxX, y2: newMaxY, height: 3, thickness: 0.2, color: '#000000', lineStyle: 'solid' },
            { id: `wall_rect_3_${Date.now()}`, groupId, x1: newMaxX, y1: newMaxY, x2: newMinX, y2: newMaxY, height: 3, thickness: 0.2, color: '#000000', lineStyle: 'solid' },
            { id: `wall_rect_4_${Date.now()}`, groupId, x1: newMinX, y1: newMaxY, x2: newMinX, y2: newMinY, height: 3, thickness: 0.2, color: '#000000', lineStyle: 'solid' },
        ];

        setFloorPlan(prev => ({ ...prev, walls: [...prev.walls, ...newWalls] }));
        
        setRectangleStart(null);
        onDrawingModeChange('select');
    }
  };



  const handleDoubleClick2D = () => {
    if (!interactive) return;

    if (drawingMode === 'measure' && measurePoints.length > 1 && onMeasurementAdd) {
      const worldPoints = measurePoints.map(p => ({
        x: (p.x - viewOffset.x) / (scale * zoom),
        y: (p.y - viewOffset.y) / (scale * zoom)
      }));

      const totalDistance = worldPoints.reduce((sum, point, idx) => {
        if (idx === 0) return 0;
        const prev = worldPoints[idx - 1];
        return sum + Math.sqrt(Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2));
      }, 0);

      onMeasurementAdd({
        id: `measure_${Date.now()}`,
        points: worldPoints,
        distance: totalDistance,
        label: `Medida ${measurements.length + 1}`
      });

      setMeasurePoints([]);
    } else if (drawingMode === 'wall' && wallStart && onDrawingModeChange) {
        setWallStart(null);
        setWallChainStart(null);
        onDrawingModeChange('select');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    if (drawingMode === 'wall' && wallStart && onDrawingModeChange) {
        setWallStart(null);
        setWallChainStart(null);
        onDrawingModeChange('select');
    }
    if (drawingMode === 'measure' && measurePoints.length > 0 && onDrawingModeChange) {
        setMeasurePoints([]);
        onDrawingModeChange('select');
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden" ref={containerRef}>
       <TooltipProvider>
      <canvas
        ref={canvas2DRef}
        className="absolute top-0 left-0 w-full h-full"
        onMouseDown={handleMouseDown2D}
        onMouseMove={handleMouseMove2D}
        onMouseUp={handleMouseUp2D}
        onMouseLeave={handleMouseUp2D}
        onDoubleClick={handleDoubleClick2D}
        onContextMenu={handleContextMenu}
        style={{
          cursor: !interactive ? 'default' :
                  drawingMode === 'delete' ? 'none' : 
                  drawingMode === 'pan' ? (isDragging ? 'grabbing' : 'grab') :
                  drawingMode === 'camera' || drawingMode === 'element' || drawingMode === 'wall' || drawingMode === 'arc_wall' || drawingMode === 'rectangle' || drawingMode === 'text' ? 'crosshair' :
                  drawingMode === 'measure' ? 'cell' :
                  (isDragging || draggedObject || rotatingObject) ? 'grabbing' : 
                  (rotatingCameraId) ? 'grab' : 
                  drawingMode === 'select' ? 'default' : 'default'
        }}
      />
      {interactive && <input type="file" ref={bgImageInputRef} className="hidden" accept="image/png,image/jpeg,image/gif,.dxf" onChange={handleFileUpload} />}

     
      {interactive && onDrawingModeChange && (
        <div className="absolute top-4 left-4 flex flex-col gap-1 bg-background/80 backdrop-blur-sm p-1 rounded-lg shadow">
            <ToolbarButton title="Selecionar (V)" isActive={drawingMode === 'select'} onClick={() => onDrawingModeChange('select')}><MousePointer2 className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Mover/Pan (H)" isActive={drawingMode === 'pan'} onClick={() => onDrawingModeChange('pan')}><Hand className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Adicionar Câmera (C)" isActive={drawingMode === 'camera'} onClick={() => onDrawingModeChange('camera')}><CameraIcon className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Linha/Polígono (W)" isActive={drawingMode === 'wall'} onClick={() => onDrawingModeChange('wall')}><Spline className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Parede Curva (A)" isActive={drawingMode === 'arc_wall'} onClick={() => onDrawingModeChange('arc_wall')}><Orbit className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Retângulo" isActive={drawingMode === 'rectangle'} onClick={() => onDrawingModeChange('rectangle')}><RectangleHorizontal className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Medir Distância (M)" isActive={drawingMode === 'measure'} onClick={() => onDrawingModeChange('measure')}><Ruler className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Texto (T)" isActive={drawingMode === 'text'} onClick={() => onDrawingModeChange('text')}><TypeIcon className="w-5 h-5" /></ToolbarButton>
            <div className="h-px bg-border my-1" />
            <ToolbarButton title="Agrupar" isActive={false} onClick={() => onGroup?.()}><Combine className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Desagrupar" isActive={false} onClick={() => onUngroup?.()}><Ungroup className="w-5 h-5" /></ToolbarButton>
            <div className="h-px bg-border my-1" />
            <ToolbarButton title="Carregar Imagem de Fundo" isActive={false} onClick={() => bgImageInputRef.current?.click()}><ImageIcon className="w-5 h-5" /></ToolbarButton>
            {backgroundImage && onImageRemove && <ToolbarButton title="Remover Imagem de Fundo" isActive={false} onClick={onImageRemove}><Trash2 className="w-5 h-5 text-destructive" /></ToolbarButton>}
            {onUndo && <ToolbarButton title="Desfazer (Ctrl+Z)" isActive={false} onClick={onUndo}><Undo className="w-5 h-5" /></ToolbarButton>}
            {onRedo && <ToolbarButton title="Refazer (Ctrl+Y)" isActive={false} onClick={onRedo}><Redo className="w-5 h-5" /></ToolbarButton>}
            <div className="h-px bg-border my-1" />
            <ToolbarButton 
              title="Trazer para Frente" 
              isActive={false} 
              onClick={() => selectedIds.length > 0 && onReorder?.(selectedIds[0], 'front')}
              className={selectedIds.length === 0 ? "opacity-30 pointer-events-none" : "text-blue-600"}
            >
              <ArrowUpToLine className="w-5 h-5" />
            </ToolbarButton>
            <ToolbarButton 
              title="Enviar para Trás" 
              isActive={false} 
              onClick={() => selectedIds.length > 0 && onReorder?.(selectedIds[0], 'back')}
              className={selectedIds.length === 0 ? "opacity-30 pointer-events-none" : ""}
            >
              <ArrowDownToLine className="w-5 h-5" />
            </ToolbarButton>
            <div className="h-px bg-border my-1" />
            <ToolbarButton title="Borracha (E)" isActive={drawingMode === 'delete'} onClick={() => onDrawingModeChange('delete')}><Eraser className="w-5 h-5" /></ToolbarButton>
        </div>
        )}
        
        {interactive && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 bg-background/80 backdrop-blur-sm p-1 rounded-lg shadow">
            <ToolbarButton title="Zoom In (Ctrl++)" isActive={false} onClick={() => setZoom(prev => Math.min(prev + 0.2, 5))}><ZoomIn className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Resetar Zoom" isActive={false} onClick={() => setZoom(1)}><Maximize2 className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Zoom Out (Ctrl+-)" isActive={false} onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.1))}><ZoomOut className="w-5 h-5" /></ToolbarButton>
            <ToolbarButton title="Mostrar/Ocultar Grade (G)" isActive={showGrid} onClick={() => setShowGrid(!showGrid)}><Grid3x3 className="w-5 h-5" /></ToolbarButton>
          </div>
        )}
      </TooltipProvider>

      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow pointer-events-none">
        <div className="text-sm text-gray-700 space-y-1">
          <div className="flex items-center gap-4">
            <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            <span>Câmeras: {cameras.length}</span>
            <span>Elementos: {elements.length}</span>
          </div>
          {interactive && (
             <div className="text-xs text-gray-500">
                {drawingMode === 'measure' && measurePoints.length > 0 ? `Medindo... ${measurePoints.length} ponto(s) - Duplo-clique para finalizar` :
                 drawingMode === 'wall' && wallStart ? `Desenhando paredes... Clique para adicionar pontos, clique com o botão direito para finalizar.` :
                 drawingMode === 'rectangle' && rectangleStart ? `Desenhando retângulo...` :
                 drawingMode === 'delete' ? `Borracha: ${eraserSize}px (Ctrl+/-)` :
                 `Ferramenta: ${drawingMode}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
