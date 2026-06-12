'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Camera, Wall, CameraPreset, Element as CftvElement, Measurement, FloorPlan } from '@/lib/cftv-types';
import type { Client, Product } from '@/lib/data';
import { 
  Download,
  Upload,
  Save,
  Trash2,
  Info,
  Car,
  Truck,
  Sprout,
  HardDrive,
  PersonStanding,
  Square,
  Camera as CameraIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from "@/components/ui/label";

interface ControlsPanelProps {
  selectedCamera: Camera | null;
  selectedWall: Wall | null;
  selectedElement: CftvElement | null;
  walls: Wall[];
  elements: CftvElement[];
  cameras: Camera[];
  floorPlan: FloorPlan;
  onCameraUpdate: (camera: Camera) => void;
  onWallUpdate: (wall: Wall) => void;
  onElementUpdate: (element: CftvElement) => void;
  onCameraDelete: (id: string) => void;
  onWallRemove: (id: string) => void;
  onElementDelete: (id: string) => void;
  onReorder?: (id: string, direction: 'front' | 'back') => void;
  onGroup: () => void;
  onUngroup: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onSave: () => void;
  onAddPresetCamera: (preset: CameraPreset) => void;
  onAddElementPreset: (preset: any) => void;
  onAddCameraFromModel: (productId: string) => void;
  clients: Client[];
  selectedClientId: string | null;
  onClientChange: (clientId: string) => void;
  isSaving: boolean;
  cameraProducts: Product[];
  measurements: Measurement[];
  onMeasurementRemove: (id: string) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  showMeasurements: boolean;
  onShowMeasurementsChange: (show: boolean) => void;
  manufacturer: string;
  onManufacturerChange: (manufacturer: string) => void;
  allManufacturers: string[];
  cableType: 'coaxial' | 'utp';
  onCableTypeChange: (type: 'coaxial' | 'utp') => void;
  technologyType: string;
  onTechnologyTypeChange: (type: string) => void;
  ipSystemType: 'nvr-poe' | 'nvr-no-poe' | 'dvr';
  onIpSystemTypeChange: (type: 'nvr-poe' | 'nvr-no-poe' | 'dvr') => void;
  selectedRectangleDimensions: { width: number; height: number } | null;
  onRectangleDimensionsUpdate: (groupId: string, newDimensions: { width: number; height: number }) => void;
  selectedIds: string[];
}

const Field = ({ label, children, tooltipText }: { label: string, children: React.ReactNode, tooltipText?: string }) => (
    <div className="grid grid-cols-2 items-center">
        <label className="text-xs font-medium text-foreground flex items-center gap-1">
            {label}
            {tooltipText && (
                <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs">{tooltipText}</p></TooltipContent>
                </Tooltip>
            )}
        </label>
        {children}
    </div>
);

const ElementButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Tooltip>
      <TooltipTrigger asChild>
          <Button variant="ghost" className="h-auto p-2 flex flex-col gap-1 items-center" onClick={onClick}>
              {icon}
              <span className="text-[10px]">{label}</span>
          </Button>
      </TooltipTrigger>
      <TooltipContent side="top"><p>Adicionar {label}</p></TooltipContent>
  </Tooltip>
);

