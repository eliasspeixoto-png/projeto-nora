

"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { getPurchaseOrdersForDistributor, getCompany, getDistributorById, updatePurchaseOrder } from '@/lib/firebase/firestore'; 
import type { PurchaseOrder, Company, UserProfile } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ShoppingCart, ArrowLeft, Printer, CheckCircle, Wrench, Send, XCircle, Edit, MoreHorizontal, Truck, PackageCheck, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useNotificationSound } from '@/hooks/use-notification-sound';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString?: string) => dateString ? format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR }) : 'N/A';

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' | 'warning' }> = {
    Rascunho: { label: 'Rascunho', variant: 'secondary' },
    Pedido: { label: 'Novo Pedido', variant: 'warning' },
    'Pendente de Aprovação do Comprador': { label: 'Revisão Pendente', variant: 'warning' },
    'Revisão Aprovada': { label: 'Revisão Aprovada', variant: 'success' },
    'Em preparação': { label: 'Em Preparação', variant: 'default' },
    'Pronto para Retirada': { label: 'Pronto p/ Retirada', variant: 'success' },
    Enviado: { label: 'Enviado', variant: 'default' },
    Recebido: { label: 'Entregue', variant: 'success' },
    Cancelado: { label: 'Cancelado', variant: 'destructive' },
};

const itemStatusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' | 'warning' }> = {
    Confirmado: { label: 'Confirmado', variant: 'success' },
    'Sem Estoque': { label: 'Sem Estoque', variant: 'destructive' },
    Substituído: { label: 'Substituído', variant: 'warning' },
};


