
export interface Camera {
  id: string;
  type: 'dome' | 'bullet' | 'spy_dome';
  name: string;
  x: number;
  y: number;
  z: number; // altura em metros
  resolution: '2MP' | '4MP' | '8MP' | '12MP';
  
  irDistance: number; // Alcance do IR em metros
  lensType: '2.8mm' | '3.6mm' | 'varifocal';
  varifocalFocalLength?: number;

  dori: number; // distância de identificação em metros
  horizontalAngle: number; // ângulo horizontal em graus
  verticalAngle: number; // ângulo vertical em graus
  
  rotation: number; // rotação em graus (eixo Z)
  tilt: number; // inclinação em graus (eixo X)
  floor: number;
  fovColor: string;
  showFov: boolean;
  sensorSize?: '1/4"' | '1/3"' | '1/2.8"' | '1/2.5"' | '1/1.8"' | '1"';
  productId?: string;
  isInternal: boolean;
  groupId?: string;
}

export type ElementType = 'person' | 'vehicle' | 'tree' | 'square' | 'circle' | 'triangle' | 'text' | 'dvr' | 'furniture' | 'bathroom';

export interface Element {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotation: number;
  color: string;
  subtype?: string;
  text?: string;
  fontSize?: number;
  svgUrl?: string;
  groupId?: string;
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  height: number;
  thickness: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  controlPoint?: { x: number; y: number }; // For curved walls
  groupId?: string;
}

export interface Measurement {
  id: string;
  points: { x: number; y: number }[];
  distance: number;
  label: string;
}

export interface FloorPlan {
  id: string;
  name: string;
  width: number;
  height: number;
  scale: number;
  floors: number;
  walls: Wall[];
  cameras: Camera[];
  elements: Element[];
  measurements: Measurement[];
  createdAt: Date;
  updatedAt: Date;
  backgroundImage?: string;
  erasedPaths?: { points: {x: number, y: number}[], size: number }[];
}

export type DrawingMode = 'select' | 'pan' | 'camera' | 'wall' | 'arc_wall' | 'measure' | 'delete' | 'rotate' | 'rectangle' | 'circle' | 'polygon' | 'text' | 'element';

export interface CameraPreset {
  name: string;
  type: Camera['type'];
  resolution: Camera['resolution'];
  dori: number;
  horizontalAngle: number;
  verticalAngle: number;
  defaultHeight: number;
}

export interface ElementPreset {
  name: string;
  type: Element['type'];
  width: number;
  height: number;
  depth: number;
  color: string;
  subtype?: string;
}
