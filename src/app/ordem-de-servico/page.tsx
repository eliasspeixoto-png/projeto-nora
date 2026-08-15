"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { useData } from '@/providers/data-provider';
import { deleteQuote, updateQuote, getOSReturns, getQuotes, getClients } from '@/lib/firebase/firestore';
import type { Quote, UserProfile, OSReturn, Client } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, User, MapPin, Search, HardHat, Eye, Edit, Trash2, Calendar, Check, AlertTriangle, MoreHorizontal, ChevronLeft, ChevronRight, DollarSign, Layers, Tag, CalendarRange, Truck, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ScheduleServiceDialog from "@/components/ordem-de-servico/schedule-dialog";
import SplitOsDialog from "@/components/ordem-de-servico/split-os-dialog";
import AdvancePaymentDialog from "@/components/ordem-de-servico/advance-payment-dialog";
import { osStatusConfig } from '@/components/ordem-de-servico/os-status-config';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('pt-BR');
};

const formatDateTimeSafe = (dateVal?: string | Date) => {
    if (!dateVal) return 'N/A';
    const date = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    if (isNaN(date.getTime())) return 'Inválido';
    if (date.getTime() === 0) return 'Legado';
    return date.toLocaleString('pt-BR');
};

const statusPriority: Record<string, number> = {
    'Devolvida': 1,
    'Em Execução': 2,
    'Atribuída': 3,
    'Agendado': 4,
    'Pendente': 5,
    'Finalizado': 100,
};

