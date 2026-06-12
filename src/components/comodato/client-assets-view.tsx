"use client";

import React from "react";
import Image from "next/image";
import type { ComodatoAsset, Client } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, DollarSign, PlusCircle, Undo2, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatusConfig = {
    [key: string]: { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' };
};

type ClientAssetsViewProps = {
    client: Client;
    assets: ComodatoAsset[];
    onEditAsset: (asset: ComodatoAsset) => void;
    onUnlinkAsset: (asset: ComodatoAsset) => void;
    statusConfig: StatusConfig;
    totalMonthlyRevenue: number;
    onAddAsset: () => void;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
};

export default function ClientAssetsView({ assets, onEditAsset, onUnlinkAsset, statusConfig, totalMonthlyRevenue, onAddAsset }: ClientAssetsViewProps) {
    
    return (
        <div className="flex flex-col h-full space-y-4 sm:space-y-8">
            <div className="flex flex-row justify-between items-center gap-4">
                 <Card className="border-border/40 bg-primary/[0.03] shadow-premium shadow-primary/5 rounded-2xl overflow-hidden shrink-0 border-none backdrop-blur-3xl">
                    <CardContent className="p-3 sm:p-5 flex items-center gap-3 sm:gap-6">
                        <div className="h-9 w-9 p-2 bg-primary/10 rounded-xl shadow-inner flex items-center justify-center text-primary">
                            <DollarSign className="h-6 w-6"/>
                        </div>
                        <div className="flex flex-col">
                             <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90 leading-none mb-0.5 sm:mb-1">Receita Mensal</span>
                            <span className="text-lg sm:text-3xl font-semibold tracking-tighter text-foreground leading-none">{formatCurrency(totalMonthlyRevenue)}</span>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center gap-3">
                    <Button 
                        onClick={onAddAsset} 
                        size="lg" 
                        className="h-10 px-8 rounded-2xl font-semibold text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-2 bg-primary"
                    >
                        <PlusCircle className="h-5 w-5"/>
                        <span className="hidden sm:inline">Alocar Novo Ativo</span>
                        <span className="sm:hidden">Novo Ativo</span>
                    </Button>
                </div>
            </div>

            <Card className="border-border/40 bg-background/40 backdrop-blur-3xl shadow-premium rounded-2xl overflow-hidden flex-1 flex flex-col transition-all duration-700 border-none">
                <div className="p-0 overflow-auto no-scrollbar">
                    <Table>
                        <TableHeader className="bg-primary/[0.03] h-[32px]">
                            <TableRow className="hover:bg-transparent border-border/40 h-[32px]">
                                <TableHead className="px-4 sm:px-8 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 whitespace-nowrap h-[32px] leading-none">Equipamento / Modelo</TableHead>
                                <TableHead className="px-4 sm:px-8 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 whitespace-nowrap text-center hidden sm:table-cell h-[32px] leading-none">Nº de Série</TableHead>
                                <TableHead className="px-4 sm:px-8 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 text-center whitespace-nowrap h-[32px] leading-none">Status</TableHead>
                                <TableHead className="px-4 sm:px-8 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 text-center whitespace-nowrap hidden sm:table-cell h-[32px] leading-none">Ciclo Instalação</TableHead>
                                <TableHead className="px-4 sm:px-8 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90 text-right whitespace-nowrap h-[32px] leading-none">Gestão</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assets.map((asset) => (
                                <TableRow key={asset.id} className="group transition-all border-border/40 cursor-pointer h-[32px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                    <TableCell className="py-0 px-4 sm:px-8" onClick={() => onEditAsset(asset)}>
                                        <div className="flex items-center gap-3 sm:gap-5">
                                            <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden bg-muted border border-border/40 shadow-lg group-hover:scale-105 transition-transform duration-500">
                                                <Image
                                                    src={asset.photoUrl || "https://picsum.photos/seed/placeholder/200/200"}
                                                    alt={asset.model}
                                                    fill
                                                    sizes="(max-width: 640px) 40px, 56px"
                                                    style={{ objectFit: "cover" }}
                                                    className="group-hover:scale-110 transition-transform duration-700"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                 <span className="font-medium text-xs tracking-tight text-foreground group-hover:text-primary transition-colors truncate max-w-[120px] sm:max-w-none">{asset.model}</span>
                                                 <span className="text-xs font-semibold text-muted-foreground truncate max-w-[120px] sm:max-w-[200px] uppercase tracking-tighter mt-0.5">{asset.description || 'Sem descrição'}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-0 px-4 sm:px-8 text-center hidden sm:table-cell" onClick={() => onEditAsset(asset)}>
                                         <span className="font-mono text-xs font-semibold text-primary/90 group-hover:text-primary transition-colors bg-primary/5 px-3 py-1 rounded-xl border border-border/40">{asset.serial}</span>
                                    </TableCell>
                                     <TableCell className="py-0 px-4 sm:px-8 text-center" onClick={() => onEditAsset(asset)}>
                                        <Badge variant={statusConfig[asset.status]?.variant || 'secondary'} className="rounded-lg px-2 h-5 font-bold text-xs uppercase tracking-widest shadow-sm whitespace-nowrap leading-none">
                                            {statusConfig[asset.status]?.label || asset.status}
                                        </Badge>
                                    </TableCell>
                                     <TableCell className="py-0 px-4 sm:px-8 text-center hidden sm:table-cell" onClick={() => onEditAsset(asset)}>
                                        <div className="flex flex-col items-center leading-none">
                                            <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors tracking-tighter leading-none">
                                                {asset.installationDate ? new Date(asset.installationDate).toLocaleDateString('pt-BR') : 'Aguardando'}
                                            </span>
                                             <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.2em] mt-0.5 leading-none">Operação</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-0 px-4 sm:px-8 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                             <Button variant="ghost" size="none" className="h-8 w-8 hover:bg-primary/10 rounded-xl group-hover:scale-110 active:scale-90 transition-all flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEditAsset(asset); }}>
                                                 <Edit className="h-3 w-3 sm:h-4 w-4 text-primary" />
                                                 <span className="sr-only">Editar</span>
                                             </Button>
                                              <Button variant="ghost" size="none" className="h-8 w-8 text-amber-600 hover:bg-amber-100/50 rounded-xl group-hover:scale-110 active:scale-90 transition-all flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onUnlinkAsset(asset); }}>
                                                 <Undo2 className="h-3 w-3 sm:h-4 w-4" />
                                                 <span className="sr-only">Desvincular</span>
                                             </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {assets.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-0 h-48 text-center opacity-50">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Package className="h-8 w-8 text-muted-foreground" />
                                            <p className="text-xs font-semibold uppercase tracking-widest">Nenhum ativo alocado para este cliente</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
