"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/firebase/auth/use-user";
import { getLeads, updateLead, deleteLead } from "@/lib/firebase/firestore";
import type { Lead } from "@/lib/data";
import { 
  Sparkles, 
  Search, 
  Filter, 
  MoreHorizontal, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Trash2,
  Calendar,
  Phone,
  Mail,
  User,
  ArrowLeft,
  Loader2,
  ChevronRight,
  XCircle,
  X,
  TrendingUp,
  Target,
  Trophy,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function LeadsPage() {
  const { userProfile, firebase, company } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newNote, setNewNote] = useState("");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const knownLeadsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const isAuthorized = useMemo(() => {
    if (!userProfile || !company) return false;
    const isEspTec = company.name?.toLowerCase().includes('esp') || company.name?.toLowerCase().includes('tec');
    const isAuthorizedRole = ['admin', 'supervisor'].includes(userProfile.role);
    return !!isEspTec && isAuthorizedRole;
  }, [userProfile, company]);

  // --- Métricas de conversão ---
  const metrics = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter(l => l.status === 'Novo Lead').length;
    const emContato = leads.filter(l => l.status === 'Em Contato').length;
    const finalizados = leads.filter(l => l.status === 'Finalizado').length;
    const conversoes = leads.filter(l => l.status === 'Conversão').length;

    const taxaConversao = total > 0 ? Math.round((conversoes / total) * 100) : 0;
    const taxaPerda = total > 0 ? Math.round((finalizados / total) * 100) : 0;
    const taxaContato = total > 0 ? Math.round(((emContato + conversoes + finalizados) / total) * 100) : 0;
    const leadsPendentes = novos + emContato;

    return { total, novos, emContato, finalizados, conversoes, taxaConversao, taxaPerda, taxaContato, leadsPendentes };
  }, [leads]);

  useEffect(() => {
    if (!userProfile?.companyId || !firebase.db) return;
    setIsLoading(true);

    const unsubscribe = getLeads(
      firebase.db,
      userProfile.companyId,
      (data) => {
        const normalizedData = (data || []).map((d: any) => {
          let createdAt = d.createdAt;
          if (d.timestamp?.seconds) {
            createdAt = new Date(d.timestamp.seconds * 1000).toISOString();
          } else if (d.timestamp && typeof d.timestamp === 'string') {
            createdAt = d.timestamp;
          }

          const existingHistory = d.history || [];
          const oldTratativa = d.tratativa || d.observacoes || "";
          
          let finalizedHistory = existingHistory;
          if (oldTratativa && existingHistory.length === 0) {
            finalizedHistory = [{ text: oldTratativa, createdAt: createdAt || new Date().toISOString() }];
          }

          return {
            ...d,
            name: d.name || d.nome || "Sem Nome",
            phone: d.phone || d.telefone || "Sem Telefone",
            email: d.email || d.e_mail || "",
            source: d.source || d.origem || "Site Oficial",
            status: d.status === 'novo' ? 'Novo Lead' : (d.status === 'contato' ? 'Em Contato' : (d.status || 'Novo Lead')),
            marca_camera: d.marca_camera || d.marca || d.propertyDetails?.marca_camera || d.propertyDetails?.marca || d.propertyDetails?.preferencia || d.preferencia || "",
            createdAt: createdAt || new Date().toISOString(),
            history: finalizedHistory
          };
        });

        setLeads(normalizedData);
        setIsLoading(false);

        if (!initialLoadRef.current) {
          const newLeads = normalizedData.filter(
            (l) => !knownLeadsRef.current.has(l.id) && (l.status === 'Novo Lead' || l.status === 'novo')
          );
          if (newLeads.length > 0) {
            toast({
              title: "🚀 Novo Leads do site",
              description: `Você tem ${newLeads.length} nova(s) oportunidade(s)!`,
              className: "bg-blue-600 text-white border-blue-500",
            });
            try {
              const audio = new Audio('/notification.mp3');
              audio.play().catch(() => {});
            } catch (e) {}
          }
        } else {
          initialLoadRef.current = false;
        }

        normalizedData.forEach(l => knownLeadsRef.current.add(l.id));
      },
      (error) => {
        console.error("Error fetching leads:", error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar leads",
          description: "Não foi possível carregar as oportunidades do site."
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.companyId, firebase.db, toast]);

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    if (!firebase.db) return;
    try {
      const updateData: any = { status: newStatus };
      
      if (selectedLead && selectedLead.id === leadId && newNote.trim()) {
        const newEntry = { text: newNote.trim(), createdAt: new Date().toISOString() };
        updateData.history = [...(selectedLead.history || []), newEntry];
        setNewNote("");
      }
      
      await updateLead(firebase.db, leadId, updateData);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updateData } : l));
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, ...updateData } : null);
      }
      toast({
        title: "Status atualizado",
        description: `Lead marcado como ${newStatus}.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: "Não foi possível alterar o status do lead."
      });
    }
  };

  const handleSaveNewNote = async (leadId: string, text: string) => {
    if (!firebase.db || isSaving || !text.trim()) return;
    setIsSaving(true);
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const newEntry = { text: text.trim(), createdAt: new Date().toISOString() };
      const updatedHistory = [...(lead.history || []), newEntry];
      
      await updateLead(firebase.db, leadId, { history: updatedHistory });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, history: updatedHistory } : l));
      setNewNote("");
      toast({ title: "Histórico atualizado", description: "Nova interação registrada." });
    } catch (error) {
      console.error("Erro ao salvar nota:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead);
    setNewNote("");
    setIsDetailsOpen(true);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!firebase.db) return;
    try {
      await deleteLead(firebase.db, leadId);
      setLeads(prev => prev.filter(l => l.id !== leadId));
      toast({
        title: "Lead excluído",
        description: "O registro foi removido com sucesso."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: "Não foi possível remover o lead."
      });
    }
  };

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (activeTab !== "all") {
      result = result.filter(l => l.status === activeTab);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(l => 
        l.name.toLowerCase().includes(lowerSearch) || 
        l.email?.toLowerCase().includes(lowerSearch) || 
        l.phone.includes(searchTerm)
      );
    }

    return result.sort((a, b) => {
        const dateA = a.createdAt ? parseISO(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? parseISO(b.createdAt).getTime() : 0;
        return dateB - dateA;
    });
  }, [leads, activeTab, searchTerm]);

  const getStatusBadge = (status: Lead['status']) => {
    switch (status) {
      case 'Novo Lead':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">Novo Lead</Badge>;
      case 'Em Contato':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20">Em Contato</Badge>;
      case 'Finalizado':
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20 font-bold">✗ Não Fechou</Badge>;
      case 'Conversão':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 font-bold">✓ Fechou Negócio</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'N/A';
      return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return 'N/A';
    }
  };

  if (!isLoading && !isAuthorized) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 p-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-destructive/20 blur-[50px] rounded-full" />
          <XCircle className="h-24 w-24 text-destructive relative z-10 opacity-80" />
        </div>
        <div className="space-y-2 relative z-10">
          <h2 className="text-3xl font-bold tracking-tighter uppercase tracking-[0.2em]">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-[400px]">
            Esta área de gestão de leads é exclusiva para administradores da ESP-TEC.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" className="rounded-2xl px-8 h-12 font-bold uppercase tracking-widest border-border/40 hover:bg-primary/5 transition-all">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-[1750px] mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">Marketing & Vendas</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            Leads do Site
          </h1>
          <p className="text-muted-foreground">
            Gerencie as oportunidades capturadas pelo calculador de orçamento do seu site.
          </p>
        </div>

        <div className="flex items-center gap-3">
           <div className="text-right hidden md:block">
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total de Leads</p>
              <p className="text-2xl font-bold">{leads.length}</p>
           </div>
        </div>
      </div>

      {/* --- Métricas de Conversão --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Taxa de Conversão */}
        <div className="glass-premium p-5 rounded-[2rem] border border-emerald-500/20 space-y-3 relative overflow-hidden group col-span-2 lg:col-span-1">
          <div className="absolute -top-8 -right-8 h-28 w-28 bg-emerald-500/10 blur-[50px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700" />
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">Conversão</span>
          </div>
          <div>
            <p className="text-4xl font-bold text-emerald-500">{metrics.taxaConversao}%</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60 mt-1">
              {metrics.conversoes} de {metrics.total} leads fecharam negócio
            </p>
          </div>
          <div className="h-1.5 w-full bg-emerald-500/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
              style={{ width: `${metrics.taxaConversao}%` }}
            />
          </div>
        </div>

        {/* Taxa de Perda (Não Fechou) */}
        <div className="glass-premium p-5 rounded-[2rem] border border-slate-500/20 space-y-3 relative overflow-hidden group col-span-2 lg:col-span-1">
          <div className="absolute -top-8 -right-8 h-28 w-28 bg-slate-500/10 blur-[50px] rounded-full group-hover:bg-slate-500/20 transition-all duration-700" />
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400">
              <Target className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500/60">Não Fecharam</span>
          </div>
          <div>
            <p className="text-4xl font-bold text-slate-400">{metrics.taxaPerda}%</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60 mt-1">
              {metrics.finalizados} leads finalizaram sem fechar
            </p>
          </div>
          <div className="h-1.5 w-full bg-slate-500/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-slate-400 rounded-full transition-all duration-1000" 
              style={{ width: `${metrics.taxaPerda}%` }}
            />
          </div>
        </div>

        {/* Em negociação */}
        <div className={cn(
          "glass-premium p-5 rounded-[2rem] border border-border/40 space-y-3 relative overflow-hidden group",
          leads.some(l => l.status === 'Novo Lead') && "border-amber-500/40 animate-pulse [animation-duration:3s]"
        )}>
          <div className="absolute -top-8 -right-8 h-28 w-28 bg-amber-500/10 blur-[50px] rounded-full group-hover:bg-amber-500/20 transition-all duration-700" />
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60">Pendentes</span>
          </div>
          <div>
            <p className="text-4xl font-bold">{metrics.novos + metrics.emContato}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60 mt-1">
              {metrics.novos} novos · {metrics.emContato} em contato
            </p>
          </div>
          {leads.some(l => l.status === 'Novo Lead') && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">Atenção necessária</span>
            </div>
          )}
        </div>

        {/* Funil resumido */}
        <div className="glass-premium p-5 rounded-[2rem] border border-border/40 space-y-3 relative overflow-hidden group">
          <div className="absolute -top-8 -right-8 h-28 w-28 bg-primary/5 blur-[50px] rounded-full group-hover:bg-primary/10 transition-all duration-700" />
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Funil</span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Novos', count: metrics.novos, color: 'bg-blue-500', pct: metrics.total > 0 ? (metrics.novos / metrics.total) * 100 : 0 },
              { label: 'Contato', count: metrics.emContato, color: 'bg-amber-500', pct: metrics.total > 0 ? (metrics.emContato / metrics.total) * 100 : 0 },
              { label: 'Fechou', count: metrics.conversoes, color: 'bg-emerald-500', pct: metrics.total > 0 ? (metrics.conversoes / metrics.total) * 100 : 0 },
              { label: 'Perdeu', count: metrics.finalizados, color: 'bg-slate-400', pct: metrics.total > 0 ? (metrics.finalizados / metrics.total) * 100 : 0 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-14 shrink-0">{item.label}</span>
                <div className="flex-1 h-1.5 bg-primary/5 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-1000", item.color)} style={{ width: `${item.pct}%` }} />
                </div>
                <span className="text-[9px] font-bold w-5 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de Leads */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-premium noise-overlay rounded-[2rem] border border-border/40 p-6">
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <TabsList className="bg-primary/5 p-1 h-12 rounded-2xl border border-primary/10 w-fit flex-wrap">
                <TabsTrigger value="all" className="rounded-xl px-4 font-semibold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">Todos</TabsTrigger>
                <TabsTrigger value="Novo Lead" className="rounded-xl px-4 font-semibold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-background data-[state=active]:text-blue-500 data-[state=active]:shadow-sm">Novos</TabsTrigger>
                <TabsTrigger value="Em Contato" className="rounded-xl px-4 font-semibold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-background data-[state=active]:text-amber-500 data-[state=active]:shadow-sm">Em Contato</TabsTrigger>
                <TabsTrigger value="Conversão" className="rounded-xl px-4 font-semibold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-background data-[state=active]:text-emerald-500 data-[state=active]:shadow-sm">
                  ✓ Fechou Negócio {metrics.conversoes > 0 && <span className="ml-1.5 bg-emerald-500 text-white rounded-full px-1.5 text-[8px]">{metrics.conversoes}</span>}
                </TabsTrigger>
                <TabsTrigger value="Finalizado" className="rounded-xl px-4 font-semibold uppercase text-[10px] tracking-widest h-10 data-[state=active]:bg-background data-[state=active]:text-slate-500 data-[state=active]:shadow-sm">
                  ✗ Não Fecharam {metrics.finalizados > 0 && <span className="ml-1.5 bg-slate-500 text-white rounded-full px-1.5 text-[8px]">{metrics.finalizados}</span>}
                </TabsTrigger>
              </TabsList>

              <div className="relative w-full lg:w-96 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40 group-focus-within:opacity-100 transition-opacity" />
                <Input 
                  placeholder="Buscar por nome, e-mail ou telefone..." 
                  className="pl-11 h-12 rounded-2xl bg-background/50 border-border/40 focus:ring-primary shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-0">
               {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="font-semibold uppercase text-[10px] tracking-[0.2em]">Sincronizando oportunidades...</p>
                  </div>
               ) : filteredLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20 text-center">
                    <Sparkles className="h-16 w-16" />
                    <div className="space-y-1">
                      <p className="text-xl font-bold">Nenhum lead encontrado</p>
                      <p className="text-xs uppercase font-semibold tracking-widest">Aguardando novas capturas do seu site</p>
                    </div>
                  </div>
               ) : (
                <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/20 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-primary/5">
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-primary/70">Lead / Contato</TableHead>
                        <TableHead className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-primary/70">Status</TableHead>
                        <TableHead className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-primary/70">Data de Entrada</TableHead>
                        <TableHead className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-primary/70">Origem</TableHead>
                        <TableHead className="py-4 px-6 text-right text-[10px] font-bold uppercase tracking-widest text-primary/70">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map((lead) => (
                        <TableRow 
                          key={lead.id} 
                          className={cn(
                            "hover:bg-primary/5 transition-colors border-border/40 group cursor-pointer",
                            lead.status === 'Novo Lead' && "animate-pulse [animation-duration:3s] bg-blue-500/10 border-blue-500/50",
                            lead.status === 'Conversão' && "bg-emerald-500/5 border-emerald-500/20"
                          )}
                          onClick={() => handleRowClick(lead)}
                        >
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center font-bold shadow-inner",
                                lead.status === 'Conversão' ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/10 text-primary"
                              )}>
                                {lead.status === 'Conversão' ? '✓' : (lead.name && lead.name !== 'Sem Nome' ? lead.name.charAt(0).toUpperCase() : '?')}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold tracking-tight text-foreground/80">{lead.name}</span>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {lead.phone}
                                  </span>
                                  {lead.email && lead.email !== "" && (
                                    <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                      <Mail className="h-3 w-3" /> {lead.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            {getStatusBadge(lead.status)}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-2 text-muted-foreground font-medium text-[11px]">
                              <Calendar className="h-3.5 w-3.5 opacity-50" />
                              {formatDate(lead.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge variant="outline" className="text-[9px] uppercase tracking-widest opacity-60 font-semibold border-border/40">
                              {lead.source || 'Site Institucional'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-right">
                             <div className="flex items-center justify-end gap-2 pr-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg opacity-40 hover:opacity-100 transition-opacity bg-primary/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(lead);
                                  }}
                                  title="Ver Detalhes"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg opacity-40 hover:opacity-100 hover:text-destructive transition-all bg-destructive/5 hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Deseja realmente excluir este lead?')) {
                                      handleDeleteLead(lead.id);
                                    }
                                  }}
                                  title="Excluir Contato"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                             </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
               )}
            </div>
          </Tabs>
        </div>
      </div>

      {/* Detalhes do Lead */}
      <Dialog 
        open={isDetailsOpen} 
        onOpenChange={(open) => {
          if (!open && selectedLead && newNote.trim()) {
            handleSaveNewNote(selectedLead.id, newNote);
          }
          setIsDetailsOpen(open);
          if (!open) setSelectedLead(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] p-0 border-border/40 noise-overlay glass-premium [&>button.absolute]:hidden">
          {selectedLead && (
            <>
              <DialogHeader className="p-8 pb-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                   <Sparkles className="h-24 w-24" />
                </div>
                
                <div className="absolute top-6 right-6 z-[100]">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all shadow-md backdrop-blur-md"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDetailsOpen(false);
                    }}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                  <div className={cn(
                    "h-16 w-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-bold shadow-inner",
                    selectedLead.status === 'Conversão' ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/10 text-primary"
                  )}>
                    {selectedLead.status === 'Conversão' ? '✓' : (selectedLead.name ? selectedLead.name.charAt(0).toUpperCase() : '?')}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold tracking-tight">{selectedLead.name}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedLead.status)}
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(selectedLead.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-8 pb-8 space-y-6 text-foreground overflow-y-auto max-h-[80vh] no-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Telefone</p>
                    <p className="font-bold flex items-center gap-2">
                       <Phone className="h-3.5 w-3.5 text-primary" /> {selectedLead.phone}
                    </p>
                  </div>
                  <div className="space-y-1.5 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">E-mail</p>
                    <p className="font-bold truncate flex items-center gap-2">
                       <Mail className="h-3.5 w-3.5 text-primary" /> {selectedLead.email || 'Não informado'}
                    </p>
                  </div>
                </div>

                {(selectedLead.propertyType || selectedLead.propertyDetails || (selectedLead as any).estrutura || (selectedLead as any).perfil) && (
                  <div className="space-y-3 p-6 rounded-2xl bg-background/40 border border-border/40">
                     <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary/60 flex items-center gap-2 text-foreground">
                        <Filter className="h-3.5 w-3.5" /> Detalhes da Solicitação
                     </h4>
                     <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                        <div className="space-y-0.5">
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estrutura / Tipo</p>
                           <p className="font-bold uppercase text-xs">{(selectedLead as any).estrutura || selectedLead.propertyDetails?.estrutura || selectedLead.propertyType || 'N/A'}</p>
                        </div>
                        {((selectedLead as any).perfil || selectedLead.propertyDetails?.perfil) && (
                          <div className="space-y-0.5">
                             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Perfil</p>
                             <p className="font-bold uppercase text-xs">{(selectedLead as any).perfil || selectedLead.propertyDetails?.perfil}</p>
                          </div>
                        )}
                        {((selectedLead as any).regiao || selectedLead.propertyDetails?.regiao) && (
                           <div className="space-y-0.5">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Região</p>
                              <p className="font-bold uppercase text-xs">{(selectedLead as any).regiao || selectedLead.propertyDetails?.regiao}</p>
                           </div>
                        )}
                        {selectedLead.source && (
                           <div className="space-y-0.5">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Origem</p>
                              <p className="font-bold uppercase text-xs">{selectedLead.source}</p>
                           </div>
                        )}
                     </div>
                  </div>
                )}

                <div className="space-y-3 p-6 rounded-2xl bg-primary/5 border border-primary/10 shadow-inner">
                   <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary/60 flex items-center gap-2">
                         <MessageSquare className="h-3.5 w-3.5" /> Nova Interação
                      </h4>
                      {isSaving && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                   </div>
                   <Textarea 
                      placeholder="Adicione um novo comentário sobre o contato..."
                      className="min-h-[80px] rounded-xl bg-background/50 border-border/40 focus:ring-primary text-sm p-4 resize-none shadow-sm"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                   />
                   <p className="text-[9px] text-muted-foreground italic flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> A nota será salva automaticamente ao fechar ou mudar o status.
                   </p>
                </div>

                {/* Timeline */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary/60 flex items-center gap-2">
                       <MessageSquare className="h-3.5 w-3.5" /> Histórico de Tratativas
                    </h4>
                  </div>
                  
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 no-scrollbar border-l border-primary/5 ml-1">
                    {selectedLead.history && selectedLead.history.length > 0 ? (
                      [...selectedLead.history].reverse().map((entry, idx) => (
                        <div key={idx} className="relative pl-6 pb-4 border-l border-primary/10 ml-2 first:mt-2">
                          <div className="absolute left-[-4.5px] top-1 h-2 w-2 rounded-full bg-primary/40" />
                          <div className="p-3 rounded-xl bg-primary/5 border border-primary/5 space-y-1 hover:bg-primary/10 transition-colors">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-primary/40 uppercase tracking-tighter">
                                {formatDate(entry.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-foreground font-bold leading-relaxed">{entry.text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 rounded-2xl border border-dashed border-border/40 text-center opacity-40">
                        <Clock className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-[10px] uppercase font-bold tracking-widest">Nenhuma interação registrada ainda</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="space-y-3 pt-2">
                   <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60">Ações Rápidas</p>
                   <div className="flex flex-wrap gap-3">
                      <Button 
                        className="flex-1 rounded-xl h-12 font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                        onClick={() => {
                          const phone = selectedLead.phone.replace(/\D/g, '');
                          window.open(`https://wa.me/55${phone}`, '_blank');
                        }}
                      >
                         <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold uppercase tracking-widest border-border/40">
                             <CheckCircle2 className="mr-2 h-4 w-4" /> Mudar Status
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-2xl p-2 border-border/40 glass-premium shadow-premium">
                           <DropdownMenuItem onClick={() => handleStatusChange(selectedLead.id, 'Novo Lead')} className="h-11 rounded-xl font-semibold cursor-pointer">
                              <div className="h-2 w-2 rounded-full bg-blue-500 mr-3" /> Novo Lead
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleStatusChange(selectedLead.id, 'Em Contato')} className="h-11 rounded-xl font-semibold cursor-pointer">
                              <div className="h-2 w-2 rounded-full bg-amber-500 mr-3" /> Em Contato
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleStatusChange(selectedLead.id, 'Conversão')} className="h-11 rounded-xl font-semibold cursor-pointer text-emerald-500 focus:text-emerald-500 focus:bg-emerald-500/10">
                              <Trophy className="h-3.5 w-3.5 mr-3 text-emerald-500" /> Conversão ✓ (Fechou negócio!)
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleStatusChange(selectedLead.id, 'Finalizado')} className="h-11 rounded-xl font-semibold cursor-pointer text-slate-500 focus:text-slate-500 focus:bg-slate-500/10">
                              <div className="h-2 w-2 rounded-full bg-slate-400 mr-3" /> Finalizado ✗ (Não fechou)
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-12 w-12 rounded-xl text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir esta oportunidade?')) {
                            handleDeleteLead(selectedLead.id);
                            setIsDetailsOpen(false);
                          }
                        }}
                      >
                         <Trash2 className="h-5 w-5" />
                      </Button>
                   </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
