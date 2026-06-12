
"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Cell } from "recharts"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

type ChartData = {
  status: string
  value: number
  count: number;
}

type StatusChartProps = {
  data: ChartData[]
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatCurrencyForLabel = (value: number) => {
  if (value === 0) return '';
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }).format(value);
};

const chartConfig = {
    "A Receber": {
      label: "A Receber",
      color: "hsl(var(--chart-1))",
    },
    "Receber Parcelado": {
      label: "Receber Parcelado",
      color: "hsl(var(--chart-4))",
    },
    "Recebido": {
      label: "Recebido",
      color: "hsl(var(--chart-2))",
    },
  } satisfies Record<string, { label: string; color: string }>;

export default function StatusChart({ data }: StatusChartProps) {
  
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center pb-2 p-4">
        <CardTitle>Visão Geral de Contas</CardTitle>
        <CardDescription>Últimos 60 Dias</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="h-full w-full min-h-[200px]">
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{
              top: 0,
              right: 40,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="status"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => chartConfig[value as keyof typeof chartConfig]?.label}
              className="text-xs fill-muted-foreground"
              width={110}
            />
            <XAxis dataKey="value" type="number" hide />
            <ChartTooltip
              cursor={{ fill: 'hsl(var(--muted))' }}
              content={
                <ChartTooltipContent
                  formatter={(value, name, props) => {
                    const { payload } = props;
                    return (
                        <div className="min-w-[150px] space-y-1">
                            <div className="flex justify-between w-full items-center">
                                <span>Valor:</span>
                                <span className="ml-4 font-semibold">{formatCurrency(Number(value))}</span>
                            </div>
                             <div className="flex justify-between w-full items-center">
                                <span>Nº de Contas:</span>
                                <span className="ml-4 font-semibold">{payload.count}</span>
                            </div>
                        </div>
                    )
                  }}
                  labelClassName="font-semibold text-base"
                  wrapperStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                  }}
                />
              }
            />
             <Bar dataKey="value" layout="vertical" radius={4} barSize={28}>
               {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartConfig[entry.status as keyof typeof chartConfig]?.color} />
               ))}
                <LabelList
                    dataKey="value"
                    position="right"
                    offset={8}
                    className="fill-foreground font-semibold"
                    fontSize={10}
                    formatter={formatCurrencyForLabel}
                />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
