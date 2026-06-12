

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { getPurchaseOrders, updatePurchaseOrder } from '@/lib/firebase/firestore';
import type { PurchaseOrder } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Search, ShoppingCart, Eye, Edit, Trash2, Printer, Wrench, Notebook, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { startOfMonth, parseISO, isWithinInterval, isPast, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PurchaseStats from '@/components/dashboard/PurchaseStats';
import PurchaseChart from "@/components/dashboard/PurchaseChart";
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import BlocoDeNotasPage from '@/app/ferramentas/bloco-de-notas/page';
import { cn } from "@/lib/utils";


const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' | 'warning' }> = {
    Rascunho: { label: 'Rascunho', variant: 'secondary' },
    Pedido: { label: 'Pedido Enviado', variant: 'default' },
    'Pendente de Aprovação do Comprador': { label: 'Revisão Pendente', variant: 'warning' },
    'Em preparação': { label: 'Revisão Aprovada / Em Preparação', variant: 'success' },
    'Pronto para Retirada': { label: 'Pronto p/ Retirada', variant: 'warning' },
    Enviado: { label: 'Enviado', variant: 'default' },
    Recebido: { label: 'Recebido', variant: 'success' },
    Cancelado: { label: 'Cancelado', variant: 'destructive' },
};

export default function ComprasPageClient() {
    const { userProfile, firebase } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAlertOpen, setAlertOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

    const { items: sortedOrders, requestSort, sortConfig } = useSortableData(orders, { key: 'creationDate', direction: 'desc' });


    useEffect(() => {
        if (!userProfile?.companyId || !firebase.db) {
            setIsLoading(false);
            return;
        }

        const unsubOrders = getPurchaseOrders(firebase.db, userProfile.companyId, (data) => {
            setOrders(data);
            setIsLoading(false);
        }, (error) => {
            toast({ variant: 'destructive', title: 'Erro ao carregar pedidos', description: error.message });
            setIsLoading(false);
        });

        return () => {
            unsubOrders();
        };
    }, [userProfile?.companyId, firebase.db, toast]);

    const filteredOrders = useMemo(() => {
        let filtered = sortedOrders.filter(order => order.status !== 'Cancelado');

        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(order =>
                (order.orderNumber.toLowerCase().startsWith(lowerCaseSearch)) ||
                (order.supplierName.toLowerCase().startsWith(lowerCaseSearch)) ||
                (order.status.toLowerCase().startsWith(lowerCaseSearch))
            );
        }

        return filtered;
    }, [sortedOrders, searchTerm]);


    const confirmDelete = (orderId: string) => {
        setOrderToDelete(orderId);
        setAlertOpen(true);
    };

    const handleUpdateStatus = async (orderId: string, status: PurchaseOrder['status']) => {
        if (!firebase.db || !firebase.auth || !userProfile?.companyId) {
            toast({ variant: 'destructive', title: 'Erro de autenticação', description: 'Seu perfil não foi carregado corretamente.' });
            return;
        }
        try {
            await updatePurchaseOrder(firebase.db, firebase.auth, orderId, { 
                status,
                companyId: userProfile.companyId 
            });
            toast({ title: 'Sucesso!', description: `Pedido marcado como ${status}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao atualizar status', description: error.message });
        }
    };

    const handleDelete = async () => {
        if (!orderToDelete || !firebase.db || !firebase.auth || !userProfile?.companyId) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível completar a ação. Perfil não identificado.' });
            return;
        }
        try {
            await updatePurchaseOrder(firebase.db, firebase.auth, orderToDelete, { 
                status: 'Cancelado',
                companyId: userProfile.companyId
            });
            toast({ title: 'Sucesso!', description: 'Pedido de compra cancelado.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao cancelar', description: error.message });
        } finally {
            setAlertOpen(false);
            setOrderToDelete(null);
        }
    };

    const SortableHeader = ({ sortKey, children, className }: { sortKey: keyof PurchaseOrder, children: React.ReactNode, className?: string }) => null;


    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
                        <ShoppingCart className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-2xl font-semibold tracking-tighter text-primary">Carregando Suprimentos</p>
                        <p className="text-xs font-semibold text-muted-foreground/40 uppercase tracking-[0.3em] animate-pulse">Motor de Inteligência</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col gap-8 px-6 pt-8 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-6 flex-1">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
                                <ShoppingCart className="text-primary h-8 w-8" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="font-semibold tracking-tighter text-foreground text-xl">Pedidos de Compra</h1>

                            </div>
                        </div>
                        
                        <div className="relative w-full lg:max-w-md group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                            <Input
                                type="search"
                                placeholder="Buscar por nº, fornecedor ou status..."
                                className="w-full h-9 pl-12 bg-background/40 backdrop-blur-md border-border/40 rounded-lg font-semibold shadow-sm focus-visible:ring-primary/20 transition-all text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <Button onClick={() => router.push('/compras/novo')} size="lg" className="px-8 h-9 text-xs rounded-lg font-semibold tracking-tight shadow-xl shadow-primary/20 active:scale-95 transition-all">
                        <PlusCircle className="mr-2 h-4 w-4" /> Novo Pedido
                    </Button>
                </div>
            </header>


            <div className="flex-1 mt-4 px-6 pb-24 overflow-hidden w-full">
                <div className="w-full min-w-0 overflow-hidden rounded-xl border border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl">
                    <div className="overflow-x-auto w-full">
                        <Table>
                            <TableHeader className="bg-primary/[0.03] h-[34px]">
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <TableHead
                                        isSortable
                                        sortDirection={sortConfig?.key === 'orderNumber' ? sortConfig.direction : null}
                                        onClick={() => requestSort('orderNumber')}
                                        className="px-6 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Nº Controle
                                    </TableHead>
                                    <TableHead
                                        isSortable
                                        sortDirection={sortConfig?.key === 'supplierName' ? sortConfig.direction : null}
                                        onClick={() => requestSort('supplierName')}
                                        className="px-6 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Fornecedor
                                    </TableHead>
                                    <TableHead
                                        isSortable
                                        sortDirection={sortConfig?.key === 'creationDate' ? sortConfig.direction : null}
                                        onClick={() => requestSort('creationDate')}
                                        className="px-6 hidden sm:table-cell text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Data de Emissão
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'status' ? sortConfig.direction : null}
                                        onClick={() => requestSort('status')}
                                        className="px-6 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Status
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'totalAmount' ? sortConfig.direction : null}
                                        onClick={() => requestSort('totalAmount')}
                                        className="px-6 text-right hidden sm:table-cell text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Valor Total
                                    </TableHead>
                                    <TableHead className="w-[80px] text-right pr-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Gestão</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                                    <TableRow key={order.id} className="cursor-pointer transition-all border-border/40 group h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30" onClick={() => router.push(`/compras/view/${order.id}`)}>
                                        <TableCell className="py-0 px-6 font-mono text-xs font-semibold text-primary/40 group-hover:text-primary transition-colors">
                                            {order.orderNumber}
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-left font-semibold text-xs tracking-tight text-foreground group-hover:text-primary transition-colors">
                                            {order.supplierName}
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-center hidden sm:table-cell">
                                            <span className="text-xs font-semibold text-foreground/60">{formatDate(order.creationDate)}</span>
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-center">
                                            <Badge 
                                                variant="outline"
                                                className={cn(
                                                    "font-bold text-xs uppercase tracking-widest px-2.5 h-5 rounded-full border-0 shadow-none",
                                                    statusConfig[order.status]?.variant === 'success' && "bg-emerald-500/10 text-emerald-600",
                                                    statusConfig[order.status]?.variant === 'warning' && "bg-amber-500/10 text-amber-600",
                                                    statusConfig[order.status]?.variant === 'destructive' && "bg-rose-500/10 text-rose-600",
                                                    statusConfig[order.status]?.variant === 'secondary' && "bg-sky-500/10 text-sky-600",
                                                    statusConfig[order.status]?.variant === 'default' && "bg-primary/10 text-primary"
                                                )}
                                            >
                                                {statusConfig[order.status]?.label || order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-right font-bold text-xs hidden sm:table-cell text-blue-600">
                                            {formatCurrency(order.totalAmount)}
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-right pr-8">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 hover:text-primary transition-all group-hover:scale-110" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/compras/view/${order.id}`) }}>
                                                        <Printer className="mr-2 h-4 w-4 opacity-40" /> Visualizar / Imprimir
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/compras/${order.id}`) }}>
                                                        <Edit className="mr-2 h-4 w-4 opacity-40" /> Editar Registro
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="opacity-10" />
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'Recebido') }} className="text-emerald-600">
                                                        <CheckCircle className="mr-2 h-4 w-4" /> Marcar como Recebido
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDelete(order.id) }} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Cancelar Pedido
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-0 h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground/30">
                                                <ShoppingCart className="h-12 w-12 mb-4 opacity-10" />
                                                <p className="font-semibold text-sm uppercase tracking-widest">Nenhum pedido de compra localizado</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent className="w-[95vw] max-w-lg bg-background/60 backdrop-blur-3xl border-border/40 shadow-premium rounded-xl p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-semibold tracking-tighter text-primary">Confirmar Cancelamento</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-semibold text-muted-foreground leading-relaxed">
                            Você está prestes a cancelar este pedido de compra. Esta ação registrará a anulação do processo no sistema e não poderá ser revertida.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 flex gap-3">
                        <AlertDialogCancel className="h-12 rounded-2xl border-border/40 font-semibold hover:bg-black/5 transition-all">Manter Pedido</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="h-12 rounded-2xl bg-destructive font-semibold tracking-tight shadow-xl shadow-destructive/20 hover:bg-destructive/90 transition-all">Sim, Cancelar Documento</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}



