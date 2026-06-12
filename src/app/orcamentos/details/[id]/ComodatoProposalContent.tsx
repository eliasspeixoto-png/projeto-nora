
"use client";

import Image from "next/image";
import type { Quote, Client, Company } from "@/lib/data";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, FileDown, X, FileText, Download, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { generateWordDocument } from "@/lib/word-generator";
import { processContractTemplate } from "@/app/services/contractService";
import { Packer } from "docx";
import { saveAs } from "file-saver";
import { cn } from "@/lib/utils";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { updateQuote } from "@/lib/firebase/firestore";
import { useAuth } from "@/firebase/auth/use-user";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


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

const formatFullAddress = (entity: Client | Company) => {
    if (!entity) return 'Endereço não informado';
    const parts = [
        (entity as Client).street || (entity as Company).street, 
        entity.number, 
        entity.neighborhood, 
        entity.city, 
        entity.state
    ].filter(Boolean);
    if (parts.length === 0) return 'Endereço não informado';
    let address = `${(entity as Client).street || (entity as Company).street || ''}`;
    if (entity.number) address += `, ${entity.number}`;
    if (entity.neighborhood) address += ` - ${entity.neighborhood}`;
    if (entity.city) address += `. ${entity.city}`;
    if (entity.state) address += `/${entity.state}`;
    return address;
};

