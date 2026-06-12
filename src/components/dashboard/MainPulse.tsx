"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const financeConfig = {
  receita: {
    label: "Receita Realizada",
    color: "hsl(var(--chart-1))",
  },
  despesa: {
    label: "Custo Estimado",
    color: "hsl(var(--chart-4))",
  },
};

const statusConfig = {
  finalizado: {
    label: "Finalizado",
    color: "hsl(var(--chart-2))",
  },
  execucao: {
    label: "Em Execução",
    color: "hsl(var(--chart-1))",
  },
  atrasado: {
    label: "Atrasado",
    color: "hsl(var(--chart-5))",
  },
  pendente: {
    label: "Pendente",
    color: "hsl(var(--chart-3))",
  },
};

const receivableConfig = {
  "A Receber": {
    label: "A Receber",
    color: "hsl(var(--chart-3))",
  },
  "Receber Parcelado": {
    label: "Parcelado",
    color: "hsl(var(--chart-4))",
  },
  "Recebido": {
    label: "Recebido",
    color: "hsl(var(--chart-2))",
  },
};

export default function MainPulse({ 
  trendData, 
  statusData,
  receivableData
}: { 
  trendData: any[], 
  statusData: any[],
  receivableData: any[]
}) {
  const formatFull = (val: number) => 
    new Intl.NumberFormat("pt-BR", { 
      style: "currency", 
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);

  return (
    <div className="flex flex-col gap-4">
      {/* Gráfico Principal: Tendência Financeira (Full Width) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-premium overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2.5 px-4 border-b border-border/40">
            <div className="space-y-0">
              <CardTitle className="font-semibold tracking-tighter text-lg">Fluxo Financeiro Mensal</CardTitle>
              <CardDescription className="text-[10px] font-medium text-muted-foreground/60">Receita vs. Custos (12 meses)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-4 pb-2">
            <ChartContainer config={financeConfig} className="h-[200px] w-full">
              <AreaChart data={trendData} margin={{ left: 30, right: 20, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-receita)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-receita)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillDespesa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-despesa)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--color-despesa)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  className="text-[11px] font-semibold text-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={60}
                  className="text-[11px] font-semibold text-muted-foreground"
                  tickFormatter={(val) => formatFull(val)}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="Receita"
                  type="natural"
                  fill="url(#fillReceita)"
                  stroke="var(--color-receita)"
                  strokeWidth={3}
                  stackId="a"
                />
                <Area
                  dataKey="Custo"
                  type="natural"
                  fill="url(#fillDespesa)"
                  stroke="var(--color-despesa)"
                  strokeWidth={2}
                  stackId="b"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Gráficos de Distribuição (Stacked or 2-col on Wide Viewports) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Distribuição Operacional */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
        >
            <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-premium overflow-hidden group">
              <CardHeader className="py-2.5 px-4 border-b border-border/40 bg-primary/5">
                  <CardTitle className="text-[10px] font-semibold tracking-widest text-primary uppercase">Status das Operações</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-row items-center justify-between gap-4 py-4 px-6">
                  {/* Legenda à Esquerda */}
                  <div className="flex flex-col gap-2 min-w-[120px]">
                      {statusData.map((item) => (
                          <div key={item.status} className="flex flex-col group/item">
                              <div className="flex items-center gap-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                                  <div 
                                      className="w-1.5 h-1.5 rounded-full shrink-0 group-hover/item:scale-125 transition-transform" 
                                      style={{ backgroundColor: statusConfig[item.status as keyof typeof statusConfig]?.color }}
                                  />
                                  <span className="truncate">{statusConfig[item.status as keyof typeof statusConfig]?.label || item.status}</span>
                              </div>
                              <span className="text-lg font-headline pl-3 leading-none text-foreground">{item.count}</span>
                          </div>
                      ))}
                  </div>

                  <div className="relative w-full aspect-square max-w-[140px] shrink-0">
                  <ChartContainer config={statusConfig} className="h-full w-full">
                      <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="dot" />} />
                      <Pie
                          data={statusData}
                          dataKey="count"
                          nameKey="status"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                      >
                          {statusData.map((entry, index) => (
                          <Cell 
                              key={`cell-${index}`} 
                              fill={statusConfig[entry.status as keyof typeof statusConfig]?.color || "hsl(var(--muted))"} 
                          />
                          ))}
                      </Pie>
                      </PieChart>
                  </ChartContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-semibold">{statusData.reduce((acc, curr) => acc + curr.count, 0)}</span>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground/50 tracking-tighter">Total</span>
                  </div>
                  </div>
              </CardContent>
            </Card>
        </motion.div>

        {/* Distribuição Financeira (A Receber) */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
        >
            <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-premium overflow-hidden group">
              <CardHeader className="py-2.5 px-4 border-b border-border/40 bg-emerald-500/5">
                  <CardTitle className="text-[10px] font-semibold tracking-widest text-emerald-600 uppercase">Fluxo a Receber (12 Meses)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-row items-center justify-between gap-4 py-4 px-6">
                  {/* Legenda à Esquerda */}
                  <div className="flex flex-col gap-2 min-w-[120px]">
                      {receivableData.map((item) => (
                          <div key={item.status} className="flex flex-col group/item">
                              <div className="flex items-center gap-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                                  <div 
                                      className="w-1.5 h-1.5 rounded-full shrink-0 group-hover/item:scale-125 transition-transform" 
                                      style={{ backgroundColor: receivableConfig[item.status as keyof typeof receivableConfig]?.color }}
                                  />
                                  <span className="truncate">{receivableConfig[item.status as keyof typeof receivableConfig]?.label || item.status}</span>
                              </div>
                              <span className="text-base font-headline pl-3 leading-none text-foreground">{formatFull(item.value)}</span>
                          </div>
                      ))}
                  </div>

                  <div className="relative w-full aspect-square max-w-[140px] shrink-0">
                  <ChartContainer config={receivableConfig} className="h-full w-full">
                      <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="dot" />} />
                      <Pie
                          data={receivableData}
                          dataKey="value"
                          nameKey="status"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                      >
                          {receivableData.map((entry, index) => (
                          <Cell 
                              key={`cell-fin-${index}`} 
                              fill={receivableConfig[entry.status as keyof typeof receivableConfig]?.color || "hsl(var(--muted))"} 
                          />
                          ))}
                      </Pie>
                      </PieChart>
                  </ChartContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-sm font-semibold">
                          {formatFull(receivableData.find(r => r.status === 'A Receber')?.value || 0)}
                      </span>
                  </div>
                  </div>
              </CardContent>
            </Card>
        </motion.div>
      </div>
    </div>
  );
}