export default function OrdemDeServicoPage() {
    const { firebase, userProfile } = useAuth();
    const { teamMembers, isDataLoading: isGlobalLoading } = useData();
    const [serviceOrders, setServiceOrders] = useState<Quote[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isAlertOpen, setAlertOpen] = useState(false);
    const [osToSchedule, setOsToSchedule] = useState<Quote | null>(null);
    const [osReturns, setOsReturns] = useState<OSReturn[]>([]);
    const [viewingOS, setViewingOS] = useState<Quote | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [osToDelete, setOsToDelete] = useState<string | null>(null);
    const [isScheduleOpen, setScheduleOpen] = useState(false);

    // Modais de Split e Adiantamento
    const [isSplitOpen, setSplitOpen] = useState(false);
    const [osToSplit, setOsToSplit] = useState<Quote | null>(null);
    const [isAdvanceOpen, setAdvanceOpen] = useState(false);
    const [osForAdvance, setOsForAdvance] = useState<Quote | null>(null);

    // Helper to resolve technician names from teamMembers
    const getTechName = (uidOrName?: string) => {
        if (!uidOrName) return "Não registrado";
        if (uidOrName.toLowerCase().includes('elias')) return "Elias Schuindt Peixoto";
        const member = teamMembers?.find(t => t.uid === uidOrName || t.email === uidOrName);
        return member?.displayName || uidOrName;
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    useEffect(() => {
        if (!userProfile?.companyId || !firebase.db) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const unsubQuotes = getQuotes(
            firebase.db,
            userProfile.companyId,
            userProfile,
            (data) => {
                setServiceOrders(data.filter(q => !['draft', 'sent', 'rejected'].includes(q.status)));
                setIsLoading(false);
            },
            (error: any) => {
                console.error("Error loading OS:", error);
                toast({ variant: 'destructive', title: 'Erro ao carregar O.S.', description: error.message });
                setIsLoading(false);
            }
        );

        const unsubClients = getClients(
            firebase.db,
            userProfile.companyId,
            (data) => {
                setClients(data);
            },
            (error: any) => {
                console.error("Error loading clients:", error);
            }
        );

        return () => {
            unsubQuotes();
            unsubClients();
        };
    }, [userProfile?.companyId, firebase.db, toast]);

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
                body: JSON.stringify({ userId, title, message, data })
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.warn('Push Notification skip:', errorData.error, '| Detalhes:', errorData.details, '| Código:', errorData.code);
            }
        } catch (e) {
            console.error('Falha ao disparar notificação push:', e);
        }
    };

    useEffect(() => {
        if (viewingOS && firebase.db && firebase.auth) {
            getOSReturns(firebase.db, viewingOS.id).then(setOsReturns).catch(console.error);
            
            // --- SELF-HEALING: Automática Limpeza do Banco de Dados ---
            // Se detectarmos [DEVOLUÇÃO] no campo notes (lixo legado), limpamos no Firestore na hora.
            if ((viewingOS as any).notes && ((viewingOS as any).notes.includes('[DEVOLUÇÃO]') || (viewingOS as any).notes.includes('Devolvida pelo técnico'))) {
                const cleanedNotes = (viewingOS as any).notes
                    .replace(/\[\d{2}\/\d{2}\/\d{4},.*?\].*?\[DEVOLUÇÃO\].*?(?=\[|$)/gs, '') // Remove formato rico
                    .replace(/\[DEVOLUÇÃO\]:.*?(?=\n|$)/gi, '') // Remove formato simples
                    .replace(/Devolvida pelo técnico:.*?(?=\n|$)/gi, '') // Remove outros formatos
                    .replace(/\n\s*\n/g, '\n') // Remove linhas vazias extras
                    .trim();
                
                if (cleanedNotes !== (viewingOS as any).notes) {
                    updateQuote(firebase.db, firebase.auth, viewingOS.id, { notes: cleanedNotes })
                        .then(() => console.log(`Database Sanitize: O.S. ${(viewingOS as any).quoteNumber} limpa automaticamente.`))
                        .catch(err => console.error("Falha na auto-limpeza:", err));
                }
            }
        } else {
            setOsReturns([]);
        }
    }, [viewingOS?.id, firebase.db, firebase.auth]);

    const filteredOS = useMemo(() => {
        const filtered = serviceOrders.filter(os => {
            const matchesSearch =
                os.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                os.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                os.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (os.assignedTechnicianName && os.assignedTechnicianName.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = filterStatus === 'all' || os.status === filterStatus;

            return matchesSearch && matchesStatus;
        });

        return filtered.sort((a, b) => {
            const searchStr = searchTerm.trim().toLowerCase();
            if (searchStr) {
                const nameA = a.clientName.toLowerCase();
                const nameB = b.clientName.toLowerCase();
                const numA = a.quoteNumber.toLowerCase();
                const numB = b.quoteNumber.toLowerCase();

                const aExact = nameA === searchStr || numA === searchStr;
                const bExact = nameB === searchStr || numB === searchStr;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                const aStarts = nameA.startsWith(searchStr) || numA.startsWith(searchStr);
                const bStarts = nameB.startsWith(searchStr) || numB.startsWith(searchStr);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
            }

            const priorityA = statusPriority[a.status] || 50;
            const priorityB = statusPriority[b.status] || 50;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            const dateA = a.scheduledDate || a.date || "";
            const dateB = b.scheduledDate || b.date || "";
            return dateB.localeCompare(dateA);
        });
    }, [serviceOrders, searchTerm, filterStatus]);

    const paginatedOS = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredOS.slice(startIndex, startIndex + pageSize);
    }, [filteredOS, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredOS.length / pageSize);

    useMemo(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, pageSize]);


    const confirmDelete = (osId: string) => {
        setOsToDelete(osId);
        setAlertOpen(true);
    };

    const handleDelete = async () => {
        if (!osToDelete || !firebase.db) return;
        try {
            await deleteQuote(firebase.db, osToDelete);
            toast({ title: 'Sucesso!', description: 'Ordem de Serviço excluída.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
        } finally {
            setAlertOpen(false);
            setOsToDelete(null);
        }
    };

    const handleSchedule = (os: Quote) => {
        setOsToSchedule(os);
        setScheduleOpen(true);
    };

    const handleSplitOS = (os: Quote) => {
        setOsToSplit(os);
        setSplitOpen(true);
    };

    const handleOpenAdvance = (os: Quote) => {
        setOsForAdvance(os);
        setAdvanceOpen(true);
    };

    const handleConfirmSchedule = async (data: {
        date: string;
        time: string;
        expectedEndDate?: string;
        expectedEndTime?: string;
        unitIdentifier?: string;
        notes?: string;
        technicianId?: string;
    }) => {
        if (!osToSchedule || !firebase.db || !firebase.auth) return;

        try {
            const tech = teamMembers.find(t => t.uid === data.technicianId);
            const newStatus = data.technicianId ? 'Atribuída' : 'Agendado';
            
            const updatePayload: any = {
                status: newStatus as Quote['status'],
                scheduledDate: data.date,
                scheduledTime: data.time,
                executionStartDate: data.date,
                executionStartTime: data.time,
                schedulingNotes: data.notes,
                assignedTechnicianId: data.technicianId || '',
                assignedTechnicianName: tech?.displayName || 'Não atribuído',
                assignedAt: data.technicianId ? new Date().toISOString() : null,
                statusHistory: [
                    ...(osToSchedule.statusHistory || []),
                    {
                        status: newStatus,
                        changedAt: new Date().toISOString(),
                        changedBy: userProfile?.uid,
                        notes: data.technicianId 
                            ? `O.S. Atribuída ao técnico ${tech?.displayName || 'desconhecido'}` 
                            : `O.S. Agendada para ${formatDate(data.date)} às ${data.time}`
                    }
                ]
            };

            if (data.expectedEndDate) {
                updatePayload.expectedEndDate = data.expectedEndDate;
                updatePayload.expectedEndTime = data.expectedEndTime || '18:00';
            }
            if (data.unitIdentifier) {
                updatePayload.unitIdentifier = data.unitIdentifier;
            }

            await updateQuote(firebase.db, firebase.auth, osToSchedule.id, updatePayload);
            toast({ title: 'O.S. Atualizada!', description: data.technicianId ? 'Técnico atribuído com sucesso.' : 'Serviço agendado.' });
            setScheduleOpen(false);

            // Disparar notificação se um técnico foi atribuído
            if (data.technicianId) {
                const osNumber = osToSchedule.quoteNumber.replace('ORC', 'OS');
                triggerNotification(
                    data.technicianId,
                    "Nova O.S. Atribuída 🛠️",
                    `Você foi escalado para a ${osNumber} em ${formatDate(data.date)} às ${data.time}.`,
                    { osId: osToSchedule.id, type: 'assignment', clickAction: '/minhas-os' }
                );
            }

        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
        }
    };

    const handleConfirmRevision = async (osId: string) => {
        if (!firebase.db || !firebase.auth) return;
        const os = serviceOrders.find(o => o.id === osId);
        if (!os) return;

        try {
            const updateData: Partial<Quote> = {
                status: 'Finalizado',
                completionDate: new Date().toISOString(),
                statusHistory: [
                    ...(os.statusHistory || []),
                    {
                        status: 'Finalizado',
                        changedAt: new Date().toISOString(),
                        changedBy: userProfile?.uid,
                        notes: 'Revisão de materiais confirmada pelo administrador.'
                    }
                ]
            };

            await updateQuote(firebase.db, firebase.auth, osId, updateData);
            toast({ title: 'Revisão Confirmada!', description: 'Ordem de Serviço finalizada com sucesso.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao confirmar revisão', description: error.message });
        }
    };

    const handleUpdateStatus = async (osId: string, status: Quote['status']) => {
        if (!firebase.db || !firebase.auth) return;
        try {
            const updateData: any = { status };
            const os = serviceOrders.find(o => o.id === osId);

            // Se mover para Devolvida ou Pendente, libera o técnico
            if (status === 'Devolvida' || status === 'Pendente') {
                updateData.assignedTechnicianId = '';
                updateData.assignedTechnicianName = '';
                updateData.assignedAt = '';
            }

            // Se mover MANUALMENTE para qualquer estado que não seja Devolvida, limpamos os dados da devolução antiga
            if (status !== 'Devolvida') {
                updateData.returnReason = '';
                updateData.returnedBy = '';
                updateData.returnedAt = '';
            }

            updateData.statusHistory = [
                ...(os?.statusHistory || []),
                {
                    status,
                    changedAt: new Date().toISOString(),
                    changedBy: userProfile?.uid,
                    notes: `Status alterado manualmente para ${status}`
                }
            ];

            await updateQuote(firebase.db, firebase.auth, osId, updateData);
            toast({ title: 'Status atualizado!' });

            // Notificar o técnico sobre a mudança de status (se houver um técnico atribuído)
            if (os && os.assignedTechnicianId) {
                const osNumber = os.quoteNumber.replace('ORC', 'OS');
                triggerNotification(
                    os.assignedTechnicianId,
                    "Atualização de O.S.",
                    `O status da ${osNumber} foi alterado para: ${status}`,
                    { osId, status, type: 'status_change', clickAction: '/minhas-os' }
                );
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao atualizar status', description: error.message });
        }
    };

    return (
        <>
            <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
                <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6 flex-1 min-w-0">
                            <h1 className="font-semibold tracking-tighter flex items-center gap-3 shrink-0 truncate opacity-80 text-foreground text-xl">
                                <HardHat className="text-primary h-8 w-8" /> 
                                Ordens de Serviço
                            </h1>
                            <div className="relative w-full lg:max-w-md min-w-0 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    placeholder="Buscar por nº, cliente, técnico ou status..." 
                                    className="h-9 text-xs w-full rounded-lg bg-background/50 border-border/40 pl-11 font-semibold focus:bg-background transition-all" 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="h-9 text-xs w-full sm:w-[200px] rounded-lg bg-background/50 border-border/40 font-semibold focus:ring-0 transition-all">
                                    <SelectValue placeholder="Filtrar por Status" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium">
                                    <SelectItem value="all" className="font-semibold cursor-pointer">Todos os Status</SelectItem>
                                    {Object.entries(osStatusConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key} className="font-semibold cursor-pointer">{config.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={() => router.push('/ordem-de-servico/editar/novo')} className="h-9 text-xs w-full sm:w-auto shrink-0 shadow-premium rounded-lg font-semibold bg-primary hover:scale-[1.02] active:scale-95 transition-all text-white">
                                <PlusCircle className="mr-2 h-4 w-4" /> Nova O.S. Avulsa
                            </Button>
                        </div>
                    </div>
                </header>
                    <div className="flex-1 mt-6 px-4 md:px-8 pb-24 overflow-hidden w-full max-w-full">
                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                {/* Mobile View */}
                                <div className="grid gap-4 md:hidden w-full min-w-0 pb-10">
                                    {paginatedOS.length > 0 ? paginatedOS.map(os => {
                                        const advancesTotal = (os.advancePayments || []).reduce((sum, a) => sum + a.amount, 0);
                                        return (
                                        <Card key={os.id} className="w-full min-w-0 border-none bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden transition-all duration-300 active:scale-[0.98]" onClick={() => setViewingOS(os)}>
                                            <CardContent className="p-5 space-y-3.5 min-w-0">
                                                <div className="flex justify-between items-start gap-2 min-w-0">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-semibold text-xs text-primary/80 uppercase tracking-widest truncate">{os.quoteNumber.replace('ORC', 'OS')}</p>
                                                            {os.unitIdentifier && (
                                                                <Badge variant="outline" className="h-5 px-2 font-bold text-[9px] bg-primary/10 text-primary border-primary/20">
                                                                    <Tag className="h-2.5 w-2.5 mr-1" /> {os.unitIdentifier}
                                                                </Badge>
                                                            )}
                                                            {os.isChildOS && (
                                                                <Badge variant="secondary" className="h-5 px-2 text-[9px] font-semibold opacity-70">
                                                                    {os.childOSIndex}/{os.childOSCount}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                                                            Início: {formatDate(os.scheduledDate)} {os.scheduledTime}
                                                            {os.expectedEndDate && ` • Término: ${formatDate(os.expectedEndDate)}`}
                                                        </p>
                                                    </div>
                                                    <Badge variant={osStatusConfig[os.status]?.variant || 'default'} className="h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest shrink-0">
                                                        {osStatusConfig[os.status]?.label || os.status}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-semibold text-base tracking-tight truncate break-words text-foreground/90 uppercase">{os.clientName}</p>
                                                    <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                                                        <User className="h-3 w-3" /> {os.assignedTechnicianName || 'Não atribuído'}
                                                    </p>
                                                </div>
                                                <div className="flex justify-between items-center mt-2 pt-3 border-t border-border/40 gap-2">
                                                    <div>
                                                        <p className="font-semibold text-blue-600 text-lg tracking-tighter shrink-0">{formatCurrency(os.total)}</p>
                                                        {advancesTotal > 0 && (
                                                            <p className="text-[10px] font-bold text-green-600">
                                                                {formatCurrency(advancesTotal)} adiantados
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-primary/5 text-primary" onClick={(e) => { e.stopPropagation(); setViewingOS(os) }}><Eye className="h-4 w-4"/></Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-9 w-9 rounded-xl bg-muted/50 p-0" onClick={(e) => e.stopPropagation()}>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/95 backdrop-blur-3xl border-border/40 shadow-premium z-50">
                                                                <DropdownMenuItem className="h-9 rounded-xl font-semibold cursor-pointer text-xs" onClick={() => router.push(`/ordem-de-servico/executar/${os.id}`)}>
                                                                    <HardHat className="mr-2 h-3.5 w-3.5 text-primary" />
                                                                    {os.status === 'Finalizado' ? 'Editar Relatório & Fotos' : 'Executar Serviço'}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="h-9 rounded-xl font-semibold cursor-pointer text-xs" onClick={() => router.push(`/ordem-de-servico/editar/${os.id}`)}>
                                                                    <Edit className="mr-2 h-3.5 w-3.5" />Editar O.S. / Materiais
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="h-9 rounded-xl font-semibold cursor-pointer text-xs" onClick={() => handleSchedule(os)}><CalendarRange className="mr-2 h-3.5 w-3.5" />Cronograma / Atribuir</DropdownMenuItem>
                                                                <DropdownMenuItem className="h-9 rounded-xl font-semibold text-green-600 cursor-pointer text-xs" onClick={() => handleOpenAdvance(os)}><DollarSign className="mr-2 h-3.5 w-3.5" />Lançar Adiantamento</DropdownMenuItem>
                                                                {!os.isChildOS && (
                                                                    <DropdownMenuItem className="h-9 rounded-xl font-semibold text-blue-600 cursor-pointer text-xs" onClick={() => handleSplitOS(os)}><Layers className="mr-2 h-3.5 w-3.5" />Fatiar em Múltiplas O.S.</DropdownMenuItem>
                                                                )}
                                                                {os.status === 'revision-pending' && (
                                                                    <DropdownMenuItem className="h-9 rounded-xl font-semibold text-green-600 cursor-pointer text-xs" onClick={() => handleConfirmRevision(os.id)}><Check className="mr-2 h-3.5 w-3.5" />Confirmar Revisão</DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuSeparator className="bg-primary/5" />
                                                                <DropdownMenuItem className="h-9 rounded-xl font-semibold text-destructive cursor-pointer text-xs" onClick={() => confirmDelete(os.id)}><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}) : (
                                        <div className="h-40 flex items-center justify-center rounded-xl border-2 border-dashed border-border/40 text-muted-foreground font-semibold uppercase tracking-widest text-xs">Nenhuma O.S. encontrada.</div>
                                    )}
                                </div>

                                {/* Desktop View */}
                                <div className="hidden md:block border-none overflow-hidden w-full bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium">
                                    <div className="overflow-x-auto w-full">
                                        <Table>
                                            <TableHeader className="bg-primary/5 border-none h-[34px]">
                                                <TableRow className="hover:bg-transparent border-none h-[34px]">
                                                    <TableHead className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Nº O.S.</TableHead>
                                                    <TableHead className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Identificação / Unidade</TableHead>
                                                    <TableHead className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Cliente</TableHead>
                                                    <TableHead className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Início / Término</TableHead>
                                                    <TableHead className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Técnico</TableHead>
                                                    <TableHead className="px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Status</TableHead>
                                                    <TableHead className="text-right px-6 h-[34px] font-semibold uppercase tracking-widest text-[10px] opacity-40 text-foreground">Valor / Saldo</TableHead>
                                                    <TableHead className="w-20 px-6 h-[34px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="border-none">
                                                {paginatedOS.map((os) => {
                                                    const advancesTotal = (os.advancePayments || []).reduce((sum, a) => sum + a.amount, 0);
                                                    return (
                                                    <TableRow 
                                                        key={os.id} 
                                                        className="group dark: transition-all duration-500 border-border/40 cursor-pointer h-[38px] hover:bg-primary/10 even:bg-blue-50/50 dark:even:bg-blue-900/20"
                                                        onClick={() => setViewingOS(os)}
                                                    >
                                                        <TableCell className="py-0 font-semibold text-xs px-6 truncate text-foreground">
                                                            <div className="flex items-center gap-1.5">
                                                                <HardHat className="h-3.5 w-3.5 text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                                                                <span className="font-bold">{os.quoteNumber.replace('ORC', 'OS')}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-0 px-6">
                                                            {os.unitIdentifier ? (
                                                                <Badge variant="outline" className="font-bold text-[10px] bg-primary/10 text-primary border-primary/20">
                                                                    <Tag className="h-3 w-3 mr-1" /> {os.unitIdentifier}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground italic">Geral</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-0 text-xs font-semibold px-6 truncate max-w-[180px] text-foreground">{os.clientName}</TableCell>
                                                        <TableCell className="py-0 text-xs px-6">
                                                            <div className="flex flex-col text-[11px] leading-tight">
                                                                <span className="font-semibold text-foreground/90">{formatDate(os.scheduledDate)} {os.scheduledTime}</span>
                                                                {os.expectedEndDate && (
                                                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                                                                        Até: {formatDate(os.expectedEndDate)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-0 text-xs font-semibold px-6 opacity-70 group-hover:opacity-100 transition-all text-foreground">{os.assignedTechnicianName || 'Não atribuído'}</TableCell>
                                                        <TableCell className="py-0 px-6"><Badge className="h-5 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest shadow-lg shadow-black/5 transition-all group-hover:scale-105" variant={osStatusConfig[os.status]?.variant || 'default'}>{osStatusConfig[os.status]?.label || os.status}</Badge></TableCell>
                                                        <TableCell className="py-0 text-right font-semibold text-xs tracking-tighter px-6">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-blue-600">{formatCurrency(os.total)}</span>
                                                                {advancesTotal > 0 && (
                                                                    <span className="text-[9px] font-bold text-green-600">
                                                                        Adiantado: {formatCurrency(advancesTotal)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-0 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all text-foreground">
                                                                        <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/95 backdrop-blur-3xl border-border/40 shadow-premium z-50">
                                                                    <DropdownMenuItem className="h-9 rounded-xl font-semibold cursor-pointer text-xs" onClick={() => setViewingOS(os)}><Eye className="mr-2 h-3.5 w-3.5" />Visualizar</DropdownMenuItem>
                                                                    <DropdownMenuItem className="h-9 rounded-xl font-semibold cursor-pointer text-xs" onClick={() => router.push(`/ordem-de-servico/executar/${os.id}`)}>
                                                                        <HardHat className="mr-2 h-3.5 w-3.5 text-primary" />
                                                                        {os.status === 'Finalizado' ? 'Editar Relatório & Fotos' : 'Executar Serviço'}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem className="h-9 rounded-xl font-semibold cursor-pointer text-xs" onClick={() => router.push(`/ordem-de-servico/editar/${os.id}`)}>
                                                                        <Edit className="mr-2 h-3.5 w-3.5" />Editar O.S. / Materiais
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem className="h-9 rounded-xl font-semibold cursor-pointer text-xs" onClick={() => handleSchedule(os)}><CalendarRange className="mr-2 h-3.5 w-3.5" />Cronograma / Atribuir</DropdownMenuItem>
                                                                    <DropdownMenuItem className="h-9 rounded-xl font-semibold text-green-600 cursor-pointer text-xs" onClick={() => handleOpenAdvance(os)}><DollarSign className="mr-2 h-3.5 w-3.5" />Lançar Adiantamento</DropdownMenuItem>
                                                                    {!os.isChildOS && (
                                                                        <DropdownMenuItem className="h-9 rounded-xl font-semibold text-blue-600 cursor-pointer text-xs" onClick={() => handleSplitOS(os)}><Layers className="mr-2 h-3.5 w-3.5" />Fatiar em Múltiplas O.S.</DropdownMenuItem>
                                                                    )}
                                                                    {os.status === 'revision-pending' && (
                                                                        <DropdownMenuItem className="h-9 rounded-xl font-semibold text-green-600 cursor-pointer text-xs" onClick={() => handleConfirmRevision(os.id)}><Check className="mr-2 h-3.5 w-3.5" />Confirmar Revisão</DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuSeparator className="bg-primary/5" />
                                                                    <DropdownMenuItem className="h-9 rounded-xl font-semibold text-destructive cursor-pointer text-xs" onClick={() => confirmDelete(os.id)}><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Pagination */}
                                <div className="flex items-center justify-between px-6 py-4 bg-background/20 backdrop-blur-3xl rounded-xl border border-border/40 shadow-premium mb-10">
                                    <div className="flex items-center gap-6">
                                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
                                            {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredOS.length)} de {filteredOS.length} registros
                                        </div>
                                        <div className="hidden sm:flex items-center gap-3">
                                            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">Itens:</Label>
                                            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                                                <SelectTrigger className="h-8 w-[80px] rounded-xl bg-background/50 border-border/40 font-semibold text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl bg-background/80 backdrop-blur-3xl border-border/40">
                                                    <SelectItem value="15" className="font-semibold">15</SelectItem>
                                                    <SelectItem value="50" className="font-semibold">50</SelectItem>
                                                    <SelectItem value="100" className="font-semibold">100</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 rounded-xl hover:bg-primary/10"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </Button>
                                        <div className="text-xs font-semibold uppercase tracking-widest px-2 opacity-80">
                                            {currentPage} / {totalPages || 1}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 rounded-xl hover:bg-primary/10"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage >= totalPages}
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent className="w-[95vw] max-w-lg border border-border/40 bg-background sm:rounded-[2rem] shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-semibold tracking-tighter uppercase opacity-80">Excluir Ordem de Serviço?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">Esta ação enviará o item para a lixeira. Você poderá restaurá-lo mais tarde se precisar.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-6">
                        <AlertDialogCancel className="w-full sm:w-auto h-12 rounded-xl font-semibold border-border/40">Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto h-12 rounded-xl font-semibold text-white">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!viewingOS} onOpenChange={(open) => !open && setViewingOS(null)}>
                <DialogContent className="sm:max-w-[600px] border border-border/40 bg-background sm:rounded-[2rem] shadow-2xl p-0 sm:overflow-hidden">
                    <DialogHeader className="p-8 pb-4 bg-muted/20">
                        <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tighter uppercase text-primary">
                            {viewingOS?.status === 'Devolvida' ? <AlertTriangle className="h-7 w-7 text-destructive" /> : <HardHat className="h-7 w-7 text-primary" />}
                            Histórico da O.S.
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
                            {osStatusConfig[viewingOS?.status || 'Pendente']?.label || viewingOS?.status} • {viewingOS?.quoteNumber.replace('ORC', 'OS')}
                        </DialogDescription>
                    </DialogHeader>

                    {(() => {
                        // 1. Unificação Antecipada da História
                        const rawNotes = viewingOS?.notes || "";
                        const history = [...(viewingOS?.statusHistory || [])];
                        const unifiedEntries: any[] = [];

                        const parseDateBR = (str: string) => {
                            if (!str) return new Date(0);
                            try {
                                const parts = str.split(', ');
                                const datePart = parts[0].trim();
                                const timePart = parts[1] ? parts[1].trim() : "";
                                const dParts = datePart.split('/');
                                if (dParts.length === 3) {
                                    const isoStr = `${dParts[2]}-${dParts[1]}-${dParts[0]}${timePart ? 'T' + timePart : ''}`;
                                    const d = new Date(isoStr);
                                    return isNaN(d.getTime()) ? new Date(str) : d;
                                }
                                return new Date(str);
                            } catch (e) { return new Date(str); }
                        };

                        history.forEach(h => {
                            unifiedEntries.push({
                                status: h.status,
                                date: new Date(h.changedAt),
                                changedAt: h.changedAt,
                                changedBy: h.changedBy,
                                notes: h.notes,
                                registrant: h.changedBy ? getTechName(h.changedBy) : "Administrador",
                                isVirtual: false
                            });
                        });

                        osReturns.forEach(ret => {
                            unifiedEntries.push({
                                status: 'Devolvida',
                                date: new Date(ret.returnedAt),
                                changedAt: ret.returnedAt,
                                registrant: ret.technicianName,
                                notes: ret.reason,
                                location: ret.location,
                                isVirtual: false
                            });
                        });

                        const richReturnRegex = /\[(.*?)\]\s*\[DEVOLUÇÃO\]\s*(?:\[TÉCNICO:\s*(.*?)\])?:\s*(.*?)(?=\[|$)/gs;
                        let rMatch;
                        while ((rMatch = richReturnRegex.exec(rawNotes)) !== null) {
                            const dateStr = rMatch[1];
                            const techFromNote = rMatch[2];
                            const reason = rMatch[3].trim();
                            const isDuplicate = unifiedEntries.some(e => e.notes?.includes(reason));
                            if (!isDuplicate) {
                                const parsedDate = parseDateBR(dateStr);
                                unifiedEntries.push({
                                    status: 'Devolvida',
                                    date: parsedDate,
                                    changedAt: parsedDate.getTime() > 0 ? parsedDate.toISOString() : dateStr,
                                    registrant: techFromNote || "Registro de Campo",
                                    notes: reason,
                                    isVirtual: true
                                });
                            }
                        }

                        const simpleReturnRegex = /\[DEVOLUÇÃO\]:?\s*([^\n]+)|Devolvida pelo técnico:?\s*([^\n]+)/gi;
                        let sMatch;
                        while ((sMatch = simpleReturnRegex.exec(rawNotes)) !== null) {
                            const reason = (sMatch[1] || sMatch[2]).trim();
                            const isDuplicate = unifiedEntries.some(e => e.notes?.includes(reason));
                            if (!isDuplicate) {
                                unifiedEntries.push({
                                    status: 'Devolvida',
                                    date: new Date(0),
                                    registrant: "Registro de Campo",
                                    notes: reason,
                                    isVirtual: true
                                });
                            }
                        }

                        unifiedEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

                        const technicalReturn = unifiedEntries.filter(e => e.status === 'Devolvida').find(h =>
                            (h.notes?.toLowerCase().includes('técnico') || h.registrant?.toLowerCase().includes('elias'))
                        ) || unifiedEntries.filter(e => e.status === 'Devolvida')[0] || null;

                        const returnedBy = technicalReturn?.registrant || "Não informado";
                        const returnedAt = (technicalReturn?.date && !isNaN(technicalReturn.date.getTime())) 
                            ? technicalReturn.date.toISOString() 
                            : technicalReturn?.changedAt || null;

                        let returnReason = technicalReturn?.notes || viewingOS?.returnReason;
                        if (returnReason && returnReason.includes('[DEVOLUÇÃO]')) {
                             const parts = returnReason.split(']:');
                             returnReason = parts[parts.length - 1].trim();
                        }

                        return viewingOS && (
                            <div className="flex flex-col max-h-[75vh]">
                                <div className="p-8 pt-4 space-y-6 overflow-y-auto custom-scrollbar">
                                    {/* Resumo Financeiro & Cronograma */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-4 rounded-xl bg-primary/5 border border-border/40 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-[9px] font-semibold uppercase tracking-widest text-primary/60">Cliente & Unidade</Label>
                                                {viewingOS.unitIdentifier && (
                                                    <Badge variant="outline" className="text-[9px] font-bold bg-primary/10 text-primary border-primary/20">
                                                        <Tag className="h-2.5 w-2.5 mr-1" /> {viewingOS.unitIdentifier}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="font-bold text-base tracking-tight truncate">{viewingOS.clientName}</p>
                                            <p className="text-[10px] text-muted-foreground font-semibold">
                                                Início: {formatDate(viewingOS.scheduledDate)} {viewingOS.scheduledTime || '09:00'}
                                                {viewingOS.expectedEndDate && ` • Previsão: ${formatDate(viewingOS.expectedEndDate)}`}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-[9px] font-semibold uppercase tracking-widest text-blue-600/60">Financeiro da O.S.</Label>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-5 px-2 text-[9px] font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                                                    onClick={() => {
                                                        const currentOs = viewingOS;
                                                        setViewingOS(null);
                                                        handleOpenAdvance(currentOs);
                                                    }}
                                                >
                                                    <DollarSign className="h-3 w-3 mr-0.5" /> + Adiantamento
                                                </Button>
                                            </div>
                                            <div className="flex justify-between items-baseline">
                                                <p className="font-bold text-base tracking-tight text-blue-600">{formatCurrency(viewingOS.total)}</p>
                                                {(() => {
                                                    const advTotal = (viewingOS.advancePayments || []).reduce((sum, a) => sum + a.amount, 0);
                                                    const remaining = Math.max(0, viewingOS.total - advTotal);
                                                    return advTotal > 0 ? (
                                                        <span className="text-[10px] font-bold text-green-600">
                                                            {formatCurrency(advTotal)} pago • Saldo: {formatCurrency(remaining)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-muted-foreground">Sem adiantamentos</span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lista de Adiantamentos se houver */}
                                    {viewingOS.advancePayments && viewingOS.advancePayments.length > 0 && (
                                        <div className="p-3.5 rounded-xl bg-green-50/40 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30 space-y-2">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1.5">
                                                <DollarSign className="h-3.5 w-3.5" /> Adiantamentos Realizados ({viewingOS.advancePayments.length})
                                            </Label>
                                            <div className="space-y-1.5">
                                                {viewingOS.advancePayments.map((adv, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-background/80 border border-border/40">
                                                        <div className="space-y-0.5">
                                                            <span className="font-bold text-green-600">{formatCurrency(adv.amount)}</span>
                                                            <span className="text-[10px] text-muted-foreground ml-2">via {adv.method} em {formatDate(adv.date)}</span>
                                                        </div>
                                                        {adv.notes && <span className="text-[10px] italic text-muted-foreground truncate max-w-[150px]">{adv.notes}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Relatório Técnico de Conclusão / Execução */}
                                    {viewingOS.notes ? (
                                        <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                                                    <HardHat className="h-4 w-4" /> Relatório Técnico de Serviço
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    {viewingOS.completionDate && (
                                                        <span className="text-[10px] font-semibold opacity-60">
                                                            Concluído em: {formatDateTimeSafe(viewingOS.completionDate)}
                                                        </span>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10"
                                                        onClick={() => {
                                                            const id = viewingOS.id;
                                                            setViewingOS(null);
                                                            router.push(`/ordem-de-servico/executar/${id}`);
                                                        }}
                                                    >
                                                        <Edit className="h-3 w-3 mr-1" /> Editar
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-background/90 border border-border/40">
                                                <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium">
                                                    {viewingOS.notes}
                                                </p>
                                            </div>
                                            <div className="flex justify-between items-center pt-1 text-[10px] opacity-75">
                                                <span>Técnico: <strong className="text-foreground">{viewingOS.assignedTechnicianName || 'Não informado'}</strong></span>
                                                {viewingOS.completionLocation && (
                                                    <a 
                                                        href={`https://www.google.com/maps/search/?api=1&query=${viewingOS.completionLocation.latitude},${viewingOS.completionLocation.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary font-bold hover:underline flex items-center gap-1"
                                                    >
                                                        <MapPin className="h-3 w-3" /> Ver GPS de Encerramento
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                                    <HardHat className="h-4 w-4" /> Nenhum parecer técnico digitado
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">Você pode registrar o relatório de serviço e fotos a qualquer momento.</p>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                                                onClick={() => { 
                                                    const id = viewingOS.id; 
                                                    setViewingOS(null); 
                                                    router.push(`/ordem-de-servico/executar/${id}`); 
                                                }}
                                            >
                                                <Edit className="h-3.5 w-3.5 mr-1.5" /> Preencher Parecer / Fotos
                                            </Button>
                                        </div>
                                    )}

                                    {/* Galeria de Fotos Anexadas pelo Técnico */}
                                    {viewingOS.serviceImages && viewingOS.serviceImages.length > 0 ? (
                                        <div className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                                    <Eye className="h-4 w-4" /> Fotos do Serviço ({viewingOS.serviceImages.length})
                                                </Label>
                                                <span className="text-[9px] text-muted-foreground font-semibold">Clique para ampliar</span>
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                                {viewingOS.serviceImages.map((imgUrl, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className="group relative aspect-square rounded-xl overflow-hidden border border-border/40 cursor-pointer hover:scale-105 transition-all shadow-sm bg-background"
                                                        onClick={() => setPreviewImage(imgUrl)}
                                                    >
                                                        <img 
                                                            src={imgUrl} 
                                                            alt={`Foto ${idx + 1}`} 
                                                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" 
                                                        />
                                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <Eye className="h-5 w-5 text-white" />
                                                        </div>
                                                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                                                            #{idx + 1}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Linha do Tempo (Atividades) */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-40 px-1">Atividade Técnica</Label>
                                        <div className="space-y-4">
                                            {unifiedEntries.length > 0 ? unifiedEntries.map((entry, i) => (
                                                <div key={`entry-${i}`} className={cn(
                                                    "p-5 rounded-xl border border-border/40 bg-background/40 backdrop-blur-xl relative group transition-all hover:scale-[1.02] active:scale-95 duration-500",
                                                    entry.status === 'Devolvida' && "border-destructive/20 bg-destructive/5"
                                                )}>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <Badge className={cn(
                                                            "h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest shadow-lg shadow-black/5",
                                                            entry.status === 'Devolvida' ? 'bg-destructive text-white' : 
                                                            entry.status === 'Finalizado' ? 'bg-green-500 text-white' : 'bg-primary text-white'
                                                        )}>
                                                            {entry.status}
                                                        </Badge>
                                                        <span className="text-[10px] font-semibold opacity-30 tracking-widest">{formatDateTimeSafe(entry.date)}</span>
                                                    </div>
                                                    <p className="text-sm font-semibold leading-relaxed text-foreground/80 mb-4">{entry.notes}</p>
                                                    <div className="flex items-center justify-between pt-4 border-t border-border/40">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                                <User className="h-3 w-3 text-primary" />
                                                            </div>
                                                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{entry.registrant}</span>
                                                        </div>
                                                        {entry.status === 'Devolvida' && (viewingOS as any).returnLocation && (
                                                            <a 
                                                                href={`https://www.google.com/maps/search/?api=1&query=${(viewingOS as any).returnLocation.latitude},${(viewingOS as any).returnLocation.longitude}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[9px] font-semibold uppercase tracking-widest text-destructive hover:underline flex items-center gap-1"
                                                            >
                                                                <MapPin className="h-3 w-3" /> Ver Local
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-10 text-center opacity-20 font-semibold uppercase tracking-widest text-xs italic">Sem registros históricos.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Ações do Rodapé */}
                                <div className="p-6 bg-muted/30 border-t border-border/40 grid grid-cols-3 gap-2">
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-xl font-bold uppercase tracking-widest border-border/40 hover:bg-background bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700 text-[10px]"
                                        onClick={() => {
                                            const os = viewingOS;
                                            setViewingOS(null);
                                            router.push(`/orcamentos/details/${os.id}`);
                                        }}
                                    >
                                        <Eye className="mr-1.5 h-3.5 w-3.5 text-primary" /> Detalhes
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-xl font-bold uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/10 text-[10px]"
                                        onClick={() => {
                                            const os = viewingOS;
                                            setViewingOS(null);
                                            router.push(`/ordem-de-servico/executar/${os.id}`);
                                        }}
                                    >
                                        <HardHat className="mr-1.5 h-3.5 w-3.5" /> Editar Execução
                                    </Button>
                                    <Button
                                        className="h-10 rounded-xl font-bold uppercase tracking-widest bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all text-[10px] shadow-lg shadow-primary/20"
                                        onClick={() => setViewingOS(null)}
                                    >
                                        Fechar
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {osToSchedule && (
                <ScheduleServiceDialog
                    isOpen={isScheduleOpen}
                    setOpen={setScheduleOpen}
                    onSchedule={handleConfirmSchedule}
                    quoteNumber={osToSchedule.quoteNumber.replace('ORC', 'OS')}
                    teamMembers={teamMembers}
                    currentTechnicianId={osToSchedule.assignedTechnicianId}
                    currentOS={osToSchedule}
                />
            )}

            {osToSplit && (
                <SplitOsDialog
                    isOpen={isSplitOpen}
                    setOpen={setSplitOpen}
                    quote={osToSplit}
                    teamMembers={teamMembers}
                />
            )}

            {osForAdvance && (
                <AdvancePaymentDialog
                    isOpen={isAdvanceOpen}
                    setOpen={setAdvanceOpen}
                    quote={osForAdvance}
                />
            )}

            {/* Modal de Zoom de Foto */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-3xl p-2 bg-black/90 border-none shadow-2xl overflow-hidden flex items-center justify-center">
                    {previewImage && (
                        <img 
                            src={previewImage} 
                            alt="Foto do Serviço em Alta Resolução" 
                            className="max-h-[85vh] w-auto object-contain rounded-lg" 
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
