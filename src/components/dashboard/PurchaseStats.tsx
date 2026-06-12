"use client";

import { ShoppingCart, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type PurchaseStatsData = {
    pendingOrders: number;
    approvedThisMonth: number;
    totalSpentThisMonth: number;
    overdueOrders: number;
};

type PurchaseStatsProps = {
  stats: PurchaseStatsData;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
};

export default function PurchaseStats({ stats }: PurchaseStatsProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-premium hover:bg-primary/5 transition-all duration-300 cursor-pointer group w-full overflow-hidden" onClick={() => router.push('/compras')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 gap-2">
          <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Pedidos Pendentes</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500 group-hover:scale-110 transition-transform shrink-0" />
        </CardHeader>
        <CardContent className="p-3 pt-0 w-full overflow-hidden">
          <div className="text-lg sm:text-2xl font-semibold tracking-tight truncate">{stats.pendingOrders}</div>
          <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-80">Aguardando aprovação</p>
        </CardContent>
      </Card>
       <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-premium hover:bg-primary/5 transition-all duration-300 cursor-pointer group w-full overflow-hidden" onClick={() => router.push('/compras')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 gap-2">
          <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Aprovados no Mês</CardTitle>
          <CheckCircle className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform shrink-0" />
        </CardHeader>
        <CardContent className="p-3 pt-0 w-full overflow-hidden">
          <div className="text-lg sm:text-2xl font-semibold tracking-tight truncate">{stats.approvedThisMonth}</div>
           <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-80">Pedidos este mês</p>
        </CardContent>
      </Card>
      <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-premium hover:bg-primary/5 transition-all duration-300 cursor-pointer group w-full overflow-hidden" onClick={() => router.push('/compras')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 gap-2">
          <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Gasto no Mês</CardTitle>
          <ShoppingCart className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
        </CardHeader>
        <CardContent className="p-3 pt-0 w-full overflow-hidden">
          <div className="text-lg sm:text-2xl font-semibold tracking-tight truncate">{formatCurrency(stats.totalSpentThisMonth)}</div>
           <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-80">Total em compras</p>
        </CardContent>
      </Card>
      <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-premium hover:bg-primary/5 transition-all duration-300 cursor-pointer group w-full overflow-hidden" onClick={() => router.push('/compras')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 gap-2">
          <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Pedidos Atrasados</CardTitle>
          <AlertTriangle className="h-4 w-4 text-rose-500 group-hover:scale-110 transition-transform shrink-0" />
        </CardHeader>
        <CardContent className="p-3 pt-0 w-full overflow-hidden">
          <div className="text-lg sm:text-2xl font-semibold tracking-tight truncate">{stats.overdueOrders}</div>
           <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-80">Aguardando entrega</p>
        </CardContent>
      </Card>
    </div>
  );
}
