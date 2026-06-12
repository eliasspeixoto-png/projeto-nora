
"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

type ChartDataType = {
  month: string;
  Receita: number;
  Lucro: number;
  Custo: number;
};

type RevenueChartProps = {
  data: ChartDataType[];
  className?: string;
};

const chartConfig = {
  Receita: {
    label: "Receita",
    color: "hsl(var(--chart-1))",
  },
  Lucro: {
    label: "Lucro",
    color: "hsl(var(--chart-2))",
  },
  Custo: {
    label: "Custo",
    color: "hsl(var(--chart-4))",
  },
} satisfies Record<string, { label: string; color: string }>;

const formatCurrencyForTooltip = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
};

const formatCurrencyForLabel = (value: number) => {
  if (value === 0) return '';
  return formatCurrencyForTooltip(value);
}

function RevenueChart({ data, className }: RevenueChartProps) {
  return (
    <Card className={cn("flex flex-col h-full w-full overflow-hidden", className)}>
      <CardHeader className="p-4">
        <CardTitle className="text-base text-xl">Receita x Lucro (Últimos 12 Meses)</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Análise mensal da receita total, custos e lucro bruto nas O.S. finalizadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        <ChartContainer config={chartConfig} className="w-full h-[225px] md:h-[250px]">
            <BarChart
                accessibilityLayer
                data={data}
                margin={{ top: 20, right: 10, bottom: 0, left: 20 }}
                barGap={2}
                barCategoryGap="15%"
            >
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value.slice(0, 3)}
                    fontSize={10}
                />
                <YAxis 
                    tickFormatter={(value) => formatCurrencyForLabel(Number(value))}
                    fontSize={9}
                    width={60}
                    tickMargin={8}
                />
                <ChartTooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex justify-between items-center w-full gap-4">
                          <div className="flex items-center">
                            <div
                              className="w-2 h-2 rounded-full mr-2"
                              style={{ backgroundColor: chartConfig[name as keyof typeof chartConfig]?.color }}
                            />
                            <span className="text-[10px]">{name}:</span>
                          </div>
                          <span className="font-semibold text-[10px]">{formatCurrencyForTooltip(Number(value))}</span>
                        </div>
                      )}
                      labelClassName="font-semibold text-xs"
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent className="text-[10px]" />} />
                 <Bar dataKey="Receita" fill="var(--color-Receita)" radius={2}>
                    <LabelList 
                      position="top" 
                      offset={5} 
                      angle={-45}
                      formatter={formatCurrencyForLabel} 
                      className="fill-foreground text-[8px] font-semibold" 
                      dy={-2}
                    />
                 </Bar>
                 <Bar dataKey="Lucro" fill="var(--color-Lucro)" radius={2}>
                   <LabelList 
                      position="top" 
                      offset={5} 
                      angle={-45} 
                      formatter={formatCurrencyForLabel} 
                      className="fill-foreground text-[8px] font-semibold" 
                      dy={-2}
                    />
                 </Bar>
                 <Bar dataKey="Custo" fill="var(--color-Custo)" radius={2}>
                    <LabelList 
                      position="top" 
                      offset={5}
                      angle={-45}
                      formatter={formatCurrencyForLabel} 
                      className="fill-foreground text-[8px] font-semibold" 
                      dy={-2}
                    />
                 </Bar>
            </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export default RevenueChart;
