
import type { Quote } from "@/lib/data";
import { CheckCircle, Clock, AlertTriangle, HardHat, Construction, Calendar, FilePen } from "lucide-react";

export const osStatusConfig: Record<Quote['status'], { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'warning', isFinished: boolean }> = {
  draft: { label: 'Rascunho', variant: 'secondary', isFinished: false },
  sent: { label: 'Enviado', variant: 'default', isFinished: false },
  'revision-pending': { label: 'Revisão Pendente', variant: 'warning', isFinished: false },
  Aprovado: { label: 'Aprovado', variant: 'success', isFinished: false },
  rejected: { label: 'Rejeitado', variant: 'destructive', isFinished: true },
  Pendente: { label: 'Pendente', variant: 'warning', isFinished: false },
  Agendado: { label: 'Agendada', variant: 'default', isFinished: false },
  Atribuída: { label: 'Atribuída', variant: 'default', isFinished: false },
  'Em Execução': { label: 'Em Execução', variant: 'warning', isFinished: false },
  Finalizado: { label: 'Finalizada', variant: 'success', isFinished: true },
  Devolvida: { label: 'Devolvida', variant: 'destructive', isFinished: false },
  Atrasada: { label: 'Atrasada', variant: 'destructive', isFinished: false },
};
