"use client";

import { Clock, AlertTriangle, PlayCircle, UserCheck, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type OperationalStatsData = {
    pendingOS: number;
    assignedOS: number;
    inExecution: number;
    overdueTasks: number;
    totalPreventiveMaintenances?: number;
};

type OperationalStatsProps = {
  stats: OperationalStatsData;
  onViewPreventiveMaintenances?: () => void;
};

export default function OperationalStats({ stats, onViewPreventiveMaintenances }: OperationalStatsProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-5 gap-2">
      <Card className="cursor-pointer shadow-md hover:shadow-yellow-500/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/ordem-de-servico')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">O.S. a Agendar</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-yellow-500">{stats.pendingOS}</div>
          <p className="text-[10px] text-muted-foreground">Aguardando agendamento</p>
        </CardContent>
      </Card>
      <Card className="cursor-pointer shadow-md hover:shadow-blue-500/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/ordem-de-servico')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">O.S. Atribuídas</CardTitle>
          <UserCheck className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-blue-500">{stats.assignedOS}</div>
           <p className="text-[10px] text-muted-foreground">Aguardando execução</p>
        </CardContent>
      </Card>
      <Card className="cursor-pointer shadow-md hover:shadow-green-500/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/ordem-de-servico')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">O.S. em Execução</CardTitle>
          <PlayCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-green-500">{stats.inExecution}</div>
           <p className="text-[10px] text-muted-foreground">Serviços em andamento</p>
        </CardContent>
      </Card>
      <Card className="cursor-pointer shadow-md hover:shadow-red-500/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/ordem-de-servico')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">Tarefas Atrasadas</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-red-500">{stats.overdueTasks}</div>
           <p className="text-[10px] text-muted-foreground">O.S. e Visitas</p>
        </CardContent>
      </Card>
      {stats.totalPreventiveMaintenances !== undefined && (
          <Card className="cursor-pointer shadow-md hover:shadow-orange-500/30 transition-shadow duration-300 hover:scale-[1.02] border-orange-500/20" onClick={onViewPreventiveMaintenances}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
              <CardTitle className="text-xs font-medium">Manut. Preventivas</CardTitle>
              <Wrench className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="text-xl font-semibold text-orange-500">{stats.totalPreventiveMaintenances}</div>
               <p className="text-[10px] text-muted-foreground">Agendadas no total</p>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
