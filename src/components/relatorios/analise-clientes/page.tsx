

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getClients, getQuotesOnce } from '@/lib/firebase/firestore';
import type { Client, Quote } from '@/lib/data';
import { Loader2, Users, TrendingUp, Sparkles, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

export default function AnaliseClientesPage() {
    const { userProfile, firebase } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userProfile?.companyId) {
            const unsubClients = getClients(firebase.db, userProfile.companyId, setClients, console.error);
            getQuotesOnce(firebase.db, userProfile.companyId, userProfile).then(setQuotes);
            setIsLoading(false);
            return () => unsubClients();
        } else {
            setIsLoading(false);
        }
    }, [userProfile, firebase]);

    const clientAnalysis = useMemo(() => {
        return clients.map(client => {
            const clientQuotes = quotes.filter(q => q.clientId === client.id && q.status === 'Finalizado');
            const totalRevenue = clientQuotes.reduce((sum, q) => sum + q.total, 0);
            const ticketMedio = clientQuotes.length > 0 ? totalRevenue / clientQuotes.length : 0;
            const lastPurchaseDate = clientQuotes.length > 0 ?
                new Date(Math.max(...clientQuotes.map(q => parseISO(q.completionDate || q.date).getTime())))
                : null;
            
            return {
                id: client.id,
                name: client.name,
                totalRevenue,
                ticketMedio,
                quoteCount: clientQuotes.length,
                lastPurchaseDate,
            };
        })
        .filter(c => c.quoteCount > 0)
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

    }, [clients, quotes]);

    const totals = useMemo(() => {
        const totalRev = clientAnalysis.reduce((sum, c) => sum + c.totalRevenue, 0);
        const totalQty = clientAnalysis.reduce((sum, c) => sum + c.quoteCount, 0);
        return {
            activeClients: clientAnalysis.length,
            globalTicketMedio: totalQty > 0 ? totalRev / totalQty : 0
        };
    }, [clientAnalysis]);
    
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
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Clientes com Faturamento</p>
                            <p className="text-2xl font-semibold font-mono">{totals.activeClients}</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                            <Users className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-sm border-border/40">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Ticket Médio Global</p>
                            <p className="text-2xl font-semibold text-primary">{formatCurrency(totals.globalTicketMedio)}</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/40 bg-background/40 backdrop-blur-md shadow-xl overflow-hidden">
                <CardHeader className="px-6 py-6 border-b border-border/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-semibold tracking-tight">Ranking de Clientes</CardTitle>
                            <CardDescription className="text-xs font-medium opacity-70">Identificação dos clientes com maior impacto financeiro.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-primary/5 h-[34px]">
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-center w-16 h-[34px]">Pos.</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest pl-6 h-[34px]">Cliente</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-right h-[34px]">Faturamento Total</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-center h-[34px]">Compras</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-right pr-6 h-[34px]">Última Atividade</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clientAnalysis.map((client, index) => (
                                    <TableRow key={client.id} className="group border-border/40 transition-all h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                        <TableCell className="py-0 text-center">
                                            <div className={cn(
                                                "mx-auto w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                                                index === 0 ? "bg-yellow-500/20 text-yellow-600 border border-yellow-500/30" :
                                                index === 1 ? "bg-slate-400/20 text-slate-600 border border-slate-400/30" :
                                                index === 2 ? "bg-orange-400/20 text-orange-600 border border-orange-400/30" :
                                                "text-muted-foreground"
                                            )}>
                                                {index + 1}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 pl-6 text-[13px] font-semibold group-hover:text-primary transition-colors">
                                            {client.name}
                                        </TableCell>
                                        <TableCell className="py-0 text-right text-xs font-semibold text-primary/80 group-hover:text-primary">
                                            {formatCurrency(client.totalRevenue)}
                                        </TableCell>
                                        <TableCell className="py-0 text-center text-xs font-semibold font-mono opacity-80 group-hover:opacity-100">
                                            {client.quoteCount}
                                        </TableCell>
                                        <TableCell className="py-0 text-right pr-6 text-xs font-medium opacity-70">
                                            {client.lastPurchaseDate ? format(client.lastPurchaseDate, 'dd/MM/yyyy') : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {clientAnalysis.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-0 h-48 text-center text-muted-foreground italic opacity-50">
                                            Nenhum dado de cliente disponível para análise.
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
