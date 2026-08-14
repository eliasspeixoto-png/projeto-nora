"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getDeletedItems, restoreDocument, permanentlyDeleteDocument } from '@/lib/firebase/firestore';
import type { HistoryItem } from '@/lib/data';
import { Loader2, Search, Trash2, Undo, AlertTriangle, Info, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const typeLabels: Record<string, string> = { 
    os: 'O.S.', 
    visit: 'Visita', 
    client: 'Cliente', 
    product: 'Produto', 
    supplier: 'Fornecedor', 
    purchase: 'Compra', 
    tool: 'Ferramenta', 
    user: 'Usuário',
    lead: 'Lead' 
};

const COLLECTION_MAP: Record<string, string> = {
    os: 'quotes',
    visit: 'visits',
    client: 'clients',
    product: 'products',
    supplier: 'suppliers',
    purchase: 'purchaseOrders',
    tool: 'tools',
    user: 'users',
    lead: 'leads'
};

export default function TrashPageClient() {
    const { userProfile, firebase } = useAuth();
    const { toast } = useToast();
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [itemToDelete, setItemToDelete] = useState<HistoryItem | null>(null);
    const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);

    const performAutoCleanup = useCallback(async (trashItems: HistoryItem[]) => {
        if (!firebase.db) return;
        const now = new Date();
        const expiredItems = trashItems.filter(item => {
            const deletedDate = parseISO(item.deletedAt || new Date().toISOString());
            return differenceInDays(now, deletedDate) >= 20;
        });

        if (expiredItems.length > 0) {
            console.log(`NORA: Limpando ${expiredItems.length} itens expirados da lixeira...`);
            for (const item of expiredItems) {
                const collectionName = COLLECTION_MAP[item.type];
                const id = (item as any).id || (item as any).uid;
                if (collectionName && id) {
                    try {
                        await permanentlyDeleteDocument(firebase.db, collectionName, id);
                    } catch (e) {
                        console.error(`Erro ao limpar item ${id}:`, e);
                    }
                }
            }
            // Não exibimos toast de sucesso para limpeza automática para não poluir a interface,
            // mas atualizamos a lista local.
            return true;
        }
        return false;
    }, [firebase.db]);

    const fetchData = useCallback(async () => {
        if (!userProfile?.companyId || !firebase.db) return;
        setIsLoading(true);
        try {
            const data = await getDeletedItems(firebase.db, userProfile.companyId);
            const wasCleaned = await performAutoCleanup(data);
            
            if (wasCleaned) {
                // Busca novamente após limpeza
                const refreshedData = await getDeletedItems(firebase.db, userProfile.companyId);
                setItems(refreshedData);
            } else {
                setItems(data);
            }
        } catch (error) {
            console.error("Failed to load trash items:", error);
        } finally {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, firebase.db, performAutoCleanup]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = useMemo(() => {
        return items.filter(i => {
            const matchesType = filterType === 'all' || i.type === filterType;
            const searchContent = JSON.stringify(i).toLowerCase();
            const matchesSearch = searchContent.includes(searchTerm.toLowerCase());
            return matchesType && matchesSearch;
        }).sort((a, b) => {
            const dateA = parseISO(a.deletedAt || new Date().toISOString()).getTime();
            const dateB = parseISO(b.deletedAt || new Date().toISOString()).getTime();
            return dateB - dateA;
        });
    }, [items, searchTerm, filterType]);

    const handleRestore = async (i: any) => {
        if (!firebase.db) return;
        const collectionName = COLLECTION_MAP[i.type];
        
        try {
            await restoreDocument(firebase.db, collectionName, (i as any).id || (i as any).uid);
            toast({ title: 'Item restaurado com sucesso!' });
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro ao restaurar', description: e.message });
        }
    };

    const handlePermanentDelete = async () => {
        if (!itemToDelete || !firebase.db) return;
        const collectionName = COLLECTION_MAP[itemToDelete.type];

        try {
            await permanentlyDeleteDocument(firebase.db, collectionName, (itemToDelete as any).id || (itemToDelete as any).uid);
            toast({ title: 'Item excluído permanentemente.' });
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro ao excluir', description: e.message });
        } finally {
            setDeleteAlertOpen(false);
            setItemToDelete(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background/50 backdrop-blur-md">
                <div className="relative">
                    <Loader2 className="animate-spin text-primary h-12 w-12 opacity-20" />
                    <Trash2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-destructive animate-pulse" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/40 animate-pulse">Sincronizando Resíduos Digitais</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 text-foreground">
            
            <header className="flex flex-col gap-8 px-6 pt-8 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-destructive/10 rounded-2xl shadow-inner text-destructive">
                            <Trash2 className="h-8 w-8" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="font-semibold tracking-tighter italic text-xl">Arquivo de Descartes</h1>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive/40">Gestão de Retenção e Recuperação</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative group w-full sm:w-[350px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                            <Input
                                placeholder="Localizar item no arquivo..."
                                className="h-9 pl-12 bg-background/40 backdrop-blur-md border-border/40 rounded-lg font-semibold shadow-sm focus-visible:ring-primary/20 text-sm text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="h-9 w-full sm:w-[180px] bg-background/40 backdrop-blur-md border-border/40 rounded-lg font-semibold text-[10px] uppercase tracking-widest shadow-sm text-xs">
                                <SelectValue placeholder="FILTRO DE TIPO" />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                <SelectItem value="all" className="rounded-xl">TODOS OS DADOS</SelectItem>
                                {Object.entries(typeLabels).map(([k, v]) => (
                                    <SelectItem key={k} value={k} className="rounded-xl uppercase text-[10px] tracking-widest">{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="bg-primary/[0.03] border border-border/40 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
                    <div className="p-3 bg-background/50 rounded-xl shadow-sm text-primary/40">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col text-center sm:text-left gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">Política de Retenção Ativa</span>
                        <p className="text-xs font-semibold text-muted-foreground/60 leading-relaxed">
                            O sistema mantém registros por até <span className="text-primary font-semibold">20 dias</span>. Após este ciclo, o sistema executa um <span className="italic">hard-delete</span> automático para garantir a integridade e performance do ecossistema.
                        </p>
                    </div>
                </div>
            </header>

            <div className="flex-1 mt-4 px-6 overflow-hidden w-full max-w-full">
                {isLoading ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-4 bg-background/20 backdrop-blur-md rounded-xl border border-dashed border-border/40">
                        <div className="relative">
                            <Loader2 className="animate-spin text-primary h-12 w-12 opacity-20" />
                            <Trash2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-destructive animate-pulse" />
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/40 animate-pulse">Sincronizando Resíduos</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile View */}
                        <div className="grid gap-4 md:hidden w-full">
                            {filtered.map((item: any) => {
                                 const daysSinceDeletion = differenceInDays(new Date(), parseISO(item.deletedAt || new Date().toISOString()));
                                 const daysRemaining = Math.max(0, 20 - daysSinceDeletion);
                                 return (
                                    <Card key={(item as any).id || (item as any).uid} className="w-full border-border/40 bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden active:scale-[0.98] transition-transform">
                                        <CardContent className="p-8 space-y-6">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex flex-col gap-2">
                                                    <Badge variant="outline" className="w-fit h-5 px-2 rounded-lg border-border/40 bg-primary/5 font-semibold text-[9px] uppercase tracking-widest text-primary/60">
                                                        {typeLabels[item.type]}
                                                    </Badge>
                                                    <p className="font-semibold text-lg tracking-tight text-foreground break-all">
                                                        {item.quoteNumber || item.visitNumber || item.name || item.displayName || item.description}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all" onClick={() => handleRestore(item)} title="Restaurar Ativo">
                                                        <Undo className="h-5 w-5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-95 transition-all" onClick={() => { setItemToDelete(item); setDeleteAlertOpen(true); }} title="Exclusão Permanente">
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="pt-4 border-t border-border/40 flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold uppercase tracking-widest text-primary/30">DATA DE EXCLUSÃO</span>
                                                    <span className="text-xs font-semibold text-foreground/60">{item.deletedAt ? format(parseISO(item.deletedAt), 'dd/MM/yy HH:mm', { locale: ptBR }) : 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold uppercase tracking-widest text-primary/30">LIMITE DE RETENÇÃO</span>
                                                    <span className={cn("text-xs font-semibold px-3 py-1 rounded-lg uppercase tracking-widest bg-primary/5", daysRemaining <= 3 ? "text-destructive animate-pulse" : "text-primary/60")}>
                                                        {daysRemaining} DIAS RESTANTES
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                 );
                            })}
                            {filtered.length === 0 && (
                                <div className="h-64 flex flex-col items-center justify-center gap-4 bg-background/20 backdrop-blur-md rounded-xl border border-dashed border-border/40 text-muted-foreground/40 opacity-50">
                                    <Info className="h-12 w-12" />
                                    <span className="text-xs font-semibold uppercase tracking-widest">Nenhum rastro localizado</span>
                                </div>
                            )}
                        </div>

                        {/* Desktop View */}
                        <div className="hidden md:block border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl rounded-xl overflow-hidden">
                            <div className="overflow-x-auto w-full">
                                <Table>
                                    <TableHeader className="bg-primary/[0.03] border-border/40 h-[34px]">
                                        <TableRow className="hover:bg-transparent h-[34px]">
                                            <TableHead className="px-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 text-center h-[34px]">Tipo</TableHead>
                                            <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Item Identificado</TableHead>
                                            <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 text-center h-[34px]">Protocolo de Exclusão</TableHead>
                                            <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 text-center h-[34px]">Ciclo de Retenção</TableHead>
                                            <TableHead className="w-20 px-10 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Protocolo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((item: any) => {
                                            const daysSinceDeletion = differenceInDays(new Date(), parseISO(item.deletedAt || new Date().toISOString()));
                                            const daysRemaining = Math.max(0, 20 - daysSinceDeletion);
                                            return (
                                                <TableRow key={item.id || item.uid} className="[0.03] transition-all border-border/40 group h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                                    <TableCell className="py-0 px-10 text-center">
                                                        <Badge variant="outline" className="font-semibold text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-xl border-border/40 bg-primary/[0.02]">
                                                            {typeLabels[item.type]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-0 px-6">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-semibold text-sm tracking-tight text-foreground truncate max-w-[400px]">
                                                                {item.quoteNumber || item.name || item.displayName || item.visitNumber || item.description}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-primary/30 uppercase tracking-[0.1em]">UUID: {((item.id || item.uid) as string)?.slice(-12).toUpperCase()}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-0 px-6 text-center">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-semibold text-foreground/70">{item.deletedAt ? format(parseISO(item.deletedAt), 'dd/MM/yyyy') : 'N/A'}</span>
                                                            <span className="text-[10px] font-semibold text-primary/20">{item.deletedAt ? format(parseISO(item.deletedAt), 'HH:mm:ss') : 'N/A'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-0 px-6 text-center">
                                                        <div className="flex items-center justify-center gap-3">
                                                            <div className="flex-1 max-w-[100px] h-1 bg-primary/5 rounded-full overflow-hidden">
                                                                <div className={cn("h-full transition-all duration-1000", daysRemaining <= 3 ? "bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-primary")} style={{ width: `${(daysRemaining / 20) * 100}%` }} />
                                                            </div>
                                                            <span className={cn("text-[10px] font-semibold uppercase tracking-widest min-w-[70px]", daysRemaining <= 3 ? "text-destructive font-semibold" : "text-primary/60")}>
                                                                {daysRemaining} DIAS
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-0 px-10 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/30 hover:text-primary hover:bg-primary/10 transition-all active:scale-95 shadow-sm" onClick={() => handleRestore(item)} title="Restaurar Ativo">
                                                                <Undo className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive/30 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95 shadow-sm" onClick={() => { setItemToDelete(item); setDeleteAlertOpen(true); }} title="Exclusão Irreversível">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {filtered.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-0 h-64 text-center group">
                                                     <div className="flex flex-col items-center gap-4 opacity-20 group-hover:opacity-40 transition-opacity">
                                                        <Info className="h-12 w-12" />
                                                        <span className="text-xs font-semibold uppercase tracking-widest">Nenhuma ocorrência de resíduo localizada</span>
                                                     </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent className="w-[95vw] max-w-xl bg-background/60 backdrop-blur-3xl border-border/40 shadow-premium rounded-xl p-12 overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-destructive pointer-events-none">
                        <AlertTriangle className="h-32 w-32 rotate-12" />
                    </div>
                    <AlertDialogHeader className="space-y-6 relative z-10">
                        <div className="flex flex-col gap-2">
                             <span className="text-destructive font-semibold text-[10px] uppercase tracking-[0.4em]">Protocolo de Destruição</span>
                             <AlertDialogTitle className="text-3xl font-semibold tracking-tighter italic">Excluir Permanentemente?</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-base font-semibold text-muted-foreground/60 leading-relaxed pr-8">
                            Atenção: Este procedimento é <span className="text-destructive font-semibold">irreversível</span>. O registro e todos os metadados vinculados serão purgados do banco de dados imediatamente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-12 flex flex-col sm:flex-row gap-4 relative z-10">
                        <AlertDialogCancel className="w-full sm:w-auto h-16 px-10 rounded-[1.5rem] font-semibold tracking-tight border-border/40 hover:bg-primary/5 transition-all text-sm uppercase tracking-widest text-center">Abortar</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePermanentDelete} className="w-full sm:w-auto h-16 px-10 rounded-[1.5rem] font-semibold tracking-tight bg-destructive shadow-premium shadow-destructive/20 hover:bg-destructive/90 transition-all text-sm uppercase tracking-widest text-center">Confirmar Purga</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
