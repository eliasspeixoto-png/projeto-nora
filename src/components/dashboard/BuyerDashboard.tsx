"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PurchaseOrder, Product } from "@/lib/data";
import { getPurchaseOrdersOnce, getProductsOnce } from "@/lib/firebase/firestore";
import { useAuth } from "@/firebase/auth/use-user";
import PurchaseStats from "@/components/dashboard/PurchaseStats";
import { useToast } from "@/hooks/use-toast";
import { isWithinInterval, startOfMonth, endOfMonth, parseISO, subMonths, format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ShoppingCart, Sparkles, AlertTriangle, ArrowRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const PurchaseChart = dynamic(() => import("@/components/dashboard/PurchaseChart"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-[180px] items-center justify-center border-border/40 bg-background/50 backdrop-blur-sm rounded-xl"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});


export default function BuyerDashboard() {
    const { userProfile, firebase } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [criticalProducts, setCriticalProducts] = useState<Product[]>([]);

    useEffect(() => {
        async function loadDashboardData() {
            if (!userProfile?.companyId || !firebase.db) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const { db } = firebase;
                const companyId = userProfile.companyId;
                
                const [purchaseOrdersData, allProducts] = await Promise.all([
                    getPurchaseOrdersOnce(db, companyId),
                    getProductsOnce(db, companyId)
                ]);

                setPurchaseOrders(purchaseOrdersData);
                
                const critical = allProducts.filter(p => (p.stockQuantity || 0) <= (p.minStockQuantity || 0));
                setCriticalProducts(critical);

            } catch (error) {
                console.error("Failed to load buyer dashboard data:", error);
                toast({ variant: 'destructive', title: 'Erro ao carregar dados', description: 'Não foi possível buscar as informações do dashboard.' });
            } finally {
                setIsLoading(false);
            }
        }

        loadDashboardData();
    }, [userProfile, firebase.db, toast]);

    const purchaseStats = useMemo(() => {
        const now = new Date();
        const startOfThisMonth = startOfMonth(now);
        return {
            pendingOrders: purchaseOrders.filter(o => ['Rascunho', 'Pedido'].includes(o.status)).length,
            approvedThisMonth: purchaseOrders.filter(o => ['Pedido', 'Recebido'].includes(o.status) && isWithinInterval(parseISO(o.creationDate), { start: startOfThisMonth, end: now })).length,
            totalSpentThisMonth: purchaseOrders.filter(o => ['Pedido', 'Recebido'].includes(o.status) && isWithinInterval(parseISO(o.creationDate), { start: startOfThisMonth, end: now })).reduce((sum, o) => sum + o.totalAmount, 0),
            overdueOrders: purchaseOrders.filter(o => o.deliveryDate && isPast(parseISO(o.deliveryDate)) && !['Recebido', 'Cancelado'].includes(o.status)).length,
        }
    }, [purchaseOrders]);

    const monthlyPurchaseData = useMemo(() => {
        const data: { month: string; fullDate: string; total: number }[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const date = subMonths(now, i);
            const monthKey = format(date, "MMM/yy", { locale: ptBR });
            const start = startOfMonth(date);
            const end = endOfMonth(date);
            
            const monthOrders = purchaseOrders.filter(o => {
                const orderDate = parseISO(o.creationDate);
                return isWithinInterval(orderDate, { start, end });
            });
            
            const total = monthOrders.reduce((sum, o) => sum + o.totalAmount, 0);
            data.push({ 
              month: monthKey, 
              fullDate: format(date, 'yyyy-MM-dd'),
              total 
            });
        }
        return data;
    }, [purchaseOrders]);
    
    if (isLoading) {
      return (
        <div className="flex h-full flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    
    return (
        <div className="flex-1 space-y-6 pb-10">
            <div className="space-y-0.5">
                <h1 className="font-semibold tracking-tight flex items-center gap-2 text-xl">
                    <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                    Meu Painel de Compras
                </h1>
                <p className="text-[12px] text-muted-foreground font-medium">Gestão de suprimentos e faturamento. Mantenha o estoque saudável.</p>
            </div>

            <PurchaseStats stats={purchaseStats} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <PurchaseChart data={monthlyPurchaseData} />
                </div>
                
                <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl flex flex-col h-full overflow-hidden">
                    <CardHeader className="py-4 px-6 border-b border-border/40">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-500">
                            <AlertTriangle className="h-4 w-4" /> Estoque Crítico
                        </div>
                        <CardDescription className="text-[10px]">Itens que precisam de reposição imediata.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[300px] no-scrollbar">
                        {criticalProducts.length > 0 ? (
                            criticalProducts.map((product) => (
                                <div key={product.id} className="p-3 rounded-xl border border-border/40 bg-primary/5 hover:bg-primary/10 transition-all flex gap-3 group/alert border-l-rose-500/50">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm bg-rose-500/10 text-rose-600">
                                        <Package className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-0.5 min-w-0 flex-1">
                                        <p className="text-xs font-semibold leading-tight truncate">{product.description}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Estoque: <span className="font-semibold text-rose-600">{product.stockQuantity || 0}</span> (Mín: {product.minStockQuantity || 0})
                                        </p>
                                    </div>
                                    <ArrowRight className="h-3 w-3 self-center text-muted-foreground/30 group-hover/alert:text-primary transition-colors" />
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
                                <Package className="h-8 w-8 text-muted-foreground" />
                                <p className="text-[10px] font-semibold uppercase">Tudo em dia!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
