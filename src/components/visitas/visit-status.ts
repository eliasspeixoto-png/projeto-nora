
import type { Visit } from "@/lib/data";
import { CheckCircle, HardHat, FileSignature, AlertCircle, Clock } from "lucide-react";

export const statusConfig: Record<Visit['status'] | 'Atrasada', { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'warning', icon: React.ElementType }> = {
    Solicitada: { label: 'Solicitada', variant: 'warning', icon: Clock },
    Agendada: { label: 'Agendada', variant: 'secondary', icon: AlertCircle },
    Atribuída: { label: 'Atribuída', variant: 'default', icon: HardHat },
    'Gerar Orçamento': { label: 'Gerar Orçamento', variant: 'warning', icon: FileSignature },
    Finalizada: { label: 'Finalizada', variant: 'success', icon: CheckCircle },
    Improdutiva: { label: 'Improdutiva', variant: 'destructive', icon: AlertCircle },
    Reagendar: { label: 'Reagendar', variant: 'warning', icon: Clock },
    Atrasada: { label: 'Atrasada', variant: 'destructive', icon: Clock },
};
