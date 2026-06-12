"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "@/firebase/auth/use-user";
import type { ComodatoAsset, Client, Product, Quote } from "@/lib/data";
import { getComodatoAssets, getClientsOnce, getProductsOnce, addComodatoAsset, updateComodatoAsset, deleteComodatoAsset, bulkAddComodatoAssets, getQuotes, updateQuote } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Lock, Users, ArrowLeft, Search, Package, ClipboardList, MoreHorizontal, Edit, Trash2, ArrowUpDown, FileText, Activity, TrendingUp, Zap, LayoutDashboard, Sparkles, RefreshCcw, Landmark, DollarSign, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AddEditAssetDialog from "@/components/comodato/add-edit-asset-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ComodatoStatsCards from "@/components/comodato/stats-cards";
import AssetList from "@/components/comodato/asset-list";
import ClientPortfolioTable from "@/components/comodato/ClientPortfolioTable";
import ClientAssetsView from "@/components/comodato/client-assets-view";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { cn, formatTitleCase } from "@/lib/utils";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { differenceInMonths, parseISO, format, isValid, isAfter, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
    bulkUpdateClientServiceValues,
    getQuotesOnce
} from "@/lib/firebase/firestore";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from "@/components/ui/dialog";

const statusConfig: { [key: string]: { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' } } = {
  active: { label: 'Ativo', variant: 'success' },
  maintenance: { label: 'Em Manutenção', variant: 'warning' },
  returned: { label: 'Devolvido', variant: 'destructive' },
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  Aprovado: { label: 'Aprovado', variant: 'success' },
  rejected: { label: 'Recusado', variant: 'destructive' },
  'revision-pending': { label: 'Em Revisão', variant: 'warning' },
};

const contractStatusConfig: { [key: string]: { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' } } = {
  ativo: { label: 'Ativo', variant: 'success' },
  suspenso: { label: 'Suspenso', variant: 'warning' },
  encerrado: { label: 'Encerrado', variant: 'destructive' },
};

const normalizeString = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

export default function ComodatoPageClient() {
    const { userProfile, company, firebase } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [assets, setAssets] = useState<ComodatoAsset[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<ComodatoAsset | undefined>(undefined);
    const [isAlertOpen, setAlertOpen] = useState(false);
    const [assetToDelete, setAssetToDelete] = useState<ComodatoAsset | null>(null);
    
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [pageSize, setPageSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [proposalSearchTerm, setProposalSearchTerm] = useState('');
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
    const [proposalSortConfig, setProposalSortConfig] = useState<{ key: keyof Quote | 'comodatoMonthlyFee', direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });

    const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);
    const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
    const [batchPercentage, setBatchPercentage] = useState<string>("5");

    // Pagination for Dashboard Inventory
    const [currentPageDashboard, setCurrentPageDashboard] = useState(1);
    const [pageSizeDashboard, setPageSizeDashboard] = useState(10);

    // Pagination for Proposals
    const [currentPageProposals, setCurrentPageProposals] = useState(1);
    const [pageSizeProposals, setPageSizeProposals] = useState(10);

    useEffect(() => {
        if (!userProfile?.companyId || !firebase.db) {
            setIsLoading(false);
            return;
        }
        const { db } = firebase;
        const companyId = userProfile.companyId;

        const unsubAssets = getComodatoAssets(db, companyId, setAssets, console.error);
        const unsubQuotes = getQuotes(db, companyId, userProfile, setQuotes, console.error);
        
        Promise.all([
            getClientsOnce(db, companyId),
            getProductsOnce(db, companyId)
        ]).then(([clientsData, productsData]) => {
            setClients(clientsData.filter(c => c.isComodato));
            setProducts(productsData);
        }).catch(err => {
            toast({ variant: 'destructive', title: "Erro ao carregar dados", description: err.message });
        }).finally(() => {
            setIsLoading(false);
        });

        return () => {
            unsubAssets();
            unsubQuotes();
        };

    }, [userProfile?.companyId, userProfile?.uid, firebase.db, toast]);
    
    const comodatoProposals = useMemo(() => {
        let filteredProposals = quotes.filter(q => q.isComodato || q.serviceType === 'Comodato');
        
        if(proposalSearchTerm) {
            const lowerSearch = normalizeString(proposalSearchTerm);
            filteredProposals = filteredProposals.filter(p =>
                normalizeString(p.quoteNumber).includes(lowerSearch) ||
                normalizeString(p.clientName).includes(lowerSearch) ||
                normalizeString(p.status).includes(lowerSearch) ||
                normalizeString(formatCurrency(p.comodatoMonthlyFee || 0)).includes(lowerSearch) ||
                normalizeString(formatDate(p.date)).includes(lowerSearch)
            );
        }

        if (proposalSortConfig) {
            filteredProposals.sort((a, b) => {
                const key = proposalSortConfig.key as keyof Quote;
                let aValue: any = proposalSortConfig.key === 'comodatoMonthlyFee' ? a.comodatoMonthlyFee || 0 : a[key];
                let bValue: any = proposalSortConfig.key === 'comodatoMonthlyFee' ? b.comodatoMonthlyFee || 0 : b[key];

                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;
                
                if (key === 'date') {
                    return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (proposalSortConfig.direction === 'asc' ? 1 : -1);
                }

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue) * (proposalSortConfig.direction === 'asc' ? 1 : -1);
                }

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                     return (aValue - bValue) * (proposalSortConfig.direction === 'asc' ? 1 : -1);
                }

                return 0;
            });
        }
        
        return filteredProposals;
    }, [quotes, proposalSearchTerm, proposalSortConfig]);

    const paginatedProposals = useMemo(() => {
        const startIndex = (currentPageProposals - 1) * pageSizeProposals;
        return comodatoProposals.slice(startIndex, startIndex + pageSizeProposals);
    }, [comodatoProposals, currentPageProposals, pageSizeProposals]);

    const proposalsTotalPages = Math.ceil(comodatoProposals.length / pageSizeProposals);

    useEffect(() => {
        setCurrentPageProposals(1);
    }, [comodatoProposals.length, proposalSearchTerm]);
    
    const assetsByClient = useMemo(() => {
        const map = new Map<string, ComodatoAsset[]>();
        assets.forEach(asset => {
            if (asset.clientId) {
                const list = map.get(asset.clientId) || [];
                list.push(asset);
                map.set(asset.clientId, list);
            }
        });
        return map;
    }, [assets]);
    
    const stats = useMemo(() => {
        const activeAssets = assets.filter(a => a.status !== 'returned');
        const activeClients = clients.filter(c => c.isComodato && c.comodatoStatus === 'Ativo');
        const totalMonthlyRevenue = activeClients.reduce((sum, client) => {
                 const value = parseFloat(String(client.serviceValue).replace(',', '.') || '0');
                return sum + (isNaN(value) ? 0 : value);
            }, 0);

        return {
            totalClients: activeClients.length,
            totalAssets: activeAssets.filter(a => a.clientId).length,
            inMaintenance: activeAssets.filter(a => a.status === 'maintenance').length,
            pendingInstall: activeAssets.filter(a => !a.installationDate && a.status === 'active' && !a.clientId).length,
            monthlyRevenue: totalMonthlyRevenue,
        };
    }, [assets, clients]);

    const eligibleClientsCount = useMemo(() => {
        const now = new Date();
        return clients.filter(c => {
            if (!c.comodatoStartDate) return false;
            const startDate = parseISO(c.comodatoStartDate);
            return differenceInMonths(now, startDate) >= 12;
        }).length;
    }, [clients]);

    const handleBatchReajuste = async () => {
        const companyId = userProfile?.companyId;
        if (!firebase.db || !companyId) return;
        setIsUpdatingBatch(true);
        try {
            const percentage = parseFloat(batchPercentage);
            if (isNaN(percentage)) throw new Error("Porcentagem inválida");

            const now = new Date();
            const eligibleClients = clients.filter(c => {
                if (!c.comodatoStartDate) return false;
                const startDate = parseISO(c.comodatoStartDate);
                return differenceInMonths(now, startDate) >= 12;
            });

            if (eligibleClients.length === 0) {
                toast({ title: "Informação", description: "Nenhum cliente elegível para reajuste (mínimo 12 meses)." });
                return;
            }

            await bulkUpdateClientServiceValues(firebase.db, companyId, eligibleClients.map((c: any) => c.id), percentage);
            
            toast({ 
                title: "Sucesso!", 
                description: `Reajuste de ${percentage}% aplicado a ${eligibleClients.length} clientes.` 
            });
            setIsBatchDialogOpen(false);
            const clientsData = await getClientsOnce(firebase.db, companyId);
            setClients(clientsData.filter(c => c.isComodato));
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro no reajuste", description: error.message });
        } finally {
            setIsUpdatingBatch(false);
        }
    };


    const handleAddNewAsset = (clientId?: string) => {
        setEditingAsset(undefined);
        if (clientId) {
          setSelectedClientId(clientId);
        } else {
            setSelectedClientId(null);
        }
        setDialogOpen(true);
    };

    const handleEditAsset = (asset: ComodatoAsset) => {
        setEditingAsset(asset);
        setSelectedClientId(null);
        setTimeout(() => setDialogOpen(true), 50);
    };

    const confirmDeleteAsset = (asset: ComodatoAsset) => {
        setAssetToDelete(asset);
        setAlertOpen(true);
    };

    const handleDeleteAsset = async () => {
        if (!assetToDelete || !firebase.db) return;
        try {
            await deleteComodatoAsset(firebase.db, assetToDelete.id);
            toast({ title: "Sucesso", description: "Ativo excluído." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Erro ao excluir", description: error.message });
        } finally {
            setAlertOpen(false);
            setAssetToDelete(null);
        }
    };

    const handleUnlinkAsset = async (asset: ComodatoAsset) => {
        if (!asset || !firebase.db) return;
        try {
            await updateComodatoAsset(firebase.db, asset.id, {
                clientId: '',
                osId: '',
            });
            toast({ title: "Sucesso", description: "Ativo desvinculado e retornado ao estoque." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Erro ao desvincular", description: error.message });
        }
    };
    
    const onAssetSaved = async (data: Omit<ComodatoAsset, 'id' | 'companyId'>) => {
        if (!userProfile?.companyId || !firebase.db) return;
        
        try {
            if (editingAsset) {
                await updateComodatoAsset(firebase.db, editingAsset.id, data);
                toast({ title: "Sucesso", description: "Ativo atualizado." });
            } else {
                await addComodatoAsset(firebase.db, { ...data, companyId: userProfile.companyId });
                toast({ title: "Sucesso", description: "Ativo adicionado." });
            }
            setDialogOpen(false);
            if (data.clientId) {
                setSelectedClientId(data.clientId);
            }
        } catch(error: any) {
             toast({ variant: 'destructive', title: "Erro ao salvar", description: error.message });
        }
    };

    const onBulkAssetSaved = async (baseData: Omit<ComodatoAsset, 'id' | 'companyId' | 'serial'>, serials: string[]) => {
        if (!userProfile?.companyId || !firebase.db) return;
        
        try {
            const count = await bulkAddComodatoAssets(firebase.db, { ...baseData, companyId: userProfile.companyId }, serials);
            toast({ title: "Sucesso!", description: `${count} ${count === 1 ? 'ativo alocado' : 'ativos alocados'} com sucesso.` });
            setDialogOpen(false);
            if (baseData.clientId) {
                setSelectedClientId(baseData.clientId as string);
            }
        } catch(error: any) {
             toast({ variant: 'destructive', title: "Erro ao salvar em lote", description: error.message });
        }
    };

    const handleUpdateContractStatus = async (quoteId: string, status: 'ativo' | 'suspenso' | 'encerrado') => {
        if (!userProfile?.companyId || !firebase.db || !firebase.auth) return;
        try {
            await updateQuote(firebase.db, firebase.auth, quoteId, { contractStatus: status });
            toast({ title: "Status do Contrato Atualizado!", description: `O contrato foi marcado como ${status}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Erro ao atualizar status", description: error.message });
        }
    };
    
    const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);
    
    const { assetsInStock, clientsWithAssets, assetsByModel } = useMemo(() => {
        const activeAssets = assets.filter(a => a.status !== 'returned');

        const inStockGrouped = activeAssets
            .filter(a => !a.clientId)
            .filter(a => {
                if (!stockSearchTerm) return true;
                const search = normalizeString(stockSearchTerm);
                return (
                    normalizeString(a.model).includes(search) ||
                    normalizeString(a.serial).includes(search) ||
                    normalizeString(a.description || "").includes(search)
                );
            })
            .reduce((acc, asset) => {
                const key = asset.model;
                if (!acc[key]) {
                    acc[key] = {
                        ...asset,
                        id: key,
                        quantity: 0,
                        allAssetsInGroup: []
                    };
                }
                acc[key].quantity! += 1;
                acc[key].allAssetsInGroup.push(asset);
                return acc;
            }, {} as Record<string, ComodatoAsset & { quantity: number; allAssetsInGroup: ComodatoAsset[] }>);

        const cwa = clients
            .map(client => ({
                ...client,
                assetCount: assetsByClient.get(client.id)?.length || 0,
            }))
            .filter(client => {
                if (!searchTerm) return true;
                const search = normalizeString(searchTerm);
                return (
                    normalizeString(client.name).includes(search) ||
                    normalizeString(client.document || "").includes(search)
                );
            })
            .sort((a,b) => a.name.localeCompare(b.name));

        const byModel = new Map<string, number>();
        activeAssets
            .filter(a => {
                if (!dashboardSearchTerm) return true;
                const search = normalizeString(dashboardSearchTerm);
                return (
                    normalizeString(a.model).includes(search) ||
                    normalizeString(a.description || "").includes(search)
                );
            })
            .forEach(asset => {
                const currentCount = byModel.get(asset.model) || 0;
                byModel.set(asset.model, currentCount + 1);
            });

        const assetsByModelArray = Array.from(byModel, ([model, quantity]) => ({ model, quantity }))
            .sort((a,b) => a.model.localeCompare(b.model));

        return {
            assetsInStock: Object.values(inStockGrouped),
            clientsWithAssets: cwa,
            assetsByModel: assetsByModelArray,
        };
    }, [assets, searchTerm, stockSearchTerm, dashboardSearchTerm, clients, assetsByClient]);

    const paginatedAssetsByModel = useMemo(() => {
        const startIndex = (currentPageDashboard - 1) * pageSizeDashboard;
        return assetsByModel.slice(startIndex, startIndex + pageSizeDashboard);
    }, [assetsByModel, currentPageDashboard, pageSizeDashboard]);

    const dashboardTotalPages = Math.ceil(assetsByModel.length / pageSizeDashboard);

    useEffect(() => {
        setCurrentPageDashboard(1);
    }, [assetsByModel.length]);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    const SortableProposalHeader = ({ sortKey, children, className }: { sortKey: keyof Quote | 'comodatoMonthlyFee', children: React.ReactNode, className?: string }) => {
        const requestSort = () => {
            let direction: 'asc' | 'desc' = 'asc';
            if (proposalSortConfig && proposalSortConfig.key === sortKey && proposalSortConfig.direction === 'asc') {
                direction = 'desc';
            }
            setProposalSortConfig({ key: sortKey, direction });
        };
    
        const getSortIndicator = () => {
            if (!proposalSortConfig || proposalSortConfig.key !== sortKey) {
                return <ArrowUpDown className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-50" />;
            }
            return proposalSortConfig.direction === 'asc' ? <ArrowUpDown className="ml-2 h-3 w-3 rotate-180" /> : <ArrowUpDown className="ml-2 h-3 w-3" />;
        };
        
        return (
            <TableHead className={cn("group cursor-pointer", className)} onClick={requestSort}>
                <div className="flex items-center">{children}{getSortIndicator()}</div>
            </TableHead>
        );
    };
    
    const renderClientAssetsView = () => {
        if (!selectedClient) return null;
        const clientAssets = assetsByClient.get(selectedClient.id) || [];
        const totalMonthlyRevenue = clientAssets.reduce((sum, asset) => sum + (asset.monthlyFee || 0), 0);

        return (
            <div className="flex flex-col h-full space-y-6">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-semibold tracking-tighter flex items-center gap-3 text-xl">
                            <div className="p-2 rounded-2xl bg-primary/10 text-primary shadow-premium">
                                <Users className="h-6 w-6" />
                            </div>
                            Gestão de Ativos: <span className="text-primary">{formatTitleCase(selectedClient.name)}</span>
                        </h1>
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <ClientAssetsView
                        client={selectedClient}
                        assets={clientAssets}
                        onEditAsset={handleEditAsset}
                        onUnlinkAsset={handleUnlinkAsset}
                        statusConfig={statusConfig as any}
                        totalMonthlyRevenue={totalMonthlyRevenue}
                        onAddAsset={() => handleAddNewAsset(selectedClient.id)}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700 bg-background/5 no-scrollbar">
            <header className="flex flex-col gap-2 px-6 pt-2 pb-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        {selectedClientId ? (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setSelectedClientId(null)}
                                className="h-10 w-10 bg-primary/10 rounded-2xl shadow-inner hover:bg-primary/20 transition-all group border-none"
                                title="Voltar para visão geral"
                            >
                                <ArrowLeft className="h-6 w-6 text-primary group-hover:-translate-x-1 transition-transform" />
                            </Button>
                        ) : (
                            <div className="h-10 w-10 p-2 bg-primary/10 rounded-2xl shadow-inner flex items-center justify-center">
                                <Landmark className="text-primary h-6 w-6" />
                            </div>
                        )}
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                {company?.name && (
                                    <span className="text-xl font-bold tracking-tighter text-foreground">{company.name}</span>
                                )}
                                {company?.name && <span className="h-4 w-px bg-primary/20 mx-1" />}
                                <h1 className="text-xl font-semibold tracking-tighter text-foreground text-primary">Central de Comodato</h1>
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90">Contratos e Gestão de Ativos</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="px-6 pb-24 space-y-2 max-w-[1600px] mx-auto w-full">
                {selectedClientId ? renderClientAssetsView() : (
                    <div className="space-y-2">

                        <Tabs defaultValue="dashboard" className="w-full space-y-4">
                            <div className="sticky top-0 z-20 pb-4 bg-background/5 backdrop-blur-md -mx-4 px-4 overflow-x-auto no-scrollbar">
                                <TabsList className="bg-background/40 border border-border/40 p-1 rounded-xl sm:rounded-2xl h-10 sm:h-12 shadow-premium backdrop-blur-xl inline-flex w-max min-w-full items-center justify-start sm:justify-center">
                                    <TabsTrigger value="dashboard" className="rounded-lg sm:rounded-xl px-4 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-[10px] sm:text-xs uppercase tracking-normal sm:tracking-widest gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap focus:outline-none sm:flex-1">
                                        <Activity className="h-3 w-3 sm:h-4 w-4" /> Dashboard
                                    </TabsTrigger>
                                    <TabsTrigger value="clientes" className="rounded-lg sm:rounded-xl px-4 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-[10px] sm:text-xs uppercase tracking-normal sm:tracking-widest gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap focus:outline-none sm:flex-1">
                                        <Users className="h-3 w-3 sm:h-4 w-4" /> Clientes
                                    </TabsTrigger>
                                    <TabsTrigger value="estoque" className="rounded-lg sm:rounded-xl px-4 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-[10px] sm:text-xs uppercase tracking-normal sm:tracking-widest gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap focus:outline-none sm:flex-1">
                                        <Package className="h-3 w-3 sm:h-4 w-4" /> Estoque
                                    </TabsTrigger>
                                    <TabsTrigger value="propostas" className="rounded-lg sm:rounded-xl px-4 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-[10px] sm:text-xs uppercase tracking-normal sm:tracking-widest gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap focus:outline-none sm:flex-1">
                                        <ClipboardList className="h-3 w-3 sm:h-4 w-4" /> Contratos
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <AnimatePresence mode="wait">
                                <TabsContent key="dashboard" value="dashboard" className="mt-0 border-none p-0 focus-visible:ring-0 w-full min-w-0">
                                    <motion.div
                                        key="dashboard-motion"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="pt-0 space-y-4"
                                    >
                                        <ComodatoStatsCards stats={stats} />
                                        
                                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                             <Card className="xl:col-span-2 border-border/40 bg-background/40 backdrop-blur-3xl shadow-premium rounded-2xl overflow-hidden border-none flex flex-col transition-all duration-700">
                                                <CardHeader className="p-2 sm:px-4 sm:py-2 border-b border-border/40 bg-primary/[0.03]">
                                                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div className="flex flex-col">
                                                            <CardTitle className="text-sm sm:text-base font-semibold tracking-tighter text-foreground flex items-center gap-2">
                                                                <div className="p-1 rounded-lg bg-primary/10 text-primary">
                                                                    <TrendingUp className="h-4 w-4" />
                                                                </div>
                                                                Inventário por Modelo
                                                            </CardTitle>
                                                            <CardDescription className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wider leading-none">Consolidado total de ativos registrados no sistema.</CardDescription>
                                                        </div>
                                                        <div className="relative w-full sm:w-64 group">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-all" />
                                                            <Input
                                                                type="search"
                                                                placeholder="Filtrar modelos..."
                                                                className="w-full rounded-xl bg-background/40 border-border/40 pl-9 h-8 text-[11px] font-semibold shadow-sm focus-visible:ring-primary/20"
                                                                value={dashboardSearchTerm}
                                                                onChange={(e) => setDashboardSearchTerm(e.target.value)}
                                                            />
                                                        </div>
                                                   </div>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableHeader className="bg-primary/[0.02] h-[32px]">
                                                            <TableRow className="hover:bg-transparent border-border/40 h-[32px]">
                                                                <TableHead className="pl-4 sm:pl-8 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] leading-none">Produto / Modelo</TableHead>
                                                                <TableHead className="pr-4 sm:pr-8 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] leading-none">Qtd. Total</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {paginatedAssetsByModel.map((item) => (
                                                                <TableRow key={item.model} className="border-border/40 transition-colors group h-[32px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                                                    <TableCell className="pl-4 sm:pl-8 py-0 font-medium text-xs text-foreground group-hover:text-primary transition-colors leading-none">{item.model}</TableCell>
                                                                    <TableCell className="pr-4 sm:pr-8 py-0 text-right leading-none">
                                                                        <Badge variant="secondary" className="px-2 h-5 rounded-lg font-bold text-[8px] shadow-sm bg-primary/10 text-primary border-none leading-none">
                                                                            {item.quantity} un.
                                                                        </Badge>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                            {assetsByModel.length === 0 && (
                                                                <TableRow>
                                                                    <TableCell colSpan={2} className="py-0 h-48 text-center opacity-50 leading-none">
                                                                        <div className="flex flex-col items-center justify-center gap-2 leading-none">
                                                                            <Package className="h-6 w-6 text-muted-foreground opacity-50" />
                                                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Vazio</p>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                                {/* Dashboard Pagination Control */}
                                                <div className="p-4 border-t border-border/40 bg-primary/[0.01] flex items-center justify-between px-8 bg-background/20 backdrop-blur-3xl rounded-b-2xl">
                                                   <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
                                                       {assetsByModel.length > 0 ? (currentPageDashboard - 1) * pageSizeDashboard + 1 : 0} - {Math.min(currentPageDashboard * pageSizeDashboard, assetsByModel.length)} de {assetsByModel.length}
                                                   </div>
                                                   <div className="flex items-center gap-2">
                                                       <Button
                                                           variant="ghost"
                                                           size="icon"
                                                           className="h-10 w-10 rounded-xl hover:bg-primary/10 active:scale-90 transition-all"
                                                           onClick={(e) => { e.stopPropagation(); setCurrentPageDashboard(p => Math.max(1, p - 1)); }}
                                                           disabled={currentPageDashboard === 1}
                                                       >
                                                           <ChevronLeft className="h-5 w-5" />
                                                       </Button>
                                                       <div className="text-[10px] font-semibold uppercase tracking-widest px-4 opacity-80 min-w-[60px] text-center">
                                                           {currentPageDashboard} / {dashboardTotalPages || 1}
                                                       </div>
                                                       <Button
                                                           variant="ghost"
                                                           size="icon"
                                                           className="h-10 w-10 rounded-xl hover:bg-primary/10 active:scale-90 transition-all"
                                                           onClick={(e) => { e.stopPropagation(); setCurrentPageDashboard(p => Math.min(dashboardTotalPages, p + 1)); }}
                                                           disabled={currentPageDashboard >= dashboardTotalPages}
                                                       >
                                                           <ChevronRight className="h-5 w-5" />
                                                       </Button>
                                                   </div>
                                                </div>
                                            </Card>

                                            <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-premium rounded-2xl overflow-hidden border">
                                                <CardHeader className="p-8 border-b border-border/40 bg-primary/[0.01]">
                                                    <CardTitle className="font-semibold tracking-tighter flex items-center gap-3 text-primary text-xl">
                                                        <div className="p-2 rounded-xl bg-primary/10">
                                                            <Zap className="h-5 w-5" />
                                                        </div>
                                                        Sumário Executivo
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-8 space-y-8">
                                                    <div className="p-6 rounded-xl bg-primary/5 border border-border/40 shadow-inner">
                                                        <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-primary/40 mb-2">Receita Mensal Projetada</p>
                                                        <p className="text-lg sm:text-2xl font-bold tracking-tighter text-foreground tabular-nums">{formatCurrency(stats.monthlyRevenue)}</p>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center p-4 rounded-2xl bg-amber-500/[0.03] border border-amber-500/5">
                                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Instalações Pendentes</span>
                                                            <span className="font-bold text-sm text-amber-600 bg-amber-500/10 px-3 py-1 rounded-lg tabular-nums">{stats.pendingInstall}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center p-4 rounded-2xl bg-rose-500/[0.03] border border-rose-500/5">
                                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Ativos em Manutenção</span>
                                                            <span className="font-bold text-sm text-rose-600 bg-rose-500/10 px-3 py-1 rounded-lg tabular-nums">{stats.inMaintenance}</span>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </motion.div>
                                </TabsContent>

                                <TabsContent key="clientes" value="clientes" className="mt-0 border-none p-0 focus-visible:ring-0 w-full min-w-0">
                                    <motion.div
                                        key="clientes-motion"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="pt-0 space-y-2"
                                    >
                                        <ClientPortfolioTable
                                            title={`Carteira de Clientes (${clientsWithAssets.length})`}
                                            description="Gestão detalhada de contratos e equipamentos instalados."
                                            isLoading={isLoading}
                                            clients={clientsWithAssets}
                                            onClientClick={(clientId) => setSelectedClientId(clientId)}
                                            statusConfig={statusConfig as any}
                                            searchTerm={searchTerm}
                                            onSearchChange={setSearchTerm}
                                            onBatchReajuste={() => setIsBatchDialogOpen(true)}
                                        />
                                    </motion.div>
                                </TabsContent>

                                <TabsContent key="estoque" value="estoque" className="mt-0 border-none p-0 focus-visible:ring-0 w-full min-w-0">
                                    <motion.div
                                        key="estoque-motion"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="pt-0 space-y-2"
                                    >
                                        <AssetList
                                            title={`Painel de Inventário (${assetsInStock.reduce((sum, item) => sum + (item as any).quantity, 0)})`}
                                            description="Ativos disponíveis em estoque físico para novas implantações."
                                            isLoading={isLoading}
                                            assets={assetsInStock}
                                            totalCount={assetsInStock.length}
                                            clients={clients}
                                            products={products}
                                            onEditAsset={handleEditAsset}
                                            onDeleteAsset={confirmDeleteAsset}
                                            statusConfig={statusConfig as any}
                                            searchTerm={stockSearchTerm}
                                            onSearchChange={setStockSearchTerm}
                                            onAddAsset={handleAddNewAsset}
                                        />
                                    </motion.div>
                                </TabsContent>

                                        <TabsContent key="propostas" value="propostas" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                                            <motion.div
                                                key="propostas-motion"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6 pt-2"
                                            >
                                                <Card className="overflow-hidden border-border/40 rounded-2xl bg-background/50 backdrop-blur-3xl shadow-premium transition-all duration-500">
                                                    <CardHeader className="p-2 sm:px-4 sm:py-2 border-b border-border/40 bg-primary/[0.03]">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                            <div className="flex flex-col">
                                                                <CardTitle className="text-sm sm:text-base font-semibold tracking-tighter text-foreground flex items-center gap-2">
                                                                    <div className="p-1 rounded-lg bg-primary/10 text-primary">
                                                                        <ClipboardList className="h-4 w-4" />
                                                                    </div>
                                                                    Gestão de Contratos
                                                                </CardTitle>
                                                                <CardDescription className="text-[8px] sm:text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest leading-none">Controle documental e status de faturamento</CardDescription>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                                                                <div className="relative w-full sm:w-64 group">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-all" />
                                                                    <Input
                                                                        type="search"
                                                                        placeholder="Filtrar por nº ou cliente..."
                                                                        className="w-full rounded-xl bg-background/40 border-border/40 pl-9 h-8 text-[11px] font-semibold shadow-sm focus-visible:ring-primary/20"
                                                                        value={proposalSearchTerm}
                                                                        onChange={(e) => setProposalSearchTerm(e.target.value)}
                                                                    />
                                                                </div>
                                                                <Button 
                                                                    onClick={() => router.push('/comodato/proposta')}
                                                                    className="h-8 rounded-xl font-semibold text-[10px] uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm w-full sm:w-auto"
                                                                >
                                                                    <PlusCircle className="h-3 w-3 mr-1" />
                                                                    Nova Proposta
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-0">
                                                        <Table>
                                                <TableHeader className="bg-primary/[0.02] h-[32px]">
                                                    <TableRow className="hover:bg-transparent border-border/40 h-[32px]">
                                                        <SortableProposalHeader sortKey="quoteNumber" className="pl-4 sm:pl-8 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[32px] leading-none">ID</SortableProposalHeader>
                                                        <SortableProposalHeader sortKey="clientName" className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[32px] leading-none">Entidade</SortableProposalHeader>
                                                        <SortableProposalHeader sortKey="date" className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[32px] leading-none">Emissão</SortableProposalHeader>
                                                        <SortableProposalHeader sortKey="status" className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[32px] leading-none">Status</SortableProposalHeader>
                                                        <SortableProposalHeader sortKey="contractStatus" className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[32px] text-center leading-none">Fidelidade</SortableProposalHeader>
                                                        <SortableProposalHeader sortKey="comodatoMonthlyFee" className="px-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[32px] leading-none">Valor</SortableProposalHeader>
                                                        <TableHead className="pr-4 sm:pr-8 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[32px] leading-none">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {paginatedProposals.map((proposal) => (
                                                        <TableRow key={proposal.id} onClick={() => router.push(`/orcamentos/details/${proposal.id}`)} className="cursor-pointer hover:bg-primary/10 transition-all border-border/40 group h-[32px] even:bg-blue-50 dark:even:bg-blue-900/30">
                                                            <TableCell className="pl-4 sm:pl-8 py-0 font-mono font-semibold text-xs text-primary/40 group-hover:text-primary transition-colors leading-none">{proposal.quoteNumber}</TableCell>
                                                            <TableCell className="py-0 px-4 font-medium text-xs tracking-tight truncate max-w-[250px] group-hover:text-primary transition-all duration-300 leading-none">{formatTitleCase(proposal.clientName)}</TableCell>
                                                            <TableCell className="py-0 px-4 text-xs font-semibold text-muted-foreground uppercase leading-none">{formatDate(proposal.date)}</TableCell>
                                                            <TableCell className="py-0 px-4 leading-none">
                                                                <Badge 
                                                                    className={cn(
                                                                        "rounded-full px-2 h-5 font-bold text-xs uppercase tracking-widest border-0 leading-none",
                                                                        (statusConfig[proposal.status]?.variant === 'success' || (proposal.status as any) === 'Finalizada') && "bg-emerald-500/10 text-emerald-600",
                                                                        (statusConfig[proposal.status]?.variant === 'warning' || (proposal.status as any) === 'Solicitada') && "bg-amber-500/10 text-amber-600",
                                                                        (statusConfig[proposal.status]?.variant === 'destructive' || (proposal.status as any) === 'Cancelada') && "bg-rose-500/10 text-rose-600",
                                                                        statusConfig[proposal.status]?.variant === 'secondary' && "bg-stone-500/10 text-stone-600",
                                                                        statusConfig[proposal.status]?.variant === 'default' && "bg-primary/10 text-primary"
                                                                    )}
                                                                >
                                                                    {statusConfig[proposal.status]?.label}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="py-0 px-4 text-center leading-none">
                                                                {proposal.contractStatus && (
                                                                    <Badge 
                                                                        className={cn(
                                                                            "rounded-full px-2 h-5 font-bold text-xs uppercase tracking-widest border-0 leading-none",
                                                                            proposal.contractStatus === 'ativo' && "bg-emerald-500/10 text-emerald-600",
                                                                            proposal.contractStatus === 'suspenso' && "bg-amber-500/10 text-amber-600",
                                                                            proposal.contractStatus === 'encerrado' && "bg-rose-500/10 text-rose-600"
                                                                        )}
                                                                    >
                                                                        {contractStatusConfig[proposal.contractStatus]?.label}
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="py-0 px-4 text-right font-semibold text-xs text-emerald-600 tracking-tighter leading-none">{formatCurrency(proposal.comodatoMonthlyFee || 0)}</TableCell>
                                                            <TableCell className="py-0 pr-4 sm:pr-8 text-right leading-none">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-primary/10 rounded-md active:scale-95 transition-all" onClick={(e) => e.stopPropagation()}>
                                                                            <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-56 rounded-[1.5rem] p-2 border-border/40 shadow-premium backdrop-blur-3xl bg-background/90 font-semibold text-[10px] uppercase tracking-widest">
                                                                        <DropdownMenuItem className="rounded-xl px-4 py-3 focus:bg-primary/5 gap-3" onClick={(e) => {e.stopPropagation(); router.push(`/orcamentos/details/${proposal.id}`)}}>
                                                                            <LayoutDashboard className="h-4 w-4 opacity-70" /> Ver proposta
                                                                        </DropdownMenuItem>
                                                                        {proposal.contractUrl && (
                                                                            <DropdownMenuItem asChild onClick={(e) => e.stopPropagation()} className="rounded-xl px-4 py-3 focus:bg-primary/5 gap-3">
                                                                                <Link href={proposal.contractUrl} target="_blank" rel="noopener noreferrer">
                                                                                    <FileText className="h-4 w-4 opacity-70" /> Baixar contrato
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        <DropdownMenuItem className="rounded-xl px-4 py-3 focus:bg-primary/5 gap-3" onClick={(e) => {e.stopPropagation(); router.push(`/comodato/proposta?id=${proposal.id}`)}}>
                                                                            <Edit className="h-4 w-4 opacity-70" /> Editar proposta
                                                                        </DropdownMenuItem>
                                                                        <div className="h-px bg-primary/5 my-2 mx-2" />
                                                                        <DropdownMenuSub>
                                                                            <DropdownMenuSubTrigger className="rounded-xl px-4 py-3 focus:bg-primary/5 gap-3">
                                                                                <Activity className="h-4 w-4 opacity-70" /> Status Vigência
                                                                            </DropdownMenuSubTrigger>
                                                                            <DropdownMenuPortal>
                                                                                <DropdownMenuSubContent className="rounded-2xl p-2 border-border/40 shadow-premium backdrop-blur-3xl bg-background/90 font-semibold text-[10px] uppercase tracking-widest min-w-[150px]">
                                                                                    <DropdownMenuItem className="rounded-xl px-4 py-2 text-emerald-600 focus:bg-emerald-50" onClick={(e) => { e.stopPropagation(); handleUpdateContractStatus(proposal.id, 'ativo'); }}>Ativo / Vigente</DropdownMenuItem>
                                                                                    <DropdownMenuItem className="rounded-xl px-4 py-2 text-amber-600 focus:bg-amber-50" onClick={(e) => { e.stopPropagation(); handleUpdateContractStatus(proposal.id, 'suspenso'); }}>Suspenso</DropdownMenuItem>
                                                                                    <DropdownMenuItem className="rounded-xl px-4 py-2 text-rose-600 focus:bg-rose-50" onClick={(e) => { e.stopPropagation(); handleUpdateContractStatus(proposal.id, 'encerrado'); }}>Encerrado</DropdownMenuItem>
                                                                                </DropdownMenuSubContent>
                                                                            </DropdownMenuPortal>
                                                                        </DropdownMenuSub>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {comodatoProposals.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="py-0 text-center h-60 opacity-30">
                                                                <div className="flex flex-col items-center justify-center gap-4">
                                                                    <div className="p-4 rounded-full bg-primary/5">
                                                                        <ClipboardList className="h-10 w-10 text-primary" />
                                                                    </div>
                                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em]">Nenhum registro encontrado</p>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>

                                                {/* Proposals Pagination Control */}
                                                <div className="flex items-center justify-between px-6 py-4 bg-background/20 backdrop-blur-3xl rounded-xl border border-border/40 shadow-premium">
                                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
                                                        {comodatoProposals.length > 0 ? (currentPageProposals - 1) * pageSizeProposals + 1 : 0} - {Math.min(currentPageProposals * pageSizeProposals, comodatoProposals.length)} de {comodatoProposals.length} registros
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 rounded-2xl hover:bg-primary/10 transition-all"
                                                            onClick={(e) => { e.stopPropagation(); setCurrentPageProposals(p => Math.max(1, p - 1)); }}
                                                            disabled={currentPageProposals === 1}
                                                        >
                                                            <ChevronLeft className="h-5 w-5" />
                                                        </Button>
                                                        <div className="text-xs font-semibold uppercase tracking-widest px-2 opacity-80">
                                                            {currentPageProposals} / {proposalsTotalPages || 1}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 rounded-2xl hover:bg-primary/10 transition-all"
                                                            onClick={(e) => { e.stopPropagation(); setCurrentPageProposals(p => Math.min(proposalsTotalPages, p + 1)); }}
                                                            disabled={currentPageProposals >= proposalsTotalPages}
                                                        >
                                                            <ChevronRight className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </TabsContent>
                            </AnimatePresence>
                        </Tabs>
                    </div>
                )}
            </div>

             <AddEditAssetDialog
                isOpen={isDialogOpen}
                setOpen={setDialogOpen}
                onAssetSaved={onAssetSaved}
                onBulkAssetSaved={onBulkAssetSaved}
                asset={editingAsset}
                clients={clients}
                products={products}
                preselectedClientId={selectedClientId || undefined}
            />

            {/* Diálogo de Reajuste em Lote */}
            <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
                <DialogContent className="w-[95vw] max-w-lg bg-background/60 backdrop-blur-3xl border-border/40 shadow-premium rounded-xl sm:rounded-xl p-6 sm:p-10 overflow-hidden">
                    <DialogHeader className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2 sm:p-3 bg-primary/10 rounded-xl sm:rounded-2xl shadow-inner text-primary">
                                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl sm:text-3xl font-semibold tracking-tighter text-foreground">
                                    Reajuste em Lote
                                </DialogTitle>

                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="space-y-6 sm:space-y-8 pt-4 sm:pt-6">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-xl bg-primary/[0.02] border border-border/40 shadow-inner">
                            <div className="flex flex-col gap-1">
                                <p className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-widest text-primary/40 flex items-center gap-1.5 sm:gap-2">
                                    <Users className="h-3 w-3" /> Clientes Elegíveis
                                </p>
                                <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-foreground">{eligibleClientsCount}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <p className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-widest text-emerald-600/40 flex items-center gap-1.5 sm:gap-2">
                                    <CheckCircle2 className="h-3 w-3" /> Requisito
                                </p>
                                <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 leading-tight text-right uppercase tracking-tighter">Mínimo 12 meses de fidelidade</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1">Coeficiente de Atualização (%)</label>
                            <div className="relative group">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-primary/30 group-focus-within:text-primary transition-all font-semibold" />
                                <Input 
                                    type="number" 
                                    value={batchPercentage}
                                    onChange={(e) => setBatchPercentage(e.target.value)}
                                    className="h-12 sm:h-16 pl-10 sm:pl-12 pr-10 sm:pr-12 text-lg sm:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-background/50 border-border/40 shadow-inner focus:bg-background transition-all focus-visible:ring-primary/20"
                                    placeholder="0"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-semibold text-lg sm:text-xl text-primary/20">%</span>
                            </div>
                            <p className="text-[8px] sm:text-[10px] font-semibold text-muted-foreground/40 italic px-2">Clique em aplicar para atualizar o ticket médio de toda a base elegível simultaneamente.</p>
                        </div>
                    </div>

                    <DialogFooter className="mt-8 sm:mt-10 flex gap-3 sm:gap-4">
                        <Button variant="ghost" onClick={() => setIsBatchDialogOpen(false)} className="h-10 sm:h-12 px-4 sm:px-8 rounded-2xl font-semibold text-[10px] sm:text-xs uppercase tracking-widest bg-stone-100 dark:bg-stone-800/50 hover:bg-stone-200 dark:hover:bg-stone-800 transition-all flex-1 border border-stone-200 dark:border-stone-700">
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleBatchReajuste} 
                            disabled={isUpdatingBatch || eligibleClientsCount === 0}
                            className="h-10 sm:h-12 px-4 sm:px-10 rounded-2xl font-semibold text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-2 sm:gap-3 bg-primary flex-1"
                        >
                            {isUpdatingBatch ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />}
                            Lançar Reajuste
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita. O ativo será excluído permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAsset}>Confirmar Exclusão</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
