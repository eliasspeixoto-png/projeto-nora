"use client";

import { Suspense, useState, useMemo, useEffect, DragEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Client, Product, Quote, QuoteItem, QuoteData, Supplier, StockLocation } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, ListChecks, Search, Save, Trash2, Calculator, Percent, GitCommitHorizontal, Wand2, FileText, GripVertical, Info, Check, ChevronsUpDown, Landmark, Eye, Building, Package, Sparkles, Activity, Zap, DollarSign, Edit, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    getProductsOnce,
    getClientsOnce,
    getQuotesOnce,
    getQuote,
    addQuote,
    updateQuote,
    getCompany,
    getSuppliers,
    getStockLocations,
    addClient
} from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import AddEditProductDialog from "@/components/produtos/add-edit-product-dialog";
import AddEditClientDialog from "@/components/clientes/add-edit-client-dialog";

const round = (value: number) => Math.round(value * 100) / 100;

const normalizeString = (str: string | null | undefined) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(amount);
};


function ComodatoProposalForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { userProfile, firebase } = useAuth();
    const companyId = userProfile?.companyId;

    const quoteId = searchParams?.get('id') as string;
    const isEditing = !!quoteId;

    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [items, setItems] = useState<QuoteItem[]>([]);

    const [clientSearch, setClientSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [quoteSearch, setQuoteSearch] = useState('');

    const [quotePopoverOpen, setQuotePopoverOpen] = useState(false);
    const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
    const [productPopoverOpen, setProductPopoverOpen] = useState(false);

    const [draggedItem, setDraggedItem] = useState<QuoteItem | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Partial<Product> | undefined>(undefined);
    const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);

    // --- Parâmetros do Comodato ---
    const [contractDuration, setContractDuration] = useState(12); // meses
    const [profitMargin, setProfitMargin] = useState(55); // %
    const [preventiveVisitCost, setPreventiveVisitCost] = useState(0); // R$
    const [preventiveVisitsPerYear, setPreventiveVisitsPerYear] = useState(0);
    const [comodatoType, setComodatoType] = useState<"Real" | "Client">("Real");
    const [baseMonitoringValue, setBaseMonitoringValue] = useState(0); // R$
    const [installationLaborCost, setInstallationLaborCost] = useState(0);
    const [usefulLife, setUsefulLife] = useState(60); // meses (5 anos padrão)
    const [technicalReserve, setTechnicalReserve] = useState(5); // % (Opcional - Reserva de quebras)
    const [capitalInterestRate, setCapitalInterestRate] = useState(1); // % am (Opcional - Custo capital)

    // --- Novos Estados de Cenário ---
    type Scenario = 'alarm' | 'cftv' | 'mixed';
    const [scenario, setScenario] = useState<Scenario>('alarm');

    // Sync installationLaborCost when items change (as a default)
    useEffect(() => {
        // Só atualiza automaticamente se for "Comodato Real". 
        // No monitoramento material do cliente, o custo de instalação é preenchido manualmente.
        if (!isEditing && comodatoType === 'Real') {
            const cost = items.reduce((sum, item) => sum + (item.servicePrice || 0) * item.quantity, 0);
            setInstallationLaborCost(cost);
        }
    }, [items, isEditing, comodatoType]);

    useEffect(() => {
        if (!companyId || !userProfile || !firebase.db) {
            setIsLoading(false);
            return;
        }

        async function loadInitialData() {
            setIsLoading(true);
            try {
                const [productsData, clientsData, quotesData, suppliersData, locationsData] = await Promise.all([
                    getProductsOnce(firebase.db, companyId!, 'Ativo'),
                    getClientsOnce(firebase.db, companyId!),
                    getQuotesOnce(firebase.db, companyId!, userProfile!),
                    new Promise<Supplier[]>(res => getSuppliers(firebase.db, companyId!, res, console.error)),
                    new Promise<StockLocation[]>(res => getStockLocations(firebase.db, companyId!, res, console.error)),
                ]);

                setProducts(productsData);
                setClients(clientsData);
                setQuotes(quotesData);
                setSuppliers(suppliersData);
                setLocations(locationsData);

                if (isEditing) {
                    const existingQuote = await getQuote(firebase.db, quoteId);
                    if (existingQuote) {
                        setSelectedClientId(existingQuote.clientId);
                        setItems(existingQuote.items);
                        setQuoteSearch(existingQuote.quoteNumber); // Carrega o número da proposta no campo de importação
                        if (existingQuote.installments) setContractDuration(existingQuote.installments);
                        if (existingQuote.interestRate) setProfitMargin(existingQuote.interestRate);
                        if (existingQuote.fenceDetails?.preventiveVisitsPerYear) {
                            setPreventiveVisitsPerYear(existingQuote.fenceDetails.preventiveVisitsPerYear);
                        }
                        if (existingQuote.fenceDetails?.usefulLife) {
                            setUsefulLife(existingQuote.fenceDetails.usefulLife);
                        }
                        if (existingQuote.fenceDetails?.technicalReserve !== undefined) {
                            setTechnicalReserve(existingQuote.fenceDetails.technicalReserve);
                        }
                        if (existingQuote.fenceDetails?.capitalInterestRate !== undefined) {
                            setCapitalInterestRate(existingQuote.fenceDetails.capitalInterestRate);
                        }
                        if (existingQuote.fenceDetails?.scenario) {
                            setScenario(existingQuote.fenceDetails.scenario as Scenario);
                        }
                        if (existingQuote.fenceDetails?.baseMonitoringValue) {
                            setBaseMonitoringValue(existingQuote.fenceDetails.baseMonitoringValue);
                        }
                        if (existingQuote.fenceDetails?.installationLaborCost !== undefined) {
                            setInstallationLaborCost(existingQuote.fenceDetails.installationLaborCost);
                        }
                        if (existingQuote.comodatoType) {
                            setComodatoType(existingQuote.comodatoType as any);
                        }

                        const client = clientsData.find(c => c.id === existingQuote.clientId);
                        if (client) {
                            setClientSearch(client.name);
                        }
                    } else {
                        toast({ variant: "destructive", title: "Erro", description: "Proposta não encontrada." });
                        router.push('/comodato');
                    }
                }

            } catch (error) {
                toast({ variant: "destructive", title: "Erro ao Carregar Dados" });
            } finally {
                setIsLoading(false);
            }
        }
        loadInitialData();
    }, [companyId, toast, userProfile, isEditing, quoteId, router, firebase.db]);

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

    const filteredQuotes = useMemo(() => {
        const searchStr = (quoteSearch || '').trim().toLowerCase();
        if (!searchStr) {
            return [...quotes].sort((a, b) => a.quoteNumber.localeCompare(b.quoteNumber));
        }

        return quotes.filter(q => 
            q.quoteNumber.toLowerCase().includes(searchStr) || 
            (q.clientName && q.clientName.toLowerCase().includes(searchStr))
        ).sort((a, b) => {
            const numA = a.quoteNumber.toLowerCase();
            const numB = b.quoteNumber.toLowerCase();
            const nameA = (a.clientName || '').toLowerCase();
            const nameB = (b.clientName || '').toLowerCase();

            const aExact = numA === searchStr || nameA === searchStr;
            const bExact = numB === searchStr || nameB === searchStr;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = numA.startsWith(searchStr) || nameA.startsWith(searchStr);
            const bStarts = numB.startsWith(searchStr) || nameB.startsWith(searchStr);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return a.quoteNumber.localeCompare(b.quoteNumber);
        });
    }, [quotes, quoteSearch]);

    const handleQuoteSelect = (quote: Quote) => {
        if (!selectedClientId) {
            setSelectedClientId(quote.clientId);
            setClientSearch(quote.clientName);
        } else if (selectedClientId !== quote.clientId) {
            toast({
                variant: "destructive",
                title: "Cliente Diferente",
                description: `Este orçamento pertence a '${quote.clientName}', mas você já selecionou outro cliente.`
            });
            return;
        }

        setItems(prev => {
            const merged = [...prev];
            quote.items.forEach(quoteItem => {
                const existingIndex = merged.findIndex(i => i.product.id === quoteItem.product.id);
                if (existingIndex > -1) {
                    // Se o produto já existe na lista, soma a quantidade
                    merged[existingIndex] = {
                        ...merged[existingIndex],
                        quantity: merged[existingIndex].quantity + quoteItem.quantity,
                        total: round((merged[existingIndex].quantity + quoteItem.quantity) * (merged[existingIndex].materialPrice + (merged[existingIndex].servicePrice || 0))),
                    };
                } else {
                    // Se é um produto novo, adiciona à lista
                    merged.push({
                        ...quoteItem,
                        id: `${quote.id}-${quoteItem.id}`, // Garante ID único para a sessão
                        materialPrice: quoteItem.product.sellingPrice || 0,
                        total: quoteItem.quantity * (quoteItem.product.sellingPrice || 0),
                        isClientEquipment: false
                    });
                }
            });
            return merged;
        });

        if (quote.installments && contractDuration === 36) setContractDuration(quote.installments);
        if (quote.interestRate && profitMargin === 55) setProfitMargin(quote.interestRate);

        // Configurações de preventivas (apenas se ainda forem as padrão)
        if (quote.fenceDetails?.preventiveVisitsPerYear && preventiveVisitsPerYear === 4) setPreventiveVisitsPerYear(quote.fenceDetails.preventiveVisitsPerYear);
        if (quote.fenceDetails?.preventiveVisitCost && preventiveVisitCost === 220) setPreventiveVisitCost(quote.fenceDetails.preventiveVisitCost);

        // Monitoramento e Taxas (Soma se já houver valor?)
        // Para simplificar, vamos usar o maior valor ou o do último orçamento importado
        if (quote.fenceDetails?.baseMonitoringValue) setBaseMonitoringValue(prev => Math.max(prev, quote.fenceDetails?.baseMonitoringValue || 0));

        // Custo de mão de obra (Taxa de Implantação) - Soma as taxas
        if (quote.fenceDetails?.installationLaborCost !== undefined) {
            setInstallationLaborCost(prev => prev + (quote.fenceDetails?.installationLaborCost || 0));
        } else {
            const cost = quote.items.reduce((sum, item) => sum + (item.servicePrice || 0) * item.quantity, 0);
            setInstallationLaborCost(prev => prev + cost);
        }

        if (quote.comodatoType && quote.comodatoType !== 'Real') setComodatoType(quote.comodatoType as "Real" | "Client");

        setQuoteSearch('');
        setQuotePopoverOpen(false);
        toast({ title: "Itens adicionados!", description: `Itens do orçamento ${quote.quoteNumber} incluídos na proposta.` });
    };
    const handleAddProduct = (product: Product) => {
        if (items.some(item => item.product.id === product.id)) return;
        const newItem: QuoteItem & { isClientEquipment?: boolean } = {
            id: `item-${product.id}`,
            product: product,
            quantity: 1,
            materialPrice: product.sellingPrice || 0,
            servicePrice: product.servicePrice || 0,
            total: (product.sellingPrice || 0) + (product.servicePrice || 0),
            isClientEquipment: false
        };
        setItems(prev => [...prev, newItem]);
        setProductSearch('');
        setProductPopoverOpen(false);
    };

    const handleToggleClientEquipment = (itemId: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const isClient = !item.isClientEquipment;
                return {
                    ...item,
                    isClientEquipment: isClient,
                    // Se for do cliente, o custo do material para depreciação é zero
                    materialPrice: isClient ? 0 : (item.product.sellingPrice || 0)
                };
            }
            return item;
        }));
    };

    const handleDeleteItem = (itemId: string) => {
        setItems(prev => prev.filter(item => item.id !== itemId));
    };

    const handleAddProductClick = () => {
        setProductToEdit(undefined);
        setIsProductDialogOpen(true);
    };

    const handleEditProductClick = (item: QuoteItem) => {
        setProductToEdit(item.product);
        setIsProductDialogOpen(true);
    };

    const handleProductSaved = async (productData: Omit<Product, 'id' | 'companyId'>, productId?: string) => {
        setIsProductDialogOpen(false);
        const newProduct = { ...productData, id: productId || `temp-${Date.now()}` } as Product;
        
        // Se estivermos editando um produto existente
        if (productId) {
            setItems(prev => prev.map(item => {
                if (item.product.id === productId) {
                    return {
                        ...item,
                        product: newProduct,
                        materialPrice: newProduct.sellingPrice || 0,
                        servicePrice: newProduct.servicePrice || 0,
                        total: item.quantity * (newProduct.sellingPrice || 0)
                    };
                }
                return item;
            }));
            toast({ title: "Produto atualizado", description: "O produto foi atualizado com sucesso." });
        } else {
            // Se for um novo produto
            const newItem: QuoteItem = {
                id: `item-${Date.now()}`,
                product: newProduct,
                quantity: 1,
                materialPrice: newProduct.sellingPrice || 0,
                servicePrice: newProduct.servicePrice || 0,
                total: newProduct.sellingPrice || 0,
                isClientEquipment: false
            };
            setItems(prev => [...prev, newItem]);
            toast({ title: "Produto adicionado", description: "O produto foi salvo e adicionado à proposta." });
        }
    };

    const handleClientSaved = async (clientData: any) => {
        if (!companyId || !firebase.auth || !firebase.db) return;
        try {
            const newClientData = { ...clientData, companyId };
            const newClientId = await addClient(firebase.db, firebase.auth, newClientData);
            
            const clientsData = await getClientsOnce(firebase.db, companyId);
            setClients(clientsData);
            
            if (newClientId) {
                const addedClient = clientsData.find(c => c.id === newClientId);
                setSelectedClientId(newClientId);
                if (addedClient) {
                    setClientSearch(addedClient.name);
                } else {
                    setClientSearch(newClientData.name);
                }
            }
            
            setIsClientDialogOpen(false);
            setClientPopoverOpen(false);
            toast({ title: "Cliente adicionado", description: "O novo cliente foi selecionado para a proposta." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao criar cliente", description: error.message });
        }
    };

    const handleItemQuantityChange = (itemId: string, newQuantityStr: number | string) => {
        const newQuantity = typeof newQuantityStr === 'string' ? parseFloat(newQuantityStr) : newQuantityStr;
        if (isNaN(newQuantity) || newQuantity < 0) return;

        setItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    quantity: newQuantity,
                    total: round(newQuantity * (item.materialPrice + (item.servicePrice || 0))),
                };
            }
            return item;
        }));
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

        const newItems = [...items];
        const draggedIndex = newItems.findIndex(item => item.id === draggedItem.id);
        const targetIndex = newItems.findIndex(item => item.id === targetItem.id);

        const [removed] = newItems.splice(draggedIndex, 1);
        newItems.splice(targetIndex, 0, removed);

        setItems(newItems);
        setDraggedItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const calculationResults = useMemo(() => {
        // Apenas equipamentos da empresa (não marcados como do cliente) entram no custo total para depreciação
        // EXCEÇÃO: Equipamentos de ALARME não entram na depreciação mensal (conforme regra de monitoramento)
        const totalEquipmentCostForDepreciation = items.reduce((sum, item) => {
            if (item.isClientEquipment) return sum;
            if (item.product.segment === 'ALARMES') return sum;
            return sum + item.quantity * item.materialPrice;
        }, 0);

        const totalEquipmentCostRaw = items.reduce((sum, item) => {
            if (item.isClientEquipment) return sum;
            return sum + item.quantity * item.materialPrice;
        }, 0);

        // Cálculo do custo operacional mensal
        const monthlyDepreciation = usefulLife > 0 ? totalEquipmentCostForDepreciation / usefulLife : 0;

        // Manutenção preventiva não se aplica a Alarme (geralmente inclusa no monitoramento ou cobrada avulsa)
        const effectivePreventiveVisitCost = scenario === 'alarm' ? 0 : preventiveVisitCost;
        const totalMaintenanceCostPerYear = effectivePreventiveVisitCost * preventiveVisitsPerYear;
        const monthlyMaintenance = totalMaintenanceCostPerYear / 12;

        // Reserva técnica e custo de capital (também ignorados para Alarme Puro)
        const monthlyTechnicalReserve = scenario === 'alarm' ? 0 : (totalEquipmentCostForDepreciation * (technicalReserve / 100)) / usefulLife;
        const monthlyCapitalCost = scenario === 'alarm' ? 0 : totalEquipmentCostForDepreciation * (capitalInterestRate / 100);

        // Custo base (Depreciação + Manutenção + Reserva + Capital)
        const isClientOnlyAlarm = scenario === 'alarm' && comodatoType === 'Client';
        const baseCost = isClientOnlyAlarm ? 0 : (monthlyDepreciation + monthlyMaintenance + monthlyTechnicalReserve + monthlyCapitalCost);

        // Valor de monitoramento
        const effectiveMonitoringValue = scenario === 'cftv' ? 0 : baseMonitoringValue;

        // Sugestão: Para alarmes, o valor é fixo do monitoramento. Para outros, aplica margem sobre custos.
        const suggestedMonthlyFee = scenario === 'alarm'
            ? effectiveMonitoringValue
            : (baseCost * (1 + (profitMargin / 100))) + effectiveMonitoringValue;

        return {
            monthlyDepreciation,
            monthlyMaintenance,
            monthlyTechnicalReserve,
            monthlyCapitalCost,
            monthlyTotalCost: baseCost,
            suggestedMonthlyFee,
            totalEquipmentCost: totalEquipmentCostRaw
        };
    }, [items, usefulLife, profitMargin, preventiveVisitCost, preventiveVisitsPerYear, comodatoType, baseMonitoringValue, scenario, technicalReserve, capitalInterestRate]);


    const handleGenerateProposal = async () => {
        // Na modalidade "Real" (Equipamento da Empresa), é obrigatório ter itens.
        // Na modalidade "Client" (Material do Cliente), pode-se gerar sem itens.
        const hasItems = items.length > 0;
        const canSave = comodatoType === 'Client' ? !!selectedClientId : (!!selectedClientId && hasItems);

        if (!companyId || !selectedClientId || !canSave || !firebase.db || !firebase.auth) {
            toast({
                variant: "destructive",
                title: "Dados Incompletos",
                description: comodatoType === 'Real'
                    ? "Selecione um cliente e adicione itens para gerar a proposta."
                    : "Selecione um cliente para gerar a proposta."
            });
            return;
        }

        setIsSaving(true);
        try {
            // Se for criação de nova proposta, verificar se já existe uma de comodato para este cliente
            if (!isEditing) {
                const existingComodato = quotes.find(q => q.clientId === selectedClientId && q.isComodato);
                if (existingComodato) {
                    toast({
                        variant: "destructive",
                        title: "Proposta já Existente",
                        description: `Este cliente já possui a proposta de comodato nº ${existingComodato.quoteNumber}. Por favor, edite a proposta existente para evitar duplicidade.`
                    });
                    setIsSaving(false);
                    return;
                }
            }

            const client = clients.find(c => c.id === selectedClientId);
            const company = await getCompany(firebase.db, companyId);

            // Se for edição, pega os dados atuais para não perder campos
            const existingQuote = isEditing ? await getQuote(firebase.db, quoteId) : null;

            // Os itens da proposta são apenas os equipamentos, o serviço de instalação é separado
            const comodatoItems: QuoteItem[] = items.map(item => ({
                ...item,
                total: item.quantity * item.materialPrice // O valor do item é só o material
            }));

            const quoteData = {
                clientId: selectedClientId,
                clientName: client?.name || 'Cliente',
                companyName: company?.name || 'Empresa',
                items: comodatoItems,
                total: calculationResults.suggestedMonthlyFee, // Total do orçamento é o valor mensal
                discount: 0,
                installments: contractDuration, // Duração do contrato
                interestRate: profitMargin, // Usando para armazenar a margem de lucro
                status: existingQuote?.status || 'draft',
                companyId: companyId,
                serviceType: 'Comodato' as const,
                notes: `Proposta de Comodato. Custo de Instalação: ${formatCurrency(installationLaborCost)}. Duração: ${contractDuration} meses.`,
                isComodato: true,
                comodatoType: comodatoType,
                comodatoMonthlyFee: calculationResults.suggestedMonthlyFee,
                installationFee: installationLaborCost, // Campo adicional para facilidade
                fenceDetails: {
                    ...existingQuote?.fenceDetails as any,
                    preventiveVisitsPerYear: preventiveVisitsPerYear,
                    preventiveVisitCost: preventiveVisitCost,
                    baseMonitoringValue: baseMonitoringValue,
                    installationLaborCost: installationLaborCost,
                    scenario: scenario,
                    usefulLife: usefulLife,
                    technicalReserve: technicalReserve,
                    capitalInterestRate: capitalInterestRate,
                }
            };

            if (isEditing) {
                await updateQuote(firebase.db, firebase.auth, quoteId, quoteData as any);
                toast({ title: "Sucesso!", description: "Proposta de comodato atualizada. Redirecionando..." });
                router.push('/comodato');
            } else {
                const { id: newQuoteId } = await addQuote(firebase.db, firebase.auth, quoteData as any);
                toast({ title: "Sucesso!", description: "Proposta de comodato gerada. Redirecionando..." });
                router.push('/comodato');
            }

        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao Gerar Proposta", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };


    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
                        <Building className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-2xl font-semibold tracking-tighter text-primary">Sincronizando Calculadora</p>
                        <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.3em] animate-pulse">Motor de Inteligência</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen flex flex-col p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Decorative Background Elements */}
            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-emerald-500/10 blur-[100px] rounded-full" />
            </div>

            <div className="max-w-[1600px] mx-auto w-full space-y-8">
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-premium relative overflow-hidden group">
                           <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                           <Calculator className="text-primary h-8 w-8 relative z-10" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="font-semibold tracking-tighter text-foreground text-xl">
                                {isEditing ? "Editar Proposta" : "Calculadora de Comodato"}
                            </h1>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/40 mt-1 flex items-center gap-2">
                                <Sparkles className="h-3 w-3 animate-pulse" /> Motor de Inteligência
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button 
                            variant="ghost" 
                            onClick={() => router.push('/comodato')}
                            className="h-12 px-6 rounded-2xl font-semibold text-xs uppercase tracking-widest hover:bg-black/5 transition-all"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleGenerateProposal} 
                            disabled={isSaving}
                            className="h-12 px-8 rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-2 bg-primary flex-1 sm:flex-none"
                        >
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                            {isEditing ? "Salvar Alterações" : "Gerar Proposta"}
                        </Button>
                    </div>
                </header>

                {/* Scenario Selection Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card 
                        className={cn(
                            "cursor-pointer group relative overflow-hidden transition-all duration-500 border-none rounded-[2.5rem] shadow-premium",
                            scenario === 'alarm' ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/30" : "bg-background/40 backdrop-blur-3xl hover:bg-primary/5"
                        )}
                        onClick={() => {
                            setScenario('alarm');
                            setBaseMonitoringValue(228.32);
                            setComodatoType('Real');
                        }}
                    >
                        <div className={cn("absolute inset-0 bg-gradient-to-br from-white/10 to-transparent", scenario === 'alarm' ? "opacity-100" : "opacity-0")} />
                        <CardContent className="p-8 flex items-center gap-6 relative z-10">
                            <div className={cn("p-4 rounded-3xl transition-all duration-500", scenario === 'alarm' ? "bg-white/20" : "bg-primary/10 text-primary group-hover:scale-110")}>
                                <Activity className="h-8 w-8" />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn("text-[10px] font-semibold uppercase tracking-widest mb-1", scenario === 'alarm' ? "text-white/60" : "text-primary/40")}>Primeira Opção</span>
                                <span className="text-xl font-semibold tracking-tighter">Alarme Monitorado</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card 
                        className={cn(
                            "cursor-pointer group relative overflow-hidden transition-all duration-500 border-none rounded-[2.5rem] shadow-premium",
                            scenario === 'cftv' ? "bg-emerald-600 text-white shadow-2xl shadow-emerald-600/30" : "bg-background/40 backdrop-blur-3xl hover:bg-emerald-500/5"
                        )}
                        onClick={() => {
                            setScenario('cftv');
                            setBaseMonitoringValue(0);
                            setComodatoType('Real');
                        }}
                    >
                         <div className={cn("absolute inset-0 bg-gradient-to-br from-white/10 to-transparent", scenario === 'cftv' ? "opacity-100" : "opacity-0")} />
                        <CardContent className="p-8 flex items-center gap-6 relative z-10">
                            <div className={cn("p-4 rounded-3xl transition-all duration-500", scenario === 'cftv' ? "bg-white/20" : "bg-emerald-500/10 text-emerald-600 group-hover:scale-110")}>
                                <Eye className="h-8 w-8" />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn("text-[10px] font-semibold uppercase tracking-widest mb-1", scenario === 'cftv' ? "text-white/60" : "text-emerald-600/40")}>Segunda Opção</span>
                                <span className="text-xl font-semibold tracking-tighter">CFTV & Acesso</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card 
                        className={cn(
                            "cursor-pointer group relative overflow-hidden transition-all duration-500 border-none rounded-[2.5rem] shadow-premium",
                            scenario === 'mixed' ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30" : "bg-background/40 backdrop-blur-3xl hover:bg-indigo-500/5"
                        )}
                        onClick={() => {
                            setScenario('mixed');
                            if (baseMonitoringValue === 0) setBaseMonitoringValue(228.32);
                            setComodatoType('Real');
                        }}
                    >
                        <div className={cn("absolute inset-0 bg-gradient-to-br from-white/10 to-transparent", scenario === 'mixed' ? "opacity-100" : "opacity-0")} />
                        <CardContent className="p-8 flex items-center gap-6 relative z-10">
                            <div className={cn("p-4 rounded-3xl transition-all duration-500", scenario === 'mixed' ? "bg-white/20" : "bg-indigo-500/10 text-indigo-600 group-hover:scale-110")}>
                                <Zap className="h-8 w-8" />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn("text-[10px] font-semibold uppercase tracking-widest mb-1", scenario === 'mixed' ? "text-white/60" : "text-indigo-600/40")}>Terceira Opção</span>
                                <span className="text-xl font-semibold tracking-tighter">Combo Alarme e CFTV +</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="overflow-visible relative z-30 border-none bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-sm font-semibold tracking-[0.2em] text-primary/40 flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Importar Orçamento
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Buscar por Número ou Cliente</Label>
                                <Popover open={quotePopoverOpen} onOpenChange={setQuotePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={quotePopoverOpen}
                                            className="w-full justify-between h-14 rounded-2xl bg-background/50 border-border/40 hover:bg-background transition-all font-semibold px-4"
                                            disabled={isEditing}
                                        >
                                            <span className="truncate">{quoteSearch ? quoteSearch : "Número do Orçamento..."}</span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 rounded-3xl border-border/40 shadow-2xl overflow-hidden" align="start">
                                        <Command className="rounded-none" shouldFilter={false}>
                                            <CommandInput placeholder="Digite o número..." value={quoteSearch} onValueChange={setQuoteSearch} className="h-12" />
                                            <CommandList>
                                                <CommandEmpty>Nenhum orçamento encontrado.</CommandEmpty>
                                                <CommandGroup>
                                                    {filteredQuotes.map((q) => (
                                                        <CommandItem
                                                            key={q.id}
                                                            value={q.id}
                                                            onSelect={() => handleQuoteSelect(q)}
                                                            className="flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-primary/5 uppercase"
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="font-semibold text-primary">{q.quoteNumber}</span>
                                                                <span className="text-[10px] font-semibold text-muted-foreground">{formatCurrency(q.total)}</span>
                                                            </div>
                                                            <span className="text-xs font-semibold truncate w-full">{q.clientName}</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-sm font-semibold tracking-[0.2em] text-primary/40 flex items-center gap-2">
                                <User className="h-4 w-4" /> Cliente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Selecionar Contratante</Label>
                                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={clientPopoverOpen}
                                            className="w-full justify-between h-14 rounded-2xl bg-background/50 border-border/40 hover:bg-background transition-all font-semibold px-4"
                                            disabled={isEditing}
                                        >
                                            <span className="truncate">
                                                {selectedClientId 
                                                    ? clients.find(c => c.id === selectedClientId)?.name 
                                                    : "Escolher cliente..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 rounded-3xl border-border/40 shadow-2xl overflow-hidden" align="start">
                                        <Command className="rounded-none" shouldFilter={false}>
                                            <CommandInput placeholder="Buscar cliente..." value={clientSearch} onValueChange={setClientSearch} className="h-12" />
                                            <CommandList>
                                                <CommandEmpty>Cliente não localizado.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => setIsClientDialogOpen(true)}
                                                        className="p-3 font-semibold cursor-pointer hover:bg-primary/5 text-primary justify-center gap-2 mb-1"
                                                    >
                                                        <Plus className="h-4 w-4" /> Cadastrar Novo Cliente
                                                    </CommandItem>
                                                    {filteredClients.map((c) => (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={c.id}
                                                            onSelect={() => {
                                                                setSelectedClientId(c.id);
                                                                setClientSearch(c.name);
                                                                setClientPopoverOpen(false);
                                                            }}
                                                            className="p-3 font-semibold cursor-pointer hover:bg-primary/5 uppercase"
                                                        >
                                                            {c.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-sm font-semibold tracking-[0.2em] text-primary/40 flex items-center gap-2">
                                <Package className="h-4 w-4" /> Adicionar Equipamentos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Buscar por Modelo ou Categoria</Label>
                                <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-between h-14 rounded-2xl bg-background/50 border-border/40 hover:bg-background transition-all font-semibold px-4 text-muted-foreground"
                                        >
                                            Pesquisar no catálogo...
                                            <Search className="ml-2 h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0 rounded-3xl border-border/40 shadow-2xl overflow-hidden" align="end">
                                        <Command className="rounded-none" shouldFilter={false}>
                                            <CommandInput placeholder="Ex: Câmera, DVR, Sensor..." value={productSearch} onValueChange={setProductSearch} className="h-12" />
                                            <CommandList>
                                                <CommandEmpty>Nenhum produto em estoque.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => {
                                                            setProductPopoverOpen(false);
                                                            handleAddProductClick();
                                                        }}
                                                        className="p-3 font-semibold cursor-pointer hover:bg-primary/5 text-primary justify-center gap-2 mb-1"
                                                    >
                                                        <Plus className="h-4 w-4" /> Cadastrar Novo Produto
                                                    </CommandItem>
                                                    {filteredProducts.map((p) => (
                                                        <CommandItem
                                                            key={p.id}
                                                            value={p.id}
                                                            onSelect={() => handleAddProduct(p)}
                                                            className="flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-primary/5 uppercase"
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="font-semibold text-sm">{p.description}</span>
                                                                <span className="text-[10px] font-semibold text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                                    {p.item}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground line-clamp-1">{p.manufacturer || "Catálogo Padrão"}</p>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <Card className="border-none bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium overflow-hidden">
                        <CardHeader className="p-8 pb-4 bg-primary/[0.02] border-b border-border/40">
                            <CardTitle className="text-sm font-semibold tracking-[0.2em] text-primary/40 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ListChecks className="h-4 w-4" /> Itens da Proposta
                                </div>
                                <span className="text-[10px] px-3 py-1 rounded-full bg-primary/10 text-primary">
                                    {items.length} Componentes
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-primary/[0.02]">
                                            <th className="p-6 text-left w-10"></th>
                                            <th className="p-6 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-50">Equipamento</th>
                                            <th className="p-6 text-center w-32 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-50">Quantidade</th>
                                            <th className="p-6 text-center w-48 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-50">Modelo Posse</th>
                                            <th className="p-6 text-right w-40 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-50">Custo Unit.</th>
                                            <th className="p-6 text-right w-40 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-50">Subtotal</th>
                                            <th className="p-6 text-center w-28 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-50 flex items-center justify-center gap-2">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-primary/5">
                                        {items.map(item => (
                                            <tr
                                                key={item.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, item)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, item)}
                                                onDragEnd={handleDragEnd}
                                                className={cn(
                                                    "group transition-all duration-300 hover:bg-primary/[0.01]",
                                                    draggedItem?.id === item.id && "opacity-50 bg-primary/10",
                                                )}
                                            >
                                                <td className="p-6 text-center">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab group-hover:text-primary transition-colors" />
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground text-base tracking-tight">{item.product.description}</span>
                                                        <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">{item.product.item}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex items-center justify-center">
                                                        <Input 
                                                            type="number" 
                                                            value={item.quantity} 
                                                            onChange={e => handleItemQuantityChange(item.id, e.target.value)} 
                                                            className="h-10 w-20 text-center font-semibold rounded-xl bg-background/50 border-border/40 focus:bg-background transition-all" 
                                                            min="0" 
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex justify-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={cn(
                                                                "h-9 px-4 rounded-xl font-semibold text-[10px] uppercase tracking-widest transition-all",
                                                                item.isClientEquipment 
                                                                    ? "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20" 
                                                                    : "bg-primary/10 text-primary hover:bg-primary/20"
                                                            )}
                                                            onClick={() => handleToggleClientEquipment(item.id)}
                                                        >
                                                            {item.isClientEquipment ? "Ativo do Cliente" : "Patrimônio Empresa"}
                                                        </Button>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    {item.isClientEquipment ? (
                                                        <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">Incluso</span>
                                                    ) : (
                                                        <span className="font-semibold text-sm tracking-tighter">{formatCurrency(item.materialPrice)}</span>
                                                    )}
                                                </td>
                                                <td className="p-6 text-right">
                                                    {item.isClientEquipment ? (
                                                        <span className="text-[10px] font-semibold text-muted-foreground/30">---</span>
                                                    ) : (
                                                        <span className="font-semibold text-sm tracking-tighter text-primary">
                                                            {formatCurrency(item.materialPrice * item.quantity)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-6 text-center flex items-center justify-center gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-xl hover:bg-primary/10 text-muted-foreground/50 hover:text-primary transition-all"
                                                        onClick={() => handleEditProductClick(item)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-xl hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-all"
                                                        onClick={() => handleDeleteItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
                        <Card className="border-none bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium">
                            <CardHeader className="p-8 pb-4">
                                <CardTitle className="text-sm font-semibold tracking-[0.2em] text-primary/40 flex items-center gap-2">
                                    <Calculator className="h-4 w-4" /> Parâmetros Estratégicos
                                </CardTitle>
                            </CardHeader>
                            <TooltipProvider>
                                <CardContent className="p-8 pt-0 space-y-8">
                                    <div className="p-6 rounded-3xl bg-primary/[0.03] border border-border/40 space-y-4">
                                        <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">Configuração de Modalidade</Label>
                                        <div className="flex flex-wrap gap-4">
                                            {scenario === 'alarm' && (
                                                <>
                                                    <div 
                                                        onClick={() => setComodatoType('Real')}
                                                        className={cn(
                                                            "flex-1 flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border",
                                                            comodatoType === 'Real' ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white/50 border-border/40 text-muted-foreground hover:bg-white"
                                                        )}
                                                    >
                                                        <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", comodatoType === 'Real' ? "border-white" : "border-primary/20")}>
                                                            {comodatoType === 'Real' && <div className="w-2 h-2 rounded-full bg-white" />}
                                                        </div>
                                                        <span className="text-xs font-semibold uppercase tracking-tighter">Patrimônio Próprio</span>
                                                    </div>
                                                    <div 
                                                        onClick={() => setComodatoType('Client')}
                                                        className={cn(
                                                            "flex-1 flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border",
                                                            comodatoType === 'Client' ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20" : "bg-white/50 border-border/40 text-muted-foreground hover:bg-white"
                                                        )}
                                                    >
                                                        <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", comodatoType === 'Client' ? "border-white" : "border-primary/20")}>
                                                            {comodatoType === 'Client' && <div className="w-2 h-2 rounded-full bg-white" />}
                                                        </div>
                                                        <span className="text-xs font-semibold uppercase tracking-tighter">Equip. do Cliente</span>
                                                    </div>
                                                </>
                                            )}
                                            {scenario !== 'alarm' && (
                                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-border/40 w-full text-primary/60 italic text-[11px] font-semibold">
                                                    <Info className="h-4 w-4 shrink-0" />
                                                    Esta modalidade utiliza depreciação inteligente baseada no inventário selecionado.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2 cursor-help">
                                                        Contrato (Meses) <Info className="h-3 w-3 opacity-30" />
                                                    </Label>
                                                </TooltipTrigger>
                                                <TooltipContent><p className="font-semibold p-1">Período de fidelidade contratual.</p></TooltipContent>
                                            </Tooltip>
                                            <Input
                                                type="number"
                                                value={contractDuration || ""}
                                                onChange={(e) => setContractDuration(Number(e.target.value))}
                                                className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-lg focus:bg-background transition-all px-4"
                                                min="12"
                                                max={60}
                                                step={12}
                                                required
                                            />
                                        </div>
                                        {scenario !== 'alarm' && (
                                            <div className="space-y-3">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2 cursor-help">
                                                            Margem (%) <Info className="h-3 w-3 opacity-30" />
                                                        </Label>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p className="font-semibold p-1">Sua margem de lucro sobre o custo de comodato.</p></TooltipContent>
                                                </Tooltip>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={profitMargin || ""}
                                                        onChange={(e) => setProfitMargin(Number(e.target.value))}
                                                        className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-lg focus:bg-background transition-all px-4 pr-12"
                                                        min="0"
                                                        max={500}
                                                        required
                                                    />
                                                    <Percent className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 pointer-events-none" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {scenario !== 'alarm' && (
                                        <>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Custo Preventiva</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            value={preventiveVisitCost || ""}
                                                            onChange={e => setPreventiveVisitCost(Number(e.target.value))}
                                                            className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-lg focus:bg-background transition-all px-4"
                                                        />
                                                        <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 pointer-events-none" />
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Visitas / Ano</Label>
                                                    <Input
                                                        type="number"
                                                        value={preventiveVisitsPerYear || ""}
                                                        onChange={e => setPreventiveVisitsPerYear(Number(e.target.value))}
                                                        className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-lg focus:bg-background transition-all px-4"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4 p-6 rounded-3xl border border-red-500/10 bg-red-500/[0.02]">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-red-600">Vida Útil (Depreciação)</Label>
                                                    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-red-500/10 text-red-600 font-semibold text-[9px] uppercase tracking-tighter">
                                                        <Activity className="h-3 w-3" /> Sugerido: 60 meses
                                                    </div>
                                                </div>
                                                <Input
                                                    type="number"
                                                    value={usefulLife || ""}
                                                    onChange={(e) => setUsefulLife(Number(e.target.value))}
                                                    className="h-14 rounded-2xl bg-white border-red-500/20 font-semibold text-xl text-red-600 focus:bg-white text-center shadow-inner"
                                                    min="12"
                                                    required
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Reserva Técnica (%)</Label>
                                                    <Input type="number" value={technicalReserve || ""} onChange={e => setTechnicalReserve(Number(e.target.value))} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Custo Capital (% am)</Label>
                                                    <Input type="number" value={capitalInterestRate || ""} onChange={e => setCapitalInterestRate(Number(e.target.value))} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border/40">
                                        {scenario !== 'cftv' && (
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 ml-1">Monitoramento Mensal</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={baseMonitoringValue || ""}
                                                        onChange={e => setBaseMonitoringValue(Number(e.target.value))}
                                                        className="h-14 rounded-2xl bg-blue-500/[0.03] border-blue-500/10 font-semibold text-lg text-blue-600 px-4"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-semibold uppercase tracking-widest text-orange-600 ml-1">Taxa de Implantação</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={installationLaborCost || ""}
                                                    onChange={e => setInstallationLaborCost(Number(e.target.value))}
                                                    className="h-14 rounded-2xl bg-orange-500/[0.03] border-orange-500/10 font-semibold text-lg text-orange-600 px-4"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </TooltipProvider>
                        </Card>

                        <Card className="border-none bg-primary text-primary-foreground rounded-[2.5rem] shadow-2xl shadow-primary/30 relative overflow-hidden flex flex-col">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                            <CardHeader className="p-8 pb-4 relative z-10">
                                <CardTitle className="text-xs font-semibold tracking-[0.3em] opacity-60 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" /> Relatório Executivo
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 pt-0 space-y-6 relative z-10 flex-1">
                                {scenario === 'alarm' ? (
                                    <div className="space-y-6">
                                        <div className="flex flex-col p-6 rounded-3xl bg-white/10 border border-white/10">
                                            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mb-2">Patrimônio Alocado</span>
                                            <span className="text-2xl font-semibold tracking-tighter">{formatCurrency(calculationResults.totalEquipmentCost)}</span>
                                        </div>
                                        <p className="text-xs font-semibold leading-relaxed opacity-80 bg-black/10 p-4 rounded-2xl">
                                            {comodatoType === 'Client' 
                                                ? "O cliente fornece a infraestrutura. Aplicação exclusiva de monitoramento e manutenção contratual."
                                                : "Patrimônio sob gestão. Responsabilidade total da contratada pela funcionalidade do ecossistema."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                                <span className="text-[9px] font-semibold uppercase tracking-widest opacity-40 block mb-1">Custo Hardware</span>
                                                <span className="text-sm font-semibold">{formatCurrency(calculationResults.totalEquipmentCost)}</span>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                                <span className="text-[9px] font-semibold uppercase tracking-widest opacity-40 block mb-1">Depreciação</span>
                                                <span className="text-sm font-semibold">{formatCurrency(calculationResults.monthlyDepreciation)}/m</span>
                                            </div>
                                        </div>
                                        <div className="p-5 rounded-3xl bg-black/10 border border-white/5 space-y-3">
                                            <div className="flex justify-between text-xs font-semibold">
                                                <span className="opacity-60">Manutenção Planejada</span>
                                                <span>{formatCurrency(calculationResults.monthlyMaintenance)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-semibold">
                                                <span className="opacity-60">Provisionamento Res. Técnica</span>
                                                <span>{formatCurrency(calculationResults.monthlyTechnicalReserve)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-semibold pt-3 border-t border-white/5">
                                                <span className="uppercase tracking-widest text-[10px]">Custo Operacional</span>
                                                <span className="text-lg font-semibold">{formatCurrency(calculationResults.monthlyTotalCost)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-auto pt-8 flex flex-col gap-8">
                                    <div className="flex flex-col items-center justify-center p-8 rounded-[3rem] bg-white text-primary shadow-2xl relative">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold uppercase tracking-[0.2em] shadow-lg">
                                            Sugerido
                                        </div>
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] opacity-40 mb-2">Mensalidade Sugerida</span>
                                        <span className="text-5xl font-semibold tracking-tighter leading-none">{formatCurrency(calculationResults.suggestedMonthlyFee)}</span>
                                    </div>

                                    <div className="p-6 rounded-3xl bg-orange-500/20 border border-orange-500/20 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-200">Investimento Inicial</span>
                                            <span className="text-xl font-semibold text-orange-300">{formatCurrency(installationLaborCost)}</span>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-orange-300 shadow-lg shadow-orange-500/30">
                                            <Zap className="h-6 w-6 text-orange-950" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <div className="p-8 pt-0 relative z-10 text-center opacity-40">
                                <p className="text-[9px] font-semibold uppercase tracking-[0.4em] italic">
                                    * Projeção válida para contrato de {contractDuration} meses
                                </p>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Edit Item Dialog */}
            <AddEditProductDialog
                isOpen={isProductDialogOpen}
                setOpen={setIsProductDialogOpen}
                onProductSaved={handleProductSaved}
                product={productToEdit}
                suppliers={suppliers}
                locations={locations}
            />

            <AddEditClientDialog 
                isOpen={isClientDialogOpen} 
                setOpen={setIsClientDialogOpen}
                onClientSaved={handleClientSaved}
            />
        </div>
    );
}

export default function ComodatoProposalPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <ComodatoProposalForm />
        </Suspense>
    );
}
