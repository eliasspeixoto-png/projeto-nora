
"use client";
// VERSION: 2026-03-24-FIX-01
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, User, MoreVertical, Edit, Trash2, ArrowUpDown, Smartphone, Laptop, Mail, MapPin, Loader2, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/firebase/auth/use-user';
import { updateTeamMember, deleteTeamMember, getTeamMembersOnce } from '@/lib/firebase/firestore';
import type { UserProfile } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AddEditMemberDialog from '@/components/equipe/add-edit-member-dialog';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

type SortKey = keyof UserProfile;
type SortDirection = 'asc' | 'desc';

export default function FuncionariosPageClient() {
  const { firebase, company, userProfile } = useAuth();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('clt');

  const { items: sortedMembers, requestSort, sortConfig } = useSortableData(teamMembers, { key: 'displayName', direction: 'asc' });

  const fetchTeamMembers = useCallback(async () => {
    if (!company?.id || !firebase.db) return;
    setIsLoading(true);
    try {
        const members = await getTeamMembersOnce(firebase.db, company.id);
        setTeamMembers(members);
    } catch (error: any) {
        console.error('Erro ao buscar equipe:', error);
        toast({ variant: 'destructive', title: 'Erro ao carregar equipe' });
    } finally {
        setIsLoading(false);
    }
  }, [company?.id, firebase.db, toast]);

  useEffect(() => { fetchTeamMembers(); }, [fetchTeamMembers]);

  const filteredMembers = useMemo(() => {
    let members = sortedMembers.filter(m => m.role !== 'cliente' && !m.deletedAt && (activeTab === 'clt' ? (m.employmentType === 'CLT' || !m.employmentType) : m.employmentType === 'freelance'));
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        members = members.filter(m => m.displayName?.toLowerCase().includes(term) || m.email?.toLowerCase().includes(term));
    }
    return members;
  }, [sortedMembers, searchTerm, activeTab]);

  const handleEditMember = (member: UserProfile) => { setEditingMember(member); setDialogOpen(true); };

  const handleUpdateMember = async (uid: string, data: Partial<Omit<UserProfile, 'uid' | 'email'>>) => {
    if (!firebase.db) return;
    try {
        await updateTeamMember(firebase.db, uid, data);
        toast({ title: 'Sucesso!', description: 'Colaborador atualizado.' });
        fetchTeamMembers();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    }
  };

  const handleDelete = async () => {
    if (!memberToDelete || !firebase.db) return;
    try {
        await deleteTeamMember(firebase.db, memberToDelete);
        toast({ title: 'Colaborador removido.' });
        fetchTeamMembers();
        setAlertOpen(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao remover', description: error.message });
    }
  };

  if (isLoading) {
    return (
        <div className="flex flex-col h-screen items-center justify-center gap-4 bg-transparent backdrop-blur-md">
            <div className="relative">
                <Loader2 className="animate-spin text-primary h-12 w-12 opacity-20" />
                <User className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/40 animate-pulse">Sincronizando Capital Humano</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 text-foreground">
      
      <header className="flex flex-col gap-8 px-6 pt-8 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl shadow-inner text-primary">
                      <User className="h-8 w-8" />
                  </div>
                  <div className="flex flex-col">
                      <h1 className="font-semibold tracking-tighter leading-none text-xl">Equipe & Colaboradores</h1>
                  </div>
              </div>

              <div className="flex items-center gap-3">
                 <Button 
                    onClick={() => { setEditingMember(null); setDialogOpen(true); }} 
                    className="h-12 px-8 rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-3 bg-primary shrink-0"
                 >
                    <Plus className="h-5 w-5" /> Adicionar Talento
                 </Button>
              </div>
          </div>
      </header>

      <div className="px-6 space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto bg-primary/5 p-1 rounded-2xl border border-border/40">
                <div className="w-full overflow-x-auto no-scrollbar">
                    <TabsList className="bg-transparent h-auto p-0 inline-flex w-max min-w-full items-center justify-start sm:justify-center">
                        <TabsTrigger value="clt" className="rounded-xl px-4 sm:px-8 h-10 font-semibold text-[10px] uppercase tracking-normal sm:tracking-widest gap-2 data-[state=active]:bg-background data-[state=active]:shadow-lg active:scale-95 transition-all shrink-0 sm:flex-1 whitespace-nowrap">
                            Efetivos (CLT)
                        </TabsTrigger>
                        <TabsTrigger value="freelance" className="rounded-xl px-4 sm:px-8 h-10 font-semibold text-[10px] uppercase tracking-normal sm:tracking-widest gap-2 data-[state=active]:bg-background data-[state=active]:shadow-lg active:scale-95 transition-all shrink-0 sm:flex-1 whitespace-nowrap">
                            Freelancers (PJ)
                        </TabsTrigger>
                    </TabsList>
                </div>
            </Tabs>

            <div className="relative group w-full sm:w-[350px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                <Input 
                    placeholder="Busca inteligente de talentos..." 
                    className="h-9 pl-12 bg-background/40 backdrop-blur-md border-border/40 rounded-lg font-semibold shadow-sm focus-visible:ring-primary/20 text-sm text-xs" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
        </div>

        <div className="flex-1 overflow-hidden w-full max-w-full">
            {/* Mobile View */}
            <div className="grid gap-4 md:hidden">
                {filteredMembers.map(member => (
                    <Card key={member.uid} className="w-full border-border/40 bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden active:scale-[0.98] transition-transform" onClick={() => handleEditMember(member)}>
                        <CardContent className="p-8 space-y-6">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex items-center gap-4">

                                    <div className="flex flex-col">
                                        <p className="font-semibold text-lg tracking-tight text-foreground truncate">{member.displayName}</p>
                                        <Badge variant="outline" className="w-fit h-5 px-2 rounded-lg border-border/40 bg-primary/5 font-semibold text-xs uppercase tracking-widest text-primary/60 mt-1">
                                            {member.role || 'SEM CARGO'}
                                        </Badge>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-10 w-10 rounded-xl hover:bg-primary/10 text-primary/40 shrink-0" onClick={e => e.stopPropagation()}>
                                            <MoreHorizontal className="h-4 w-4"/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                        <DropdownMenuItem onClick={() => handleEditMember(member)} className="rounded-xl"><Edit className="mr-2 h-4 w-4"/>Editar Perfil</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { setMemberToDelete(member.uid); setAlertOpen(true); }} className="rounded-xl text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Remover</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div className="space-y-2 pt-4 border-t border-border/40">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/5 rounded-lg"><Mail className="h-4 w-4 text-primary/40" /></div>
                                    <span className="text-xs font-semibold text-foreground/60 truncate">{member.email}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/5 rounded-lg"><Smartphone className="h-4 w-4 text-primary/40" /></div>
                                    <span className="text-xs font-semibold text-foreground/60">{member.phone || '---'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl rounded-xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-primary/[0.03] border-border/40 h-[34px]">
                        <TableRow className="hover:bg-transparent h-[34px]">
                            <TableHead 
                                isSortable 
                                sortDirection={sortConfig?.key === 'displayName' ? sortConfig.direction : null}
                                onClick={() => requestSort('displayName')}
                                className="px-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                            >
                                Colaborador
                            </TableHead>
                            <TableHead 
                                isSortable 
                                sortDirection={sortConfig?.key === 'role' ? sortConfig.direction : null}
                                onClick={() => requestSort('role')}
                                className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                            >
                                Função Operacional
                            </TableHead>
                            <TableHead 
                                isSortable 
                                sortDirection={sortConfig?.key === 'email' ? sortConfig.direction : null}
                                onClick={() => requestSort('email')}
                                className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40"
                            >
                                Canais de Contato
                            </TableHead>
                            <TableHead className="text-right w-20 px-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMembers.map(member => (
                            <TableRow key={member.uid} className="[0.03] cursor-pointer transition-all border-border/40 group h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30" onClick={() => handleEditMember(member)}>
                                <TableCell className="py-0 px-10">
                                    <div className="flex items-center gap-4">

                                        <span className="font-semibold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">{member.displayName}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-0 px-6">
                                    <Badge variant="outline" className="h-6 px-3 rounded-lg border-border/40 bg-primary/5 font-semibold text-[9px] uppercase tracking-widest text-primary/60 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                        {member.role || 'SEM DEFINIÇÃO'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-0 px-6">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3 w-3 text-primary/20 group-hover:text-primary/40 transition-colors" />
                                            <span className="text-xs font-semibold text-foreground/60">{member.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="h-3 w-3 text-primary/20 group-hover:text-primary/40 transition-colors" />
                                            <span className="text-[10px] font-semibold text-primary/30 group-hover:text-primary/50 transition-colors uppercase tracking-widest">{member.phone || '---'}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-0 px-10 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/20 hover:text-primary hover:bg-primary/10 transition-all active:scale-95" onClick={(e) => { e.stopPropagation(); handleEditMember(member); }}>
                                            <Edit className="h-4 w-4"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive/20 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95" onClick={(e) => { e.stopPropagation(); setMemberToDelete(member.uid); setAlertOpen(true); }}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
      </div>

      <AddEditMemberDialog isOpen={isDialogOpen} setOpen={setDialogOpen} onInviteSuccess={fetchTeamMembers} onUpdateMember={handleUpdateMember} memberToEdit={editingMember} />
      
      <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="w-[95vw] max-w-lg bg-background/60 backdrop-blur-3xl border-border/40 shadow-premium rounded-xl p-10">
            <AlertDialogHeader className="space-y-4">
                <AlertDialogTitle className="text-2xl font-semibold tracking-tighter">Remover Colaborador?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-semibold text-muted-foreground/60 leading-relaxed">
                    Esta ação removerá todos os acessos e permissões do colaborador na plataforma de forma imediata. O registro será arquivado para auditoria futura.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-10 flex flex-col sm:flex-row gap-4">
                <AlertDialogCancel className="w-full sm:w-auto h-14 px-8 rounded-2xl font-semibold tracking-tight border-border/40 hover:bg-primary/5 transition-all">Manter Acesso</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="w-full sm:w-auto h-14 px-8 rounded-2xl font-semibold tracking-tight bg-destructive shadow-xl shadow-destructive/20 hover:bg-destructive/90 transition-all">Confirmar Remoção</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
