"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getNotasFiscaisOnce } from '@/lib/firebase/firestore'; 
import type { NotaFiscal } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, FileText, Image as ImageIcon, ExternalLink, Calendar, DollarSign, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const normalizeString = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export default function NotasFiscaisPage() {
    const { firebase, userProfile } = useAuth();
    const { toast } = useToast();
    const [notas, setNotas] = useState<NotaFiscal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const { items: sortedNotas, requestSort, sortConfig } = useSortableData(notas, { key: 'createdAt', direction: 'desc' });

    const fetchNotas = useCallback(async () => {
        if (!userProfile?.companyId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            if (!firebase.db) throw new Error("Firebase não está pronto");
            const myNotas = await getNotasFiscaisOnce(firebase.db, userProfile.companyId);
            setNotas(myNotas as NotaFiscal[]);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao carregar notas fiscais", description: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [firebase.db, userProfile?.companyId, toast]);

    useEffect(() => {
        fetchNotas();
    }, [fetchNotas]);

    const filteredNotas = useMemo(() => {
        return sortedNotas.filter(n => {
            const fornecedor = typeof n.fornecedor === 'string' ? n.fornecedor : n.fornecedor?.nome;
            return normalizeString(fornecedor).includes(normalizeString(searchTerm)) || 
                   normalizeString(n.numero).includes(normalizeString(searchTerm));
        });
    }, [sortedNotas, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background/50 backdrop-blur-md">
                <div className="relative">
                    <Loader2 className="animate-spin text-primary h-12 w-12 opacity-20" />
                    <FileText className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/40 animate-pulse">Sincronizando Notas de Entrada</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 text-foreground">
            
            <header className="flex flex-col gap-8 px-6 pt-8 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-inner text-primary">
                            <FileText className="h-8 w-8" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="font-semibold tracking-tighter text-xl">Notas Fiscais de Entrada</h1>
                            <p className="text-xs text-muted-foreground font-medium">Notas e comprovantes capturados automaticamente.</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative group w-full sm:w-[350px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                            <Input
                                placeholder="Buscar por número da nota ou fornecedor..."
                                className="h-9 pl-12 bg-background/40 backdrop-blur-md border-border/40 rounded-lg font-semibold shadow-sm focus-visible:ring-primary/20 text-sm text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 mt-4 px-6 overflow-hidden w-full max-w-full">
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden w-full min-w-0">
                    {filteredNotas.length > 0 ? filteredNotas.map(nota => {
                        const fornecedorNome = typeof nota.fornecedor === 'string' ? nota.fornecedor : (nota.fornecedor?.nome || 'N/A');
                        
                        return (
                        <Card key={nota.id} className="w-full border-border/40 bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden transition-transform">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-lg tracking-tight text-foreground truncate">NF-e {nota.numero}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 mt-1">{nota.status || 'Processada'}</p>
                                    </div>
                                    {nota.arquivoUrl && (
                                        <Button variant="outline" size="sm" className="h-8 gap-2 bg-background/50 rounded-lg" onClick={() => window.open(nota.arquivoUrl, '_blank')}>
                                            <ExternalLink className="h-3 w-3" /> Abrir
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2 pt-4 border-t border-border/40">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/5 rounded-lg"><Building2 className="h-4 w-4 text-primary/40" /></div>
                                        <span className="text-xs font-semibold text-foreground/80 truncate">{fornecedorNome}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/5 rounded-lg"><Calendar className="h-4 w-4 text-primary/40" /></div>
                                        <span className="text-xs font-semibold text-foreground/60">{nota.dataEmissao || nota.dataImportacao || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-500/10 rounded-lg"><DollarSign className="h-4 w-4 text-green-500/60" /></div>
                                        <span className="text-sm font-bold text-foreground/80">{nota.valorTotal ? `R$ ${nota.valorTotal}` : 'N/A'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}) : (
                         <div className="h-40 flex flex-col items-center justify-center gap-4 bg-background/20 backdrop-blur-md rounded-xl border border-dashed border-border/40 text-muted-foreground/40 opacity-50">
                            <FileText className="h-12 w-12" />
                            <span className="text-xs font-semibold uppercase tracking-widest">Nenhuma nota encontrada</span>
                         </div>
                    )}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl rounded-xl overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <Table>
                            <TableHeader className="bg-primary/[0.03] border-border/40 h-[34px]">
                                <TableRow className="hover:bg-transparent h-[34px]">
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'numero' ? sortConfig.direction : null}
                                        onClick={() => requestSort('numero')}
                                        className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Nº da Nota / Série
                                    </TableHead>
                                    <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">
                                        Fornecedor
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'dataEmissao' ? sortConfig.direction : null}
                                        onClick={() => requestSort('dataEmissao')}
                                        className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Emissão
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'valorTotal' ? sortConfig.direction : null}
                                        onClick={() => requestSort('valorTotal')}
                                        className="px-6 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Valor Total
                                    </TableHead>
                                    <TableHead className="w-24 px-6 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Status</TableHead>
                                    <TableHead className="w-24 px-6 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Arquivo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredNotas.map(nota => {
                                    const fornecedorNome = typeof nota.fornecedor === 'string' ? nota.fornecedor : (nota.fornecedor?.nome || 'N/A');
                                    
                                    return (
                                    <TableRow key={nota.id} className="transition-all border-border/40 group h-[40px] hover:bg-primary/5">
                                        <TableCell className="py-0 px-6">
                                            <span className="font-semibold text-xs tracking-tight text-foreground transition-colors group-hover:text-primary">{nota.numero || 'S/N'} {nota.serie ? `- ${nota.serie}` : ''}</span>
                                        </TableCell>
                                        <TableCell className="py-0 px-6">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-3 w-3 text-primary/40" />
                                                <span className="text-xs font-semibold text-foreground/80 truncate max-w-[250px]">{fornecedorNome}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 px-6 font-mono text-xs font-semibold text-foreground/80">
                                            {nota.dataEmissao || nota.dataImportacao || 'N/A'}
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-right">
                                            <span className="font-bold text-xs text-foreground">{nota.valorTotal ? `R$ ${nota.valorTotal}` : '---'}</span>
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-center">
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider">
                                                {nota.status || 'Processada'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-right">
                                            {nota.arquivoUrl ? (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/10">
                                                            <ImageIcon className="h-4 w-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-4xl bg-background/90 backdrop-blur-3xl border-border/40 p-1 rounded-2xl shadow-premium">
                                                        <DialogHeader className="p-4 pb-0">
                                                            <DialogTitle className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/> Arquivo Original</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="w-full h-[80vh] rounded-xl overflow-hidden bg-black/5 mt-4">
                                                            <iframe src={nota.arquivoUrl} className="w-full h-full border-0" title="Visualização do Documento" />
                                                        </div>
                                                        <div className="p-4 flex justify-end">
                                                            <Button onClick={() => window.open(nota.arquivoUrl, '_blank')} className="gap-2 rounded-xl bg-primary hover:scale-[1.02] transition-all">
                                                                <ExternalLink className="h-4 w-4" /> Abrir em Nova Aba
                                                            </Button>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground/40 font-semibold italic">S/ Arq</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )})}
                                {filteredNotas.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-0 h-64 text-center group">
                                             <div className="flex flex-col items-center gap-4 opacity-20 group-hover:opacity-40 transition-opacity">
                                                <FileText className="h-12 w-12" />
                                                <span className="text-xs font-semibold uppercase tracking-widest">Nenhuma nota cadastrada via OCR</span>
                                             </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    );
}
