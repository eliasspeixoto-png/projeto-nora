
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getPurchaseOrdersForDistributor, getProducts, getTeamMembersOnce } from '@/lib/firebase/firestore'; 
import type { PurchaseOrder, Product, UserProfile } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, Users, Package, TrendingUp, Crown, BarChart2, Star, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { subMonths, format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from "date-fns/locale";
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, LineChart, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";


const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string, icon: React.ElementType, color?: string }) => (
    <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl hover:bg-primary/5 transition-all duration-300 group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-[10px] font-semibold tracking-widest text-muted-foreground">{title}</CardTitle>
            <Icon className="h-4 w-4 transition-transform group-hover:scale-110" style={{ color: color || 'hsl(var(--primary))' }} />
        </CardHeader>
        <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight">{value}</div>
        </CardContent>
    </Card>
);

const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("pt-BR", { 
        style: "currency", 
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);

const chartConfig = {
  total: {
    label: "Faturamento",
    color: "hsl(var(--primary))",
  },
} satisfies Record<string, { label: string; color: string }>;

const formatCurrencyForLabel = (value: number) => {
    if (value === 0) return '';
    return formatCurrency(value);
};


export default function DistributorDashboard() {
    const { userProfile, company, firebase } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [salespeople, setSalespeople] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userProfile?.uid && company?.id && firebase.db) {
            setIsLoading(true);
            const fetchData = async () => {
                try {
                    const orderUnsub = getPurchaseOrdersForDistributor(firebase.db, company.id, setOrders, console.error);
                    const productsUnsub = getProducts(firebase.db, company.id, setProducts, console.error, 'Todos');
                    const members = await getTeamMembersOnce(firebase.db, company.id);
                    setSalespeople(members.filter(m => m.role === 'vendedor'));

                    setIsLoading(false);

                    return () => {
                        orderUnsub();
                        productsUnsub();
                    };
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Erro ao carregar dados do dashboard' });
                    setIsLoading(false);
                }
            };
            fetchData();
        } else {
            setIsLoading(false);
        }
    }, [userProfile, company, firebase.db, toast]);

    const completedOrders = useMemo(() => orders.filter(o => o.status === 'Recebido'), [orders]);

    const stats = useMemo(() => {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const ordersThisMonth = completedOrders.filter(o => isWithinInterval(parseISO(o.creationDate), { start, end }));

        return {
            totalSalesMonth: ordersThisMonth.reduce((sum, o) => sum + o.totalAmount, 0),
            salesCountMonth: ordersThisMonth.length,
            totalSalespeople: salespeople.length,
            totalProducts: products.length,
        };
    }, [completedOrders, salespeople.length, products.length]);

    const salespersonRanking = useMemo(() => {
        const salesBySalesperson = new Map<string, { name: string; total: number; count: number }>();
        completedOrders.forEach(order => {
            const id = order.assignedSalespersonId || 'unassigned';
            const name = order.assignedSalespersonName || 'Não Atribuído';
            const current = salesBySalesperson.get(id) || { name, total: 0, count: 0 };
            current.total += order.totalAmount;
            current.count += 1;
            salesBySalesperson.set(id, current);
        });
        return Array.from(salesBySalesperson.values()).sort((a, b) => b.total - a.total);
    }, [completedOrders]);

    const productRanking = useMemo(() => {
        const salesByProduct = new Map<string, { id: string; name: string; total: number; count: number }>();
        completedOrders.forEach(order => {
            order.items.forEach(item => {
                const id = item.productId;
                const name = item.productDescription;
                const current = salesByProduct.get(id) || { id, name, total: 0, count: 0 };
                current.total += item.totalCost;
                current.count += item.quantity;
                salesByProduct.set(id, current);
            });
        });
        return Array.from(salesByProduct.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    }, [completedOrders]);
    
    const monthlySalesData = useMemo(() => {
        const dataByMonth: { [key: string]: number } = {};
        for (let i = 11; i >= 0; i--) {
            const date = subMonths(new Date(), i);
            const monthKey = format(date, "MMM/yy", { locale: ptBR });
            dataByMonth[monthKey] = 0;
        }

        completedOrders.forEach(order => {
            const orderDate = parseISO(order.creationDate);
            const monthKey = format(orderDate, "MMM/yy", { locale: ptBR });
            if (dataByMonth.hasOwnProperty(monthKey)) {
                dataByMonth[monthKey] += order.totalAmount;
            }
        });

        return Object.entries(dataByMonth).map(([month, total]) => ({ month, total }));
    }, [completedOrders]);
    
    if (isLoading) {
        return (
            <div className="flex h-full flex-1 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6 pb-10">
            <div className="space-y-0.5">
                <h1 className="font-semibold tracking-tight flex items-center gap-2 text-xl">
                    <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                    Dashboard de Vendas
                </h1>
                <p className="text-[12px] text-muted-foreground font-medium">Faturamento e desempenho da sua rede de distribuição.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="Vendas no Mês" 
                    value={formatCurrency(stats.totalSalesMonth)} 
                    icon={DollarSign} 
                    color="hsl(var(--chart-2))"
                />
                <StatCard 
                    title="Nº de Vendas" 
                    value={String(stats.salesCountMonth)} 
                    icon={TrendingUp} 
                    color="hsl(var(--chart-1))"
                />
                <StatCard 
                    title="Vendedores Ativos" 
                    value={String(stats.totalSalespeople)} 
                    icon={Users} 
                    color="hsl(var(--chart-4))"
                />
                <StatCard 
                    title="Produtos Cadastrados" 
                    value={String(stats.totalProducts)} 
                    icon={Package} 
                    color="hsl(var(--chart-5))"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl">
                    <CardHeader className="py-4 px-6">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                            <Crown className="h-4 w-4 text-amber-500" /> Ranking de Vendedores
                        </div>
                    </CardHeader>
                    <CardContent className="px-2">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider h-[34px]">Vendedor</TableHead>
                                    <TableHead className="text-center text-[10px] uppercase font-semibold tracking-wider h-[34px]">Vendas</TableHead>
                                    <TableHead className="text-right text-[10px] uppercase font-semibold tracking-wider h-[34px]">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salespersonRanking.map((sp, index) => (
                                    <TableRow key={index} className="border-border/40 hover:bg-primary/5 transition-colors h-[34px]">
                                        <TableCell className="py-0 font-semibold text-xs flex items-center gap-2">
                                            {index === 0 && <Crown className="h-3 w-3 text-amber-500" />}
                                            {sp.name}
                                        </TableCell>
                                        <TableCell className="py-0 text-center font-semibold text-xs">{sp.count}</TableCell>
                                        <TableCell className="py-0 text-right font-semibold text-xs text-primary">
                                            {formatCurrency(sp.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl">
                    <CardHeader className="py-4 px-6">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                            <Star className="h-4 w-4 text-primary" /> Top 5 Produtos
                        </div>
                    </CardHeader>
                    <CardContent className="px-2">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider h-[34px]">Produto</TableHead>
                                    <TableHead className="text-center text-[10px] uppercase font-semibold tracking-wider h-[34px]">Qtd.</TableHead>
                                    <TableHead className="text-right text-[10px] uppercase font-semibold tracking-wider h-[34px]">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {productRanking.map((prod, index) => (
                                    <TableRow key={prod.id} className="border-border/40 hover:bg-primary/5 transition-colors h-[34px]">
                                        <TableCell className="py-0 font-medium text-xs truncate max-w-[150px]">{prod.name}</TableCell>
                                        <TableCell className="py-0 text-center text-xs font-semibold">{prod.count}</TableCell>
                                        <TableCell className="py-0 text-right text-xs font-semibold text-primary">{formatCurrency(prod.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
                    <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4 px-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                            <BarChart2 className="h-4 w-4" /> Evolução do Faturamento
                        </div>
                        <CardDescription className="text-[10px]">Faturamento mensal nos últimos 12 meses.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                    <ChartContainer config={chartConfig} className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlySalesData} margin={{ left: 30, right: 10, top: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
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
                                    tickFormatter={(value) => formatCurrencyForLabel(Number(value))} 
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
                                        formatter={(value) => formatCurrency(Number(value))}
                                    />} 
                                />
                                <Area
                                    dataKey="total"
                                    type="natural"
                                    fill="url(#fillTotal)"
                                    stroke="var(--color-total)"
                                    strokeWidth={3}
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    );
}
