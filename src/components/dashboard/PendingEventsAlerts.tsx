"use client";

import { Quote, Visit } from "@/lib/data";
import { isPast, parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, FileWarning, ArrowRight, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, User } from "lucide-react";

export default function PendingEventsAlerts({ quotes, visits }: { quotes: Quote[], visits: Visit[] }) {
    const [selectedVisitReport, setSelectedVisitReport] = useState<Visit | null>(null);
    
    const pendingEvents = useMemo(() => {
        const events: any[] = [];

        // 1. Visitas aguardando orçamento
        (visits || []).forEach(v => {
            if (v.status === 'Gerar Orçamento') {
                events.push({
                    id: `visit-quote-${v.id}`,
                    type: 'VISIT_NEEDS_QUOTE',
                    title: `Visita ${v.visitNumber || ''} - Aguardando Orçamento`,
                    description: `Cliente: ${v.clientName || 'Desconhecido'}`,
                    date: v.visitDate ? parseISO(v.visitDate) : new Date(),
                    urgency: 'high',
                    icon: <FileWarning className="h-4 w-4" />,
                    link: `/orcamentos`,
                    linkText: 'Criar Orçamento',
                    visitData: v
                });
            }
        });

        // 2. Visitas Atrasadas
        (visits || []).forEach(v => {
            if (!v || !v.visitDate) return;
            try {
                const vDate = parseISO(`${v.visitDate}T23:59:59`);
                if (isValid(vDate) && isPast(vDate) && !['Finalizada', 'Gerar Orçamento'].includes(v.status)) {
                    events.push({
                        id: `visit-overdue-${v.id}`,
                        type: 'VISIT_OVERDUE',
                        title: `Visita ${v.visitNumber || ''} - Atrasada`,
                        description: `Cliente: ${v.clientName || 'Desconhecido'}`,
                        date: vDate,
                        urgency: 'medium',
                        icon: <Clock className="h-4 w-4" />,
                        link: `/visitas`,
                        linkText: 'Ver Visita'
                    });
                }
            } catch {}
        });

        // 3. O.S. Atrasadas
        const serviceOrders = (quotes || []).filter(q => q && ['Pendente', 'Atribuída', 'Em Execução', 'Agendado'].includes(q.status));
        serviceOrders.forEach(os => {
            if (!os || !os.scheduledDate) return;
            try {
                const schedDate = parseISO(`${os.scheduledDate}T23:59:59`);
                if (isValid(schedDate) && isPast(schedDate) && !['Finalizado', 'rejected'].includes(os.status)) {
                    events.push({
                        id: `os-overdue-${os.id}`,
                        type: 'OS_OVERDUE',
                        title: `O.S. ${os.quoteNumber?.replace('ORC', 'OS') || ''} - Atrasada`,
                        description: `Cliente: ${os.clientName || 'Desconhecido'}`,
                        date: schedDate,
                        urgency: 'medium',
                        icon: <AlertTriangle className="h-4 w-4" />,
                        link: `/ordem-de-servico`,
                        linkText: 'Ver O.S.'
                    });
                }
            } catch {}
        });

        // Sort events by date (oldest first, because they are more overdue)
        return events.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [quotes, visits]);

    if (pendingEvents.length === 0) {
        return null;
    }

    return (
        <Card className="border-red-500/50 bg-red-500/5 mb-4">
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Atenção Necessária ({pendingEvents.length} pendências)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 mt-2 max-h-[350px] overflow-y-auto pr-2">
                    {pendingEvents.map(event => {
                        const isHighUrgency = event.urgency === 'high';
                        
                        return (
                            <div key={event.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg bg-background shadow-sm hover:border-red-500/30 transition-colors">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm flex items-center gap-2">
                                            {event.title}
                                        </span>
                                        <Badge variant={isHighUrgency ? "destructive" : "outline"} className={!isHighUrgency ? "text-orange-600 border-orange-600" : ""}>
                                            {event.type === 'VISIT_NEEDS_QUOTE' ? 'Fazer Orçamento' : 'Atrasado'}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {event.type === 'VISIT_NEEDS_QUOTE' ? 'Finalizada em:' : 'Prazo era:'} {format(event.date, "dd/MM/yyyy", { locale: ptBR })}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate max-w-xs">
                                        {event.description}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-3 sm:mt-0 w-full sm:w-auto">
                                    {event.type === 'VISIT_NEEDS_QUOTE' ? (
                                        <Button 
                                            size="sm" 
                                            variant={isHighUrgency ? "default" : "outline"} 
                                            className="h-8 w-full sm:w-auto border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                                            onClick={() => setSelectedVisitReport(event.visitData)}
                                        >
                                            Ver Relato <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    ) : (
                                        <Link href={event.link} className="flex-1 sm:flex-none">
                                            <Button size="sm" variant={isHighUrgency ? "default" : "outline"} className="h-8 w-full border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                                                {event.linkText} <ArrowRight className="h-3 w-3 ml-1" />
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>

            {selectedVisitReport && (
                <Dialog open={!!selectedVisitReport} onOpenChange={(open) => !open && setSelectedVisitReport(null)}>
                    <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background border-border/40 shadow-2xl rounded-2xl">
                        <DialogHeader className="p-6 border-b border-border/40 bg-muted/20">
                            <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase tracking-widest text-primary">
                                <ClipboardList className="h-5 w-5" /> Relato da Visita
                            </DialogTitle>
                            <DialogDescription className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mt-2">
                                Revise os apontamentos do técnico antes de gerar o orçamento.
                            </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-sm font-semibold p-3 bg-primary/5 text-primary rounded-xl border border-primary/10">
                                    <User className="h-4 w-4" /> Cliente: {selectedVisitReport.clientName || 'Desconhecido'}
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Descrição / Motivo</h4>
                                    <p className="text-sm bg-muted/30 p-4 rounded-xl border border-border/40 whitespace-pre-wrap">
                                        {selectedVisitReport.description || 'Nenhuma descrição fornecida.'}
                                    </p>
                                </div>

                                {(selectedVisitReport.serviceReport || selectedVisitReport.notes) && (
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Relato do Técnico</h4>
                                        <p className="text-sm bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 whitespace-pre-wrap">
                                            {selectedVisitReport.serviceReport || selectedVisitReport.notes}
                                        </p>
                                    </div>
                                )}

                                {selectedVisitReport.requiredMaterials && (
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Materiais Requisitados</h4>
                                        <p className="text-sm bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 whitespace-pre-wrap">
                                            {selectedVisitReport.requiredMaterials}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-6 border-t border-border/40 bg-muted/10 gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setSelectedVisitReport(null)} className="h-10 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                                Cancelar
                            </Button>
                            <Link href={`/orcamentos/editar/novo?clientId=${selectedVisitReport.clientId}&visitId=${selectedVisitReport.id}`} className="w-full sm:w-auto">
                                <Button className="w-full sm:w-auto h-10 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                                    Gerar Orçamento Agora <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </Card>
    );
}
