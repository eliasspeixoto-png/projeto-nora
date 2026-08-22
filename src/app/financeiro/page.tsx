// @ts-nocheck

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { getAccountsReceivable, updateAccountsReceivable, processPartialPayment, deleteAccountsReceivable } from '@/lib/firebase/firestore';
import type { AccountsReceivable } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Loader2, 
    Search, 
    DollarSign, 
    MoreHorizontal, 
    ArrowUpDown, 
    Calendar as CalendarIcon, 
    ReceiptText, 
    Eye, 
    Trash2, 
    ChevronLeft, 
    ChevronRight,
    CheckCircle2,
    Edit2,
    RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { isPast, isToday } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const CashPaymentDialog = dynamic(() => import('@/components/financeiro/cash-payment-dialog'), { ssr: false });
const InstallmentDialog = dynamic(() => import('@/components/financeiro/installment-dialog'), { ssr: false });
const ReceivableDetailDialog = dynamic(() => import('@/components/financeiro/receivable-detail-dialog'), { ssr: false });

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const cleanDate = dateString.split('T')[0];
    const date = new Date(`${cleanDate}T00:00:00`);
    return date.toLocaleDateString('pt-BR');
};

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' | 'warning' }> = {
    Pendente: { label: 'Pendente', variant: 'default' },
    Pago: { label: 'Pago', variant: 'success' },
    Parcial: { label: 'Parcial', variant: 'warning' },
    Atrasado: { label: 'Atrasado', variant: 'destructive' },
};

