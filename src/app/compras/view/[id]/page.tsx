
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPurchaseOrder, getCompany, getDistributorById, updatePurchaseOrder, updateProductStock } from "@/lib/firebase/firestore";
import type { PurchaseOrder, Company, UserProfile } from "@/lib/data";
import { Loader2, ArrowLeft, Printer, CheckCircle, XCircle, PackageCheck, Edit, User, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { useAuth } from "@/firebase/auth/use-user";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";


const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR') : 'N/A';

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    Rascunho: { label: 'Rascunho', bg: 'bg-stone-500/10', text: 'text-stone-600' },
    Pedido: { label: 'Pedido Enviado', bg: 'bg-blue-500/10', text: 'text-blue-600' },
    'Pendente de Aprovação do Comprador': { label: 'Revisão Pendente', bg: 'bg-orange-500/10', text: 'text-orange-600' },
    'Revisão Aprovada': { label: 'Revisão Aprovada', bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    'Em preparação': { label: 'Em Preparação', bg: 'bg-indigo-500/10', text: 'text-indigo-600' },
    'Pronto para Retirada': { label: 'Pronto p/ Retirada', bg: 'bg-amber-500/10', text: 'text-amber-600' },
    Enviado: { label: 'Enviado', bg: 'bg-sky-500/10', text: 'text-sky-600' },
    Recebido: { label: 'Recebido', bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    Cancelado: { label: 'Cancelado', bg: 'bg-rose-500/10', text: 'text-rose-600' },
};

const itemStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
    Confirmado: { label: 'Confirmado', bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    'Sem Estoque': { label: 'Sem Estoque', bg: 'bg-rose-500/10', text: 'text-rose-600' },
    Substituído: { label: 'Substituído', bg: 'bg-amber-500/10', text: 'text-amber-600' },
};


export default function ViewPurchaseOrderPage() {
    const params = useParams();
    const router = useRouter();
    const { firebase } = useAuth();
    const orderId = (params as any)?.id as string;
    const { toast } = useToast();
    
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [distributor, setDistributor] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);


    useEffect(() => {
        if (!orderId || !firebase) {
            setIsLoading(false);
            return;
        }

        async function fetchData() {
            const orderData = await getPurchaseOrder(firebase.db, orderId);
            if (!orderData) {
                setIsLoading(false);
                return;
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
        fetchData();
    }, [orderId, firebase]);

    const handleApproveReview = async () => {
        if (!order || !firebase.db || !firebase.auth) return;
        setIsActionLoading(true);
        try {
            await updatePurchaseOrder(firebase.db, firebase.auth, order.id, { status: 'Revisão Aprovada' });
            setOrder(prev => prev ? { ...prev, status: 'Revisão Aprovada' } : null);
            toast({ title: "Revisão aprovada!", description: "O pedido foi retornado ao distribuidor para preparação." });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao aprovar", description: e.message });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!order || !firebase.db || !firebase.auth) return;
        setIsActionLoading(true);
        try {
            await updatePurchaseOrder(firebase.db, firebase.auth, order.id, { status: 'Cancelado' });
            setOrder(prev => prev ? { ...prev, status: 'Cancelado' } : null);
            toast({ title: "Pedido Cancelado", variant: "destructive" });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao cancelar", description: e.message });
        } finally {
            setIsActionLoading(false);
        }
    };
    
    const handleConfirmReceipt = async () => {
        if (!order || !firebase.db || !firebase.auth) return;
        setIsActionLoading(true);
        try {
            await updatePurchaseOrder(firebase.db, firebase.auth, order.id, { status: 'Recebido', receivedDate: new Date().toISOString() });
            
            if (order.destinationLocationId) {
                const itemsForStockUpdate = order.items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                }));
                await updateProductStock(firebase.db, itemsForStockUpdate, order.destinationLocationId);
                toast({ title: "Estoque Atualizado!", description: "Os itens do pedido foram adicionados ao seu estoque." });
            }
            
            setOrder(prev => prev ? { ...prev, status: 'Recebido' } : null);
            toast({ title: "Recebimento confirmado!", description: "O pedido foi marcado como recebido." });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao confirmar", description: e.message });
        } finally {
            setIsActionLoading(false);
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
    
    const showReviewActions = order.status === 'Pendente de Aprovação do Comprador';
    const showConfirmReceiptAction = order.status === 'Enviado';
    const currentStatusInfo = statusConfig[order.status] || { label: order.status, bg: 'bg-stone-500/10', text: 'text-stone-600' };
    const showAnalysisColumn = order.items.some(item => item.itemStatus && item.itemStatus !== 'Confirmado') || showReviewActions;

    return (
      <main className="min-h-screen bg-background p-4 md:p-10 animate-in fade-in duration-700">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print px-2">
            <div className="flex items-center gap-4">
                 <div className="p-3 bg-primary/10 rounded-2xl">
                     <PackageCheck className="h-6 w-6 text-primary" />
                 </div>
                 <div className="flex flex-col">
                    <h1 className="font-bold tracking-tighter text-foreground text-2xl uppercase italic">Visualização do Pedido</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40">Registro de Compra e Movimentação</p>
                 </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest text-muted-foreground hover:bg-black/5" onClick={() => router.push('/compras')}><ArrowLeft className="mr-2 h-4 w-4"/>Voltar</Button>
              <Button variant="secondary" className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-stone-100 text-stone-600 hover:bg-stone-200 border-none shadow-sm" onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Imprimir</Button>
               {order.status === 'Rascunho' && (
                <Button className="h-10 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-premium bg-primary text-white" onClick={() => router.push(`/compras/${order.id}`)}>
                    <Edit className="mr-2 h-4 w-4"/> Editar Pedido
                </Button>
               )}
               {showConfirmReceiptAction && (
                    <Button className="h-10 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-premium bg-emerald-500 text-white hover:bg-emerald-600" onClick={handleConfirmReceipt} disabled={isActionLoading}>
                        {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PackageCheck className="mr-2 h-4 w-4"/>}
                        Confirmar Recebimento
                    </Button>
                )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-4 mb-2 no-print">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2">Status atual:</span>
            <div className={cn("px-2.5 py-1 rounded-md flex items-center gap-1.5 border-none shadow-none", currentStatusInfo.bg)}>
                <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", currentStatusInfo.text.replace('text', 'bg'))} />
                <span className={cn("text-[9px] font-bold uppercase tracking-[0.15em]", currentStatusInfo.text)}>
                    {currentStatusInfo.label}
                </span>
            </div>
          </div>

          {showReviewActions && (
              <Card className="border-none shadow-premium bg-orange-500/5 backdrop-blur-3xl rounded-2xl no-print">
                  <CardHeader className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-orange-500/10 rounded-xl">
                              <AlertCircle className="h-6 w-6 text-orange-600" />
                          </div>
                          <div>
                              <CardTitle className="text-sm font-bold uppercase tracking-widest text-orange-600">Revisão do Fornecedor</CardTitle>
                              <CardDescription className="text-xs font-semibold text-orange-500/70">O fornecedor ajustou custos ou estoque. Analise as alterações abaixo.</CardDescription>
                          </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                          <Button variant="ghost" className="h-9 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest text-rose-600 hover:bg-rose-500/10" onClick={handleCancelOrder} disabled={isActionLoading}>
                            <XCircle className="mr-2 h-4 w-4"/>
                            Cancelar Pedido
                          </Button>
                          <Button className="h-9 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-premium bg-orange-500 text-white hover:bg-orange-600" onClick={handleApproveReview} disabled={isActionLoading}>
                             {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                             Aprovar Revisão
                          </Button>
                      </div>
                  </CardHeader>
              </Card>
          )}

          <div id="print-content" className="bg-background/40 backdrop-blur-3xl rounded-3xl border border-border/40 shadow-premium p-8 md:p-12 transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 no-print" />
            
            <header className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 relative">
                <div className="flex items-center gap-6">
                    {company?.logoUrl && <div className="relative w-32 h-20 bg-white/50 backdrop-blur-sm p-3 rounded-2xl shadow-inner border border-white"><Image src={company.logoUrl} alt={company.name} fill style={{objectFit:"contain"}} className="p-2"/></div>}
                    <div className="flex flex-col">
                        <h2 className="font-bold text-2xl tracking-tighter text-foreground">{company?.name}</h2>
                        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em] mt-1">{company?.cnpj}</p>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end">
                    <h3 className="text-xs font-bold uppercase tracking-[0.4em] text-primary/30 mb-2">Pedido de Compra</h3>
                    <p className="text-3xl font-black tracking-tighter text-primary">{order.orderNumber}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Emissão: {formatDate(order.creationDate)}</p>
                </div>
            </header>

            {order.assignedSalespersonName && (
                <div className="text-[10px] uppercase font-bold tracking-widest text-primary/60 mb-8 flex items-center gap-2 bg-primary/5 w-fit px-4 py-2 rounded-xl border border-border/40">
                    <User className="h-3.5 w-3.5"/>
                    Vendedor Responsável: <span className="text-foreground ml-1">{order.assignedSalespersonName}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-1 bg-primary rounded-full" />
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40">Distribuidor</h4>
                    </div>
                    <div className="pl-3">
                        <p className="font-bold text-lg tracking-tight">{distributor?.displayName || 'Distribuidor não encontrado'}</p>
                        <p className="text-xs font-semibold text-muted-foreground mt-1 tracking-tight italic">{[distributor?.email, distributor?.phone].filter(Boolean).join(' • ')}</p>
                    </div>
                </div>
                 <div className="space-y-4 text-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-1 bg-primary rounded-full" />
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40">Logística de Entrega</h4>
                    </div>
                    <div className="pl-3">
                        {order.deliveryOption === 'entrega' ? (
                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Remessa via Transportadora</p>
                                <p className="text-xs font-semibold text-muted-foreground tracking-tight leading-relaxed">
                                    {[
                                        order.deliveryAddressType === 'other' ? order.deliveryStreet : company?.street,
                                        order.deliveryAddressType === 'other' ? order.deliveryNumber : company?.number,
                                        order.deliveryAddressType === 'other' ? order.deliveryNeighborhood : company?.neighborhood,
                                        order.deliveryAddressType === 'other' ? order.deliveryCity : company?.city,
                                        order.deliveryAddressType === 'other' ? order.deliveryState : company?.state,
                                        order.deliveryAddressType === 'other' ? `CEP ${order.deliveryCep}` : `CEP ${company?.cep}`,
                                    ].filter(Boolean).join(' • ')}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs font-bold uppercase tracking-widest px-3 py-1 bg-stone-100 text-stone-600 w-fit rounded-lg">Retirada no Local (FOB)</p>
                        )}
                    </div>
                 </div>
            </div>
             <div className="mt-8">
             <div className="border border-border/40 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-primary/[0.03] border-none">
                        <TableRow className="hover:bg-transparent h-[40px]">
                            <TableHead className="w-[120px] px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[40px]">Part Number</TableHead>
                            <TableHead className="px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[40px]">Especificação Técnica</TableHead>
                            <TableHead className="w-24 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[40px]">Qtd</TableHead>
                            {showAnalysisColumn && <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[40px]">Análise Técnica</TableHead>}
                            <TableHead className="w-32 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[40px]">Vl. Unitário</TableHead>
                            <TableHead className="w-32 px-6 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 h-[40px]">Subtotal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.items.map(item => (
                            <TableRow key={item.productId} className={cn(
                                "border-border/40 transition-all group h-[40px] hover:bg-primary/[0.02]",
                                item.itemStatus === 'Substituído' && 'bg-amber-500/5',
                                item.itemStatus === 'Sem Estoque' && 'bg-rose-500/5 opacity-60 line-through'
                            )}>
                                <TableCell className="py-3 px-6 font-mono text-[10px] font-bold tracking-widest text-primary/60">{item.productCode}</TableCell>
                                <TableCell className="py-3 px-6 text-xs font-bold tracking-tight text-foreground">{item.productDescription}</TableCell>
                                <TableCell className="py-3 text-center font-bold text-xs">{item.quantity} <span className="text-[10px] text-muted-foreground normal-case font-semibold ml-1">{item.unit}</span></TableCell>
                                {showAnalysisColumn && (
                                     <TableCell className="py-3 px-2">
                                        {item.itemStatus ? (
                                            <div className={cn("px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 border-none", itemStatusConfig[item.itemStatus]?.bg)}>
                                                <div className={cn("h-1 w-1 rounded-full", itemStatusConfig[item.itemStatus]?.text.replace('text', 'bg'))} />
                                                <span className={cn("text-[9px] font-bold uppercase tracking-wider", itemStatusConfig[item.itemStatus]?.text)}>
                                                    {itemStatusConfig[item.itemStatus]?.label}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">Pendente</span>
                                        )}
                                        {item.distributorNotes && (
                                            <p className="text-[10px] text-primary/40 font-semibold mt-1.5 italic tracking-tight leading-snug">
                                                "{item.distributorNotes}"
                                            </p>
                                        )}
                                    </TableCell>
                                )}
                                <TableCell className="py-3 text-right font-bold text-xs">{formatCurrency(item.unitCost)}</TableCell>
                                <TableCell className="py-3 px-6 text-right font-black text-xs text-foreground">{formatCurrency(item.totalCost)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            </div>
            <div className="mt-8 flex justify-end">
                <div className="w-full max-w-sm p-6 bg-primary/[0.03] rounded-2xl border border-border/40">
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40">Total Consolidado</span>
                        <span className="text-2xl font-black tracking-tighter text-foreground">{formatCurrency(order.totalAmount)}</span>
                    </div>
                </div>
            </div>
             {order.notes && (
                <div className="mt-12 p-6 bg-stone-500/[0.03] rounded-2xl border border-stone-500/5">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-stone-500/40" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-500/50">Notas e Observações</h4>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground whitespace-pre-wrap leading-relaxed italic">{order.notes}</p>
                </div>
             )}
             <footer className="mt-20 text-center relative no-print">
                <div className="inline-block relative">
                    <div className="h-1 w-24 bg-primary/20 mx-auto rounded-full mb-4" />
                    <div className="pt-2">
                        <p className="text-xs font-bold text-foreground uppercase tracking-widest">{order.creatorName}</p>
                        <p className="text-[9px] font-bold text-primary/30 uppercase tracking-[0.2em] mt-1">Responsável pela Emissão</p>
                    </div>
                </div>
             </footer>
          </div>
        </div>
      </main>
    );
}

    