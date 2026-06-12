
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getDistributorClicks } from '@/lib/firebase/firestore'; 
import type { DistributorClick } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO, eachMonthOfInterval, format, subMonths, startOfYear } from 'date-fns';
import { ptBR } from "date-fns/locale";
import ClickEvolutionChart from '@/components/dashboard/ClickEvolutionChart';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function HistoricoCliquesPage() {
    const { userProfile, firebase, loading: authLoading } = useAuth();
    const [clicks, setClicks] = useState<DistributorClick[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('12months');
    const router = useRouter();
    const { toast } = useToast();
    
    const [isDetailOpen, setDetailOpen] = useState(false);
    const [detailData, setDetailData] = useState<{ month: string; clicks: DistributorClick[] } | null>(null);

    useEffect(() => {
        // Don't do anything until authentication is resolved.
        if (authLoading) {
            return;
        }
        
        // If authentication is resolved, and we have a user profile, fetch the data.
        if (userProfile?.uid && firebase.db) {
            setIsLoading(true); // Set loading true right before fetching
            const unsubClicks = getDistributorClicks(firebase.db, userProfile.uid, (data) => {
                setClicks(data);
                setIsLoading(false); // Data loaded, stop loading
            }, (error) => {
                console.error("Failed to load clicks:", error);
                toast({ variant: 'destructive', title: 'Erro ao carregar cliques.' });
                setIsLoading(false); // Error occurred, stop loading
            });

            // Cleanup the listener on component unmount
            return () => unsubClicks();
        } else {
            // If auth is resolved but there's no user, we're not loading anymore, and there's no data to show.
            setIsLoading(false);
        }
        
    }, [userProfile?.uid, firebase.db, toast, authLoading]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(amount);
    };

    const monthlyStatsForChart = useMemo(() => {
        const now = new Date();
        const unitClickValue = userProfile?.clickValue || 0;
        let startDate;
        switch (timeRange) {
            case '12months': startDate = subMonths(now, 11); break;
            case 'year': startDate = startOfYear(now); break;
            default: startDate = subMonths(now, 5);
        }
        startDate = startOfMonth(startDate);

        const months = eachMonthOfInterval({ start: startDate, end: now });

        return months.map(month => {
            const monthClicks = clicks.filter(c => {
                const clickDate = parseISO(c.timestamp);
                return isWithinInterval(clickDate, { start: startOfMonth(month), end: endOfMonth(month) });
            });
            return {
                name: format(month, 'MMM/yy', { locale: ptBR }),
                cliques: monthClicks.length,
                valor: monthClicks.length * unitClickValue
            };
        });
    }, [clicks, timeRange, userProfile?.clickValue]);
    
     const monthlySummaryForTable = useMemo(() => {
        const grouped: { [key: string]: { clickCount: number; individualClicks: DistributorClick[] } } = {};
        
        clicks.forEach(click => {
            const monthKey = format(parseISO(click.timestamp), 'yyyy-MM');
            if (!grouped[monthKey]) {
                grouped[monthKey] = { clickCount: 0, individualClicks: [] };
            }
            grouped[monthKey].clickCount++;
            grouped[monthKey].individualClicks.push(click);
        });
        
        return Object.entries(grouped)
            .map(([monthKey, data]) => {
                const monthDate = parseISO(`${monthKey}-01`);
                const planPrice = userProfile?.planPrice || 0;
                const unitClickValue = userProfile?.clickValue || 0;
                const totalClickValue = data.clickCount * unitClickValue;
                const totalToBill = totalClickValue + planPrice;

                return {
                    month: format(monthDate, 'MMMM/yyyy', { locale: ptBR }),
                    monthKey, // For sorting
                    ...data,
                    clickValue: unitClickValue,
                    totalValue: totalClickValue,
                    planPrice: planPrice,
                    totalToBill: totalToBill,
                };
            })
            .sort((a,b) => b.monthKey.localeCompare(a.monthKey));

    }, [clicks, userProfile?.clickValue, userProfile?.planPrice]);

    const handleViewDetails = (monthData: typeof monthlySummaryForTable[0]) => {
        setDetailData({ month: monthData.month, clicks: monthData.individualClicks });
        setDetailOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex h-full flex-1 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="font-semibold flex items-center gap-2 text-xl"><TrendingUp /> Histórico de Cliques</h1>
                </div>

                <ClickEvolutionChart data={monthlyStatsForChart} timeRange={timeRange} onTimeRangeChange={setTimeRange} />

                <Card>
                    <CardHeader>
                        <CardTitle>Resumo Mensal</CardTitle>
                        <CardDescription>Total de cliques e faturamento gerado por mês.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mês/Ano</TableHead>
                                    <TableHead className="text-center h-[34px]">V. Unit. Clique</TableHead>
                                    <TableHead className="text-center h-[34px]">Nº de Cliques</TableHead>
                                    <TableHead className="text-right h-[34px]">V. dos Cliques</TableHead>
                                    <TableHead className="text-right h-[34px]">V. Mensalidade</TableHead>
                                    <TableHead className="text-right h-[34px]">Total a Faturar</TableHead>
                                    <TableHead className="text-right h-[34px]">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {monthlySummaryForTable.length > 0 ? monthlySummaryForTable.map(data => (
                                <TableRow key={data.month}>
                                    <TableCell className="py-0 font-medium capitalize">{data.month}</TableCell>
                                    <TableCell className="py-0 text-center font-semibold">{formatCurrency(data.clickValue)}</TableCell>
                                    <TableCell className="py-0 text-center font-semibold">{data.clickCount}</TableCell>
                                    <TableCell className="py-0 text-right font-semibold text-green-600">{formatCurrency(data.totalValue)}</TableCell>
                                    <TableCell className="py-0 text-right font-semibold text-blue-600">{formatCurrency(data.planPrice)}</TableCell>
                                    <TableCell className="py-0 text-right font-semibold text-lg">{formatCurrency(data.totalToBill)}</TableCell>
                                    <TableCell className="py-0 text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(data)}>
                                            <Eye className="mr-2 h-4 w-4"/>
                                            Ver Detalhes
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-0 h-24 text-center">Nenhum clique registrado.</TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalhes dos Cliques - {detailData?.month}</DialogTitle>
                        <DialogDescription>Lista de empresas que clicaram em suas promoções neste período.</DialogDescription>
                    </DialogHeader>
                     <ScrollArea className="max-h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Empresa</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {detailData?.clicks.map(click => (
                                <TableRow key={click.id}>
                                    <TableCell className="py-0 text-xs">{format(parseISO(click.timestamp), 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell className="py-0 text-xs">{click.clickedByCompanyName || 'Empresa não identificada'}</TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}
