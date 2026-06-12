"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getClients, getQuotesOnce, getComodatoAssets, getProductsOnce } from '@/lib/firebase/firestore';
import type { Client, Quote, ComodatoAsset, Product } from '@/lib/data';
import { Briefcase, ShieldCheck, TrendingUp, TrendingDown, ChevronsUpDown, Search, BarChart3, Wallet, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseISO, differenceInMonths } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

type SortKey = 'clientName' | 'totalRevenue' | 'totalAssetValue' | 'totalMaintenanceCost' | 'netProfit' | 'paybackStatus';
type SortDirection = 'asc' | 'desc';

export default function RentabilidadeComodatoPage() {
    const { userProfile, firebase } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [assets, setAssets] = useState<ComodatoAsset[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'netProfit', direction: 'desc' });

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const companyId = userProfile.companyId;
            Promise.all([
                new Promise<Client[]>(res => getClients(firebase.db, companyId, res, console.error)),
                getQuotesOnce(firebase.db, companyId, userProfile),
                new Promise<ComodatoAsset[]>(res => getComodatoAssets(firebase.db, companyId, res, console.error)),
                getProductsOnce(firebase.db, companyId)
            ]).then(([clientsData, quotesData, assetsData, productsData]) => {
                setClients(clientsData.filter(c => c.isComodato));
                setQuotes(quotesData);
                setAssets(assetsData);
                setProducts(productsData);
            }).finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, [userProfile, firebase.db]);
    
    const analysisData = useMemo(() => {
        const productsMap = new Map(products.map(p => [p.item, p]));

        let data = clients.map(client => {
            const clientAssets = assets.filter(a => a.clientId === client.id);
            const totalAssetValue = clientAssets.reduce((sum, asset) => {
                 const product = productsMap.get(asset.description || '');
                 return sum + (product?.materialPrice || 0);
            }, 0);
            
            const maintenanceQuotes = quotes.filter(q => q.clientId === client.id && (q.osType === 'Manutenção de Comodato Corretiva' || q.osType === 'Manutenção de Comodato Preventiva'));
            const totalMaintenanceCost = maintenanceQuotes.reduce((sum, q) => sum + q.total, 0);

            const contractStartDate = client.creationDate ? parseISO(client.creationDate) : new Date();
            const monthsActive = differenceInMonths(new Date(), contractStartDate) + 1;
            const totalRevenue = (client.serviceValue || 0) * monthsActive;
            
            const netProfit = totalRevenue - totalAssetValue - totalMaintenanceCost;
            const paybackStatus = netProfit >= 0 ? "Retorno Atingido" : "Pendente";

            return {
                clientId: client.id,
                clientName: client.name,
                totalRevenue,
                totalAssetValue,
                totalMaintenanceCost,
                netProfit,
                paybackStatus,
            };
        });

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            data = data.filter(d => d.clientName.toLowerCase().includes(lowerSearch));
        }

        if (sortConfig) {
            data.sort((a, b) => {
                const aVal = (a as any)[sortConfig.key];
                const bVal = (b as any)[sortConfig.key];
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return aVal.localeCompare(bVal, 'pt-BR') * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                return (Number(aVal) - Number(bVal)) * (sortConfig.direction === 'asc' ? 1 : -1);
            });
        }
        return data;
    }, [clients, assets, quotes, products, sortConfig, searchTerm]);

    const totals = useMemo(() => {
        const totalNetProfit = analysisData.reduce((sum, item) => sum + item.netProfit, 0);
        const paybackReached = analysisData.filter(d => d.paybackStatus === 'Retorno Atingido').length;
        return { totalNetProfit, paybackReached };
    }, [analysisData]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
        <TableHead className={cn("cursor-pointer h-11 transition-colors hover:bg-primary/5", className)} onClick={() => requestSort(sortKey)}>
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest">
                {children}
                {sortConfig?.key === sortKey ? (
                    sortConfig.direction === 'asc' ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-primary" />
                ) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
            </div>
        </TableHead>
    );

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header com Busca */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="font-semibold tracking-tight flex items-center gap-2 text-xl">
                        <Wallet className="h-6 w-6 text-primary" />
                        Rentabilidade Comodato
                    </h1>
                    <p className="text-sm font-medium text-muted-foreground opacity-70">Análise financeira detalhada de contratos de ativos em comodato.</p>
                </div>
                
                <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                        placeholder="Filtrar por cliente..."
                        className="w-full bg-background/40 backdrop-blur-sm border-border/40 pl-9 h-10 text-xs font-medium focus:ring-primary/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                    <CardContent className="p-5 flex items-center justify-between relative">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Lucro Líquido Consolidado</p>
                            <p className={cn("text-2xl font-semibold", totals.totalNetProfit >= 0 ? "text-emerald-500" : "text-destructive")}>
                                {formatCurrency(totals.totalNetProfit)}
                            </p>
                        </div>
                        <div className={cn(
                            "h-12 w-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform",
                            totals.totalNetProfit >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                        )}>
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                    <CardContent className="p-5 flex items-center justify-between relative">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Contratos com Payback</p>
                            <p className="text-2xl font-semibold text-primary font-mono">{totals.paybackReached} <span className="text-sm font-medium text-muted-foreground">contratos</span></p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/40 bg-background/40 backdrop-blur-md shadow-xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-primary/5 h-[34px]">
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <SortableHeader sortKey="clientName" className="pl-6">Cliente</SortableHeader>
                                    <SortableHeader sortKey="totalRevenue" className="text-right">Receita Total</SortableHeader>
                                    <SortableHeader sortKey="totalAssetValue" className="text-right">Custo Ativos</SortableHeader>
                                    <SortableHeader sortKey="totalMaintenanceCost" className="text-right">Manutenção</SortableHeader>
                                    <SortableHeader sortKey="netProfit" className="text-right">Lucro Líquido</SortableHeader>
                                    <SortableHeader sortKey="paybackStatus" className="text-center pr-6">Status</SortableHeader>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analysisData.map((data, index) => (
                                    <TableRow key={data.clientId} className="group border-border/40 transition-all h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                        <TableCell className="py-0 pl-6 text-[13px] font-semibold group-hover:text-primary transition-colors">
                                            {data.clientName}
                                        </TableCell>
                                        <TableCell className="py-0 text-right text-xs font-semibold font-mono opacity-80">
                                            {formatCurrency(data.totalRevenue)}
                                        </TableCell>
                                        <TableCell className="py-0 text-right text-xs font-medium text-muted-foreground/60 line-through decoration-destructive/20">
                                            {formatCurrency(data.totalAssetValue)}
                                        </TableCell>
                                        <TableCell className="py-0 text-right text-xs font-medium text-muted-foreground/60">
                                            {formatCurrency(data.totalMaintenanceCost)}
                                        </TableCell>
                                        <TableCell className={cn(
                                            "py-3 text-right text-xs font-semibold transition-all group-hover:scale-105 origin-right",
                                            data.netProfit >= 0 ? "text-emerald-500" : "text-destructive"
                                        )}>
                                            <div className="flex items-center justify-end gap-1.5">
                                                {data.netProfit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                {formatCurrency(data.netProfit)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 text-center pr-6">
                                            <Badge 
                                                variant="outline"
                                                className={cn(
                                                    "text-[9px] uppercase font-semibold px-2 py-0.5 border-none",
                                                    data.paybackStatus === 'Retorno Atingido' 
                                                        ? "bg-emerald-500/10 text-emerald-600" 
                                                        : "bg-orange-500/10 text-orange-600"
                                                )}
                                            >
                                                {data.paybackStatus}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {analysisData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-0 h-48 text-center text-muted-foreground italic opacity-50">
                                            Nenhum contrato de comodato encontrado para análise.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
