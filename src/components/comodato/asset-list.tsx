"use client";

import { Loader2, MoreHorizontal, Edit, Trash2, ArrowUpDown, Package, ChevronLeft, ChevronRight, Search, PlusCircle } from "lucide-react";
import type { ComodatoAsset, Client, Product } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMemo, useState, useEffect } from "react";
import { cn, formatTitleCase } from "@/lib/utils";

type StatusConfig = {
    [key: string]: { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' };
};

type AssetWithGroup = ComodatoAsset & { quantity?: number; allAssetsInGroup?: ComodatoAsset[] };

type SortKey = keyof ComodatoAsset | 'clientName' | 'assetCount' | 'quantity';

type AssetListProps = {
    title: string;
    description: string;
    isLoading: boolean;
    assets: AssetWithGroup[];
    totalCount: number;
    clients: Client[];
    products: Product[];
    onEditAsset?: (asset: ComodatoAsset) => void;
    onDeleteAsset?: (asset: ComodatoAsset) => void;
    onRowClick?: (asset: ComodatoAsset) => void;
    statusConfig: StatusConfig;
    searchTerm?: string;
    onSearchChange?: (value: string) => void;
    onAddAsset?: () => void;
};

export default function AssetList({
    title,
    description,
    isLoading,
    assets,
    totalCount,
    clients,
    onEditAsset,
    onDeleteAsset,
    onRowClick,
    statusConfig,
    searchTerm,
    onSearchChange,
    onAddAsset
}: AssetListProps) {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'model', direction: 'asc' });

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-50" />;
        }
        return sortConfig.direction === 'asc' ? <ArrowUpDown className="ml-2 h-3 w-3 rotate-180" /> : <ArrowUpDown className="ml-2 h-3 w-3" />;
    };

    const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
        <TableHead className={cn("group cursor-pointer text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] px-6", className)} onClick={() => requestSort(sortKey)}>
            <div className="flex items-center">{children}{getSortIndicator(sortKey)}</div>
        </TableHead>
    );

    const sortedAssets = useMemo(() => {
        let sortableItems = [...assets].filter(a => a.status !== 'returned');
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: any, bValue: any;

                if (sortConfig.key === 'clientName') {
                    aValue = a.clientId ? clientMap.get(a.clientId) || '' : '';
                    bValue = b.clientId ? clientMap.get(b.clientId) || '' : '';
                } else if (sortConfig.key === 'assetCount') {
                    aValue = (a as any).assetCount || 0;
                    bValue = (b as any).assetCount || 0;
                } else {
                    aValue = a[sortConfig.key as keyof ComodatoAsset];
                    bValue = b[sortConfig.key as keyof ComodatoAsset];
                }

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue, 'pt-BR') * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
                }

                return 0;
            });
        }

        return sortableItems;
    }, [assets, clientMap, sortConfig]);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    // Reset pagination when data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [assets.length]);

    const paginatedAssets = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return sortedAssets.slice(startIndex, startIndex + pageSize);
    }, [sortedAssets, currentPage, pageSize]);

    const totalPages = Math.ceil(sortedAssets.length / pageSize);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
        );
    }
    
    const isClientList = title.includes("Clientes");
    const isStockList = title.includes("Estoque");

    return (
        <div className="space-y-2">
            <Card className="border-border/40 bg-background/40 backdrop-blur-3xl shadow-premium rounded-2xl overflow-hidden flex flex-col transition-all duration-700 border-none">
                <CardHeader className="p-2 sm:px-4 sm:py-2 border-b border-border/40 bg-primary/[0.03]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-col">
                            <CardTitle className="text-sm sm:text-base font-semibold tracking-tighter text-foreground">{title}</CardTitle>
                            <CardDescription className="text-[8px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-widest leading-none">{description}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {onAddAsset && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 px-4 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-primary/5 transition-all gap-2 border-border/40 shadow-sm"
                                    onClick={onAddAsset}
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    Novo Ativo
                                </Button>
                            )}
                            {onSearchChange && (
                                <div className="relative w-full sm:w-64 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-all" />
                                    <Input
                                        type="search"
                                        placeholder="Escolha um ativo..."
                                        className="w-full rounded-xl bg-background/40 border-border/40 pl-9 h-8 text-[11px] font-semibold shadow-sm focus-visible:ring-primary/20"
                                        value={searchTerm || ''}
                                        onChange={(e) => onSearchChange(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-primary/[0.02] h-[32px]">
                            <TableRow className="hover:bg-transparent border-border/40 h-[32px]">
                                <SortableHeader sortKey={isClientList ? "clientName" : "model"} className="pl-4 sm:pl-8 text-[8px] sm:text-[10px] whitespace-nowrap h-[32px]">{isClientList ? 'Cliente' : 'Ativo'}</SortableHeader>
                                {isClientList && <SortableHeader sortKey="assetCount" className="text-right px-4 h-[32px] text-[10px]">Qtd.</SortableHeader>}
                                {isStockList && <SortableHeader sortKey="quantity" className="text-right px-4 h-[32px] text-[10px]">Qtd.</SortableHeader>}
                                {!isClientList && !isStockList && <SortableHeader sortKey="serial" className="px-4 text-[10px] hidden sm:table-cell h-[32px]">Nº Série</SortableHeader>}
                                {!isClientList && !isStockList && <SortableHeader sortKey="status" className="px-4 text-[10px] text-center h-[32px]">Status</SortableHeader>}
                                <TableHead className="pr-4 sm:pr-8 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] leading-none opacity-90">Gestão</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedAssets.map((asset) => {
                                const assetToActOn = asset.allAssetsInGroup ? asset.allAssetsInGroup[0] : asset;
                                
                                return (
                                 <TableRow 
                                     key={asset.id || asset.clientId} 
                                     className="group transition-all border-border/40 cursor-pointer h-[32px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30"
                                     onClick={() => onRowClick && onRowClick(assetToActOn)}
                                 >
                                     <TableCell className="pl-4 sm:pl-8 py-0">
                                         <div className="font-medium text-xs tracking-tight text-foreground group-hover:text-primary transition-colors truncate max-w-[150px] sm:max-w-none leading-none">
                                           {isClientList ? formatTitleCase(clientMap.get(asset.clientId!)) : asset.model}
                                         </div>
                                         {(asset.description && !isClientList) && (
                                             <div className="text-xs font-semibold text-muted-foreground mt-0.5 uppercase tracking-tighter leading-none">{asset.description}</div>
                                         )}
                                     </TableCell>
                                    <TableCell className="py-0 text-right px-4 leading-none">
                                        {(isClientList || isStockList) ? (
                                            <Badge variant="secondary" className="px-2 py-0.5 rounded-lg font-semibold text-xs shadow-sm bg-primary/10 text-primary border-none leading-none">
                                                {isClientList ? (asset as any).assetCount : asset.quantity} un.
                                            </Badge>
                                        ) : (
                                            <span className="font-mono text-xs font-semibold text-muted-foreground hidden sm:inline-block leading-none">{asset.serial}</span>
                                        )}
                                    </TableCell>
                                    {!isClientList && !isStockList && (
                                        <TableCell className="py-0 px-4 text-center leading-none">
                                            <Badge variant={statusConfig[asset.status]?.variant || 'secondary'} className="rounded-lg px-2 h-5 font-bold text-xs uppercase tracking-widest shadow-sm whitespace-nowrap leading-none">
                                                {statusConfig[asset.status]?.label || asset.status}
                                            </Badge>
                                        </TableCell>
                                    )}
                                    <TableCell className="py-0 text-right pr-4 sm:pr-8 leading-none">
                                       {(onEditAsset && onDeleteAsset) && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary/10 rounded-lg sm:rounded-full" onClick={e => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 border-border/40 shadow-premium backdrop-blur-xl bg-background/90">
                                                    <DropdownMenuItem className="rounded-xl px-4 py-2 font-semibold text-xs gap-2" onClick={(e) => { e.stopPropagation(); onEditAsset(assetToActOn); }}>
                                                        <Edit className="h-4 w-4 opacity-70" />
                                                        Editar Detalhes
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-xl px-4 py-2 font-semibold text-xs gap-2 text-rose-600 focus:text-rose-600" onClick={(e) => { e.stopPropagation(); onDeleteAsset(assetToActOn); }}>
                                                        <Trash2 className="h-4 w-4 opacity-70" />
                                                        Remover Ativo
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                       )}
                                    </TableCell>
                                 </TableRow>
                                );
                            })}
                            {sortedAssets.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={isClientList || isStockList ? 3 : 5} className="py-0 h-48 text-center opacity-50">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Package className="h-8 w-8 text-muted-foreground" />
                                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nenhum registro encontrado</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination Control */}
            <div className="flex items-center justify-between px-6 py-4 bg-background/20 backdrop-blur-3xl rounded-xl border border-border/40 shadow-premium">
                <div className="flex items-center gap-6">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-90">
                        {sortedAssets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, sortedAssets.length)} de {sortedAssets.length} registros
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-90">Itens:</Label>
                        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                            <SelectTrigger className="h-8 w-[80px] rounded-xl bg-background/50 border-border/40 font-semibold text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-background/80 backdrop-blur-3xl border-border/40">
                                <SelectItem value="15" className="font-semibold">15</SelectItem>
                                <SelectItem value="50" className="font-semibold">50</SelectItem>
                                <SelectItem value="100" className="font-semibold">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-primary/10"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="text-xs font-semibold uppercase tracking-widest px-2 opacity-80">
                        {currentPage} / {totalPages || 1}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-primary/10"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
