"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotesOnce, getVisits, getClients, getTeamMembers, getPurchaseOrdersOnce } from '@/lib/firebase/firestore';
import type { Quote, Visit, Client, UserProfile, PurchaseOrder, HistoryItem } from '@/lib/data';
import { Loader2, Search, ArrowUpDown, FileText, HardHat, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSortableData } from '@/hooks/use-sortable-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { osStatusConfig } from '@/components/ordem-de-servico/os-status-config';
import { statusConfig as visitStatusConfig } from '@/components/visitas/visit-status';
import HistoryDetailDialog from '@/components/relatorios/history-detail-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';



type SortKey = 'type' | 'documentNumber' | 'clientName' | 'completionDate' | 'status';
type SortDirection = 'asc' | 'desc';

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return "Data inválida";
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
};

export default function HistoryPageClient() {
    const { userProfile, company, firebase } = useAuth();
    const { toast } = useToast();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    
    const preparedHistory = useMemo(() => {
        return history.map(item => {
            let identifier: string | undefined;
            let clientName: string | undefined;
            let date: string | undefined;
            
            if (item.type === 'os') {
                identifier = (item as Quote).quoteNumber;
                clientName = (item as Quote).clientName;
                date = (item as Quote).completionDate || (item as Quote).date;
            } else if (item.type === 'visit') {
                identifier = (item as Visit).visitNumber;
                clientName = (item as Visit).clientName;
                date = (item as Visit).completionDate || (item as Visit).visitDate;
            } else if (item.type === 'purchase') {
                identifier = (item as PurchaseOrder).orderNumber;
                clientName = (item as PurchaseOrder).supplierName;
                date = (item as PurchaseOrder).creationDate;
            }

            return {
                ...item,
                clientName: clientName || 'N/A',
                documentNumber: identifier || (item as any).id || (item as any).uid,
                completionDate: date,
            };
        });
    }, [history]);

    const { items: sortedHistory, requestSort, sortConfig } = useSortableData(preparedHistory, { key: 'completionDate', direction: 'desc' });
    
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
    const [isDetailOpen, setDetailOpen] = useState(false);

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const [clientsData, teamData, quotes, visits, purchases] = await Promise.all([
                        new Promise<Client[]>(res => getClients(firebase.db, userProfile.companyId!, res, console.error)),
                        new Promise<UserProfile[]>(res => getTeamMembers(firebase.db, userProfile.companyId!, res, console.error)),
                        getQuotesOnce(firebase.db, userProfile.companyId!, userProfile),
                        new Promise<Visit[]>(res => getVisits(firebase.db, userProfile.companyId!, userProfile, res, console.error)),
                        getPurchaseOrdersOnce(firebase.db, userProfile.companyId!),
                    ]);

                    setClients(clientsData);
                    setTeamMembers(teamData);

                    const osItems: HistoryItem[] = quotes.map(q => ({ ...q, type: 'os' }));
                    const visitItems: HistoryItem[] = visits.map(v => ({ ...v, type: 'visit' }));
                    const purchaseItems: HistoryItem[] = purchases.map(p => ({ ...p, type: 'purchase' }));
                    setHistory([...osItems, ...visitItems, ...purchaseItems]);
                } catch (error) {
                    console.error("Failed to fetch history data:", error);
                    toast({ variant: 'destructive', title: 'Erro ao carregar histórico' });
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        } else {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, userProfile?.uid, firebase.db, toast]);
    
    const filteredHistory = useMemo(() => {
        return sortedHistory.filter(item => {
            if (filterType !== 'all' && item.type !== filterType) return false;

            if (searchTerm) {
                const lowerSearch = searchTerm.toLowerCase();
                return (
                    (item.documentNumber && item.documentNumber.toLowerCase().includes(lowerSearch)) ||
                    (item.clientName && item.clientName.toLowerCase().includes(lowerSearch))
                );
            }
            return true;
        });
    }, [sortedHistory, searchTerm, filterType]);
    

    const handleRowClick = useCallback((item: HistoryItem) => {
      setSelectedItem(item);
      setDetailOpen(true);
    }, []);

    const stats = useMemo(() => {
        const total = filteredHistory.length;
        const osCount = filteredHistory.filter(i => i.type === 'os').length;
        const visitCount = filteredHistory.filter(i => i.type === 'visit').length;
        return { total, osCount, visitCount };
    }, [filteredHistory]);

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <Loader2 className="h-14 w-14 animate-spin text-primary/20" />
                        <History className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-xl font-semibold tracking-tighter text-primary">Sincronizando Histórico</p>
                        <p className="text-sm font-medium text-muted-foreground/60 animate-pulse uppercase tracking-[0.2em]">Motor de Inteligência</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Resumo Rápido */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <Card className="bg-background/40 backdrop-blur-md border-border/40 rounded-xl shadow-xl overflow-hidden group hover:bg-background/50 transition-all">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 group-hover:text-primary/60 transition-colors">Operações Totais</p>
                            <p className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground group-hover:scale-110 transition-transform origin-left">{stats.total}</p>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <FileText className="h-7 w-7" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-md border-border/40 rounded-xl shadow-xl overflow-hidden group hover:bg-background/50 transition-all">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500/40 group-hover:text-orange-500/60 transition-colors">Ordens de Serviço</p>
                            <p className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground group-hover:scale-110 transition-transform origin-left">{stats.osCount}</p>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner">
                            <HardHat className="h-7 w-7" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-md border-border/40 rounded-xl shadow-xl overflow-hidden group hover:bg-background/50 transition-all">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500/40 group-hover:text-blue-500/60 transition-colors">Visitas Técnicas</p>
                            <p className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground group-hover:scale-110 transition-transform origin-left">{stats.visitCount}</p>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
                            <Search className="h-7 w-7" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/40 bg-background/40 backdrop-blur-3xl shadow-premium overflow-hidden rounded-xl">
                <CardHeader className="p-8 border-b border-border/40">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <History className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Relatório de Atividades</CardTitle>
                            </div>
                            <CardDescription className="text-xs font-semibold uppercase tracking-widest text-primary/40">Log operacional e comercial completo</CardDescription>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                            <div className="relative w-full sm:w-80 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                                <Input
                                    placeholder="Número, cliente ou fornecedor..."
                                    className="pl-12 h-9 bg-background/50 border-border/40 focus-visible:ring-primary/20 rounded-lg font-semibold transition-all text-xs"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-full sm:w-[200px] h-9 bg-background/50 border-border/40 rounded-lg font-semibold shadow-sm text-xs">
                                    <SelectValue placeholder="Filtrar tipo" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl">
                                    <SelectItem value="all" className="font-semibold">Todos os Registros</SelectItem>
                                    <SelectItem value="os" className="font-semibold">Ordens de Serviço</SelectItem>
                                    <SelectItem value="visit" className="font-semibold">Visitas Técnicas</SelectItem>
                                    <SelectItem value="purchase" className="font-semibold">Ordens de Compra</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-primary/[0.03] h-[34px]">
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'type' ? sortConfig.direction : null}
                                        onClick={() => requestSort('type')}
                                        className="text-[10px] font-semibold uppercase tracking-[0.2em] text-center text-primary/40"
                                    >
                                        Tipo
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'documentNumber' ? sortConfig.direction : null}
                                        onClick={() => requestSort('documentNumber')}
                                        className="text-[10px] font-semibold uppercase tracking-[0.2em] text-center text-primary/40"
                                    >
                                        Documento
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'clientName' ? sortConfig.direction : null}
                                        onClick={() => requestSort('clientName')}
                                        className="text-[10px] font-semibold uppercase tracking-[0.2em] text-left pl-8 text-primary/40"
                                    >
                                        Entidade Relacionada
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'completionDate' ? sortConfig.direction : null}
                                        onClick={() => requestSort('completionDate')}
                                        className="text-[10px] font-semibold uppercase tracking-[0.2em] text-center text-primary/40"
                                    >
                                        Data de Conclusão
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'status' ? sortConfig.direction : null}
                                        onClick={() => requestSort('status')}
                                        className="text-[10px] font-semibold uppercase tracking-[0.2em] text-center text-primary/40"
                                    >
                                        Status Final
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHistory.map((item) => {
                                    const isOS = item.type === 'os';
                                    const config = isOS ? osStatusConfig[(item as any).status as keyof typeof osStatusConfig] : visitStatusConfig[(item as any).status as keyof typeof visitStatusConfig];
                                    
                                    return (
                                    <TableRow 
                                        key={(item as any).id} 
                                        className="group cursor-pointer [0.03] border-border/40 transition-all h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30"
                                        onClick={() => handleRowClick(item as HistoryItem)}
                                    >
                                        <TableCell className="py-0 text-center">
                                            <div className={cn(
                                                "mx-auto w-fit px-3 py-1 rounded-xl text-[10px] font-semibold uppercase tracking-widest border shadow-sm",
                                                item.type === 'os' ? "border-orange-500/20 bg-orange-500/10 text-orange-600 shadow-orange-500/5" : 
                                                item.type === 'visit' ? "border-blue-500/20 bg-blue-500/10 text-blue-600 shadow-blue-500/5" : 
                                                "border-stone-500/20 bg-stone-500/10 text-stone-600 shadow-stone-500/5"
                                            )}>
                                                {item.type === 'os' ? "O.S." : item.type === 'visit' ? "Visita" : "Compra"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 text-xs font-mono font-semibold text-center text-foreground/40 group-hover:text-primary transition-colors">
                                            {(item as any).documentNumber}
                                        </TableCell>
                                        <TableCell className="py-0 pl-8">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">{(item as any).clientName}</span>
                                                <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Entidade operacional</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 text-xs text-center font-semibold text-foreground/60">
                                            {formatDate((item as any).completionDate)}
                                        </TableCell>
                                        <TableCell className="py-0 text-center">
                                            <Badge variant={config?.variant} className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-xl shadow-lg shadow-black/5">
                                                {config?.label || (item as any).status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                )})}
                                {filteredHistory.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-0 h-48 text-center text-muted-foreground italic opacity-50">
                                            Nenhum registro encontrado para os critérios de busca.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <HistoryDetailDialog
                isOpen={isDetailOpen}
                setOpen={setDetailOpen}
                item={selectedItem}
                clients={clients}
                teamMembers={teamMembers}
                company={company}
            />
        </div>
    );
}
