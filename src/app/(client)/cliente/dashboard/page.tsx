
"use client";

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/firebase/auth/use-user';
import { getQuotes, getVisits, addVisit, updateVisit, getClient, getTeamMembers, getCommunications, getAccountsReceivableByClient, getComodatoAssetsByClient } from '@/lib/firebase/firestore';
import type { Quote, Visit, VisitData, UserProfile, Communication, Client, AccountsReceivable, ComodatoAsset } from '@/lib/data';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, ClipboardList, HardHat, Construction, PlusCircle, Megaphone, Gift, Tag, CalendarIcon, ImageIcon, Receipt, ShieldCheck, HelpCircle, Phone, Info, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import VisitDetailDialogClient from './VisitDetailDialogClient';
import { format, parseISO, isValid, isAfter, startOfToday, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(amount);
};

const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    // Ajuste para não mostrar a hora, apenas a data
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    if (year && month && day) {
        return `${day}/${month}/${year}`;
    }
    // Fallback
    return new Intl.DateTimeFormat("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const formatFullDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        if (!isValid(date)) return 'Data inválida';
        return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
        return 'Data inválida';
    }
};

const requestSchema = z.object({
    type: z.enum(['manutencao', 'orcamento'], { required_error: 'Selecione um tipo de serviço.' }),
    description: z.string().min(10, 'Por favor, descreva sua necessidade com mais detalhes (mín. 10 caracteres).'),
});

const quoteStatusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'warning' }> = {
    draft: { label: 'Rascunho', variant: 'secondary' },
    sent: { label: 'Enviado', variant: 'default' },
    Aprovado: { label: 'Aprovado', variant: 'success' },
    rejected: { label: 'Recusado', variant: 'destructive' },
    'revision-pending': { label: 'Em Revisão', variant: 'warning' },
};

const osStatusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'warning' }> = {
    Pendente: { label: 'Pendente', variant: 'warning' },
    Agendado: { label: 'Agendada', variant: 'default' },
    Atribuída: { label: 'Atribuída', variant: 'default' },
    'Em Execução': { label: 'Em Execução', variant: 'warning' },
    Finalizado: { label: 'Finalizada', variant: 'success' },
};

const visitStatusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'warning' }> = {
    Solicitada: { label: 'Solicitada', variant: 'warning' },
    Agendada: { label: 'Agendada', variant: 'default' },
    Atribuída: { label: 'Atribuída', variant: 'default' },
    'Gerar Orçamento': { label: 'Gerar Orçamento', variant: 'warning' },
    Finalizada: { label: 'Finalizada', variant: 'success' },
};


