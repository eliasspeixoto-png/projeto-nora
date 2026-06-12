"use client";

import { useState, useMemo } from 'react';
import type { Product, StockLocation } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, Package, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";

type SortKey = 'description' | 'stockQuantity' | string;
type SortDirection = 'asc' | 'desc';

type ProductStockLevelsProps = {
    products: Product[];
    locations: StockLocation[];
};

const normalizeString = (str: string | null | undefined) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';

const getProductDescription = (p: Product) => {
    const data = p as any;
    return p.description || data['DESCRIÇÃO'] || data['DESCRICAO'] || 'Sem nome';
};

const formatProductName = (name: string) => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

export default function ProductStockLevels({ products, locations }: ProductStockLevelsProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: SortDirection } | null>({ key: 'description', direction: 'asc' });

    const filteredAndSortedProducts = useMemo(() => {
        let filtered = [...products];
        const lowerCaseSearch = normalizeString(searchTerm);
        if (lowerCaseSearch) {
            filtered = products.filter(p =>
                normalizeString(getProductDescription(p)).includes(lowerCaseSearch) ||
                normalizeString(p.item).includes(lowerCaseSearch)
            );
        }

        if (sortConfig) {
            filtered.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (lowerCaseSearch) {
                    const descA = normalizeString(getProductDescription(a));
                    const descB = normalizeString(getProductDescription(b));
                    const itemA = normalizeString(a.item);
                    const itemB = normalizeString(b.item);
                    
                    const aExact = descA === lowerCaseSearch || itemA === lowerCaseSearch;
                    const bExact = descB === lowerCaseSearch || itemB === lowerCaseSearch;
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;

                    const aStarts = descA.startsWith(lowerCaseSearch) || itemA.startsWith(lowerCaseSearch);
                    const bStarts = descB.startsWith(lowerCaseSearch) || itemB.startsWith(lowerCaseSearch);
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;
                }

                if (sortConfig.key.startsWith('stockLevels.')) {
                    const locationId = sortConfig.key.split('.')[1];
                    aValue = a.stockLevels?.[locationId] || 0;
                    bValue = b.stockLevels?.[locationId] || 0;
                } else if (sortConfig.key === 'description') {
                    aValue = getProductDescription(a);
                    bValue = getProductDescription(b);
                } else if (sortConfig.key === 'stockQuantity') {
                    aValue = a.stockQuantity || 0;
                } else {
                    aValue = a[sortConfig.key as keyof Product] || 0;
                    bValue = b[sortConfig.key as keyof Product] || 0;
                }

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return aValue.localeCompare(bValue, 'pt-BR') * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                if(typeof aValue === 'number' && typeof bValue === 'number'){
                     return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
                }
                
                return 0;
            });
        }

        return filtered;
    }, [products, searchTerm, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-50" />;
        }
        return sortConfig.direction === 'asc' ? <ArrowUpDown className="ml-2 h-3 w-3 rotate-180" /> : <ArrowUpDown className="ml-2 h-3 w-3" />;
    };

    const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey; children: React.ReactNode; className?: string }) => (
        <TableHead className={cn("group cursor-pointer py-2", className)} onClick={() => requestSort(sortKey)}>
            <div className="flex items-center">{children}{getSortIndicator(sortKey)}</div>
        </TableHead>
    );

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 px-2">
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tighter opacity-80 flex items-center gap-2">
                        <Package className="text-primary h-6 w-6" />
                        Níveis de Estoque
                    </h2>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground opacity-40 ml-1">Visão Global por Produto e Localização</p>
                </div>
                <div className="relative w-full sm:w-80 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                    <Input
                        type="search"
                        placeholder="Buscar produto..."
                        className="h-9 w-full rounded-lg bg-background/50 border-border/40 pl-11 font-semibold focus:bg-background transition-all text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium border border-border/40 overflow-hidden transition-all duration-700">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-primary/5 border-none h-[34px]">
                            <TableRow className="hover:bg-transparent border-none h-[34px]">
                                <SortableHeader sortKey="description" className="px-8 h-16 font-semibold uppercase tracking-[0.2em] text-[10px] opacity-40 text-foreground">Produto / SKU</SortableHeader>
                                <SortableHeader sortKey="stockQuantity" className="text-center px-8 h-16 font-semibold uppercase tracking-[0.2em] text-[10px] opacity-40 text-foreground">Total</SortableHeader>
                                {locations.map(loc => (
                                    <SortableHeader key={loc.id} sortKey={`stockLevels.${loc.id}`} className="text-center px-8 h-16 font-semibold uppercase tracking-[0.2em] text-[10px] opacity-40 text-foreground hidden md:table-cell">
                                        {loc.name}
                                    </SortableHeader>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody className="border-none">
                            {filteredAndSortedProducts.map((product, index) => (
                                <TableRow key={product.id} className="group transition-all duration-500 border-border/40 h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                    <TableCell className="py-0 px-8">
                                        <div className="font-semibold text-sm text-foreground/90 tracking-tight">{formatProductName(getProductDescription(product))}</div>
                                        <div className="text-[9px] font-semibold uppercase tracking-[0.2em] opacity-30 group-hover:opacity-60 transition-all font-mono mt-1">{product.item}</div>
                                    </TableCell>
                                    <TableCell className="py-0 text-center px-8">
                                        <Badge className={cn(
                                            "h-7 px-4 rounded-full font-semibold text-xs shadow-lg shadow-black/5 transition-all group-hover:scale-110",
                                            (product.stockQuantity || 0) <= (product.minStockQuantity || 0) ? "bg-rose-500 text-white" : "bg-primary/10 text-primary border-none"
                                        )}>
                                            {product.stockQuantity || 0}
                                        </Badge>
                                    </TableCell>
                                    {locations.map(loc => (
                                        <TableCell key={loc.id} className="py-0 text-center px-8 hidden md:table-cell">
                                            <span className="text-[12px] font-semibold opacity-30 group-hover:opacity-70 transition-all tracking-widest">{product.stockLevels?.[loc.id] || 0}</span>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                            {filteredAndSortedProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={locations.length + 2} className="py-0 h-60 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 opacity-10 py-10">
                                            <Package className="h-10 w-10" />
                                            <span className="font-semibold uppercase tracking-[0.2em] text-[10px]">Nenhum produto em estoque</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
