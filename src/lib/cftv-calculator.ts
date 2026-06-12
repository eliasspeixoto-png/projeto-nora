
import type { Product, QuoteItem } from "@/lib/data";
import type { Camera as CftvCamera, Element as CftvElement, Wall } from '@/lib/cftv-types';

// Função auxiliar para encontrar produtos com base em palavras-chave
const findProduct = (
    products: Product[],
    keywords: (string | string[])[],
    segment?: string,
    excludeKeywords?: string[]
): Product | undefined => {
    const normalizeStr = (str: string = "") => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const candidates = products.filter(p => {
        const description = normalizeStr(p.description);
        const matchesSegment = segment ? normalizeStr(p.segment) === normalizeStr(segment) : true;
        if (!matchesSegment) return false;

        const matchesKeywords = keywords.every(kw => {
            if (Array.isArray(kw)) {
                return kw.some(altKw => description.includes(normalizeStr(altKw)));
            }
            return description.includes(normalizeStr(kw));
        });
        if (!matchesKeywords) return false;

        const matchesExclusion = excludeKeywords ? !excludeKeywords.some(exKw => description.includes(normalizeStr(exKw))) : true;
        if (!matchesExclusion) return false;
        
        return true;
    });

    // Prefer shorter descriptions as they are often more specific
    return candidates.sort((a, b) => a.description.length - b.description.length)[0];
};

