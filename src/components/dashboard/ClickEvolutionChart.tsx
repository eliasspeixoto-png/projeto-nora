
"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, Legend, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ChartData = {
  name: string;
  cliques: number;
  valor: number;
};

type ClickEvolutionChartProps = {
  data: ChartData[];
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
};

const chartConfig = {
  cliques: {
    label: "Cliques",
    color: "hsl(var(--chart-1))",
  },
  valor: {
    label: "V. dos Cliques",
    color: "hsl(var(--chart-2))",
  },
} satisfies Record<string, { label: string; color: string }>;

const formatCurrencyForLabel = (value: number) => {
    if (value === 0) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      compactDisplay: 'short',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(value);
};

export default function ClickEvolutionChart({ data, timeRange, onTimeRangeChange }: ClickEvolutionChartProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Evolução de Cliques e Faturamento</CardTitle>
                <CardDescription>Cliques e valor gerado ao longo do tempo.</CardDescription>
            </div>
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="6months">Últimos 6 meses</SelectItem>
                    <SelectItem value="12months">Últimos 12 meses</SelectItem>
                    <SelectItem value="year">Este ano</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full h-[300px]">
          <BarChart accessibilityLayer data={data} barGap={4}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              className="text-xs"
            />
            <YAxis yAxisId="left" stroke="hsl(var(--chart-1))" orientation="left" tickFormatter={(value) => value.toString()} allowDecimals={false} />
            <YAxis yAxisId="right" stroke="hsl(var(--chart-2))" orientation="right" tickFormatter={(value) => `R$${value}`} />
            
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent
                formatter={(value, name) => {
                  const config = chartConfig[name as keyof typeof chartConfig];
                  if (!config) return null;
                  const formattedValue = name === 'valor' 
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)) 
                    : value;
                  return (
                    <div className="flex items-center">
                      <span className="h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: config.color }} />
                      <span>{config.label}: {formattedValue}</span>
                    </div>
                  )
                }}
              />}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="cliques" fill="var(--color-cliques)" radius={4}>
                <LabelList
                    position="top"
                    offset={4}
                    className="fill-foreground text-xs"
                    formatter={(value: number) => value > 0 ? value : ''}
                />
            </Bar>
            <Bar yAxisId="right" dataKey="valor" fill="var(--color-valor)" radius={4}>
                 <LabelList
                    position="top"
                    offset={4}
                    className="fill-foreground text-xs"
                    formatter={formatCurrencyForLabel}
                />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
