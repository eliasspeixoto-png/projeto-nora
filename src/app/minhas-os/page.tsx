"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase/auth/use-user";
import { getQuotes, getVisits, deleteQuote, deleteVisit, getTeamMembers, updateVisit, addVisit, updateQuote } from "@/lib/firebase/firestore";
import type { Quote, Visit, UserProfile, Client, QuoteData } from "@/lib/data";
import { Loader2, HardHat, Construction } from "lucide-react";
import TaskCard from "@/components/minhas-tarefas/task-card";
import { statusConfig as visitStatusConfig } from "@/components/visitas/visit-status";
import { osStatusConfig } from "@/components/ordem-de-servico/os-status-config";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import AddEditVisitDialog from "@/components/visitas/add-edit-visit-dialog";
import ScheduleServiceDialog from "@/components/ordem-de-servico/schedule-dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";


type Task = (Quote & { taskType: 'os' }) | (Visit & { taskType: 'visit' });

export default function MinhasTarefasPage() {
  const { userProfile, company, firebase } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const { toast } = useToast();
  
  const [isVisitDialogOpen, setVisitDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | undefined>(undefined);
  const [isScheduleOpen, setScheduleOpen] = useState(false);
  const [taskToSchedule, setTaskToSchedule] = useState<Task | null>(null);

  useEffect(() => {
    if (!userProfile?.companyId || !userProfile.uid || !firebase.db) {
      setIsLoading(false);
      return;
    }

    const { db } = firebase;
    const companyId = userProfile.companyId;
    const userId = userProfile.uid;
    const userRole = userProfile.role;

    const osStatusToFetch: Quote['status'][] = ['Pendente', 'Atribuída', 'Em Execução', 'Agendado', 'revision-pending', 'Devolvida', 'Atrasada'];
    const visitStatusToFetch: Visit['status'][] = ['Agendada', 'Atribuída', 'Reagendar'];

    const unsubVisits = getVisits(db, companyId, userProfile, (allVisits) => {
        let myVisits: Visit[];
        if (userRole === 'admin' || userRole === 'supervisor') {
            myVisits = allVisits.filter(v => visitStatusToFetch.includes(v.status));
        } else {
            myVisits = allVisits.filter(v => visitStatusToFetch.includes(v.status) && v.technicianId === userId);
        }
        const visitTasks = myVisits.map(v => ({ ...v, taskType: 'visit' as const }));
        setTasks(currentTasks => {
            const otherTasks = currentTasks.filter(t => t.taskType !== 'visit');
            return [...otherTasks, ...visitTasks];
        });
        setIsLoading(false);
    }, console.error);

    const unsubOS = getQuotes(db, companyId, userProfile, (allQuotes) => {
        const myOS = allQuotes
          .filter(q => 
            osStatusToFetch.includes(q.status) && 
            (userRole === 'admin' || userRole === 'supervisor' || q.assignedTechnicianId === userId)
          )
          .map(q => ({ ...q, taskType: 'os' as const }));

        setTasks(currentTasks => {
            const otherTasks = currentTasks.filter(t => t.taskType !== 'os');
            return [...otherTasks, ...myOS];
        });
        setIsLoading(false);
    }, console.error);
    
    const unsubTeam = getTeamMembers(db, companyId, setTeamMembers, console.error);

    return () => {
      unsubOS();
      unsubVisits();
      unsubTeam();
    };
  }, [userProfile?.companyId, userProfile?.uid, userProfile?.role, firebase.db, firebase]);
  
  const { visitTasks, osTasks } = useMemo(() => {
    const visits = tasks.filter(t => t.taskType === 'visit') as (Visit & { taskType: 'visit' })[];
    const os = tasks.filter(t => t.taskType === 'os') as (Quote & { taskType: 'os' })[];

    const sortFn = (a: Task, b: Task) => {
        const dateA = a.taskType === 'os' ? (a as Quote).scheduledDate : (a as Visit).visitDate;
        const dateB = b.taskType === 'os' ? (b as Quote).scheduledDate : (b as Visit).visitDate;
        const timeA = a.taskType === 'os' ? (a as Quote).scheduledTime : (a as Visit).time;
        const timeB = b.taskType === 'os' ? (b as Quote).scheduledTime : (b as Visit).time;
        
        const dateTimeA = dateA && timeA ? new Date(`${dateA}T${timeA}`) : (a.taskType === 'os' ? new Date((a as Quote).date) : new Date((a as Visit).creationDate));
        const dateTimeB = dateB && timeB ? new Date(`${dateB}T${timeB}`) : (b.taskType === 'os' ? new Date((b as Quote).date) : new Date((b as Visit).creationDate));

        return dateTimeA.getTime() - dateTimeB.getTime();
    };

    return {
        visitTasks: visits.sort(sortFn),
        osTasks: os.sort(sortFn),
    };
  }, [tasks]);


  const handleTaskClick = (task: Task) => {
    if (task.taskType === 'os') {
      router.push(`/ordem-de-servico/executar/${task.id}`);
    } else {
      setEditingVisit(task as Visit);
      setVisitDialogOpen(true);
    }
  };
  
  const handleAdminEdit = (task: Task) => {
      if (task.taskType === 'os') {
          router.push(`/orcamentos/editar/${task.id}`);
      } else {
          setEditingVisit(task as Visit);
          setVisitDialogOpen(true);
      }
  }

  const confirmDelete = (task: Task) => {
    setTaskToDelete(task);
    setAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!taskToDelete || !firebase.db) return;
    try {
        if(taskToDelete.taskType === 'os') {
            await deleteQuote(firebase.db, taskToDelete.id);
        } else {
            await deleteVisit(firebase.db, taskToDelete.id);
        }
        toast({ title: "Sucesso!", description: "Tarefa excluída." });
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Erro ao excluir", description: error.message });
    } finally {
        setAlertOpen(false);
        setTaskToDelete(null);
    }
  };

  const handleSchedule = (task: Task) => {
    setTaskToSchedule(task);
    setScheduleOpen(true);
  };

  const handleConfirmSchedule = async (data: any) => {
    if (!taskToSchedule || !firebase.db || !firebase.auth) return;

    try {
        if (taskToSchedule.taskType === 'os') {
            const tech = teamMembers.find(t => t.uid === data.technicianId);
            const newStatus = data.technicianId ? 'Atribuída' : 'Agendado';
            
            const updatePayload: any = {
                status: newStatus as Quote['status'],
                scheduledDate: data.date,
                scheduledTime: data.time,
                executionStartDate: data.date,
                executionStartTime: data.time,
                schedulingNotes: data.notes,
                assignedTechnicianId: data.technicianId || '',
                assignedTechnicianName: tech?.displayName || 'Não atribuído',
                assignedAt: data.technicianId ? new Date().toISOString() : null,
                statusHistory: [
                    ...(taskToSchedule.statusHistory || []),
                    {
                        status: newStatus,
                        changedAt: new Date().toISOString(),
                        changedBy: userProfile?.uid,
                        notes: data.technicianId 
                            ? `O.S. Atribuída ao técnico ${tech?.displayName || 'desconhecido'}` 
                            : `O.S. Agendada para ${data.date} às ${data.time}`
                    }
                ]
            };

            if (data.expectedEndDate) {
                updatePayload.expectedEndDate = data.expectedEndDate;
                updatePayload.expectedEndTime = data.expectedEndTime || '18:00';
            }
            if (data.unitIdentifier) {
                updatePayload.unitIdentifier = data.unitIdentifier;
            }

            await updateQuote(firebase.db, firebase.auth, taskToSchedule.id, updatePayload);
            toast({ title: 'O.S. Atualizada!', description: data.technicianId ? 'Técnico atribuído com sucesso.' : 'Serviço agendado.' });
        }
        setScheduleOpen(false);
    } catch (error: any) {
        toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
    }
  };
  
  const onVisitSaved = async (visitData: any, visitId?: string) => {
    if (!userProfile?.companyId || !firebase.db || !firebase.auth) return;
    try {
        if(visitId) {
            await updateVisit(firebase.db, firebase.auth, visitId, visitData);
            toast({ title: "Visita atualizada com sucesso!"});
        } else {
            await addVisit(firebase.db, firebase.auth, { ...visitData, companyId: userProfile.companyId });
            toast({ title: "Visita agendada com sucesso!"});
        }
        setVisitDialogOpen(false);
    } catch (err: any) {
        toast({ variant: "destructive", title: "Erro ao salvar", description: err.message });
    }
  };


  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const renderTaskList = (taskList: Task[], title: string, icon: React.ReactNode) => (
    <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-semibold flex items-center gap-3 tracking-tighter opacity-80">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    {icon}
                </div>
                {title}
            </h2>
            <Badge className="h-6 px-4 rounded-full font-semibold text-[10px] uppercase tracking-widest bg-primary/10 text-primary border-none">
                {taskList.length} {taskList.length === 1 ? 'Tarefa' : 'Tarefas'}
            </Badge>
        </div>
        
        {taskList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-border/40 p-16 bg-background/20 backdrop-blur-3xl text-center">
                <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-primary/20" />
                </div>
                <p className="text-muted-foreground font-semibold uppercase tracking-widest text-xs">Tudo em dia! Nenhuma tarefa pendente.</p>
            </div>
        ) : (
             <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {taskList.map(task => {
                    const isOs = task.taskType === 'os';
                    const canDelete = userProfile?.role === 'admin' || userProfile?.role === 'supervisor';
                    
                    const taskProps = {
                        id: task.id,
                        number: isOs ? (task as Quote).quoteNumber.replace('ORC', 'O.S') : (task as Visit).visitNumber,
                        clientName: isOs ? (task as Quote).clientName : (task as Visit).clientName || 'Cliente não encontrado',
                        technicianName: isOs ? (task as Quote).assignedTechnicianName : (task as Visit).technicianName,
                        date: isOs ? (task as Quote).scheduledDate : (task as Visit).visitDate,
                        time: isOs ? (task as Quote).scheduledTime : (task as Visit).time,
                        expectedEndDate: isOs ? (task as Quote).expectedEndDate : undefined,
                        expectedEndTime: isOs ? (task as Quote).expectedEndTime : undefined,
                        unitIdentifier: isOs ? (task as Quote).unitIdentifier : undefined,
                        address: isOs ? (task as Quote).notes || 'Consulte os detalhes' : (task as Visit).address,
                        phone: 'Consulte detalhes',
                        description: isOs ? (task as Quote).schedulingNotes : (task as Visit).description,
                        status: task.status,
                        value: isOs ? (task as Quote).total : undefined,
                        link: isOs ? `/ordem-de-servico/executar/${task.id}` : `/visitas?abrir=${task.id}`,
                        type: isOs ? 'Ordem de Serviço' : 'Visita Técnica',
                        onEdit: () => handleTaskClick(task),
                        onAdminEdit: (userProfile?.role === 'admin' || userProfile?.role === 'supervisor') ? () => handleAdminEdit(task) : undefined,
                        onSchedule: isOs ? () => handleSchedule(task) : undefined,
                        onDelete: () => confirmDelete(task),
                        canDelete: canDelete,
                        originalDate: isOs ? (task as Quote).originalDate : (task as Visit).originalDate
                    };

                    const currentStatusConfig = isOs ? osStatusConfig : visitStatusConfig;

                    return (
                        <div key={task.id} className="h-full">
                            <TaskCard 
                                task={taskProps} 
                                statusConfig={currentStatusConfig as any} 
                                router={router}
                                onClick={() => handleTaskClick(task)}
                            />
                        </div>
                    );
                })}
            </div>
        )}
    </div>
  );

  return (
    <>
    <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
      <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
            <div className="space-y-1">
                <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
                    <CheckCircle className="text-primary h-8 w-8" />
                    Minhas Tarefas
                </h1>

            </div>
        </div>
      </header>
      
      <div className="flex-1 px-4 md:px-8 pb-24 space-y-12 mt-6">
        {renderTaskList(visitTasks, 'Visitas Técnicas', <Construction />)}
        <div className="h-px bg-primary/5 w-full" />
        {renderTaskList(osTasks, 'Ordens de Serviço', <HardHat />)}
      </div>
    </div>

     <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="w-[95vw] max-w-lg border border-border/40 bg-background rounded-[2rem] shadow-2xl">
            <AlertDialogHeader className="space-y-3">
                <AlertDialogTitle className="text-2xl font-semibold tracking-tighter uppercase opacity-80">Excluir Tarefa?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-medium">Esta tarefa será removida permanentemente. Verifique se a execução já não foi iniciada.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-6">
                <AlertDialogCancel className="w-full sm:w-auto h-12 rounded-xl font-semibold border-border/40">Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto h-12 rounded-xl font-semibold text-white shadow-lg shadow-destructive/20 transition-all active:scale-95">Excluir</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

     <AddEditVisitDialog
        isOpen={isVisitDialogOpen}
        setOpen={setVisitDialogOpen}
        onVisitSaved={onVisitSaved}
        visit={editingVisit}
        clients={[]}
        teamMembers={teamMembers}
        allVisits={visitTasks as any}
      />

      <ScheduleServiceDialog
        isOpen={isScheduleOpen}
        setOpen={setScheduleOpen}
        onSchedule={handleConfirmSchedule}
        quoteNumber={taskToSchedule?.taskType === 'os' ? (taskToSchedule as Quote).quoteNumber : ''}
        teamMembers={teamMembers}
        currentTechnicianId={taskToSchedule?.taskType === 'os' ? (taskToSchedule as Quote).assignedTechnicianId : undefined}
        currentOS={taskToSchedule?.taskType === 'os' ? taskToSchedule as Quote : null}
        canChangeTechnician={userProfile?.role === 'admin' || userProfile?.role === 'supervisor'}
      />
    </>
  );
}
