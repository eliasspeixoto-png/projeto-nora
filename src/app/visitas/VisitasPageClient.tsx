
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { useRouter, useSearchParams } from 'next/navigation';
import { getVisits, getClients, getTeamMembers, deleteVisit, updateVisit, addVisit, getUserByClientId } from '@/lib/firebase/firestore';
import type { Visit, Client, UserProfile, VisitData } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Construction, Calendar as CalendarIcon, List, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import AddEditVisitDialog from '@/components/visitas/add-edit-visit-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import VisitList from '@/components/visitas/visit-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { isPast, parseISO } from 'date-fns';
import { statusConfig } from '@/components/visitas/visit-status';

type SortKey = keyof Visit | 'clientName' | 'technicianName';
type SortDirection = 'asc' | 'desc';

const normalizeString = (str: string | null | undefined) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
};

const formatDateSafe = (dateInput?: string): string => {
    if (!dateInput) return 'Data N/A';
    try {
        const datePart = dateInput.split('T')[0];
        const [year, month, day] = datePart.split('-');
        if (year && month && day) {
            return `${day}/${month}/${year}`;
        }
        return 'Data Inválida';
    } catch (e) {
        return 'Data Inválida';
    }
};

export default function VisitasPageClient() {
  const { userProfile, firebase } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | undefined>(undefined);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [preselectedDate, setPreselectedDate] = useState<Date | undefined>(undefined);
  const [pageSize, setPageSize] = useState(15);
  
  const triggerNotification = async (userId: string, title: string, message: string, data?: any) => {
    try {
        const idToken = await firebase.auth?.currentUser?.getIdToken();
        if (!idToken) return;

        const res = await fetch('/api/notifications/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ userId, title, message, data: { ...data, clickAction: '/visitas' } })
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            console.warn('Push Notification skip:', errorData.error);
        }
    } catch (e) {
        console.error('Falha ao disparar notificação push:', e);
    }
  };

  useEffect(() => {
    if (!userProfile?.companyId || !firebase.db) {
        setIsLoading(false);
        return;
    }

    const companyId = userProfile.companyId;
    let visitUnsubscribe: (() => void) | undefined;
    let clientUnsubscribe: (() => void) | undefined;
    let teamUnsubscribe: (() => void) | undefined;
    
    async function loadData() {
        setIsLoading(true);
        try {
            const clientPromise = new Promise<Client[]>((resolve, reject) => {
                clientUnsubscribe = getClients(firebase.db, companyId, resolve, reject);
            });
            const teamPromise = new Promise<UserProfile[]>((resolve, reject) => {
                teamUnsubscribe = getTeamMembers(firebase.db, companyId, resolve, reject);
            });

            const [clientsData, teamData] = await Promise.all([clientPromise, teamPromise]);
            setClients(clientsData);
            setTeamMembers(teamData);

            visitUnsubscribe = getVisits(firebase.db, companyId, userProfile, (visitsData) => {
                setVisits(visitsData);
                setIsLoading(false);
            }, (error) => {
                 toast({ variant: 'destructive', title: 'Erro ao carregar visitas', description: error.message });
                 setIsLoading(false);
            });
            
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao carregar dados iniciais', description: error.message });
            setIsLoading(false);
        }
    }

    loadData();

    return () => {
      visitUnsubscribe?.();
      clientUnsubscribe?.();
      teamUnsubscribe?.();
    };
  }, [userProfile?.companyId, userProfile, firebase.db, toast]);

  useEffect(() => {
    const visitToOpenId = searchParams?.get('abrir');
    if (!isLoading && visits.length > 0 && visitToOpenId) {
        const foundVisit = visits.find(v => v.id === visitToOpenId);
        if (foundVisit) {
            handleEdit(foundVisit);
            router.replace('/visitas', { scroll: false });
        }
    }
  }, [isLoading, visits, searchParams, router]);

  const onVisitSaved = async (visitData: any, visitId?: string) => {
    if (!userProfile?.companyId || !firebase.db || !firebase.auth) return;
    try {
        if(visitId) {
            await updateVisit(firebase.db, firebase.auth, visitId, visitData);
            toast({ title: "Visita atualizada com sucesso!"});

            // Se o técnico foi alterado ou o dia mudou, notificar técnico
            if (visitData.technicianId) {
                triggerNotification(
                    visitData.technicianId,
                    "Visita Reagendada/Atualizada 📅",
                    `Uma visita foi reagendada ou teve detalhes alterados para ${formatDateSafe(visitData.visitDate)}.`,
                    { visitId, type: 'visit_updated' }
                );
            }

            // Notificar o CLIENTE sobre o agendamento/atualização
            if (visitData.clientId) {
                const clientUser = await getUserByClientId(firebase.db, visitData.clientId);
                if (clientUser?.uid) {
                    const sc = statusConfig as any;
                    const statusLabel = sc[visitData.status]?.label || visitData.status;
                    triggerNotification(
                        clientUser.uid,
                        "Atualização na sua Visita 🏠",
                        `Sua visita nº ${visitData.visitNumber || ''} foi atualizada para o status: ${statusLabel}.`,
                        { visitId, type: 'visit_status_update', clickAction: '/cliente/dashboard' }
                    );
                }
            }
        } else {
            const newVisitId = await addVisit(firebase.db, firebase.auth, { ...visitData, companyId: userProfile.companyId });
            toast({ title: "Visita agendada com sucesso!"});
            
            // Notificar técnico sobre o novo agendamento
            if (visitData.technicianId) {
                triggerNotification(
                    visitData.technicianId,
                    "Nova Visita Agendada 📅",
                    `Você tem uma nova visita agendada para ${formatDateSafe(visitData.visitDate)} às ${visitData.time}.`,
                    { visitId: newVisitId, type: 'visit_assigned' }
                );
            }

            // Notificar o CLIENTE
            if (visitData.clientId) {
                const clientUser = await getUserByClientId(firebase.db, visitData.clientId);
                if (clientUser?.uid) {
                    triggerNotification(
                        clientUser.uid,
                        "Nova Visita Agendada 🏠",
                        `Uma nova visita foi agendada para ${formatDateSafe(visitData.visitDate)} às ${visitData.time}.`,
                        { visitId: newVisitId, type: 'visit_created', clickAction: '/cliente/dashboard' }
                    );
                }
            }
        }
        setDialogOpen(false);
    } catch (err: any) {
        toast({ variant: "destructive", title: "Erro ao salvar", description: err.message });
    }
  };

  const handleEdit = (visit: Visit) => {
    setEditingVisit(visit);
    setPreselectedDate(undefined);
    setDialogOpen(true);
  };

  const handleAddNew = (date?: Date) => {
    setEditingVisit(undefined);
    setPreselectedDate(date);
    setDialogOpen(true);
  };
  
  const confirmDelete = (visitId: string) => {
    setVisitToDelete(visitId);
    setAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!visitToDelete || !firebase.db) return;
    try {
        await deleteVisit(firebase.db, visitToDelete);
        toast({ title: "Visita excluída com sucesso!" });
    } catch (err: any) {
        toast({ variant: "destructive", title: "Erro ao excluir visita", description: err.message });
    } finally {
        setAlertOpen(false);
        setVisitToDelete(null);
    }
  };
  
  const handleStatusChange = async (visitId: string, status: Visit['status']) => {
    if (!firebase.db || !firebase.auth) return;
    try {
        await updateVisit(firebase.db, firebase.auth, visitId, { status });
        toast({title: "Status atualizado!"});
        
        // Notificar técnico sobre a mudança de status
        const visit = visits.find(v => v.id === visitId);
        if (visit) {
            if (visit.technicianId) {
                triggerNotification(
                    visit.technicianId,
                    "Atualização na Agenda",
                    `O status da visita nº ${visit.visitNumber} foi alterado para: ${status}`,
                    { visitId, status, type: 'visit_status_change'}
                );
            }

            // Notificar CLIENTE
            const clientUser = await getUserByClientId(firebase.db, visit.clientId);
            if (clientUser?.uid) {
                const sc = statusConfig as any;
                const statusLabel = sc[status]?.label || status;
                triggerNotification(
                    clientUser.uid,
                    "Status do Serviço Atualizado 🔔",
                    `Seu serviço nº ${visit.visitNumber} agora está como: ${statusLabel}`,
                    { visitId, status, type: 'visit_status_change', clickAction: '/cliente/dashboard'}
                );
            }
        }
    } catch (error: any) {
        toast({variant: 'destructive', title: 'Erro ao atualizar status', description: error.message});
    }
  }
  
  const visitsWithNames = useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, { name: c.name, code: c.clientCode }]));
    const techMap = new Map(teamMembers.map(t => [t.uid, t.displayName]));
    return visits.map(v => ({
      ...v,
      clientName: clientMap.get(v.clientId)?.name || v.clientName || 'Cliente Desconhecido',
      clientCode: clientMap.get(v.clientId)?.code || '',
      technicianName: techMap.get(v.technicianId) || v.technicianName || 'Não atribuído'
    }));
  }, [visits, clients, teamMembers]);

  const { items: sortedVisits, requestSort, sortConfig } = useSortableData(visitsWithNames, { key: 'visitDate', direction: 'desc' });

  const filteredVisits = useMemo(() => {
    let items = [...sortedVisits];
    
    if (filterStatus && filterStatus !== 'all') {
      const isTabAtrasado = filterStatus === 'Atrasada';
      items = items.filter(r => {
          const isOverdue = r.visitDate && isPast(parseISO(`${r.visitDate}T23:59:59`)) && r.status !== 'Finalizada' && r.status !== 'Gerar Orçamento';
          if(isTabAtrasado) return isOverdue;
          return r.status === filterStatus && !isOverdue;
      });
    }

    if (searchTerm) {
        const lowerSearch = normalizeString(searchTerm);
        items = items.filter(v =>
            normalizeString(v.visitNumber).includes(lowerSearch) ||
            normalizeString(v.clientName).includes(lowerSearch) ||
            normalizeString(v.technicianName).includes(lowerSearch) ||
            normalizeString(v.description).includes(lowerSearch) ||
            normalizeString(v.address).includes(lowerSearch) ||
            formatDateSafe(v.visitDate).includes(lowerSearch)
        );
    }

    return items;
  }, [sortedVisits, searchTerm, filterStatus]);

  const paginatedVisits = useMemo(() => {
    return filteredVisits.slice(0, pageSize);
  }, [filteredVisits, pageSize]);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
            <CalendarIcon className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-2xl font-semibold tracking-tighter text-primary">Sincronizando Agenda</p>
            <p className="text-xs font-semibold text-muted-foreground/40 uppercase tracking-[0.3em] animate-pulse">Motor de Inteligência</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-[1750px] mx-auto p-4 md:p-8 animate-in fade-in duration-700 overflow-x-hidden min-h-screen">
      <header className="flex flex-col gap-8 pt-4 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-1">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-primary/10 rounded-xl sm:rounded-2xl shadow-inner shrink-0">
                    <Construction className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <div className="flex flex-col">
                    <h1 className="font-semibold tracking-tighter text-foreground leading-none text-xl">Visitas Técnicas</h1>

                  </div>
                </div>
                
                <div className="relative w-full lg:max-w-md group">
                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                    <Input
                        type="search"
                        placeholder="Pesquisar visitas..."
                        className="w-full h-10 sm:h-12 pl-10 sm:pl-12 bg-background/40 backdrop-blur-md border-border/40 rounded-xl sm:rounded-2xl font-semibold shadow-sm focus-visible:ring-primary/20 transition-all text-xs sm:text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full lg:w-auto">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="flex-1 lg:w-[180px] h-10 sm:h-12 bg-background/40 backdrop-blur-md border-border/40 rounded-xl sm:rounded-2xl font-semibold shadow-sm text-[10px] sm:text-xs">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl sm:rounded-2xl border-border/40 shadow-2xl backdrop-blur-3xl bg-background/90 text-[10px] sm:text-sm font-semibold">
                        <SelectItem value="all">Filtro: Todos</SelectItem>
                        {Object.entries(statusConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={() => handleAddNew()} size="lg" className="px-4 sm:px-8 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-[10px] sm:text-xs tracking-tight shadow-xl shadow-primary/20 active:scale-95 transition-all flex-1 lg:flex-none">
                    <PlusCircle className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" /> 
                    <span className="hidden sm:inline">Nova Visita</span>
                    <span className="sm:hidden">Nova</span>
                </Button>
            </div>
        </div>
      </header>

       <div className="flex-1 mt-4 pb-24 overflow-hidden w-full max-w-full">
            <div className="w-full min-w-0">
                <VisitList 
                    visits={paginatedVisits}
                    onEdit={handleEdit}
                    onDelete={confirmDelete}
                    onStatusChange={handleStatusChange}
                    sortConfig={sortConfig}
                    requestSort={requestSort}
                    suppliers={[]}
                />
            </div>
        </div>
      
      <AddEditVisitDialog
        isOpen={isDialogOpen}
        setOpen={setDialogOpen}
        onVisitSaved={onVisitSaved}
        visit={editingVisit}
        clients={clients}
        teamMembers={teamMembers}
        allVisits={visits}
        preselectedDate={preselectedDate}
        onEdit={handleEdit}
      />
      <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="w-[95vw] max-w-lg bg-background/60 backdrop-blur-3xl border-border/40 shadow-2xl rounded-[2.5rem] p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold tracking-tighter text-primary">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-semibold text-muted-foreground leading-relaxed">
              Você está prestes a remover esta visita permanentemente. Esta operação é irreversível dentro do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex gap-3">
            <AlertDialogCancel className="h-12 rounded-2xl border-border/40 font-semibold hover:bg-black/5 transition-all">Manter Visita</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-12 rounded-2xl bg-destructive font-semibold tracking-tight shadow-xl shadow-destructive/20 hover:bg-destructive/90 transition-all">Sim, Excluir Documento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
