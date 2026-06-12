

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Search, Download, Calendar as CalendarIcon, Bug, MoreHorizontal, Send, FileDown as FileDownIcon, RefreshCw, XCircle, DollarSign, User, Eye, AlertTriangle } from "lucide-react";
import { useAuth } from "@/firebase/auth/use-user";
import { useToast } from "@/hooks/use-toast";
import { getQuotes, getClients, updateQuote } from "@/lib/firebase/firestore";
import type { Quote, Client, Company as AppCompany } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { handleFocusNFeAction, issueNfse } from "@/app/fiscal/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import NfsePreview from "@/components/fiscal/nfse-preview";


const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString: string) => format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
const formatDateTime = (dateString: string) => format(parseISO(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });

const nfseStatusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' | 'warning' }> = {
  autorizado: { label: 'Autorizada', variant: 'success' },
  processando_autorizacao: { label: 'Processando', variant: 'warning' },
  erro_autorizacao: { label: 'Erro', variant: 'destructive' },
  cancelado: { label: 'Cancelada', variant: 'secondary' },
};

type FiscalPageClientProps = {
    initialInvoices: any[];
    initialError: string | null;
}

export default function FiscalPageClient({ initialInvoices, initialError }: FiscalPageClientProps) {
  const { company, userProfile, firebase } = useAuth();
  const { toast } = useToast();
  
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isLoadingNfse, setIsLoadingNfse] = useState(false);
  
  const [issuedInvoices, setIssuedInvoices] = useState<any[]>(initialInvoices);
  const [searchTermIssued, setSearchTermIssued] = useState('');
  
  const [errorDetails, setErrorDetails] = useState<{ title: string, message: string, payload?: object } | null>(null);
  const [isErrorDialogOpen, setErrorDialogOpen] = useState(false);
  
  // States for NFS-e Service
  const [selectedOsId, setSelectedOsId] = useState<string | null>(null);
  const [serviceCode, setServiceCode] = useState(company?.item_lista_servico || "");
  const [codTributarioMunicipio, setCodTributarioMunicipio] = useState(company?.codigo_tributario_municipio || "");


  // States for NFS-e Comodato
  const [comodatoClientId, setComodatoClientId] = useState<string | null>(null);
  const [comodatoValue, setComodatoValue] = useState<number>(0);
  const [comodatoDescription, setComodatoDescription] = useState("Mensalidade referente ao serviço de monitoramento e comodato de equipamentos.");

  const serviceOrdersFinalizados = useMemo(() => allQuotes.filter(q => q.status === 'Finalizado'), [allQuotes]);
  const selectedOs = useMemo(() => serviceOrdersFinalizados.find(os => os.id === selectedOsId), [selectedOsId, serviceOrdersFinalizados]);
  const selectedOsClient = useMemo(() => clients.find(c => c.id === selectedOs?.clientId), [selectedOs, clients]);
  
  const comodatoClients = useMemo(() => clients.filter(c => c.isComodato), [clients]);
  const selectedComodatoClient = useMemo(() => clients.find(c => c.id === comodatoClientId), [comodatoClientId, clients]);

  useEffect(() => {
    if (selectedComodatoClient) {
      setComodatoValue(selectedComodatoClient.serviceValue || 0);
      setComodatoDescription(selectedComodatoClient.serviceDescription || "Mensalidade referente ao serviço de monitoramento e comodato de equipamentos.");
    }
  }, [selectedComodatoClient]);

  useEffect(() => {
    if(initialError) {
        toast({ variant: 'destructive', title: 'Erro ao Carregar Notas', description: initialError, duration: 8000 });
    }
  }, [initialError, toast]);

  useEffect(() => {
    if (!userProfile?.companyId || !firebase.db) {
      setIsLoading(false);
      return;
    }
    const unsubQuotes = getQuotes(firebase.db, userProfile.companyId, userProfile, setAllQuotes, (error) => {
      toast({ variant: 'destructive', title: 'Erro ao buscar documentos.', description: error.message });
    });

    const unsubClients = getClients(firebase.db, userProfile.companyId, setClients, (error) => {});

    Promise.all([
        new Promise(res => setTimeout(res, 1000))
    ]).then(() => setIsLoading(false));


    return () => {
        unsubQuotes();
        unsubClients();
    }
  }, [userProfile, toast, firebase.db]);

  const fetchIssuedInvoices = async () => {
    if (!company || !company.cnpj) {
      toast({ variant: 'destructive', title: 'Configuração Incompleta', description: 'Dados da empresa (CNPJ) não carregados.' });
      return;
    }
  
    const ambiente = company.focusNfeEnvironment || 'homologacao';
    const token = ambiente === 'producao' 
      ? company.focusNfeProductionToken 
      : company.focusNfeHomologationToken;
  
    if (!token) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Token da Focus NFe não configurado.' });
      return;
    }
  
    setIsLoadingNfse(true);
  
    try {
      const res = await fetch(
        `/api/focus/nfse?token=${encodeURIComponent(token)}&cnpj=${company.cnpj.replace(/\D/g, '')}&ambiente=${ambiente}`
      );
  
      const data = await res.json();
      
      if (res.ok) {
        setIssuedInvoices(data.nfse || data || []);
        toast({ title: 'Notas atualizadas com sucesso!' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: data.error || 'Falha ao buscar notas.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro de conexão ao tentar buscar as notas.' });
    } finally {
      setIsLoadingNfse(false);
    }
  };
  
  const handleEmitirNfseServico = async () => {
    if (!selectedOs || !selectedOsClient || !company || !firebase.db || !firebase.auth) return;
    setIsIssuing(true);
    
    const result = await issueNfse(selectedOs, selectedOsClient, company, serviceCode, codTributarioMunicipio);

    if (result.success && (result as any).data) {
      toast({ title: 'Sucesso!', description: `NFS-e da O.S. ${(selectedOs as any).quoteNumber?.replace('ORC', 'O.S') || 'O.S.'} enviada para a fila.` });
      if ((result as any).data.id) {
          await updateQuote(firebase.db, firebase.auth, selectedOs.id, { nfseId: (result as any).data.id });
          setTimeout(fetchIssuedInvoices, 3000);
      }
    } else {
        setErrorDetails({
            title: "Falha na Emissão da NFS-e",
            message: result.error || 'Ocorreu um erro desconhecido.',
            payload: result.debugPayload
        });
        setErrorDialogOpen(true);
    }
    setIsIssuing(false);
  };

  const handleEmitirNfseComodato = async () => {
    if (!selectedComodatoClient || comodatoValue <= 0 || !company) return;
    setIsIssuing(true);

    const comodatoOsFicticio: any = {
      id: `comodato-${selectedComodatoClient.id}-${Date.now()}`,
      quoteNumber: "COMODATO",
      clientId: selectedComodatoClient.id,
      clientName: selectedComodatoClient.name,
      companyId: company.id,
      companyName: company.name,
      date: new Date().toISOString(),
      items: [{
        id: '1',
        product: { description: comodatoDescription } as any,
        quantity: 1,
        total: comodatoValue,
        materialPrice: comodatoValue,
        servicePrice: 0,
      }],
      total: comodatoValue,
      discount: 0,
      status: 'Finalizado',
    };
    
    const result = await issueNfse(comodatoOsFicticio, selectedComodatoClient, company, '11.02');
    if (result.success && 'data' in result) {
      toast({ title: 'Sucesso!', description: `NFS-e de Comodato para ${selectedComodatoClient.name} enviada para a fila.` });
      if (result.data?.id) {
          setTimeout(fetchIssuedInvoices, 3000);
      }
    } else {
        setErrorDetails({
          title: "Falha na Emissão (Comodato)",
          message: result.error || 'Ocorreu um erro desconhecido.',
          payload: (result as any).debugPayload
      });
      setErrorDialogOpen(true);
    }
    setIsIssuing(false);
  };
  
  const handleNfseActionWrapper = async (action: 'cancel' | 'pdf' | 'xml' | 'email', nfse: any) => {
     if (!company?.cnpj) {
      toast({ variant: 'destructive', title: 'Configuração Incompleta' });
      return;
    }
    
    const environment = company.focusNfeEnvironment || 'homologacao';
    const apiKey = environment === 'producao' ? company.focusNfeProductionToken : company.focusNfeHomologationToken;
    const baseUrl = environment === 'producao' ? company.focusNfeProductionUrl || 'https://api.focusnfe.com.br' : company.focusNfeHomologationUrl || 'https://homologacao.focusnfe.com.br';

    if (!apiKey) {
      toast({ variant: 'destructive', title: 'Configuração Incompleta', description: `Token da Focus NFe para ambiente de ${environment} não configurado.` });
      return;
    }

    toast({ title: `Executando: ${action}...` });
    const result = await handleFocusNFeAction(action, nfse.ref, apiKey, baseUrl);

    if (result.success) {
        if((action === 'pdf' || action === 'xml') && result.data?.url) {
            window.open(result.data.url, '_blank');
        } else {
          toast({ title: "Sucesso!", description: `Ação '${action}' executada.`});
        }
        fetchIssuedInvoices();
    } else {
      toast({ variant: 'destructive', title: `Falha na Ação '${action}'`, description: result.error });
    }
  };
  
  const filteredIssuedInvoices = useMemo(() => {
    if (!Array.isArray(issuedInvoices)) return [];
    return issuedInvoices.filter(nfse => 
      searchTermIssued 
        ? (nfse.numero && nfse.numero.toString().includes(searchTermIssued)) || 
          (nfse.tomador?.razao_social && nfse.tomador.razao_social.toLowerCase().includes(searchTermIssued.toLowerCase())) || 
          (nfse.status && nfse.status.toLowerCase().includes(searchTermIssued.toLowerCase())) 
        : true
    )
  }, [issuedInvoices, searchTermIssued]);


  const serviceDescriptionForPreview = useMemo(() => {
    if (!selectedOs) return "";
    const serviceItemsDescription = selectedOs.items.map(item => `${item.quantity}x ${item.product?.description || (item as any).description || (item as any).productDescription || "Serviço"}`).join('; ');
    let fullDescription = `Serviços de instalação e manutenção conforme O.S. ${selectedOs.quoteNumber.replace('ORC', 'O.S')}: ${serviceItemsDescription}`;
    if (selectedOs.notes) {
      fullDescription += `\n\nRELATÓRIO DE EXECUÇÃO:\n${selectedOs.notes}`;
    }
    return fullDescription;
  }, [selectedOs]);

  return (
    <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
      <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-4">
        <div className="space-y-1">
          <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
            <FileText className="text-primary h-8 w-8" />
            Gestão Fiscal
          </h1>

        </div>

        <Tabs defaultValue="service" className="w-full">
          <TabsList className="h-12 p-1.5 bg-background/40 backdrop-blur-3xl rounded-[1.2rem] border border-border/40 shadow-premium self-start gap-1">
            <TabsTrigger value="service" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">NFS-e (Serviço)</TabsTrigger>
            <TabsTrigger value="comodato" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">NFS-e (Comodato)</TabsTrigger>
            <TabsTrigger value="issued" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Notas Emitidas</TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="service" className="m-0 focus-visible:outline-none">
              <div className="bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium border border-border/40 p-8 md:p-10 space-y-10">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight opacity-80">Emissão de Serviço</h2>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">Selecione uma O.S. finalizada para gerar a NFS-e</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Ordem de Serviço (Finalizada)</Label>
                      <Select onValueChange={setSelectedOsId} value={selectedOsId || ""}>
                        <SelectTrigger className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold focus:ring-primary shadow-sm px-6">
                          <SelectValue placeholder="Pesquisar O.S. para faturamento..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-border/40 bg-background/90 backdrop-blur-3xl shadow-premium">
                          {serviceOrdersFinalizados.map(os => (
                            <SelectItem key={os.id} value={os.id} className="h-12 rounded-xl font-semibold transition-all focus:bg-primary focus:text-white cursor-pointer ml-1 mr-1">
                              <div className="flex flex-col">
                                <span className="uppercase text-[11px] tracking-tight">{os.quoteNumber.replace('ORC','O.S')} - {os.clientName}</span>
                                <span className="text-[9px] font-semibold opacity-40 font-mono tracking-widest">{formatCurrency(os.total)}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Cód. Serviço (LC116)</Label>
                        <Input value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-center focus:ring-primary shadow-sm" placeholder="14.06"/>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Trib. Município</Label>
                        <Input value={codTributarioMunicipio} onChange={(e) => setCodTributarioMunicipio(e.target.value)} className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-center focus:ring-primary shadow-sm" placeholder="Opcional"/>
                      </div>
                    </div>

                    <Button 
                      onClick={handleEmitirNfseServico} 
                      disabled={!selectedOsId || isIssuing}
                      className="h-16 w-full rounded-[1.5rem] bg-primary text-white font-semibold uppercase tracking-[0.2em] shadow-premium transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                        {isIssuing ? <Loader2 className="mr-3 h-5 w-5 animate-spin"/> : <Send className="mr-3 h-5 w-5" />}
                        Emitir NFS-e de Serviço
                    </Button>
                  </div>

                  <div className="bg-primary/5 rounded-xl p-8 border border-border/40">
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 mb-6 ml-2">Pré-visualização do Documento</h3>
                    {selectedOs && selectedOsClient && company ? (
                        <NfsePreview
                            company={company}
                            client={selectedOsClient}
                            serviceDescription={serviceDescriptionForPreview}
                            serviceValue={selectedOs.total}
                            cnaeCode={company?.codigo_cnae}
                            serviceListCode={serviceCode}
                            codTributarioMunicipio={codTributarioMunicipio}
                        />
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center gap-3 opacity-20 border-2 border-dashed border-primary/20 rounded-xl">
                        <Search className="h-10 w-10" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-center px-10">Aguardando seleção de O.S. para gerar preview</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comodato" className="m-0 focus-visible:outline-none">
              <div className="bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium border border-border/40 p-8 md:p-10 space-y-10">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight opacity-80">Faturamento Comodato</h2>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">Processamento de mensalidades recorrentes</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Titular do Contrato</Label>
                      <Select onValueChange={setComodatoClientId} value={comodatoClientId || ""}>
                        <SelectTrigger className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold focus:ring-primary shadow-sm px-6">
                          <SelectValue placeholder="Selecione o cliente comodatário..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-border/40 bg-background/90 backdrop-blur-3xl shadow-premium">
                          {comodatoClients.map(c => <SelectItem key={c.id} value={c.id} className="h-12 rounded-xl font-semibold transition-all focus:bg-primary focus:text-white cursor-pointer ml-1 mr-1">{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Valor da Mensalidade (R$)</Label>
                      <Input 
                        type="text" 
                        value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(comodatoValue)} 
                        onChange={e => {
                            const value = e.target.value.replace(/\D/g, '');
                            setComodatoValue(Number(value) / 100);
                        }} 
                        className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-xl focus:ring-primary shadow-sm px-6 text-primary"
                        placeholder="0,00"
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Descrição dos Serviços</Label>
                      <Textarea value={comodatoDescription} onChange={e => setComodatoDescription(e.target.value)} className="min-h-[120px] rounded-2xl bg-background/50 border-border/40 font-semibold focus:ring-primary shadow-sm p-6 resize-none" />
                    </div>
                    
                    <Button 
                      onClick={handleEmitirNfseComodato} 
                      disabled={!comodatoClientId || comodatoValue <= 0 || isIssuing}
                      className="h-16 w-full rounded-[1.5rem] bg-primary text-white font-semibold uppercase tracking-[0.2em] shadow-premium transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      {isIssuing ? <Loader2 className="mr-3 h-5 w-5 animate-spin"/> : <Send className="mr-3 h-5 w-5" />}
                      Emitir NFS-e de Comodato
                    </Button>
                  </div>

                  <div className="bg-primary/5 rounded-xl p-8 border border-border/40">
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 mb-6 ml-2">Preview Faturamento</h3>
                    {selectedComodatoClient && company ? (
                        <NfsePreview
                            company={company}
                            client={selectedComodatoClient}
                            serviceDescription={comodatoDescription}
                            serviceValue={comodatoValue}
                            cnaeCode={company?.codigo_cnae}
                            serviceListCode={"11.02"}
                        />
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center gap-3 opacity-20 border-2 border-dashed border-primary/20 rounded-xl">
                        <User className="h-10 w-10" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-center px-10">Selecione um cliente para visualizar a minuta</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="issued" className="m-0 focus-visible:outline-none">
              <div className="bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium border border-border/40 overflow-hidden">
                <div className="p-8 border-b border-border/40 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold tracking-tight opacity-80">Notas Emitidas</h2>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">Histórico de transmissões FocusNFe</p>
                    </div>
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                      <Input type="search" placeholder="Buscar por Nº, cliente ou status..." className="h-9 w-full md:w-[400px] rounded-lg bg-background/50 border-border/40 pl-11 font-semibold focus:bg-background transition-all text-xs" value={searchTermIssued} onChange={(e) => setSearchTermIssued(e.target.value)} />
                    </div>
                  </div>
                  <Button variant="outline" className="h-9 rounded-lg border-border/40 font-semibold hover:bg-primary/5 transition-all text-xs" onClick={fetchIssuedInvoices} disabled={isLoadingNfse}>
                      <RefreshCw className={cn("mr-2 h-4 w-4 text-primary", isLoadingNfse && "animate-spin")} />
                      Sincronizar FocusNFe
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-primary/5 border-none h-[34px]">
                      <TableRow className="hover:bg-transparent border-none h-[34px]">
                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 h-[34px]">Nº NFS-e</TableHead>
                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 h-[34px]">Tomador / Cliente</TableHead>
                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 h-[34px]">Data Emissão</TableHead>
                        <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 h-[34px]">Status</TableHead>
                        <TableHead className="text-right px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 h-[34px]">Valor Total</TableHead>
                        <TableHead className="w-20 px-6 h-[34px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="border-none">
                      {isLoadingNfse ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-0 h-64 text-center">
                            <div className="flex flex-col items-center justify-center gap-4">
                              <Loader2 className="h-10 w-10 animate-spin text-primary" />
                              <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Consultando API FocusNFe...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredIssuedInvoices.length > 0 ? (filteredIssuedInvoices.map((nfse) => {
                          const statusInfo = nfseStatusConfig[nfse.status] || { label: nfse.status, variant: 'default' };
                          const isError = nfse.status === 'erro_autorizacao';
                          return (
                            <TableRow key={nfse.ref} className="group transition-all duration-500 border-border/40 h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                              <TableCell className="py-0 px-6 font-semibold text-xs text-foreground/80 font-mono tracking-tighter">#{nfse.numero || "FILA"}</TableCell>
                              <TableCell className="py-0 px-6">
                                <span className="text-[11px] font-semibold uppercase tracking-tight opacity-80 truncate block max-w-xs">{nfse.tomador.razao_social}</span>
                              </TableCell>
                              <TableCell className="py-0 px-6 text-xs font-semibold opacity-40 uppercase">{formatDateTime(nfse.data_emissao)}</TableCell>
                              <TableCell className="py-0 px-6">
                                <Badge 
                                  variant={statusInfo.variant} 
                                  className={cn(
                                    "h-7 px-4 rounded-full font-semibold text-xs uppercase tracking-widest shadow-lg shadow-black/5 transition-all group-hover:scale-105 border-none",
                                    isError && "cursor-pointer hover:bg-destructive/80"
                                  )} 
                                  onClick={isError ? () => { setErrorDetails({ title: `Detalhes do Erro: NFS-e ${nfse.numero}`, message: nfse.status_sefaz || nfse.mensagem_sefaz || nfse.mensagem }); setErrorDialogOpen(true); } : undefined}
                                >
                                  {statusInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-0 text-right px-6 font-semibold text-base tracking-tighter text-blue-600/90">{formatCurrency(nfse.servico.valor_servicos)}</TableCell>
                              <TableCell className="py-0 px-6 text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all text-foreground">
                                        <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium w-64">
                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={() => handleNfseActionWrapper('pdf', nfse)}><FileDownIcon className="mr-2 h-4 w-4" /> Baixar PDF (DANFE)</DropdownMenuItem>
                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={() => handleNfseActionWrapper('xml', nfse)}><FileDownIcon className="mr-2 h-4 w-4" /> Baixar XML</DropdownMenuItem>
                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer" onClick={() => handleNfseActionWrapper('email', nfse)}><Send className="mr-2 h-4 w-4" /> Enviar p/ Tomador</DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-primary/5" />
                                        <DropdownMenuItem className="h-10 rounded-xl font-semibold cursor-pointer text-destructive" onClick={() => handleNfseActionWrapper('cancel', nfse)}><XCircle className="mr-2 h-4 w-4" /> Cancelar Transmissão</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })) 
                      : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-0 h-40 text-center">
                            <div className="flex flex-col items-center justify-center gap-2 opacity-20">
                              <FileText className="h-10 w-10" />
                              <span className="font-semibold uppercase tracking-widest text-[10px]">Nenhuma nota encontrada na FocusNFe</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </header>
      
      <Dialog open={isErrorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-2xl bg-background border border-border/40 rounded-2xl shadow-2xl p-8">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <DialogTitle className="text-2xl font-semibold tracking-tighter uppercase text-destructive">Impedimento Fiscal</DialogTitle>
            </div>
            <DialogDescription className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
              Resposta da SEFAZ / Prefeitura via API FocusNFe
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 p-6 rounded-[1.5rem] bg-destructive/5 border border-destructive/10">
            <p className="font-semibold text-sm text-foreground/80 leading-relaxed">{errorDetails?.message}</p>
          </div>
          <div className="mt-8 flex justify-end">
            <Button onClick={() => setErrorDialogOpen(false)} className="h-12 px-8 rounded-2xl bg-primary font-semibold uppercase text-[10px] tracking-widest shadow-lg">Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
