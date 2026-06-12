
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, MapPin, ClipboardList, CheckCircle2, AlertCircle, CalendarClock, Send } from "lucide-react";
import type { Visit } from "@/lib/data";
import { statusConfig } from "@/components/visitas/visit-status";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface VisitDetailDialogClientProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  visit: (Visit & { technicianName?: string }) | null;
  onRescheduleRequest?: (notes: string) => Promise<void>;
}

const formatDateWithDay = (dateInput?: string): string => {
    if (!dateInput) return 'Data N/A';
    try {
        const date = parseISO(dateInput);
        if (!isValid(date)) return 'Data Inválida';
        
        const formatted = format(date, "EEEE, dd/MM/yyyy", { locale: ptBR });
        // Capitalizar a primeira letra
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
        return 'Data Inválida';
    }
};

export default function VisitDetailDialogClient({ isOpen, setOpen, visit, onRescheduleRequest }: VisitDetailDialogClientProps) {
    const [isRequestingChange, setIsRequestingChange] = useState(false);
    const [changeNotes, setChangeNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!visit) return null;

    const currentStatus = statusConfig[visit.status as keyof typeof statusConfig] || {
        label: visit.status,
        icon: AlertCircle,
        variant: "secondary"
    };

    const StatusIcon = currentStatus.icon;

    const handleSubmitRequest = async () => {
        if (!changeNotes.trim() || !onRescheduleRequest) return;
        setIsSubmitting(true);
        try {
            await onRescheduleRequest(changeNotes);
            setIsRequestingChange(false);
            setChangeNotes("");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(val) => { setOpen(val); if(!val) setIsRequestingChange(false); }}>
            <DialogContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-hidden bg-background">
                {/* Banner Estilizado de Status */}
                <div className={cn(
                    "h-24 flex items-end p-6 bg-gradient-to-r",
                    visit.status === 'Finalizada' ? "from-emerald-500 to-teal-600" : 
                    visit.status === 'Solicitada' ? "from-blue-500 to-indigo-600" :
                    visit.status === 'Agendada' ? "from-amber-500 to-orange-600" :
                    "from-gray-500 to-slate-600"
                )}>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                            <StatusIcon className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="text-xl font-semibold text-white tracking-tight">
                            {currentStatus.label}
                        </h2>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest font-mono">
                                Visita #{visit.visitNumber}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-tighter">
                                ID: {visit.id.slice(0, 8)}
                            </Badge>
                        </div>
                        <DialogTitle className="text-2xl font-semibold text-foreground">
                            Detalhes do Agendamento
                        </DialogTitle>
                    </DialogHeader>

                    {/* Bloco de Data e Hora */}
                    <div className="grid grid-cols-1 gap-3">
                        <div className="bg-muted/30 p-4 rounded-xl border border-border/40 flex items-center gap-4 transition-all hover:bg-muted/50">
                            <div className="bg-primary/10 p-2.5 rounded-lg">
                                <Calendar className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block leading-none">Data agendada</span>
                                <span className="text-base font-semibold text-foreground">{formatDateWithDay(visit.visitDate)}</span>
                            </div>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl border border-border/40 flex items-center gap-4 transition-all hover:bg-muted/50">
                            <div className="bg-primary/10 p-2.5 rounded-lg">
                                <Clock className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block leading-none">Horário previsto</span>
                                <span className="text-base font-semibold text-foreground">{visit.time}h</span>
                            </div>
                        </div>
                    </div>

                    {/* Card do Técnico */}
                    <div className="bg-muted/50 p-4 rounded-2xl border flex items-center gap-4 group transition-all hover:bg-muted/80">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                            <User className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest leading-none">Técnico Responsável</p>
                            <p className="text-base font-semibold truncate text-foreground mt-1">
                                {visit.technicianName || 'Aguardando Atribuição'}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                             <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                    </div>

                    {/* Localização */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-primary">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-tight">Endereço de Atendimento</span>
                        </div>
                        <p className="text-sm text-muted-foreground pl-6 border-l-2 border-primary/20 leading-relaxed italic">
                            {visit.address}
                        </p>
                    </div>

                    {/* O que foi solicitado */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                            <ClipboardList className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-tight">O que foi solicitado</span>
                        </div>
                        <div className="bg-muted/20 p-4 rounded-xl border border-dashed text-sm text-foreground whitespace-pre-wrap leading-relaxed italic">
                            {visit.description}
                        </div>
                    </div>

                    {/* Relatório Técnico (Se Finalizado) */}
                    {visit.serviceReport && (
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="flex items-center gap-2 text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">Relatório do Técnico</span>
                            </div>
                            <p className="text-xs text-emerald-800 leading-relaxed">
                                {visit.serviceReport}
                            </p>
                        </div>
                    )}

                    {/* Footer / Ações */}
                    <div className="pt-4 border-t space-y-4">
                        {!isRequestingChange ? (
                            (visit.status === 'Agendada' || visit.status === 'Atribuída' || visit.status === 'Solicitada') && (
                                <Button 
                                    variant="outline" 
                                    className="w-full border-primary/20 text-primary hover:bg-primary/5 font-semibold h-11 rounded-xl shadow-sm"
                                    onClick={() => setIsRequestingChange(true)}
                                >
                                    <CalendarClock className="mr-2 h-4 w-4" />
                                    Solicitar Mudança de Horário
                                </Button>
                            )
                        ) : (
                            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                <Textarea 
                                    placeholder="Justifique o motivo da alteração ou sugira uma nova data/hora..."
                                    className="min-h-[100px] text-sm focus-visible:ring-primary rounded-xl"
                                    value={changeNotes}
                                    onChange={(e) => setChangeNotes(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <Button 
                                        variant="ghost" 
                                        className="flex-1 font-semibold rounded-xl"
                                        onClick={() => setIsRequestingChange(false)}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button 
                                        className="flex-1 font-semibold rounded-xl shadow-md"
                                        disabled={!changeNotes.trim() || isSubmitting}
                                        onClick={handleSubmitRequest}
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Enviar Pedido
                                    </Button>
                                </div>
                            </div>
                        )}
                        <p className="text-[10px] text-muted-foreground text-center italic">
                            * Em caso de dúvidas, favor entrar em contato com o suporte da ESP-TEC pelo WhatsApp Central.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const Loader2 = ({ className }: { className: string }) => (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);
