"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/firebase/auth/use-user";
import { getClients, addClient, updateClient, deleteClient } from "@/lib/firebase/firestore";
import type { Client } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PlusCircle, Search, Users, Info } from "lucide-react";
import ClientList from "@/components/clientes/client-list";
import AddEditClientDialog from "@/components/clientes/add-edit-client-dialog";
import { useToast } from "@/hooks/use-toast";
import { useSortableData } from "@/hooks/use-sortable-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQueryClient } from "@tanstack/react-query";

export default function ClientesPageClient() {
  const { userProfile, firebase } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  
  const { items: sortedClients, requestSort, sortConfig } = useSortableData(clients, { key: 'name', direction: 'asc' });

  const normalizeString = (str: string | null | undefined) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };
  
  useEffect(() => {
    if (userProfile?.companyId && firebase.db) {
        setIsLoading(true);
        const unsubscribe = getClients(
            firebase.db, 
            userProfile.companyId, 
            (data) => {
                setClients(data);
                setIsLoading(false);
            },
            (error) => {
                console.error("Error listening to clients:", error);
                toast({
                    variant: "destructive",
                    title: "Erro ao sincronizar clientes",
                });
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    } else if (!userProfile) {
        setIsLoading(false);
    }
  }, [userProfile?.companyId, firebase.db, toast]);

  const onClientSaved = async (clientData: any) => {
    if (!userProfile?.companyId || !firebase.db || !firebase.auth) return;

    try {
        if (editingClient) {
            await updateClient(firebase.db, editingClient.id, { ...clientData, companyId: userProfile.companyId });
        } else {
            await addClient(firebase.db, firebase.auth, { ...clientData, companyId: userProfile.companyId });
        }
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['visits'] });
    } catch(err: any) {
         toast({
            variant: "destructive",
            title: `Erro ao ${editingClient ? 'atualizar' : 'adicionar'} cliente`,
            description: err.message,
        });
        throw err;
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingClient(undefined);
    setDialogOpen(true);
  }

  const handleDelete = async (clientId: string) => {
    if (!firebase.db || !userProfile?.companyId) return;
    try {
        await deleteClient(firebase.db, clientId);
        toast({ title: "Cliente excluído com sucesso!" });
        queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch(err: any) {
        toast({
            variant: "destructive",
            title: "Erro ao excluir cliente",
            description: err.message,
        });
    }
  };

  const filteredClients = useMemo(() => {
    const searchStr = (searchTerm || '').trim().toLowerCase();
    
    if (!searchStr) {
        return [...sortedClients];
    }

    return sortedClients
      .filter((client) => {
          return (
            client.name.toLowerCase().includes(searchStr) ||
            (client.email && client.email.toLowerCase().includes(searchStr)) ||
            (client.phone && client.phone.toLowerCase().includes(searchStr)) ||
            (client.document && client.document.toLowerCase().includes(searchStr)) ||
            (client.clientCode && client.clientCode.toLowerCase().includes(searchStr))
          );
      })
      .sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            const docA = (a.document || '').toLowerCase();
            const docB = (b.document || '').toLowerCase();
            const codeA = (a.clientCode || '').toLowerCase();
            const codeB = (b.clientCode || '').toLowerCase();

            const aExact = nameA === searchStr || docA === searchStr || codeA === searchStr;
            const bExact = nameB === searchStr || docB === searchStr || codeB === searchStr;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = nameA.startsWith(searchStr) || docA.startsWith(searchStr) || codeA.startsWith(searchStr);
            const bStarts = nameB.startsWith(searchStr) || docB.startsWith(searchStr) || codeB.startsWith(searchStr);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            const indexA = sortedClients.indexOf(a);
            const indexB = sortedClients.indexOf(b);
            return indexA - indexB;
      });
  }, [sortedClients, searchTerm]);
  

  if (isLoading) {
    return (
        <div className="flex h-[80vh] items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-[1750px] mx-auto p-4 md:p-8 animate-in fade-in duration-500 overflow-x-hidden">
      <header className="flex flex-col gap-6 pt-4 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 flex-1 min-w-0">
                <div className="space-y-1 shrink-0">
                    <h1 className="font-semibold tracking-tighter flex items-center gap-3 truncate opacity-80 text-xl">
                        <Users className="text-primary h-8 w-8" /> 
                        Clientes
                        <Popover>
                            <PopoverTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-pointer opacity-30 hover:opacity-100 transition-opacity hidden sm:block" />
                            </PopoverTrigger>
                            <PopoverContent className="bg-background/80 backdrop-blur-3xl border-border/40 rounded-xl p-4 shadow-premium">
                                <p className="text-xs font-semibold uppercase tracking-widest leading-relaxed opacity-70">
                                    Gerencie a base de clientes da empresa, configure acessos ao portal e gerencie contratos de comodato.
                                </p>
                            </PopoverContent>
                        </Popover>
                    </h1>
                </div>
                <div className="relative w-full lg:max-w-md min-w-0 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Buscar por nome, CPF/CNPJ, email..."
                        className="h-10 w-full rounded-xl bg-background/50 border-border/40 pl-11 font-semibold focus:bg-background transition-all text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <Button onClick={handleAddNew} className="h-10 w-full sm:w-auto shrink-0 shadow-premium rounded-xl font-semibold uppercase tracking-widest bg-primary hover:scale-[1.02] active:scale-95 transition-all text-xs">
                <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
            </Button>
        </div>
      </header>
      
      <div className="flex-1 mt-6 pb-24 overflow-hidden w-full max-w-full">
        <ClientList 
            clients={filteredClients} 
            onEdit={handleEdit} 
            onDelete={handleDelete}
            sortConfig={sortConfig}
            requestSort={requestSort}
        />
      </div>

      <AddEditClientDialog 
        isOpen={isDialogOpen} 
        setOpen={setDialogOpen}
        onClientSaved={onClientSaved}
        client={editingClient}
      />
    </div>
  );
}
