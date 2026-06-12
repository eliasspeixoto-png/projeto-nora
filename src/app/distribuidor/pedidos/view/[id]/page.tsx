
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from 'next/link';
import { getPurchaseOrder, getCompany, getDistributorById, updatePurchaseOrder } from "@/lib/firebase/firestore";
import type { PurchaseOrder, Company, UserProfile, PurchaseOrderItem } from "@/lib/data";
import { Loader2, ArrowLeft, Printer, CheckCircle, Wrench, Send, XCircle, Edit, MoreHorizontal, Truck, PackageCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { useAuth } from "@/firebase/auth/use-user";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR') : 'N/A';

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' | 'warning' }> = {
    Rascunho: { label: 'Rascunho', variant: 'secondary' },
    Pedido: { label: 'Novo Pedido', variant: 'warning' },
    'Pendente de Aprovação do Comprador': { label: 'Aguardando Aprovação', variant: 'warning' },
    'Em preparação': { label: 'Revisão Aprovada', variant: 'default' },
    'Pronto para Retirada': { label: 'Pronto p/ Retirada', variant: 'success' },
    Enviado: { label: 'Enviado', variant: 'default' },
    Recebido: { label: 'Entregue', variant: 'success' },
    Cancelado: { label: 'Cancelado', variant: 'destructive' },
};


