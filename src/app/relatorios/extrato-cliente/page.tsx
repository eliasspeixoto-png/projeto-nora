"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotesOnce, getVisits, getClients, getTeamMembers } from '@/lib/firebase/firestore';
import type { Quote, Visit, Client, UserProfile, HistoryItem } from '@/lib/data';
import { Loader2, Search, User, Check, ChevronsUpDown, FileText, CreditCard, Calendar, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { osStatusConfig } from '@/components/ordem-de-servico/os-status-config';
import { statusConfig as visitStatusConfig } from '@/components/visitas/visit-status';
import HistoryDetailDialog from '@/components/relatorios/history-detail-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

export default function ExtratoClientePage() {
    const { userProfile, company, firebase } = useAuth();
    const { toast } = useToast();
    const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
    const [allVisits, setAllVisits] = useState<Visit[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
    const [isDetailOpen, setDetailOpen] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [clientSearch, setClientSearch] = useState("");

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

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const [clientsData, teamData, quotes, visits] = await Promise.all([
                        new Promise<Client[]>(res => getClients(firebase.db, userProfile.companyId!, res, console.error)),
                        new Promise<UserProfile[]>(res => getTeamMembers(firebase.db, userProfile.companyId!, res, console.error)),
                        getQuotesOnce(firebase.db, userProfile.companyId!, userProfile),
                        new Promise<Visit[]>(res => getVisits(firebase.db, userProfile.companyId!, userProfile, res, console.error)),
                    ]);

                    setClients(clientsData);
                    setTeamMembers(teamData);
                    setAllQuotes(quotes);
                    setAllVisits(visits);
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
    }, [userProfile?.companyId, firebase.db, toast, userProfile]);

    const clientHistory = useMemo(() => {
        if (!selectedClientId) return [];

        const clientQuotes: any[] = allQuotes
            .filter(q => q.clientId === selectedClientId && !q.deletedAt)
            .map(q => ({ ...q, type: 'os' }));

        const clientVisits: any[] = allVisits
            .filter(v => v.clientId === selectedClientId && !v.deletedAt)
            .map(v => ({ ...v, type: 'visit' }));

        return [...clientQuotes, ...clientVisits].sort((a, b) => {
            const dateA = a.type === 'os' ? a.date : a.visitDate;
            const dateB = b.type === 'os' ? b.date : b.visitDate;
            return parseISO(dateB).getTime() - parseISO(dateA).getTime();
        });
    }, [selectedClientId, allQuotes, allVisits]);

    const totals = useMemo(() => {
        if (!selectedClientId) return { revenue: 0, count: 0 };
        const revenue = clientHistory.reduce((sum, item) => sum + (item.type === 'os' ? (item as Quote).total : 0), 0);
        return { revenue, count: clientHistory.length };
    }, [clientHistory, selectedClientId]);

    const handleRowClick = (item: any) => {
        setSelectedItem(item);
        setDetailOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header com Seletor */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="font-semibold tracking-tight flex items-center gap-2 text-xl">
                        <User className="h-6 w-6 text-primary" />
                        Extrato do Cliente
                    </h1>
                    <p className="text-sm font-medium text-muted-foreground opacity-70">Histórico unificado de atendimentos, orçamentos e faturamento.</p>
                </div>
                
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverOpen}
                            className="w-full lg:w-80 justify-between h-10 bg-background/40 backdrop-blur-sm border-border/40 text-xs font-semibold ring-offset-background"
                        >
                            <span className="truncate">
                                {selectedClientId
                                    ? clients.find((client) => client.id === selectedClientId)?.name
                                    : "Buscar e selecionar cliente..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-background/95 backdrop-blur-xl border-border/40 overflow-hidden" align="end">
                        <Command className="bg-transparent" shouldFilter={false}>
                            <CommandInput placeholder="Filtrar cliente..." value={clientSearch} onValueChange={setClientSearch} className="h-10 text-xs border-none focus:ring-0" />
                            <CommandList>
                                <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">Nenhum cliente encontrado.</CommandEmpty>
                                <CommandGroup>
                                    {filteredClients.map((client) => (
                                        <CommandItem
                                            key={client.id}
                                            value={client.id}
                                            onSelect={() => {
                                                setSelectedClientId(client.id);
                                                setClientSearch("");
                                                setPopoverOpen(false);
                                            }}
                                            className="text-xs font-medium py-2 px-6 cursor-pointer hover:bg-primary/5 uppercase"
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4 text-primary",
                                                    selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {client.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {selectedClientId ? (
                <>
                    {/* KPIs Dinâmicos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                            <CardContent className="p-5 flex items-center justify-between relative">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Total Investido (O.S. Concluídas)</p>
                                    <p className="text-2xl font-semibold text-primary">{formatCurrency(totals.revenue)}</p>
                                </div>
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <CreditCard className="h-6 w-6" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
                            </CardContent>
                        </Card>
                        <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                            <CardContent className="p-5 flex items-center justify-between relative">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Volume de Documentos</p>
                                    <p className="text-2xl font-semibold text-emerald-500 font-mono">{totals.count} <span className="text-sm font-medium text-muted-foreground">registros</span></p>
                                </div>
                                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-border/40 bg-background/40 backdrop-blur-md shadow-xl overflow-hidden">
                        <CardHeader className="px-6 py-6 border-b border-border/40">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-semibold tracking-tight">Linha do Tempo de Atividades</CardTitle>
                                    <CardDescription className="text-xs font-medium opacity-70">Relação cronológica de todas as interações registradas.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-primary/5 h-[34px]">
                                        <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                            <TableHead className="text-[10px] font-semibold uppercase tracking-widest pl-6 h-[34px]">Tipo</TableHead>
                                            <TableHead className="text-[10px] font-semibold uppercase tracking-widest h-[34px]">Nº Documento</TableHead>
                                            <TableHead className="text-[10px] font-semibold uppercase tracking-widest h-[34px]">Data / Hora</TableHead>
                                            <TableHead className="text-[10px] font-semibold uppercase tracking-widest h-[34px]">Status</TableHead>
                                            <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-right pr-6 h-[34px]">Faturamento</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clientHistory.length > 0 ? clientHistory.map((item, index) => {
                                            const isOS = item.type === 'os';
                                            const config = isOS ? osStatusConfig[item.status as keyof typeof osStatusConfig] : visitStatusConfig[item.status as keyof typeof visitStatusConfig];
                                            return (
                                                <TableRow key={item.id} className="group cursor-pointer border-border/40 transition-all h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30" onClick={() => handleRowClick(item)}>
                                                    <TableCell className="py-0 pl-6">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] uppercase font-semibold px-2 py-0.5 border-none",
                                                            isOS ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-600"
                                                        )}>
                                                            {isOS ? 'O.S.' : 'Visita'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-0 font-mono text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                                                        {isOS ? (item as Quote).quoteNumber : (item as Visit).visitNumber}
                                                    </TableCell>
                                                    <TableCell className="py-0 text-xs font-medium opacity-70">
                                                        {formatDate(isOS ? (item as Quote).date : (item as Visit).visitDate)}
                                                    </TableCell>
                                                    <TableCell className="py-0 ">
                                                        <Badge variant={config?.variant} className="text-[10px] whitespace-nowrap px-2 rounded-full font-semibold">
                                                            {config?.label || item.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-0 text-right pr-6 text-xs font-semibold text-primary/80 group-hover:text-primary">
                                                        {isOS ? formatCurrency((item as Quote).total) : <span className="opacity-20">-</span>}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-0 h-48 text-center text-muted-foreground italic opacity-50">
                                                    Nenhum histórico encontrado para este cliente.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px] border border-dashed border-primary/20 rounded-2xl bg-primary/5 animate-pulse">
                    <User className="h-16 w-16 text-primary opacity-10 mb-4" />
                    <p className="text-sm font-semibold text-primary/40 uppercase tracking-widest">Aguardando seleção de cliente</p>
                </div>
            )}

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
