"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getClients, getQuotesOnce } from '@/lib/firebase/firestore';
import type { Client, Quote } from '@/lib/data';
import { Loader2, ArrowUpDown, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

type SortKey = 'name' | 'totalRevenue' | 'quoteCount' | 'lastPurchaseDate';

export default function AnaliseClientesPage() {
    const { userProfile, firebase } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'totalRevenue', direction: 'desc' });

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const unsubClients = getClients(firebase.db, userProfile.companyId, setClients, console.error);
            getQuotesOnce(firebase.db, userProfile.companyId, userProfile).then(setQuotes).finally(() => setIsLoading(false));
            return () => unsubClients();
        } else {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, firebase.db, userProfile?.uid]);

    const clientAnalysis = useMemo(() => {
        let analysis = clients.map(client => {
            const clientQuotes = quotes.filter(q => q.clientId === client.id && q.status === 'Finalizado');
            const totalRevenue = clientQuotes.reduce((sum, q) => sum + q.total, 0);
            const lastPurchaseDate = clientQuotes.length > 0 ?
                new Date(Math.max(...clientQuotes.map(q => parseISO(q.completionDate || q.date).getTime())))
                : null;
            
            return {
                id: client.id,
                name: client.name,
                totalRevenue,
                quoteCount: clientQuotes.length,
                lastPurchaseDate,
            };
        })
        .filter(c => c.quoteCount > 0);

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            analysis = analysis.filter(c => c.name.toLowerCase().includes(lowerSearch));
        }

        if (sortConfig) {
            analysis.sort((a, b) => {
                const aValue = (a as any)[sortConfig.key];
                const bValue = (b as any)[sortConfig.key];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue, 'pt-BR') * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                if (aValue instanceof Date && bValue instanceof Date) {
                    return (aValue.getTime() - bValue.getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                return (Number(aValue) - Number(bValue)) * (sortConfig.direction === 'asc' ? 1 : -1);
            });
        }
        
        return analysis;

    }, [clients, quotes, searchTerm, sortConfig]);
    
    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />;
        return sortConfig.direction === 'asc' ? <ArrowUpDown className="ml-2 h-4 w-4 transform rotate-180" /> : <ArrowUpDown className="ml-2 h-4" />;
    };
    
    const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
        <TableHead className={cn("group cursor-pointer py-2 px-2", className)} onClick={() => requestSort(sortKey)}>
            <div className="flex items-center">{children}{getSortIndicator(sortKey)}</div>
        </TableHead>
    );
    
    if (isLoading) {
        return <div className="flex h-full items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none">
            <Card className="flex flex-col min-w-0">
                <CardHeader className="px-4 py-6">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="min-w-0">
                            <CardTitle className="text-xl">Ranking de Clientes</CardTitle>
                            <CardDescription className="text-xs md:text-sm truncate">Ranking por faturamento e frequência de compra.</CardDescription>
                        </div>
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar cliente..."
                                className="w-full rounded-lg bg-background pl-8 h-9 text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-[650px] md:min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="py-2 px-2 w-16 h-[34px]">Posição</TableHead>
                                    <SortableHeader sortKey="name">Cliente</SortableHeader>
                                    <SortableHeader sortKey="totalRevenue" className="text-right">Faturamento Total</SortableHeader>
                                    <SortableHeader sortKey="quoteCount" className="text-center">Compras</SortableHeader>
                                    <SortableHeader sortKey="lastPurchaseDate">Última Compra</SortableHeader>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clientAnalysis.map((client, index) => (
                                    <TableRow key={client.id} className={cn("transition-colors", index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
                                        <TableCell className="py-0 font-semibold text-base px-2 text-center text-primary">{index + 1}º</TableCell>
                                        <TableCell className="py-0 px-2 text-xs font-semibold truncate max-w-[150px] md:max-w-[250px]">{client.name}</TableCell>
                                        <TableCell className="py-0 text-right font-semibold px-2 text-xs text-primary">{formatCurrency(client.totalRevenue)}</TableCell>
                                        <TableCell className="py-0 text-center px-2 text-xs">{client.quoteCount}</TableCell>
                                        <TableCell className="py-0 px-2 text-xs text-muted-foreground">
                                            {client.lastPurchaseDate ? format(client.lastPurchaseDate, 'dd/MM/yyyy') : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {clientAnalysis.length === 0 && (
                                    <TableRow><TableCell colSpan={5} className="py-0 h-32 text-center text-muted-foreground">Nenhum dado de cliente disponível para análise.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
