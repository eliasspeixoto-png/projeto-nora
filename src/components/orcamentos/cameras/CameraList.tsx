'use client';

import React from 'react';
import type { Camera } from '@/lib/cftv-types';
import { Eye, EyeOff, Camera as DefaultCameraIcon, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CameraListProps {
  cameras: Camera[];
  selectedCamera: Camera | null;
  onCameraSelect: (camera: Camera) => void;
  onCameraToggleFOV: (id: string) => void;
}

const CameraIcon = ({ type }: { type: Camera['type'] }) => {
    switch (type) {
      case 'bullet':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="5" width="12" height="14" rx="2" fill="hsl(var(--muted-foreground))"/>
            <rect x="5" y="4" width="14" height="3" rx="1" fill="hsl(var(--secondary-foreground))"/>
            <circle cx="12" cy="12" r="4" fill="hsl(var(--foreground))" />
            <circle cx="12" cy="12" r="2" fill="hsl(var(--background))" opacity="0.7"/>
          </svg>
        );
      case 'dome':
      case 'spy_dome':
        const isSpy = type === 'spy_dome';
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="hsl(var(--muted-foreground))"/>
            <circle cx="12" cy="12" r="8" fill={isSpy ? 'hsl(var(--secondary-foreground))' : 'hsl(var(--background))'} />
            <circle cx="12" cy="12" r="3" fill="hsl(var(--foreground))" />
          </svg>
        );
      default:
        return <DefaultCameraIcon className="w-6 h-6 text-muted-foreground" />;
    }
  };

export default function CameraList({
  cameras,
  selectedCamera,
  onCameraSelect,
  onCameraToggleFOV
}: CameraListProps) {

  const getCameraColor = (camera: Camera) => {
    if (camera.isInternal) return 'text-primary';
    return 'text-green-600';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border shrink-0">
        <h2 className="font-semibold text-card-foreground">Lista de Câmeras</h2>
        <p className="text-sm text-muted-foreground">{cameras.length} câmeras instaladas</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {cameras.map(camera => (
            <div
              key={camera.id}
              className={`p-4 cursor-pointer transition-colors hover:bg-muted ${
                selectedCamera?.id === camera.id ? 'bg-accent/20 border-l-4 border-primary' : ''
              }`}
              onClick={() => onCameraSelect(camera)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CameraIcon type={camera.type} />
                  <span className={`font-medium ${getCameraColor(camera)}`}>
                    {camera.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCameraToggleFOV(camera.id);
                  }}
                  className="p-1 hover:bg-muted-foreground/10 rounded"
                  title={camera.showFov ? "Ocultar cone" : "Mostrar cone"}
                >
                  {camera.showFov ? (
                    <Eye className="w-4 h-4 text-foreground" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Posição:</span>
                  <span>{camera.x.toFixed(1)}m, {camera.y.toFixed(1)}m</span>
                </div>
                <div className="flex justify-between">
                  <span>Resolução:</span>
                  <span className="font-medium text-foreground">{camera.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span>DORI:</span>
                  <span>{camera.dori}m</span>
                </div>
                <div className="flex justify-between">
                  <span>Tipo:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    camera.isInternal 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {camera.isInternal ? 'Interna' : 'Externa'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {cameras.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <DefaultCameraIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>Nenhuma câmera adicionada</p>
              <p className="text-sm mt-1">Use o painel de controles para adicionar.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
