"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotes, deleteQuote, updateQuote, getTeamMembers, getClients, getSuppliers } from '@/lib/firebase/firestore';
import type { Quote, UserProfile, Client, Supplier } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Search, ClipboardList, MoreHorizontal, Edit, Trash2, Calendar, Eye, Share2, Send, Calculator, Video, ArrowUpDown, Smartphone, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ScheduleServiceDialog from "@/components/orcamentos/schedule-dialog";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        if (!isValid(date)) return 'N/A';
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
        return 'N/A';
    }
};

const formatTime = (dateString: string) => {
    if (!dateString) return '--:--';
    try {
        const date = parseISO(dateString);
        if (!isValid(date)) return '--:--';
        return format(date, 'HH:mm', { locale: ptBR });
    } catch {
        return '--:--';
    }
};

const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" | "success" | "warning" | "info"; color: string }> = {
    draft: { label: 'Rascunho', variant: 'secondary', color: 'bg-slate-100 text-slate-700' },
    Rascunho: { label: 'Rascunho', variant: 'secondary', color: 'bg-slate-100 text-slate-700' },
    sent: { label: 'Enviado', variant: 'default', color: 'bg-blue-100 text-blue-700' },
    Aprovado: { label: 'Aprovado', variant: 'success', color: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejeitado', variant: 'destructive', color: 'bg-red-100 text-red-700' },
    'revision-pending': { label: 'Revisão Pendente', variant: 'warning', color: 'bg-yellow-100 text-yellow-700' },
    Pendente: { label: 'Pendente', variant: 'warning', color: 'bg-orange-100 text-orange-700' },
    Agendado: { label: 'Agendado', variant: 'default', color: 'bg-blue-100 text-blue-700' },
    'Atribuída': { label: 'Atribuída', variant: 'secondary', color: 'bg-slate-100 text-slate-700' },
    'Em Execução': { label: 'Em Execução', variant: 'warning', color: 'bg-indigo-100 text-indigo-700' },
    Finalizado: { label: 'Finalizado', variant: 'success', color: 'bg-emerald-100 text-emerald-700' },
};

