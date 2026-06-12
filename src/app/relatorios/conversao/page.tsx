"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotesOnce } from '@/lib/firebase/firestore';
import type { Quote } from '@/lib/data';
import { Loader2, BarChart3, Target, TrendingUp, ArrowUpRight, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { subMonths, format, parseISO, startOfMonth, endOfMonth, addMonths, startOfYear } from 'date-fns';
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, LabelList, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export default function ConversaoVendasPage() {
    const { userProfile, firebase } = useAuth();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('12months');

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            getQuotesOnce(firebase.db, userProfile.companyId, userProfile).then(data => {
                setQuotes(data);
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, firebase.db, userProfile]);

    const dateRange = useMemo(() => {
        const now = new Date();
        switch (timeRange) {
            case 'this_month': return { from: startOfMonth(now), to: endOfMonth(now) };
            case '6months': return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
            case 'year': return { from: startOfYear(now), to: endOfMonth(now) };
            case '12months':
            default: return { from: startOfMonth(subMonths(now, 11)), to: endOfMonth(now) };
        }
    }, [timeRange]);
    
    const monthlyConversionData = useMemo(() => {
        if (!dateRange.from) return [];
        const dataByMonth: { [key: string]: { sent: number; finalized: number } } = {};
        let currentDate = startOfMonth(dateRange.from);
        const endDate = endOfMonth(dateRange.to);

        while(currentDate <= endDate) {
            const monthKey = format(currentDate, "yyyy-MM");
            dataByMonth[monthKey] = { sent: 0, finalized: 0 };
            currentDate = addMonths(currentDate, 1);
        }

        quotes.forEach(quote => {
            const creationDate = parseISO(quote.date);
            const creationMonthKey = format(creationDate, "yyyy-MM");
            if (dataByMonth[creationMonthKey] && (['sent', 'Aprovado', 'Finalizado', 'rejected', 'revision-pending'].includes(quote.status))) {
                dataByMonth[creationMonthKey].sent += 1;
            }

            if (quote.status === 'Finalizado' && quote.completionDate) {
                const completionDate = parseISO(quote.completionDate);
                const completionMonthKey = format(completionDate, "yyyy-MM");
                if (dataByMonth[completionMonthKey]) {
                    dataByMonth[completionMonthKey].finalized += 1;
                }
            }
        });

        return Object.entries(dataByMonth).map(([monthKey, values]) => {
            const totalOpportunities = values.sent;
            const conversionRate = totalOpportunities > 0 ? (values.finalized / totalOpportunities) * 100 : 0;
            return {
                month: format(parseISO(`${monthKey}-01`), "MMM/yy", { locale: ptBR }),
                sent: values.sent,
                finalized: values.finalized,
                conversionRate: conversionRate,
            };
        });

    }, [quotes, dateRange]);

    const totals = useMemo(() => {
        const totalSent = monthlyConversionData.reduce((sum, d) => sum + d.sent, 0);
        const totalFinalized = monthlyConversionData.reduce((sum, d) => sum + d.finalized, 0);
        return {
            totalSent,
            globalConversion: totalSent > 0 ? (totalFinalized / totalSent) * 100 : 0
        };
    }, [monthlyConversionData]);

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header com Seletor */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="font-semibold tracking-tight flex items-center gap-2 text-xl">
                        <Target className="h-6 w-6 text-primary" />
                        Conversão de Vendas
                    </h1>
                    <p className="text-sm font-medium text-muted-foreground opacity-70">Funil de orçamentos: Oportunidades enviadas vs. O.S. concluídas.</p>
                </div>
                
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px] bg-background/40 backdrop-blur-sm border-border/40 h-10 font-semibold text-xs ring-offset-background">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40">
                        <SelectItem value="this_month" className="text-xs font-medium">Este mês</SelectItem>
                        <SelectItem value="6months" className="text-xs font-medium">Últimos 6 meses</SelectItem>
                        <SelectItem value="12months" className="text-xs font-medium">Últimos 12 meses</SelectItem>
                        <SelectItem value="year" className="text-xs font-medium">Este ano</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                    <CardContent className="p-5 flex items-center justify-between relative">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Total de Oportunidades</p>
                            <p className="text-2xl font-semibold font-mono">{totals.totalSent}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Zap className="h-6 w-6" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-sm border-border/40 overflow-hidden group">
                    <CardContent className="p-5 flex items-center justify-between relative">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Taxa de Conversão (Filtro)</p>
                            <p className="text-2xl font-semibold text-emerald-500">{formatPercent(totals.globalConversion)}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                    </CardContent>
                </Card>
            </div>

            {/* Gráfico de Barras */}
            <Card className="border-border/40 bg-background/40 backdrop-blur-md shadow-xl overflow-hidden p-6">
                <div className="mb-6 space-y-1">
                    <h3 className="font-semibold text-lg">Histórico de Performance</h3>
                    <p className="text-xs text-muted-foreground">Evolução mensal da taxa de conversão sobre as oportunidades geradas.</p>
                </div>
                <div className="h-[350px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyConversionData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis 
                                dataKey="month" 
                                fontSize={11} 
                                fontWeight={600}
                                tickLine={false} 
                                axisLine={false} 
                            />
                            <YAxis 
                                yAxisId="left"
                                fontSize={10} 
                                fontWeight={600}
                                tickLine={false} 
                                axisLine={false} 
                            />
                            <YAxis 
                                yAxisId="right"
                                orientation="right"
                                fontSize={10} 
                                fontWeight={600}
                                tickLine={false} 
                                axisLine={false}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'hsl(var(--background))', 
                                    border: '1px solid hsl(var(--primary) / 0.1)', 
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                                }} 
                            />
                            <Legend 
                                verticalAlign="top" 
                                align="right"
                                iconType="circle"
                                wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingBottom: '30px' }} 
                            />
                            <Bar yAxisId="left" dataKey="sent" name="Oportunidades" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar yAxisId="left" dataKey="finalized" name="Concluídos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar yAxisId="right" dataKey="conversionRate" name="Conversão (%)" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} barSize={20} opacity={0.6} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card className="border-border/40 bg-background/40 backdrop-blur-md shadow-xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-primary/5 h-[34px]">
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest pl-6 h-[34px]">Mês Referência</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-center h-[34px]">Oportunidades</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-center h-[34px]">Finalizados</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-right pr-6 h-[34px]">Taxa Conversão</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyConversionData.map((data, index) => (
                                    <TableRow key={index} className="group border-border/40 transition-all h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                        <TableCell className="py-0 pl-6 text-[13px] font-semibold group-hover:text-primary">
                                            {data.month}
                                        </TableCell>
                                        <TableCell className="py-0 text-center text-xs font-semibold font-mono opacity-80 group-hover:opacity-100">
                                            {data.sent}
                                        </TableCell>
                                        <TableCell className="py-0 text-center text-xs font-semibold font-mono opacity-80 group-hover:opacity-100">
                                            {data.finalized}
                                        </TableCell>
                                        <TableCell className="py-0 text-right pr-6 text-xs font-semibold text-primary group-hover:scale-105 transition-transform origin-right">
                                            {formatPercent(data.conversionRate)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
