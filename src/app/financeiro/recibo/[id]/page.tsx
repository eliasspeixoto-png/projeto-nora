

"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { getAccountReceivable, getQuote, getClient, getCompany } from "@/lib/firebase/firestore";
import type { AccountsReceivable, Quote, Client, Company } from "@/lib/data";
import { Loader2, Printer, ArrowLeft, Copy, Check, Share2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import ReceiptContent from "./ReceiptContent";
import { useAuth } from "@/firebase/auth/use-user";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="0"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16.75 13.96c.25.13.43.2.5.33.07.13.07.5.03.66a.88.88 0 0 1-.4.43c-.14.07-.36.1-.65.07-.28-.03-.6-.13-1.08-.33a5.75 5.75 0 0 1-2.07-1.28c-1.4-1.14-2.3-2.5-2.48-2.87-.18-.37-.36-.7-.36-1.04 0-.3.1-.6.28-.8.18-.2.38-.28.5-.32a.75.75 0 0 1 .4.04c.14.07.2.1.25.17.04.07.06.1.07.14.02.04.03.07.03.1s-.02.1-.04.14c-.02.04-.04.07-.06.1l-.2.33c-.09.13-.18.28-.2.37a.3.3 0 0 0 0 .3c.01.07.03.14.07.21.2.36.5.7.88 1.03.22.2.46.38.7.54.25.16.4.25.5.3.1.04.18.06.25.06.07 0 .14-.01.2-.04.28-.13.42-.5.5-.8.08-.3.04-.54 0-.7-.03-.17-.1-.3-.18-.36a.8.8 0 0 1-.1-.13c-.04-.05-.07-.08-.1-.1l-.25-.42a.5.5 0 0 1 0-.5c.08-.14.18-.2.28-.2.1 0 .2.01.28.03.2.07.34.14.43.2zM12 2a10 10 0 0 0-9.2 14.2l-1.33 4.8a.5.5 0 0 0 .63.63l4.8-1.34A10 10 0 1 0 12 2z" />
  </svg>
);