export const calculateCftvMaterials = (
    cameras: CftvCamera[], 
    elements: CftvElement[], 
    products: Product[], 
    cableType: 'coaxial' | 'utp',
    technologyType: string,
    ipSystemType?: 'nvr-poe' | 'nvr-no-poe' | 'dvr'
): QuoteItem[] => {
    if (cameras.length === 0) return [];
    
    const dvrElement = elements.find(el => el.type === 'dvr');
    const materialMap: Map<string, QuoteItem> = new Map();

    const addItem = (product: Product | undefined, quantity: number) => {
        if (!product || quantity <= 0) return;
        
        const sellingPrice = product.sellingPrice || 0;
        const servicePrice = product.servicePrice || 0;
        const totalPerItem = sellingPrice + servicePrice;

        const existing = materialMap.get(product.id);
        if (existing) {
            existing.quantity += quantity;
            existing.total += quantity * totalPerItem;
        } else {
            materialMap.set(product.id, {
                id: `mat-${product.id}`,
                product: product,
                quantity: quantity,
                materialPrice: sellingPrice,
                servicePrice: servicePrice,
                total: quantity * totalPerItem
            });
        }
    };
    
    let totalInternalCableLength = 0;
    let totalExternalCableLength = 0;

    // Calcular materiais por câmera
    cameras.forEach(camera => {
        let cableLengthForCamera = 20; // Default 20m if no DVR/NVR element
        if (dvrElement) {
            const distance = Math.sqrt(Math.pow(camera.x - dvrElement.x, 2) + Math.pow(camera.y - dvrElement.y, 2));
            cableLengthForCamera = distance * 1.2 + 1;
        }
        
        if (camera.isInternal) {
            totalInternalCableLength += cableLengthForCamera;
        } else {
            totalExternalCableLength += cableLengthForCamera;
        }
    });

    const cameraCount = cameras.length;
    
    // --- Step 1: Determine System Architecture based on user input ---
    const isIpSystem = technologyType === 'ip';
    const recorderIsPoe = isIpSystem && ipSystemType === 'nvr-poe';
    const switchIsNeeded = isIpSystem && (ipSystemType === 'nvr-no-poe' || ipSystemType === 'dvr');
    // A system is considered PoE if the NVR is PoE OR if a PoE switch is needed (and will be added).
    const isPoeSystem = recorderIsPoe || switchIsNeeded;

    // --- Step 2: Add Components based on Architecture ---

    // Gravador e Switch
    let recorder;
    if (isIpSystem) {
        let recorderType = 'nvr';
        let poeKeyword: string | undefined = undefined;
        let excludePoe = false;

        if (ipSystemType === 'nvr-poe') {
            poeKeyword = 'poe';
        } else if (ipSystemType === 'dvr') {
            recorderType = 'dvr'; // Hybrid DVR
        } else { // nvr-no-poe
            excludePoe = true;
        }
        
        const keywords = [recorderType, poeKeyword].filter(Boolean) as (string | string[])[];
        const exclusion = excludePoe ? ['poe'] : undefined;

        if (cameraCount <= 4) recorder = findProduct(products, [...keywords, ['4 canais', '4ch', '1104', '1204', '1304', '1404']], 'CÂMERAS', exclusion);
        else if (cameraCount <= 8) recorder = findProduct(products, [...keywords, ['8 canais', '8ch', '1108', '1208', '1308', '1408']], 'CÂMERAS', exclusion);
        else if (cameraCount <= 16) recorder = findProduct(products, [...keywords, ['16 canais', '16ch', '1116', '1216', '1316', '1416']], 'CÂMERAS', exclusion);
        else recorder = findProduct(products, [...keywords, ['32 canais', '32ch']], 'CÂMERAS', exclusion);

    } else { // Analog system
        const recorderType = 'dvr';
        if (cameraCount <= 4) recorder = findProduct(products, [recorderType, ['4 canais', '4ch']], 'CÂMERAS');
        else if (cameraCount <= 8) recorder = findProduct(products, [recorderType, ['8 canais', '8ch']], 'CÂMERAS');
        else if (cameraCount <= 16) recorder = findProduct(products, [recorderType, ['16 canais', '16ch']], 'CÂMERAS');
        else recorder = findProduct(products, [recorderType, ['32 canais', '32ch']], 'CÂMERAS');
    }
    addItem(recorder, 1);
    
    if (switchIsNeeded) { 
        const switchKeywords = ['switch', 'poe'];
        let networkSwitch;

        const ports = cameraCount <= 4 ? [['9 portas', '9p'], ['8 portas', '8p']] : 
                      cameraCount <= 8 ? [['16 portas', '16p']] : 
                      cameraCount <= 16 ? [['24 portas', '24p']] : [];
        
        for (const port of ports) {
            networkSwitch = findProduct(products, [...switchKeywords, port], 'CÂMERAS') ||
                            findProduct(products, [...switchKeywords, port], 'REDES') ||
                            findProduct(products, [...switchKeywords, port]);
            if (networkSwitch) break;
        }

        addItem(networkSwitch, 1);
    }

    // Conectores
    if (isIpSystem) {
        let rj45Count = cameraCount * 2; // For cameras
        if (switchIsNeeded) {
            rj45Count += 4; // 2 for Switch -> Modem, 2 for Switch -> Recorder
        } else if (recorderIsPoe) {
            // NVR PoE connects directly to modem
            rj45Count += 2; // 2 for NVR -> Modem
        }
        addItem(findProduct(products, ['conector', 'rj45'], 'CÂMERAS'), rj45Count);
    } else { // Analog
        if (cableType === 'utp') {
            addItem(findProduct(products, ['balun', 'passivo'], 'CÂMERAS'), cameraCount);
        } else { // coaxial
            addItem(findProduct(products, ['conector', 'bnc'], 'CÂMERAS'), cameraCount * 2);
        }
    }
    
    // Caixa Organizadora
    addItem(findProduct(products, ['caixa', 'organizadora'], 'CÂMERAS'), cameraCount);

    // Alimentação - Only if NOT a PoE system
    if (!isPoeSystem) {
        addItem(findProduct(products, ['conector', 'p4'], 'CÂMERAS'), cameraCount);
        let powerSupply;
        if (cameraCount <= 4) powerSupply = findProduct(products, ['fonte', '5a'], 'CÂMERAS');
        else if (cameraCount <= 8) powerSupply = findProduct(products, ['fonte', '10a'], 'CÂMERAS');
        else powerSupply = findProduct(products, ['fonte', '15a'], 'CÂMERAS');
        addItem(powerSupply, 1);
    }

    // HD, Rack, Cabo
    let hd;
    if (cameraCount <= 8) hd = findProduct(products, ['hd', '1tb'], 'CÂMERAS');
    else hd = findProduct(products, ['hd', '2tb'], 'CÂMERAS');
    addItem(hd, 1);

    let rack;
    if (cameraCount <= 4) {
        rack = findProduct(products, ['rack', 'organizador', 'mini'], 'CÂMERAS') || findProduct(products, ['rack', '3u'], 'CÂMERAS');
    } else if (cameraCount <= 8) {
        rack = findProduct(products, ['rack', 'organizador', '8'], 'CÂMERAS') || findProduct(products, ['rack', '5u'], 'CÂMERAS') || findProduct(products, ['rack', '3u'], 'CÂMERAS');
    } else if (cameraCount <= 16) {
        rack = findProduct(products, ['rack', '8u'], 'CÂMERAS') || findProduct(products, ['rack', '5u'], 'CÂMERAS') || findProduct(products, ['rack', '19'], 'CÂMERAS');
    } else {
        rack = findProduct(products, ['rack', 'piso'], 'CÂMERAS') || findProduct(products, ['rack', '19'], 'CÂMERAS');
    }
    addItem(rack, 1);
    
    // Calcular Cabos
    if (cableType === 'utp') {
        if (totalInternalCableLength > 0) {
            const internalCable = findProduct(products, [['cabo', 'lan'], 'utp', 'cat5e'], 'CÂMERAS') || findProduct(products, [['cabo', 'lan'], 'utp', 'cat5e']);
            addItem(internalCable, Math.ceil(totalInternalCableLength));
        }
        if (totalExternalCableLength > 0) {
            const externalCable = 
                findProduct(products, ['cabo', 'capa dupla'], 'CÂMERAS') || 
                findProduct(products, ['cabo', 'capa dupla'], 'REDES') ||
                findProduct(products, ['cabo', 'externo']);
            addItem(externalCable, Math.ceil(totalExternalCableLength));
        }
    } else { // coaxial
        const coaxialCable = findProduct(products, ['cabo', 'coaxial'], 'CÂMERAS') || findProduct(products, ['cabo', 'coaxial']);
        addItem(coaxialCable, Math.ceil(totalInternalCableLength + totalExternalCableLength));
    }
    
    return Array.from(materialMap.values());
};


