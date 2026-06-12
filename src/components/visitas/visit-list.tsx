
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Visit, Supplier } from "@/lib/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, FileSignature, Trash2, ArrowUpDown, Smartphone, User, MapPin, HelpCircle, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isPast, parseISO } from "date-fns";
import { statusConfig } from "./visit-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";


type SortKey = keyof Visit | 'clientName' | 'technicianName';
type SortDirection = 'asc' | 'desc';

type VisitWithNames = Visit & { clientName: string; technicianName: string; clientCode?: string; };

type VisitListProps = {
  visits: VisitWithNames[];
  onEdit: (visit: Visit) => void;
  onDelete: (visitId: string) => void;
  onStatusChange: (visitId: string, status: Visit['status']) => void;
  sortConfig?: any;
  requestSort?: (key: any) => void;
  suppliers: Supplier[];
};

const formatDateSafe = (dateInput?: string): string => {
    if (!dateInput) return 'Data N/A';
    try {
        const datePart = dateInput.split('T')[0];
        const [year, month, day] = datePart.split('-');
        if (year && month && day) {
            return `${day}/${month}/${year}`;
        }
        return 'Data Inválida';
    } catch (e) {
        return 'Data Inválida';
    }
};

const formatClientName = (name: string) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export default function VisitList({ visits, onEdit, onDelete, onStatusChange, sortConfig, requestSort }: VisitListProps) {
  const router = useRouter();
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<string | null>(null);

  const handleGerarOrcamentoClick = (e: React.MouseEvent, visit: VisitWithNames) => {
    e.stopPropagation();
    router.push(`/orcamentos/editar/novo?clientId=${visit.clientId}`);
  };
  
  const confirmDelete = (visitId: string) => {
    setVisitToDelete(visitId);
    setAlertOpen(true);
  };

  const handleDelete = () => {
    if (visitToDelete) {
      onDelete(visitToDelete);
    }
    setAlertOpen(false);
    setVisitToDelete(null);
  };

  if (visits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed border-border/40 bg-background/20 backdrop-blur-sm text-center p-8 w-full animate-in fade-in duration-500">
        <div className="p-4 bg-primary/5 rounded-full mb-4">
          <HelpCircle className="h-10 w-10 text-primary/20" />
        </div>
        <p className="text-lg font-semibold tracking-tight text-primary/40">Nenhum compromisso agendado</p>
        <p className="text-xs font-semibold text-muted-foreground/30 uppercase tracking-widest mt-1">Ajuste os filtros ou síncronize os dados</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="grid gap-3 md:hidden w-full max-w-full overflow-hidden">
        {visits.map((visit) => {
          const visitDateTime = visit.visitDate && visit.time ? parseISO(`${visit.visitDate}T${visit.time}:00`) : null;
          const isOverdue = visitDateTime && isPast(visitDateTime) && visit.status !== 'Finalizada' && visit.status !== 'Gerar Orçamento';
          const displayStatus = isOverdue ? 'Atrasada' : visit.status;
          const currentStatus = statusConfig[displayStatus as keyof typeof statusConfig] || { label: displayStatus || 'Desconhecido', variant: 'default', icon: HelpCircle };
          
          return (
             <Card key={visit.id} className="w-full bg-background/40 backdrop-blur-md border-border/40 rounded-xl shadow-xl overflow-hidden group hover:bg-background/60 transition-all" onClick={() => onEdit(visit)}>
                <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold font-mono text-primary/40 uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-lg">{visit.visitNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-medium tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                                  {formatClientName(visit.clientName)}
                                </p>
                                {visit.clientCode && <span className="text-xs font-semibold text-muted-foreground/30 shrink-0">#{visit.clientCode}</span>}
                            </div>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl">
                              <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onEdit(visit)}} className="font-semibold">
                                <Edit className="mr-2 h-4 w-4" /> Detalhes Completos
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="opacity-10" />
                              <DropdownMenuItem onClick={(e) => {e.stopPropagation(); confirmDelete(visit.id)}} className="text-destructive font-semibold focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir Registro
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-xl bg-orange-500/10 text-orange-600 shadow-sm", isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                                <CalendarIcon className="h-4 w-4" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-xs font-semibold tracking-wide", isOverdue ? "text-destructive" : "text-foreground")}>
                                    {formatDateSafe(visit.visitDate)}
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground/40 uppercase tracking-widest">{visit.time}h</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 shadow-sm">
                                <User className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold tracking-wide text-foreground">{visit.technicianName}</span>
                                <span className="text-xs font-semibold text-muted-foreground/40 uppercase tracking-widest">Técnico Responsável</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-stone-500/10 text-stone-600 shadow-sm">
                                <MapPin className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-foreground/60 leading-tight line-clamp-2">{visit.address}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-border/40 gap-3">
                         {displayStatus === 'Gerar Orçamento' ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 rounded-xl border-yellow-500 text-yellow-600 hover:bg-yellow-50 font-semibold text-xs uppercase tracking-widest shadow-lg shadow-yellow-500/10"
                                onClick={(e) => handleGerarOrcamentoClick(e, visit)}
                            >
                                <FileSignature className="mr-2 h-4 w-4" />
                                Criar Orçamento
                            </Button>
                          ) : (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Badge 
                                    className={cn(
                                        "cursor-pointer text-xs font-bold uppercase tracking-widest h-5 px-2 rounded-full border-0",
                                        currentStatus.variant === 'success' && "bg-emerald-500/10 text-emerald-600",
                                        currentStatus.variant === 'warning' && "bg-amber-500/10 text-amber-600",
                                        currentStatus.variant === 'destructive' && "bg-rose-500/10 text-rose-600",
                                        currentStatus.variant === 'default' && "bg-primary/10 text-primary",
                                        currentStatus.variant === 'secondary' && "bg-stone-500/10 text-stone-600"
                                    )} 
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <currentStatus.icon className="mr-1 h-3 w-3" />
                                    {currentStatus.label}
                                  </Badge>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl">
                                  {Object.entries(statusConfig).map(([key, config]) => {
                                    if (key === 'Atrasada') return null;
                                    return (
                                      <DropdownMenuItem key={key} onClick={(e) => { e.stopPropagation(); onStatusChange(visit.id, key as Visit['status'])}} disabled={visit.status === key} className="font-semibold">
                                          <config.icon className="mr-2 h-4 w-4" />
                                          <span>{config.label}</span>
                                      </DropdownMenuItem>
                                    )
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                          )}
                          <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-xs font-semibold uppercase tracking-widest text-muted-foreground/40 hover:bg-primary/5 hover:text-primary transition-all" onClick={(e) => {e.stopPropagation(); onEdit(visit)}}>
                            Detalhes
                          </Button>
                    </div>
                </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="hidden md:block w-full overflow-hidden rounded-xl border border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl">
        <div className="overflow-x-auto w-full">
            <Table>
            <TableHeader className="bg-primary/[0.03] h-[34px]">
                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                    <TableHead 
                        isSortable 
                        sortDirection={sortConfig?.key === 'visitNumber' ? sortConfig.direction : null}
                        onClick={() => requestSort?.('visitNumber')}
                        className="px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary/40"
                    >
                        Nº Controle
                    </TableHead>
                    <TableHead 
                        isSortable 
                        sortDirection={sortConfig?.key === 'clientName' ? sortConfig.direction : null}
                        onClick={() => requestSort?.('clientName')}
                        className="px-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-primary/40"
                    >
                        Empresa/Cliente
                    </TableHead>
                    <TableHead 
                        isSortable 
                        sortDirection={sortConfig?.key === 'visitDate' ? sortConfig.direction : null}
                        onClick={() => requestSort?.('visitDate')}
                        className="px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary/40"
                    >
                        Agendamento
                    </TableHead>
                    <TableHead 
                        isSortable 
                        sortDirection={sortConfig?.key === 'technicianName' ? sortConfig.direction : null}
                        onClick={() => requestSort?.('technicianName')}
                        className="px-4 hidden md:table-cell text-left text-xs font-semibold uppercase tracking-[0.2em] text-primary/40"
                    >
                        Especialista
                    </TableHead>
                    <TableHead 
                        isSortable 
                        sortDirection={sortConfig?.key === 'status' ? sortConfig.direction : null}
                        onClick={() => requestSort?.('status')}
                        className="px-4 hidden sm:table-cell text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary/40"
                    >
                        Status Atual
                    </TableHead>
                    <TableHead className="w-[80px] text-right pr-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {visits.map((visit) => {
                const visitDateTime = visit.visitDate && visit.time ? parseISO(`${visit.visitDate}T${visit.time}:00`) : null;
                const isOverdue = visitDateTime && isPast(visitDateTime) && visit.status !== 'Finalizada' && visit.status !== 'Gerar Orçamento';
                
                const displayStatus = isOverdue ? 'Atrasada' : visit.status;
                const currentStatus = statusConfig[displayStatus as keyof typeof statusConfig] || { label: displayStatus || 'Desconhecido', variant: 'default', icon: HelpCircle };
                
                return (
                <TableRow key={visit.id} className="[0.03] cursor-pointer transition-all border-border/40 group h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30" onClick={() => onEdit(visit)}>
                    <TableCell className="py-0 px-4 text-xs font-mono font-semibold text-center text-primary/40 group-hover:text-primary transition-colors">
                        {visit.visitNumber}
                    </TableCell>
                    <TableCell className="py-0 px-4 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs tracking-tight text-foreground group-hover:text-primary transition-colors truncate max-w-[240px]">
                            {formatClientName(visit.clientName)}
                          </span>
                          {visit.clientCode && <span className="font-semibold text-xs text-muted-foreground/30 uppercase tracking-widest">#{visit.clientCode}</span>}
                        </div>
                    </TableCell>
                    <TableCell className="py-0 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <span className={cn("text-xs font-semibold tracking-wide", isOverdue ? "text-destructive" : "text-foreground")}>
                                {formatDateSafe(visit.visitDate)}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground/40 uppercase tracking-widest">{visit.time}h</span>
                        </div>
                    </TableCell>
                    <TableCell className="py-0 hidden md:table-cell px-4 text-left">
                        <div className="flex items-center gap-2">

                            <span className="text-xs font-semibold text-foreground/60">{visit.technicianName}</span>
                        </div>
                    </TableCell>
                    <TableCell className="py-0 hidden sm:table-cell px-4 text-center">
                        {displayStatus === 'Gerar Orçamento' ? (
                             <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 rounded-xl border-yellow-500 text-yellow-600 hover:bg-yellow-50 font-semibold text-xs uppercase tracking-widest shadow-lg shadow-yellow-500/10"
                                onClick={(e) => handleGerarOrcamentoClick(e, visit)}
                            >
                                <FileSignature className="mr-2 h-4 w-4" />
                                Orçamento
                            </Button>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Badge 
                                        className={cn(
                                            "cursor-pointer font-bold text-xs uppercase tracking-widest px-2 h-5 rounded-full border-0",
                                            currentStatus.variant === 'success' && "bg-emerald-500/10 text-emerald-600",
                                            currentStatus.variant === 'warning' && "bg-amber-500/10 text-amber-600",
                                            currentStatus.variant === 'destructive' && "bg-rose-500/10 text-rose-600",
                                            currentStatus.variant === 'default' && "bg-primary/10 text-primary",
                                            currentStatus.variant === 'secondary' && "bg-stone-500/10 text-stone-600"
                                        )}
                                    >
                                    <currentStatus.icon className="mr-1 h-3 w-3" />
                                    {currentStatus.label}
                                    </Badge>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl">
                                    {Object.entries(statusConfig).map(([key, config]) => {
                                    if (key === 'Atrasada') return null;
                                    return (
                                        <DropdownMenuItem key={key} onClick={(e) => { e.stopPropagation(); onStatusChange(visit.id, key as Visit['status'])}} disabled={visit.status === key} className="font-semibold">
                                            <config.icon className="mr-2 h-4 w-4" />
                                            <span>{config.label}</span>
                                        </DropdownMenuItem>
                                    )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </TableCell>
                    <TableCell className="py-0 text-right px-6 pr-8">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 hover:text-primary transition-all group-hover:scale-110" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(visit); }} className="font-semibold">
                            <Edit className="mr-2 h-4 w-4" /> Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="opacity-10" />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDelete(visit.id); }} className="text-destructive font-semibold focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir Visita
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </TableCell>
                </TableRow>
                )})}
            </TableBody>
            </Table>
        </div>
      </div>
      <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="w-[95vw] max-w-lg bg-background/60 backdrop-blur-3xl border-border/40 shadow-premium rounded-xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold tracking-tighter text-primary">Confirmação de Segurança</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-semibold text-muted-foreground leading-relaxed">
              Você está prestes a remover permanentemente este registro de visita. Esta ação não pode ser revertida e afetará o histórico operacional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex gap-3">
            <AlertDialogCancel className="h-12 rounded-2xl border-border/40 font-semibold hover:bg-black/5 transition-all">Manter Registro</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-12 rounded-2xl bg-destructive font-semibold tracking-tight shadow-xl shadow-destructive/20 hover:bg-destructive/90 transition-all">Sim, Confirmar Exclusão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