export default function ControlsPanel({
  selectedCamera,
  selectedWall,
  selectedElement,
  walls,
  elements,
  cameras,
  floorPlan,
  onCameraUpdate,
  onWallUpdate,
  onElementUpdate,
  onCameraDelete,
  onWallRemove,
  onElementDelete,
  onReorder,
  onGroup,
  onUngroup,
  onExport,
  onImport,
  onSave,
  onAddPresetCamera,
  onAddElementPreset,
  onAddCameraFromModel,
  clients,
  selectedClientId,
  onClientChange,
  isSaving,
  cameraProducts,
  measurements,
  onMeasurementRemove,
  scale,
  onScaleChange,
  showMeasurements,
  onShowMeasurementsChange,
  manufacturer,
  onManufacturerChange,
  allManufacturers,
  cableType,
  onCableTypeChange,
  technologyType,
  onTechnologyTypeChange,
  ipSystemType,
  onIpSystemTypeChange,
  selectedRectangleDimensions,
  onRectangleDimensionsUpdate,
  selectedIds,
}: ControlsPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rectDims, setRectDims] = useState({ width: '', height: '' });
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  useEffect(() => {
    if (selectedCamera) {
        setSelectedModelId(selectedCamera.productId || '');
    }
  }, [selectedCamera]);

  useEffect(() => {
    if (selectedRectangleDimensions) {
      setRectDims({
        width: selectedRectangleDimensions.width.toFixed(2),
        height: selectedRectangleDimensions.height.toFixed(2),
      });
    }
  }, [selectedRectangleDimensions]);

  const handleRectDimChange = (field: 'width' | 'height', value: string) => {
    setRectDims(prev => ({ ...prev, [field]: value }));
  };

  const handleRectDimSubmit = () => {
    if (selectedWall?.groupId) {
      const newWidth = parseFloat(rectDims.width);
      const newHeight = parseFloat(rectDims.height);
      if (!isNaN(newWidth) && !isNaN(newHeight)) {
        onRectangleDimensionsUpdate(selectedWall.groupId, { width: newWidth, height: newHeight });
      }
    }
  };


  const handleElementFieldChange = (field: keyof CftvElement, value: any) => {
    if (selectedElement) {
        let updatedElement = { ...selectedElement, [field]: value };
        // Special handling for circle/tree diameter
        if ((selectedElement.type === 'circle' || selectedElement.type === 'tree') && (field === 'width' || field === 'depth')) {
            updatedElement.width = value;
            updatedElement.depth = value;
        }
        onElementUpdate(updatedElement);
    }
  };

  const handleCameraFieldChange = (field: keyof Camera, value: any) => {
    if (selectedCamera) {
      let updatedCamera = { ...selectedCamera, [field]: value };
      
      if (field === 'isInternal') {
        updatedCamera.fovColor = value ? '#3b82f6' : '#10b981'; // Blue for internal, green for external
      }

      if (field === 'resolution' || field === 'lensType' || field === 'varifocalFocalLength') {
          // A lógica de recálculo foi movida para o componente pai para evitar sobrescrita
      }

      onCameraUpdate(updatedCamera);
    }
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
  };

  // Dynamic calculation for camera reach and diagonal FOV
  const { blindSpotRadiusMeters, effectiveReach, groundCoverageLength, diagonalAngle } = useMemo(() => {
    if (!selectedCamera) return { blindSpotRadiusMeters: 0, effectiveReach: 0, groundCoverageLength: 0, diagonalAngle: 0 };
    
    const lowerRayAngleRad = (selectedCamera.tilt - selectedCamera.verticalAngle / 2) * Math.PI / 180;
    let tanLowerAngle = 0;
    if (lowerRayAngleRad < 0) {
        tanLowerAngle = Math.tan(-lowerRayAngleRad);
    }
    
    let blindSpotRadiusMeters = 0;
    if (tanLowerAngle > 0.001 && selectedCamera.z > 0) {
        blindSpotRadiusMeters = selectedCamera.z / tanLowerAngle;
    }

    const upperRayAngleRad = (selectedCamera.tilt + selectedCamera.verticalAngle / 2) * Math.PI / 180;
    let geometricReach = Infinity;
    if (upperRayAngleRad < 0) {
        const tanUpperAngle = Math.tan(-upperRayAngleRad);
         if (tanUpperAngle > 0.001) {
            geometricReach = selectedCamera.z / tanUpperAngle;
        }
    }
    
    const reach = Math.min(selectedCamera.dori, geometricReach);
    const coverage = Math.max(0, reach - blindSpotRadiusMeters);

    const diagAngle = Math.sqrt(
        Math.pow(selectedCamera.horizontalAngle, 2) +
        Math.pow(selectedCamera.verticalAngle, 2)
    );

    return { 
        blindSpotRadiusMeters: blindSpotRadiusMeters, 
        effectiveReach: reach, 
        groundCoverageLength: coverage,
        diagonalAngle: diagAngle
    };
  }, [selectedCamera]);


  return (
    <div className="w-80 bg-background/95 backdrop-blur-3xl border-l border-border/40 shadow-premium relative rounded-l-[3.5rem] overflow-hidden">
      <div className="absolute inset-0 overflow-y-auto p-8 custom-scrollbar">

        {/* Client Selection */}
        <div className="mb-8 space-y-2">
          <label className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] opacity-60 ml-2">
            Cliente Proprietário
          </label>
          <Select value={selectedClientId || ''} onValueChange={onClientChange}>
            <SelectTrigger className="h-12 rounded-2xl bg-muted/20 border-transparent font-bold text-xs">
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-3xl">
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id} className="h-10 rounded-xl font-bold text-xs">
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* NEW Manufacturer & Cable Selection */}
        <div className="mb-8 space-y-5">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] opacity-60 ml-2">
              Fabricante
            </label>
            <Select value={manufacturer} onValueChange={onManufacturerChange}>
              <SelectTrigger className="h-11 rounded-2xl bg-muted/20 border-transparent font-bold text-xs">
                <SelectValue placeholder="Selecione um fabricante" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-3xl">
                <SelectItem value="all" className="font-bold text-xs">Todos</SelectItem>
                {allManufacturers.map(m => (
                  <SelectItem key={m} value={m} className="font-bold text-xs">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <label className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] opacity-60 ml-2">
              Tecnologia da Câmera
            </label>
            <Select value={technologyType} onValueChange={onTechnologyTypeChange}>
              <SelectTrigger className="h-11 rounded-2xl bg-muted/20 border-transparent font-bold text-xs">
                <SelectValue placeholder="Selecione a tecnologia" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-3xl">
                <SelectItem value="all" className="font-bold text-xs">Todas</SelectItem>
                <SelectItem value="cabeada" className="font-bold text-xs">Cabeada (Analógica)</SelectItem>
                <SelectItem value="ip" className="font-bold text-xs">IP</SelectItem>
                <SelectItem value="wifi" className="font-bold text-xs">Wi-Fi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {technologyType === 'ip' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Tipo de Gravador (IP)
              </label>
              <Select value={ipSystemType} onValueChange={onIpSystemTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de sistema IP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nvr-poe">NVR com PoE</SelectItem>
                  <SelectItem value="nvr-no-poe">NVR sem PoE (+ Switch)</SelectItem>
                  <SelectItem value="dvr">DVR Híbrido (+ Switch)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground mb-1">
                    Modelo da Câmera
                </label>
                <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo..." />
                    </SelectTrigger>
                    <SelectContent>
                    {cameraProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.description}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <Button 
                    className="w-full" 
                    size="sm"
                    disabled={!selectedModelId}
                    onClick={() => onAddCameraFromModel(selectedModelId)}
                >
                    <CameraIcon className="mr-2 h-4 w-4" />
                    Adicionar Câmera Selecionada
                </Button>
            </div>
          <div>
            <label className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] opacity-60 ml-2 mb-2">
              Tipo de Cabeamento
            </label>
            <Select value={cableType} onValueChange={(v) => onCableTypeChange(v as 'coaxial' | 'utp')}>
              <SelectTrigger className="h-11 rounded-2xl bg-muted/20 border-transparent font-bold text-xs">
                <SelectValue placeholder="Selecione o tipo de cabo" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-3xl">
                <SelectItem value="utp" className="font-bold text-xs">Cabo de Rede (UTP)</SelectItem>
                <SelectItem value="coaxial" className="font-bold text-xs">Cabo Coaxial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Element Presets */}
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-2">Adicionar Elementos</h3>
          <TooltipProvider>
            <div className="grid grid-cols-5 gap-1">
                {/* Original Elements */}
                <ElementButton icon={<PersonStanding className="h-5 w-5"/>} label="Pessoa" onClick={() => onAddElementPreset({ type: 'person', height: 1.7 })} />
                <ElementButton icon={<Car className="h-5 w-5"/>} label="Carro" onClick={() => onAddElementPreset({ type: 'vehicle', subtype: 'car', height: 1.5, width: 2.0, depth: 4.5 })} />
                <ElementButton icon={<Truck className="h-5 w-5"/>} label="Caminhão" onClick={() => onAddElementPreset({ type: 'vehicle', subtype: 'truck', height: 2.4, width: 2.5, depth: 6.0 })} />
                <ElementButton icon={<Sprout className="h-5 w-5"/>} label="Árvore" onClick={() => onAddElementPreset({ type: 'tree', height: 3.0, width: 2.0 })} />
                <ElementButton icon={<HardDrive className="h-5 w-5"/>} label="DVR" onClick={() => onAddElementPreset({ type: 'dvr', height: 0.2 })} />
            </div>
          </TooltipProvider>
        </div>


        {/* Scale */}
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-3">Escala</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onScaleChange(50)}
              className={`p-3 rounded-lg flex flex-col items-center justify-center ${
                scale === 50
                  ? 'bg-primary/20 border-2 border-primary' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <span className="text-xs font-semibold">Visão Ampla</span>
            </button>
            <button
              onClick={() => onScaleChange(100)}
              className={`p-3 rounded-lg flex flex-col items-center justify-center ${
                scale === 100
                  ? 'bg-primary/20 border-2 border-primary' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <span className="text-xs font-semibold">Visão Detalhada</span>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between">
              <Label htmlFor="show-measurements-switch" className="font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                Exibir Medidas
                <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p>Mostra/oculta o comprimento das paredes e as medições da ferramenta Régua.</p></TooltipContent>
                </Tooltip>
              </Label>
               <Switch
                    id="show-measurements-switch"
                    checked={showMeasurements}
                    onCheckedChange={onShowMeasurementsChange}
                />
          </div>
          {showMeasurements && measurements.length > 0 && <div className="space-y-2 mt-3">
              {measurements.map((measurement, index) => (
              <div key={measurement.id} className="p-2 bg-muted rounded">
                  <div className="flex justify-between">
                  <span className="text-sm font-medium">{measurement.label}</span>
                  <button
                      onClick={() => onMeasurementRemove(measurement.id)}
                      className="text-red-600 hover:text-red-800 text-xs"
                  >
                      Remover
                  </button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                  Distância: {measurement.distance.toFixed(2)}m
                  </div>
              </div>
              ))}
          </div>}
        </div>
        
        {selectedWall && (
            <div className="mb-6 p-4 bg-primary/10 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-foreground">
                        {selectedWall.groupId?.startsWith('rect_') ? 'Retângulo Selecionado' : 'Parede Selecionada'}
                    </h3>
                    <button
                        onClick={() => {
                            if(selectedWall.groupId) {
                                walls.forEach(w => {
                                    if (w.groupId === selectedWall.groupId) onWallRemove(w.id);
                                });
                            } else {
                                onWallRemove(selectedWall.id);
                            }
                        }}
                        className="text-red-600 hover:text-red-800"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                <div className="space-y-4">
                    {selectedWall.groupId?.startsWith('rect_') && selectedRectangleDimensions ? (
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Largura (m)">
                                <input
                                    type="number" step="0.1" value={rectDims.width}
                                    onChange={(e) => handleRectDimChange('width', e.target.value)}
                                    onBlur={handleRectDimSubmit}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                    className="w-full px-2 py-1 border rounded-md text-xs" />
                            </Field>
                            <Field label="Altura (m)">
                                <input
                                    type="number" step="0.1" value={rectDims.height}
                                    onChange={(e) => handleRectDimChange('height', e.target.value)}
                                    onBlur={handleRectDimSubmit}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                    className="w-full px-2 py-1 border rounded-md text-xs" />
                            </Field>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">Edite a forma do polígono arrastando seus cantos na planta.</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Espessura (m)</label>
                        <input
                            type="number" step="0.1" min="0.1"
                            value={selectedWall.thickness}
                            onChange={(e) => onWallUpdate({ ...selectedWall, thickness: parseFloat(e.target.value) || 0.2 })}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Cor</label>
                        <input
                            type="color"
                            value={selectedWall.color || '#000000'}
                            onChange={(e) => onWallUpdate({ ...selectedWall, color: e.target.value })}
                            className="w-full h-10 px-1 py-1 border rounded-lg"
                        />
                    </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Estilo da Linha</label>
                        <Select
                            value={selectedWall.lineStyle || 'solid'}
                            onValueChange={(value) => onWallUpdate({ ...selectedWall, lineStyle: value as any })}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="solid">Sólida</SelectItem>
                                <SelectItem value="dashed">Tracejada</SelectItem>
                                <SelectItem value="dotted">Pontilhada</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        )}

        {/* Element Controls */}
        {selectedElement && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-foreground">Elemento: {selectedElement.name}</h3>
              <button onClick={() => onElementDelete(selectedElement.id)} className="text-red-600 hover:text-red-800" >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
               <TooltipProvider>
                  <Field label="Nome">
                    <input type="text" value={selectedElement.name} onChange={(e) => handleElementFieldChange('name', e.target.value)} className="w-full px-2 py-1 border rounded-md text-xs" />
                  </Field>

                  {/* Text editing fields */}
                  {selectedElement.type === 'text' && (
                      <>
                        <Field label="Texto">
                          <Textarea value={selectedElement.text || ''} onChange={(e) => handleElementFieldChange('text', e.target.value)} className="w-full px-2 py-1 border rounded-md text-xs" rows={3}/>
                        </Field>
                        <Field label="Tamanho Fonte">
                          <input type="number" step="1" min="8" value={selectedElement.fontSize || 14} onChange={(e) => handleElementFieldChange('fontSize', parseInt(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs"/>
                        </Field>
                        <Field label="Cor">
                          <input type="color" value={selectedElement.color || '#000000'} onChange={(e) => handleElementFieldChange('color', e.target.value)} className="w-full h-8 px-1 py-1 border rounded-md bg-background cursor-pointer"/>
                        </Field>
                      </>
                  )}

                  {/* Dynamic fields based on type */}
                  {selectedElement.type === 'person' ? (
                      <Field label="Altura (m)" tooltipText="Altura da pessoa para simular obstrução vertical.">
                          <input type="number" step="0.1" min="0.5" max="2.2" value={selectedElement.height} onChange={(e) => handleElementFieldChange('height', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs"/>
                      </Field>
                  ) : (selectedElement.type === 'circle' || selectedElement.type === 'tree') ? (
                      <>
                        <Field label="Diâmetro (m)">
                            <input type="number" step="0.1" min="0.1" value={selectedElement.width} onChange={(e) => handleElementFieldChange('width', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs"/>
                        </Field>
                        <Field label="Altura (m)">
                            <input type="number" step="0.1" min="0.1" value={selectedElement.height} onChange={(e) => handleElementFieldChange('height', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs"/>
                        </Field>
                      </>
                  ) : selectedElement.type !== 'text' && (
                      <>
                        <Field label="Largura (m)">
                            <input type="number" step="0.1" min="0.1" value={selectedElement.width} onChange={(e) => handleElementFieldChange('width', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs"/>
                        </Field>
                        <Field label={selectedElement.type === 'vehicle' ? 'Comprimento (m)' : 'Profundidade (m)'}>
                            <input type="number" step="0.1" min="0.1" value={selectedElement.depth} onChange={(e) => handleElementFieldChange('depth', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs"/>
                        </Field>
                        <Field label="Altura (m)">
                            <input type="number" step="0.1" min="0.1" value={selectedElement.height} onChange={(e) => handleElementFieldChange('height', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs"/>
                        </Field>
                        <Field label="Cor">
                            <input type="color" value={selectedElement.color || '#6b7280'} onChange={(e) => handleElementFieldChange('color', e.target.value)} className="w-full h-8 px-1 py-1 border rounded-md bg-background"/>
                        </Field>
                      </>
                  )}
              </TooltipProvider>
            </div>
          </div>
        )}


        {/* Configurações da Câmera Selecionada */}
        {selectedCamera && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg">
            <TooltipProvider>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-foreground">Câmera Selecionada</h3>
              <button
                onClick={() => onCameraDelete(selectedCamera.id)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
                <h4 className="text-sm font-semibold mb-2 border-b pb-1">Instalação e Geometria</h4>
                 <Field label="Altura (m)">
                    <input type="number" step="0.1" min="1" max="10" value={selectedCamera.z} onChange={(e) => handleCameraFieldChange('z', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs" />
                </Field>
                 <Field label="Inclinação (°)">
                    <input type="number" step="5" min="-90" max="0" value={selectedCamera.tilt} onChange={(e) => handleCameraFieldChange('tilt', parseInt(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs" />
                </Field>
                 <Field label="Rotação (°)">
                    <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={selectedCamera.rotation}
                        onChange={(e) => handleCameraFieldChange('rotation', parseInt(e.target.value))}
                        className="w-full"
                    />
                </Field>
                <Field label="Ponto Cego (chão)" tooltipText="Distância do pé da câmera até onde a visão começa.">
                    <input type="text" value={`${blindSpotRadiusMeters.toFixed(1)}m`} readOnly className="w-full px-2 py-1 border-none bg-muted rounded-md text-xs font-semibold" />
                </Field>
                <Field label="Alcance Máximo (chão)" tooltipText="Distância máxima de visão no chão, limitada pela geometria e DORI.">
                    <input type="text" value={`${effectiveReach.toFixed(1)}m`} readOnly className="w-full px-2 py-1 border-none bg-muted rounded-md text-xs font-semibold" />
                </Field>
                 <Field label="Comprimento da Visão" tooltipText="Comprimento total da área visível no chão.">
                    <input type="text" value={`${groundCoverageLength.toFixed(1)}m`} readOnly className="w-full px-2 py-1 border-none bg-muted rounded-md text-xs font-semibold text-primary" />
                </Field>

                <h4 className="text-sm font-semibold pt-4 mb-2 border-b pb-1">Propriedades da Câmera</h4>
                <Field label="Nome">
                    <input type="text" value={selectedCamera.name} onChange={(e) => handleCameraFieldChange('name', e.target.value)} className="w-full px-2 py-1 border rounded-md text-xs"/>
                </Field>
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">Interna</label>
                    <Switch
                        checked={selectedCamera.isInternal}
                        onCheckedChange={(checked) => handleCameraFieldChange('isInternal', checked)}
                    />
                </div>
                 <Field label="Cor do Cone (FOV)">
                  <input
                    type="color"
                    value={selectedCamera.fovColor}
                    onChange={(e) => handleCameraFieldChange('fovColor', e.target.value)}
                    className="w-full h-8 px-1 py-1 border rounded-md bg-background"
                  />
                </Field>
                <Field label="Tipo">
                    <Select value={selectedCamera.type} onValueChange={(v) => handleCameraFieldChange('type', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dome">Dome</SelectItem>
                            <SelectItem value="bullet">Bullet</SelectItem>
                            <SelectItem value="spy_dome">Spy Dome</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
                 <Field label="Resolução">
                    <Select value={selectedCamera.resolution} onValueChange={(v) => handleCameraFieldChange('resolution', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2MP">2MP</SelectItem>
                            <SelectItem value="4MP">4MP</SelectItem>
                            <SelectItem value="8MP">8MP</SelectItem>
                            <SelectItem value="12MP">12MP</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
                <Field label="Sensor">
                    <Select value={selectedCamera.sensorSize || '1/2.8"'} onValueChange={(v) => handleCameraFieldChange('sensorSize', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1/4&quot;">1/4"</SelectItem>
                            <SelectItem value="1/3&quot;">1/3"</SelectItem>
                            <SelectItem value="1/2.8&quot;">1/2.8"</SelectItem>
                            <SelectItem value="1/2.5&quot;">1/2.5"</SelectItem>
                            <SelectItem value="1/1.8&quot;">1/1.8"</SelectItem>
                            <SelectItem value="1&quot;">1"</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
                <Field label="Lente">
                    <Select value={selectedCamera.lensType} onValueChange={(v) => handleCameraFieldChange('lensType', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2.8mm">2.8mm</SelectItem>
                            <SelectItem value="3.6mm">3.6mm</SelectItem>
                            <SelectItem value="varifocal">Varifocal</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
                {selectedCamera.lensType === 'varifocal' && (
                    <Field label="Zoom Focal (mm)">
                         <input type="number" step="0.1" min="2.8" max="12" value={selectedCamera.varifocalFocalLength || 2.8} onChange={(e) => handleCameraFieldChange('varifocalFocalLength', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded-md text-xs" />
                    </Field>
                )}
                 <Field label="Alcance IR (m)">
                    <Select value={String(selectedCamera.irDistance)} onValueChange={(v) => handleCameraFieldChange('irDistance', parseInt(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10m</SelectItem>
                            <SelectItem value="20">20m</SelectItem>
                            <SelectItem value="30">30m</SelectItem>
                            <SelectItem value="40">40m</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
                 <Field label="DORI (Identificação)" tooltipText="Capacidade inerente da câmera para identificar um objeto (250px/m).">
                     <input type="text" value={`${selectedCamera.dori.toFixed(1)}m`} readOnly className="w-full px-2 py-1 border-none bg-muted rounded-md text-xs" />
                </Field>
                 <Field label="FOV Horizontal" tooltipText="Campo de Visão Horizontal inerente da lente.">
                    <input type="text" value={`${selectedCamera.horizontalAngle.toFixed(1)}°`} readOnly className="w-full px-2 py-1 border-none bg-muted rounded-md text-xs" />
                </Field>
                 <Field label="FOV Vertical" tooltipText="Campo de Visão Vertical inerente da lente.">
                     <input type="text" value={`${selectedCamera.verticalAngle.toFixed(1)}°`} readOnly className="w-full px-2 py-1 border-none bg-muted rounded-md text-xs" />
                </Field>
                <Field label="FOV Diagonal" tooltipText="Campo de Visão Diagonal (calculado). Útil para referência com especificações de fabricantes.">
                     <input type="text" value={`${diagonalAngle.toFixed(1)}°`} readOnly className="w-full px-2 py-1 border-none bg-muted rounded-md text-xs font-semibold text-primary" />
                </Field>
            </div>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}
