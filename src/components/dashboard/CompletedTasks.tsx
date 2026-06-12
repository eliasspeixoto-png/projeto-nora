
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Quote, Visit, UserProfile } from "@/lib/data";
import { isWithinInterval, parseISO, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, HardHat, Construction } from "lucide-react";

type Task = (Quote & { taskType: 'os' }) | (Visit & { taskType: 'visit' });

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
};

type CompletedTasksProps = {
  serviceOrders: Quote[];
  visits: Visit[];
  userProfile: UserProfile | null;
  className?: string;
};

export default function CompletedTasks({ serviceOrders, visits, userProfile, className }: CompletedTasksProps) {
  const router = useRouter();

  const completedTasks = useMemo(() => {
    const now = new Date();
    const sixtyDaysAgo = subDays(now, 60);

    const completedOS: Task[] = serviceOrders
      .filter(os => 
        os.status === 'Finalizado' && 
        os.completionDate && 
        isWithinInterval(parseISO(os.completionDate), { start: sixtyDaysAgo, end: now })
      )
      .map(os => ({ ...os, taskType: 'os' }));

    const completedVisits: Task[] = visits
      .filter(v => 
        v.status === 'Finalizada' && 
        v.completionDate && 
        isWithinInterval(parseISO(v.completionDate), { start: sixtyDaysAgo, end: now })
      )
      .map(v => ({...v, taskType: 'visit' }));

    return [...completedOS, ...completedVisits].sort((a, b) => {
      const dateA = a.taskType === 'os' ? (a as Quote).completionDate : (a as Visit).completionDate;
      const dateB = b.taskType === 'os' ? (b as Quote).completionDate : (b as Visit).completionDate;
      if (!dateA || !dateB) return 0;
      return parseISO(dateB).getTime() - parseISO(dateA).getTime();
    });
  }, [serviceOrders, visits]);

  const getIcon = (task: Task) => {
    if (task.taskType === 'os') {
      return <HardHat className="h-4 w-4 text-muted-foreground" />;
    }
    return <Construction className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base text-xl">Serviços Concluídos</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Trabalhos finalizados nos últimos 60 dias.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 overflow-y-auto max-h-80">
        {completedTasks.map(task => {
          const isOs = task.taskType === 'os';
          const taskNumber = isOs ? (task as Quote).quoteNumber.replace('ORC', 'O.S') : (task as Visit).visitNumber;
          const clientName = isOs ? (task as Quote).clientName : (task as Visit).clientName;
          const completionDate = isOs ? (task as Quote).completionDate : (task as Visit).completionDate;
          const total = isOs ? (task as Quote).total : 0;

          return (
            <div 
              key={task.id} 
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-muted"
              onClick={() => isOs && router.push(`/orcamentos/details/${task.id}`)}
            >
                <Avatar className="hidden h-9 w-9 sm:flex">
                    <AvatarFallback className="bg-green-100 dark:bg-green-900">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                    </AvatarFallback>
                </Avatar>
                <div className="grid gap-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getIcon(task)}
                    <p className="text-[10px] sm:text-sm font-medium leading-tight truncate">{clientName} - {taskNumber}</p>
                  </div>
                   <p className="text-[9px] whitespace-nowrap text-muted-foreground">
                     Finalizado em {completionDate ? format(parseISO(completionDate), "dd/MM/yy", { locale: ptBR }) : 'N/A'}
                  </p>
                </div>
                {isOs && userProfile?.role !== 'tecnico' && (
                    <div className="ml-2 flex-shrink-0 text-sm font-semibold text-green-600">
                        {formatCurrency(total)}
                    </div>
                )}
            </div>
          )
        })}
         {completedTasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa concluída nos últimos 60 dias.</p>
        )}
      </CardContent>
    </Card>
  );
}

