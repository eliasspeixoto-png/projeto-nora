

"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { getPurchaseOrders, updatePurchaseOrder } from '@/lib/firebase/firestore';
import type { PurchaseOrder } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Search, ShoppingCart, Eye, Edit, Trash2, Printer, Wrench, Notebook, ArrowUpDown, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useNotificationSound } from '@/hooks/use-notification-sound';


const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' | 'warning' }> = {
    Rascunho: { label: 'Rascunho', variant: 'secondary' },
    Pedido: { label: 'Pedido Enviado', variant: 'default' },
    'Pendente de Aprovação do Comprador': { label: 'Revisão Pendente', variant: 'warning' },
    'Revisão Aprovada': { label: 'Revisão Aprovada', variant: 'success' },
    'Em preparação': { label: 'Em Preparação', variant: 'success' },
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
    const [sortConfig, setSortConfig] = useState<{ key: keyof PurchaseOrder, direction: 'asc' | 'desc' } | null>({ key: 'creationDate', direction: 'desc' });
    const [activeTab, setActiveTab] = useState("aberto");
    const { playNotificationSound } = useNotificationSound();
    const previousReviewCountRef = useRef(0);

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

    const { openOrders, reviewOrders, receivedOrders, allButCanceled } = useMemo(() => {
        const reviewStatuses = ['Pendente de Aprovação do Comprador'];
        const openStatuses = ['Rascunho', 'Pedido', 'Em preparação', 'Pronto para Retirada', 'Enviado', 'Revisão Aprovada'];
        const receivedStatuses = ['Recebido'];

        const review = orders.filter(o => reviewStatuses.includes(o.status));
        const open = orders.filter(o => openStatuses.includes(o.status));
        const received = orders.filter(o => receivedStatuses.includes(o.status));
        const allButCanceled = orders.filter(o => o.status !== 'Cancelado');

        return { openOrders: open, reviewOrders: review, receivedOrders: received, allButCanceled };
    }, [orders]);
    
    useEffect(() => {
        const newReviewCount = reviewOrders.length;
        if (newReviewCount > previousReviewCountRef.current) {
            toast({
                title: "Aprovação Pendente",
                description: "Você tem um novo pedido para aprovar!",
                duration: 10000,
            });
            playNotificationSound();
        }
        previousReviewCountRef.current = newReviewCount;
    }, [reviewOrders, toast, playNotificationSound]);

    const filteredOrders = useMemo(() => {
        let items: PurchaseOrder[] = [];
        if (activeTab === 'aberto') items = openOrders;
        else if (activeTab === 'revisao') items = reviewOrders;
        else if (activeTab === 'recebidos') items = receivedOrders;
        else items = allButCanceled;

        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            items = items.filter(order =>
                (order.orderNumber.toLowerCase().includes(lowerCaseSearch)) ||
                (order.supplierName.toLowerCase().includes(lowerCaseSearch)) ||
                (order.status.toLowerCase().includes(lowerCaseSearch))
            );
        }
        
        if (sortConfig) {
            items.sort((a, b) => {
                const searchStr = searchTerm.trim().toLowerCase();
                if (searchStr) {
                    const nameA = a.supplierName.toLowerCase();
                    const nameB = b.supplierName.toLowerCase();
                    const numA = a.orderNumber.toLowerCase();
                    const numB = b.orderNumber.toLowerCase();

                    const aExact = nameA === searchStr || numA === searchStr;
                    const bExact = nameB === searchStr || numB === searchStr;
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;

                    const aStarts = nameA.startsWith(searchStr) || numA.startsWith(searchStr);
                    const bStarts = nameB.startsWith(searchStr) || numB.startsWith(searchStr);
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;
                }

                const key = sortConfig.key as keyof PurchaseOrder;
                let aValue: any = a[key];
                let bValue: any = b[key];

                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;
                
                if (key === 'creationDate') {
                    return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                if (key === 'totalAmount') {
                     return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                return 0;
            });
        }
    
        return items;
    }, [orders, searchTerm, sortConfig, activeTab, openOrders, reviewOrders, receivedOrders, allButCanceled]);


    const confirmDelete = (orderId: string) => {
        setOrderToDelete(orderId);
        setAlertOpen(true);
    };

    const notifyAdmins = async (title: string, message: string, data?: any) => {
        if (!firebase.auth) return;
        try {
            const idToken = await firebase.auth.currentUser?.getIdToken();
            if (!idToken) return;

            const res = await fetch('/api/notifications/notify-admins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ title, message, data })
            });
            
            if (!res.ok) {
                const errorData = await res.json();
                console.warn('Admin Notification skip:', errorData.error);
            }
        } catch (e) {
            console.error('Falha ao disparar notificação para administradores:', e);
        }
    };

    const handleUpdateStatus = async (orderId: string, status: PurchaseOrder['status']) => {
        if (!firebase.db || !firebase.auth) return;
        try {
            const existingOrder = orders.find(o => o.id === orderId);
            await updatePurchaseOrder(firebase.db, firebase.auth, orderId, { status });
            toast({ title: 'Sucesso!', description: `Pedido marcado como ${status}.` });

            if (status === 'Recebido' && existingOrder) {
                notifyAdmins(
                    "Estoque Atualizado 📦",
                    `O pedido ${existingOrder.orderNumber} (${existingOrder.supplierName}) foi recebido com sucesso.`,
                    { orderId, type: 'purchase_order_received', clickAction: '/compras' }
                );
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao atualizar status', description: error.message });
        }
    };

    const handleDelete = async () => {
        if (!orderToDelete || !firebase.db || !firebase.auth) return;
        try {
            await updatePurchaseOrder(firebase.db, firebase.auth, orderToDelete, { status: 'Cancelado' });
            toast({ title: 'Sucesso!', description: 'Pedido de compra cancelado.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao cancelar', description: error.message });
        } finally {
            setAlertOpen(false);
            setOrderToDelete(null);
        }
    };
    
    const SortableHeader = ({ sortKey, children, className }: { sortKey: keyof PurchaseOrder, children: React.ReactNode, className?: string }) => {
        const requestSort = (key: keyof PurchaseOrder) => {
            let direction: 'asc' | 'desc' = 'asc';
            if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
                direction = 'desc';
            }
            setSortConfig({ key, direction });
        };
    
        const getSortIndicator = () => {
            if (!sortConfig || sortConfig.key !== sortKey) {
                return <ArrowUpDown className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-50" />;
            }
            return sortConfig.direction === 'asc' ? <ArrowUpDown className="ml-2 h-3 w-3 rotate-180" /> : <ArrowUpDown className="ml-2 h-3 w-3" />;
        };
        
        return (
            <TableHead className={cn("group cursor-pointer py-2 px-2", className)} onClick={() => requestSort(sortKey)}>
                <div className="flex items-center">{children}{getSortIndicator()}</div>
            </TableHead>
        );
    };


    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
            <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
                            <ShoppingCart className="text-primary h-8 w-8" />
                            Compras & Suprimentos
                        </h1>

                    </div>
                    <Button 
                        onClick={() => router.push('/compras/novo')} 
                        className="h-10 px-6 rounded-xl bg-primary text-white font-semibold uppercase text-[10px] tracking-widest shadow-premium transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                    >
                        <PlusCircle className="h-4 w-4" /> Novo Pedido
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="relative group w-full md:w-[400px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                        <Input 
                            type="search" 
                            placeholder="Pesquisar por Nº, fornecedor ou status..." 
                            className="h-10 w-full rounded-xl bg-background/40 backdrop-blur-3xl border-border/40 pl-12 font-semibold focus:bg-background transition-all shadow-sm text-xs" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                        <TabsList className="h-10 p-1 bg-background/40 backdrop-blur-3xl rounded-xl border border-border/40 shadow-premium gap-1 flex-wrap md:flex-nowrap">
                            <TabsTrigger value="aberto" className="h-full px-6 rounded-xl font-bold uppercase text-[9px] tracking-widest data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all border border-transparent data-[state=active]:border-border/40">Em Aberto ({openOrders.length})</TabsTrigger>
                            <TabsTrigger value="revisao" className="relative h-full px-6 rounded-xl font-bold uppercase text-[9px] tracking-widest data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all border border-transparent data-[state=active]:border-border/40">
                                Revisão ({reviewOrders.length})
                                {reviewOrders.length > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="recebidos" className="h-full px-6 rounded-xl font-bold uppercase text-[9px] tracking-widest data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all border border-transparent data-[state=active]:border-border/40">Recebidos ({receivedOrders.length})</TabsTrigger>
                            <TabsTrigger value="todos" className="h-full px-6 rounded-xl font-bold uppercase text-[9px] tracking-widest data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all border border-transparent data-[state=active]:border-border/40">Histórico Global</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </header>

            <main className="px-4 md:px-8 pb-10 flex-1">
                <div className="bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium border border-border/40 overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-primary/5 border-none h-[34px]">
                                <TableRow className="hover:bg-transparent border-none h-[34px]">
                                    <SortableHeader sortKey="orderNumber" className="px-8 h-14 font-semibold uppercase tracking-widest text-[10px] opacity-40">Código</SortableHeader>
                                    <SortableHeader sortKey="supplierName" className="px-6 h-14 font-semibold uppercase tracking-widest text-[10px] opacity-40">Fornecedor / Parceiro</SortableHeader>
                                    <SortableHeader sortKey="creationDate" className="hidden lg:table-cell px-6 h-14 font-semibold uppercase tracking-widest text-[10px] opacity-40">Data de Emissão</SortableHeader>
                                    <SortableHeader sortKey="status" className="px-6 h-14 font-semibold uppercase tracking-widest text-[10px] opacity-40">Status do Pedido</SortableHeader>
                                    <SortableHeader sortKey="totalAmount" className="text-right hidden sm:table-cell px-6 h-14 font-semibold uppercase tracking-widest text-[10px] opacity-40">Investimento Total</SortableHeader>
                                    <TableHead className="w-20 px-8 h-[34px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="border-none">
                                {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                                    <TableRow 
                                        key={order.id} 
                                        onClick={() => router.push(`/compras/view/${order.id}`)} 
                                        className="group cursor-pointer hover:bg-primary/5 transition-all duration-500 border-border/40"
                                    >
                                        <TableCell className="py-0 px-8 font-semibold text-xs text-foreground/80 font-mono tracking-tighter">#{order.orderNumber}</TableCell>
                                        <TableCell className="py-0 px-6">
                                            <span className="text-[11px] font-semibold uppercase tracking-tight opacity-80 truncate block max-w-xs">{order.supplierName}</span>
                                        </TableCell>
                                        <TableCell className="py-0 hidden lg:table-cell px-6 text-xs font-semibold opacity-40 uppercase">{formatDate(order.creationDate)}</TableCell>
                                        <TableCell className="py-0 px-6">
                                            <Badge 
                                                variant="outline"
                                                className={cn(
                                                    "font-bold text-[9px] uppercase tracking-widest px-2.5 h-5 rounded-full border-0 shadow-none transition-all group-hover:scale-105",
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
                                        <TableCell className="py-0 text-right hidden sm:table-cell px-6 font-bold text-xs tracking-tighter text-foreground/90">
                                            {formatCurrency(order.totalAmount)}
                                        </TableCell>
                                        <TableCell className="py-0 px-8 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all text-foreground" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium w-64">
                                                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/compras/view/${order.id}`)}}><Printer className="mr-2 h-4 w-4 opacity-40"/>Visualizar / Imprimir</DropdownMenuItem>
                                                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/compras/${order.id}`)}}><Edit className="mr-2 h-4 w-4 opacity-40"/>Editar Lançamento</DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-primary/5" />
                                                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-green-600" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'Recebido')}}><CheckCircle className="mr-2 h-4 w-4"/>Confirmar Recebimento</DropdownMenuItem>
                                                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-destructive" onClick={(e) => {e.stopPropagation(); confirmDelete(order.id)}}><Trash2 className="mr-2 h-4 w-4"/>Cancelar Pedido</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-0 h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                                <ShoppingCart className="h-12 w-12" />
                                                <span className="font-semibold uppercase tracking-widest text-[10px]">Nenhum pedido registrado nesta categoria</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </main>

            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent className="bg-background border border-border/40 rounded-2xl shadow-2xl p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-semibold uppercase tracking-tighter">Estornar Pedido?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-semibold opacity-60">
                            Esta ação moverá o pedido para o status "Cancelado". O histórico de auditoria será preservado, mas a operação comercial será interrompida.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="h-12 px-6 rounded-2xl font-semibold uppercase text-[10px] tracking-widest">Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="h-12 px-8 rounded-2xl bg-destructive text-white font-semibold uppercase text-[10px] tracking-widest shadow-lg shadow-destructive/20 transition-all hover:scale-105 active:scale-95">Confirmar Cancelamento</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
