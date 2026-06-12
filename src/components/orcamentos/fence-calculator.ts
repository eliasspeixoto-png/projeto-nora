
import { Product, QuoteItem } from "@/lib/data";
import type { InstallationType, RodType, VoltageType } from "@/app/orcamentos/cerca-eletrica/page";
const normalizeString = (s: string) => (s || "").toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

type CalculationParams = {
    segments: number[];
    cornerRods: number;
    highVoltageCableLength: number;
    parallelWireLength: number;
    groundingWireLength: number;
    sirenCableLength: number;
    hasSteps: boolean;
    numberOfSteps: number;
    installationType: InstallationType;
    rodType: RodType;
    voltage: VoltageType;
};

export type FenceSegmentCalculation = {
    length: number;
    passagePosts: number;
    wPosts: number;
    mainSpanLength: number;
    wSpanLength: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function calculateFenceItems(params: CalculationParams, products: Product[]): QuoteItem[] {
    const {
        segments, cornerRods, highVoltageCableLength, parallelWireLength, groundingWireLength, sirenCableLength, hasSteps, numberOfSteps, installationType, rodType, voltage
    } = params;
    
    if (products.length === 0 || segments.length === 0) {
        return [];
    }

    const perimeter = segments.reduce((sum, len) => sum + len, 0);
    if (perimeter <= 0) {
        return [];
    }
    
    const findProduct = (descriptionParts: (string | string[])[]): Product | undefined => {
        if (!descriptionParts || descriptionParts.length === 0) return undefined;
    
        const aProductMatches = (product: Product) => {
            const productDesc = normalizeString(product.description);
            return descriptionParts.every(part => {
                if (Array.isArray(part)) {
                    return part.some(alt => productDesc.includes(normalizeString(alt)));
                }
                // Se a parte contiver espaços, quebra em sub-palavras para busca mais flexível
                const keywords = part.toLowerCase().split(' ').filter(k => k.length > 1);
                return keywords.every(k => productDesc.includes(k));
            });
        };

        const candidates = products.filter(p => aProductMatches(p));
        // Prioriza produtos com nomes mais curtos (geralmente o produto base vs kits)
        return candidates.sort((a, b) => a.description.length - b.description.length)[0];
    };

    // 1. CALCULAR TODAS AS QUANTIDADES PRIMEIRO
    const visualCalcs = calculateFenceVisuals(segments);
    const totalPassagePosts = visualCalcs.reduce((sum, calc) => sum + calc.passagePosts, 0);
    const calculatedWPosts = visualCalcs.reduce((sum, calc) => sum + calc.wPosts, 0);
    const totalWPosts = calculatedWPosts + (hasSteps ? numberOfSteps : 0);
    const totalRods = cornerRods + totalPassagePosts + totalWPosts;
    
    // --- Lógica de Placas de Advertência ---
    // Uma placa em cada canto.
    let signsForCorners = cornerRods;
    // Para cada segmento reto, calcular placas adicionais.
    let signsForSegments = 0;
    segments.forEach(segmentLength => {
        // Se um segmento tem mais de 15m, adiciona placas intermediárias.
        if (segmentLength > 15) {
           signsForSegments += Math.floor((segmentLength - 0.1) / 15);
        }
    });

    const warningSignsQuantity = signsForCorners + signsForSegments;

    const wireQuantity = perimeter * 6;
    const fixationItems = installationType === 'parafusada'
        ? { parafusos: totalRods * 2, buchas: totalRods * 2, massa: 0 }
        : { parafusos: 0, buchas: 0, massa: round(totalRods * 0.3) };


    // 2. MAPEAR PRODUTOS NECESSÁRIOS
    const productMap = {
        bateria: findProduct(['BATERIA', '7Ah', '12V']),
        sirene: findProduct(['Sirene']),
        tomada: findProduct(['Tomada Externa', '10a']),
        plug: findProduct(['Plug macho', '2 Pinos', 'eletrica']),
        disjuntor: findProduct(voltage === '127v' 
            ? ['Disjuntor', '1p', 'Monopolar', '06 Amperes', 'Curva C'] 
            : ['Disjuntor', 'Bipolar', 'C 6a', '400v', '6ka', 'Curva C']),

        caixaDisjuntor: findProduct(['Caixa', 'Sobrepor', 'Disjuntor']),
        fioParalelo: findProduct(['fio paralelo']),
        caboManga: findProduct(['cabo manga']),
        fioAterramento: findProduct(['Fio', 'aterramento', ['verde', 'flexivel'], '2,5mm']),
        hasteAterramento: findProduct(['Haste', 'Aterramento']),
        conectorAterramento: findProduct(['Conector', 'haste']),
        hasteCastanha: findProduct([['Haste de canto', 'Haste Castanha', 'Haste Canto'], rodType]),
        hastePassagem: findProduct(['Haste de passagem', rodType]),
        hasteW: findProduct(['haste', 'tipo w', rodType]),
        fioAco: findProduct(['fio', 'aço inox']), 
        caboAlta: findProduct(['cabo', 'alta isolação']),
        massa: findProduct(['massa pronta']),
        parafuso: findProduct(['Parafuso', 'Sextavado', 'Soberba', '1/4']),
        bucha: findProduct(['bucha', '8mm']),
        placaAdvertencia: findProduct(['PLACA', 'ADVERTENCIA', 'CERCA']),
    };

    // 3. MONTAR A LISTA DE ITENS NA ORDEM CORRETA
    const recipe = [
        { key: 'bateria', quantity: 1 },
        { key: 'sirene', quantity: 1 },
        { key: 'tomada', quantity: 1 },
        { key: 'plug', quantity: 1 },
        { key: 'disjuntor', quantity: 1 },
        { key: 'caixaDisjuntor', quantity: 1 },
        { key: 'fioParalelo', quantity: parallelWireLength },
        { key: 'fioAterramento', quantity: groundingWireLength },
        { key: 'hasteAterramento', quantity: 1 },
        { key: 'conectorAterramento', quantity: 1 },
        { key: 'caboManga', quantity: sirenCableLength },
        { key: 'hasteCastanha', quantity: cornerRods },
        { key: 'hastePassagem', quantity: totalPassagePosts },
        { key: 'hasteW', quantity: totalWPosts },
        { key: 'fioAco', quantity: wireQuantity },
        { key: 'caboAlta', quantity: highVoltageCableLength },
        { key: 'massa', quantity: fixationItems.massa },
        { key: 'parafuso', quantity: fixationItems.parafusos },
        { key: 'bucha', quantity: fixationItems.buchas },
        { key: 'placaAdvertencia', quantity: warningSignsQuantity },
    ];
    
    const finalItems: QuoteItem[] = [];

    recipe.forEach(entry => {
        const product = productMap[entry.key as keyof typeof productMap];
        if (product && entry.quantity > 0) {
            const mPrice = (product as any).sellingPrice ?? (product as any).price ?? (product as any).unitPrice ?? 0;
            const sPrice = (product as any).servicePrice ?? 0;
            
            finalItems.push({
                id: `${product.id}-${finalItems.length}`,
                product: product,
                quantity: round(entry.quantity),
                materialPrice: mPrice,
                servicePrice: sPrice,
                total: round(entry.quantity * (mPrice + sPrice))
            });
        }
    });

    return finalItems;
}

export function calculateFenceVisuals(segments: number[]): FenceSegmentCalculation[] {
    const postCalcs: FenceSegmentCalculation[] = [];
    const MAX_SPAN_LENGTH = 2.9;
    
     for (const segmentLength of segments) {
        if (segmentLength <= 0) {
            postCalcs.push({ length: 0, passagePosts: 0, wPosts: 0, mainSpanLength: 0, wSpanLength: 0 });
            continue;
        };
        
        // A haste de passagem é adicionada a cada 30m. Se o muro tem 30m, precisa de 1.
        const passagePostsForSegment = segmentLength < 30 ? 0 : Math.floor((segmentLength - 5) / 25);
        
        const totalSpans = Math.ceil(segmentLength / MAX_SPAN_LENGTH);
        const intermediatePosts = totalSpans > 1 ? totalSpans - 1 : 0;
        const wPostsForSegment = Math.max(0, intermediatePosts - passagePostsForSegment);
        
        const wSpanLength = totalSpans > 0 ? segmentLength / totalSpans : 0;
        const mainSpanLength = (passagePostsForSegment + 1) > 0 ? segmentLength / (passagePostsForSegment + 1) : 0;
        
        postCalcs.push({
            length: segmentLength,
            passagePosts: passagePostsForSegment,
            wPosts: wPostsForSegment,
            mainSpanLength: mainSpanLength,
            wSpanLength: wSpanLength,
        });
    }
    return postCalcs;
}
