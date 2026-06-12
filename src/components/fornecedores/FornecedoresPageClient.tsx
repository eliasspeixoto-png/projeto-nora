"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getSuppliersOnce, addSupplier, deleteSupplier, updateSupplier } from '@/lib/firebase/firestore'; 
import type { Supplier, SupplierData } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, PlusCircle, Edit, Trash2, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import AddEditSupplierDialog from '@/components/fornecedores/add-edit-supplier-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
    const [searchTermSuppliers, setSearchTermSuppliers] = useState('');

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
            if (!firebase.db) {
              throw new Error("Firebase não está pronto");
            }
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
        const searchStr = (searchTermSuppliers || '').trim().toLowerCase();
        if (!searchStr) {
            return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
        }

        return suppliers.filter(s => 
            s.name.toLowerCase().includes(searchStr) || 
            (s.email && s.email.toLowerCase().includes(searchStr)) ||
            (s.document && s.document.toLowerCase().includes(searchStr)) ||
            (s.supplierCode && s.supplierCode.toLowerCase().includes(searchStr))
        ).sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            const docA = (a.document || '').toLowerCase();
            const docB = (b.document || '').toLowerCase();
            const codeA = (a.supplierCode || '').toLowerCase();
            const codeB = (b.supplierCode || '').toLowerCase();

            const aExact = nameA === searchStr || docA === searchStr || codeA === searchStr;
            const bExact = nameB === searchStr || docB === searchStr || codeB === searchStr;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = nameA.startsWith(searchStr) || docA.startsWith(searchStr) || codeA.startsWith(searchStr);
            const bStarts = nameB.startsWith(searchStr) || docB.startsWith(searchStr) || codeB.startsWith(searchStr);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return a.name.localeCompare(b.name);
        });
    }, [suppliers, searchTermSuppliers]);

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
            toast({ title: "Sucesso!", description: "Fornecedor salvo."});
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
            toast({ title: 'Fornecedor excluído.' });
            fetchSuppliers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro ao excluir.', description: e.message });
        } finally {
            setAlertOpen(false);
            setSupplierToDelete(null);
        }
    };

    if (isLoading) {
        return <div className="flex h-full flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2"><Truck /> Meus Fornecedores</CardTitle>
                         <Button onClick={handleAddNewSupplier} size="sm"><PlusCircle className="mr-2"/>Cadastrar Fornecedor</Button>
                    </div>
                    <CardDescription>Gerencie sua lista de fornecedores cadastrados para cotações e pedidos.</CardDescription>
                    <div className="relative pt-2">
                        <Search className="absolute left-2.5 top-4 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar nos seus fornecedores..."
                            className="w-full rounded-lg bg-background pl-8 md:w-[350px]"
                            value={searchTermSuppliers}
                            onChange={(e) => setSearchTermSuppliers(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>Contato</TableHead><TableHead className="text-right h-[34px]">Ações</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filteredSuppliers.length > 0 ? filteredSuppliers.map(supplier => (
                                    <TableRow key={supplier.id}>
                                        <TableCell className="py-0 font-medium uppercase">{supplier.name}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">{supplier.email}</div>
                                            <div className="text-xs text-muted-foreground">{supplier.phone}</div>
                                        </TableCell>
                                        <TableCell className="py-0 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-6 w-6 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEditSupplier(supplier)}><Edit className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => confirmDeleteSupplier(supplier.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Excluir</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={3} className="py-0 h-24 text-center">Nenhum fornecedor cadastrado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AddEditSupplierDialog isOpen={isSupplierDialogOpen} setOpen={setSupplierDialogOpen} onSave={onSupplierSaved} supplier={editingSupplier} />
            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita e removerá o fornecedor da sua lista.</AlertDialogDescription>
                    </AlertDialogHeader>
                     <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSupplier} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
