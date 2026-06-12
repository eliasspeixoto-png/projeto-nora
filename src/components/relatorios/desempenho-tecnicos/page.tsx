

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotesOnce, getTeamMembers } from '@/lib/firebase/firestore';
import type { Quote, UserProfile } from '@/lib/data';
import { Loader2, Users, Award, TrendingUp, HardHat, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

export default function DesempenhoTecnicosPage() {
    const { userProfile, firebase } = useAuth();
    const [team, setTeam] = useState<UserProfile[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userProfile?.companyId) {
            const unsubTeam = getTeamMembers(firebase.db, userProfile.companyId, setTeam, console.error);
            getQuotesOnce(firebase.db, userProfile.companyId, userProfile).then(setQuotes);
            setIsLoading(false);
            return () => unsubTeam();
        } else {
            setIsLoading(false);
        }
    }, [userProfile, firebase]);

    const techPerformance = useMemo(() => {
        const technicians = team.filter(m => ['admin', 'supervisor', 'tecnico'].includes(m.role));
        
        return technicians.map(tech => {
            const techQuotes = quotes.filter(q => q.assignedTechnicianId === tech.uid && q.status === 'Finalizado');
            const totalRevenue = techQuotes.reduce((sum, q) => sum + q.total, 0);
            
            return {
                id: tech.uid,
                name: tech.displayName,
                osCompleted: techQuotes.length,
                totalRevenue,
                averageTicket: techQuotes.length > 0 ? totalRevenue / techQuotes.length : 0,
            };
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [team, quotes]);

    const totals = useMemo(() => {
        const totalOS = techPerformance.reduce((sum, t) => sum + t.osCompleted, 0);
        const topTech = techPerformance.length > 0 ? techPerformance[0] : null;
        
        return {
            totalOS,
            topTechName: topTech?.name || 'N/A',
            topTechRevenue: topTech?.totalRevenue || 0
        };
    }, [techPerformance]);
    
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
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">O.S. Total (Equipe)</p>
                            <p className="text-2xl font-semibold font-mono">{totals.totalOS}</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <HardHat className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-background/40 backdrop-blur-sm border-border/40">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Melhor Performance (Fatur.)</p>
                            <p className="text-xl font-semibold text-orange-500 truncate max-w-[180px]">{totals.topTechName}</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                            <Award className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/40 bg-background/40 backdrop-blur-md shadow-xl overflow-hidden">
                <CardHeader className="px-6 py-6 border-b border-border/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-semibold tracking-tight">Desempenho dos Técnicos</CardTitle>
                            <CardDescription className="text-xs font-medium opacity-70">Análise de produtividade e faturamento por membro da equipe.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-primary/5 h-[34px]">
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest pl-6 h-[34px]">Técnico</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-center h-[34px]">O.S. Finalizadas</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-right h-[34px]">Faturamento Gerado</TableHead>
                                    <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-right pr-6 h-[34px]">Ticket Médio</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {techPerformance.map((tech, index) => (
                                    <TableRow key={tech.id} className="group border-border/40 transition-all h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                        <TableCell className="py-0 pl-6 text-[13px] font-semibold group-hover:text-primary transition-colors">
                                            {tech.name}
                                        </TableCell>
                                        <TableCell className="py-0 text-center text-xs font-semibold font-mono opacity-80 group-hover:opacity-100">
                                            {tech.osCompleted}
                                        </TableCell>
                                        <TableCell className="py-0 text-right text-xs font-semibold text-primary/80 group-hover:text-primary">
                                            {formatCurrency(tech.totalRevenue)}
                                        </TableCell>
                                        <TableCell className="py-0 text-right pr-6 text-xs font-medium opacity-70">
                                            {formatCurrency(tech.averageTicket)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {techPerformance.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-0 h-48 text-center text-muted-foreground italic opacity-50">
                                            Nenhum dado de técnico disponível para análise.
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