const formatProductName = (name: string) => {
    if (!name) return '';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

type ComodatoProposalProps = {
    quote: Quote;
    client: Client;
    company: Company;
    isDialog?: boolean;
    onClose?: () => void;
}

export default function ComodatoProposalContent({ quote, client, company, isDialog = false, onClose }: ComodatoProposalProps) {
    const { toast } = useToast();
    const { firebase } = useAuth();
    const router = useRouter();
    const [isGenerating, setIsGenerating] = useState(false);
    const monthlyFee = quote.comodatoMonthlyFee || 0;
    const installationCost = quote.installationFee !== undefined 
        ? quote.installationFee 
        : (quote.fenceDetails?.installationLaborCost ?? (quote.items || []).reduce((sum, item) => sum + (item.servicePrice || 0) * item.quantity, 0));
    const comodatoType = quote.comodatoType || 'Real';

    const preventiveFrequency = quote.fenceDetails?.preventiveVisitsPerYear || 4;
    const monthsPerVisit = 12 / (preventiveFrequency > 0 ? preventiveFrequency : 1);


    const handleGenerateContract = async (forceNew = false) => {
        if (!forceNew && quote.contractUrl) {
            toast({
                title: "Contrato já existente",
                description: "Este contrato já foi gerado. Abrindo o documento existente...",
                duration: 5000,
            });
            window.open(quote.contractUrl, '_blank');
            return;
        }

        setIsGenerating(true);
        try {
            const template = company.comodatoContractTemplate;
            if (!template) {
                toast({
                    title: 'Modelo de Contrato não encontrado',
                    description: 'Acesse Customizações > Modelos para criar seu modelo de contrato de comodato.',
                    variant: 'destructive',
                    duration: 8000,
                });
                setIsGenerating(false);
                return;
            }

            const contractText = processContractTemplate(template, company, client, quote);
            
            let logoBuffer: ArrayBuffer | undefined = undefined;

            if (company.logoUrl) {
                try {
                    const response = await fetch(company.logoUrl);
                    if (response.ok) {
                        logoBuffer = await response.arrayBuffer();
                    }
                } catch(e) { console.error("Could not fetch logo", e)}
            }
            
            const doc = await generateWordDocument(contractText, quote, logoBuffer);
            const blob = await Packer.toBlob(doc);
            
            // Upload to Firebase Storage
            if (!firebase.storage || !company?.id) {
                throw new Error("Configuração de armazenamento ou ID da empresa não encontrados.");
            }
            const filePath = `contracts/${company.id}/${quote.quoteNumber.replace('/', '-')}-${Date.now()}.docx`;
            const storageRef = ref(firebase.storage, filePath);
            const uploadResult = await uploadBytes(storageRef, blob);
            const downloadUrl = await getDownloadURL(uploadResult.ref);

            // Deletar contrato antigo do Storage se existir
            if (forceNew && quote.contractUrl) {
                try {
                    const oldContractRef = ref(firebase.storage, quote.contractUrl);
                    await deleteObject(oldContractRef);
                    console.log("Contrato antigo excluído do Storage.");
                } catch (e) {
                    console.error("Erro ao excluir contrato antigo:", e);
                }
            }

            // Update Firestore document with the URL and contract status
            await updateQuote(firebase.db, firebase.auth, quote.id, {
                contractUrl: downloadUrl,
                contractStatus: 'ativo', // Set to 'ativo' on creation
                contractDate: new Date().toISOString(),
            });
            
            saveAs(blob, `Contrato_Comodato_${client.name.replace(/\s/g, '_')}.docx`);
            toast({ title: "Sucesso!", description: "Contrato gerado e salvo no sistema." });

        } catch (error: any) {
            console.error("Error generating contract:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar contrato', description: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };
    
    return (
        <div id="quote-to-print" className={cn("relative w-full mx-auto bg-white text-black p-4 md:p-8 font-sans overflow-hidden printable-page")}>
             <div 
                className="absolute inset-0 opacity-[0.04] pointer-events-none z-0 transform -rotate-45 scale-100"
                style={{
                  backgroundImage: company?.logoUrl ? `url(${company.logoUrl})` : 'none',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundSize: 'contain'
                }}
            ></div>
            <div className="relative z-10">
                <header className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        {company?.logoUrl && (
                            <div 
                                className="relative w-24 h-24 bg-no-repeat bg-contain bg-center"
                                style={{ 
                                  backgroundImage: `url(${company.logoUrl})`
                                }}
                            ></div>
                        )}
                        <div>
                            <h1 className="text-xl font-semibold text-blue-600 print:text-black">{company?.name}</h1>
                            <p className="text-xs text-gray-500 print:text-black">{company?.cnpj}</p>
                            <p className="text-xs text-gray-500 print:text-black">{`${company?.street || ''}, ${company?.number || ''} - ${company?.city || ''}/${company?.state || ''}`}</p>
                            <p className="text-xs text-gray-500 print:text-black">{`Telefone: ${company?.phone} | E-mail: ${company?.email}`}</p>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-lg font-semibold">Proposta de Comodato</p>
                        <p className="text-sm font-semibold text-blue-600 print:text-black">{quote.quoteNumber}</p>
                        <p className="text-xs text-gray-500 print:text-black">Data: {formatDate(quote.date)}</p>
                    </div>
                </header>
                
                <div id="comodato-proposal-actions" className="my-4 flex justify-end gap-2 no-print">
                    {isDialog && (<Button variant="outline" size="sm" onClick={onClose}><X className="mr-2"/>Cancelar</Button>)}
                    {quote.contractUrl && (
                        <Button variant="outline" size="sm" onClick={() => handleGenerateContract(true)} disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                            Gerar Novamente
                        </Button>
                    )}
                    <Button size="sm" onClick={() => handleGenerateContract(false)} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>}
                        {quote.contractUrl ? "Baixar Contrato" : "Gerar Contrato"}
                    </Button>
                </div>

                <div className="mb-6 border-t pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div><span className="font-semibold">Cliente:</span> {quote.clientName}</div>
                        <div><span className="font-semibold">CPF/CNPJ:</span> {client.document}</div>
                        <div className="col-span-2"><span className="font-semibold">Endereço:</span> {formatFullAddress(client)}</div>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-base font-semibold mb-2 border-b pb-1">1. Objetivo</h3>
                    <p className="text-sm leading-relaxed">
                        {comodatoType === 'Real' ? (
                            `Esta proposta detalha a locação de um sistema completo de segurança eletrônica, incluindo equipamentos, instalação, e manutenção contínua, sob o regime de comodato. Os equipamentos permanecem propriedade da ${company.name} durante todo o contrato.`
                        ) : (
                            `Esta proposta detalha a prestação de serviços de monitoramento e manutenção de segurança eletrônica para equipamentos já pertencentes ao cliente, incluindo a taxa de ativação e configuração do sistema.`
                        )}
                    </p>
                </div>

                <div className="mb-6">
                    <h3 className="text-base font-semibold mb-2 border-b pb-1">
                        {comodatoType === 'Real' ? '2. EQUIPAMENTOS INCLUSOS NO COMODATO:' : '2. EQUIPAMENTOS MONITORADOS:'}
                    </h3>
                    {(quote.items && quote.items.length > 0) ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="py-1 px-2 text-left font-semibold h-[34px]" style={{ fontSize: '10px' }}>Item</TableHead>
                                    <TableHead className="py-1 px-2 text-right font-semibold h-[34px]" style={{ fontSize: '10px' }}>Cód.</TableHead>
                                    <TableHead className="py-1 px-2 text-center font-semibold h-[34px]" style={{ fontSize: '10px' }}>Qtd.</TableHead>
                                    <TableHead className="py-1 px-2 text-left font-semibold h-[34px]" style={{ fontSize: '10px' }}>Unid.</TableHead>
                                    <TableHead className="py-1 px-2 text-left font-semibold h-[34px]" style={{ fontSize: '10px' }}>Produto</TableHead>
                                    <TableHead className="py-1 px-2 text-right font-semibold h-[34px]" style={{ fontSize: '10px' }}>Vlr. Ref.</TableHead>
                                    <TableHead className="py-1 px-2 text-right font-semibold h-[34px]" style={{ fontSize: '10px' }}>Subtotal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quote.items.map((item, index) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="py-0 py-px px-1 text-center" style={{ fontSize: '11px' }}>{index + 1}.</TableCell>
                                        <TableCell className="py-0 py-px px-1 font-mono text-gray-400 text-right" style={{ fontSize: '11px' }}>{(item.product as any)?.item || (item as any).productCode || '-'}</TableCell>
                                        <TableCell className="py-0 py-px px-1 text-center" style={{ fontSize: '11px' }}>{item.quantity}</TableCell>
                                        <TableCell className="py-0 py-px px-1" style={{ fontSize: '11px' }}>{(item.product as any)?.unit || (item as any).unit || 'UNID'}</TableCell>
                                        <TableCell className="py-0 py-px px-1" style={{ fontSize: '11px' }}>{formatProductName((item.product as any)?.description || (item as any).description || (item as any).productDescription || "")}</TableCell>
                                        <TableCell className="py-0 py-px px-1 text-right text-gray-400" style={{ fontSize: '11px' }}>{formatCurrency(item.materialPrice)}</TableCell>
                                        <TableCell className="py-0 py-px px-1 text-right font-medium" style={{ fontSize: '11px' }}>{formatCurrency(item.materialPrice * item.quantity)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-slate-50/50 h-[34px]">
                                    <TableCell colSpan={6} className="py-0 px-2 text-right font-semibold text-xs uppercase tracking-wider">Total em Equipamentos (Referência):</TableCell>
                                    <TableCell className="py-0 px-1 text-right font-semibold text-xs">{formatCurrency(quote.items.reduce((sum, item) => sum + (item.materialPrice * item.quantity), 0))}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-xs italic text-muted-foreground border p-4 rounded-md bg-slate-50">
                            Equipamentos já instalados no local de propriedade do cliente.
                        </p>
                    )}
                </div>
                
                <div className="mb-6">
                    <h3 className="text-base font-semibold mb-2 border-b pb-1">3. Serviços Inclusos</h3>
                    <ul className="list-disc list-inside space-y-2 text-xs text-gray-500">
                        <li><b>Instalação Completa:</b> Fornecimento e instalação de todos os equipamentos listados.</li>
                        <li><b>Manutenção Preventiva:</b> Visitas técnicas programadas a cada {monthsPerVisit.toFixed(0)} meses para garantir o funcionamento ideal do sistema.</li>
                        <li><b>Manutenção Corretiva:</b> Atendimento para reparos e substituição de equipamentos defeituosos sempre que necessário, sem custo adicional de peças ou mão de obra.</li>
                        <li><b>Suporte Técnico:</b> Acesso à nossa equipe para esclarecimento de dúvidas e suporte remoto.</li>
                    </ul>
                </div>

                <div className="mb-6">
                    <h3 className="text-base font-semibold mb-2 border-b pb-1 flex items-baseline gap-2">
                        4. Nível de Serviço (SLA)
                        <span className="text-[9px] text-muted-foreground font-normal">(Acordo de Nível de Serviço)</span>
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-xs text-gray-500">
                        <li><b>Sistema parado total:</b> resolução em até 8 horas (chegada técnica e reparo).</li>
                        <li><b>Falha parcial (até 50% do sistema afetado):</b> resolução em até 24 horas.</li>
                        <li><b>Demais falhas (baixa/média):</b> resolução em até 72 horas.</li>
                        <li><b>Disponibilidade:</b> ≥ 99,5% mensal (excluindo falhas do cliente).</li>
                    </ul>
                </div>

                <div className="mb-6">
                    <h3 className="text-base font-semibold mb-2 border-b pb-1">5. Investimento</h3>
                    <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between items-center border p-3 rounded-md">
                            <span className="font-semibold">{comodatoType === 'Real' ? 'Custo de Instalação (Mão de Obra):' : 'Taxa de Ativação / Configuração:'}</span>
                            <span className="font-semibold text-lg">{formatCurrency(installationCost)}</span>
                        </div>
                        <div className="flex justify-between items-center border border-blue-200 p-3 rounded-md bg-blue-50 text-blue-800">
                            <span className="font-semibold text-blue-700">Valor Mensal do Contrato:</span>
                            <span className="font-semibold text-lg text-blue-700">{formatCurrency(monthlyFee)}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 space-y-8">
                    <div>
                        <h3 className="text-base font-semibold mb-2 border-b pb-1">6. Condições Comerciais</h3>
                        <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
                            <li>Prazo minimo do Contrato: {quote.installments} meses.</li>
                            <li>Forma de Pagamento: Boleto bancário, com vencimento 30 dias após a instalação.</li>
                            <li>Danos acidentais ou vandalismo a equipamentos ou cabos durante a vigencia do contrato cobrados à parte.</li>
                            <li>Validade da Proposta: 30 dias a contar da data de emissão.</li>
                            <li>Ao final do contrato, os equipamentos são de propriedade da {company.name}.</li>
                        </ul>
                    </div>
                </div>

                <footer className="mt-12 text-center text-xs text-gray-500 print:text-black">
                    <p>Agradecemos a sua preferência!</p>
                </footer>
            </div>
        </div>
    );
}
