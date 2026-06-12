"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotesOnce, getTeamMembers } from '@/lib/firebase/firestore';
import type { Quote, UserProfile } from '@/lib/data';
import { Loader2, ArrowUpDown, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

type SortKey = 'name' | 'osCompleted' | 'totalRevenue' | 'averageTicket';

export default function DesempenhoTecnicosPage() {
    const { userProfile, firebase } = useAuth();
    const [team, setTeam] = useState<UserProfile[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'totalRevenue', direction: 'desc' });

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            const unsubTeam = getTeamMembers(firebase.db, userProfile.companyId, setTeam, console.error);
            getQuotesOnce(firebase.db, userProfile.companyId, userProfile).then(setQuotes).finally(() => setIsLoading(false));
            return () => unsubTeam();
        } else {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, firebase.db, userProfile?.uid]);

    const techPerformance = useMemo(() => {
        const technicians = team.filter(m => ['admin', 'supervisor', 'tecnico'].includes(m.role));
        
        let analysis = technicians.map(tech => {
            const techQuotes = quotes.filter(q => q.assignedTechnicianId === tech.uid && q.status === 'Finalizado');
            const totalRevenue = techQuotes.reduce((sum, q) => sum + q.total, 0);
            
            return {
                id: tech.uid,
                name: tech.displayName,
                osCompleted: techQuotes.length,
                totalRevenue,
                averageTicket: techQuotes.length > 0 ? totalRevenue / techQuotes.length : 0,
            };
        });

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            analysis = analysis.filter(t => t.name.toLowerCase().includes(lowerSearch));
        }
        
        if (sortConfig) {
            analysis.sort((a, b) => {
                const aValue = (a as any)[sortConfig.key];
                const bValue = (b as any)[sortConfig.key];
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue, 'pt-BR') * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                return (Number(aValue) - Number(bValue)) * (sortConfig.direction === 'asc' ? 1 : -1);
            });
        }

        return analysis;
    }, [team, quotes, searchTerm, sortConfig]);
    
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
                            <CardTitle className="text-xl">Desempenho dos Técnicos</CardTitle>
                            <CardDescription className="text-xs md:text-sm">Produtividade e faturamento por profissional.</CardDescription>
                        </div>
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar técnico..."
                                className="w-full rounded-lg bg-background pl-8 h-9 text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-[600px] md:min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader sortKey="name">Técnico</SortableHeader>
                                    <SortableHeader sortKey="osCompleted" className="text-center">O.S. Finalizadas</SortableHeader>
                                    <SortableHeader sortKey="totalRevenue" className="text-right">Total Gerado</SortableHeader>
                                    <SortableHeader sortKey="averageTicket" className="text-right">Ticket Médio</SortableHeader>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {techPerformance.map((tech, index) => (
                                    <TableRow key={tech.id} className={cn("transition-colors", index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
                                        <TableCell className="py-0 px-2 text-xs font-semibold">{tech.name}</TableCell>
                                        <TableCell className="py-0 text-center font-semibold px-2 text-xs">{tech.osCompleted}</TableCell>
                                        <TableCell className="py-0 text-right font-semibold px-2 text-xs text-primary">{formatCurrency(tech.totalRevenue)}</TableCell>
                                        <TableCell className="py-0 text-right px-2 text-xs font-medium">{formatCurrency(tech.averageTicket)}</TableCell>
                                    </TableRow>
                                ))}
                                {techPerformance.length === 0 && (
                                    <TableRow><TableCell colSpan={4} className="py-0 h-32 text-center text-muted-foreground">Nenhum dado de técnico disponível para análise.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
