"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { getClient, getCompany, updateQuote } from "@/lib/firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/firebase/auth/use-user";
import type { Quote, Client, Company } from "@/lib/data";
import { Loader2, FileDown, CheckCircle, AlertTriangle, XCircle, Pencil, MessageSquareQuote, Calendar, HardHat, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";


export const dynamic = 'force-dynamic';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
};

const formatDate = (dateString: string) => {
    if (!dateString) return "Data indefinida";
    const date = new Date(dateString + 'T00:00:00Z');
    return new Intl.DateTimeFormat("pt-BR", {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
};

const formatFullAddress = (client: Client) => {
    if (client.address) return client.address;
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

const formatQuantity = (quantity: number) => {
  return Number.isInteger(quantity) ? quantity.toFixed(0) : quantity.toFixed(2);
};

const formatProductName = (name: string) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export default function ViewQuotePage() {
  const params = useParams();
  const { toast } = useToast();
  const { firebase } = useAuth();
  const router = useRouter();
  const pdfRef = useRef<HTMLDivElement>(null);
  const quoteId = (params as any)?.id as string;
  
  const [quote, setQuote] = useState<Quote | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionTaken, setActionTaken] = useState<Quote['status'] | null>(null);

  const [isRevisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  
  const [isRejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);


  useEffect(() => {
    if (!quoteId || !firebase) {
      setIsLoading(false);
      return;
    }

    const { db } = firebase;
    const quoteRef = doc(db, "quotes", quoteId);

    const unsubscribe = onSnapshot(quoteRef, async (quoteDoc) => {
      if (quoteDoc.exists()) {
        const fetchedQuote = { id: quoteDoc.id, ...quoteDoc.data() } as Quote;
        setQuote(fetchedQuote);

        if (['Aprovado', 'rejected', 'revision-pending', 'Atribuída', 'Em Execução', 'Finalizado', 'Agendado'].includes(fetchedQuote.status)) {
            setActionTaken(fetchedQuote.status);
        } else {
            setActionTaken(null);
        }

        if (fetchedQuote.clientId) {
          const fetchedClient = await getClient(db, fetchedQuote.clientId);
          setClient(fetchedClient);
        }
        if (fetchedQuote.companyId) {
          const fetchedCompany = await getCompany(db, fetchedQuote.companyId);
          setCompany(fetchedCompany);
        }
      } else {
        setQuote(null);
        toast({ variant: "destructive", title: "Erro", description: "Orçamento não encontrado." });
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching quote:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar o orçamento." });
      setIsLoading(false);
    });

    return () => unsubscribe();

  }, [quoteId, toast, firebase]);
  
  useEffect(() => {
    const convertLogo = async () => {
      if (company?.logoUrl) {
        try {
          // Forçamos o navegador a ignorar o cache de CORS antigo usando um timestamp
          const cacheBusterUrl = company.logoUrl + (company.logoUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`;
          const response = await fetch(cacheBusterUrl, { mode: 'cors' });
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
             setLogoBase64(reader.result as string);
          };
          reader.readAsDataURL(blob);
        } catch (e) {
          console.warn("CORS/Base64 Conversion failed for real logo, will use text fallback if needed:", e);
        }
      }
    };
    convertLogo();
  }, [company?.logoUrl]);

  const handleQuoteAction = async (status: 'Aprovado' | 'revision-pending' | 'rejected', notes?: string) => {
        if (!quote || !firebase) return;
        setIsActionLoading(true);
        const { db, auth } = firebase;
        try {
            await updateQuote(db, auth, quote.id, { 
                status: status, 
                statusHistory: [
                    ...(quote.statusHistory || []),
                    { status, notes: notes || '', changedAt: new Date().toISOString(), changedBy: 'Cliente' }
                ]
            });
            
            setActionTaken(status);
            toast({
                title: 'Obrigado!',
                description: `Sua resposta foi registrada com sucesso.`
            });

            if(isRevisionModalOpen) {
                setRevisionModalOpen(false);
                setRevisionNotes("");
            }
            if(isRejectionModalOpen) {
                setRejectionModalOpen(false);
                setRejectionNotes("");
            }

        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro", description: error.message });
        } finally {
            setIsActionLoading(false);
        }
    };
    
    const handleScheduleConfirm = async () => {
        if (!quote || !firebase) return;
        const { db, auth } = firebase;
        try {
            await updateQuote(db, auth, quote.id, { scheduleStatus: 'confirmed', status: 'Agendado' });
            toast({ title: 'Agendamento Confirmado!', description: 'O serviço foi confirmado para a data proposta.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível confirmar o agendamento.' });
        }
    };


  const handleCreatePdf = async () => {
    if (!quote) return;

    setIsGeneratingPdf(true);
    toast({ title: "Gerando PDF...", description: "Aguarde um momento." });

    const element = pdfRef.current;
    if (!element) {
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível encontrar o conteúdo para gerar o PDF."});
        setIsGeneratingPdf(false);
        return;
    }
    
    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = imgWidth / imgHeight;
      const heightInPdf = pdfWidth / ratio;

      let position = 0;
      let heightLeft = heightInPdf;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, heightInPdf);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, heightInPdf);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`Recibo-${quote.quoteNumber.replace('/', '-')}.pdf`);
      toast({ title: "PDF Gerado!", description: "O download foi iniciado." });

    } catch (e: any) {
       toast({ variant: "destructive", title: "Erro ao Gerar PDF", description: e.message || "Não foi possível gerar o PDF." });
    } finally {
        setIsGeneratingPdf(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-destructive">
        Orçamento não encontrado ou você não tem permissão para visualizá-lo.
      </div>
    );
  }
  
  const totalMaterials = quote.items.reduce((sum, item) => sum + (item.materialPrice * item.quantity), 0);
  const totalServices = quote.items.reduce((sum, item) => sum + ((item.servicePrice || 0) * item.quantity), 0);
  const subtotal = totalMaterials + totalServices;
  const discountAmount = (subtotal * (quote.discount || 0)) / 100;
  const totalAfterDiscount = subtotal - discountAmount;
  const totalWithInterest = subtotal * (1 + ((quote.interestRate || 0) / 100));

  const SchedulingComponent = () => {
    if (quote.scheduleStatus === 'confirmed' || quote.status === 'Agendado') {
        return (
            <Alert variant="default" className="bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Serviço Agendado!</AlertTitle>
                <AlertDescription>
                    Seu serviço está confirmado para o dia {quote.scheduledDate && formatDate(quote.scheduledDate)} às {quote.scheduledTime}.
                </AlertDescription>
            </Alert>
        )
    }

    if (quote.scheduleStatus === 'pending-client-approval' && quote.scheduledDate) {
        return (
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                    <h3 className="font-semibold flex items-center gap-2 mb-2"><Calendar/> Proposta de Agendamento</h3>
                    <p className="text-sm text-muted-foreground mb-3">Nossa equipe propõe a seguinte data para realizar o serviço:</p>
                    <p className="text-lg font-semibold text-center my-2">{formatDate(quote.scheduledDate)} às {quote.scheduledTime}</p>
                    <div className="flex gap-2 justify-center mt-3">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleScheduleConfirm}>Aceitar e Confirmar</Button>
                        <Button size="sm" variant="outline">Sugerir Outro Horário</Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
         <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Orçamento Aprovado!</AlertTitle>
            <AlertDescription>
                Agradecemos sua aprovação! Nossa equipe entrará em contato em breve para agendar o melhor dia e horário para a execução do serviço.
            </AlertDescription>
        </Alert>
    )
  }

  const renderStatusInfo = () => {
    switch (quote.status) {
        case 'Aprovado':
        case 'Agendado':
            return <SchedulingComponent />;
        case 'Atribuída':
        case 'Em Execução':
            return (
                <Alert variant="default" className="bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-800">
                    <HardHat className="h-4 w-4" />
                    <AlertTitle>Serviço em Andamento</AlertTitle>
                    <AlertDescription>
                        Sua Ordem de Serviço foi gerada. O técnico <strong>{quote.assignedTechnicianName?.split(' ')[0]}</strong> é quem irá lhe atender dia <strong>{quote.scheduledDate && formatDate(quote.scheduledDate)}</strong> às <strong>{quote.scheduledTime}</strong>.
                    </AlertDescription>
                </Alert>
            );
        case 'Finalizado':
            return (
                <Alert variant="default" className="bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Serviço Finalizado!</AlertTitle>
                    <AlertDescription>
                        Agradecemos a preferência. A Ordem de Serviço foi concluída com sucesso.
                    </AlertDescription>
                </Alert>
            );
        case 'rejected':
             return (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Orçamento Recusado</AlertTitle>
                    <AlertDescription>
                        Este orçamento foi recusado. Agradecemos seu tempo.
                        {quote.statusHistory?.find(h => h.status === 'rejected' && h.notes)?.notes && (
                            <p className="mt-2 text-xs italic">Motivo: {quote.statusHistory.find(h => h.status === 'rejected' && h.notes)!.notes}</p>
                        )}
                    </AlertDescription>
                </Alert>
            );
        case 'revision-pending':
            return (
                <Alert variant="default" className="bg-yellow-100 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Revisão Solicitada</AlertTitle>
                    <AlertDescription>
                        A solicitação de revisão foi enviada. A empresa analisará e entrará em contato.
                         {quote.statusHistory?.find(h => h.status === 'revision-pending' && h.notes)?.notes && (
                            <p className="mt-2 text-xs italic">Sua solicitação: {quote.statusHistory.find(h => h.status === 'revision-pending' && h.notes)!.notes}</p>
                        )}
                    </AlertDescription>
                </Alert>
            );
        default:
            return (
                <Card className="bg-primary/10 border-primary/20">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <p className="font-semibold text-center sm:text-left">O que você gostaria de fazer com este orçamento?</p>
                        <div className="flex gap-2 flex-wrap justify-center">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleQuoteAction('Aprovado')} disabled={isActionLoading}>
                                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Aprovar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRevisionModalOpen(true)} disabled={isActionLoading}>
                                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Pedir Revisão
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setRejectionModalOpen(true)} disabled={isActionLoading}>
                                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Recusar
                            </Button>
                             <Button size="sm" variant="ghost" onClick={() => router.back()}>
                                <ArrowLeft className="mr-2 h-4 w-4" />Voltar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            );
    }
  };


  return (
    <main className="p-4 md:p-8 font-sans bg-muted text-foreground">
        <div id="receipt-content" className="max-w-4xl mx-auto bg-card p-4 md:p-8 rounded-lg shadow-lg">
            <header className="flex justify-between items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                    {company?.logoUrl && (
                        <div className="relative w-24 h-16">
                            <img src={company.logoUrl} alt={company.name || 'Logo da empresa'} className="w-full h-full object-contain" crossOrigin="anonymous" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl font-semibold text-primary">{quote.quoteNumber}</h1>
                        <p className="text-sm text-muted-foreground">Data: {formatDate(quote.date.split('T')[0])}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="font-semibold text-xl">{company?.name}</h2>
                    {company && <p className="text-xs text-muted-foreground">{company.cnpj && `CNPJ ${company.cnpj}`}{company.cnpj && company.phone && ' - '}{company.phone}</p>}
                </div>
            </header>
            
            <div id="print-actions" className="flex flex-col gap-4 my-4">
                 {renderStatusInfo()}
                <div className="col-span-2 flex justify-end gap-2">
                    <Button size="sm" onClick={handleCreatePdf} disabled={isGeneratingPdf}>
                        {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4"/>}
                        {isGeneratingPdf ? "Gerando..." : "Baixar PDF"}
                    </Button>
                </div>
            </div>


            <Separator className="my-6"/>

            {client && (
                <div className="mb-6">
                    <h3 className="text-base font-semibold mb-2">Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div><span className="font-semibold">Nome: </span>{client.name}</div>
                        <div><span className="font-semibold">Email: </span>{client.email}</div>
                        <div><span className="font-semibold">Telefone: </span>{client.phone}</div>
                        <div><span className="font-semibold">Endereço: </span>{formatFullAddress(client)}</div>
                    </div>
                </div>
            )}
            
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Itens do Orçamento</h3>
                {quote.serviceType && <Badge variant="secondary">{quote.serviceType}</Badge>}
            </div>
            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 h-[34px]">
                            <TableHead className="w-12 text-center py-2 px-2 h-[34px]">#</TableHead>
                            <TableHead className="py-2 px-2 h-[34px]">Código</TableHead>
                            <TableHead className="py-2 px-2 h-[34px]">Descrição</TableHead>
                            <TableHead className="text-center py-2 px-2 h-[34px]">Qtd.</TableHead>
                            <TableHead className="text-right py-2 px-2 h-[34px]">Val. Material</TableHead>
                            <TableHead className="text-right py-2 px-2 h-[34px]">Val. Serviço</TableHead>
                            <TableHead className="text-right py-2 px-2 h-[34px]">Subtotal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quote.items.map((item, index) => (
                            <TableRow key={item.id}>
                                <TableCell className="py-0 text-center font-mono text-xs text-muted-foreground px-2">{index + 1}</TableCell>
                                <TableCell className="py-0 font-mono text-xs px-2">{item.product.item}</TableCell>
                                <TableCell className="py-0 text-xs px-2">{formatProductName(item.product.description)}</TableCell>
                                <TableCell className="py-0 text-center text-xs px-2">{formatQuantity(item.quantity)}</TableCell>
                                <TableCell className="py-0 text-right text-xs px-2 text-muted-foreground">{formatCurrency(item.materialPrice * item.quantity)}</TableCell>
                                <TableCell className="py-0 text-right text-xs px-2 text-muted-foreground">{formatCurrency(item.servicePrice * item.quantity)}</TableCell>
                                <TableCell className="py-0 text-right font-medium text-xs px-2">{formatCurrency(item.total)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="mt-4 flex flex-col items-end gap-1 text-right bg-muted/30 p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground flex justify-between w-full max-w-[250px]">
                    <span>Total Materiais:</span>
                    <span className="font-medium text-foreground">{formatCurrency(totalMaterials)}</span>
                </div>
                <div className="text-sm text-muted-foreground flex justify-between w-full max-w-[250px]">
                    <span>Total Serviços:</span>
                    <span className="font-medium text-foreground">{formatCurrency(totalServices)}</span>
                </div>
                <div className="text-base font-semibold flex justify-between w-full max-w-[250px] border-t border-border mt-2 pt-2">
                    <span>Subtotal:</span>
                    <span className="ml-4 font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                {(quote.discount || 0) > 0 && (
                    <div className="text-sm text-destructive flex justify-between w-full max-w-[250px]">
                        <span>Desconto ({quote.discount}%):</span>
                        <span className="ml-4">-{formatCurrency(discountAmount)}</span>
                    </div>
                )}
                <div className="text-lg font-semibold mt-3 text-primary flex justify-between items-center w-full max-w-[280px] bg-primary/10 p-3 rounded-md">
                    <span className="text-sm uppercase tracking-wider text-primary/80">Total (à vista):</span>
                    <span className="ml-4 text-primary">{formatCurrency(totalAfterDiscount)}</span>
                </div>
                {quote.installments && quote.installments > 1 && (
                      <>
                        <div className="text-sm font-semibold"><span>Total (a prazo):</span><span className="ml-4 text-primary">{formatCurrency(totalWithInterest)}</span></div>
                        <div className="text-xs font-medium">ou {quote.installments}x de <span className="text-primary">{formatCurrency(totalWithInterest / quote.installments)}</span>{ (quote.interestRate || 0) > 0 && <span className="text-xs text-muted-foreground"> (com juros de {quote.interestRate}%)</span>}</div>
                      </>
                  )}
            </div>
             <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
                <p>Obrigado pela preferência!</p>
            </div>
        </div>

        <Dialog open={isRevisionModalOpen} onOpenChange={setRevisionModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Pencil /> Solicitar Revisão</DialogTitle>
                    <DialogDescription>
                        Descreva abaixo as alterações que você gostaria de solicitar neste orçamento. A empresa será notificada.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="revision-notes">Sua solicitação</Label>
                    <Textarea
                        id="revision-notes"
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        placeholder="Ex: Gostaria de trocar o item X pelo Y, incluir o serviço Z, etc."
                        rows={5}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setRevisionModalOpen(false)}>Cancelar</Button>
                    <Button onClick={() => handleQuoteAction('revision-pending', revisionNotes)} disabled={isActionLoading || !revisionNotes.trim()}>
                        {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Enviar Solicitação
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isRejectionModalOpen} onOpenChange={setRejectionModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><MessageSquareQuote /> Recusar Orçamento</DialogTitle>
                    <DialogDescription>
                        Você tem certeza que deseja recusar este orçamento? Se desejar, informe o motivo abaixo. Sua opinião é importante para nós.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="rejection-notes">Motivo da recusa (opcional)</Label>
                    <Textarea
                        id="rejection-notes"
                        value={rejectionNotes}
                        onChange={(e) => setRejectionNotes(e.target.value)}
                        placeholder="Ex: Valor acima do esperado, encontrei outra opção, etc."
                        rows={4}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectionModalOpen(false)}>Cancelar</Button>
                    <Button variant="destructive" onClick={() => handleQuoteAction('rejected', rejectionNotes)} disabled={isActionLoading}>
                        {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar Recusa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* ELEMENTO ESCONDIDO PARA CAPTURA DO PDF (GARANTE LOGO E RETIRA BOTÕES) */}
        <div 
            ref={pdfRef}
            className="absolute -left-[9999px] top-0 p-8 bg-white text-black font-sans"
            style={{ width: '850px' }} // Largura aproximada de um A4
        >
            <div className="bg-white p-8">
                <header className="flex justify-between items-start gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        {!logoError && (logoBase64 || company?.logoUrl) ? (
                            <div className="w-32 h-20">
                                <img 
                                    src={logoBase64 || company?.logoUrl || ""} 
                                    alt={company?.name || 'Logo'} 
                                    className="w-full h-full object-contain" 
                                    crossOrigin="anonymous"
                                    onError={() => setLogoError(true)}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col border-l-4 border-black pl-3 py-1">
                                <span className="text-xl font-semibold tracking-tighter leading-none">{company?.name?.toUpperCase()}</span>
                                <span className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-widest">Instalações e Manutenção</span>
                            </div>
                        )}
                        <div className={cn(!logoError && (logoBase64 || company?.logoUrl) ? "ml-2" : "")}>
                            <h1 className="font-semibold text-black text-xl">{quote.quoteNumber}</h1>
                            <p className="text-sm text-gray-500">Data: {formatDate(quote.date.split('T')[0])}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="font-semibold text-black text-xl">{company?.name}</h2>
                        {company && (
                            <p className="text-xs text-gray-500">
                                {company.cnpj && `CNPJ ${company.cnpj}`}<br/>
                                {company.street}, {company.number}<br/>
                                {company.city}/{company.state}<br/>
                                {company.phone}
                            </p>
                        )}
                    </div>
                </header>

                <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-base font-semibold mb-2">INFORMAÇÕES DO CLIENTE</h3>
                    {client && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-black">
                            <div><span className="font-semibold">Nome: </span>{client.name}</div>
                            <div><span className="font-semibold">Email: </span>{client.email}</div>
                            <div><span className="font-semibold">Telefone: </span>{client.phone}</div>
                            <div className="col-span-2"><span className="font-semibold">Endereço: </span>{formatFullAddress(client)}</div>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2 uppercase tracking-tight">ITENS DO ORÇAMENTO</h3>
                </div>
                
                <table className="w-full border-collapse mb-8 text-sm">
                    <thead>
                        <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="text-left py-2 px-2 font-semibold text-black">CÓDIGO</th>
                            <th className="text-left py-2 px-2 font-semibold text-black">DESCRIÇÃO</th>
                            <th className="text-center py-2 px-2 font-semibold text-black">QTD.</th>
                            <th className="text-right py-2 px-2 font-semibold text-black">SUBTOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quote.items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100">
                                <td className="py-2 px-2 font-mono text-xs">{item.product.item}</td>
                                <td className="py-2 px-2">{formatProductName(item.product.description)}</td>
                                <td className="text-center py-2 px-2">{formatQuantity(item.quantity)}</td>
                                <td className="text-right py-2 px-2 font-medium">{formatCurrency(item.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex flex-col items-end gap-1 text-right bg-gray-50 p-6 rounded-lg border border-gray-300 ml-auto w-full max-w-[400px]">
                    <div className="text-sm flex justify-between w-full">
                        <span className="text-gray-600">Total Materiais:</span>
                        <span className="font-semibold">{formatCurrency(totalMaterials)}</span>
                    </div>
                    <div className="text-sm flex justify-between w-full">
                        <span className="text-gray-600">Total Serviços:</span>
                        <span className="font-semibold">{formatCurrency(totalServices)}</span>
                    </div>
                    <div className="text-xl font-semibold flex justify-between w-full border-t border-gray-400 mt-4 pt-4 text-black">
                        <span>TOTAL:</span>
                        <span>{formatCurrency(totalAfterDiscount)}</span>
                    </div>
                    {quote.installments && quote.installments > 1 && (
                        <div className="text-sm font-medium text-gray-500 mt-2">
                            ou {quote.installments}x de {formatCurrency(totalWithInterest / quote.installments)}
                        </div>
                    )}
                </div>

                <div className="mt-12 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
                    <p>Orçamento gerado pelo sistema NORA - ESP-TEC</p>
                </div>
            </div>
        </div>
    </main>
  );
}
