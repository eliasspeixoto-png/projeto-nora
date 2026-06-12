
"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Quote } from "@/lib/data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ClipboardList, HardHat, FilePen } from "lucide-react";

type ActiveTasksProps = {
  tasks: Quote[];
  className?: string;
};

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'warning' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  Aprovado: { label: 'Aprovado', variant: 'success' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  'revision-pending': { label: 'Revisão Pendente', variant: 'warning' },
  Pendente: { label: 'Pendente', variant: 'warning' },
  Agendado: { label: 'Agendado', variant: 'default' },
  Atribuída: { label: 'Atribuída', variant: 'default' },
  'Em Execução': { label: 'Em Execução', variant: 'warning' },
};


export default function ActiveTasks({ tasks, className }: ActiveTasksProps) {
  const router = useRouter();

  const sortedTasks = tasks.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getIcon = (status: string) => {
    if (['Pendente', 'Atribuída', 'Em Execução', 'Agendado'].includes(status)) {
        return <HardHat className="h-4 w-4 text-muted-foreground" />;
    }
    return <FilePen className="h-4 w-4 text-muted-foreground" />;
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="text-base text-xl">Tarefas Ativas</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Todos os trabalhos que não foram finalizados.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 flex-1 overflow-y-auto">
        {sortedTasks.map(task => {
          const statusInfo = statusConfig[task.status] || { label: task.status, variant: 'secondary' };
          const isOs = ['Pendente', 'Atribuída', 'Em Execução', 'Agendado', 'revision-pending'].includes(task.status);
          const taskNumber = isOs ? task.quoteNumber.replace('ORC', 'O.S') : task.quoteNumber;

          return (
            <div 
              key={task.id} 
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-muted"
              onClick={() => router.push(`/orcamentos/details/${task.id}`)}
            >
                <Avatar className="hidden h-9 w-9 sm:flex">
                    <AvatarFallback>
                        {getIcon(task.status)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex justify-between items-center w-full min-w-0">
                  <div className="grid gap-0.5 min-w-0">
                    <p className="text-[10px] sm:text-sm font-medium leading-tight truncate">{task.clientName} - {taskNumber}</p>
                     <p className="text-[9px] whitespace-nowrap text-muted-foreground">
                       Criado em {format(new Date(task.date), "dd/MM/yy", { locale: ptBR })}
                    </p>
                  </div>
                   <div className="ml-2 flex-shrink-0">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                   </div>
                </div>
            </div>
          )
        })}
         {sortedTasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa ativa no momento.</p>
        )}
      </CardContent>
    </Card>
  );
}
