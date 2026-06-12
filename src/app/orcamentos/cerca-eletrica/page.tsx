
"use client";

import { useState, useMemo, useEffect, DragEvent, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Client, Product, Quote, QuoteItem, QuoteData, PostCounts } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, ListChecks, Search, Save, Trash2, Shield, ShieldQuestion, X, Check, ChevronsUpDown, Edit, Percent, Bot, PlusCircle } from "lucide-react";
import { getProducts, getClients, addQuote, getCompany, getQuote, updateQuote, updateProduct } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import CalculatedItemsTable from "@/components/orcamentos/calculated-items-table";
import AddEditProductDialog from "@/components/produtos/add-edit-product-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import FenceVisualizer from "@/components/orcamentos/fence-visualizer";
import { calculateFenceItems } from "@/components/orcamentos/fence-calculator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";


const round = (value: number) => Math.round(value * 100) / 100;

const normalizeString = (str: any, strict = false): string => {
    if (!str) return '';
    const base = String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    
    if (strict) {
        return base.replace(/[^a-z0-9]/g, '');
    }
    return base.trim();
};

export type FenceShape = 'linear' | 'l-shape' | 'u-shape' | 'quadrilateral' | 'free-draw';
export type InstallationType = 'chumbada' | 'parafusada';
export type RodType = '28x28' | '23x23' | '30x30';
export type VoltageType = '127v' | '220v';

export type Dimensions = {
    linear_length?: number;
    l_sideA?: number;
    l_sideB?: number;
    u_sideA?: number;
    u_sideB?: number;
    u_sideC?: number;
    points?: { x: number, y: number }[];
};

// MESTRIA: Sistema de pontuação para encontrar a melhor correspondência (evita falhas por excesso de palavras)
const findBestMatch = <T,>(
    items: T[], 
    searchInput: string, 
    getTargetString: (item: T) => string
): T | null => {
    if (!searchInput || items.length === 0) return null;
    
    const normalize = (s: string) => normalizeString(s).replace(/[^a-z0-9 ]/g, ' ').trim();
    const inputStr = normalize(searchInput);
    const inputTokens = inputStr.split(/\s+/).filter(t => t.length > 1);
    
    if (inputTokens.length === 0) return null;

    console.log(`[MAESTRIA] Buscando match para: "${searchInput}" entre ${items.length} itens.`);

    let bestItem: T | null = null;
    let highestScore = 0;

    items.forEach(item => {
        const target = normalize(getTargetString(item));
        const targetTokens = target.split(/\s+/);
        let score = 0;
        
        inputTokens.forEach(token => {
            // Peso maior para tokens que contêm números (prováveis modelos/códigos)
            const weight = /\d/.test(token) ? 2 : 1;
            
            if (targetTokens.includes(token)) {
                score += weight * 2; // Match exato do token
            } else if (target.includes(token)) {
                score += weight; // Match parcial
            }
        });

        if (score > highestScore) {
            highestScore = score;
            bestItem = item;
        }
    });

    if (bestItem) {
        const targetDesc = getTargetString(bestItem);
        // Threshold dinâmico: pelo menos 1/4 da pontuação máxima possível ou pelo menos 2 pontos
        const minPossibleScore = inputTokens.length > 1 ? 2 : 1;
        const isAcceptable = highestScore >= minPossibleScore;
        
        console.log(`[MAESTRIA] Resultado: ${isAcceptable ? 'SUCESSO' : 'REPROVADO (Score Baixo)'}`, {
            input: searchInput,
            match: targetDesc,
            score: highestScore,
            threshold: minPossibleScore
        });

        return isAcceptable ? bestItem : null;
    }

    console.log(`[MAESTRIA] Nenhum candidato encontrado para "${searchInput}"`);
    return null;
};


