
"use client";

import type { StockLocation } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash2, Warehouse, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StockLocationListProps = {
    locations: StockLocation[];
    onEdit: (location: StockLocation) => void;
    onDelete: (locationId: string) => void;
};

export default function StockLocationList({ locations, onEdit, onDelete }: StockLocationListProps) {
    return (
        <div className="bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium border border-border/40 overflow-hidden">
            <div className="overflow-x-auto min-w-full">
                <Table>
                    <TableHeader className="bg-primary/5 border-none h-[34px]">
                        <TableRow className="hover:bg-transparent border-none h-[34px]">
                            <TableHead className="px-8 font-semibold uppercase tracking-[0.2em] text-[10px] opacity-40 text-foreground h-[34px]">Local de Estoque</TableHead>
                            <TableHead className="px-8 font-semibold uppercase tracking-[0.2em] text-[10px] opacity-40 text-foreground h-[34px]">Tipo</TableHead>
                            <TableHead className="px-8 font-semibold uppercase tracking-[0.2em] text-[10px] opacity-40 text-foreground h-[34px]">Identificador</TableHead>
                            <TableHead className="w-20 px-8 h-[34px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="border-none">
                        {locations.length > 0 ? locations.map((loc) => (
                            <TableRow key={loc.id} className="group transition-all duration-500 border-border/40 h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                <TableCell className="py-0 px-8 font-semibold text-xs tracking-tight text-foreground/90 uppercase">{loc.name}</TableCell>
                                <TableCell className="py-0 px-8">
                                    <Badge className={cn(
                                        "h-7 px-4 rounded-full font-semibold text-[9px] uppercase tracking-widest shadow-lg shadow-black/5 transition-all group-hover:scale-105 border-none flex items-center gap-1.5 w-fit",
                                        loc.type === 'warehouse' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'
                                    )}>
                                        {loc.type === 'warehouse' ? <Warehouse className="h-3 w-3"/> : <Truck className="h-3 w-3"/>}
                                        {loc.type === 'warehouse' ? 'Depósito' : 'Veículo'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-0 px-8">
                                    <span className="text-[11px] font-semibold opacity-30 group-hover:opacity-60 transition-all uppercase tracking-widest truncate max-w-[200px] block">
                                        {loc.address || loc.vehicleId || 'N/A'}
                                    </span>
                                </TableCell>
                                <TableCell className="py-0 px-8 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all text-foreground group-hover:scale-110">
                                                <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium">
                                            <DropdownMenuItem className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest cursor-pointer focus:bg-primary/10" onClick={() => onEdit(loc)}>
                                                <Edit className="mr-3 h-4 w-4" /> Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest cursor-pointer focus:bg-rose-500/10 text-rose-500" onClick={() => onDelete(loc.id)}>
                                                <Trash2 className="mr-3 h-4 w-4" /> Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="py-0 h-40 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 opacity-10 py-10">
                                        <Warehouse className="h-10 w-10" />
                                        <span className="font-semibold uppercase tracking-widest text-[10px]">Lista de depósitos vazia</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