export default function DistributorViewPurchaseOrderPage() {
    const params = useParams();
    const router = useRouter();
    const { firebase, userProfile } = useAuth();
    const orderId = (params as any)?.id as string;
    const { toast } = useToast();
    
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [distributor, setDistributor] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    useEffect(() => {
        if (!orderId || !firebase) {
            setIsLoading(false);
            return;
        }

        const fetchAndAssignOrder = async () => {
            setIsLoading(true);
            const orderData = await getPurchaseOrder(firebase.db, orderId);

            if (!orderData || (orderData.distributorCompanyId && userProfile?.companyId && orderData.distributorCompanyId !== userProfile.companyId)) {
                toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Você não tem permissão para ver este pedido.' });
                router.push('/distribuidor/pedidos');
                return;
            }

            // Auto-assign logic
            if (userProfile?.role === 'vendedor' && !orderData.assignedSalespersonId && orderData.status === 'Pedido') {
                try {
                    if (!firebase.db || !firebase.auth) throw new Error("Firebase não inicializado.");
                    await updatePurchaseOrder(firebase.db, firebase.auth, orderData.id, {
                        assignedSalespersonId: userProfile.uid,
                        assignedSalespersonName: userProfile.displayName,
                    });
                    toast({ title: "Pedido Atribuído!", description: `O pedido ${orderData.orderNumber} agora está sob sua responsabilidade.` });
                    orderData.assignedSalespersonId = userProfile.uid;
                    orderData.assignedSalespersonName = userProfile.displayName;
                } catch (error) {
                    console.error("Failed to assign order:", error);
                    toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atribuir o pedido.' });
                }
            }
            
            setOrder(orderData);

            const [companyData, distributorData] = await Promise.all([
                getCompany(firebase.db, orderData.companyId),
                getDistributorById(firebase.db, orderData.distributorUid || '')
            ]);
            setCompany(companyData);
            setDistributor(distributorData);
            setIsLoading(false);
        }

        fetchAndAssignOrder();
    }, [orderId, firebase, userProfile, router, toast]);
    
    const handleUpdateStatus = async (status: PurchaseOrder['status']) => {
        if (!order || !firebase.db || !firebase.auth) return;
        setIsUpdatingStatus(true);
        try {
            await updatePurchaseOrder(firebase.db, firebase.auth, order.id, { status });
            
            setOrder(prev => prev ? { ...prev, status } : null);
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

    if (isLoading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!order) {
        return <div className="flex h-screen w-full items-center justify-center text-destructive">Pedido de compra não encontrado.</div>;
    }
    
    const currentStatusInfo = statusConfig[order.status] || { label: order.status, variant: 'default' };

    return (
      <main className="p-4 md:p-8 bg-muted">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex justify-between items-center no-print">
            <div className="flex items-center gap-4">
              <h1 className="font-semibold text-xl">Detalhes do Pedido Recebido</h1>
              <Badge variant={currentStatusInfo.variant}>{currentStatusInfo.label}</Badge>
            </div>
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => router.push('/distribuidor/pedidos')}><ArrowLeft className="mr-2"/>Voltar para Lista</Button>
              <Button size="sm" onClick={handlePrint}><Printer className="mr-2"/>Imprimir</Button>
              
               {order.status === 'Pedido' && (
                  <Button size="sm" asChild>
                    <Link href={`/distribuidor/pedidos/editar/${order.id}`}>
                      <Edit className="mr-2" /> Analisar/Editar Pedido
                    </Link>
                  </Button>
                )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Ações <MoreHorizontal className="ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleUpdateStatus('Em preparação')} disabled={isUpdatingStatus || !['Pedido', 'Pendente de Aprovação do Comprador'].includes(order.status)}>
                    <Wrench className="mr-2" /> Marcar como "Em Preparação"
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateStatus('Pronto para Retirada')} disabled={isUpdatingStatus || order.status !== 'Em preparação'}>
                    <CheckCircle className="mr-2" /> Marcar como "Pronto p/ Retirada"
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateStatus('Enviado')} disabled={isUpdatingStatus || order.status !== 'Pronto para Retirada'}>
                    <Truck className="mr-2 h-4 w-4"/> Marcar como "Enviado"
                  </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => handleUpdateStatus('Recebido')} disabled={isUpdatingStatus || !['Enviado', 'Pronto para Retirada'].includes(order.status)}>
                    <PackageCheck className="mr-2 h-4 w-4"/> Marcar como "Entregue"
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleUpdateStatus('Cancelado')} disabled={isUpdatingStatus || ['Cancelado', 'Recebido'].includes(order.status)} className="text-destructive">
                    <XCircle className="mr-2" /> Cancelar Pedido
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>


          <div id="print-content" className="bg-card p-8 rounded-lg shadow-sm">
            <header className="flex justify-between items-start gap-4 mb-6">
                <div className="flex items-center gap-4">
                    {distributor?.logoUrl && <div className="relative w-24 h-16"><Image src={distributor.logoUrl} alt={distributor.displayName} fill style={{objectFit:"contain"}}/></div>}
                    <div>
                        <h2 className="font-semibold text-xl">{distributor?.displayName}</h2>
                        <p className="text-xs text-muted-foreground">{distributor?.document}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h3 className="text-xl font-semibold">Pedido de Compra</h3>
                    <p className="font-semibold text-primary">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">Data: {formatDate(order.creationDate)}</p>
                </div>
            </header>
            {order.assignedSalespersonName && (
                <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                    <User className="h-4 w-4"/>
                    Vendedor Responsável: <span className="font-semibold">{order.assignedSalespersonName}</span>
                </div>
            )}
            <Separator className="my-6"/>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <h4 className="font-semibold mb-1">CLIENTE</h4>
                    <p className="font-semibold">{company?.name}</p>
                    <p>{company?.cnpj}</p>
                    <p>{company?.email}</p>
                    <p>{company?.phone}</p>
                </div>
                <div>
                    <h4 className="font-semibold mb-1">{order.deliveryOption === 'retirada' ? 'LOCAL DE RETIRADA' : 'ENDEREÇO DE ENTREGA'}</h4>
                     {order.deliveryOption === 'entrega' ? (
                        order.deliveryAddressType === 'other' ? (
                            <>
                                <p className="font-semibold">{company?.name}</p>
                                <p>{`${order.deliveryStreet}, ${order.deliveryNumber}`}</p>
                                {order.deliveryNeighborhood && <p>{order.deliveryNeighborhood}</p>}
                                <p>{`${order.deliveryCity} - ${order.deliveryState}`}</p>
                                {order.deliveryCep && <p>CEP: {order.deliveryCep}</p>}
                                {order.deliveryReference && <p className="text-sm text-muted-foreground">Ref: {order.deliveryReference}</p>}
                            </>
                        ) : (
                            <>
                                <p className="font-semibold">{company?.name}</p>
                                <p>{`${company?.street}, ${company?.number}`}</p>
                                <p>{`${company?.city} - ${company?.state}`}</p>
                                {company?.cep && <p>CEP: {company.cep}</p>}
                            </>
                        )
                    ) : (
                        <>
                            <p className="font-semibold">{distributor?.displayName}</p>
                            <p>{`${distributor?.street || ''}, ${distributor?.number || ''}`.trim()}</p>
                            <p>{`${distributor?.city || ''} - ${distributor?.state || ''}`.trim()}</p>
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
                        {order.items.map(item => (
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
                        <span>{formatCurrency(order.totalAmount)}</span>
                    </div>
                </div>
            </div>
             {order.notes && (
                <div className="mt-8">
                    <h4 className="font-semibold">Observações:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                </div>
             )}
             <footer className="mt-24 text-center">
                <div className="inline-block">
                    <div className="border-t w-64 pt-2">
                        <p className="text-sm font-semibold">{order.creatorName}</p>
                        <p className="text-xs text-muted-foreground">Responsável pela Compra</p>
                    </div>
                </div>
             </footer>
          </div>
        </div>
      </main>
    );
}
