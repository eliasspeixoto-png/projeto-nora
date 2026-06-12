"use client";

import { useState, useMemo, useEffect, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Client, Product, Quote, QuoteItem } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, ListChecks, Search, Save, Trash2, Calculator, Percent, Wand2, FileText, GripVertical, Info, Check, ChevronsUpDown, Sparkles, Activity, Zap, Eye, DollarSign } from "lucide-react";
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
    getCompany
} from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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

interface ProposalFormProps {
    quoteId?: string | null;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function ProposalForm({ quoteId, onSuccess, onCancel }: ProposalFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { userProfile, firebase } = useAuth();
    const companyId = userProfile?.companyId;

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

    type Scenario = 'alarm' | 'cftv' | 'mixed';
    const [scenario, setScenario] = useState<Scenario>('alarm');

    useEffect(() => {
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
                const [productsData, clientsData, quotesData] = await Promise.all([
                    getProductsOnce(firebase.db, companyId!, 'Ativo'),
                    getClientsOnce(firebase.db, companyId!),
                    getQuotesOnce(firebase.db, companyId!, userProfile!)
                ]);

                setProducts(productsData);
                setClients(clientsData);
                setQuotes(quotesData);

                if (isEditing && quoteId) {
                    const existingQuote = await getQuote(firebase.db, quoteId);
                    if (existingQuote) {
                        setSelectedClientId(existingQuote.clientId);
                        setItems(existingQuote.items);
                        setQuoteSearch(existingQuote.quoteNumber);
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
                        if (client) setClientSearch(client.name);
                    }
                }
            } catch (error) {
                toast({ variant: "destructive", title: "Erro ao Carregar Dados" });
            } finally {
                setIsLoading(false);
            }
        }
        loadInitialData();
    }, [companyId, userProfile, isEditing, quoteId, firebase.db, toast]);

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
            toast({ variant: "destructive", title: "Cliente Diferente", description: "Este orçamento pertence a outro cliente." });
            return;
        }

        setItems(prev => {
            const merged = [...prev];
            quote.items.forEach(quoteItem => {
                const existingIndex = merged.findIndex(i => i.product.id === quoteItem.product.id);
                if (existingIndex > -1) {
                    merged[existingIndex] = {
                        ...merged[existingIndex],
                        quantity: merged[existingIndex].quantity + quoteItem.quantity,
                        total: round((merged[existingIndex].quantity + quoteItem.quantity) * (merged[existingIndex].materialPrice + (merged[existingIndex].servicePrice || 0))),
                    };
                } else {
                    merged.push({
                        ...quoteItem,
                        id: `${quote.id}-${quoteItem.id}`,
                        materialPrice: quoteItem.product.sellingPrice || 0,
                        total: quoteItem.quantity * (quoteItem.product.sellingPrice || 0),
                        isClientEquipment: false
                    });
                }
            });
            return merged;
        });

        if (quote.fenceDetails?.installationLaborCost !== undefined) setInstallationLaborCost(prev => prev + (quote.fenceDetails?.installationLaborCost || 0));
        setQuoteSearch('');
        setQuotePopoverOpen(false);
    };

    const handleAddProduct = (product: Product) => {
        if (items.some(item => item.product.id === product.id)) return;
        setItems(prev => [...prev, {
            id: `item-${product.id}`,
            product: product,
            quantity: 1,
            materialPrice: product.sellingPrice || 0,
            servicePrice: product.servicePrice || 0,
            total: (product.sellingPrice || 0) + (product.servicePrice || 0),
            isClientEquipment: false
        }]);
        setProductSearch('');
        setProductPopoverOpen(false);
    };

    const calculationResults = useMemo(() => {
        const totalDepreciationCost = items.reduce((sum, item) => 
            (item.isClientEquipment || item.product.segment === 'ALARMES') ? sum : sum + item.quantity * item.materialPrice, 0);
        
        const monthlyDepreciation = usefulLife > 0 ? totalDepreciationCost / usefulLife : 0;
        const effectivePreventiveVisitCost = scenario === 'alarm' ? 0 : preventiveVisitCost;
        const monthlyMaintenance = (effectivePreventiveVisitCost * preventiveVisitsPerYear) / 12;
        const monthlyTechnicalReserve = scenario === 'alarm' ? 0 : (totalDepreciationCost * (technicalReserve / 100)) / usefulLife;
        const monthlyCapitalCost = scenario === 'alarm' ? 0 : totalDepreciationCost * (capitalInterestRate / 100);
        
        const baseCost = (scenario === 'alarm' && comodatoType === 'Client') ? 0 : (monthlyDepreciation + monthlyMaintenance + monthlyTechnicalReserve + monthlyCapitalCost);
        const suggestedMonthlyFee = scenario === 'alarm' ? baseMonitoringValue : (baseCost * (1 + (profitMargin / 100))) + baseMonitoringValue;

        return { suggestedMonthlyFee, monthlyTotalCost: baseCost };
    }, [items, usefulLife, profitMargin, preventiveVisitCost, preventiveVisitsPerYear, comodatoType, baseMonitoringValue, scenario, technicalReserve, capitalInterestRate]);

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

    const handleGenerateProposal = async () => {
        if (!companyId || !selectedClientId || (comodatoType === 'Real' && items.length === 0) || !firebase.db || !firebase.auth) {
            toast({ variant: "destructive", title: "Dados Incompletos", description: "Selecione um cliente e itens." });
            return;
        }

        setIsSaving(true);
        try {
            if (!isEditing) {
                const existing = quotes.find(q => q.clientId === selectedClientId && q.isComodato);
                if (existing) {
                    toast({ variant: "destructive", title: "Proposta já Existente", description: `Edite a proposta nº ${existing.quoteNumber}.` });
                    setIsSaving(false); return;
                }
            }

            const client = clients.find(c => c.id === selectedClientId);
            const company = await getCompany(firebase.db, companyId);
            const existingQuote = isEditing ? await getQuote(firebase.db, quoteId!) : null;

            const quoteData = {
                clientId: selectedClientId,
                clientName: client?.name || 'Cliente',
                companyName: company?.name || 'Empresa',
                items: items.map(item => ({ ...item, total: item.quantity * item.materialPrice })),
                total: calculationResults.suggestedMonthlyFee,
                installments: contractDuration,
                interestRate: profitMargin,
                status: existingQuote?.status || 'draft',
                companyId,
                serviceType: 'Comodato' as const,
                isComodato: true,
                comodatoType,
                comodatoMonthlyFee: calculationResults.suggestedMonthlyFee,
                installationFee: installationLaborCost,
                fenceDetails: {
                    ...existingQuote?.fenceDetails as any,
                    preventiveVisitsPerYear, preventiveVisitCost, baseMonitoringValue, installationLaborCost, scenario, usefulLife, technicalReserve, capitalInterestRate,
                }
            };

            if (isEditing) {
                await updateQuote(firebase.db, firebase.auth, quoteId!, quoteData as any);
                toast({ title: "Sucesso!", description: "Proposta atualizada." });
            } else {
                await addQuote(firebase.db, firebase.auth, quoteData as any);
                toast({ title: "Sucesso!", description: "Proposta gerada." });
            }
            onSuccess?.();
            router.push('/comodato');
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="flex h-full items-center justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;

    return (
        <ScrollArea className="h-full">
            <div className="flex flex-col gap-8 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-premium">
                            <Calculator className="text-primary h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-xl font-semibold tracking-tighter text-foreground">
                                {isEditing ? "Editar Proposta de Comodato" : "Nova Proposta de Comodato"}
                            </h2>
                            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-primary/40 mt-1 flex items-center gap-2">
                                <Sparkles className="h-3 w-3 animate-pulse" /> Motor de Inteligência
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button 
                            variant="ghost" 
                            onClick={onCancel}
                            className="h-11 px-6 rounded-2xl font-semibold text-xs uppercase tracking-widest hover:bg-black/5"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleGenerateProposal} 
                            disabled={isSaving}
                            className="h-11 px-8 rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-2 bg-primary flex-1 sm:flex-none"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Salvar Alterações
                        </Button>
                    </div>
                </header>

                {/* Scenario Selection Grid - Premium Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div 
                        onClick={() => { setScenario('alarm'); setBaseMonitoringValue(228.32); setComodatoType('Real'); }}
                        className={cn(
                            "cursor-pointer group relative overflow-hidden p-5 rounded-2xl transition-all duration-500 border-none shadow-premium",
                            scenario === 'alarm' ? "bg-primary text-white shadow-xl shadow-primary/30" : "bg-background/40 backdrop-blur-3xl hover:bg-primary/5"
                        )}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn("p-3 rounded-2xl transition-all duration-500", scenario === 'alarm' ? "bg-white/20" : "bg-primary/10 text-primary")}>
                                <Activity className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn("text-[8px] font-semibold uppercase tracking-widest", scenario === 'alarm' ? "text-white/60" : "text-primary/40")}>Primeira Opção</span>
                                <span className="text-sm font-semibold tracking-tighter leading-tight">Alarme Monitorado</span>
                            </div>
                        </div>
                    </div>

                    <div 
                        onClick={() => { setScenario('cftv'); setBaseMonitoringValue(0); setComodatoType('Real'); }}
                        className={cn(
                            "cursor-pointer group relative overflow-hidden p-5 rounded-[1.8rem] transition-all duration-500 border-none shadow-premium",
                            scenario === 'cftv' ? "bg-emerald-600 text-white shadow-xl shadow-emerald-600/30" : "bg-background/40 backdrop-blur-3xl hover:bg-emerald-500/5"
                        )}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn("p-3 rounded-2xl transition-all duration-500", scenario === 'cftv' ? "bg-white/20" : "bg-emerald-500/10 text-emerald-600")}>
                                <Eye className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn("text-[8px] font-semibold uppercase tracking-widest", scenario === 'cftv' ? "text-white/60" : "text-emerald-500/40")}>Segunda Opção</span>
                                <span className="text-sm font-semibold tracking-tighter leading-tight">CFTV & Acesso</span>
                            </div>
                        </div>
                    </div>

                    <div 
                        onClick={() => { setScenario('mixed'); setBaseMonitoringValue(228.32); setComodatoType('Real'); }}
                        className={cn(
                            "cursor-pointer group relative overflow-hidden p-5 rounded-[1.8rem] transition-all duration-500 border-none shadow-premium",
                            scenario === 'mixed' ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/30" : "bg-background/40 backdrop-blur-3xl hover:bg-indigo-500/5"
                        )}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn("p-3 rounded-2xl transition-all duration-500", scenario === 'mixed' ? "bg-white/20" : "bg-indigo-500/10 text-indigo-400")}>
                                <Zap className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn("text-[8px] font-semibold uppercase tracking-widest", scenario === 'mixed' ? "text-white/60" : "text-indigo-400/40")}>Terceira Opção</span>
                                <span className="text-sm font-semibold tracking-tighter leading-tight">Combo Premium</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input Cards Section */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="border-none bg-background/40 backdrop-blur-3xl rounded-2xl shadow-premium">
                                <CardHeader className="p-6 pb-2">
                                    <Label className="text-[9px] font-semibold uppercase tracking-widest text-primary/40 flex items-center gap-2">
                                        <FileText className="h-3 w-3" /> Importar Orçamento
                                    </Label>
                                </CardHeader>
                                <CardContent className="p-6 pt-2">
                                    <Popover open={quotePopoverOpen} onOpenChange={setQuotePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between h-12 rounded-xl bg-background/50 border-border/40 font-semibold px-3" disabled={isEditing}>
                                                <span className="truncate">{quoteSearch || "Buscar orçamento..."}</span>
                                                <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0 rounded-2xl border-border/40 shadow-2xl overflow-hidden" align="start">
                                            <Command shouldFilter={false}>
                                                <CommandInput placeholder="Digite o número..." value={quoteSearch} onValueChange={setQuoteSearch} />
                                                <CommandList>
                                                    <CommandEmpty>Não localizado.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredQuotes.map(q => (
                                                            <CommandItem key={q.id} value={q.id} onSelect={() => handleQuoteSelect(q)} className="p-3 flex flex-col items-start gap-1 uppercase">
                                                                <span className="font-semibold text-primary">{q.quoteNumber}</span>
                                                                <span className="text-[10px] font-semibold">{q.clientName}</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </CardContent>
                            </Card>

                            <Card className="border-none bg-background/40 backdrop-blur-3xl rounded-2xl shadow-premium">
                                <CardHeader className="p-6 pb-2">
                                    <Label className="text-[9px] font-semibold uppercase tracking-widest text-primary/40 flex items-center gap-2">
                                        <User className="h-3 w-3" /> Selecionar Cliente
                                    </Label>
                                </CardHeader>
                                <CardContent className="p-6 pt-2">
                                    <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between h-12 rounded-xl bg-background/50 border-border/40 font-semibold px-3" disabled={isEditing}>
                                                <span className="truncate">{selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : "Escolher cliente..."}</span>
                                                <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0 rounded-2xl border-border/40 shadow-2xl overflow-hidden" align="start">
                                            <Command shouldFilter={false}>
                                                <CommandInput placeholder="Nome do cliente..." value={clientSearch} onValueChange={setClientSearch} />
                                                <CommandList>
                                                    <CommandEmpty>Nenhum resultado.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredClients.map(c => (
                                                            <CommandItem key={c.id} value={c.id} onSelect={() => { setSelectedClientId(c.id); setClientSearch(c.name); setClientPopoverOpen(false); }} className="p-3 font-semibold uppercase">
                                                                {c.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Add Items Card */}
                        <Card className="border-none bg-background/40 backdrop-blur-3xl rounded-2xl shadow-premium">
                            <CardHeader className="p-8 pb-4 bg-primary/[0.02] border-b border-border/40">
                                <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-primary/40 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ListChecks className="h-4 w-4" /> Composição Tecnológica
                                    </div>
                                    <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="h-8 rounded-full bg-primary/10 border-none text-primary font-semibold px-4 text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                                                Adicionar Item
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[350px] p-0 rounded-2xl border-border/40 shadow-2xl overflow-hidden" align="end">
                                            <Command shouldFilter={false}>
                                                <CommandInput placeholder="O que deseja adicionar?..." value={productSearch} onValueChange={setProductSearch}/>
                                                <CommandList>
                                                    <CommandEmpty>Processado sem resultados.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredProducts.map(p => (
                                                            <CommandItem key={p.id} value={p.id} onSelect={() => handleAddProduct(p)} className="p-3 flex items-center justify-between uppercase">
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-xs">{p.description}</span>
                                                                    <span className="text-[9px] text-muted-foreground">{p.item}</span>
                                                                </div>
                                                                <span className="text-[9px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">Incluso</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-64">
                                    <table className="w-full">
                                        <tbody className="divide-y divide-primary/5">
                                            {items.map(item => (
                                                <tr key={item.id} className="group transition-all hover:bg-primary/[0.01]">
                                                    <td className="p-5">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-sm tracking-tight">{item.product.description}</span>
                                                            <span className="text-[9px] font-semibold text-muted-foreground/30 uppercase tracking-widest">{item.product.item}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 w-24">
                                                        <Input type="number" value={item.quantity} onChange={e => handleItemQuantityChange(item.id, e.target.value)} className="h-10 text-center font-semibold rounded-xl bg-background/50 border-border/40 focus:bg-background" />
                                                    </td>
                                                    <td className="p-5 text-right w-32">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className={cn(
                                                                    "h-7 px-3 rounded-lg font-semibold text-[9px] uppercase tracking-widest",
                                                                    item.isClientEquipment ? "bg-indigo-500/10 text-indigo-600" : "bg-primary/10 text-primary"
                                                                )}
                                                                onClick={() => {
                                                                    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isClientEquipment: !i.isClientEquipment } : i));
                                                                }}
                                                            >
                                                                {item.isClientEquipment ? "Cliente" : "Ativo da Empresa"}
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/20 hover:text-destructive" onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Params and Results Section */}
                    <div className="space-y-6">
                        <Card className="border-none bg-background/40 backdrop-blur-3xl rounded-2xl shadow-premium">
                            <CardHeader className="p-8 pb-4">
                                <CardTitle className="text-[10px] font-semibold tracking-[0.2em] text-primary/40 flex items-center gap-2">
                                    <Calculator className="h-4 w-4" /> Parâmetros Estratégicos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 pt-0 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Contrato (Meses)</Label>
                                        <Input type="number" value={contractDuration} onChange={e => setContractDuration(Number(e.target.value))} className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-lg text-center" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Margem (%)</Label>
                                        <div className="relative">
                                            <Input type="number" value={profitMargin} onChange={e => setProfitMargin(Number(e.target.value))} className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-lg text-center pr-10" />
                                            <Percent className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-border/40">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <Label className="text-[9px] font-semibold uppercase tracking-widest text-blue-600">Mensalidade Monitoramento</Label>
                                        </div>
                                        <div className="relative">
                                            <Input type="number" value={baseMonitoringValue} onChange={e => setBaseMonitoringValue(Number(e.target.value))} className="h-14 rounded-2xl bg-blue-500/[0.03] border-blue-500/10 font-semibold text-xl text-blue-600 px-6" />
                                            <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500/20" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-semibold uppercase tracking-widest text-orange-600 ml-1">Taxa de Implantação</Label>
                                        <div className="relative">
                                            <Input type="number" value={installationLaborCost} onChange={e => setInstallationLaborCost(Number(e.target.value))} className="h-14 rounded-2xl bg-orange-500/[0.03] border-orange-500/10 font-semibold text-xl text-orange-600 px-6" />
                                            <Zap className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-500/20" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none bg-primary text-primary-foreground rounded-2xl shadow-2xl shadow-primary/30 relative overflow-hidden">
                             <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                             <div className="p-8 space-y-6 relative z-10">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60">Mensalidade Sugerida</span>
                                    <Zap className="h-5 w-5 opacity-40" />
                                </div>
                                <div className="flex flex-col items-center py-4 bg-white/10 rounded-2xl border border-white/10 shadow-inner">
                                    <span className="text-4xl font-semibold tracking-tighter leading-none mb-2">
                                        {formatCurrency(calculationResults.suggestedMonthlyFee)}
                                    </span>
                                    <span className="text-[8px] font-semibold uppercase tracking-[0.4em] opacity-40">Projeção Corporativa</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-semibold uppercase tracking-widest opacity-40 mb-1">Custo Base</span>
                                        <span className="text-xs font-semibold">{formatCurrency(calculationResults.monthlyTotalCost)}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-semibold uppercase tracking-widest opacity-40 mb-1">Patrimônio</span>
                                        <span className="text-xs font-semibold">{items.length} Itens</span>
                                    </div>
                                </div>
                             </div>
                        </Card>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
}