export default function FenceQuotePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { userProfile, firebase } = useAuth();
    const companyId = userProfile?.companyId;

    const quoteId = searchParams?.get('id');
    const isEditing = !!quoteId;

    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [manualItems, setManualItems] = useState<QuoteItem[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

    const [productSearch, setProductSearch] = useState('');
    const [isProductListVisible, setProductListVisible] = useState(false);
    const isNoraNewQuoteRef = useRef(false);

    const [shape, setShape] = useState<FenceShape>('linear');
    const [dimensions, setDimensions] = useState<Dimensions>({});
    const [segments, setSegments] = useState<number[]>([]);
    const [additionalPosts, setAdditionalPosts] = useState(0);
    const [hasSteps, setHasSteps] = useState(false);
    const [numberOfSteps, setNumberOfSteps] = useState(0);
    const [installationType, setInstallationType] = useState<InstallationType>('chumbada');
    const [rodType, setRodType] = useState<RodType>('28x28');
    const [voltage, setVoltage] = useState<VoltageType>('127v');
    const [highVoltageCableLength, setHighVoltageCableLength] = useState(0);
    const [parallelWireLength, setParallelWireLength] = useState(0);
    const [groundingWireLength, setGroundingWireLength] = useState(0);
    const [sirenCableLength, setSirenCableLength] = useState(0);
    const [postCounts, setPostCounts] = useState<PostCounts>({ corner: 0, passage: 0, w: 0, passageSpacing: 0, wSpacing: 0 });

    const [selectedCentralId, setSelectedCentralId] = useState<string>('');

    const [discountPercentage, setDiscountPercentage] = useState<number>(0);
    const [installments, setInstallments] = useState<number>(1);
    const [interestRate, setInterestRate] = useState<number>(0);
    const [isNoraRunning, setIsNoraRunning] = useState(false);
    const clientsRef = useRef<Client[]>([]);
    const productsRef = useRef<Product[]>([]);
    
    useEffect(() => { clientsRef.current = clients; }, [clients]);
    useEffect(() => { productsRef.current = products; }, [products]);


    // MESTRIA: Refs para permitir que o motor de autonomia "enxergue" o estado em tempo real (evita stale closure)
    const selectedClientIdRef = useRef<string | null>(null);
    const selectedCentralIdRef = useRef<string>('');
    const allItemsRef = useRef<QuoteItem[]>([]);
    const isIdentifyingRef = useRef(false);
    const noraTriggeredRef = useRef(false);




    // Suporte a gatilhos automáticos vindos do redirecionamento do Chat (Nora)
    useEffect(() => {
        if (isLoading || !clients.length || !products.length || noraTriggeredRef.current) return;
        
        const params = new URLSearchParams(window.location.search);
        const trigger = params.get('noraTrigger');
        const dataStr = params.get('noraData');
        
        if (trigger && dataStr) {
            noraTriggeredRef.current = true; // TRAVA DE GATILHO (LATCH)
            try {
                const data = JSON.parse(decodeURIComponent(dataStr));
                console.log('[NORA PAGE] Automating action from URL trigger:', trigger, data);
                
                // Limpar a URL para evitar repetição do comando
                window.history.replaceState({}, '', window.location.pathname);

                // Executar as ações via as referências estáveis
                if (trigger === 'fill_fence_form') {
                    noraFillRef.current?.({ detail: data } as any);
                } else if (trigger === 'save_fence_quote') {
                    // Para salvar automático, garantimos preenchimento primeiro
                    if (data && Object.keys(data).length > 0) {
                        console.log('[NORA PAGE] Pre-filling before save...');
                        noraFillRef.current?.({ detail: data } as any);
                    }
                    
                    // MESTRIA: Verificação de segurança que aguarda o cálculo dos itens (allItems) via Refs (Tempo Real)
                    const attemptSave = (retryCount = 0) => {
                        const isWorking = isIdentifyingRef.current;
                        const hasClient = !!selectedClientIdRef.current;
                        const hasCentral = !!selectedCentralIdRef.current;
                        const hasItems = allItemsRef.current.length > 0;
                        
                        console.log(`[NORA ATTEMPT ${retryCount}] Client=${hasClient}, Central=${hasCentral}, Items=${hasItems}, Identifying=${isWorking}`);

                        // Só tenta salvar se não estiver no meio de uma identificação e tiver os dados essenciais
                        if (!isWorking && hasClient && hasCentral && hasItems) {
                            console.log('[NORA PAGE] All systems GO. Saving with mastery.');
                            noraSaveRef.current?.();
                        } else if (retryCount < 60) { // Estendido para ~30 segundos
                            const missing = !hasClient ? 'Cliente' : !hasCentral ? 'Central de Choque' : 'Cálculo de Materiais';
                            const reason = isWorking ? 'Identificando dados...' : `Aguardando ${missing}...`;
                            
                            // Mostrar progresso no console e atualizar o status visual se necessário
                            if (retryCount % 5 === 0 && retryCount > 0) {
                                toast({ title: "Processando...", description: `Aguardando ${missing}. Quase pronto!` });
                            }
                            
                            setTimeout(() => attemptSave(retryCount + 1), 500);
                        } else {
                            const missing = !hasClient ? 'o Cliente' : !hasCentral ? 'a Central' : 'o cálculo dos materiais';
                            console.error('[NORA PAGE] Mastery Save aborted: Timeout waiting for:', missing);
                            setIsNoraRunning(false);
                            toast({ 
                                variant: "destructive", 
                                title: "Erro de Autonomia", 
                                description: `Tempo esgotado ao aguardar ${missing}. Por favor, verifique os campos e clique em Salvar.` 
                            });
                        }

                    };

                    // Aumentado delay inicial para 1.2s para garantir que os estados comecem a mudar
                    setTimeout(() => attemptSave(), 1200);
                }



            } catch (error) {
                console.error('[NORA PAGE] Error parsing automated Nora action:', error);
            }
        }
    }, [isLoading, clients, products]);

    const [centralPopoverOpen, setCentralPopoverOpen] = useState(false);
    const [centralSearch, setCentralSearch] = useState("");
    const [draggedItem, setDraggedItem] = useState<QuoteItem | null>(null);

    const [isProductDialogOpen, setProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

    const form = useForm();

    const handleCountsChange = useCallback((counts: PostCounts) => {
        setPostCounts(counts);
    }, []);

    useEffect(() => {
        if (!companyId || !firebase.db) {
            setIsLoading(false);
            return;
        }

        const { db } = firebase;

        async function loadData() {
            setIsLoading(true);
            try {
                const [productsData, clientsData] = await Promise.all([
                    new Promise<Product[]>(res => getProducts(db, companyId!, res, console.error, 'Ativo')),
                    new Promise<Client[]>(res => getClients(db, companyId!, res, console.error))
                ]);
                setProducts(productsData);
                setClients(clientsData);

                if (productsData.length === 0) {
                    console.warn('[DEBUG] No products loaded. This will cause zero-total quotes.');
                }

                if (isEditing && quoteId) {
                    const existingQuote = await getQuote(db, quoteId);
                    if (existingQuote && existingQuote.fenceDetails) {
                        const { fenceDetails } = existingQuote;
                        setShape(fenceDetails.shape as FenceShape);
                        setDimensions(fenceDetails.dimensions);
                        setSegments(fenceDetails.segments);
                        setAdditionalPosts(fenceDetails.additionalPosts || 0);
                        setSelectedClientId(existingQuote.clientId);

                        setInstallationType(fenceDetails.installationType || 'chumbada');
                        setRodType(fenceDetails.rodType || '28x28');
                        setVoltage(fenceDetails.voltage || '127v');
                        setHasSteps(fenceDetails.hasSteps || false);
                        setNumberOfSteps(fenceDetails.numberOfSteps || 0);
                        setHighVoltageCableLength(fenceDetails.highVoltageCableLength ?? 0);
                        setParallelWireLength(fenceDetails.parallelWireLength ?? 0);
                        setGroundingWireLength(fenceDetails.groundingWireLength ?? 0);
                        setSirenCableLength(fenceDetails.sirenCableLength ?? 0);

                        const centralItem = existingQuote.items.find(item => item.product.description.toLowerCase().includes('central de choque') || item.product.description.toLowerCase().includes('eletrificador'));
                        if (centralItem) setSelectedCentralId(centralItem.product.id);

                        const calculatedForLoading = calculateFenceItems({
                            segments: fenceDetails.segments,
                            cornerRods: fenceDetails.additionalPosts || 0,
                            highVoltageCableLength: fenceDetails.highVoltageCableLength ?? 0,
                            parallelWireLength: fenceDetails.parallelWireLength ?? 0,
                            groundingWireLength: fenceDetails.groundingWireLength ?? 0,
                            sirenCableLength: fenceDetails.sirenCableLength ?? 0,
                            hasSteps: fenceDetails.hasSteps || false,
                            numberOfSteps: fenceDetails.numberOfSteps || 0,
                            installationType: fenceDetails.installationType || 'chumbada',
                            rodType: fenceDetails.rodType || '28x28',
                            voltage: fenceDetails.voltage || '127v'
                        }, productsData);

                        const calculatedProductIds = new Set([...calculatedForLoading.map(i => i.product.id), centralItem?.product.id].filter(Boolean));
                        const manualItemsLoaded = existingQuote.items.filter(item => !calculatedProductIds.has(item.product.id));
                        setManualItems(manualItemsLoaded);

                        setDiscountPercentage(existingQuote.discount || 0);
                        setInstallments(existingQuote.installments || 1);
                        setInterestRate(existingQuote.interestRate || 0);

                    } else {
                        toast({ variant: "destructive", title: "Erro", description: "Orçamento de Cerca não encontrado." });
                        router.push('/orcamentos');
                    }
                }

            } catch (e) {
                toast({ variant: 'destructive', title: "Erro ao carregar dados." });
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [companyId, firebase.db, isEditing, quoteId, router, toast]);

    const calculatedItems = useMemo(() => calculateFenceItems({
        segments,
        cornerRods: postCounts.corner + additionalPosts,
        highVoltageCableLength,
        parallelWireLength,
        groundingWireLength,
        sirenCableLength,
        hasSteps,
        numberOfSteps,
        installationType,
        rodType,
        voltage,
    }, products), [segments, postCounts.corner, additionalPosts, highVoltageCableLength, parallelWireLength, groundingWireLength, sirenCableLength, hasSteps, numberOfSteps, installationType, rodType, voltage, products]);

    const allItems = useMemo(() => {
        const combined = new Map<string, QuoteItem>();

        calculatedItems.forEach(item => {
            combined.set(item.product.id, item);
        });

        if (selectedCentralId) {
            const centralProduct = products.find(p => p.id === selectedCentralId);
            if (centralProduct) {
                const newItem: QuoteItem = {
                    id: `item-${centralProduct.id}`,
                    product: centralProduct,
                    quantity: 1,
                    materialPrice: centralProduct.sellingPrice || 0,
                    servicePrice: centralProduct.servicePrice || 0,
                    total: (centralProduct.sellingPrice || 0) + (centralProduct.servicePrice || 0),
                };
                combined.set(centralProduct.id, newItem);
            }
        }

        manualItems.forEach(item => {
            combined.set(item.product.id, item);
        });

        return Array.from(combined.values());
    }, [manualItems, calculatedItems, selectedCentralId, products]);

    useEffect(() => { if (!isNoraRunning) selectedClientIdRef.current = selectedClientId; }, [selectedClientId, isNoraRunning]);
    useEffect(() => { if (!isNoraRunning) selectedCentralIdRef.current = selectedCentralId; }, [selectedCentralId, isNoraRunning]);
    useEffect(() => { allItemsRef.current = allItems; }, [allItems]);


    const filteredClients = useMemo(() => {
        const searchStr = (clientSearch || '').trim().toLowerCase();
        if (!searchStr) {
            return [...clients].sort((a, b) => a.name.localeCompare(b.name));
        }

        return clients.filter(c => 
            c.name.toLowerCase().includes(searchStr) || 
            (c.document && c.document.toLowerCase().includes(searchStr)) ||
            (c.clientCode && c.clientCode.toLowerCase().includes(searchStr))
        ).sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            const docA = (a.document || '').toLowerCase();
            const docB = (b.document || '').toLowerCase();
            const codeA = (a.clientCode || '').toLowerCase();
            const codeB = (b.clientCode || '').toLowerCase();

            const aExact = nameA === searchStr || docA === searchStr || codeA === searchStr;
            const bExact = nameB === searchStr || docB === searchStr || codeB === searchStr;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = nameA.startsWith(searchStr) || docA.startsWith(searchStr) || codeA.startsWith(searchStr);
            const bStarts = nameB.startsWith(searchStr) || docB.startsWith(searchStr) || codeB.startsWith(searchStr);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return a.name.localeCompare(b.name);
        });
    }, [clients, clientSearch]);

    const filteredProducts = useMemo(() => {
        const searchStr = (productSearch || '').trim().toLowerCase();
        if (!searchStr) {
            return [...products].sort((a, b) => a.description.localeCompare(b.description));
        }

        return products.filter(p => 
            p.description.toLowerCase().includes(searchStr) || 
            (p.item && p.item.toLowerCase().includes(searchStr))
        ).sort((a, b) => {
            const descA = a.description.toLowerCase();
            const descB = b.description.toLowerCase();
            const itemA = (a.item || '').toLowerCase();
            const itemB = (b.item || '').toLowerCase();

            const aExactItem = itemA === searchStr;
            const bExactItem = itemB === searchStr;
            if (aExactItem && !bExactItem) return -1;
            if (!aExactItem && bExactItem) return 1;

            const aStartsItem = itemA.startsWith(searchStr);
            const bStartsItem = itemB.startsWith(searchStr);
            if (aStartsItem && !bStartsItem) return -1;
            if (!aStartsItem && bStartsItem) return 1;

            const aExactDesc = descA === searchStr;
            const bExactDesc = descB === searchStr;
            if (aExactDesc && !bExactDesc) return -1;
            if (!aExactDesc && bExactDesc) return 1;

            const aStartsDesc = descA.startsWith(searchStr);
            const bStartsDesc = descB.startsWith(searchStr);
            if (aStartsDesc && !bStartsDesc) return -1;
            if (!aStartsDesc && bStartsDesc) return 1;

            return a.description.localeCompare(b.description);
        });
    }, [products, productSearch]);

    const centraisDeChoque = useMemo(() => {
        const searchStr = (centralSearch || '').trim().toLowerCase();
        const baseFiltered = products.filter(p => {
            const description = normalizeString(p.description);
            return description.includes('central de choque') || description.includes('eletrificador') || (p.segment === 'CERCAS');
        });

        if (!searchStr) {
            return baseFiltered.sort((a, b) => a.description.localeCompare(b.description));
        }

        return baseFiltered.filter(p => 
            p.description.toLowerCase().includes(searchStr) || 
            (p.item && p.item.toLowerCase().includes(searchStr)) ||
            (p.ean && p.ean.toLowerCase().includes(searchStr))
        ).sort((a, b) => {
            const descA = a.description.toLowerCase();
            const descB = b.description.toLowerCase();
            const itemA = (a.item || '').toLowerCase();
            const itemB = (b.item || '').toLowerCase();

            const aExactItem = itemA === searchStr;
            const bExactItem = itemB === searchStr;
            if (aExactItem && !bExactItem) return -1;
            if (!aExactItem && bExactItem) return 1;

            const aStartsItem = itemA.startsWith(searchStr);
            const bStartsItem = itemB.startsWith(searchStr);
            if (aStartsItem && !bStartsItem) return -1;
            if (!aStartsItem && bStartsItem) return 1;

            const aExactDesc = descA === searchStr;
            const bExactDesc = descB === searchStr;
            if (aExactDesc && !bExactDesc) return -1;
            if (!aExactDesc && bExactDesc) return 1;

            const aStartsDesc = descA.startsWith(searchStr);
            const bStartsDesc = descB.startsWith(searchStr);
            if (aStartsDesc && !bStartsDesc) return -1;
            if (!aStartsDesc && bStartsDesc) return 1;

            return a.description.localeCompare(b.description);
        });
    }, [products, centralSearch]);

    const handleDimensionChange = useCallback((key: keyof Dimensions, value: string) => {
        const parsedValue = parseFloat(value) || 0;
        const newDimensions = { ...dimensions, [key]: parsedValue };
        setDimensions(newDimensions);

        let newSegments: number[] = [];
        if (shape === 'linear') {
            newSegments = [newDimensions.linear_length || 0];
        } else if (shape === 'l-shape') {
            newSegments = [newDimensions.l_sideA || 0, newDimensions.l_sideB || 0];
        } else if (shape === 'u-shape') {
            newSegments = [newDimensions.u_sideA || 0, newDimensions.u_sideB || 0, newDimensions.u_sideC || 0];
        } else if (shape === 'quadrilateral') {
            newSegments = [newDimensions.l_sideA || 0, newDimensions.l_sideB || 0, newDimensions.l_sideA || 0, newDimensions.l_sideB || 0];
        } else if (shape === 'free-draw' && newDimensions.points) {
            for (let i = 0; i < newDimensions.points.length - 1; i++) {
                const p1 = newDimensions.points[i];
                const p2 = newDimensions.points[i + 1];
                const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) / 10;
                newSegments.push(length);
            }
        }

        setSegments(newSegments.filter(s => s > 0));
    }, [dimensions, shape]);

    const handleSaveQuote = useCallback(async () => {
        // MESTRIA: Usamos os Refs para garantir que a automação veja os IDs em tempo real
        const currentClientId = selectedClientIdRef.current;
        const currentItems = allItemsRef.current;
        const itemsCount = currentItems.length;
        const isNoraNew = isNoraNewQuoteRef.current;
        
        console.log('[DEBUG] handleSaveQuote details (Mastery):', { 
            companyId, 
            currentClientId, 
            itemsCount, 
            isEditing, 
            quoteId, 
            isNoraNew 
        });

        if (!companyId || !currentClientId || itemsCount === 0 || !firebase.db || !firebase.auth) {
            let errorMsg = "Dados incompletos.";
            if (!companyId) errorMsg = "Sessão expirada ou empresa não identificada (companyId ausente).";
            else if (!currentClientId) errorMsg = "O Cliente não foi selecionado corretamente no formulário. Verifique se o nome/código está correto.";
            else if (itemsCount === 0) errorMsg = "O orçamento está vazio. Verifique as dimensões ou se os produtos estão cadastrados.";
            else if (!firebase.db || !firebase.auth) errorMsg = "Erro de conexão com o banco de dados/autenticação.";
            
            console.error('[DEBUG] Save aborted (Mastery):', errorMsg, { 
                companyId, 
                currentClientId, 
                itemsCount
            });
            toast({ variant: "destructive", title: "Atenção: Não foi possível salvar", description: errorMsg });
            return;
        }
        setIsSaving(true);
        try {
            const subtotal = currentItems.reduce((sum, item) => sum + item.total, 0);
            const discountAmount = (subtotal * discountPercentage) / 100;
            const totalAfterDiscount = subtotal - discountAmount;

            const client = clients.find(c => c.id === currentClientId);
            const company = await getCompany(firebase.db, companyId);

            const quoteData: Partial<Quote> = {
                clientId: currentClientId,
                clientName: client?.name || 'Cliente',
                companyName: company?.name || 'Empresa',
                items: currentItems,
                total: totalAfterDiscount,
                discount: discountPercentage,
                installments: installments,
                interestRate: interestRate,
                status: isEditing && quoteId ? (await getQuote(firebase.db, quoteId))?.status || 'draft' : 'draft',
                companyId: companyId,
                serviceType: 'Cerca Elétrica',
                fenceDetails: {
                    shape,
                    dimensions,
                    segments,
                    additionalPosts,
                    preventiveVisitsPerYear: 4,
                    installationType,
                    rodType,
                    voltage,
                    hasSteps,
                    numberOfSteps,
                    highVoltageCableLength,
                    parallelWireLength,
                    groundingWireLength,
                    sirenCableLength,
                    postCounts,
                },
            };

            console.log('[DEBUG] Saving process starting...', { isEditing, quoteId, isNoraNew });

            if (isEditing && quoteId && !isNoraNew) {
                console.log('[DEBUG] Executing updateQuote for ID:', quoteId);
                await updateQuote(firebase.db, firebase.auth, quoteId, quoteData);
                toast({ title: "Sucesso!", description: `Orçamento atualizado.` });
                
                // Redirecionar para visualização após salvar (Se for Nora ou se o usuário desejar)
                router.push(`/orcamentos/details/${quoteId}`);

            } else {
                console.log('[DEBUG] Executing addQuote (New Quote)');
                const { id: newQuoteId, quoteNumber } = await addQuote(firebase.db, firebase.auth, quoteData as QuoteData);
                console.log('%c[SUCCESS] Quote saved!', 'color: green; font-weight: bold; font-size: 14px;', quoteNumber);
                isNoraNewQuoteRef.current = false;
                
                toast({ title: "Sucesso!", description: `Salvo com o número ${quoteNumber}.` });
                
                // Redirecionar para visualização do novo orçamento
                router.push(`/orcamentos/details/${newQuoteId}`);
            }

        } catch (error: any) {
            console.error('[DEBUG] Error saving quote:', error);
            toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
        } finally {
            setIsSaving(false);
            setIsNoraRunning(false); // Fecha o modo Maestria após salvar (ou erro)
        }

    }, [companyId, selectedClientId, allItems, firebase.db, firebase.auth, discountPercentage, clients, installments, interestRate, isEditing, quoteId, shape, dimensions, segments, additionalPosts, installationType, rodType, voltage, hasSteps, numberOfSteps, highVoltageCableLength, parallelWireLength, groundingWireLength, sirenCableLength, postCounts, router, toast]);

    // Ref para garantir que os event listeners sempre usem a versão mais atual do handleSaveQuote
    const saveQuoteRef = useRef(handleSaveQuote);
    useEffect(() => {
        saveQuoteRef.current = handleSaveQuote;
    }, [handleSaveQuote]);

    // Referências estáveis para que os event listeners globais nunca percam o contexto,
    // mesmo quando o componente re-renderiza ou muda dependências.
    const noraFillRef = useRef<any>(null);
    const noraSaveRef = useRef<any>(null);

    useEffect(() => {
        noraFillRef.current = async (event: CustomEvent) => {
            const data = event.detail;
            console.log('[NORA PAGE] handleNoraFill via Ref', data);
            
            // Ativar modo Maestria (Ocultar formulário)
            if (!data.isQuiet) {
                setIsNoraRunning(true);
                // Fail-safe de 25 segundos
                setTimeout(() => setIsNoraRunning(false), 25000);
            }

            // MESTRIA: Aguardar os dados carregarem se a lista estiver vazia (Resiliência)
            if (clientsRef.current.length === 0 || productsRef.current.length === 0) {
                console.log('[NORA FILL] Aguardando carregamento dos dados...');
                for (let i = 0; i < 10; i++) { // Até 5 segundos
                    await new Promise(r => setTimeout(r, 500));
                    if (clientsRef.current.length > 0 && productsRef.current.length > 0) break;
                }
            }

            if (data.isNewQuote) {
                console.log('[NORA PAGE] Master Reset for new quote');
                isNoraNewQuoteRef.current = true;
                if (isEditing) router.replace('/orcamentos/cerca-eletrica', { scroll: false });
                
                // Reset Total de Estados e Refs
                setManualItems([]);
                setSelectedClientId(null);
                selectedClientIdRef.current = null;
                setDimensions({});
                setSegments([]);
                setSelectedCentralId('');
                selectedCentralIdRef.current = '';
                allItemsRef.current = [];
            }

            // 1. IDENTIFICAÇÃO DO CLIENTE (PRIORIDADE MESTRIA 3.0 - BEST MATCH)
            if (data.clientId) {
                isIdentifyingRef.current = true;
                // Usamos a lista atual via Ref para evitar stale closure
                const client = findBestMatch(clientsRef.current, data.clientId, c => `${c.name} ${c.clientCode} ${c.id}`);
                
                if (client) {
                    selectedClientIdRef.current = client.id;
                    setSelectedClientId(client.id);
                    form.setValue('clientId', client.id);
                    toast({ title: "Cliente Identificado", description: client.name });
                } else {
                    console.log('[NORA FILL] Client not found:', data.clientId);
                    toast({ variant: "destructive", title: "Cliente não encontrado", description: data.clientId });
                }
                isIdentifyingRef.current = false;
            }

            // 2. IDENTIFICAÇÃO DA CENTRAL (PRIORIDADE MESTRIA 3.0 - BEST MATCH)
            if (data.centralDescricao) {
                const central = findBestMatch(productsRef.current, data.centralDescricao, p => `${p.description} ${p.segment} ${p.item}`);
                
                if (central) {
                    selectedCentralIdRef.current = central.id;
                    setSelectedCentralId(central.id);
                    toast({ title: "Central Selecionada", description: central.description });
                } else {
                    console.log('[NORA PAGE] Central not found:', data.centralDescricao);
                    setCentralSearch(data.centralDescricao);
                    toast({ 
                        variant: "destructive", 
                        title: "Modelo não identificado", 
                        description: `Não encontramos "${data.centralDescricao}" no banco. Clique no campo Central para selecionar.` 
                    });
                }
            }

            // 3. DEMAIS DADOS E GEOMETRIA
            if (data.shape) {
                const s = normalizeString(data.shape);
                if (s === 'l' || s.includes('l-shape') || s.includes('formato l')) setShape('l-shape');
                else if (s === 'u' || s.includes('u-shape') || s.includes('formato u')) setShape('u-shape');
                else if (s.includes('quadrado') || s.includes('quadri')) setShape('quadrilateral');
                else setShape('linear');
            }
            
            if (data.dimensions) {
                setDimensions(data.dimensions);
                const rawShape = data.shape || shape;
                const s = normalizeString(rawShape);
                let finalShape: FenceShape = 'linear';
                if (s === 'l' || s.includes('l-shape') || s.includes('formato l')) finalShape = 'l-shape';
                else if (s === 'u' || s.includes('u-shape') || s.includes('formato u')) finalShape = 'u-shape';
                else if (s.includes('quadrado') || s.includes('quadri')) finalShape = 'quadrilateral';

                let newSegments: number[] = [];
                if (finalShape === 'linear') newSegments = [data.dimensions.linear_length || 0];
                else if (finalShape === 'l-shape') newSegments = [data.dimensions.l_sideA || 0, data.dimensions.l_sideB || 0];
                else if (finalShape === 'u-shape') newSegments = [data.dimensions.u_sideA || 0, data.dimensions.u_sideB || 0, data.dimensions.u_sideC || 0];
                else if (finalShape === 'quadrilateral') newSegments = [data.dimensions.l_sideA || 0, data.dimensions.l_sideB || 0, data.dimensions.l_sideA || 0, data.dimensions.l_sideB || 0];
                setSegments(newSegments.filter(s => s > 0));
            }

            if (data.installationType) setInstallationType(data.installationType);
            if (data.rodType) setRodType(data.rodType);
            if (data.voltage) setVoltage(data.voltage);
            if (data.highVoltageCableLength !== undefined) {
                setHighVoltageCableLength(data.highVoltageCableLength);
                form.setValue('highVoltageCableLength', data.highVoltageCableLength);
            }
            if (data.parallelWireLength !== undefined) {
                setParallelWireLength(data.parallelWireLength);
                form.setValue('parallelWireLength', data.parallelWireLength);
            }
            if (data.groundingWireLength !== undefined) {
                setGroundingWireLength(data.groundingWireLength);
                form.setValue('groundingWireLength', data.groundingWireLength);
            }
            if (data.sirenCableLength !== undefined) {
                setSirenCableLength(data.sirenCableLength);
                form.setValue('sirenCableLength', data.sirenCableLength);
            }

            if (data.numberOfSteps !== undefined) {
                setNumberOfSteps(Number(data.numberOfSteps));
                if (Number(data.numberOfSteps) > 0) setHasSteps(true);
            }
            if (data.hasSteps !== undefined) {
                setHasSteps(!!data.hasSteps);
            }

            // 7. FINANCEIRO (Parcelamento)
            if (data.installments !== undefined) {
                setInstallments(Number(data.installments));
            }
            if (data.interestRate !== undefined) {
                setInterestRate(Number(data.interestRate));
            }
        };

        noraSaveRef.current = () => {
            console.log('[NORA PAGE] handleNoraSave via Ref');
            toast({ title: "Salvamento Iniciado", description: "O comando da Nora chegou ao formulário." });
            if (saveQuoteRef.current) {
                saveQuoteRef.current();
            } else {
                console.error('[NORA PAGE] CRITICAL: saveQuoteRef.current missing');
                toast({ variant: "destructive", title: "Erro Interno", description: "O formulário não está pronto para salvar. Tente preencher manualmente." });
            }
        };
    }, [clients, products, shape, form, router, isEditing, toast]);


    useEffect(() => {
        // Instalando os proxies estáveis uma única vez
        const fillProxy = (e: any) => noraFillRef.current?.(e);
        const saveProxy = () => noraSaveRef.current?.();

        window.addEventListener('nora-fill-fence-form', fillProxy);
        window.addEventListener('nora-save-fence-quote', saveProxy);
        
        return () => {
            window.removeEventListener('nora-fill-fence-form', fillProxy);
            window.removeEventListener('nora-save-fence-quote', saveProxy);
        };
    }, []);

    const handleAddProduct = (product: Product) => {
        const existingItem = manualItems.find(item => item.product.id === product.id);
        if (existingItem) {
            handleItemQuantityChange(existingItem.id, existingItem.quantity + 1);
        } else {
            const newItem: QuoteItem = {
                id: `item-${product.id}-${Date.now()}`,
                product: product,
                quantity: 1,
                materialPrice: product.sellingPrice || 0,
                servicePrice: product.servicePrice || 0,
                total: (product.sellingPrice || 0) + (product.servicePrice || 0),
            };
            setManualItems(prev => [...prev, newItem]);
        }
        setProductSearch('');
        setProductListVisible(false);
    };


    const handleDeleteItem = (itemId: string) => {
        setManualItems(prev => prev.filter(item => item.id !== itemId));
        if (allItems.find(item => item.id === itemId && item.product.id === selectedCentralId)) {
            setSelectedCentralId('');
        }
    };

    const handleEditItem = (product: Product) => {
        setEditingProduct(product);
        setProductDialogOpen(true);
    };

    const handleItemQuantityChange = (itemId: string, newQuantityStr: number | string) => {
        const newQuantity = typeof newQuantityStr === 'string' ? parseFloat(newQuantityStr) : newQuantityStr;
        if (isNaN(newQuantity) || newQuantity < 0) return;

        const itemToUpdate = allItems.find(item => item.id === itemId);
        if (!itemToUpdate) return;

        const updatedItem = {
            ...itemToUpdate,
            quantity: newQuantity,
            total: round(newQuantity * (itemToUpdate.materialPrice + (itemToUpdate.servicePrice || 0))),
        };

        const existingManualIndex = manualItems.findIndex(i => i.product.id === itemToUpdate.product.id);

        if (existingManualIndex > -1) {
            const newManualItems = [...manualItems];
            newManualItems[existingManualIndex] = updatedItem;
            setManualItems(newManualItems);
        } else {
            setManualItems(prev => [...prev, updatedItem]);
        }
    };

    const handleDragStart = (e: DragEvent<HTMLTableRowElement>, item: QuoteItem) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: DragEvent<HTMLTableRowElement>, targetItem: QuoteItem) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.id === targetItem.id) {
            return;
        }

        const newItems = [...allItems];
        const draggedIndex = newItems.findIndex(item => item.id === draggedItem.id);
        const targetIndex = newItems.findIndex(item => item.id === targetItem.id);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = newItems.splice(draggedIndex, 1);
        newItems.splice(targetIndex, 0, removed);

        setManualItems(newItems.filter(item => !calculatedItems.find(ci => ci.id === item.id)));
        setDraggedItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    useEffect(() => {
        if (isNoraRunning) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isNoraRunning]);

    const onProductSaved = async (productData: Omit<Product, 'id' | 'companyId'>, productId?: string) => {
        if (!companyId || !productId || !firebase.db) return;
        try {
            await updateProduct(firebase.db, productId, { ...productData, companyId });
            toast({ title: "Sucesso!", description: "Item atualizado com sucesso." });

            setProducts(prevProducts => prevProducts.map(p =>
                p.id === productId ? { ...p, ...productData, id: productId, companyId } as Product : p
            ));

            setProductDialogOpen(false);
            setEditingProduct(undefined);
        } catch (e) {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as alterações no item." });
        }
    };

    return (
        <main className="relative flex flex-1 flex-col gap-4 p-4 md:p-6 overflow-hidden">
            {/* OVERLAY DE MAESTRIA NORA - TOTALMENTE OPACO PARA OCULTAR O FORMULÁRIO */}
            {isNoraRunning && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background animate-in fade-in duration-500">
                    <div className="flex flex-col items-center gap-6 p-10 rounded-3xl border border-border/40 bg-card shadow-2xl max-w-sm w-full mx-4">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                            <div className="bg-primary/10 p-4 rounded-full relative z-10">
                                <Bot className="h-12 w-12 text-primary animate-bounce" />
                            </div>
                        </div>
                        <div className="space-y-4 text-center">
                            <h2 className="font-semibold tracking-tight text-primary text-xl">Maestria Nora 3.0</h2>
                            <p className="text-muted-foreground animate-pulse">
                                Orquestrando os parâmetros e gerando materiais...
                            </p>
                            
                            {/* BARRA DE PROGRESSO PREMIUM */}
                            <div className="w-64 h-1.5 bg-primary/10 rounded-full overflow-hidden relative">
                                <div className="absolute inset-0 bg-primary/40 animate-progress-indeterminate" />
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                        </div>
                    </div>
                </div>
            )}

            <Form {...form}>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <header className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 bg-background shadow-2xl shadow-primary/5 border border-border/40 rounded-[1.2rem] sticky top-4 z-20 mb-6">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-[1rem] bg-primary shadow-xl shadow-primary/30 text-white">
                    <Shield className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                    <h1 className="font-bold tracking-tighter flex items-center gap-2 text-2xl text-primary uppercase">
                        Calculadora de Cerca
                    </h1>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {isSaving && <Loader2 className="animate-spin text-primary h-5 w-5 mr-2" />}
                <Button type="button" variant="outline" className="h-9 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px] border-border/40 hover:bg-muted bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700" onClick={() => router.back()}>
                    Cancelar
                </Button>
                <Button type="button" className="h-9 px-8 rounded-xl font-bold uppercase tracking-widest bg-primary hover:scale-[1.02] active:scale-95 transition-all text-[10px] shadow-2xl shadow-primary/30" onClick={handleSaveQuote} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Registro
                </Button>
            </div>
        </header>

        <div className="max-w-[1400px] mx-auto w-full space-y-6 pb-24 px-4 md:px-8">

                <div className="grid grid-cols-1 gap-4">
                    <Card className="border-none bg-background/95 backdrop-blur-3xl rounded-[2.5rem] shadow-premium overflow-hidden">
                        <CardHeader className="pb-4 pt-8 px-8 border-b border-border/40 bg-muted/30">
                            <CardTitle className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                <User className="h-4 w-4 opacity-40" /> Identificação do Cliente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <FormField
                                control={form.control}
                                name="client"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn("w-full justify-between", !selectedClientId && "text-muted-foreground")}
                                                    >
                                                        {selectedClientId
                                                            ? clients.find((c) => c.id === selectedClientId)?.name
                                                            : "Selecione um cliente..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command shouldFilter={false}>
                                                    <CommandInput
                                                        placeholder="Buscar cliente..."
                                                        value={clientSearch}
                                                        onValueChange={setClientSearch}
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                                        <CommandGroup>
                                                            {filteredClients.map((c) => (
                                                                <CommandItem
                                                                    value={c.id}
                                                                    key={c.id}
                                                                    onSelect={() => {
                                                                        setSelectedClientId(c.id);
                                                                        setClientSearch("");
                                                                        setClientPopoverOpen(false);
                                                                    }}
                                                                    className="uppercase"
                                                                >
                                                                    <Check
                                                                        className={cn("mr-2 h-4 w-4", c.id === selectedClientId ? "opacity-100" : "opacity-0")}
                                                                    />
                                                                    {c.name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-none bg-background/95 backdrop-blur-3xl rounded-[2.5rem] shadow-premium overflow-hidden">
                        <CardHeader className="pb-4 pt-8 px-8 border-b border-border/40 bg-muted/30">
                            <CardTitle className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                <ShieldQuestion className="h-4 w-4 opacity-40" /> Parâmetros de Dimensionamento
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <FormField
                                control={form.control}
                                name="central"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Central de Choque</FormLabel>
                                        <Popover open={centralPopoverOpen} onOpenChange={setCentralPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn("w-full justify-between", !selectedCentralId && "text-muted-foreground")}
                                                    >
                                                        {selectedCentralId
                                                            ? products.find((p) => p.id === selectedCentralId)?.description
                                                            : "Selecione um modelo..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command shouldFilter={false}>
                                                    <CommandInput
                                                        placeholder="Buscar central ou eletrificador..."
                                                        value={centralSearch}
                                                        onValueChange={setCentralSearch}
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty>Nenhuma central encontrada.</CommandEmpty>
                                                        <CommandGroup>
                                                            {centraisDeChoque.map((product) => (
                                                                <CommandItem
                                                                    value={product.id}
                                                                    key={product.id}
                                                                    onSelect={() => {
                                                                        setSelectedCentralId(product.id);
                                                                        setCentralSearch("");
                                                                        setCentralPopoverOpen(false);
                                                                    }}
                                                                    className="uppercase"
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", product.id === selectedCentralId ? "opacity-100" : "opacity-0")} />
                                                                    {product.description}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="space-y-2">
                                <Label>Formato do Muro</Label>
                                <RadioGroup value={shape} onValueChange={(v) => setShape(v as FenceShape)} className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-1">
                                    {[
                                        { value: 'linear', label: 'Reta' },
                                        { value: 'l-shape', label: 'Formato L' },
                                        { value: 'u-shape', label: 'Formato U' },
                                        { value: 'quadrilateral', label: 'Quadrilátero' },
                                    ].map((opt) => (
                                        <div key={opt.value}>
                                            <RadioGroupItem value={opt.value} id={`shape-${opt.value}`} className="sr-only" />
                                            <Label
                                                htmlFor={`shape-${opt.value}`}
                                                className={cn(
                                                    "flex items-center justify-center border-2 rounded-lg p-3 cursor-pointer transition-all h-12 text-center text-xs font-semibold",
                                                    shape === opt.value
                                                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                                                        : "border-muted hover:bg-muted/50 text-muted-foreground"
                                                )}
                                            >
                                                {opt.label}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label>Dimensões (metros)</Label>
                                <div className="flex flex-col gap-2">
                                    {shape === 'linear' && (
                                        <Input type="number" placeholder="Comprimento (m)" value={dimensions.linear_length ?? ''} onChange={e => handleDimensionChange('linear_length', e.target.value)} />
                                    )}
                                    {shape === 'l-shape' && (
                                        <div className="flex gap-2">
                                            <Input type="number" placeholder="Lado A (m)" value={dimensions.l_sideA ?? ''} onChange={e => handleDimensionChange('l_sideA', e.target.value)} />
                                            <Input type="number" placeholder="Lado B (m)" value={dimensions.l_sideB ?? ''} onChange={e => handleDimensionChange('l_sideB', e.target.value)} />
                                        </div>
                                    )}
                                    {shape === 'u-shape' && (
                                        <div className="flex gap-2">
                                            <Input type="number" placeholder="Lado A (m)" value={dimensions.u_sideA ?? ''} onChange={e => handleDimensionChange('u_sideA', e.target.value)} />
                                            <Input type="number" placeholder="Lado B (m)" value={dimensions.u_sideB ?? ''} onChange={e => handleDimensionChange('u_sideB', e.target.value)} />
                                            <Input type="number" placeholder="Lado C (m)" value={dimensions.u_sideC ?? ''} onChange={e => handleDimensionChange('u_sideC', e.target.value)} />
                                        </div>
                                    )}
                                    {shape === 'quadrilateral' && (
                                        <div className="flex gap-2">
                                            <Input type="number" placeholder="Largura (m)" value={dimensions.l_sideA ?? ''} onChange={e => handleDimensionChange('l_sideA', e.target.value)} />
                                            <Input type="number" placeholder="Comprimento (m)" value={dimensions.l_sideB ?? ''} onChange={e => handleDimensionChange('l_sideB', e.target.value)} />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label>Instalação</Label>
                                    <Select value={installationType} onValueChange={(v) => setInstallationType(v as InstallationType)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="chumbada">Chumbada</SelectItem>
                                            <SelectItem value="parafusada">Parafusada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Haste</Label>
                                    <Select value={rodType} onValueChange={(v) => setRodType(v as RodType)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="23x23">23x23</SelectItem>
                                            <SelectItem value="25x25">25x25</SelectItem>
                                            <SelectItem value="28x28">28x28</SelectItem>
                                            <SelectItem value="30x30">30x30</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2 pt-4">
                                    <Switch id="steps-switch" checked={hasSteps} onCheckedChange={setHasSteps} />
                                    <Label htmlFor="steps-switch">Desníveis?</Label>
                                    {hasSteps && (<div><Input type="number" value={numberOfSteps} onChange={(e) => setNumberOfSteps(Number(e.target.value))} placeholder="Qtd." className="h-8 w-20 ml-2" /></div>)}
                                </div>
                                <div className="space-y-2">
                                    <Label>Voltagem da Rede</Label>
                                    <RadioGroup value={voltage} onValueChange={(v) => setVoltage(v as VoltageType)} className="flex gap-2">
                                        {[
                                            { value: '127v', label: '127V' },
                                            { value: '220v', label: '220V' },
                                        ].map((opt) => (
                                            <div key={opt.value} className="flex-1">
                                                <RadioGroupItem value={opt.value} id={`voltage-${opt.value}`} className="sr-only" />
                                                <Label
                                                    htmlFor={`voltage-${opt.value}`}
                                                    className={cn(
                                                        "flex items-center justify-center border border-border/40 rounded-2xl h-12 px-4 cursor-pointer transition-all text-[10px] font-bold uppercase tracking-widest",
                                                        voltage === opt.value
                                                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                                                            : "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                                                    )}
                                                >
                                                    {opt.label}
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="high-voltage-cable" className="text-sm">Cabo de Alta Tensão (m)</Label>
                                        <Input id="high-voltage-cable" type="number" placeholder="metros" value={highVoltageCableLength} onChange={e => setHighVoltageCableLength(Number(e.target.value) || 0)} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="parallel-wire" className="text-sm">Fio Paralelo (m)</Label>
                                        <Input id="parallel-wire" type="number" placeholder="metros" value={parallelWireLength} onChange={e => setParallelWireLength(Number(e.target.value) || 0)} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="grounding-wire" className="text-sm">Cabo de Aterramento (m)</Label>
                                        <Input id="grounding-wire" type="number" placeholder="metros" value={groundingWireLength} onChange={e => setGroundingWireLength(Number(e.target.value) || 0)} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="siren-cable" className="text-sm">Cabo da Sirene (m)</Label>
                                        <Input id="siren-cable" type="number" placeholder="metros" value={sirenCableLength} onChange={e => setSirenCableLength(Number(e.target.value) || 0)} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none bg-background/95 backdrop-blur-3xl rounded-[2.5rem] shadow-premium overflow-hidden">
                        <CardHeader className="pb-4 pt-8 px-8 border-b border-border/40 bg-muted/30">
                            <CardTitle className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                <PlusCircle className="h-4 w-4 opacity-40" /> Itens Complementares
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar produto ou serviço para adicionar manualmente..."
                                    className="pl-8"
                                    value={productSearch}
                                    onChange={(e) => { setProductSearch(e.target.value); setProductListVisible(true); }}
                                    onFocus={() => setProductListVisible(true)}
                                    onBlur={() => setTimeout(() => setProductListVisible(false), 150)}
                                />
                                {isProductListVisible && filteredProducts.length > 0 && (
                                    <Card className="absolute z-20 w-full mt-1"><ScrollArea className="h-48">
                                        {filteredProducts.map(product => (
                                            <div key={product.id} onMouseDown={() => handleAddProduct(product)} className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted uppercase">
                                                <span className="text-sm truncate uppercase">{product.description}</span>
                                                <span className="text-xs font-mono text-muted-foreground uppercase">{product.item}</span>
                                            </div>
                                        ))}
                                    </ScrollArea></Card>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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
                                onItemChange={handleItemQuantityChange}
                                onDeleteItem={handleDeleteItem}
                                onEditItem={handleEditItem}
                                onSaveQuote={handleSaveQuote}
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
                                <Edit className="h-4 w-4 opacity-40" /> Mapeamento Visual do Perímetro
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 h-[450px]">
                            <FenceVisualizer shape={shape} dimensions={dimensions} segments={segments} onCountsChange={handleCountsChange} additionalPosts={additionalPosts} />
                        </CardContent>
                    </Card>
                </div>

                <AddEditProductDialog
                    isOpen={isProductDialogOpen}
                    setOpen={setProductDialogOpen}
                    onProductSaved={onProductSaved}
                    product={editingProduct}
                    suppliers={[]}
                    locations={[]}
                />
                </div>
                </form>
            </Form>
        </main>
    );
}