function ClientDashboard() {
    const { userProfile, signOut, company, firebase } = useAuth();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [allCommunications, setAllCommunications] = useState<Communication[]>([]);
    const [team, setTeam] = useState<UserProfile[]>([]);
    const [clientData, setClientData] = useState<Client | null>(null);
    const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
    const [assets, setAssets] = useState<ComodatoAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRequestingService, setIsRequestingService] = useState(false);
    const [isRequestDialogOpen, setRequestDialogOpen] = useState(false);
    const [isVisitDetailOpen, setVisitDetailOpen] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
    const [isImageZoomOpen, setImageZoomOpen] = useState(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("quotes");
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof requestSchema>>({
        resolver: zodResolver(requestSchema),
    });

    useEffect(() => {
        if (userProfile?.clientId && firebase.db) {
            setIsLoading(true);
            getClient(firebase.db, userProfile.clientId)
                .then(data => {
                    setClientData(data);
                })
                .catch(err => {
                    console.error("Erro ao buscar dados do cliente:", err);
                    toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar seus dados de cliente.' });
                }).finally(() => {
                    setIsLoading(false);
                });
        } else if (userProfile) { // If there's a profile but no client ID
            setIsLoading(false);
        }
    }, [userProfile?.clientId, firebase.db]);

    useEffect(() => {
        if (!clientData?.id || !userProfile?.companyId || !firebase.db) return;

        const { db } = firebase;
        const companyId = userProfile.companyId;

        const unsubQuotes = getQuotes(db, companyId, userProfile, setQuotes, console.error);
        const unsubVisits = getVisits(db, companyId, userProfile, setVisits, console.error);
        const unsubTeam = getTeamMembers(db, companyId, setTeam, console.error);
        const unsubComms = getCommunications(db, companyId, setAllCommunications, console.error);
        const unsubReceivables = getAccountsReceivableByClient(db, companyId, clientData.id, setReceivables, console.error);
        const unsubAssets = getComodatoAssetsByClient(db, companyId, clientData.id, setAssets, console.error);

        return () => {
            unsubQuotes();
            unsubVisits();
            unsubTeam();
            unsubComms();
            unsubReceivables();
            unsubAssets();
        };
    }, [clientData?.id, userProfile?.companyId, userProfile?.uid, firebase.db]);


    const { openQuotes, serviceOrders, pendingInvoices, activeAssets, activeVisitsCount } = useMemo(() => {
        const filteredQuotes = quotes.filter(q => ['draft', 'sent', 'Aprovado', 'rejected', 'revision-pending'].includes(q.status));
        const filteredServices = quotes.filter(q => ['Pendente', 'Atribuída', 'Em Execução', 'Finalizado', 'Agendado'].includes(q.status));
        const filteredReceivables = receivables.filter(r => r.status !== 'Pago');
        const filteredAssets = assets.filter(a => a.status === 'active');
        const visitsCount = visits.filter(v => ['Solicitada', 'Agendada', 'Atribuída'].includes(v.status)).length;
        
        return { 
            openQuotes: filteredQuotes, 
            serviceOrders: filteredServices, 
            pendingInvoices: filteredReceivables, 
            activeAssets: filteredAssets, 
            activeVisitsCount: visitsCount 
        };
    }, [quotes, receivables, assets, visits]);

    // Filtragem dos comunicados
    const communications = useMemo(() => {
        const today = startOfToday();
        return allCommunications.filter(comm => {
            if (!clientData) return false;

            // Filtro de expiração: não mostra itens que já expiraram.
            if (comm.expiresAt) {
                const expiryDate = parseISO(comm.expiresAt);
                if (isBefore(expiryDate, today)) {
                    return false; // A promoção expirou
                }
            }

            // Filtro de público
            if (comm.targetAudience === 'all') return true;
            if (comm.targetAudience === 'comodato' && clientData.isComodato) return true;
            if (comm.targetAudience === 'non-comodato' && !clientData.isComodato) return true;

            return false;
        }).sort((a, b) => parseISO(b.sentAt).getTime() - parseISO(a.sentAt).getTime());
    }, [allCommunications, clientData]);


    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    const handleServiceRequestSubmit = async (values: z.infer<typeof requestSchema>) => {
        if (!userProfile?.clientId || !userProfile.displayName || !company?.id || !firebase) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível identificar seu usuário. Por favor, faça login novamente.' });
            return;
        }

        // Formatar endereço do cadastro do cliente se disponível
        const formattedAddress = clientData?.address || 
            [clientData?.street, clientData?.number, clientData?.neighborhood, clientData?.city]
            .filter(Boolean)
            .join(', ') || 
            (userProfile.street ? `${userProfile.street}, ${userProfile.number}` : 'Endereço a confirmar');

        setIsRequestingService(true);
        try {
            const visitData: Omit<Visit, 'id' | 'companyId' | 'creationDate' | 'visitNumber'> = {
                clientId: userProfile.clientId,
                clientName: userProfile.displayName,
                technicianId: '', // Será atribuído pelo admin
                technicianName: '',
                visitDate: format(new Date(), "yyyy-MM-dd"), // Hoje
                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                address: formattedAddress,
                description: `[${values.type === 'manutencao' ? 'MANUTENÇÃO CORRETIVA' : 'NOVA INSTALAÇÃO/ORÇAMENTO'}]\n${values.description}`,
                status: 'Solicitada', // Inicia como Solicitada para admin/supervisor agendar
                serviceReport: '',
                requiredMaterials: '',
                attachments: [],
                creatorName: 'Cliente via Portal',
            };

            const newVisitId = await addVisit(firebase.db, firebase.auth, { ...visitData, companyId: company.id });


            // Notificar Administradores sobre a nova solicitação
            try {
                const idToken = await firebase.auth.currentUser?.getIdToken();
                if (idToken) {
                    await fetch('/api/notifications/notify-admins', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({
                            title: "Nova Solicitação de Serviço 🆕",
                            message: `${userProfile.displayName} solicitou um novo serviço: ${values.type === 'manutencao' ? 'Manutenção' : 'Orçamento'}.`,
                            data: { visitId: newVisitId, clickAction: '/visitas' }
                        })
                    });
                }
            } catch (notifyErr) {
                console.error('Falha ao notificar admins:', notifyErr);
            }

            toast({ title: 'Solicitação Enviada!', description: 'Sua solicitação foi registrada. Em breve nossa equipe entrará em contato.' });
            form.reset();
            setRequestDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Enviar Solicitação', description: error.message });
        } finally {
            setIsRequestingService(false);
        }
    };

    const handleRescheduleRequest = async (notes: string) => {
        if (!selectedVisit?.id || !firebase.db || !userProfile?.displayName) return;

        try {
            await updateVisit(firebase.db, firebase.auth, selectedVisit.id, {
                rescheduleRequested: true,
                rescheduleNotes: notes
            });

            // Notificar Técnico, Admin e Supervisor
            try {
                const idToken = await firebase.auth.currentUser?.getIdToken();
                if (idToken) {
                    const payload = {
                        title: "Pedido de Alteração 📅",
                        message: `${userProfile.displayName} solicitou mudança de horário na visita #${selectedVisit.visitNumber}: ${notes}`,
                        data: { visitId: selectedVisit.id, clickAction: '/visitas' }
                    };

                    // 1. Notificar Admins e Supervisores
                    fetch('/api/notifications/notify-admins', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                        body: JSON.stringify(payload)
                    }).catch(err => console.error('Falha ao notificar admins:', err));

                    // 2. Notificar Técnico (se um técnico estiver atribuído)
                    if (selectedVisit.technicianId) {
                        fetch('/api/notifications/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                            body: JSON.stringify({
                                ...payload,
                                userId: selectedVisit.technicianId,
                                data: { ...payload.data, clickAction: '/ordem-de-servico' }
                            })
                        }).catch(err => console.error('Falha ao notificar técnico:', err));
                    }
                }
            } catch (notifyErr) {
                console.error('Erro no fluxo de notificações:', notifyErr);
            }

            toast({ 
                title: 'Solicitação Enviada!', 
                description: 'Nossa equipe foi notificada e entrará em contato para confirmar o novo horário.' 
            });
            setVisitDetailOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao Solicitar Alteração', description: error.message });
        }
    };

    const handleOpenVisitDetails = (visit: Visit) => {
        const technician = team.find(t => t.uid === visit.technicianId);
        const visitWithDetails = {
            ...visit,
            clientName: userProfile?.displayName,
            technicianName: technician?.displayName || visit.technicianName || 'Não Atribuído',
        };
        setSelectedVisit(visitWithDetails);
        setVisitDetailOpen(true);
    };

    const handleImageClick = (url: string) => {
        setZoomedImageUrl(url);
        setImageZoomOpen(true);
    };

    const onVisitSaved = async (visitData: VisitData, visitId?: string) => {
        if (!userProfile?.companyId || !firebase) return;
        try {
            if (visitId) {
                await updateVisit(firebase.db, firebase.auth, visitId, visitData);
                toast({ title: "Visita atualizada com sucesso!" });
            }
            setVisitDetailOpen(false);
        } catch (err: any) {
            toast({ variant: "destructive", title: "Erro ao salvar", description: err.message });
        }
    };

    if (isLoading || !userProfile || !firebase || !clientData) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-muted/40">
            <header className="bg-background border-b p-4 shadow-sm">
                <div className="px-4 md:px-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {company?.logoUrl && (
                            <div className="relative h-10 w-24">
                                <Image src={company.logoUrl} alt={company.name || 'Logo'} fill style={{ objectFit: 'contain' }} sizes="96px" />
                            </div>
                        )}
                        <h1 className="text-xl font-semibold text-primary hidden sm:block">Portal do Cliente</h1>
                    </div>
                    <nav className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/cliente/meus-dados">Meus Dados</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleSignOut}>Sair</Button>
                    </nav>
                </div>
            </header>
            <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
                <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/95 via-primary/80 to-primary/90 p-8 text-primary-foreground shadow-premium">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-primary-foreground/10 blur-3xl" />

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h2 className="font-extrabold tracking-tight mb-2 text-xl">Olá, {userProfile?.displayName.split(' ')[0]}!</h2>
                            <p className="text-primary-foreground/80 text-lg max-w-md">Bem-vindo(a) ao seu portal exclusivo. Aqui você tem controle total sobre seus serviços e ativos.</p>
                        </div>
                        <Dialog open={isRequestDialogOpen} onOpenChange={setRequestDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="lg" variant="secondary" className="font-semibold shadow-lg hover:scale-105 transition-transform">
                                    <PlusCircle className="mr-2 h-5 w-5" /> Solicitar Novo Serviço
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl">Nova Solicitação</DialogTitle>
                                    <DialogDescription>O que você precisa hoje? Descreva os detalhes e nossa equipe entrará em contato.</DialogDescription>
                                </DialogHeader>
                                <Form {...form}>
                                    <form id="service-request-form" onSubmit={form.handleSubmit(handleServiceRequestSubmit)} className="space-y-6 py-4">
                                        <FormField
                                            control={form.control}
                                            name="type"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormLabel className="text-base font-semibold">Tipo de Serviço</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup
                                                            onValueChange={field.onChange}
                                                            defaultValue={field.value}
                                                            className="grid grid-cols-1 gap-4"
                                                        >
                                                            <FormItem className="flex items-center space-x-3 space-y-0 rounded-xl border p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                                                                <FormControl><RadioGroupItem value="manutencao" /></FormControl>
                                                                <div className="flex flex-col">
                                                                    <FormLabel className="font-semibold">Manutenção Corretiva</FormLabel>
                                                                    <span className="text-xs text-muted-foreground">Algo não está funcionando corretamente</span>
                                                                </div>
                                                            </FormItem>
                                                            <FormItem className="flex items-center space-x-3 space-y-0 rounded-xl border p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                                                                <FormControl><RadioGroupItem value="orcamento" /></FormControl>
                                                                <div className="flex flex-col">
                                                                    <FormLabel className="font-semibold">Novo Projeto / Orçamento</FormLabel>
                                                                    <span className="text-xs text-muted-foreground">Instalação, expansão ou novos equipamentos</span>
                                                                </div>
                                                            </FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-base font-semibold">Detalhes da sua necessidade</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Ex: Minha cerca parou de disparar, ou preciso de 2 novas câmeras no portão..."
                                                            className="min-h-[120px] resize-none rounded-xl"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </form>
                                </Form>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setRequestDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                                    <Button type="submit" form="service-request-form" disabled={isRequestingService} className="rounded-xl px-8">
                                        {isRequestingService ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Confirmar Solicitação
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
                        <div 
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center gap-4 group hover:bg-white/20 transition-all cursor-pointer active:scale-95"
                            onClick={() => setActiveTab("quotes")}
                        >
                            <div className="bg-blue-500/20 p-3 rounded-xl group-hover:bg-blue-500/30 transition-colors"><ClipboardList className="h-6 w-6 text-blue-200" /></div>
                            <div>
                                <p className="text-xs text-primary-foreground/60 font-medium">Orçamentos</p>
                                <p className="text-2xl font-semibold">{openQuotes.length}</p>
                            </div>
                        </div>
                        <div 
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center gap-4 group hover:bg-white/20 transition-all cursor-pointer active:scale-95"
                            onClick={() => setActiveTab("visits")}
                        >
                            <div className="bg-indigo-500/20 p-3 rounded-xl group-hover:bg-indigo-500/30 transition-colors"><Construction className="h-6 w-6 text-indigo-200" /></div>
                            <div>
                                <p className="text-xs text-primary-foreground/60 font-medium">Suas Visitas</p>
                                <p className="text-2xl font-semibold">{activeVisitsCount}</p>
                            </div>
                        </div>
                        <div 
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center gap-4 group hover:bg-white/20 transition-all cursor-pointer active:scale-95"
                            onClick={() => setActiveTab("service-orders")}
                        >
                            <div className="bg-orange-500/20 p-3 rounded-xl group-hover:bg-orange-500/30 transition-colors"><HardHat className="h-6 w-6 text-orange-200" /></div>
                            <div>
                                <p className="text-xs text-primary-foreground/60 font-medium">Serviços Ativos</p>
                                <p className="text-2xl font-semibold">{serviceOrders.length}</p>
                            </div>
                        </div>
                        <div 
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center gap-4 group hover:bg-white/20 transition-all cursor-pointer active:scale-95"
                            onClick={() => setActiveTab("finance")}
                        >
                            <div className="bg-green-500/20 p-3 rounded-xl group-hover:bg-green-500/30 transition-colors"><Receipt className="h-6 w-6 text-green-200" /></div>
                            <div>
                                <p className="text-xs text-primary-foreground/60 font-medium">Faturas</p>
                                <p className="text-2xl font-semibold">{pendingInvoices.length}</p>
                            </div>
                        </div>
                        <div 
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center gap-4 group hover:bg-white/20 transition-all cursor-pointer active:scale-95"
                            onClick={() => setActiveTab("assets")}
                        >
                            <div className="bg-purple-500/20 p-3 rounded-xl group-hover:bg-purple-500/30 transition-colors"><ShieldCheck className="h-6 w-6 text-purple-200" /></div>
                            <div>
                                <p className="text-xs text-primary-foreground/60 font-medium">Meus Ativos</p>
                                <p className="text-2xl font-semibold">{activeAssets.length}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto p-1 bg-muted/50 rounded-2xl">
                        <TabsTrigger value="quotes" className="rounded-xl py-3 data-[state=active]:shadow-md">
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Orçamentos
                        </TabsTrigger>
                        <TabsTrigger value="service-orders" className="rounded-xl py-3 data-[state=active]:shadow-md">
                            <HardHat className="mr-2 h-4 w-4" />
                            Serviços
                        </TabsTrigger>
                        <TabsTrigger value="visits" className="rounded-xl py-3 data-[state=active]:shadow-md">
                            <Construction className="mr-2 h-4 w-4" />
                            Visitas
                        </TabsTrigger>
                        <TabsTrigger value="finance" className="rounded-xl py-3 data-[state=active]:shadow-md">
                            <Receipt className="mr-2 h-4 w-4" />
                            Financeiro
                        </TabsTrigger>
                        {clientData.isComodato && (
                            <TabsTrigger value="assets" className="rounded-xl py-3 data-[state=active]:shadow-md">
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Equipamentos
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="communications" className="rounded-xl py-3 data-[state=active]:shadow-md">
                            <Megaphone className="mr-2 h-4 w-4" />
                            Comunicados
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="quotes">
                        <Card className="border-none shadow-xl rounded-xl overflow-hidden">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> Seus Orçamentos</CardTitle>
                                <CardDescription>Consulte suas propostas comerciais em aberto.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/50 h-[34px]">
                                        <TableRow>
                                            <TableHead className="w-[100px] pl-6 h-[34px]">Nº</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right pr-6 h-[34px]">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {openQuotes.length > 0 ? openQuotes.map(quote => (
                                            <TableRow key={quote.id} onClick={() => router.push(`/orcamentos/view/${quote.id}`)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                                                <TableCell className="py-0 font-semibold pl-6 text-primary">{quote.quoteNumber}</TableCell>
                                                <TableCell className="py-0 ">{formatDate(quote.date)}</TableCell>
                                                <TableCell className="py-0 ">
                                                    <Badge variant={quoteStatusConfig[quote.status]?.variant || 'default'} className="rounded-full px-3">
                                                        {quoteStatusConfig[quote.status]?.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-0 text-right font-semibold pr-6">{formatCurrency(quote.total)}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-0 text-center h-48">
                                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                        <Info className="h-10 w-10 mb-2 opacity-20" />
                                                        <p>Nenhum orçamento em aberto no momento.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="service-orders">
                        <Card className="border-none shadow-xl rounded-xl overflow-hidden">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2"><HardHat className="h-5 w-5 text-primary" /> Ordens de Serviço</CardTitle>
                                <CardDescription>Acompanhe o status e histórico de execução dos seus serviços.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/50 h-[34px]">
                                        <TableRow>
                                            <TableHead className="w-[120px] pl-6 h-[34px]">Nº O.S.</TableHead>
                                            <TableHead>Data Prevista</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right pr-6 h-[34px]">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {serviceOrders.length > 0 ? serviceOrders.map(os => (
                                            <TableRow key={os.id} onClick={() => router.push(`/orcamentos/view/${os.id}`)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                                                <TableCell className="py-0 font-semibold pl-6 text-primary">{os.quoteNumber.replace('ORC', 'O.S').replace('PRO', 'O.S')}</TableCell>
                                                <TableCell className="py-0 ">{formatDate(os.scheduledDate || os.date)}</TableCell>
                                                <TableCell className="py-0 ">
                                                    <Badge variant={osStatusConfig[os.status]?.variant || 'default'} className="rounded-full px-3">
                                                        {osStatusConfig[os.status]?.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-0 text-right font-semibold pr-6">{formatCurrency(os.total)}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-0 text-center h-48">
                                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                        <Info className="h-10 w-10 mb-2 opacity-20" />
                                                        <p>Nenhum serviço ativo no momento.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="visits">
                        <Card className="border-none shadow-xl rounded-xl overflow-hidden">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2"><Construction className="h-5 w-5 text-primary" /> Visitas Técnicas</CardTitle>
                                <CardDescription>Agendamentos de técnicos em sua unidade.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/50 h-[34px]">
                                        <TableRow>
                                            <TableHead className="w-[120px] pl-6 h-[34px]">Nº Visita</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="pr-6 h-[34px]">Informações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visits.length > 0 ? visits.map(visit => (
                                            <TableRow key={visit.id} onClick={() => handleOpenVisitDetails(visit)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                                                <TableCell className="py-0 font-semibold pl-6 text-primary">{visit.visitNumber}</TableCell>
                                                <TableCell className="py-0 ">{formatDate(visit.visitDate)}</TableCell>
                                                <TableCell className="py-0 ">
                                                    <Badge variant={visitStatusConfig[visit.status]?.variant || 'default'} className="rounded-full px-3">
                                                        {visitStatusConfig[visit.status]?.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-0 pr-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-sm font-medium truncate max-w-[300px]">{visit.description}</span>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <CalendarIcon className="h-3 w-3" /> {visit.time}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-0 text-center h-48">
                                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                        <Info className="h-10 w-10 mb-2 opacity-20" />
                                                        <p>Nenhuma visita registrada.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="finance">
                        <Card className="border-none shadow-xl rounded-xl overflow-hidden">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Financeiro</CardTitle>
                                <CardDescription>Acompanhe suas faturas e situação de pagamentos.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/50 h-[34px]">
                                        <TableRow>
                                            <TableHead className="w-[150px] pl-6 font-semibold h-[34px]">Documento / O.S.</TableHead>
                                            <TableHead>Vencimento</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right pr-6 h-[34px]">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {receivables.length > 0 ? receivables.sort((a, b) => parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime()).map(item => (
                                            <TableRow key={item.id} className="hover:bg-muted/30 transition-colors h-[34px]">
                                                <TableCell className="py-0 font-semibold pl-6 text-primary">{item.quoteNumber.replace('ORC', 'O.S').replace('PRO', 'O.S')}</TableCell>
                                                <TableCell className="py-0 flex items-center gap-2">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    {formatDate(item.dueDate)}
                                                </TableCell>
                                                <TableCell className="py-0 ">
                                                    {item.status === 'Pago' ? (
                                                        <Badge className="bg-green-100 text-green-700 border-green-200 rounded-full px-3 flex w-fit items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" /> Pago
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="rounded-full px-3 flex w-fit items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" /> {isAfter(new Date(), parseISO(item.dueDate)) ? 'Vencido' : 'Pendente'}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-0 text-right font-semibold pr-6">
                                                    {formatCurrency(item.amount || item.originalAmount || 0)}
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-0 text-center h-48">
                                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                        <Info className="h-10 w-10 mb-2 opacity-20" />
                                                        <p>Nenhuma conta a receber encontrada.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {clientData.isComodato && (
                        <TabsContent value="assets">
                            <Card className="border-none shadow-xl rounded-xl overflow-hidden">
                                <CardHeader className="bg-muted/30">
                                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Meus Equipamentos</CardTitle>
                                    <CardDescription>Lista de ativos sob seu contrato de comodato.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-muted/50 h-[34px]">
                                            <TableRow>
                                                <TableHead className="pl-6 font-semibold h-[34px]">Equipamento</TableHead>
                                                <TableHead>Nº Série / Patrimônio</TableHead>
                                                <TableHead>Instalação</TableHead>
                                                <TableHead className="pr-6 h-[34px]">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {assets.length > 0 ? assets.map(asset => (
                                                <TableRow key={asset.id} className="hover:bg-muted/30 transition-colors h-[34px]">
                                                    <TableCell className="py-0 font-semibold pl-6 text-primary">{asset.model}</TableCell>
                                                    <TableCell className="py-0 font-mono text-xs">{asset.serial}</TableCell>
                                                    <TableCell className="py-0 ">{asset.installationDate ? formatDate(asset.installationDate) : 'N/A'}</TableCell>
                                                    <TableCell className="py-0 pr-6">
                                                        <Badge variant={asset.status === 'active' ? 'success' : 'secondary'} className="rounded-full px-3">
                                                            {asset.status === 'active' ? 'Operacional' : asset.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="py-0 text-center h-48">
                                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                            <Info className="h-10 w-10 mb-2 opacity-20" />
                                                            <p>Nenhum equipamento vinculado ao seu contrato.</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

                    <TabsContent value="communications">
                        <Card className="border-none shadow-xl rounded-xl overflow-hidden">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Comunicados e Promoções</CardTitle>
                                <CardDescription>Fique por dentro das novidades da {company?.name}.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {communications.length > 0 ? communications.map(comm => (
                                        <Card key={comm.id} className="bg-muted/20 border-none rounded-2xl overflow-hidden flex flex-col hover:shadow-lg transition-all group">
                                            {comm.imageUrl && (
                                                <div className="relative w-full h-48 cursor-pointer overflow-hidden" onClick={() => handleImageClick(comm.imageUrl!)}>
                                                    <Image src={comm.imageUrl} alt={comm.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="400px" />
                                                </div>
                                            )}
                                            <div className="p-5 flex flex-col flex-1">
                                                <div className="flex items-center justify-between gap-2 mb-3">
                                                    {comm.type === 'promocao' ?
                                                        <Badge className="bg-green-600 rounded-full"><Gift className="mr-1 h-3 w-3" />Promoção</Badge> :
                                                        <Badge variant="secondary" className="rounded-full"><Megaphone className="mr-1 h-3 w-3" />Comunicado</Badge>
                                                    }
                                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{formatFullDateTime(comm.sentAt)}</span>
                                                </div>
                                                <h4 className="font-extrabold text-lg mb-2 leading-tight">{comm.title}</h4>
                                                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{comm.message}</p>
                                                <Button variant="ghost" className="w-full justify-start p-0 h-auto font-semibold text-primary group-hover:translate-x-1 transition-transform" onClick={() => router.push(`/cliente/dashboard`)}>
                                                    Ler mais <PlusCircle className="ml-2 h-4 w-4" />
                                                </Button>
                                            </div>
                                        </Card>
                                    )) : (
                                        <div className="col-span-full text-center h-48 flex items-center justify-center">
                                            <p className="text-muted-foreground">Nenhum comunicado recente.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <section className="bg-background rounded-xl p-8 border-2 border-dashed border-muted flex flex-col md:flex-row items-center gap-8 shadow-inner">
                    <div className="bg-primary/5 p-6 rounded-full">
                        <HelpCircle className="h-16 w-16 text-primary/40" />
                    </div>
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <h3 className="text-2xl font-semibold">Precisa de Ajuda Técnica?</h3>
                        <p className="text-muted-foreground text-lg">Nosso suporte está disponível 24h para emergências em sua unidade.</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                            {company?.whatsapp && (
                                <Button asChild variant="default" className="bg-[#25D366] hover:bg-[#128C7E] border-none text-white font-semibold h-9 px-6 rounded-lg shadow-lg text-xs">
                                    <a href={`https://wa.me/${company.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                        <Phone className="mr-2 h-5 w-5" /> WhatsApp Suporte
                                    </a>
                                </Button>
                            )}
                            {company?.phone && (
                                <Button variant="outline" className="font-semibold h-9 px-6 rounded-lg border-2 text-xs">
                                    <a href={`tel:${company.phone.replace(/\D/g, '')}`}>
                                        <Phone className="mr-2 h-5 w-5" /> Central: {company.phone}
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </section>
            </main>
            <VisitDetailDialogClient
                isOpen={isVisitDetailOpen}
                setOpen={setVisitDetailOpen}
                visit={selectedVisit}
                onRescheduleRequest={handleRescheduleRequest}
            />
            <Dialog open={isImageZoomOpen} onOpenChange={setImageZoomOpen}>
                <DialogContent className="max-w-4xl h-auto flex flex-col p-2">
                    {zoomedImageUrl && (
                        <div className="relative w-full h-full min-h-[80vh]">
                            <Image src={zoomedImageUrl} alt="Visualização da Imagem" layout="fill" objectFit="contain" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function ClientDashboardPage() {
    return (
        <ProtectedRoute requireAuth requireRole="cliente">
            <ClientDashboard />
        </ProtectedRoute>
    )
}