function OrderTable({ orders, onOrderClick }: { orders: PurchaseOrder[], onOrderClick: (order: PurchaseOrder) => void }) {
    if (orders.length === 0) {
        return <div className="text-center h-24 flex items-center justify-center text-muted-foreground">Nenhum pedido encontrado.</div>;
    }

    return (
        <div className="overflow-x-auto rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right h-[34px]">Valor Total</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {orders.map(order => (
                    <TableRow key={order.id} className="cursor-pointer h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30" onClick={() => onOrderClick(order)}>
                        <TableCell className="py-0 font-medium text-xs">{order.orderNumber}</TableCell>
                        <TableCell className="py-0 text-xs">{order.companyName}</TableCell>
                        <TableCell className="py-0 text-xs">{order.assignedSalespersonName || 'Não atribuído'}</TableCell>
                        <TableCell className="py-0 text-xs">{formatDate(order.creationDate)}</TableCell>
                        <TableCell>
                            <Badge variant={statusConfig[order.status]?.variant || 'default'}>
                                {statusConfig[order.status]?.label || order.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="py-0 text-right font-semibold text-xs">{formatCurrency(order.totalAmount)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
        </div>
    );
}

export default function DistributorOrdersPage() {
    const { userProfile, firebase } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);

    const [detailCompany, setDetailCompany] = useState<Company | null>(null);
    const [detailDistributor, setDetailDistributor] = useState<UserProfile | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    
    const { playNotificationSound } = useNotificationSound();
    const previousOrdersRef = useRef<PurchaseOrder[]>([]);


    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const unsubscribe = getPurchaseOrdersForDistributor(firebase.db, userProfile.companyId, (data) => {
                setOrders(data);
                setIsLoading(false);
            }, (error) => {
                toast({ variant: 'destructive', title: 'Erro ao carregar pedidos', description: error.message });
                setIsLoading(false);
            });
            return () => unsubscribe();
        } else if (!userProfile) {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, firebase.db, toast]);

    useEffect(() => {
        const prevOrdersMap = new Map(previousOrdersRef.current.map(o => [o.id, o]));
        
        orders.forEach(order => {
            const prevOrder = prevOrdersMap.get(order.id);
            if (prevOrder && prevOrder.status === 'Pendente de Aprovação do Comprador' && order.status === 'Revisão Aprovada') {
                 toast({
                    title: "Pedido Aprovado!",
                    description: `O pedido ${order.orderNumber} foi aprovado pelo comprador.`,
                    duration: 10000,
                });
                playNotificationSound();
            }
        });
        
        previousOrdersRef.current = orders;
    }, [orders, toast, playNotificationSound]);

    useEffect(() => {
        if (viewingOrder) {
            const fetchDetails = async () => {
                setIsDetailLoading(true);
                const [companyData, distributorData] = await Promise.all([
                    getCompany(firebase.db, viewingOrder.companyId),
                    getDistributorById(firebase.db, viewingOrder.distributorUid || '')
                ]);
                setDetailCompany(companyData);
                setDetailDistributor(distributorData);
                setIsDetailLoading(false);
            };
            fetchDetails();
        }
    }, [viewingOrder, firebase.db]);
    
    const handleUpdateStatus = async (status: PurchaseOrder['status']) => {
        if (!viewingOrder || !firebase.db || !firebase.auth) return;
        setIsUpdatingStatus(true);
        try {
            await updatePurchaseOrder(firebase.db, firebase.auth, viewingOrder.id, { status });
            setViewingOrder(prev => prev ? { ...prev, status } : null);
            toast({ title: "Status atualizado com sucesso!" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao atualizar status", description: error.message });
        } finally {
            setIsUpdatingStatus(false);
        }
    };
    
    const handlePrint = () => {
        window.print();
    };
    
    const filteredOrders = useMemo(() => {
        let userOrders = [...orders];

        if (userProfile?.role === 'vendedor') {
            userOrders = orders.filter(order => 
                !order.assignedSalespersonId || order.assignedSalespersonId === userProfile.uid
            );
        }
        
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            userOrders = userOrders.filter(order =>
                order.orderNumber.toLowerCase().includes(search) ||
                order.companyName.toLowerCase().includes(search) ||
                (order.assignedSalespersonName && order.assignedSalespersonName.toLowerCase().includes(search))
            );
        }
        
        return userOrders;
    }, [orders, searchTerm, userProfile]);

    const { pendingOrders, readyOrders, sentOrders, deliveredOrders, canceledOrders } = useMemo(() => {
        const pendingStatuses = ['Pedido', 'Em preparação', 'Pendente de Aprovação do Comprador', 'Revisão Aprovada'];
        return {
            pendingOrders: filteredOrders.filter(o => pendingStatuses.includes(o.status)).sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()),
            readyOrders: filteredOrders.filter(o => o.status === 'Pronto para Retirada').sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()),
            sentOrders: filteredOrders.filter(o => o.status === 'Enviado').sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()),
            deliveredOrders: filteredOrders.filter(o => o.status === 'Recebido').sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()),
            canceledOrders: filteredOrders.filter(o => o.status === 'Cancelado').sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()),
        };
    }, [filteredOrders]);


    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    if (viewingOrder) {
        if (isDetailLoading) {
            return (
                <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            );
        }
        const currentStatusInfo = statusConfig[viewingOrder.status] || { label: viewingOrder.status, variant: 'default' };
        return (
            <main className="p-4 md:p-8 bg-muted -m-4 md:-m-6">
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="flex justify-between items-center no-print">
                    <div className="flex items-center gap-4">
                      <h1 className="font-semibold text-xl">Detalhes do Pedido Recebido</h1>
                      <Badge variant={currentStatusInfo.variant}>{currentStatusInfo.label}</Badge>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button variant="outline" size="sm" onClick={() => setViewingOrder(null)}><ArrowLeft className="mr-2"/>Fechar</Button>
                      <Button size="sm" onClick={handlePrint}><Printer className="mr-2"/>Imprimir</Button>

                      {['Pedido', 'Em preparação', 'Revisão Aprovada'].includes(viewingOrder.status) && (
                        <Button size="sm" onClick={() => router.push(`/distribuidor/pedidos/editar/${viewingOrder.id}`)}>
                            <Edit className="mr-2 h-4 w-4" /> Analisar/Editar Pedido
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Ações <MoreHorizontal className="ml-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleUpdateStatus('Em preparação')} disabled={isUpdatingStatus || !['Pedido', 'Pendente de Aprovação do Comprador', 'Revisão Aprovada'].includes(viewingOrder.status)}>
                            <Wrench className="mr-2" /> Marcar como "Em Preparação"
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus('Pronto para Retirada')} disabled={isUpdatingStatus || viewingOrder.status !== 'Em preparação'}>
                            <CheckCircle className="mr-2" /> Marcar como "Pronto p/ Retirada"
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus('Enviado')} disabled={isUpdatingStatus || viewingOrder.status !== 'Pronto para Retirada'}>
                            <Truck className="mr-2 h-4 w-4"/> Marcar como "Enviado"
                          </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleUpdateStatus('Recebido')} disabled={isUpdatingStatus || !['Enviado', 'Pronto para Retirada'].includes(viewingOrder.status)}>
                            <PackageCheck className="mr-2 h-4 w-4"/> Marcar como "Entregue"
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleUpdateStatus('Cancelado')} disabled={isUpdatingStatus || ['Cancelado', 'Recebido'].includes(viewingOrder.status)} className="text-destructive">
                            <XCircle className="mr-2" /> Cancelar Pedido
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>


                  <div id="print-content" className="bg-card p-8 rounded-lg shadow-sm">
                    <header className="flex justify-between items-start gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            {detailDistributor?.logoUrl && <div className="relative w-24 h-16"><Image src={detailDistributor.logoUrl} alt={detailDistributor.displayName} fill style={{objectFit:"contain"}}/></div>}
                            <div>
                                <h2 className="font-semibold text-xl">{detailDistributor?.displayName}</h2>
                                <p className="text-xs text-muted-foreground">{detailDistributor?.document}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h3 className="text-xl font-semibold">Pedido de Compra</h3>
                            <p className="font-semibold text-primary">{viewingOrder.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">Data: {formatDate(viewingOrder.creationDate)}</p>
                        </div>
                    </header>
                    {viewingOrder.assignedSalespersonName && (
                        <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                            <User className="h-4 w-4"/>
                            Vendedor Responsável: <span className="font-semibold">{viewingOrder.assignedSalespersonName}</span>
                        </div>
                    )}
                    <Separator className="my-6"/>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <h4 className="font-semibold mb-1">CLIENTE</h4>
                            <p className="font-semibold">{detailCompany?.name}</p>
                            <p>{detailCompany?.cnpj}</p>
                            <p>{detailCompany?.email}</p>
                            <p>{detailCompany?.phone}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-1">{viewingOrder.deliveryOption === 'retirada' ? 'LOCAL DE RETIRADA' : 'ENDEREÇO DE ENTREGA'}</h4>
                             {viewingOrder.deliveryOption === 'entrega' ? (
                                viewingOrder.deliveryAddressType === 'other' ? (
                                    <>
                                        <p className="font-semibold">{detailCompany?.name}</p>
                                        <p>{`${viewingOrder.deliveryStreet}, ${viewingOrder.deliveryNumber}`}</p>
                                        {viewingOrder.deliveryNeighborhood && <p>{viewingOrder.deliveryNeighborhood}</p>}
                                        <p>{`${viewingOrder.deliveryCity} - ${viewingOrder.deliveryState}`}</p>
                                        {viewingOrder.deliveryCep && <p>CEP: {viewingOrder.deliveryCep}</p>}
                                        {viewingOrder.deliveryReference && <p className="text-sm text-muted-foreground">Ref: {viewingOrder.deliveryReference}</p>}
                                    </>
                                ) : (
                                    <>
                                        <p className="font-semibold">{detailCompany?.name}</p>
                                        <p>{`${detailCompany?.street}, ${detailCompany?.number}`}</p>
                                        <p>{`${detailCompany?.city} - ${detailCompany?.state}`}</p>
                                        {detailCompany?.cep && <p>CEP: {detailCompany.cep}</p>}
                                    </>
                                )
                            ) : (
                                <>
                                    <p className="font-semibold">{detailDistributor?.displayName}</p>
                                    <p>{`${detailDistributor?.street || ''}, ${detailDistributor?.number || ''}`.trim()}</p>
                                    <p>{`${detailDistributor?.city || ''} - ${detailDistributor?.state || ''}`.trim()}</p>
                                </>
                            )}
                        </div>
                    </div>
                     <div className="mt-8">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px] h-[34px]">Código</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-center h-[34px]">Qtd.</TableHead>
                                    <TableHead className="text-right h-[34px]">Vl. Unit.</TableHead>
                                    <TableHead className="text-right h-[34px]">Subtotal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewingOrder.items.map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell className="py-0 font-mono">{item.productCode}</TableCell>
                                        <TableCell>{item.productDescription}</TableCell>
                                        <TableCell className="py-0 text-center">{item.quantity}</TableCell>
                                        <TableCell className="py-0 text-right">{formatCurrency(item.unitCost)}</TableCell>
                                        <TableCell className="py-0 text-right">{formatCurrency(item.totalCost)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <div className="w-full max-w-xs space-y-2">
                            <div className="flex justify-between text-lg font-semibold">
                                <span>TOTAL DO PEDIDO</span>
                                <span>{formatCurrency(viewingOrder.totalAmount)}</span>
                            </div>
                        </div>
                    </div>
                     {viewingOrder.notes && (
                        <div className="mt-8">
                            <h4 className="font-semibold">Observações:</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingOrder.notes}</p>
                        </div>
                     )}
                     <footer className="mt-24 text-center">
                        <div className="inline-block">
                            <div className="border-t w-64 pt-2">
                                <p className="text-sm font-semibold">{viewingOrder.creatorName}</p>
                                <p className="text-xs text-muted-foreground">Responsável pela Compra</p>
                            </div>
                        </div>
                     </footer>
                  </div>
                </div>
            </main>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShoppingCart /> Pedidos Recebidos</CardTitle>
                <CardDescription>Acompanhe os pedidos de compra feitos para você.</CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar por nº do pedido ou empresa..."
                        className="w-full rounded-lg bg-background pl-8 md:w-[450px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="pending">Pendentes ({pendingOrders.length})</TabsTrigger>
                        <TabsTrigger value="ready">Prontos ({readyOrders.length})</TabsTrigger>
                        <TabsTrigger value="sent">Enviados ({sentOrders.length})</TabsTrigger>
                        <TabsTrigger value="delivered">Entregues ({deliveredOrders.length})</TabsTrigger>
                        <TabsTrigger value="canceled">Cancelados ({canceledOrders.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending" className="mt-4">
                        <OrderTable orders={pendingOrders} onOrderClick={setViewingOrder} />
                    </TabsContent>
                     <TabsContent value="ready" className="mt-4">
                        <OrderTable orders={readyOrders} onOrderClick={setViewingOrder} />
                    </TabsContent>
                    <TabsContent value="sent" className="mt-4">
                        <OrderTable orders={sentOrders} onOrderClick={setViewingOrder} />
                    </TabsContent>
                     <TabsContent value="delivered" className="mt-4">
                        <OrderTable orders={deliveredOrders} onOrderClick={setViewingOrder} />
                    </TabsContent>
                     <TabsContent value="canceled" className="mt-4">
                        <OrderTable orders={canceledOrders} onOrderClick={setViewingOrder} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

    
