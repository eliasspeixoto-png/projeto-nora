"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotesOnce } from '@/lib/firebase/firestore';
import type { Quote } from '@/lib/data';
import { Loader2, TrendingUp, DollarSign, Percent, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { subMonths, format, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

export default function ResultadosPage() {
    const { userProfile, firebase } = useAuth();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({
        from: subMonths(new Date(), 11),
        to: new Date(),
    });

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            getQuotesOnce(firebase.db, userProfile.companyId, userProfile).then(data => {
                setQuotes(data.filter(q => q.status === 'Finalizado' && q.completionDate));
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [userProfile, firebase.db]);
    
    const monthlyData = useMemo(() => {
        if (!date?.from) return [];
        const data: { month: string; Receita: number; Lucro: number; Custo: number }[] = [];
        let currentDate = startOfMonth(date.from);
        const endDate = endOfMonth(date.to || date.from);
        
        while (currentDate <= endDate) {
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);

            const monthQuotes = quotes.filter(q => {
                if (!q.completionDate) return false;
                try {
                    const completionDate = parseISO(q.completionDate);
                    return isWithinInterval(completionDate, { start, end });
                } catch (e) {
                    return false;
                }
            });
            
            const totalRevenue = monthQuotes.reduce((sum, q) => sum + q.total, 0);
            const totalCost = monthQuotes.reduce((sum, q) => sum + q.items.reduce((itemSum, item) => itemSum + (item.product.materialPrice || 0) * item.quantity, 0), 0);
            const totalProfit = totalRevenue - totalCost;

            data.push({
                month: format(currentDate, 'MMM/yy', { locale: ptBR }),
                Receita: totalRevenue,
                Lucro: totalProfit,
                Custo: totalCost,
            });
            
            currentDate = addMonths(currentDate, 1);
        }
        return data;

    }, [quotes, date]);

    const { totalRevenue, totalProfit, profitMargin } = useMemo(() => {
        const revenue = monthlyData.reduce((sum, d) => sum + d.Receita, 0);
        const profit = monthlyData.reduce((sum, d) => sum + d.Lucro, 0);
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return { totalRevenue: revenue, totalProfit: profit, profitMargin: margin };
    }, [monthlyData]);
    
    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header com Filtro */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="font-semibold tracking-tight flex items-center gap-2 text-xl">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        Resultados Financeiros
                    </h1>
                    <p className="text-sm font-medium text-muted-foreground opacity-70">Análise de receita, lucratividade e tendências do faturamento.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center bg-background/40 backdrop-blur-sm border border-border/40 p-1 rounded-xl shadow-sm gap-1">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-[11px] font-semibold hover:bg-primary/5 transition-all"
                            onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                        >
                            Este Mês
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-[11px] font-semibold hover:bg-primary/5 transition-all"
                            onClick={() => setDate({ from: subMonths(new Date(), 11), to: new Date() })}
                        >
                            12 Meses
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 bg-background/40 backdrop-blur-sm border border-border/40 p-1 rounded-xl shadow-sm">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3">Período:</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-semibold hover:bg-primary/5 transition-all">
                                    {date?.from ? format(date.from, "MMM yyyy", { locale: ptBR }) : "Início"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar mode="single" selected={date?.from} onSelect={(d) => setDate(p => ({ from: d ?? undefined, to: p?.to }))} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <span className="text-muted-foreground/30 px-1">/</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-semibold hover:bg-primary/5 transition-all">
                                    {date?.to ? format(date.to, "MMM yyyy", { locale: ptBR }) : "Fim"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar mode="single" selected={date?.to} onSelect={(d) => setDate(p => ({ from: p?.from, to: d ?? undefined }))} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                    <CardContent className="p-5 flex items-center justify-between relative">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Faturamento Bruto</p>
                            <p className="text-2xl font-semibold text-primary">{formatCurrency(totalRevenue)}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <DollarSign className="h-6 w-6" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                    <CardContent className="p-5 flex items-center justify-between relative">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Lucro Operacional</p>
                            <p className="text-2xl font-semibold text-emerald-500">{formatCurrency(totalProfit)}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                    <CardContent className="p-5 flex items-center justify-between relative">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Margem de Contribuição</p>
                            <p className="text-2xl font-semibold text-blue-500">{profitMargin.toFixed(1)}%</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                            <Percent className="h-6 w-6" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
                    </CardContent>
                </Card>
            </div>

            {/* Gráfico de Barras */}
            <Card className="border-border/40 bg-background/40 backdrop-blur-md shadow-xl overflow-hidden p-6">
                <div className="mb-6 space-y-1">
                    <h3 className="font-semibold text-lg">Distribuição Mensal</h3>
                    <p className="text-xs text-muted-foreground">Comparativo de receita, custos e lucratividade acumulada.</p>
                </div>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis 
                                dataKey="month" 
                                fontSize={11} 
                                fontWeight={600}
                                tickLine={false} 
                                axisLine={false} 
                                padding={{ left: 10, right: 10 }}
                            />
                            <YAxis 
                                fontSize={10} 
                                fontWeight={600}
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(value) => `R$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} 
                            />
                            <Tooltip 
                                cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
                                contentStyle={{ 
                                    backgroundColor: 'hsl(var(--background))', 
                                    border: '1px solid hsl(var(--primary) / 0.1)', 
                                    borderRadius: '12px',
                                    padding: '12px',
                                    fontSize: '12px',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                                }} 
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend 
                                verticalAlign="top" 
                                align="right"
                                iconType="circle"
                                wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingBottom: '30px' }} 
                            />
                            <Bar 
                                dataKey="Receita" 
                                fill="hsl(var(--primary))" 
                                radius={[4, 4, 0, 0]} 
                                barSize={24}
                            />
                            <Bar 
                                dataKey="Lucro" 
                                fill="hsl(var(--chart-2))" 
                                radius={[4, 4, 0, 0]} 
                                barSize={24}
                            />
                            <Bar 
                                dataKey="Custo" 
                                fill="hsl(var(--chart-4))" 
                                radius={[4, 4, 0, 0]} 
                                barSize={24}
                                opacity={0.6}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
