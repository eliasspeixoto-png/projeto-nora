"use client";

import { useState } from "react";
import type { Client } from "@/lib/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash2, Lock, User, MapPin, Phone, Mail, FileText, Smartphone } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ClientListProps = {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  sortConfig: any;
  requestSort: (key: any) => void;
};

const formatClientName = (name: string): string => {
    if (!name) return '';
    return name.trim().toUpperCase();
};

const formatFullAddress = (client: Client) => {
    const parts = [
        client.street,
        client.number,
        client.neighborhood,
        client.city,
        client.state
    ].filter(Boolean);
    if (parts.length === 0) return 'Endereço não informado';
    
    let address = '';
    if(client.street) address += `${client.street}`;
    if(client.number) address += `, ${client.number}`;
    if(client.neighborhood) address += ` - ${client.neighborhood}`;
    if(client.city) address += `. ${client.city}`;
    if(client.state) address += `/${client.state}`;

    return address;
}

export default function ClientList({ clients, onEdit, onDelete, sortConfig, requestSort }: ClientListProps) {
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  const confirmDelete = (clientId: string) => {
    setClientToDelete(clientId);
    setAlertOpen(true);
  }

  const handleDelete = () => {
    if (clientToDelete) {
      onDelete(clientToDelete);
    }
    setAlertOpen(false);
    setClientToDelete(null);
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      {/* Mobile View */}
      <div className="md:hidden grid gap-4 p-1 w-full pb-10">
        {clients.length > 0 ? clients.map((client) => (
          <Card key={client.id} className="w-full border-none bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden transition-all duration-300 active:scale-[0.98]" onClick={() => onEdit(client)}>
            <CardContent className="p-6 space-y-4 min-w-0">
                <div className="flex justify-between items-start gap-2 min-w-0">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <h3 className="font-semibold text-xs tracking-tight truncate break-words text-foreground uppercase">{formatClientName(client.name)}</h3>
                            <p className="font-semibold text-xs text-primary/40 uppercase tracking-widest shrink-0">#{client.clientCode || 'S/ COD'}</p>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4 opacity-40" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium">
                            <DropdownMenuItem className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest cursor-pointer focus:bg-primary/10" onClick={(e) => { e.stopPropagation(); onEdit(client); }}>
                                <Edit className="mr-3 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest cursor-pointer focus:bg-rose-500/10 text-rose-500" onClick={(e) => { e.stopPropagation(); confirmDelete(client.id); }}>
                                <Trash2 className="mr-3 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {client.isComodato && (
                        <Badge variant="secondary" className="h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest bg-primary/10 text-primary border-none">
                            <Lock className="h-3 w-3 mr-1.5"/> Comodato
                        </Badge>
                    )}
                    {client.authUid && (
                        <Badge variant="outline" className="h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest border-green-500/30 text-green-600 bg-green-500/5">
                            <Smartphone className="h-3 w-3 mr-1.5"/> Portal Ativo
                        </Badge>
                    )}
                </div>

                <div className="space-y-3 pt-4 border-t border-border/40">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-3 w-3 text-primary/40 shrink-0 mt-0.5" />
                        <p className="text-xs font-semibold text-muted-foreground/60 leading-tight line-clamp-1">{formatFullAddress(client)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-primary/40 shrink-0" />
                            <p className="text-xs font-semibold tracking-wider text-foreground/50">{client.phone || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <Mail className="h-3 w-3 text-primary/40 shrink-0" />
                            <p className="text-xs font-semibold text-muted-foreground/60 truncate">{client.email || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
          </Card>
        )) : (
            <div className="h-40 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/40 bg-background/20 backdrop-blur-3xl p-8 text-center text-muted-foreground">
                <User className="h-8 w-8 opacity-20 mb-3" />
                <p className="font-semibold uppercase tracking-widest text-[10px] opacity-40">Nenhum cliente na base de dados.</p>
            </div>
        )}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block border-none overflow-hidden w-full bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium">
        <div className="overflow-x-auto w-full">
            <Table>
            <TableHeader className="bg-transparent border-none h-[34px]">
                <TableRow className="hover:bg-transparent border-none h-[34px]">
                    <TableHead 
                        isSortable 
                        className="px-4 font-semibold uppercase tracking-[0.2em] text-xs opacity-40 h-[34px]"
                        sortDirection={sortConfig?.key === 'name' ? sortConfig.direction : null}
                        onClick={() => requestSort('name')}
                    >
                        Cliente / Identificação
                    </TableHead>
                    <TableHead className="px-4 font-semibold uppercase tracking-[0.2em] text-xs opacity-40 h-[34px]">Contato & Local</TableHead>
                    <TableHead 
                        isSortable 
                        sortDirection={sortConfig?.key === 'document' ? sortConfig.direction : null}
                        onClick={() => requestSort('document')}
                        className="px-4 font-semibold uppercase tracking-[0.2em] text-xs opacity-40 h-[34px]"
                    >
                        Documento
                    </TableHead>
                    <TableHead className="w-20 px-4 h-[34px] font-semibold uppercase tracking-[0.2em] text-xs opacity-40 text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody className="border-none">
                {clients.length > 0 ? clients.map((client) => (
                <TableRow key={client.id} className="group transition-all duration-500 border-border/40 cursor-pointer h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30" onClick={() => onEdit(client)}>
                    <TableCell className="py-0 px-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-xs tracking-tight text-foreground uppercase truncate group-hover:text-primary transition-colors">
                                    {formatClientName(client.name)}
                                </span>
                                <span className="font-semibold text-xs uppercase tracking-widest text-primary/40 group-hover:text-primary/60 transition-colors shrink-0">
                                    #{client.clientCode || 'S/ COD'}
                                </span>
                                {client.isComodato && <Lock className="h-3 w-3 text-primary/40 shrink-0" />}
                                {client.authUid && <Smartphone className="h-3 w-3 text-green-500/50 shrink-0" />}
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="py-0 px-4 min-w-[250px]">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 shrink-0">
                                <Mail className="h-3 w-3 text-primary/30" />
                                <span className="text-xs font-semibold text-foreground/60 truncate max-w-[150px]">{client.email || 'sem email'}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Phone className="h-3 w-3 text-primary/30" />
                                <span className="text-xs font-semibold tracking-widest text-foreground/40">{client.phone || 'sem telefone'}</span>
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="h-3 w-3 text-primary/30 shrink-0" />
                                <span className="text-xs font-semibold uppercase tracking-tight text-foreground/30 group-hover:text-foreground/50 transition-colors truncate max-w-[300px]">
                                    {formatFullAddress(client)}
                                </span>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="py-0 px-4">
                        <Badge variant="outline" className="h-5 px-3 rounded-full font-mono font-semibold text-xs uppercase tracking-widest border-border/40 group-hover:border-primary/25 transition-all">
                            {client.document || 'N/A'}
                        </Badge>
                    </TableCell>
                    <TableCell className="py-0 px-4 text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all" onClick={(e) => e.stopPropagation()}>
                                    <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium">
                                <DropdownMenuItem className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest cursor-pointer focus:bg-primary/10" onClick={(e) => { e.stopPropagation(); onEdit(client); }}>
                                    <Edit className="mr-3 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest cursor-pointer focus:bg-rose-500/10 text-rose-500" onClick={(e) => { e.stopPropagation(); confirmDelete(client.id); }}>
                                    <Trash2 className="mr-3 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                </TableRow>
                )) : (
                <TableRow>
                    <TableCell colSpan={4} className="py-0 h-40 text-center">
                        <div className="flex flex-col items-center justify-center py-10 opacity-20">
                            <User className="h-8 w-8 mb-3" />
                            <p className="font-semibold uppercase tracking-[0.2em] text-[10px]">Nenhum cliente encontrado</p>
                        </div>
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </div>

       <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="w-[95vw] max-w-lg border border-border/40 bg-background rounded-2xl shadow-2xl">
          <AlertDialogHeader className="space-y-4">
            <AlertDialogTitle className="text-2xl font-semibold tracking-tighter uppercase opacity-80 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                    <Trash2 className="h-6 w-6" />
                </div>
                Excluir Cliente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              Esta ação removerá permanentemente o cliente e todos os seus históricos, contratos e vínculos do sistema. Esta operação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-8">
            <AlertDialogCancel className="w-full sm:w-auto h-14 rounded-2xl font-semibold uppercase text-[10px] tracking-[0.2em] border-border/40 hover:bg-primary/5">Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600 w-full sm:w-auto h-14 rounded-2xl font-semibold uppercase text-[10px] tracking-[0.2em] text-white shadow-xl shadow-rose-500/20 active:scale-95 transition-all">Confirmar Exclusão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
