"use client";

import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { isPast, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";
import { User, MapPin, Phone, MessageSquareText, HardHat, Construction, MoreVertical, Edit, Trash2, CheckCircle, FilePen, Clock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";


type TaskProps = {
  id: string;
  number: string;
  clientName: string;
  technicianName?: string;
  date?: string;
  time?: string;
  expectedEndDate?: string;
  expectedEndTime?: string;
  unitIdentifier?: string;
  address: string;
  phone: string;
  description?: string;
  status: string;
  value?: number;
  link: string;
  type: string;
  onEdit?: () => void;
  onAdminEdit?: () => void;
  onSchedule?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  originalDate?: string;
};

type StatusConfig = {
  [key: string]: {
    label: string;
    variant: "secondary" | "default" | "success" | "destructive" | "warning";
    icon: React.ElementType;
  };
};

const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-');
        if (year && month && day) {
            return `${day}/${month}/${year}`;
        }
        return 'Data Inválida';
    } catch (e) {
        return 'Data Inválida';
    }
};

export default function TaskCard({
  task,
  statusConfig,
  onClick
}: {
  task: TaskProps;
  statusConfig: StatusConfig;
  router: AppRouterInstance;
  onClick?: () => void;
}) {
  const isOs = task.type === 'Ordem de Serviço';
  const targetDate = task.expectedEndDate || task.date;
  const targetTime = task.expectedEndDate ? (task.expectedEndTime || '23:59') : (task.time || '23:59');
  const visitDateTime = targetDate ? parseISO(`${targetDate}T${targetTime}:00`) : null;
  const isOverdue = visitDateTime && isPast(visitDateTime) && !['Finalizado', 'Finalizada', 'rejected'].includes(task.status);
  const displayStatus = isOverdue ? 'Atrasada' : task.status;
  const currentStatus = statusConfig[displayStatus] || { label: displayStatus, variant: "secondary", icon: HardHat };
  const TaskIcon = isOs ? HardHat : Construction;

  return (
    <div className="p-6 space-y-4 cursor-pointer h-full flex flex-col group bg-background/40 backdrop-blur-3xl rounded-[2rem] shadow-premium border-none transition-all duration-300 hover:scale-[1.02] active:scale-95" onClick={onClick}>
        <div className="flex justify-between items-start gap-4">
             <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                        <TaskIcon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">{task.type}</span>
                </div>
                <div className="space-y-0.5">
                    <CardTitle className="text-xl font-bold tracking-tight truncate text-foreground/90">
                        {task.number}
                    </CardTitle>
                    {task.unitIdentifier && (
                        <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 truncate">
                            {task.unitIdentifier}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <Badge variant={currentStatus.variant} className="h-6 px-3 rounded-full font-semibold text-xs uppercase tracking-widest shrink-0 shadow-lg shadow-black/5 transition-all group-hover:scale-105">
                    {currentStatus.label}
                </Badge>
                {task.originalDate && (
                    <Badge variant="outline" className="h-5 px-2 rounded-full font-semibold text-[10px] uppercase tracking-widest shrink-0 border-amber-300 bg-amber-100 text-amber-800">
                        Reagendada
                    </Badge>
                )}
            </div>
        </div>

        <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold text-sm tracking-tight truncate text-foreground/80">{task.clientName}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                <div className="flex flex-col opacity-75">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Início</span>
                    <span className="text-[11px] font-bold text-foreground/90">{formatDate(task.date)} {task.time}</span>
                </div>
                <div className="flex flex-col opacity-75">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Previsão Término</span>
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        {task.expectedEndDate ? formatDate(task.expectedEndDate) : 'Mesmo dia'}
                    </span>
                </div>
            </div>

            <div className="flex items-start gap-3 bg-primary/5 p-3 rounded-2xl">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-[11px] font-semibold leading-tight text-foreground/60 line-clamp-2 uppercase tracking-tight">{task.address}</span>
            </div>
             
            {task.description && (
                <div className="flex items-start gap-3 opacity-40">
                    <MessageSquareText className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="text-[9px] font-semibold uppercase tracking-tight line-clamp-2">{task.description}</span>
                </div>
            )}
        </div>
       
        <div className="pt-4 border-t border-border/40 flex justify-between items-center gap-4">
            <Button variant="ghost" size="sm" className="flex-1 h-10 rounded-xl bg-primary/5 text-primary font-semibold uppercase text-[10px] tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm" onClick={(e) => {e.stopPropagation(); if(task.onEdit) task.onEdit();}}>
                Encerrar Serviço
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 transition-all shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-5 w-5 opacity-40 group-hover:opacity-100 transition-opacity"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium w-56">
                    <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => {e.stopPropagation(); if(task.onEdit) task.onEdit();}}>
                        <CheckCircle className="mr-2 h-4 w-4 text-green-600"/>
                        Executar / Finalizar
                    </DropdownMenuItem>
                    {task.onAdminEdit && (
                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => {e.stopPropagation(); task.onAdminEdit?.();}}>
                            <FilePen className="mr-2 h-4 w-4 text-primary"/>
                            Editar Detalhes (O.S)
                        </DropdownMenuItem>
                    )}
                    {task.onSchedule && (
                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={(e) => {e.stopPropagation(); task.onSchedule?.();}}>
                            <CalendarRange className="mr-2 h-4 w-4 text-primary"/>
                            Cronograma / Atribuir
                        </DropdownMenuItem>
                    )}
                    {task.canDelete && (
                        <>
                            <DropdownMenuSeparator className="bg-primary/5" />
                            <DropdownMenuItem onClick={(e) => {e.stopPropagation(); if(task.onDelete) task.onDelete();}} className="h-10 rounded-xl font-semibold text-destructive cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4"/>
                                Excluir Tarefa
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>
  );
}
