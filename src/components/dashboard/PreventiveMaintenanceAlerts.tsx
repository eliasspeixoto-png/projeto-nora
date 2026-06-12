"use client";

import { Quote } from "@/lib/data";
import { isPast, isWithinInterval, addDays, parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Calendar, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { updateQuote } from "@/lib/firebase/firestore";
import { useAuth } from "@/firebase/auth/use-user";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function PreventiveMaintenanceAlerts({ quotes, showAll = false }: { quotes: Quote[], showAll?: boolean }) {
    const { firebase } = useAuth();
    const { toast } = useToast();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const dueMaintenances = quotes.filter(q => {
        if (!q.requiresPreventiveMaintenance || q.preventiveMaintenanceDone || !q.nextPreventiveMaintenanceDate) {
            return false;
        }
        
        const nextDate = parseISO(q.nextPreventiveMaintenanceDate);
        if (!isValid(nextDate)) return false;
        
        if (showAll) return true;
        
        const now = new Date();
        const thirtyDaysFromNow = addDays(now, 30);
        
        return isPast(nextDate) || isWithinInterval(nextDate, { start: now, end: thirtyDaysFromNow });
    }).sort((a, b) => {
        const dateA = parseISO(a.nextPreventiveMaintenanceDate!);
        const dateB = parseISO(b.nextPreventiveMaintenanceDate!);
        return dateA.getTime() - dateB.getTime();
    });

    const handleMarkAsDone = async (quote: Quote) => {
        if (!firebase.db || !firebase.auth) return;
        setLoadingId(quote.id);
        try {
            await updateQuote(firebase.db, firebase.auth, quote.id, {
                preventiveMaintenanceDone: true
            });
            toast({ title: "Manutenção marcada como resolvida" });
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao atualizar status" });
        } finally {
            setLoadingId(null);
        }
    };

    if (dueMaintenances.length === 0) {
        return null; // Ocultar se não houver alertas
    }

    return (
        <Card className={showAll ? "border-none shadow-none" : "border-orange-500/50 bg-orange-500/5"}>
            <CardHeader className="pb-2">
                <CardTitle className={`text-base flex items-center gap-2 ${showAll ? "text-primary" : "text-orange-600"}`}>
                    <Wrench className="h-4 w-4" />
                    {showAll ? "Todas as Manutenções Agendadas" : "Manutenções Preventivas a Vencer (Próximos 30 dias)"}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 mt-2">
                    {dueMaintenances.map(os => {
                        const nextDate = parseISO(os.nextPreventiveMaintenanceDate!);
                        const overdue = isPast(nextDate);
                        
                        return (
                            <div key={os.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg bg-background">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{os.clientName}</span>
                                        <Badge variant={overdue ? "destructive" : "outline"} className={overdue ? "" : "text-orange-600 border-orange-600"}>
                                            {overdue ? "Atrasada" : "A Vencer"}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Prazo: {format(nextDate, "dd/MM/yyyy", { locale: ptBR })}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate max-w-xs">
                                        Origem: {os.quoteNumber.replace('ORC', 'OS')}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-3 sm:mt-0 w-full sm:w-auto">
                                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none h-8" onClick={() => handleMarkAsDone(os)} disabled={loadingId === os.id}>
                                        <CheckCircle2 className="h-4 w-4 mr-1" /> Baixar
                                    </Button>
                                    <Link href={`/orcamentos`} className="flex-1 sm:flex-none">
                                        <Button size="sm" className="h-8 w-full">
                                            Nova OS <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
