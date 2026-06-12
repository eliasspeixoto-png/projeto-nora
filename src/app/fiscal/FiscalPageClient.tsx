

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
import { handleFocusNFeAction, issueNfse } from "./actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

    if (result.success) {
      toast({ title: 'Sucesso!', description: `NFS-e da O.S. ${selectedOs.quoteNumber.replace('ORC', 'O.S')} enviada para a fila.` });
      if ('data' in result && result.data?.id) {
          await updateQuote(firebase.db, firebase.auth, selectedOs.id, { nfseId: result.data.id });
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

    const comodatoOsFicticio: Quote = {
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
    if (result.success) {
      toast({ title: 'Sucesso!', description: `NFS-e de Comodato para ${selectedComodatoClient.name} enviada para a fila.` });
      if ('data' in result && result.data?.id) {
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
    const serviceItemsDescription = selectedOs.items.map(item => `${item.quantity}x ${item.product.description}`).join('; ');
    let fullDescription = `Serviços de instalação e manutenção conforme O.S. ${selectedOs.quoteNumber.replace('ORC', 'O.S')}: ${serviceItemsDescription}`;
    if (selectedOs.notes) {
      fullDescription += `\n\nRELATÓRIO DE EXECUÇÃO:\n${selectedOs.notes}`;
    }
    return fullDescription;
  }, [selectedOs]);

  return (
    <div className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 text-foreground">
      <header className="flex flex-col gap-8 px-6 pt-8 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl shadow-inner text-primary">
                      <FileText className="h-8 w-8" />
                  </div>
                  <div className="flex flex-col">
                      <h1 className="font-semibold tracking-tighter text-xl">Gestão Fiscal</h1>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40">Portal de Faturamento Focus NFe</p>
                  </div>
              </div>

              <div className="flex items-center gap-3">
                 <Badge variant="outline" className="h-10 px-4 rounded-xl border-border/40 bg-background/40 backdrop-blur-md font-semibold text-[10px] uppercase tracking-widest text-primary/60">
                    Ambiente: {company?.focusNfeEnvironment === 'producao' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}
                 </Badge>
              </div>
          </div>
      </header>

      <div className="px-6">
        <Tabs defaultValue="service" className="flex flex-col flex-1 min-h-0 space-y-8">
          <div className="w-full overflow-x-auto no-scrollbar pb-2 -mx-6 px-6 sm:mx-0 sm:px-0">
              <TabsList className="bg-primary/5 p-1 rounded-xl sm:rounded-2xl border border-border/40 inline-flex w-max min-w-full items-center justify-start sm:justify-center">
                  <TabsTrigger value="service" className="rounded-lg sm:rounded-xl px-4 sm:px-8 h-10 font-semibold text-[10px] uppercase tracking-normal sm:tracking-widest gap-2 shrink-0 sm:flex-1">
                      NFS-e (Serviço)
                  </TabsTrigger>
                  <TabsTrigger value="comodato" className="rounded-lg sm:rounded-xl px-4 sm:px-8 h-10 font-semibold text-[10px] uppercase tracking-normal sm:tracking-widest gap-2 shrink-0 sm:flex-1">
                      NFS-e (Comodato)
                  </TabsTrigger>
                  <TabsTrigger value="issued" className="rounded-lg sm:rounded-xl px-4 sm:px-8 h-10 font-semibold text-[10px] uppercase tracking-normal sm:tracking-widest gap-2 shrink-0 sm:flex-1">
                      Notas Emitidas
                  </TabsTrigger>
              </TabsList>
          </div>

          <TabsContent value="service" className="mt-0 border-none p-0 focus-visible:ring-0">
            <Card className="border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl rounded-2xl sm:rounded-xl overflow-hidden">
              <CardHeader className="p-4 sm:p-10 pb-0 sm:pb-0">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-xl font-semibold tracking-tighter">Emissão de NFS-e de Serviço</CardTitle>
                  <CardDescription className="text-[10px] sm:text-xs font-semibold text-muted-foreground/40 uppercase tracking-widest">Selecione uma O.S. finalizada para processar o faturamento.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-10 pt-6 sm:pt-8 space-y-6 sm:space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1">Documento de Origem (O.S.)</Label>
                    <Select onValueChange={setSelectedOsId} value={selectedOsId || ""}>
                      <SelectTrigger className="h-9 font-semibold text-sm rounded-lg bg-background/50 border-border/40 hover:bg-background/80 transition-all px-4 text-xs">
                          <SelectValue placeholder="Localizar O.S. finalizada..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                        {serviceOrdersFinalizados.map(os => (
                          <SelectItem key={os.id} value={os.id} className="rounded-xl">
                            {os.quoteNumber.replace('ORC','O.S')} - {os.clientName} ({formatCurrency(os.total)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1">Cód. Serviço (LC116)</Label>
                      <Input value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} placeholder="Ex: 14.06" className="h-12 font-semibold rounded-2xl bg-background/50 border-border/40 shadow-inner" />
                    </div>
                     <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1">Cód. Trib. Município</Label>
                      <Input value={codTributarioMunicipio} onChange={(e) => setCodTributarioMunicipio(e.target.value)} placeholder="Opcional" className="h-12 font-semibold rounded-2xl bg-background/50 border-border/40 shadow-inner" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                    <Button onClick={handleEmitirNfseServico} disabled={!selectedOsId || isIssuing} className="h-14 px-10 rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-3 bg-primary">
                        {isIssuing ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                        Enviar p/ Prefeitura
                    </Button>
                    
                    {selectedOs && (
                        <div className="text-right">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-primary/40">Total Líquido Estimado</p>
                            <p className="text-3xl font-semibold tracking-tighter text-foreground">{formatCurrency(selectedOs.total)}</p>
                        </div>
                    )}
                </div>

                {selectedOs && selectedOsClient && company && (
                    <div className="pt-8 border-t border-border/40 animate-in fade-in duration-500">
                        <div className="mb-4">
                            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-primary/40 ml-1">Preview do Documento Fiscal</h4>
                        </div>
                        <div className="max-h-[500px] overflow-auto rounded-[1.5rem] border border-border/40 shadow-inner p-2 bg-background/20">
                          <NfsePreview
                              company={company}
                              client={selectedOsClient}
                              serviceDescription={serviceDescriptionForPreview}
                              serviceValue={selectedOs.total}
                              cnaeCode={company?.codigo_cnae}
                              serviceListCode={serviceCode}
                              codTributarioMunicipio={codTributarioMunicipio}
                          />
                        </div>
                    </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comodato" className="mt-0 border-none p-0 focus-visible:ring-0">
            <Card className="border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl rounded-2xl sm:rounded-xl overflow-hidden">
              <CardHeader className="p-4 sm:p-10 pb-0 sm:pb-0">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-xl font-semibold tracking-tighter">Faturamento em Lote / Comodato</CardTitle>
                  <CardDescription className="text-[10px] sm:text-xs font-semibold text-muted-foreground/40 uppercase tracking-widest">Gere notas de mensalidade para clientes ativos.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-10 pt-6 sm:pt-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1">Titular do Contrato</Label>
                        <Select onValueChange={setComodatoClientId} value={comodatoClientId || ""}>
                            <SelectTrigger className="h-9 font-semibold text-sm rounded-lg bg-background/50 border-border/40 hover:bg-background/80 transition-all px-4 text-xs">
                                <SelectValue placeholder="Selecionar cliente comodato..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                {comodatoClients.map(c => <SelectItem key={c.id} value={c.id} className="rounded-xl">{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1">Valor do Ciclo (R$)</Label>
                        <div className="relative group">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all font-semibold" />
                          <Input 
                              type="text" 
                              value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(comodatoValue)} 
                              onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  setComodatoValue(Number(value) / 100);
                              }} 
                              placeholder="0,00"
                              className="h-12 pl-12 font-semibold rounded-2xl bg-background/50 border-border/40 shadow-inner focus:bg-background transition-all focus-visible:ring-primary/20"
                          />
                        </div>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1">Histórico / Descritivo da Nota</Label>
                    <Textarea value={comodatoDescription} onChange={e => setComodatoDescription(e.target.value)} className="min-h-[120px] font-semibold rounded-2xl bg-background/50 border-border/40 shadow-inner focus:bg-background transition-all p-4" />
                 </div>
                 
                 <div className="flex items-center justify-between pt-4">
                    <Button onClick={handleEmitirNfseComodato} disabled={!comodatoClientId || comodatoValue <= 0 || isIssuing} className="h-14 px-10 rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-3 bg-primary">
                        {isIssuing ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                        Emitir Nota Comodato
                    </Button>
                    
                    {selectedComodatoClient && (
                         <div className="text-right">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-primary/40">Total do Ciclo Mensal</p>
                            <p className="text-3xl font-semibold tracking-tighter text-foreground group-hover:text-primary transition-all">{formatCurrency(comodatoValue)}</p>
                        </div>
                    )}
                 </div>

                 {selectedComodatoClient && company && (
                    <div className="pt-8 border-t border-border/40 animate-in fade-in duration-500">
                        <div className="mb-4">
                            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-primary/40 ml-1">Preview do Faturamento Comodato</h4>
                        </div>
                        <div className="max-h-[500px] overflow-auto rounded-[1.5rem] border border-border/40 shadow-inner p-2 bg-background/20">
                          <NfsePreview
                              company={company}
                              client={selectedComodatoClient}
                              serviceDescription={comodatoDescription}
                              serviceValue={comodatoValue}
                              cnaeCode={company?.codigo_cnae}
                              serviceListCode={"11.02"} // Fixo para comodato
                          />
                        </div>
                    </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        
          <TabsContent value="issued" className="mt-0 border-none p-0 focus-visible:ring-0">
            <Card className="border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl rounded-2xl sm:rounded-xl overflow-hidden">
              <CardHeader className="p-4 sm:p-10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-xl font-semibold tracking-tighter">Registro de Emissões</CardTitle>
                      <CardDescription className="text-[10px] sm:text-xs font-semibold text-muted-foreground/40 uppercase tracking-widest">Controle de protocolos e autorizações Focus NFe.</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                          <Input type="search" placeholder="Busca inteligente..." className="h-9 pl-12 bg-background/50 border-border/40 rounded-lg font-semibold shadow-sm focus-visible:ring-primary/20 w-full sm:w-[350px] text-xs" value={searchTermIssued} onChange={(e) => setSearchTermIssued(e.target.value)} />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-12 rounded-lg hover:bg-primary/10 text-primary transition-all active:scale-95 text-xs" onClick={fetchIssuedInvoices} disabled={isLoadingNfse}>
                          <RefreshCw className={cn("h-5 w-5", isLoadingNfse && "animate-spin")} />
                      </Button>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader className="bg-primary/[0.03] border-border/40 h-[34px]">
                      <TableRow className="hover:bg-transparent h-[34px]">
                        <TableHead className="px-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Protocolo / Nº</TableHead>
                        <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 text-center h-[34px]">Data</TableHead>
                        <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Tomador do Serviço</TableHead>
                        <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 text-center h-[34px]">Status Sefaz</TableHead>
                        <TableHead className="px-6 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Valor Nota</TableHead>
                        <TableHead className="px-10 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Gestão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingNfse ? (
                        <TableRow><TableCell colSpan={6} className="py-0 h-64 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Recuperando dados da prefeitura...</span>
                          </div>
                        </TableCell></TableRow>
                      ) 
                      : filteredIssuedInvoices.length > 0 ? (filteredIssuedInvoices.map((nfse) => {
                          const statusInfo = nfseStatusConfig[nfse.status] || { label: nfse.status, variant: 'default' };
                          const isError = nfse.status === 'erro_autorizacao';
                          return (
                            <TableRow key={nfse.ref} className="[0.03] transition-all border-border/40 group h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                              <TableCell className="py-0 px-10 font-mono font-semibold text-xs text-primary/40 group-hover:text-primary transition-colors">
                                {nfse.numero ? `Nº ${nfse.numero}` : `Ref: ${nfse.ref.substring(0,8)}...`}
                              </TableCell>
                              <TableCell className="py-0 px-6 text-center">
                                <span className="text-xs font-semibold text-foreground/60">{formatDateTime(nfse.data_emissao)}</span>
                              </TableCell>
                              <TableCell className="py-0 px-6">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">{nfse.tomador.razao_social}</span>
                                  <span className="text-[10px] font-mono font-semibold text-primary/20 uppercase tracking-widest mt-0.5">{nfse.tomador.cnpj || nfse.tomador.cpf}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-0 px-6 text-center">
                                <Badge 
                                  variant={statusInfo.variant} 
                                  className={cn("font-semibold text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-xl shadow-lg shadow-black/5", isError && "cursor-pointer hover:opacity-80 active:scale-95 transition-all animate-pulse")} 
                                  onClick={isError ? () => { setErrorDetails({ title: `Logs de Erro: ${nfse.numero || nfse.ref}`, message: nfse.status_sefaz || nfse.mensagem_sefaz || nfse.mensagem }); setErrorDialogOpen(true); } : undefined}
                                >
                                  {statusInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-0 px-6 text-right font-semibold text-xs text-emerald-600">
                                {formatCurrency(nfse.servico.valor_servicos)}
                              </TableCell>
                              <TableCell className="py-0 px-10 text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/40 hover:text-primary hover:bg-primary/10 transition-all active:scale-95">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                        <DropdownMenuItem onClick={() => handleNfseActionWrapper('pdf', nfse)} className="rounded-xl"><FileDownIcon className="mr-2 h-4 w-4" /> Baixar PDF</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleNfseActionWrapper('xml', nfse)} className="rounded-xl"><FileDownIcon className="mr-2 h-4 w-4" /> Exportar XML</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleNfseActionWrapper('email', nfse)} className="rounded-xl"><Send className="mr-2 h-4 w-4" /> Enviar p/ Tomador</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleNfseActionWrapper('cancel', nfse)} className="rounded-xl text-destructive focus:text-destructive"><XCircle className="mr-2 h-4 w-4" /> Cancelar NFS-e</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })) 
                      : (<TableRow><TableCell colSpan={6} className="py-0 h-64 text-center group">
                           <div className="flex flex-col items-center gap-4 opacity-20 group-hover:opacity-40 transition-opacity">
                              <FileText className="h-12 w-12" />
                              <span className="text-xs font-semibold uppercase tracking-widest">Nenhuma ocorrência fiscal localizada</span>
                           </div>
                        </TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isErrorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl bg-background/60 backdrop-blur-3xl border-border/40 shadow-premium rounded-xl p-10">
          <DialogHeader className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-destructive/10 rounded-2xl shadow-inner text-destructive">
                    <AlertTriangle className="h-8 w-8" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-semibold tracking-tighter text-foreground">
                        {errorDetails?.title}
                    </DialogTitle>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive/40 mt-1 italic">Protocolo de Rejeição Sefaz</p>
                </div>
            </div>
          </DialogHeader>
          <div className="mt-8 p-6 rounded-2xl bg-destructive/[0.03] border border-destructive/5 shadow-inner">
            <p className="text-sm font-semibold text-destructive/80 leading-relaxed whitespace-pre-wrap">
                {errorDetails?.message || 'Nenhum detalhe técnico específico retornado pela prefeitura.'}
            </p>
          </div>
          <div className="mt-6">
            <p className="text-[11px] font-semibold text-muted-foreground/40 leading-relaxed">
                Recomenda-se revisar o cadastro do cliente (CPF/CNPJ, Inscrição Municipal ou CEP) e os dados do serviço executado antes de tentar uma nova transmissão.
            </p>
          </div>
          <div className="mt-10 flex justify-end">
                <Button onClick={() => setErrorDialogOpen(false)} className="h-14 px-10 rounded-2xl font-semibold tracking-tight shadow-xl shadow-destructive/20 hover:scale-[1.02] active:scale-95 transition-all bg-destructive">
                    Entendido, vou revisar
                </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
