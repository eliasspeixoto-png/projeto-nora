"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

type ChartData = {
  month: string;
  fullDate: string;
  total: number;
};

type PurchaseChartProps = {
  data: ChartData[];
  className?: string;
};

const formatCurrencyForTooltip = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
};

const formatCurrencyFull = (value: number) => {
  return formatCurrencyForTooltip(value);
}

export default function PurchaseChart({ data, className }: PurchaseChartProps) {
  const chartConfig = {
    total: {
      label: "Total Comprado",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card className={cn("border-border/40 bg-background/50 backdrop-blur-sm shadow-xl", className)}>
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-semibold">Evolução de Compras</CardTitle>
        <CardDescription className="text-[10px]">Valor total investido nos últimos 12 meses.</CardDescription>
      </CardHeader>
      <CardContent className="pb-4 px-2">
        <ChartContainer config={chartConfig} className="w-full h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 30, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="fillPurchase" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                className="text-[10px] font-semibold"
              />
              <YAxis 
                tickFormatter={(value) => formatCurrencyFull(Number(value))} 
                className="text-[10px] font-semibold" 
                width={60} 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent 
                  indicator="line"
                  formatter={(value) => formatCurrencyForTooltip(Number(value))}
                />} 
              />
              <Area
                dataKey="total"
                type="natural"
                fill="url(#fillPurchase)"
                stroke="var(--color-total)"
                strokeWidth={3}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
