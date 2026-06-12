
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getPurchaseOrdersForDistributor } from '@/lib/firebase/firestore'; 
import type { PurchaseOrder } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, DollarSign, Target, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";


const formatCurrency = (amount: number = 0) => 
    new Intl.NumberFormat("pt-BR", { 
        style: "currency", 
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);

const StatCard = ({ title, value, icon: Icon, color, description }: { title: string, value: string, icon: React.ElementType, color?: string, description: string }) => (
    <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl hover:bg-primary/5 transition-all duration-300 group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-[10px] font-semibold tracking-widest text-muted-foreground">{title}</CardTitle>
            <Icon className="h-4 w-4 transition-transform group-hover:scale-110" style={{ color: color || 'hsl(var(--primary))' }} />
        </CardHeader>
        <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight">{value}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{description}</p>
        </CardContent>
    </Card>
);

export default function SalespersonDashboard() {
    const { userProfile, firebase, company } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userProfile?.uid && company?.id && firebase.db) {
            setIsLoading(true);
            const unsubscribe = getPurchaseOrdersForDistributor(
                firebase.db,
                company.id, // Use the main company ID of the distributor
                (allOrders) => {
                    const myOrders = allOrders.filter(o => o.assignedSalespersonId === userProfile.uid);
                    setOrders(myOrders);
                    setIsLoading(false);
                },
                (error) => {
                    console.error("Failed to load salesperson orders:", error);
                    setIsLoading(false);
                }
            );

            return () => unsubscribe(); // Cleanup listener on unmount
        } else {
            setIsLoading(false);
        }
    }, [userProfile, company, firebase.db]);

    const monthlyStats = useMemo(() => {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        
        const ordersThisMonth = orders.filter(o => {
            const orderDate = parseISO(o.creationDate);
            return isWithinInterval(orderDate, { start, end });
        });

        const completedOrders = ordersThisMonth.filter(o => o.status === 'Recebido');
        const cancelledOrders = ordersThisMonth.filter(o => o.status === 'Cancelado');
        
        const totalSold = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        // Use company default as fallback
        const commissionPercentage = userProfile?.commissionPercentage ?? company?.defaultCommissionPercentage ?? 0;
        const commissionValue = totalSold * (commissionPercentage / 100);
        
        const totalConsidered = completedOrders.length + cancelledOrders.length;
        const conversionRate = totalConsidered > 0 ? (completedOrders.length / totalConsidered) * 100 : 0;
        
        return {
            salesCount: completedOrders.length,
            totalSold,
            commissionValue,
            cancelledCount: cancelledOrders.length,
            conversionRate,
            totalConsidered
        };
    }, [orders, userProfile, company]);

    const lastThreeMonthsStats = useMemo(() => {
        const now = new Date();
        const stats = [];

        for (let i = 0; i < 3; i++) {
            const targetMonth = subMonths(now, i);
            const start = startOfMonth(targetMonth);
            const end = endOfMonth(targetMonth);

            const ordersInMonth = orders.filter(o => {
                const orderDate = parseISO(o.creationDate);
                return isWithinInterval(orderDate, { start, end });
            });
            
            const completedOrders = ordersInMonth.filter(o => o.status === 'Recebido');
            const cancelledOrdersInMonth = ordersInMonth.filter(o => o.status === 'Cancelado');
            
            const totalSold = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
            const commissionPercentage = userProfile?.commissionPercentage ?? company?.defaultCommissionPercentage ?? 0;
            const commissionValue = totalSold * (commissionPercentage / 100);
            const monthlyGoal = userProfile?.monthlyGoal ?? company?.defaultMonthlyGoal ?? 0;
            const reachedGoal = totalSold >= monthlyGoal;
            const totalConsidered = completedOrders.length + cancelledOrdersInMonth.length;
            const conversionRate = totalConsidered > 0 ? (completedOrders.length / totalConsidered) * 100 : 0;

            stats.push({
                month: format(targetMonth, 'MMMM/yyyy', { locale: ptBR }),
                salesCount: completedOrders.length,
                totalSold,
                commissionValue,
                monthlyGoal,
                reachedGoal,
                conversionRate,
                totalConsidered
            });
        }
        
        return stats;
    }, [orders, userProfile, company]);


    // Use company default as fallback
    const monthlyGoal = userProfile?.monthlyGoal ?? company?.defaultMonthlyGoal ?? 0;
    const commissionPercentage = userProfile?.commissionPercentage ?? company?.defaultCommissionPercentage ?? 0;
    const goalProgress = monthlyGoal > 0 ? (monthlyStats.totalSold / monthlyGoal) * 100 : 0;

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
                    Meu Desempenho
                </h1>
                <p className="text-[12px] text-muted-foreground font-medium">Acompanhamento de metas, conversões e comissões mensais.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard 
                    title="Conversão"
                    value={`${monthlyStats.conversionRate.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                    icon={TrendingUp}
                    color="hsl(var(--chart-4))"
                    description={`${monthlyStats.salesCount} de ${monthlyStats.totalConsidered} pedidos`}
                />
                <StatCard 
                    title="Vendas Mensais"
                    value={monthlyStats.salesCount.toString()}
                    icon={CheckCircle}
                    color="hsl(var(--chart-2))"
                    description="Pedidos realizados no mês"
                />
                <StatCard 
                    title="Meta do Mês"
                    value={formatCurrency(monthlyGoal)}
                    icon={Target}
                    color="hsl(var(--chart-1))"
                    description="Sua meta atual"
                />
                <StatCard 
                    title="Comissão"
                    value={formatCurrency(monthlyStats.commissionValue)}
                    icon={DollarSign}
                    color="hsl(var(--chart-1))"
                    description={`${commissionPercentage}% sobre o total`}
                />
                <StatCard 
                    title="Vendas Perdidas"
                    value={monthlyStats.cancelledCount.toString()}
                    icon={XCircle}
                    color="hsl(var(--chart-5))"
                    description="Pedidos cancelados"
                />
            </div>
            <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="py-4 px-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                        <Target className="h-4 w-4" /> Progresso da Meta Mensal
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                    <div className="grid grid-cols-2 gap-8 mb-6">
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">Venda Realizada</p>
                            <p className="text-2xl font-semibold text-emerald-500">{formatCurrency(monthlyStats.totalSold)}</p>
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">Meta Estipulada</p>
                            <p className="text-2xl font-semibold">{formatCurrency(monthlyGoal)}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Status do Alcance</span>
                            <span className={cn("text-sm font-semibold", goalProgress >= 100 ? "text-emerald-500" : "text-primary")}>
                                {goalProgress.toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-primary/10 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className={cn(
                                    "h-full rounded-full transition-all duration-1000 ease-out",
                                    goalProgress >= 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-primary"
                                )} 
                                style={{ width: `${Math.min(goalProgress, 100)}%` }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl oview-hidden">
                <CardHeader className="py-4 px-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                        <TrendingUp className="h-4 w-4" /> Histórico de Performance (Últimos 3 Meses)
                    </div>
                </CardHeader>
                <CardContent className="px-2">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                <TableHead className="text-[10px] uppercase font-semibold tracking-wider h-[34px]">Mês</TableHead>
                                <TableHead className="text-center text-[10px] uppercase font-semibold tracking-wider h-[34px]">Vendas</TableHead>
                                <TableHead className="text-center text-[10px] uppercase font-semibold tracking-wider h-[34px]">CVS</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-semibold tracking-wider h-[34px]">Total</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-semibold tracking-wider h-[34px]">Meta</TableHead>
                                <TableHead className="text-center text-[10px] uppercase font-semibold tracking-wider h-[34px]">Meta Atingida</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-semibold tracking-wider h-[34px]">Comissão</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lastThreeMonthsStats.map(monthStat => (
                                <TableRow key={monthStat.month} className="border-border/40 hover:bg-primary/5 transition-colors h-[34px]">
                                    <TableCell className="py-0 font-semibold text-xs capitalize">{monthStat.month}</TableCell>
                                    <TableCell className="py-0 text-center text-xs font-semibold">{monthStat.salesCount}</TableCell>
                                    <TableCell className="py-0 text-center">
                                        <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-border/40 inline-block">
                                            {monthStat.conversionRate.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-0 text-right font-semibold text-xs">{formatCurrency(monthStat.totalSold)}</TableCell>
                                    <TableCell className="py-0 text-right text-xs text-muted-foreground">{formatCurrency(monthStat.monthlyGoal)}</TableCell>
                                    <TableCell className="py-0 text-center">
                                        {(() => {
                                            const percentage = monthStat.monthlyGoal > 0 
                                                ? (monthStat.totalSold / monthStat.monthlyGoal) * 100 
                                                : (monthStat.totalSold > 0 ? 100 : 0);
                                            
                                            const reached = monthStat.reachedGoal;
                                            
                                            return (
                                                <div className={cn(
                                                    "flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-lg border",
                                                    reached 
                                                        ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" 
                                                        : "text-rose-500 bg-rose-500/10 border-rose-500/20"
                                                )}>
                                                    {reached ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                                    {percentage.toFixed(0)}%
                                                </div>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell className="py-0 text-right font-semibold text-xs text-emerald-500">{formatCurrency(monthStat.commissionValue)}</TableCell>
                                </TableRow>
                            ))}
                            {lastThreeMonthsStats.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-0 text-center h-24 text-muted-foreground text-xs italic">
                                        Nenhum dado de vendas nos últimos 3 meses.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
