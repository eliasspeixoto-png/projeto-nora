
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getSuppliersOnce, addSupplier, deleteSupplier, updateSupplier, normalizeAndCapitalize } from '@/lib/firebase/firestore'; 
import type { Supplier, SupplierData } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, PlusCircle, Edit, Trash2, Truck, MoreHorizontal, Mail, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import AddEditSupplierDialog from '@/components/fornecedores/add-edit-supplier-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const normalizeString = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export default function FornecedoresPage() {
    const { firebase, userProfile } = useAuth();
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const { items: sortedSuppliers, requestSort, sortConfig } = useSortableData(suppliers, { key: 'name', direction: 'asc' });

    const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [isAlertOpen, setAlertOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);

    const fetchSuppliers = useCallback(async () => {
        if (!userProfile?.companyId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            if (!firebase.db) throw new Error("Firebase não está pronto");
            const mySuppliers = await getSuppliersOnce(firebase.db, userProfile.companyId);
            setSuppliers(mySuppliers);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao carregar fornecedores", description: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [firebase.db, userProfile?.companyId, toast]);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    const filteredSuppliers = useMemo(() => {
        return sortedSuppliers.filter(s => normalizeString(s.name).includes(normalizeString(searchTerm)));
    }, [sortedSuppliers, searchTerm]);

    const handleAddNewSupplier = () => {
        setEditingSupplier(null);
        setSupplierDialogOpen(true);
    };

    const handleEditSupplier = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setSupplierDialogOpen(true);
    };

    const onSupplierSaved = async (data: Partial<Omit<Supplier, "id">>, id?: string) => {
        if (!userProfile?.companyId || !firebase.db) return;
        try {
            if (id) {
                await updateSupplier(firebase.db, id, data as SupplierData);
            } else {
                await addSupplier(firebase.db, { ...data, companyId: userProfile.companyId } as SupplierData);
            }
            toast({ title: "Sucesso!", description: "Fornecedor salvo com sucesso."});
            setSupplierDialogOpen(false);
            fetchSuppliers();
        } catch (err: any) {
            toast({ variant: "destructive", title: `Erro ao salvar`, description: err.message });
            throw err;
        }
    };

    const confirmDeleteSupplier = (id: string) => {
        setSupplierToDelete(id);
        setAlertOpen(true);
    };

    const handleDeleteSupplier = async () => {
        if (!supplierToDelete || !firebase.db) return;
        try {
            await deleteSupplier(firebase.db, supplierToDelete);
            toast({ title: 'Fornecedor removido com sucesso.' });
            fetchSuppliers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro ao excluir.', description: e.message });
        } finally {
            setAlertOpen(false);
            setSupplierToDelete(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background/50 backdrop-blur-md">
                <div className="relative">
                    <Loader2 className="animate-spin text-primary h-12 w-12 opacity-20" />
                    <Truck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/40 animate-pulse">Sincronizando Cadeia de Suprimentos</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 text-foreground">
            
            <header className="flex flex-col gap-8 px-6 pt-8 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-inner text-primary">
                            <Truck className="h-8 w-8" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="font-semibold tracking-tighter text-xl">Fornecedores</h1>

                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative group w-full sm:w-[350px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                            <Input
                                placeholder="Busca inteligente de parceiros..."
                                className="h-9 pl-12 bg-background/40 backdrop-blur-md border-border/40 rounded-lg font-semibold shadow-sm focus-visible:ring-primary/20 text-sm text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button 
                            onClick={handleAddNewSupplier} 
                            className="h-9 w-full sm:w-auto px-8 rounded-lg font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-3 bg-primary shrink-0 text-xs"
                        >
                            <PlusCircle className="h-5 w-5" /> Novo Registro
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 mt-4 px-6 overflow-hidden w-full max-w-full">
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden w-full min-w-0">
                    {filteredSuppliers.length > 0 ? filteredSuppliers.map(supplier => (
                        <Card key={supplier.id} className="w-full border-border/40 bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden active:scale-[0.98] transition-transform" onClick={() => handleEditSupplier(supplier)}>
                            <CardContent className="p-8 space-y-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-lg tracking-tight text-foreground truncate">{supplier.name}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/30 mt-1">{supplier.document || 'SEM DOCUMENTO'}</p>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-10 w-10 rounded-xl hover:bg-primary/10 text-primary/40 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditSupplier(supplier); }} className="rounded-xl"><Edit className="mr-2 h-4 w-4"/>Editar Dados</DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-primary/5" />
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDeleteSupplier(supplier.id); }} className="rounded-xl text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Excluir Parceiro</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="space-y-2 pt-4 border-t border-border/40">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/5 rounded-lg"><Mail className="h-4 w-4 text-primary/40" /></div>
                                        <span className="text-xs font-semibold text-foreground/60 truncate">{supplier.email || 'Não informado'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/5 rounded-lg"><Smartphone className="h-4 w-4 text-primary/40" /></div>
                                        <span className="text-xs font-semibold text-foreground/60">{supplier.phone || supplier.whatsapp || 'Não informado'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )) : (
                         <div className="h-40 flex flex-col items-center justify-center gap-4 bg-background/20 backdrop-blur-md rounded-xl border border-dashed border-border/40 text-muted-foreground/40 opacity-50">
                            <Truck className="h-12 w-12" />
                            <span className="text-xs font-semibold uppercase tracking-widest">Nenhum fornecedor localizado</span>
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
                                        sortDirection={sortConfig?.key === 'name' ? sortConfig.direction : null}
                                        onClick={() => requestSort('name')}
                                        className="px-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Razão Social / Nome Fantasia
                                    </TableHead>
                                    <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">
                                        Contato & Canais
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'document' ? sortConfig.direction : null}
                                        onClick={() => requestSort('document')}
                                        className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                                    >
                                        Documento Fiscal
                                    </TableHead>
                                    <TableHead className="w-20 px-10 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSuppliers.map(supplier => (
                                    <TableRow key={supplier.id} className="cursor-pointer transition-all border-border/40 group h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30" onClick={() => handleEditSupplier(supplier)}>
                                        <TableCell className="py-0 px-10">
                                            <span className="font-semibold text-xs tracking-tight text-foreground transition-colors group-hover:text-primary">{supplier.name}</span>
                                        </TableCell>
                                        <TableCell className="py-0 px-6">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-3 w-3 text-primary/40 transition-colors" />
                                                    <span className="text-xs font-semibold text-foreground/80 truncate">{supplier.email || '---'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Smartphone className="h-3 w-3 text-primary/40 transition-colors" />
                                                    <span className="text-xs font-semibold text-foreground/80">{supplier.phone || '---'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 px-6 font-mono text-xs font-semibold text-foreground/80 transition-colors">
                                            {supplier.document || 'N/A'}
                                        </TableCell>
                                        <TableCell className="py-0 px-10 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-10 w-10 rounded-xl text-primary/20 hover:text-primary hover:bg-primary/10 transition-all active:scale-95" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditSupplier(supplier); }} className="rounded-xl"><Edit className="mr-2 h-4 w-4"/>Editar Perfil</DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-primary/5" />
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDeleteSupplier(supplier.id); }} className="rounded-xl text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Excluir Registro</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredSuppliers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-0 h-64 text-center group">
                                             <div className="flex flex-col items-center gap-4 opacity-20 group-hover:opacity-40 transition-opacity">
                                                <Truck className="h-12 w-12" />
                                                <span className="text-xs font-semibold uppercase tracking-widest">Nenhuma ocorrência de parceiro localizada</span>
                                             </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            <AddEditSupplierDialog isOpen={isSupplierDialogOpen} setOpen={setSupplierDialogOpen} onSave={onSupplierSaved} supplier={editingSupplier} />
            
            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent className="w-[95vw] max-w-lg bg-background/60 backdrop-blur-3xl border-border/40 shadow-premium rounded-xl p-10">
                    <AlertDialogHeader className="space-y-4">
                        <AlertDialogTitle className="text-2xl font-semibold tracking-tighter">Remover Fornecedor?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-semibold text-muted-foreground/60 leading-relaxed">
                            Esta ação é irreversível e removerá todos os vínculos comerciais deste parceiro da plataforma.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 flex flex-col sm:flex-row gap-4">
                        <AlertDialogCancel className="w-full sm:w-auto h-14 px-8 rounded-2xl font-semibold tracking-tight border-border/40 hover:bg-primary/5 transition-all">Manter Registro</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSupplier} className="w-full sm:w-auto h-14 px-8 rounded-2xl font-semibold tracking-tight bg-destructive shadow-xl shadow-destructive/20 hover:bg-destructive/90 transition-all">Confirmar Exclusão</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