export default function FinanceiroPage() {
    const { userProfile, firebase } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;
    
    const { items: sortedReceivables, requestSort, sortConfig } = useSortableData(receivables, { key: 'dueDate', direction: 'asc' });

    // Dialog states
    const [isCashPaymentOpen, setCashPaymentOpen] = useState(false);
    const [isInstallmentOpen, setInstallmentOpen] = useState(false);
    const [isDetailOpen, setDetailOpen] = useState(false);
    const [selectedReceivable, setSelectedReceivable] = useState<AccountsReceivable | null>(null);

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const unsubscribe = getAccountsReceivable(firebase.db, userProfile.companyId, (data) => {
                setReceivables(data);
                setIsLoading(false);
            }, (error) => {
                toast({ variant: 'destructive', title: 'Erro ao carregar contas', description: error.message });
                setIsLoading(false);
            });
            return () => unsubscribe();
        } else {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, firebase.db, toast]);

    const filteredReceivables = useMemo(() => {
        let items = [...sortedReceivables];
        if (activeTab !== 'all') {
            const isTabAtrasado = activeTab === 'Atrasado';
            items = items.filter(r => {
                const cleanDate = (r.dueDate || "").split('T')[0];
                const dueDate = new Date(`${cleanDate}T23:59:59`);
                const isOverdue = isPast(dueDate) && !isToday(dueDate) && r.status !== 'Pago';
                if(isTabAtrasado) return isOverdue;
                return r.status === activeTab && !isOverdue;
            });
        }
        
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            items = items.filter(r =>
                r.quoteNumber.toLowerCase().includes(lowerSearch) ||
                r.clientName.toLowerCase().includes(lowerSearch)
            );
        }

        // Ordenar: Atrasados primeiro
        items.sort((a, b) => {
            const cleanDateA = (a.dueDate || "").split('T')[0];
            const dueDateA = new Date(`${cleanDateA}T23:59:59`);
            const isOverdueA = isPast(dueDateA) && !isToday(dueDateA) && a.status !== 'Pago';

            const cleanDateB = (b.dueDate || "").split('T')[0];
            const dueDateB = new Date(`${cleanDateB}T23:59:59`);
            const isOverdueB = isPast(dueDateB) && !isToday(dueDateB) && b.status !== 'Pago';

            if (isOverdueA && !isOverdueB) return -1;
            if (!isOverdueA && isOverdueB) return 1;
            return 0;
        });
        
        return items;
    }, [sortedReceivables, searchTerm, activeTab]);

    const paginatedReceivables = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredReceivables.slice(startIndex, startIndex + pageSize);
    }, [filteredReceivables, currentPage]);

    const totalPages = Math.ceil(filteredReceivables.length / pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchTerm]);

    const openDialog = (dialogSetter: (isOpen: boolean) => void, receivable: AccountsReceivable) => {
        setSelectedReceivable(receivable);
        dialogSetter(true);
    };
    
    const handleDelete = async (receivableId: string) => {
        if (!confirm('Tem certeza que deseja excluir este lançamento financeiro? Esta ação não pode ser desfeita.')) return;
        
        try {
            if (!firebase.db) return;
            await deleteAccountsReceivable(firebase.db, receivableId);
            toast({ title: 'Sucesso!', description: 'Lançamento excluído com sucesso.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
        }
    };

    const isInstallment = (quoteNumber: string) => quoteNumber.includes('(') && quoteNumber.includes('/');

    const handleCashPayment = async (receivableId: string, discount: number, method: string) => {
       try {
            if (!firebase.db) throw new Error("Firebase not initialized");
            await processPartialPayment(firebase.db, receivableId, { installments: 1, discount, method });
            toast({ title: 'Sucesso!', description: 'Pagamento à vista registrado.' });
       } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Registrar Pagamento', description: error.message });
       }
    };
    
    const handleInstallments = async (receivableId: string, installments: number, interestRate: number, method: string, customInstallments?: any[]) => {
       try {
            if (!firebase.db) throw new Error("Firebase not initialized");
            await processPartialPayment(firebase.db, receivableId, { installments, interestRate, method, customInstallments });
            toast({ title: 'Sucesso!', description: 'Parcelamento criado com sucesso.' });
       } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Criar Parcelamento', description: error.message });
       }
    };

    const handleMarkAsPaid = async (receivableId: string) => {
        if (!firebase.db) return;
        try {
            await updateAccountsReceivable(firebase.db, receivableId, { 
                status: 'Pago', 
                paymentDate: new Date().toISOString() 
            });
            toast({ title: 'Sucesso!', description: 'Conta marcada como paga.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao marcar como pago', description: error.message });
        }
    };

    const handleReopenReceivable = async (receivable: AccountsReceivable) => {
        if (!confirm(`Deseja estornar o pagamento do lançamento "${receivable.quoteNumber}" e voltar para Pendente?`)) return;
        if (!firebase.db) return;
        try {
            await updateAccountsReceivable(firebase.db, receivable.id, {
                status: 'Pendente',
                amount: receivable.originalAmount || receivable.amount,
                paymentDate: null
            });
            toast({ title: 'Sucesso!', description: 'Lançamento estornado e retornado para Pendente.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao estornar', description: error.message });
        }
    };

    return (
        <div className="flex flex-col w-full max-w-[1750px] mx-auto p-4 md:p-8 animate-in fade-in duration-500 overflow-x-hidden">
            <header className="flex flex-col gap-6 pt-4 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
                    <div className="space-y-1">
                        <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
                            <DollarSign className="text-primary h-8 w-8" />
                            Financeiro
                        </h1>
                    </div>
                    <div className="relative w-full lg:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                        <Input
                            type="search"
                            placeholder="Buscar O.S. ou cliente..."
                            className="h-9 w-full rounded-lg bg-background/50 border-border/40 pl-11 font-semibold focus:bg-background transition-all text-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="h-12 p-1.5 bg-background/40 backdrop-blur-3xl rounded-[1.2rem] border border-border/40 shadow-premium self-start gap-1">
                        <TabsTrigger value="all" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Todas</TabsTrigger>
                        <TabsTrigger value="Pendente" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Pendentes</TabsTrigger>
                        <TabsTrigger value="Atrasado" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-destructive data-[state=active]:text-white transition-all">Atrasadas</TabsTrigger>
                        <TabsTrigger value="Pago" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-green-500 data-[state=active]:text-white transition-all">Pagos</TabsTrigger>
                    </TabsList>
                </Tabs>
            </header>
            
            <div className="flex-1 mt-4 pb-24 overflow-hidden w-full max-w-full">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-40">Processando Recebíveis...</span>
                    </div>
                ) : (
                    <>
                        {/* Mobile View: Cards */}
                        <div className="grid gap-4 md:hidden w-full min-w-0">
                            {paginatedReceivables.length > 0 ? paginatedReceivables.map((r) => {
                                const cleanDate = (r.dueDate || "").split('T')[0];
                                const dueDate = new Date(`${cleanDate}T23:59:59`);
                                const isOverdue = isPast(dueDate) && !isToday(dueDate) && r.status !== 'Pago';
                                const displayStatus = isOverdue ? 'Atrasado' : r.status;
                                const config = statusConfig[displayStatus];
                                const paymentDateDisplay = r.paymentDate || (r.paymentHistory && r.paymentHistory[0]?.date);
                                return (
                                    <div key={r.id} className="w-full min-w-0 bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium border-none p-6 space-y-4 group transition-all duration-300 hover:scale-[1.02] active:scale-95" onClick={() => openDialog(setDetailOpen, r)}>
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <p className="text-[10px] font-semibold uppercase tracking-widest opacity-40">{r.quoteNumber}</p>
                                                <p className="text-base font-semibold tracking-tight text-foreground/90 truncate uppercase">{r.clientName}</p>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium w-64">
                                                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); openDialog(setDetailOpen, r);}}>
                                                        <Edit2 className="mr-2 h-4 w-4 text-primary" /> Ver e Editar Parcela
                                                    </DropdownMenuItem>
                                                    {r.status !== 'Pago' ? (
                                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-green-600" onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(r.id)}}>
                                                            <DollarSign className="mr-2 h-4 w-4" /> Marcar como Pago
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-amber-600" onClick={(e) => { e.stopPropagation(); handleReopenReceivable(r);}}>
                                                            <RotateCcw className="mr-2 h-4 w-4" /> Reabrir / Estornar Pagamento
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); openDialog(setCashPaymentOpen, r);}}>Receber à Vista</DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        className={cn("h-10 rounded-xl font-semibold cursor-pointer", isInstallment(r.quoteNumber) && "opacity-30 cursor-not-allowed")} 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (!isInstallment(r.quoteNumber)) openDialog(setInstallmentOpen, r);
                                                        }}
                                                        disabled={isInstallment(r.quoteNumber)}
                                                    >
                                                        {isInstallment(r.quoteNumber) ? "Já Parcelado" : "Criar Parcelamento"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-primary/5" />
                                                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-primary" onClick={(e) => { e.stopPropagation(); router.push(`/financeiro/recibo/${r.id}`);}}>
                                                        <ReceiptText className="mr-2 h-4 w-4"/>Gerar Recibo
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/orcamentos/details/${r.quoteId}`);}}>
                                                        <Eye className="mr-2 h-4 w-4"/>Ver O.S. Original
                                                    </DropdownMenuItem>
                                                    {userProfile?.role === 'admin' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(r.id)}>
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Excluir
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    {r.status === 'Pago' ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                                                                <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                                                Pago em: {formatDate(paymentDateDisplay || r.dueDate)}
                                                            </span>
                                                            <span className="text-[9px] opacity-40">
                                                                Venc: {formatDate(r.dueDate)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <CalendarIcon className="h-3 w-3 text-primary" />
                                                            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isOverdue ? "text-destructive" : "text-muted-foreground text-foreground/40")}>
                                                                Vencimento: {formatDate(r.dueDate)}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <Badge variant={config.variant} className="h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest shadow-lg shadow-black/5 transition-all group-hover:scale-105 border-none">
                                                    {config.label}
                                                </Badge>
                                            </div>
                                            <div className="text-right space-y-0.5">
                                                <p className={cn("font-semibold text-xl tracking-tighter", r.status === 'Pago' ? "text-green-600" : "text-primary")}>
                                                    {formatCurrency(r.originalAmount || r.amount || 0)}
                                                </p>
                                                {r.status === 'Parcial' && <p className="text-[9px] font-semibold uppercase tracking-widest opacity-30 mt-1">Origem: {formatCurrency(r.originalAmount || 0)}</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}) : (
                                    <div className="h-40 flex flex-col items-center justify-center bg-background/20 backdrop-blur-3xl rounded-xl border-2 border-dashed border-border/40 gap-3">
                                        <DollarSign className="h-8 w-8 text-primary/20" />
                                        <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Nenhum recebível encontrado</span>
                                    </div>
                                )}
                        </div>

                        {/* Desktop View: Table */}
                        <div className="hidden md:block bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium border border-border/40 overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-primary/5 border-none h-[34px]">
                                        <TableRow className="hover:bg-transparent border-none h-[34px]">
                                            <TableHead isSortable sortDirection={sortConfig?.key === 'quoteNumber' ? sortConfig.direction : null} onClick={() => requestSort('quoteNumber')} className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Nº O.S.</TableHead>
                                            <TableHead isSortable sortDirection={sortConfig?.key === 'clientName' ? sortConfig.direction : null} onClick={() => requestSort('clientName')} className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Cliente</TableHead>
                                            <TableHead isSortable sortDirection={sortConfig?.key === 'dueDate' ? sortConfig.direction : null} onClick={() => requestSort('dueDate')} className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">
                                                {activeTab === 'Pago' ? 'Data Pagamento' : 'Vencimento'}
                                            </TableHead>
                                            <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground h-[34px]">Status</TableHead>
                                            <TableHead isSortable sortDirection={sortConfig?.key === 'amount' ? sortConfig.direction : null} onClick={() => requestSort('amount')} className="text-right px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Valor</TableHead>
                                            <TableHead className="w-20 px-6 h-[34px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="border-none">
                                        {paginatedReceivables.map((r, index) => {
                                            const cleanDate = (r.dueDate || "").split('T')[0];
                                            const dueDate = new Date(`${cleanDate}T23:59:59`);
                                            const isOverdue = isPast(dueDate) && !isToday(dueDate) && r.status !== 'Pago';
                                            const displayStatus = isOverdue ? 'Atrasado' : r.status;
                                            const config = statusConfig[displayStatus];
                                            const isInst = isInstallment(r.quoteNumber);
                                            const isSameGroup = index > 0 && filteredReceivables[index-1].quoteId === r.quoteId;
                                            const paymentDateDisplay = r.paymentDate || (r.paymentHistory && r.paymentHistory[0]?.date);

                                            return (
                                            <TableRow 
                                                key={r.id} 
                                                className={cn(
                                                    "group transition-all duration-500 border-border/40 cursor-pointer h-[38px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30",
                                                    isSameGroup && "border-t-0"
                                                )} 
                                                onClick={() => openDialog(setDetailOpen, r)}
                                            >
                                                <TableCell className="px-6 py-0 font-mono text-xs text-foreground/80 tracking-tighter relative">
                                                    {isSameGroup && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20" />}
                                                    {r.quoteNumber}
                                                    {r.method && <div className="text-[8px] opacity-40 uppercase font-bold">{r.method}</div>}
                                                </TableCell>
                                                <TableCell className="py-0 px-6">
                                                    <span className="text-xs font-semibold opacity-60 group-hover:opacity-80 transition-opacity uppercase tracking-tight truncate max-w-[200px] block">{r.clientName}</span>
                                                </TableCell>
                                                <TableCell className="px-6 py-0 text-xs font-semibold uppercase tracking-tight">
                                                    {r.status === 'Pago' ? (
                                                        <div className="flex flex-col justify-center">
                                                            <span className="text-green-600 font-bold flex items-center gap-1 text-xs">
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                                                {formatDate(paymentDateDisplay || r.dueDate)}
                                                            </span>
                                                            <span className="text-[9px] opacity-40 tracking-wider">
                                                                Venc: {formatDate(r.dueDate)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className={cn("text-xs font-semibold uppercase tracking-widest", isOverdue ? "text-destructive font-bold" : "opacity-60")}>
                                                            {formatDate(r.dueDate)}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-0 px-6">
                                                    <Badge variant={config.variant} className="h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest shadow-lg shadow-black/5 transition-all group-hover:scale-105 border-none">
                                                        {config.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={cn("py-0 text-right px-6 font-bold text-xs tracking-tighter", r.status === 'Pago' ? "text-green-600" : "text-blue-600")}>
                                                    {formatCurrency(r.originalAmount || r.amount || 0)}
                                                </TableCell>
                                                <TableCell className="py-0 px-6 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all text-foreground" onClick={(e) => e.stopPropagation()}>
                                                                <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium w-64">
                                                            <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); openDialog(setDetailOpen, r);}}>
                                                                <Edit2 className="mr-2 h-4 w-4 text-primary" /> Ver e Editar Parcela
                                                            </DropdownMenuItem>
                                                            {r.status !== 'Pago' ? (
                                                                <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-green-600" onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(r.id)}}>
                                                                    <DollarSign className="mr-2 h-4 w-4" /> Marcar como Pago
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-amber-600" onClick={(e) => { e.stopPropagation(); handleReopenReceivable(r);}}>
                                                                    <RotateCcw className="mr-2 h-4 w-4" /> Reabrir / Estornar Pagamento
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); openDialog(setCashPaymentOpen, r);}}>Receber à Vista</DropdownMenuItem>
                                                            <DropdownMenuItem 
                                                                className={cn("h-10 rounded-xl font-semibold cursor-pointer", isInst && "opacity-30 cursor-not-allowed")} 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    if (!isInst) openDialog(setInstallmentOpen, r);
                                                                }}
                                                                disabled={isInst}
                                                            >
                                                                {isInst ? "Já Parcelado" : "Criar Parcelamento"}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator className="bg-primary/5" />
                                                            <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-primary" onClick={(e) => { e.stopPropagation(); router.push(`/financeiro/recibo/${r.id}`);}}>
                                                                <ReceiptText className="mr-2 h-4 w-4"/>Gerar Recibo
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/orcamentos/details/${r.quoteId}`);}}>
                                                                <Eye className="mr-2 h-4 w-4"/>Ver O.S. Original
                                                            </DropdownMenuItem>
                                                            {userProfile?.role === 'admin' && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(r.id)}>
                                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                                        Excluir
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                        {filteredReceivables.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-0 h-40 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2 opacity-20">
                                                        <DollarSign className="h-10 w-10" />
                                                        <span className="font-semibold uppercase tracking-widest text-[10px]">Tudo em dia por aqui.</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Pagination UI */}
                        {filteredReceivables.length > 0 && (
                            <div className="flex items-center justify-between px-6 py-4 bg-background/20 backdrop-blur-3xl rounded-xl border border-border/40 shadow-premium mt-6 mb-10">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
                                    {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredReceivables.length)} de {filteredReceivables.length} registros
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
                        )}
                    </>
                )}
            </div>

            <CashPaymentDialog isOpen={isCashPaymentOpen} setOpen={setCashPaymentOpen} receivable={selectedReceivable} onConfirm={handleCashPayment} />
            <InstallmentDialog isOpen={isInstallmentOpen} setOpen={setInstallmentOpen} receivable={selectedReceivable} onConfirm={handleInstallments} />
            <ReceivableDetailDialog isOpen={isDetailOpen} setOpen={setDetailOpen} receivable={selectedReceivable} />
        </div>
    );
}