export class CFTVCalculations {
  // Calcula o cone de visão da câmera
  static calculateFOVPoints(
    camera: CftvCamera,
    scale: number,
    maxDistance?: number
  ): { x: number; y: number }[] {
    const distance = maxDistance || camera.dori * 1.5;
    const halfAngle = camera.horizontalAngle / 2;
    const rotationRad = (camera.rotation * Math.PI) / 180;
    
    const points = [];
    const steps = 20; // Número de pontos para criar o arco
    
    // Ponto central (câmera)
    points.push({ x: camera.x * scale, y: camera.y * scale });
    
    // Calcular pontos do arco
    for (let i = -halfAngle; i <= halfAngle; i += (halfAngle * 2) / steps) {
      const angleRad = rotationRad + (i * Math.PI) / 180;
      const x = camera.x * scale + Math.cos(angleRad) * distance * scale;
      const y = camera.y * scale + Math.sin(angleRad) * distance * scale;
      points.push({ x, y });
    }
    
    return points;
  }

  // Verifica se o cone atravessa paredes
  static checkWallIntersection(
    camera: CftvCamera,
    walls: Wall[],
    scale: number
  ): boolean {
    if (!camera.isInternal) return false;
    
    const fovPoints = this.calculateFOVPoints(camera, scale);
    
    for (const wall of walls) {
      for (let i = 1; i < fovPoints.length; i++) {
        if (this.lineIntersectsLine(
          camera.x * scale, camera.y * scale,
          fovPoints[i].x, fovPoints[i].y,
          wall.x1 * scale, wall.y1 * scale,
          wall.x2 * scale, wall.y2 * scale
        )) {
          return true;
        }
      }
    }
    
    return false;
  }

  private static lineIntersectsLine(
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4: number, y4: number
  ): boolean {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  // Calcula área coberta pela câmera
  static calculateCoverageArea(camera: CftvCamera): number {
    const radius = camera.dori;
    const angleRad = (camera.horizontalAngle * Math.PI) / 180;
    return 0.5 * radius * radius * angleRad;
  }

  // Calcula pixels por metro baseado na resolução
  static calculatePixelsPerMeter(resolution: CftvCamera['resolution']): number {
    const resolutionMap = {
      '2MP': 50,
      '4MP': 100,
      '8MP': 200,
      '12MP': 300
    };
    return resolutionMap[resolution];
  }
}
