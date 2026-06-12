
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { getAccountsReceivable, updateAccountsReceivable, processPartialPayment, getQuote, deleteAccountsReceivable } from '@/lib/firebase/firestore';
import type { AccountsReceivable, Quote } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, DollarSign, MoreHorizontal, Check, Download, ExternalLink, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isPast } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CashPaymentDialog from '@/components/financeiro/cash-payment-dialog';
import InstallmentDialog from '@/components/financeiro/installment-dialog';
import PartialPaymentDialog from '@/components/financeiro/partial-payment-dialog';
import ReceivableDetailDialog from '@/components/financeiro/receivable-detail-dialog';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const cleanDate = dateString.split('T')[0];
    const date = new Date(`${cleanDate}T00:00:00`);
    return date.toLocaleDateString('pt-BR');
};

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' | 'warning' }> = {
    Pendente: { label: 'Pendente', variant: 'warning' },
    Pago: { label: 'Pago', variant: 'success' },
    Parcial: { label: 'Parcial', variant: 'default' },
    Atrasado: { label: 'Atrasado', variant: 'destructive' },
};

export default function FinanceiroPage() {
    const { userProfile, firebase } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('Pendente');

    // Dialog states
    const [isCashPaymentOpen, setCashPaymentOpen] = useState(false);
    const [isInstallmentOpen, setInstallmentOpen] = useState(false);
    const [isPartialPaymentOpen, setPartialPaymentOpen] = useState(false);
    const [isDetailOpen, setDetailOpen] = useState(false);
    const [selectedReceivable, setSelectedReceivable] = useState<AccountsReceivable | null>(null);

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const unsubscribe = getAccountsReceivable(firebase.db, userProfile.companyId, setReceivables, (error) => {
                toast({ variant: 'destructive', title: 'Erro ao carregar contas', description: error.message });
            });
            setIsLoading(false);
            return () => unsubscribe();
        } else {
            setIsLoading(false);
        }
    }, [userProfile, toast]);

    const filteredReceivables = useMemo(() => {
        let items = [...receivables];
        if (activeTab !== 'all') {
            const isTabAtrasado = activeTab === 'Atrasado';
            items = items.filter(r => {
                const cleanDate = r.dueDate.split('T')[0];
                const isOverdue = isPast(new Date(`${cleanDate}T23:59:59`)) && r.status !== 'Pago';
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
        
        items.sort((a, b) => {
            const dateA = new Date((a.dueDate || "").split('T')[0]);
            const dateB = new Date((b.dueDate || "").split('T')[0]);
            return dateA.getTime() - dateB.getTime();
        });
        
        return items;
    }, [receivables, searchTerm, activeTab]);

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
            if (!firebase.db) return;
            await processPartialPayment(firebase.db, receivableId, { installments: 1, discount, method });
            toast({ title: 'Sucesso!', description: 'Pagamento à vista registrado.' });
       } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Registrar Pagamento', description: error.message });
       }
    };
    
    const handleInstallments = async (receivableId: string, installments: number, interestRate: number, method: string, customInstallments?: any[]) => {
       try {
            if (!firebase.db) return;
            await processPartialPayment(firebase.db, receivableId, { installments, interestRate, method, customInstallments });
            toast({ title: 'Sucesso!', description: 'Parcelamento criado com sucesso.' });
       } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Criar Parcelamento', description: error.message });
       }
    };

    return (
        <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden min-h-screen">
            <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-4">
                <div className="space-y-1">
                    <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
                        <DollarSign className="text-primary h-8 w-8" />
                        Contas a Receber
                    </h1>

                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="h-14 p-1.5 bg-background/40 backdrop-blur-3xl rounded-[1.2rem] border border-border/40 shadow-premium gap-1 flex-nowrap overflow-x-auto no-scrollbar md:justify-center md:flex-wrap">
                        <TabsTrigger value="Pendente" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all whitespace-nowrap">Pendentes</TabsTrigger>
                        <TabsTrigger value="Atrasado" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all whitespace-nowrap">Atrasadas</TabsTrigger>
                        <TabsTrigger value="Parcial" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all whitespace-nowrap">Parciais</TabsTrigger>
                        <TabsTrigger value="Pago" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all whitespace-nowrap">Pagas</TabsTrigger>
                        <TabsTrigger value="all" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all whitespace-nowrap">Todas</TabsTrigger>
                    </TabsList>
                </Tabs>
            </header>
            
            <main className="px-4 md:px-8 pb-10 flex-1">
                <Card className="flex-1 flex flex-col min-h-[60vh] border-none bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden">
                    <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8">
                        <div>
                            <CardTitle className="text-xl font-semibold tracking-tighter opacity-80">Histórico de Contas</CardTitle>
                            <CardDescription className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                                Gerencie todas as suas contas a receber e emitidas.
                            </CardDescription>
                        </div>
                        <div className="relative group w-full md:w-[400px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                            <Input
                                type="search"
                                placeholder="Buscar por nº da O.S., cliente..."
                                className="h-14 w-full rounded-2xl bg-background/60 backdrop-blur-xl border-border/40 pl-12 font-semibold focus:bg-background transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto px-0 pb-0">
                        <div className="overflow-x-auto border-t border-border/40">
                            <Table>
                                <TableHeader className="bg-primary/5 border-none h-[34px]">
                                    <TableRow className="hover:bg-transparent border-none h-[34px]">
                                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 text-center h-[34px]">Nº O.S.</TableHead>
                                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 text-left h-[34px]">Cliente / Parceiro</TableHead>
                                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 text-center hidden md:table-cell h-[34px]">Vencimento</TableHead>
                                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 text-center h-[34px]">Situação</TableHead>
                                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 text-right h-[34px]">Valor</TableHead>
                                        <TableHead className="w-[80px] px-6 border-none h-[34px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="py-0 h-24 text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" /></TableCell></TableRow>
                                ) : filteredReceivables.length > 0 ? filteredReceivables.map((r, index) => {
                                    const isOverdue = isPast(new Date(r.dueDate)) && r.status !== 'Pago';
                                    const displayStatus = isOverdue ? 'Atrasado' : r.status;
                                    const config = statusConfig[displayStatus];
                                    const isInst = isInstallment(r.quoteNumber);
                                    const isSameGroup = index > 0 && filteredReceivables[index-1].quoteId === r.quoteId;

                                    return (
                                        <TableRow 
                                            key={r.id} 
                                            className={cn(
                                                "group cursor-pointer transition-all duration-500 border-border/40 h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30",
                                                isSameGroup && "border-t-0"
                                            )} 
                                            onClick={() => openDialog(setDetailOpen, r)}
                                        >
                                            <TableCell className="py-0 px-6 font-mono text-xs text-foreground/80 tracking-tighter text-center relative">
                                                {isSameGroup && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20" />}
                                                {r.quoteNumber}
                                                {r.method && <div className="text-[8px] opacity-40 uppercase font-bold">{r.method}</div>}
                                            </TableCell>
                                            <TableCell className="py-0 px-6 text-xs font-semibold text-foreground/80 text-left max-w-[200px] truncate">{r.clientName}</TableCell>
                                            <TableCell className="py-0 px-6 text-xs font-semibold opacity-60 uppercase text-center hidden md:table-cell">{formatDate(r.dueDate)}</TableCell>
                                            <TableCell className="py-0 px-6 text-center">
                                                <Badge variant={config.variant} className="h-5 px-2 rounded-full font-semibold text-[9px] uppercase tracking-widest shadow-lg shadow-black/5 border-none group-hover:scale-105 transition-all">
                                                    {config.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-0 px-6 text-right font-semibold text-xs tracking-tighter text-blue-600">{formatCurrency(r.amount)}</TableCell>
                                            <TableCell className="py-0 px-6 text-right">
                                                 <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all text-foreground" onClick={(e) => e.stopPropagation()}>
                                                            <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity"/>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium w-64">
                                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); openDialog(setDetailOpen, r);}}>Ver Detalhes Reais</DropdownMenuItem>
                                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-green-600" onClick={(e) => { e.stopPropagation(); openDialog(setCashPaymentOpen, r);}}>Receber à Vista</DropdownMenuItem>
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
                                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/financeiro/recibo/${r.id}`);}}>Gerar Recibo Oficial</DropdownMenuItem>
                                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-primary/60" onClick={(e) => { e.stopPropagation(); router.push(`/orcamentos/details/${r.quoteId}`);}}>Acessar O.S. Vinculada</DropdownMenuItem>
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
                                )}) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-0 h-48 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                                <DollarSign className="h-10 w-10" />
                                                <span className="font-semibold uppercase tracking-widest text-[10px]">Nenhuma conta encontrada</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                </Card>
            </main>

            <CashPaymentDialog isOpen={isCashPaymentOpen} setOpen={setCashPaymentOpen} receivable={selectedReceivable} onConfirm={handleCashPayment} />
            <InstallmentDialog isOpen={isInstallmentOpen} setOpen={setInstallmentOpen} receivable={selectedReceivable} onConfirm={handleInstallments} />
            {/* <PartialPaymentDialog isOpen={isPartialPaymentOpen} setOpen={setPartialPaymentOpen} receivable={selectedReceivable} onConfirm={() => {}} /> */}
            <ReceivableDetailDialog isOpen={isDetailOpen} setOpen={setDetailOpen} receivable={selectedReceivable} />
        </div>
    );
}
