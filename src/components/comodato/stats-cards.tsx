"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Wrench, Home, DollarSign, Users } from "lucide-react";
import { useRouter } from "next/navigation";

type Stats = {
    totalAssets: number;
    inMaintenance: number;
    pendingInstall: number;
    monthlyRevenue: number;
    totalClients: number;
}

type StatsCardsProps = {
  stats: Stats;
};

const formatCurrency = (amount: number) => {
    // Garante que o valor seja um número válido antes de formatar
    const safeAmount = isNaN(amount) ? 0 : amount;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(safeAmount);
};

export default function ComodatoStatsCards({ stats }: StatsCardsProps) {
    const router = useRouter();
    const failureRate = stats.totalAssets > 0 ? ((stats.inMaintenance / stats.totalAssets) * 100).toFixed(1) : 0;

    const navigateToComodato = (filter?: string) => {
        const path = filter ? `/comodato?filtro=${filter}` : '/comodato';
        router.push(path);
    };

    return (
        <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-5">
             <Card className="border-border/40 bg-background/40 backdrop-blur-xl shadow-premium hover:bg-primary/5 transition-all duration-500 cursor-pointer group rounded-2xl overflow-hidden relative" onClick={() => navigateToComodato()}>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 relative z-10 gap-2">
                    <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Total Clientes</CardTitle>
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-purple-500/10 text-purple-500 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shrink-0">
                        <Users className="h-3 w-3 sm:h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 relative z-10 w-full overflow-hidden">
                    <div className="text-lg sm:text-2xl font-semibold tracking-tight group-hover:translate-x-1 transition-transform truncate">{stats.totalClients}</div>
                    <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-90">Contratos ativos</p>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-background/40 backdrop-blur-xl shadow-premium hover:bg-primary/5 transition-all duration-500 cursor-pointer group rounded-2xl sm:rounded-[2rem] overflow-hidden relative" onClick={() => navigateToComodato()}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 relative z-10 gap-2">
                    <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Total Ativos</CardTitle>
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-primary/10 text-primary group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shrink-0">
                        <Package className="h-3 w-3 sm:h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 relative z-10 w-full overflow-hidden">
                    <div className="text-lg sm:text-2xl font-semibold tracking-tight group-hover:translate-x-1 transition-transform truncate">{stats.totalAssets}</div>
                    <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-90">Equipamentos em uso</p>
                </CardContent>
            </Card>

             <Card className="border-border/40 bg-background/40 backdrop-blur-xl shadow-premium hover:bg-primary/5 transition-all duration-500 cursor-pointer group rounded-2xl sm:rounded-[2rem] overflow-hidden relative" onClick={() => navigateToComodato('manutencao')}>
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 relative z-10 gap-2">
                    <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Manutenção</CardTitle>
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-yellow-500/10 text-yellow-500 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shrink-0">
                        <Wrench className="h-3 w-3 sm:h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 relative z-10 w-full overflow-hidden">
                    <div className="text-lg sm:text-2xl font-semibold tracking-tight group-hover:translate-x-1 transition-transform truncate">{stats.inMaintenance}</div>
                    <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-90">Tx. Falha: {failureRate}%</p>
                </CardContent>
            </Card>

             <Card className="border-border/40 bg-background/40 backdrop-blur-xl shadow-premium hover:bg-primary/5 transition-all duration-500 cursor-pointer group rounded-2xl overflow-hidden relative" onClick={() => navigateToComodato()}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 relative z-10 gap-2">
                    <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Instalação</CardTitle>
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shrink-0">
                        <Home className="h-3 w-3 sm:h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 relative z-10 w-full overflow-hidden">
                    <div className="text-lg sm:text-2xl font-semibold tracking-tight group-hover:translate-x-1 transition-transform truncate">{stats.pendingInstall}</div>
                    <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-90">Aguardando O.S.</p>
                </CardContent>
            </Card>

             <Card className="border-border/40 bg-background/40 backdrop-blur-xl shadow-premium hover:bg-primary/5 transition-all duration-500 cursor-pointer group rounded-2xl sm:rounded-[2rem] overflow-hidden relative" onClick={() => navigateToComodato()}>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 relative z-10 gap-2">
                    <CardTitle className="text-[10px] sm:text-[9px] lg:text-[10px] font-semibold tracking-wider text-muted-foreground truncate flex-1">Rec. Mensal</CardTitle>
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shrink-0">
                        <DollarSign className="h-3 w-3 sm:h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 relative z-10 w-full overflow-hidden">
                    <div className="text-lg sm:text-2xl font-bold tracking-tight group-hover:translate-x-1 transition-transform group-hover:text-emerald-600 transition-colors truncate tabular-nums">{formatCurrency(stats.monthlyRevenue)}</div>
                    <p className="text-[10px] sm:text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate opacity-90">Receita recorrente</p>
                </CardContent>
            </Card>
        </div>
    );
}
