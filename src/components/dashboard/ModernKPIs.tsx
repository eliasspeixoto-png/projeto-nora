"use client";

import { useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Zap, 
  Users, 
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TrendData {
  date: string;
  value: number;
}

interface KPIProps {
  title: string;
  value: string | number;
  subValue: string;
  trend: "up" | "down" | "neutral";
  trendValue: string;
  data: TrendData[];
  icon: React.ElementType;
  color: "emerald" | "blue" | "amber" | "rose";
  delay?: number;
  href?: string;
  isFlashing?: boolean;
}

const KPICard = ({ 
  title, 
  value, 
  subValue, 
  trend, 
  trendValue, 
  data, 
  icon: Icon,
  color,
  delay = 0,
  href,
  isFlashing
}: KPIProps) => {
  const colorMap = {
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  };

  const chartColor = {
    emerald: "#10b981",
    blue: "#3b82f6",
    amber: "#f59e0b",
    rose: "#f43f5e",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Link href={href || "#"} className={cn(!href && "pointer-events-none")}>
        <Card className={cn(
          "overflow-hidden glass-premium noise-overlay hover:shadow-glow-primary hover:border-primary/20 transition-all duration-700",
          isFlashing && "animate-pulse [animation-duration:3s] border-blue-500/50 shadow-glow-blue"
        )}>
          <CardContent className="p-0 relative z-10">
            <div className="p-2 sm:p-2.5 flex justify-between items-start">
              <div className="space-y-0">
                <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                  {title}
                </p>
                <h3 className="text-sm sm:text-lg font-semibold tracking-tight">{value}</h3>
                <div className="flex items-center gap-1.5 mt-0">
                  <span className={cn(
                    "text-[8px] sm:text-[9px] font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5",
                    trend === "up" ? "text-emerald-600 bg-emerald-500/10" : 
                    trend === "down" ? "text-rose-600 bg-rose-500/10" : 
                    "text-muted-foreground bg-muted"
                  )}>
                    {trend === "up" ? <ArrowUpRight className="h-2 w-2" /> : 
                     trend === "down" ? <ArrowDownRight className="h-2 w-2" /> : null}
                    {trendValue}
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-muted-foreground truncate max-w-[60px]">{subValue}</span>
                </div>
              </div>
              <div className={cn("p-1.5 rounded-lg border sm:p-1.5 sm:rounded-xl", colorMap[color])}>
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
            </div>
            <div className="h-8 sm:h-10 w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor[color]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartColor[color]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor[color]}
                    strokeWidth={2}
                    fill={`url(#gradient-${color})`}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          {/* Glow Element */}
          <div className="absolute top-0 right-0 w-[40px] h-[40px] bg-primary/20 blur-[30px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>
      </Link>
    </motion.div>
  );
};

export default function ModernKPIs({ stats }: { stats: any }) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("pt-BR", { 
      style: "currency", 
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      <KPICard
        title="Faturamento"
        value={formatCurrency(stats.faturamentoMesAtual || 0)}
        subValue="Finalizado este mês"
        trend="up"
        trendValue="+12%"
        data={stats.revenueTrend || []}
        icon={DollarSign}
        color="emerald"
        delay={0.1}
      />
      <KPICard
        title="Contas a Receber"
        value={formatCurrency(stats.totalReceivable)}
        subValue="Saldo pendente total"
        trend="neutral"
        trendValue="Estável"
        data={stats.receivableTrend || []}
        icon={DollarSign}
        color="amber"
        delay={0.15}
      />
      <KPICard
        title="Eficiência de O.S."
        value={`${stats.efficiencyRate || 0}%`}
        subValue="Finalizadas em tempo"
        trend={stats.efficiencyRate > 80 ? "up" : "down"}
        trendValue={stats.efficiencyRate > 80 ? "+5%" : "-2%"}
        data={stats.efficiencyTrend || []}
        icon={Zap}
        color="blue"
        delay={0.2}
      />
      <KPICard
        title="Base de Clientes"
        value={stats.totalClients || 0}
        subValue="Clientes ativos"
        trend="up"
        trendValue="+4"
        data={stats.clientTrend || []}
        icon={Users}
        color="emerald"
        delay={0.3}
      />
      {stats.isAuthorizedForLeads && (
        <KPICard
          title="Leads do Site"
          value={stats.totalLeads || 0}
          subValue="Novas oportunidades"
          trend="up"
          trendValue="+8%"
          data={stats.leadsTrend || []}
          icon={Sparkles}
          color="blue"
          delay={0.35}
          href="/marketing/leads"
          isFlashing={stats.hasNewLeads}
        />
      )}
      <KPICard
        title="Saúde do Estoque"
        value={stats.stockHealth || "Estável"}
        subValue={`${stats.lowStockCount || 0} itens baixos`}
        trend={stats.lowStockCount > 10 ? "down" : "neutral"}
        trendValue={stats.lowStockCount > 10 ? "-8%" : "0%"}
        data={stats.stockTrend || []}
        icon={Package}
        color="rose"
        delay={0.4}
      />
    </div>
  );
}
