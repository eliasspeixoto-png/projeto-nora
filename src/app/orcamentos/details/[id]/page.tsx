
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { getQuote, getClient, getCompany, updateQuote } from "@/lib/firebase/firestore";
import type { Quote, Client, Company } from "@/lib/data";
import { Loader2, Printer, ArrowLeft, FileDown, Percent, MessageSquare, XCircle, ImageIcon, RotateCcw, RotateCw, Share2, Mail, Copy, Check, Eye, Shield, HardHat, Info, Send, Smartphone, Edit, MapPin, Tag, Calendar, User, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import FenceVisualizer from "@/components/orcamentos/fence-visualizer";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/firebase/auth/use-user";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ComodatoProposalContent from "./ComodatoProposalContent";
import { cn } from "@/lib/utils";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendQuoteEmailAction } from "@/app/actions/email-actions";

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

const statusLabels: Record<string, { label: string; color: string }> = {
    'draft': { label: 'Rascunho', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    'sent': { label: 'Enviado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'Aprovado': { label: 'Aprovado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    'rejected': { label: 'Recusado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    'revision-pending': { label: 'Revisão Pendente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    'Pendente': { label: 'Pendente', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    'Em Execução': { label: 'Em Execução', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
    'Finalizado': { label: 'Finalizado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};


const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(amount);
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
};

const formatFullAddress = (client: Client) => {
    if (client.address) return client.address; // Fallback for old data
    const parts = [
        client.street,
        client.number,
        client.neighborhood,
        client.city,
        client.state
    ].filter(Boolean); // Remove empty parts
    if (parts.length === 0) return 'Endereço não informado';

    let address = '';
    if (client.street) address += `${client.street}`;
    if (client.number) address += `, ${client.number}`;
    if (client.neighborhood) address += ` - ${client.neighborhood}`;
    if (client.city) address += `. ${client.city}`;
    if (client.state) address += `/${client.state}`;

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

const QuoteContent = ({ quote, client, company }: { quote: Quote, client: Client | null, company: Company | null }) => {
    const totalMaterials = quote.items.reduce((sum, item) => 
        sum + ((item as any).includeMaterial !== false ? (item.materialPrice * item.quantity) : 0), 0);
    const totalServices = quote.items.reduce((sum, item) => 
        sum + ((item as any).includeService !== false ? ((item.servicePrice || 0) * item.quantity) : 0), 0);
    const subtotal = totalMaterials + totalServices;
    const discountAmount = (subtotal * (quote.discount || 0)) / 100;
    const totalAfterDiscount = subtotal - discountAmount;

    const totalWithInterest = subtotal * (1 + ((quote.interestRate || 0) / 100));

    return (
        <div id="quote-to-print" className={cn("relative max-w-4xl mx-auto bg-white text-black p-4 md:p-8 rounded-lg shadow-sm font-sans overflow-hidden printable-page")}>
            <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none z-0 transform -rotate-45 scale-100"
                style={{
                    backgroundImage: company?.logoUrl ? `url(${company.logoUrl})` : 'none',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: 'contain'
                }}
            ></div>
            {/* Header */}
            <div className="relative z-10">
                <header className="flex justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        {company?.logoUrl && (
                            <div className="relative w-24 h-16">
                                <Image src={company.logoUrl} alt={company.name || 'Logo da empresa'} fill style={{ objectFit: 'contain' }} />
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-semibold text-blue-600 print:text-black">{quote.quoteNumber}</p>
                            <p className="text-xs text-gray-500 print:text-black">Data: {formatDate(quote.date)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h1 className="text-xl font-semibold text-blue-600 print:text-black">{company?.name}</h1>
                        <p className="text-xs text-gray-500 print:text-black">{company?.cnpj}</p>
                        <p className="text-xs text-gray-500 print:text-black">{`${company?.street || ''}, ${company?.number || ''} - ${company?.city || ''}/${company?.state || ''}`}</p>
                        <p className="text-xs text-gray-500 print:text-black">{`WhatsApp: ${company?.whatsapp || company?.phone} | Telefone: ${company?.phone} | E-mail: ${company?.email}`}</p>
                    </div>
                </header>

                {client && (
                    <div className="mb-6 border-t pt-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 print:text-black">
                            <div><span className="font-semibold text-black print:text-black">Cliente: </span>{client.name}</div>
                            <div><span className="font-semibold text-black print:text-black">CPF/CNPJ: </span>{client.document}</div>
                            <div><span className="font-semibold text-black print:text-black">Telefone: </span>{client.phone}</div>
                            <div><span className="font-semibold text-black print:text-black">WhatsApp: </span>{client.whatsapp || client.phone}</div>
                            <div className="col-span-2"><span className="font-semibold text-black print:text-black">Endereço: </span>{formatFullAddress(client)}</div>
                        </div>
                    </div>
                )}


                {/* Items */}
                <div className="mb-6">
                    <h3 className="text-base font-semibold mb-2 border-b pb-1">Itens e Serviços</h3>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50 print:bg-gray-100 h-[34px]">
                                    <TableHead className="py-2 px-1 w-8 text-center text-[10px] uppercase font-semibold h-[34px]">#</TableHead>
                                    <TableHead className="py-2 px-2 text-[10px] uppercase font-semibold h-[34px]">Item / Descrições</TableHead>
                                    <TableHead className="text-center w-[10%] py-2 px-1 text-[10px] uppercase font-semibold h-[34px]">Qtd.</TableHead>
                                    <TableHead className="text-right w-[15%] py-2 px-1 text-[10px] uppercase font-semibold h-[34px]">Val. Material</TableHead>
                                    <TableHead className="text-right w-[15%] py-2 px-1 text-[10px] uppercase font-semibold h-[34px]">Val. Serviço</TableHead>
                                    <TableHead className="text-right w-[15%] py-2 px-2 text-[10px] uppercase font-semibold h-[34px]">Subtotal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quote.items.map((item, index) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="py-0 text-center font-mono text-xs text-gray-400 p-1 w-8 print:text-black">{index + 1}</TableCell>
                                        <TableCell className="py-0 px-2" style={{ fontSize: '0.75rem' }}>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-800 print:text-black">{formatProductName((item.product as any)?.description || (item as any).description || (item as any).productDescription)}</span>
                                                <span className="text-[10px] text-gray-400 font-mono print:text-black">{(item.product as any)?.item || (item as any).productCode || '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 text-center px-1 text-xs">{formatQuantity(item.quantity)} {(item.product as any)?.unit || (item as any).unit || 'UNID'}</TableCell>
                                        <TableCell className={cn("py-0 text-right px-1 text-xs whitespace-nowrap", (item as any).includeMaterial === false && "text-gray-300 line-through")}>{formatCurrency(item.materialPrice * item.quantity)}</TableCell>
                                        <TableCell className={cn("py-0 text-right px-1 text-xs whitespace-nowrap", (item as any).includeService === false && "text-gray-300 line-through")}>{formatCurrency((item.servicePrice || 0) * item.quantity)}</TableCell>
                                        <TableCell className="py-0 text-right px-2 text-xs font-semibold whitespace-nowrap">{formatCurrency(item.total)}</TableCell>
                                    </TableRow>
                                ))}
                                {quote.items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-0 text-center text-gray-500 italic">Nenhum item adicionado.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-4 items-end">
                    <p className="text-[11px] text-gray-400 print:text-black italic self-start">
                        * Proposta válida por 30 dias.
                    </p>
                    <div className="flex flex-col items-end gap-1 text-right bg-slate-50/50 p-3 rounded-lg border border-slate-100 print:bg-white print:border-none">
                        <div className="text-xs text-gray-600 flex justify-between w-full max-w-[200px]">
                            <span>Total Materiais:</span>
                            <span className="font-medium text-black">{formatCurrency(totalMaterials)}</span>
                        </div>
                        <div className="text-xs text-gray-600 flex justify-between w-full max-w-[200px]">
                            <span>Total Serviços:</span>
                            <span className="font-medium text-black">{formatCurrency(totalServices)}</span>
                        </div>
                        <div className="text-sm font-semibold flex justify-between w-full max-w-[200px] border-t border-slate-200 mt-1 pt-1">
                            <span>Subtotal:</span>
                            <span className="ml-4 font-semibold">{formatCurrency(subtotal)}</span>
                        </div>
                        {(quote.discount || 0) > 0 && (
                            <div className="text-xs text-red-600 flex justify-between w-full max-w-[200px]">
                                <span>Desconto ({quote.discount}%):</span>
                                <span className="ml-4">-{formatCurrency(discountAmount)}</span>
                            </div>
                        )}

                        <div className="text-lg font-semibold mt-2 text-primary flex justify-between w-full max-w-[220px] bg-primary/5 p-2 rounded print:bg-white print:text-black print:p-0">
                            <span className="text-xs uppercase tracking-wider self-center text-primary/70">Total à Vista:</span>
                            <span className="ml-4">{formatCurrency(totalAfterDiscount)}</span>
                        </div>

                        {((quote.installments || 1) > 1) && (
                            <div className="mt-2 text-right">
                                <div className="text-sm font-semibold text-gray-700">
                                    Total a prazo: {formatCurrency(totalWithInterest)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    ou {quote.installments}x de <span className="font-semibold text-black">{formatCurrency(totalWithInterest / (quote.installments || 1))}</span>
                                    {(quote.interestRate || 0) > 0 && <span> (com juros de {quote.interestRate}%)</span>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Visualização da Cerca (Se aplicável) */}
                {quote.serviceType === 'Cerca Elétrica' && quote.fenceDetails && (
                    <div className="mt-10 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-600 print:text-black" />
                            Especificações Técnicas da Instalação
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6 items-start">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <Card className="bg-gray-50/50 border-gray-100 shadow-none">
                                        <CardContent className="p-2.5">
                                            <p className="text-[8px] text-gray-500 uppercase font-semibold mb-1">Canto (Castanha)</p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-lg font-semibold">{quote.fenceDetails.postCounts?.corner || 0}</p>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(220, 48%, 48%)' }} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gray-50/50 border-gray-100 shadow-none">
                                        <CardContent className="p-2.5">
                                            <p className="text-[8px] text-gray-500 uppercase font-semibold mb-1">Passagem (Reta)</p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-lg font-semibold">{quote.fenceDetails.postCounts?.passage || 0}</p>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(54, 91%, 56%)' }} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gray-50/50 border-gray-100 shadow-none">
                                        <CardContent className="p-2.5">
                                            <p className="text-[8px] text-gray-500 uppercase font-semibold mb-1">Hastes Tipo W</p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-lg font-semibold">{quote.fenceDetails.postCounts?.w || 0}</p>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gray-50/50 border-gray-100 shadow-none">
                                        <CardContent className="p-2.5">
                                            <p className="text-[8px] text-gray-500 uppercase font-semibold mb-1">Adic. / Desnível</p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-lg font-semibold">
                                                    {(quote.fenceDetails.additionalPosts || 0) + (quote.fenceDetails.numberOfSteps || 0)}
                                                </p>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(347, 77%, 50%)' }} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="p-3 bg-blue-50/30 rounded-lg border border-blue-100/50 space-y-1.5 text-[10px]">
                                    <p className="flex justify-between border-b border-blue-100 pb-1">
                                        <span className="text-gray-600">Perímetro Total:</span>
                                        <span className="font-semibold">{quote.fenceDetails.segments.reduce((a, b) => a + b, 0).toFixed(1)}m</span>
                                    </p>
                                    <p className="flex justify-between border-b border-blue-100 pb-1">
                                        <span className="text-gray-600">Tipo de Haste:</span>
                                        <span className="font-semibold uppercase">{quote.fenceDetails.rodType || 'N/A'}</span>
                                    </p>
                                    <p className="flex justify-between border-b border-blue-100 pb-1">
                                        <span className="text-gray-600">Instalação:</span>
                                        <span className="font-semibold uppercase">{quote.fenceDetails.installationType || 'N/A'}</span>
                                    </p>
                                    <p className="flex justify-between">
                                        <span className="text-gray-600">Voltagem:</span>
                                        <span className="font-semibold">{quote.fenceDetails.voltage || 'N/A'}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="h-[320px] w-full border rounded-xl overflow-hidden bg-gray-50/30">
                                <FenceVisualizer
                                    shape={quote.fenceDetails.shape as any}
                                    dimensions={quote.fenceDetails.dimensions}
                                    segments={quote.fenceDetails.segments}
                                    interactive={false}
                                    additionalPosts={quote.fenceDetails.additionalPosts}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-12 text-center text-xs text-gray-500 print:text-black">
                    <p>Agradecemos a sua preferência!</p>
                </footer>
            </div>
        </div>
    )
}


export default function QuoteDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { userProfile, firebase } = useAuth();
    const { toast } = useToast();
    const quoteId = params?.id as string;

    const [quote, setQuote] = useState<Quote | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isImageModalOpen, setImageModalOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [imageRotation, setImageRotation] = useState(0);

    const [isSharing, setIsSharing] = useState(false);
    const [isEmailSending, setIsEmailSending] = useState(false);
    const [isStatusUpdating, setIsStatusUpdating] = useState(false);
    const [shareInfo, setShareInfo] = useState<{ url: string; message: string; clientName: string; clientEmail?: string; clientPhone?: string; quoteNumber: string; } | null>(null);
    const pdfRef = useRef<HTMLDivElement>(null);

    const handleStatusChange = async (newStatus: Quote['status']) => {
        if (!quote || !firebase.db || !firebase.auth) return;
        
        setIsStatusUpdating(true);
        try {
            await updateQuote(firebase.db, firebase.auth, quote.id, { status: newStatus });
            setQuote(prev => prev ? { ...prev, status: newStatus } : null);
            toast({ title: "Status Atualizado", description: `O orçamento agora está como ${statusLabels[newStatus || 'draft']?.label}` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao atualizar", description: e.message });
        } finally {
            setIsStatusUpdating(false);
        }
    };

    useEffect(() => {
        if (!quoteId || !firebase.db) return;

        const fetchQuoteData = async () => {
            setIsLoading(true);
            const { db } = firebase;
            const fetchedQuote = await getQuote(db, quoteId);
            setQuote(fetchedQuote);

            if (fetchedQuote && fetchedQuote.clientId) {
                const fetchedClient = await getClient(db, fetchedQuote.clientId);
                setClient(fetchedClient);
            }

            if (fetchedQuote?.companyId) {
                const fetchedCompany = await getCompany(db, fetchedQuote.companyId);
                setCompany(fetchedCompany);
            }

            setIsLoading(false);
        };

        fetchQuoteData();
    }, [quoteId, userProfile?.companyId, firebase.db]);

    const handlePrint = () => {
        window.print();
    };

    const generatePdfUrl = async (): Promise<string> => {
        if (!quote || !client || !company || !pdfRef.current || !firebase.db || !firebase.auth) {
            throw new Error("Dados incompletos.");
        }

        const canvas = await html2canvas(pdfRef.current, {
            scale: 2,
            useCORS: true,
        });
        const pdf = new jsPDF('p', 'px', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, imgHeight);

        const pdfDataUri = pdf.output('datauristring');

        const { storage } = firebase;
        const filePath = `shared_quotes/${company.id}/${quote.quoteNumber.replace(/\//g, '-')}-${Date.now()}.pdf`;
        const storageRef = ref(storage, filePath);

        await uploadString(storageRef, pdfDataUri, 'data_url');
        const downloadUrl = await getDownloadURL(storageRef);

        if (quote.status === 'draft') {
            await updateQuote(firebase.db, firebase.auth, quote.id, { status: 'sent' });
        }

        return downloadUrl;
    }

    const handleShare = async () => {
        setIsSharing(true);
        toast({ title: 'Gerando PDF para compartilhamento...', description: 'Aguarde um momento, estamos preparando o orçamento.' });

        try {
            const downloadUrl = await generatePdfUrl();
            const message = `Olá ${client!.name}, segue o orçamento solicitado pela ${company!.name}:\n${downloadUrl}`;

            setShareInfo({
                url: downloadUrl,
                message: message,
                clientName: client!.name,
                clientEmail: client!.email,
                clientPhone: client!.whatsapp || client!.phone,
                quoteNumber: quote!.quoteNumber,
            });

            toast({ title: 'Pronto!', description: 'Seu PDF foi gerado e está pronto para ser enviado.' });

        } catch (e: any) {
            console.error("Share error:", e);
            toast({ variant: 'destructive', title: 'Erro ao Compartilhar', description: e.message || 'Não foi possível gerar ou enviar o PDF.' });
        } finally {
            setIsSharing(false);
        }
    };

    const handleSendEmailSendGrid = async () => {
        if (!client?.email) {
            toast({ variant: 'destructive', title: "Erro", description: "Cliente não possui e-mail cadastrado." });
            return;
        }

        setIsEmailSending(true);
        toast({ title: "Enviando e-mail profissional...", description: "Preparando orçamento para disparo via SendGrid." });

        try {
            const pdfUrl = await generatePdfUrl();

            const result = await sendQuoteEmailAction({
                to: client.email,
                clientName: client.name,
                companyName: company!.name,
                quoteNumber: quote!.quoteNumber,
                pdfUrl: pdfUrl
            });

            if (result.success) {
                toast({ title: "E-mail Enviado!", description: `O orçamento foi enviado com sucesso para ${client.email}` });
            } else {
                throw new Error(result.error);
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Falha no Envio", description: e.message || "Erro desconhecido ao enviar e-mail." });
        } finally {
            setIsEmailSending(false);
        }
    };

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
            toast({ variant: "destructive", title: "Erro", description: "Cliente não possui um número de WhatsApp ou telefone cadastrado." });
        }
    };

    const handleSendEmailMailto = () => {
        if (!shareInfo) return;
        if (shareInfo.clientEmail) {
            const subject = `Orçamento ${shareInfo.quoteNumber} - ${company?.name}`;
            const mailtoUrl = `mailto:${shareInfo.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareInfo.message)}`;
            window.open(mailtoUrl);
        } else {
            toast({ variant: "destructive", title: "Erro", description: "Cliente não possui um email cadastrado." });
        }
    };

    const handleImageClick = (imageUrl: string) => {
        setSelectedImageUrl(imageUrl);
        setImageRotation(0);
        setImageModalOpen(true);
    };

    const rotateImage = (direction: 'left' | 'right') => {
        if (direction === 'right') {
            setImageRotation(prev => (prev + 90) % 360);
        } else {
            setImageRotation(prev => (prev - 90 + 360) % 360);
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-lg border shadow-sm m-6">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!quote) {
        return (
            <div className="flex flex-1 items-center justify-center text-destructive m-6">
                Orçamento não encontrado.
            </div>
        );
    }

    const renderContent = () => {
        if (quote.serviceType === 'Comodato' && client && company) {
            return <ComodatoProposalContent quote={quote} client={client} company={company} />;
        }
        return <QuoteContent quote={quote} client={client} company={company} />;
    };


    return (
        <>
            <main className="flex-1 p-2 md:p-8 bg-muted">
                <div id="printable-content">
                    <div className="max-w-4xl mx-auto">
                        <div id="print-actions" className="no-print flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-card p-4 rounded-xl shadow-sm border border-border/40">
                            <div className="flex items-center gap-3">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" disabled={isStatusUpdating} className={cn(
                                            "font-bold uppercase tracking-widest text-[10px] px-4 rounded-full border-none shadow-sm h-8 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                        )}>
                                            {isStatusUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <div className={cn("w-2 h-2 rounded-full mr-2 animate-pulse bg-white")} />}
                                            Status: {statusLabels[quote.status || 'draft']?.label}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                        {Object.entries(statusLabels).map(([key, value]) => (
                                            <DropdownMenuItem 
                                                key={key} 
                                                onClick={() => handleStatusChange(key as Quote['status'])}
                                                className={cn("text-xs font-semibold", quote.status === key && "bg-primary/10")}
                                            >
                                                <div className={cn("w-2 h-2 rounded-full mr-2", value.color.split(' ')[0])} />
                                                {value.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => router.back()}>
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Voltar
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => {
                                    if (quote.serviceType === 'Comodato') {
                                        router.push(`/comodato/proposta?id=${quote.id}`);
                                    } else {
                                        router.push(`/orcamentos/editar/${quote.id}`);
                                    }
                                }}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    {quote.serviceType === 'Comodato' ? 'Editar Proposta' : 'Editar Orçamento'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handlePrint}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Imprimir
                                </Button>
                                {quote.cftvDetails && (
                                    <Button variant="outline" size="sm" onClick={() => router.push(`/orcamentos/cftv/${quote.id}`)}>
                                        <Eye className="mr-2 h-4 w-4" /> Ver Planta Baixa
                                    </Button>
                                )}

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" disabled={isSharing || isEmailSending} className="bg-primary hover:bg-primary/90 shadow-glow-primary">
                                            {isSharing || isEmailSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                                            Compartilhar
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={handleShare}>
                                            <Smartphone className="mr-2 h-4 w-4" /> Compartilhar Link (WhatsApp)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleSendEmailSendGrid}>
                                            <Mail className="mr-2 h-4 w-4" /> Enviar por E-mail
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {renderContent()}

                        {/* Bloco de Relatório de Execução Técnica da O.S. */}
                        {(quote.notes || (quote.serviceImages && quote.serviceImages.length > 0) || quote.completionLocation || quote.assignedTechnicianName) && (
                            <div className="max-w-4xl mx-auto bg-card p-4 md:p-8 rounded-lg shadow-sm mt-6 space-y-6 print:break-before-page border border-border/40">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                                            <HardHat className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                                Relatório Técnico de Execução
                                                {quote.unitIdentifier && (
                                                    <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20">
                                                        <Tag className="h-3 w-3 mr-1" /> {quote.unitIdentifier}
                                                    </Badge>
                                                )}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">Informações de campo registradas pela equipe técnica</p>
                                        </div>
                                    </div>
                                    {quote.status === 'Finalizado' && (
                                        <Badge className="bg-emerald-600 text-white font-bold px-3 py-1 self-start sm:self-auto flex items-center gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Serviço Finalizado
                                        </Badge>
                                    )}
                                </div>

                                {/* Dados da Equipe e Datas */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5 text-primary" /> Técnico Responsável
                                        </span>
                                        <p className="font-bold text-sm text-foreground/90">
                                            {quote.assignedTechnicianName || 'Não atribuído'}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-primary" /> Início do Atendimento
                                        </span>
                                        <p className="font-bold text-sm text-foreground/90">
                                            {quote.scheduledDate ? `${new Date(`${quote.scheduledDate}T00:00:00`).toLocaleDateString('pt-BR')} às ${quote.scheduledTime || '09:00'}` : 'Não agendado'}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-primary" /> Conclusão do Serviço
                                        </span>
                                        <p className="font-bold text-sm text-blue-600 dark:text-blue-400">
                                            {quote.completionDate ? new Date(quote.completionDate).toLocaleString('pt-BR') : (quote.expectedEndDate ? `Previsão: ${new Date(`${quote.expectedEndDate}T00:00:00`).toLocaleDateString('pt-BR')}` : 'Em andamento')}
                                        </p>
                                    </div>
                                </div>

                                {/* Texto do Parecer / Relatório Técnico */}
                                {quote.notes && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                                            <MessageSquare className="h-3.5 w-3.5 text-primary" /> Parecer Técnico & Observações do Serviço
                                        </Label>
                                        <div className="p-4 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap font-medium">
                                                {quote.notes}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* GPS de Conclusão */}
                                {quote.completionLocation && (
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/40">
                                        <div className="flex items-center gap-2 text-xs">
                                            <MapPin className="h-4 w-4 text-destructive shrink-0" />
                                            <span>
                                                Localização GPS registrada no encerramento: <strong>{quote.completionLocation.latitude.toFixed(6)}, {quote.completionLocation.longitude.toFixed(6)}</strong>
                                            </span>
                                        </div>
                                        <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${quote.completionLocation.latitude},${quote.completionLocation.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0 ml-2"
                                        >
                                            Abrir no Google Maps ↗
                                        </a>
                                    </div>
                                )}

                                {/* Fotos Anexadas pelo Técnico */}
                                {quote.serviceImages && quote.serviceImages.length > 0 && (
                                    <div className="space-y-3 pt-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                                                <ImageIcon className="h-4 w-4 text-primary" /> Fotos do Serviço Executado ({quote.serviceImages.length})
                                            </Label>
                                            <span className="text-[10px] text-muted-foreground">Clique para ampliar ou girar</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                                            {quote.serviceImages.map((imageUrl, index) => (
                                                <div 
                                                    key={index} 
                                                    className="relative aspect-square cursor-pointer rounded-xl border border-border/40 overflow-hidden group shadow-sm hover:scale-105 transition-all bg-background" 
                                                    onClick={() => handleImageClick(imageUrl)}
                                                >
                                                    <Image src={imageUrl} alt={`Serviço executado ${index + 1}`} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 50vw, 33vw" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center print:hidden">
                                                        <Eye className="text-white h-6 w-6" />
                                                    </div>
                                                    <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
                                                        Foto #{index + 1}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Dialog open={isImageModalOpen} onOpenChange={setImageModalOpen}>
                <DialogContent className="max-w-4xl h-auto flex flex-col p-2">
                    <DialogTitle className="sr-only">Visualização de Imagem</DialogTitle>
                    {selectedImageUrl && (
                        <div
                            className="relative w-full h-full min-h-[80vh] transition-transform duration-300"
                            style={{ transform: `rotate(${imageRotation}deg)` }}
                        >
                            <Image src={selectedImageUrl} alt="Visualização da Imagem" fill style={{ objectFit: "contain" }} />
                        </div>
                    )}
                    <DialogFooter className="flex-row justify-center sm:justify-center pt-2 gap-2">
                        <Button onClick={() => rotateImage('left')} variant="outline">
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Girar para Esquerda
                        </Button>
                        <Button onClick={() => rotateImage('right')} variant="outline">
                            <RotateCw className="mr-2 h-4 w-4" />
                            Girar para Direita
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div
                ref={pdfRef}
                className="absolute -left-[9999px] top-0 p-8"
                style={
                    {
                        width: '800px', // Aprox. A4 width
                    } as React.CSSProperties
                }
            >
                {quote && client && company &&
                    (quote.serviceType === 'Comodato'
                        ? <ComodatoProposalContent quote={quote} client={client} company={company} />
                        : <QuoteContent quote={quote} client={client} company={company} />
                    )
                }
            </div>

            <Dialog open={!!shareInfo} onOpenChange={(isOpen) => !isOpen && setShareInfo(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Compartilhar Orçamento {shareInfo?.quoteNumber}</DialogTitle>
                        <DialogDescription>Seu link para o PDF do orçamento está pronto para ser enviado para {shareInfo?.clientName}.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="share-link">Link do PDF</Label>
                        <div className="flex items-center gap-2">
                            <Input id="share-link" value={shareInfo?.url || ''} readOnly />
                            <Button size="icon" variant="outline" onClick={handleCopyShareLink}><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-start gap-2">
                        <Button onClick={handleSendWhatsApp}><WhatsAppIcon className="mr-2 h-4 w-4" /> Enviar por WhatsApp</Button>
                        <Button onClick={handleSendEmailMailto}><Mail className="mr-2 h-4 w-4" /> Enviar por E-mail</Button>
                        <Button variant="secondary" onClick={() => setShareInfo(null)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
