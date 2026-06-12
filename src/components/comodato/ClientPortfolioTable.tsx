"use client";

import { useMemo, useState, useEffect } from "react";
import { 
    Loader2, 
    MoreHorizontal, 
    Edit, 
    ArrowUpDown, 
    Users, 
    Calendar, 
    DollarSign, 
    Activity, 
    ClipboardList,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Search,
    RefreshCcw
} from "lucide-react";
import type { Client, ComodatoAsset } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn, formatTitleCase } from "@/lib/utils";
import { format, parseISO, addMonths, isValid, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusConfig = {
    [key: string]: { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' };
};

type ClientPortfolioTableProps = {
    title: string;
    description: string;
    isLoading: boolean;
    clients: (Client & { assetCount: number })[];
    onClientClick: (clientId: string) => void;
    statusConfig: StatusConfig;
    searchTerm?: string;
    onSearchChange?: (value: string) => void;
    onBatchReajuste?: () => void;
};

type SortKey = 'name' | 'comodatoStartDate' | 'paymentDay' | 'serviceValue' | 'nextPreventive' | 'comodatoStatus';

export default function ClientPortfolioTable({
    title,
    description,
    isLoading,
    clients,
    onClientClick,
    statusConfig,
    searchTerm,
    onSearchChange,
    onBatchReajuste
}: ClientPortfolioTableProps) {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    // Reset pagination when data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [clients.length]);

    const formatCurrency = (amount: number) => 
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-";
        const date = parseISO(dateString);
        return isValid(date) ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "-";
    };

    const calculateNextPreventive = (client: Client) => {
        const baseDateString = client.lastPreventiveMaintenanceDate || client.comodatoStartDate;
        if (!baseDateString || !client.preventiveMaintenanceFrequency) return null;

        const baseDate = parseISO(baseDateString);
        if (!isValid(baseDate)) return null;

        return addMonths(baseDate, client.preventiveMaintenanceFrequency);
    };

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedClients = useMemo(() => {
        let sortableItems = [...clients];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: any, bValue: any;

                if (sortConfig.key === 'nextPreventive') {
                    aValue = calculateNextPreventive(a)?.getTime() || 0;
                    bValue = calculateNextPreventive(b)?.getTime() || 0;
                } else {
                    aValue = a[sortConfig.key as keyof Client];
                    bValue = b[sortConfig.key as keyof Client];
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
    }, [clients, sortConfig]);

    const paginatedClients = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return sortedClients.slice(startIndex, startIndex + pageSize);
    }, [sortedClients, currentPage, pageSize]);

    const totalPages = Math.ceil(sortedClients.length / pageSize);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
        );
    }

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
                            {onBatchReajuste && (
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 px-3 rounded-xl font-semibold text-[9px] uppercase tracking-widest hover:bg-black/5 transition-all gap-2 shrink-0 border border-border/40"
                                    onClick={onBatchReajuste}
                                >
                                    <RefreshCcw className="h-3 w-3 text-primary" />
                                    <span className="hidden xs:inline">Reajuste em Lote</span>
                                    <span className="xs:hidden">Reajuste</span>
                                </Button>
                            )}
                            {onSearchChange && (
                                <div className="relative w-full sm:w-64 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-all" />
                                    <Input
                                        type="search"
                                        placeholder="Escolha um cliente..."
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
                                <TableHead className="pl-4 sm:pl-8 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] whitespace-nowrap leading-none" onClick={() => requestSort('name')}>
                                    <div className="flex items-center gap-1 cursor-pointer group leading-none">
                                        Cliente {sortConfig?.key === 'name' && <ArrowUpDown className="h-3 w-3" />}
                                    </div>
                                </TableHead>
                                <TableHead className="px-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] whitespace-nowrap leading-none">Início</TableHead>
                                <TableHead className="px-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] text-center whitespace-nowrap leading-none">PGTO</TableHead>
                                <TableHead className="px-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] whitespace-nowrap leading-none">Mensalidade</TableHead>
                                <TableHead className="px-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] whitespace-nowrap leading-none">Preventiva</TableHead>
                                <TableHead className="px-4 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] whitespace-nowrap text-center leading-none">Status</TableHead>
                                <TableHead className="pr-4 sm:pr-8 text-right text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 h-[32px] leading-none">Gestão</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedClients.map((client) => {
                                const nextPreventive = calculateNextPreventive(client);
                                const isPreventiveOverdue = nextPreventive && isPast(nextPreventive);

                                return (
                                    <TableRow 
                                        key={client.id} 
                                        className="group border-border/40 cursor-pointer h-[32px] transition-all hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30"
                                        onClick={() => onClientClick(client.id)}
                                    >
                                        <TableCell className="pl-4 sm:pl-8 py-0 leading-none">
                                            <div className="flex items-center gap-1 leading-none">
                                                <span className="font-medium text-xs text-foreground group-hover:text-primary transition-colors truncate max-w-[120px] sm:max-w-[200px] leading-none">{formatTitleCase(client.name)}</span>
                                                <Badge variant="outline" className="text-xs font-bold px-1 py-0 h-4 border-border/40 bg-primary/5 text-primary/60 whitespace-nowrap leading-none">
                                                    {client.assetCount}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-0 text-xs font-semibold text-muted-foreground/60 tracking-tight whitespace-nowrap">
                                            {formatDate(client.comodatoStartDate)}
                                        </TableCell>
                                        <TableCell className="px-4 py-0 text-center">
                                            <span className="text-xs font-bold text-primary/90">
                                                {client.paymentDay || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-0">
                                            <span className="text-xs font-bold text-emerald-600 tracking-tighter whitespace-nowrap">
                                                {formatCurrency(client.serviceValue || 0)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-0 leading-none">
                                            {nextPreventive ? (
                                                <div className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap leading-none">
                                                    <Calendar className={cn("h-2 w-2", isPreventiveOverdue ? "text-rose-500" : "text-muted-foreground/40")} />
                                                    <span className={cn(isPreventiveOverdue ? "text-rose-600" : "text-muted-foreground/60")}>
                                                        {format(nextPreventive, "dd/MM/yy", { locale: ptBR })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/30 italic">N/D</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-0 text-center leading-none">
                                            <Badge 
                                                variant={statusConfig[client.comodatoStatus || 'Ativo']?.variant || 'secondary'} 
                                                className="rounded-lg px-2 h-5 font-bold text-xs uppercase tracking-widest shadow-sm leading-none"
                                            >
                                                {client.comodatoStatus || 'Ativo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-4 sm:pr-8 py-0 text-right leading-none">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="none" className="h-8 w-8 p-0 hover:bg-primary/10 rounded-xl flex items-center justify-center mx-auto" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-all" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 rounded-[1.5rem] p-2 border-border/40 shadow-premium bg-background/90 backdrop-blur-xl">
                                                    <DropdownMenuItem 
                                                        className="rounded-xl px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest gap-3"
                                                        onClick={(e) => { e.stopPropagation(); onClientClick(client.id); }}
                                                    >
                                                        <Activity className="h-4 w-4 opacity-70" /> Ver Detalhes
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-xl px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest gap-3">
                                                        <Edit className="h-4 w-4 opacity-70" /> Editar Contrato
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-xl px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest gap-3 text-primary">
                                                        <ClipboardList className="h-4 w-4 opacity-70" /> Gerar O.S. Preventiva
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {sortedClients.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-60 text-center opacity-30">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <Users className="h-10 w-10 text-primary" />
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Nenhum cliente encontrado</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 bg-background/20 backdrop-blur-3xl rounded-xl border border-border/40 shadow-premium">
                <div className="flex items-center gap-6">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
                        {sortedClients.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, sortedClients.length)} de {sortedClients.length} registros
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">Itens:</Label>
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
                        className="h-10 w-10 rounded-2xl hover:bg-primary/10 transition-all"
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
                        className="h-10 w-10 rounded-2xl hover:bg-primary/10 transition-all"
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
