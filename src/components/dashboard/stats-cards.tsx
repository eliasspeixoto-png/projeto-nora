
"use client";

import { DollarSign, TrendingUp, Hourglass, Construction, FileCheck2, AlertCircle, FileSignature, UserCheck, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Stats = {
    approvedThisMonth: number;
    pendingApproval: number;
    pendingOS: number;
    assignedOS: number;
    inExecution: number;
    pendingRevision: number;
    pendingReceivables: number;
    generateQuoteVisits: number;
}

type StatsCardsProps = {
  stats: Stats;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
};

export default function StatsCards({ stats }: StatsCardsProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      <Card className="cursor-pointer shadow-md hover:shadow-green-500/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/orcamentos')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">Orç. Aprovados</CardTitle>
           <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-green-500">{formatCurrency(stats.approvedThisMonth)}</div>
          <p className="text-[10px] text-muted-foreground">Aprovado no mês</p>
        </CardContent>
      </Card>
       <Card className="cursor-pointer shadow-md hover:shadow-yellow-500/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/orcamentos')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">Aguard. aprovação</CardTitle>
          <Hourglass className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-yellow-500">{stats.pendingApproval}</div>
          <p className="text-[10px] text-muted-foreground">Orçamentos pendentes</p>
        </CardContent>
      </Card>
      <Card className="cursor-pointer shadow-md hover:shadow-orange-500/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/orcamentos')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">Pendente Revisão</CardTitle>
          <FileSignature className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-orange-500">{stats.pendingRevision}</div>
          <p className="text-[10px] text-muted-foreground">Aguardando ajuste</p>
        </CardContent>
      </Card>
       <Card className="cursor-pointer shadow-md hover:shadow-purple-500/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/visitas')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">Visita p/ Orçamento</CardTitle>
          <Search className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-purple-500">{stats.generateQuoteVisits}</div>
          <p className="text-[10px] text-muted-foreground">Aguardando orçamento</p>
        </CardContent>
      </Card>
      <Card className="cursor-pointer shadow-md hover:shadow-primary/30 transition-shadow duration-300 hover:scale-[1.02]" onDoubleClick={() => router.push('/financeiro')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
          <CardTitle className="text-xs font-medium">A Receber</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-xl font-semibold text-primary">{formatCurrency(stats.pendingReceivables)}</div>
          <p className="text-[10px] text-muted-foreground">Contas pendentes</p>
        </CardContent>
      </Card>
    </div>
  );
}