export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const { firebase } = useAuth();
  const receivableId = (params as any)?.id as string;
  const { toast } = useToast();
  
  const [receivable, setReceivable] = useState<AccountsReceivable | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ url: string; message: string; clientName: string; clientEmail?: string; clientPhone?: string; quoteNumber: string;} | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!receivableId) {
      setIsLoading(false);
      return;
    }

    const fetchReceiptData = async () => {
      if (!firebase || !firebase.db) {
        toast({ variant: 'destructive', title: 'Erro de Inicialização', description: 'Serviço de banco de dados indisponível.' });
        setIsLoading(false);
        return;
      }
      try {
        const fetchedReceivable = await getAccountReceivable(firebase.db, receivableId);
        if (!fetchedReceivable) throw new Error("Recibo não encontrado.");
        
        const fetchedQuote = await getQuote(firebase.db, fetchedReceivable.quoteId);
        if (!fetchedQuote) throw new Error("Orçamento associado não encontrado.");

        const [fetchedClient, fetchedCompany] = await Promise.all([
          getClient(firebase.db, fetchedReceivable.clientId),
          getCompany(firebase.db, fetchedReceivable.companyId)
        ]);
        if (!fetchedClient || !fetchedCompany) throw new Error("Dados do cliente ou empresa não encontrados.");
        
        setReceivable(fetchedReceivable);
        setQuote(fetchedQuote);
        setClient(fetchedClient);
        setCompany(fetchedCompany);

      } catch (error: any) {
        console.error("Failed to fetch receipt data:", error);
        toast({ variant: 'destructive', title: 'Erro ao carregar dados', description: error.message || 'Não foi possível buscar as informações do recibo.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceiptData();
  }, [receivableId, toast, firebase]);
  
  const handleShare = async () => {
    if (!quote || !client || !company || !pdfRef.current) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Dados incompletos para gerar o PDF.' });
        return;
    }

    setIsSharing(true);
    toast({ title: 'Gerando PDF...', description: 'Aguarde um momento, estamos preparando o recibo.' });

    try {
        const canvas = await html2canvas(pdfRef.current, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
                const clonedElement = clonedDoc.querySelector('[ref="pdfRef"]') as HTMLElement || clonedDoc.body.querySelector('.absolute.-left-\\[9999px\\]');
                if (clonedElement) {
                    clonedElement.style.backgroundColor = '#ffffff';
                    clonedElement.style.color = '#000000';
                    clonedElement.classList.remove('dark');
                    clonedElement.classList.add('light');
                    
                    const allTexts = clonedElement.querySelectorAll('*');
                    allTexts.forEach((el) => {
                        if (el instanceof HTMLElement) {
                            el.style.color = '#000000';
                            if (el.classList.contains('text-muted-foreground')) el.style.color = '#666666';
                        }
                    });
                }
            }
        });
        const pdf = new jsPDF('p', 'px', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, imgHeight);

        const pdfDataUri = pdf.output('datauristring');
        
        const { storage } = firebase;
        const filePath = `shared_receipts/${company.id}/${quote.quoteNumber.replace('/', '-')}-${Date.now()}.pdf`;
        const storageRef = ref(storage, filePath);

        await uploadString(storageRef, pdfDataUri, 'data_url');
        const downloadUrl = await getDownloadURL(storageRef);

        const message = `Olá ${client.name}, segue o recibo referente à O.S. ${quote.quoteNumber}:\n${downloadUrl}`;
        
        setShareInfo({
            url: downloadUrl,
            message: message,
            clientName: client.name,
            clientEmail: client.email,
            clientPhone: client.whatsapp || client.phone,
            quoteNumber: quote.quoteNumber,
        });

        toast({ title: 'Pronto!', description: 'Seu PDF foi gerado e está pronto para ser enviado.' });

    } catch(e: any) {
        console.error("Share error:", e);
        toast({ variant: 'destructive', title: 'Erro ao Compartilhar', description: e.message || 'Não foi possível gerar ou enviar o PDF.' });
    } finally {
        setIsSharing(false);
    }
  }

  const handleCopyShareLink = () => {
    if (shareInfo?.url) {
        navigator.clipboard.writeText(shareInfo.url);
        toast({ title: "Link do PDF copiado!" });
    }
  };

  const handleSendWhatsApp = () => {
    if (!shareInfo) return;
    if (shareInfo.clientPhone) {
        const cleanPhoneNumber = `55${shareInfo.clientPhone.replace(/\D/g, '')}`;
        const whatsappUrl = `https://wa.me/${cleanPhoneNumber}?text=${encodeURIComponent(shareInfo.message)}`;
        window.open(whatsappUrl, '_blank');
    } else {
        toast({ variant: "destructive", title: "Erro", description: "Cliente não possui um número de WhatsApp ou telefone cadastrado."});
    }
  };

  const handleSendEmail = () => {
    if (!shareInfo || !company) return;
    if (shareInfo.clientEmail) {
        const subject = `Recibo de Pagamento - O.S. ${shareInfo.quoteNumber}`;
        const mailtoUrl = `mailto:${shareInfo.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareInfo.message)}`;
        window.open(mailtoUrl);
    } else {
        toast({ variant: "destructive", title: "Erro", description: "Cliente não possui um email cadastrado."});
    }
  };
  
  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!receivable || !quote || !client || !company) {
    return <div className="flex h-screen w-full items-center justify-center text-destructive">Não foi possível carregar os dados do recibo.</div>;
  }

  return (
    <>
      <main className="p-4 md:p-8 font-serif bg-background text-foreground">
          <div className="max-w-3xl mx-auto">
              <div className="mb-8 flex justify-end gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4"/>Voltar</Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Imprimir</Button>
                  <Button size="sm" onClick={handleShare} disabled={isSharing}>
                        {isSharing ? <Loader2 className="animate-spin mr-2"/> : <Share2 className="mr-2 h-4 w-4"/>}
                        {isSharing ? 'Gerando...' : 'Compartilhar'}
                  </Button>
              </div>
              <ReceiptContent
                company={company}
                client={client}
                quote={quote}
                receivable={receivable}
              />
          </div>
      </main>
      
       <div 
        ref={pdfRef}
        className="absolute -left-[9999px] top-0 p-8"
        style={{
            width: '800px', // Aprox. A4 width
            backgroundColor: 'white',
            color: 'black',
            '--background': '210 40% 98%',
            '--foreground': '240 10% 3.9%',
            '--card': '0 0% 100%',
            '--card-foreground': '240 10% 3.9%',
            '--popover': '0 0% 100%',
            '--popover-foreground': '240 10% 3.9%',
            '--primary': '217 91% 60%',
            '--primary-foreground': '0 0% 98%',
            '--secondary': '240 4.8% 95.9%',
            '--secondary-foreground': '240 5.9% 10%',
            '--muted': '240 4.8% 95.9%',
            '--muted-foreground': '240 3.8% 46.1%',
            '--accent': '142 71% 45%',
            '--accent-foreground': '0 0% 98%',
            '--destructive': '0 84.2% 60.2%',
            '--destructive-foreground': '0 0% 98%',
            '--border': '240 5.9% 90%',
            '--input': '240 5.9% 90%',
            '--ring': '217 91% 60%',
        } as React.CSSProperties}
    >
        <ReceiptContent
            company={company}
            client={client}
            quote={quote}
            receivable={receivable}
        />
    </div>

     <Dialog open={!!shareInfo} onOpenChange={(isOpen) => !isOpen && setShareInfo(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Compartilhar Recibo {shareInfo?.quoteNumber}</DialogTitle>
                <DialogDescription>Seu link para o PDF do recibo está pronto para ser enviado para {shareInfo?.clientName}.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="share-link">Link do PDF</Label>
                <div className="flex items-center gap-2">
                    <Input id="share-link" value={shareInfo?.url || ''} readOnly />
                    <Button size="icon" variant="outline" onClick={handleCopyShareLink}><Copy className="h-4 w-4"/></Button>
                </div>
            </div>
            <DialogFooter className="sm:justify-start gap-2">
                <Button onClick={handleSendWhatsApp}><WhatsAppIcon className="mr-2 h-4 w-4"/> Enviar por WhatsApp</Button>
                <Button onClick={handleSendEmail}><Mail className="mr-2 h-4 w-4"/> Enviar por E-mail</Button>
                <Button variant="secondary" onClick={() => setShareInfo(null)}>Fechar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
