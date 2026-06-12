"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotesOnce } from '@/lib/firebase/firestore';
import type { Quote } from '@/lib/data';
import { Loader2, ArrowUpDown, Calendar as CalendarIcon, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { subDays, format, parseISO, isWithinInterval } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from 'date-fns/locale';

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

type SortKey = 'name' | 'quantity' | 'revenue';
type SortDirection = 'asc' | 'desc';

export default function DesempenhoVendasPage() {
    const { userProfile, firebase } = useAuth();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'quantity', direction: 'desc' });
    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(new Date(), 89),
        to: new Date(),
    });

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            getQuotesOnce(firebase.db, userProfile.companyId, userProfile).then(data => {
                setQuotes(data.filter(q => q.status === 'Finalizado' && q.completionDate));
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, firebase.db, userProfile?.uid]);
    
    const productPerformance = useMemo(() => {
        const productMap = new Map<string, { name: string; quantity: number; revenue: number; }>();
        
        const filteredQuotes = quotes.filter(q => {
            if (!q.completionDate || !date || !date.from) return false;
            const completionDate = parseISO(q.completionDate);
            const endDate = date.to || date.from;
            return isWithinInterval(completionDate, { start: date.from, end: endDate });
        });

        filteredQuotes.forEach(quote => {
            quote.items.forEach(item => {
                const existing = productMap.get(item.product.id);
                if (existing) {
                    productMap.set(item.product.id, {
                        ...existing,
                        quantity: existing.quantity + item.quantity,
                        revenue: existing.revenue + item.total,
                    });
                } else {
                    productMap.set(item.product.id, {
                        name: item.product.description,
                        quantity: item.quantity,
                        revenue: item.total,
                    });
                }
            });
        });
        
        let data = Array.from(productMap.values());
        
        if(searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            data = data.filter(p => p.name.toLowerCase().includes(lowerSearch));
        }

        if (sortConfig !== null) {
            data.sort((a, b) => {
                const aValue = (a as any)[sortConfig.key];
                const bValue = (b as any)[sortConfig.key];

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue, 'pt-BR') * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
            });
        }

        return data;
    }, [quotes, sortConfig, date, searchTerm]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />;
        }
        return sortConfig.direction === 'asc' ? <ArrowUpDown className="ml-2 h-4 w-4 transform rotate-180" /> : <ArrowUpDown className="ml-2 h-4" />;
    };
    
    const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
        <TableHead className={cn("group cursor-pointer py-2 px-2", className)} onClick={() => requestSort(sortKey)}>
          <div className="flex items-center">{children}{getSortIndicator(sortKey)}</div>
        </TableHead>
    );
    
    if (isLoading) {
        return <div className="flex h-full items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none">
            <Card className="flex flex-col min-w-0">
                <CardHeader className="px-4 py-6">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="min-w-0">
                            <CardTitle className="text-xl">Desempenho de Vendas</CardTitle>
                            <CardDescription className="text-xs md:text-sm">Produtos e serviços mais vendidos (O.S. finalizadas).</CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar..."
                                    className="w-full sm:w-48 bg-background pl-8 h-9 text-xs"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-1 flex-1">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "flex-1 justify-start text-left font-normal text-xs h-9",
                                                !date?.from && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                            {date?.from ? format(date.from, "dd/MM/yy", { locale: ptBR }) : <span>Início</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={date?.from}
                                            onSelect={(selectedDate) => setDate(prev => ({ from: selectedDate ?? undefined, to: prev?.to }))}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "flex-1 justify-start text-left font-normal text-xs h-9",
                                                !date?.to && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                            {date?.to ? format(date.to, "dd/MM/yy", { locale: ptBR }) : <span>Fim</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={date?.to}
                                            onSelect={(selectedDate) => setDate(prev => ({ from: prev?.from, to: selectedDate ?? undefined }))}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-[500px] md:min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader sortKey="name" className="w-[50%]">Produto / Serviço</SortableHeader>
                                    <SortableHeader sortKey="quantity" className="text-center">Quantidade</SortableHeader>
                                    <SortableHeader sortKey="revenue" className="text-right">Receita Total</SortableHeader>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {productPerformance.map((product, index) => (
                                    <TableRow key={product.name} className={cn("transition-colors", index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
                                        <TableCell className="py-0 px-2 text-xs font-medium truncate max-w-[200px]">{product.name}</TableCell>
                                        <TableCell className="py-0 text-center font-semibold px-2 text-xs">{product.quantity}</TableCell>
                                        <TableCell className="py-0 text-right font-semibold px-2 text-xs text-primary">{formatCurrency(product.revenue)}</TableCell>
                                    </TableRow>
                                ))}
                                {productPerformance.length === 0 && (
                                    <TableRow><TableCell colSpan={3} className="py-0 h-32 text-center text-muted-foreground">Nenhuma venda registrada no período selecionado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