export default function OrcamentosPage() {
    const { userProfile, company, firebase } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAlertOpen, setAlertOpen] = useState(false);
    const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
    const [isScheduleOpen, setScheduleOpen] = useState(false);
    const [quoteToSchedule, setQuoteToSchedule] = useState<Quote | null>(null);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);

    const { items: sortedQuotes, requestSort, sortConfig } = useSortableData(quotes, { key: 'date', direction: 'desc' });

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const { db } = firebase;
            const unsubClients = getClients(db, userProfile.companyId, setClients, console.error);
            const unsubSuppliers = getSuppliers(db, userProfile.companyId, setSuppliers, console.error);
            const unsubscribeQuotes = getQuotes(db, userProfile.companyId, userProfile, (data) => {
                const generalQuotes = data.filter(q =>
                    !q.isComodato &&
                    q.serviceType !== 'Comodato' &&
                    !q.isChildOS
                );
                setQuotes(generalQuotes);
                setIsLoading(false);
            }, (error) => {
                toast({ variant: 'destructive', title: 'Erro ao carregar orçamentos', description: error.message });
                setIsLoading(false);
            });
            const unsubscribeTeam = getTeamMembers(db, userProfile.companyId, setTeamMembers, console.error);
            return () => {
                unsubscribeQuotes();
                unsubscribeTeam();
                unsubClients();
                unsubSuppliers();
            };
        } else {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, userProfile?.uid, firebase.db, toast]);

    const filteredQuotes = useMemo(() => {
        let filtered = sortedQuotes.filter(quote => {
            const search = searchTerm.toLowerCase();
            if (!search) return true;
            const number = (quote.quoteNumber || "").toLowerCase();
            const clientName = (quote.clientName || "").toLowerCase();
            const statusRaw = (quote.status || "").toLowerCase();
            // Also search by the human-readable label (e.g. "enviado" matches status "sent")
            const statusLabel = (statusConfig[quote.status]?.label || "").toLowerCase();
            return number.includes(search) || clientName.includes(search) || statusRaw.includes(search) || statusLabel.includes(search);
        });

        return filtered;
    }, [sortedQuotes, searchTerm]);

    const handleStatusUpdate = async (quoteId: string, status: Quote['status']) => {
        try {
            await updateQuote(firebase.db, firebase.auth, quoteId, { status: status });
            toast({ title: 'Status atualizado!' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao atualizar status', description: error.message });
        }
    };

    const handleShareAction = (method: 'whatsapp' | 'email', quote: Quote) => {
        const client = clients.find(c => c.id === quote.clientId);
        const link = `${window.location.origin}/orcamentos/view/${quote.id}`;
        const message = `Olá ${quote.clientName}, segue o orçamento ${quote.quoteNumber}:\n${link}`;

        if (method === 'whatsapp') {
            const phone = client?.whatsapp || client?.phone;
            if (!phone) return toast({ variant: "destructive", title: "Erro", description: "Cliente sem telefone." });
            window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
        } else {
            if (!client?.email) return toast({ variant: "destructive", title: "Erro", description: "Cliente sem email." });
            window.open(`mailto:${client.email}?subject=Orçamento ${quote.quoteNumber}&body=${encodeURIComponent(message)}`);
        }
    };

    const handleDelete = async () => {
        if (!quoteToDelete || !firebase.db) return;
        try {
            await deleteQuote(firebase.db, quoteToDelete);
            toast({ title: 'Sucesso!', description: 'Orçamento excluído.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
        } finally {
            setAlertOpen(false);
            setQuoteToDelete(null);
        }
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="flex flex-col w-full max-w-[1750px] mx-auto p-4 md:p-8 animate-in fade-in duration-500 overflow-x-hidden">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 bg-background shadow-2xl shadow-primary/5 border border-border/40 rounded-[1.2rem] sticky top-4 z-20 -mx-4 md:-mx-8 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-[1rem] bg-primary shadow-xl shadow-primary/30 text-white">
                        <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="font-bold tracking-tighter flex items-center gap-2 text-2xl text-primary uppercase">
                            Gestão de Orçamentos
                        </h1>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 justify-end max-w-2xl">
                    <div className="relative w-full group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="BUSCAR POR NÚMERO, CLIENTE OU STATUS..."
                            className="h-9 w-full rounded-xl bg-muted/20 border-transparent pl-11 font-bold focus:bg-background focus:border-primary/20 transition-all text-[10px] uppercase tracking-widest"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="h-9 px-6 rounded-xl font-bold uppercase tracking-widest bg-primary hover:scale-[1.02] active:scale-95 transition-all text-[10px] shadow-2xl shadow-primary/30">
                                <PlusCircle className="mr-2 h-5 w-5" /> Novo Orçamento
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-3 rounded-3xl bg-background/95 backdrop-blur-3xl border-border/40 shadow-3xl">
                            <DropdownMenuItem className="h-14 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all focus:bg-primary/10 focus:text-primary mb-1" onClick={() => router.push('/orcamentos/editar/novo')}>
                                <ClipboardList className="mr-3 h-4 w-4 opacity-40" /> Orçamento Geral
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-14 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all focus:bg-primary/10 focus:text-primary mb-1" onClick={() => router.push('/orcamentos/cerca-eletrica')}>
                                <Calculator className="mr-3 h-4 w-4 opacity-40" /> Calculadora Cerca
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-14 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all focus:bg-primary/10 focus:text-primary" onClick={() => router.push('/orcamentos/cameras')}>
                                <Video className="mr-3 h-4 w-4 opacity-40" /> Calculadora Câmeras
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <div className="flex-1 mt-6 pb-24 overflow-hidden w-full max-w-full">
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden w-full min-w-0 pb-10">
                    {filteredQuotes.length > 0 ? filteredQuotes.map(quote => (
                        <Card key={quote.id} className="w-full min-w-0 border-none bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden transition-all duration-300 active:scale-[0.98]">
                            <CardContent className="p-6 space-y-4 min-w-0">
                                <div className="flex justify-between items-start gap-2 min-w-0">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-xs text-primary/60 uppercase tracking-widest truncate">{quote.quoteNumber}</p>
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{formatDate(quote.date)} às {formatTime(quote.date)}</p>
                                    </div>
                                    <Badge variant={statusConfig[quote.status]?.variant || 'secondary'} className="h-6 px-3 rounded-full font-semibold text-xs uppercase tracking-widest shrink-0">
                                        {statusConfig[quote.status]?.label}
                                    </Badge>
                                </div>
                                <p className="font-semibold text-lg tracking-tight truncate break-words text-foreground/90">{quote.clientName}</p>
                                <div className="flex justify-between items-center mt-2 pt-4 border-t border-border/40 gap-2">
                                    <p className="font-semibold text-blue-600 text-xl tracking-tighter shrink-0">{formatCurrency(quote.total)}</p>
                                    <div className="flex gap-2 shrink-0">
                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all font-semibold" onClick={(e) => { e.stopPropagation(); router.push(`/orcamentos/details/${quote.id}`) }}><Eye className="h-5 w-5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-green-500/5 text-green-600 hover:bg-green-500/10 transition-all font-semibold" onClick={(e) => { e.stopPropagation(); handleShareAction('whatsapp', quote) }}><Smartphone className="h-5 w-5" /></Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-10 w-10 rounded-xl bg-muted/50 p-0" onClick={(e) => e.stopPropagation()}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium">
                                                <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" asChild>
                                                    <Link href={`/orcamentos/editar/${quote.id}`} className="flex items-center w-full cursor-pointer">
                                                        <Edit className="mr-2 h-4 w-4" />Editar
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger className="h-10 rounded-xl font-semibold cursor-pointer">
                                                        <ArrowUpDown className="mr-2 h-4 w-4" />Alterar Status
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent className="p-2 rounded-2xl bg-background/95 border-border/40 shadow-2xl z-50">
                                                            {Object.entries(statusConfig).map(([key, value]) => {
                                                                if (key === 'draft' || key === 'Rascunho') return null;
                                                                return (
                                                                    <DropdownMenuItem 
                                                                        key={key} 
                                                                        onSelect={() => handleStatusUpdate(quote.id, key as Quote['status'])}
                                                                        className={cn("h-9 rounded-xl font-bold text-[9px] uppercase tracking-widest cursor-pointer focus:bg-primary/10", quote.status === key && "bg-primary/5 text-primary")}
                                                                    >
                                                                        <div className={cn("w-2 h-2 rounded-full mr-2 shrink-0", value.variant === 'success' ? 'bg-emerald-500' : value.variant === 'destructive' ? 'bg-red-500' : value.variant === 'warning' ? 'bg-orange-500' : 'bg-blue-500')} />
                                                                        {value.label}
                                                                    </DropdownMenuItem>
                                                                );
                                                            })}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                                <DropdownMenuSeparator className="bg-primary/5" />
                                                <DropdownMenuItem className="h-10 rounded-xl font-semibold text-destructive cursor-pointer" onSelect={() => { setQuoteToDelete(quote.id); setAlertOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )) : (
                        <div className="h-40 flex items-center justify-center rounded-xl border-2 border-dashed border-border/40 text-muted-foreground font-semibold uppercase tracking-widest text-xs">Nenhum orçamento encontrado.</div>
                    )}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block overflow-hidden w-full bg-background/60 backdrop-blur-md rounded-[2rem] border border-border/40 shadow-xl">
                    {filteredQuotes.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <Table>
                                <TableHeader className="bg-muted/50 border-b border-border/40">
                                    <TableRow className="hover:bg-transparent border-none h-12">
                                        <TableHead
                                            isSortable
                                            sortDirection={sortConfig?.key === 'quoteNumber' ? sortConfig.direction : null}
                                            onClick={() => requestSort('quoteNumber')}
                                            className="px-6 text-[10px] font-bold uppercase tracking-widest text-primary/60"
                                        >
                                            Nº Registro
                                        </TableHead>
                                        <TableHead
                                            isSortable
                                            sortDirection={sortConfig?.key === 'clientName' ? sortConfig.direction : null}
                                            onClick={() => requestSort('clientName')}
                                            className="px-6 text-[10px] font-bold uppercase tracking-widest text-primary/60"
                                        >
                                            Nome do Cliente
                                        </TableHead>
                                        <TableHead
                                            isSortable
                                            sortDirection={sortConfig?.key === 'date' ? sortConfig.direction : null}
                                            onClick={() => requestSort('date')}
                                            className="px-6 text-[10px] font-bold uppercase tracking-widest text-primary/60"
                                        >
                                            Data Emissão
                                        </TableHead>
                                        <TableHead className="px-6 text-[10px] font-bold uppercase tracking-widest text-primary/60">Hora</TableHead>
                                        <TableHead
                                            isSortable
                                            sortDirection={sortConfig?.key === 'status' ? sortConfig.direction : null}
                                            onClick={() => requestSort('status')}
                                            className="px-6 text-[10px] font-bold uppercase tracking-widest text-primary/60"
                                        >
                                            Status Atual
                                        </TableHead>
                                        <TableHead
                                            isSortable
                                            sortDirection={sortConfig?.key === 'total' ? sortConfig.direction : null}
                                            onClick={() => requestSort('total')}
                                            className="text-right px-6 text-[10px] font-bold uppercase tracking-widest text-primary/60"
                                        >
                                            Valor Total
                                        </TableHead>
                                        <TableHead className="w-16 px-6 text-[10px] font-bold uppercase tracking-widest text-primary/60">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="border-none">
                                    {filteredQuotes.map(quote => (
                                        <TableRow 
                                            key={quote.id} 
                                            className="group transition-all duration-300 border-border/20 h-10 hover:bg-primary/[0.03] cursor-pointer"
                                            onDoubleClick={() => router.push(`/orcamentos/details/${quote.id}`)}
                                        >
                                            <TableCell className="py-0 font-bold text-[11px] px-6 text-primary truncate max-w-[150px]">#{quote.quoteNumber}</TableCell>
                                            <TableCell className="py-0 text-[11px] font-bold px-6 truncate max-w-[250px] text-muted-foreground">{quote.clientName}</TableCell>
                                            <TableCell className="py-0 text-[10px] font-bold px-6 uppercase tracking-widest opacity-60">{formatDate(quote.date)}</TableCell>
                                            <TableCell className="py-0 text-[10px] font-bold px-6 uppercase tracking-[0.2em] opacity-30">{formatTime(quote.date)}</TableCell>
                                            <TableCell className="py-0 px-6" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className={cn(
                                                                "inline-flex items-center h-6 px-3 rounded-full font-bold text-[8px] uppercase tracking-widest cursor-pointer hover:opacity-80 transition-opacity border outline-none focus:ring-2 focus:ring-primary/40",
                                                                statusConfig[quote.status]?.variant === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                                statusConfig[quote.status]?.variant === 'destructive' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                                                statusConfig[quote.status]?.variant === 'warning' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                                                                statusConfig[quote.status]?.variant === 'default' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                                                'bg-slate-500/10 text-slate-600 border-slate-500/20'
                                                            )}
                                                        >
                                                            {statusConfig[quote.status]?.label || quote.status}
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start" className="w-48 p-2 rounded-2xl bg-background border-border/40 shadow-2xl">
                                                        {Object.entries(statusConfig).map(([key, value]) => {
                                                            if (key === 'draft' || key === 'Rascunho') return null;
                                                            return (
                                                                <DropdownMenuItem 
                                                                    key={key} 
                                                                    onSelect={() => handleStatusUpdate(quote.id, key as Quote['status'])}
                                                                    className={cn("h-9 rounded-xl font-bold text-[9px] uppercase tracking-widest cursor-pointer focus:bg-primary/10", quote.status === key && "bg-primary/5 text-primary")}
                                                                >
                                                                    <div className={cn("w-2 h-2 rounded-full mr-2 shrink-0", value.variant === 'success' ? 'bg-emerald-500' : value.variant === 'destructive' ? 'bg-red-500' : value.variant === 'warning' ? 'bg-orange-500' : 'bg-blue-500')} />
                                                                    {value.label}
                                                                </DropdownMenuItem>
                                                            );
                                                        })}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                            <TableCell className="py-0 text-right text-sm font-black tracking-tighter text-primary px-6">{formatCurrency(quote.total)}</TableCell>
                                            <TableCell className="py-0 px-6 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 rounded-xl hover:bg-primary/10 text-primary/40 hover:text-primary transition-all">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl bg-background/95 border-border/40 shadow-2xl">
                                                        <DropdownMenuItem asChild className="h-10 rounded-xl font-bold text-[9px] uppercase tracking-widest cursor-pointer focus:bg-primary/10">
                                                            <Link href={`/orcamentos/details/${quote.id}`} className="flex items-center w-full">
                                                                <Eye className="mr-2 h-4 w-4 opacity-40" />VISUALIZAR ORÇAMENTO
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild className="h-10 rounded-xl font-bold text-[9px] uppercase tracking-widest cursor-pointer focus:bg-primary/10">
                                                            <Link href={`/orcamentos/editar/${quote.id}`} className="flex items-center w-full">
                                                                <Edit className="mr-2 h-4 w-4 opacity-40" />EDITAR ORÇAMENTO
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleShareAction('whatsapp', quote)} className="h-10 rounded-xl font-bold text-[9px] uppercase tracking-widest cursor-pointer focus:bg-green-500/10 focus:text-green-600">
                                                            <Smartphone className="mr-2 h-4 w-4 opacity-40" />Compartilhar WhatsApp
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSub>
                                                            <DropdownMenuSubTrigger className="h-10 rounded-xl font-bold text-[9px] uppercase tracking-widest cursor-pointer focus:bg-primary/10">
                                                                <ArrowUpDown className="mr-2 h-4 w-4 opacity-40" />Alterar Status
                                                            </DropdownMenuSubTrigger>
                                                            <DropdownMenuPortal>
                                                                <DropdownMenuSubContent className="p-2 rounded-2xl bg-background/95 border-border/40 shadow-2xl z-50">
                                                                    {Object.entries(statusConfig).map(([key, value]) => {
                                                                        if (key === 'draft' || key === 'Rascunho') return null;
                                                                        return (
                                                                            <DropdownMenuItem 
                                                                                key={key} 
                                                                                onSelect={() => handleStatusUpdate(quote.id, key as Quote['status'])}
                                                                                className={cn("h-9 rounded-xl font-bold text-[9px] uppercase tracking-widest cursor-pointer focus:bg-primary/10", quote.status === key && "bg-primary/5 text-primary")}
                                                                            >
                                                                                <div className={cn("w-2 h-2 rounded-full mr-2 shrink-0", value.variant === 'success' ? 'bg-emerald-500' : value.variant === 'destructive' ? 'bg-red-500' : value.variant === 'warning' ? 'bg-orange-500' : 'bg-blue-500')} />
                                                                                {value.label}
                                                                            </DropdownMenuItem>
                                                                        );
                                                                    })}
                                                                </DropdownMenuSubContent>
                                                            </DropdownMenuPortal>
                                                        </DropdownMenuSub>
                                                        <DropdownMenuSeparator className="bg-muted" />
                                                        <DropdownMenuItem onSelect={() => { setQuoteToDelete(quote.id); setAlertOpen(true); }} className="h-10 rounded-xl font-bold text-[9px] uppercase tracking-widest cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4 opacity-40" />Excluir Permanente
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="h-60 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                            <div className="p-6 rounded-full bg-muted/30">
                                <ClipboardList className="h-10 w-10 opacity-20" />
                            </div>
                            <p className="font-bold uppercase tracking-[0.3em] text-[10px] opacity-40">Nenhum orçamento registrado no sistema</p>
                        </div>
                    )}
                </div>
            </div>

            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent className="w-[95vw] max-w-lg border border-border/40 bg-background rounded-[2rem] shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-semibold tracking-tighter uppercase opacity-80">Excluir Orçamento?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">Esta ação enviará o item para a lixeira. Você poderá restaurá-lo mais tarde se precisar.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-6">
                        <AlertDialogCancel className="w-full sm:w-auto h-12 rounded-xl font-semibold border-border/40">Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto h-12 rounded-xl font-semibold text-white">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
