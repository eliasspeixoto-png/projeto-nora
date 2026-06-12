"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotesOnce } from '@/lib/firebase/firestore';
import type { Quote } from '@/lib/data';
import { Loader2, BarChart3, TrendingUp, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

export default function DesempenhoVendasPage() {
    const { userProfile, firebase } = useAuth();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const companyId = userProfile?.companyId;
        if (companyId && firebase.db) {
            getQuotesOnce(firebase.db, companyId, userProfile).then(data => {
                setQuotes(data.filter(q => q.status === 'Finalizado'));
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [userProfile, firebase]);

    const productPerformance = useMemo(() => {
        const productMap = new Map<string, { name: string; quantity: number; revenue: number; }>();
        quotes.forEach(quote => {
            quote.items.forEach(item => {
                const productId = item.product?.id || (item as any).productId || 'unregistered';
                const productName = item.product?.description || (item as any).description || (item as any).productDescription || 'Item não identificado';
                
                const existing = productMap.get(productId);
                if (existing) {
                    productMap.set(productId, {
                        ...existing,
                        quantity: existing.quantity + item.quantity,
                        revenue: existing.revenue + (item.total || 0),
                    });
                } else {
                    productMap.set(productId, {
                        name: productName,
                        quantity: item.quantity,
                        revenue: item.total || 0,
                    });
                }
            });
        });
        return Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
    }, [quotes]);

    const totals = useMemo(() => {
        return productPerformance.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            quantity: acc.quantity + curr.quantity
        }), { revenue: 0, quantity: 0 });
    }, [productPerformance]);
    
    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-background/40 backdrop-blur-sm border-border/40">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Receita Total Acumulada</p>
                            <p className="text-2xl font-semibold text-primary">{formatCurrency(totals.revenue)}</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-sm border-border/40">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Itens Vendidos (Total)</p>
                            <p className="text-2xl font-semibold">{totals.quantity}</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                            <Package className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/40 bg-background/40 backdrop-blur-md shadow-xl overflow-hidden">
                <CardHeader className="px-6 py-6 border-b border-border/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <BarChart3 className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-semibold tracking-tight">Desempenho de Vendas</CardTitle>
                            <CardDescription className="text-xs font-medium opacity-70">Ranking de produtos e serviços mais vendidos por receita.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-primary/5 h-[34px]">
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest pl-6 h-[34px]">Produto / Serviço</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-center h-[34px]">Quantidade Vendida</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-right pr-6 h-[34px]">Receita Gerada</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {productPerformance.map((product, index) => (
                                    <TableRow key={product.name} className="group border-border/40 transition-all h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                        <TableCell className="py-0 pl-6 text-[13px] font-semibold group-hover:text-primary transition-colors">
                                            {product.name}
                                        </TableCell>
                                        <TableCell className="py-0 text-center text-xs font-semibold font-mono opacity-80 group-hover:opacity-100">
                                            {product.quantity}
                                        </TableCell>
                                        <TableCell className="py-0 text-right pr-6 text-xs font-semibold text-primary/80 group-hover:text-primary">
                                            {formatCurrency(product.revenue)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {productPerformance.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="py-0 h-48 text-center text-muted-foreground italic opacity-50">
                                            Nenhum dado de vendas disponível para análise no momento.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
