
"use client";

import Image from "next/image";
import type { AccountsReceivable, Quote, Client, Company } from "@/lib/data";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// --- Funções de Formatação ---
const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' });
const formatFullAddress = (entity: Client | Company) => {
    if (!entity) return 'Endereço não informado';
    const parts = [(entity as Client).street || (entity as Company).street, entity.number, entity.neighborhood, entity.city, entity.state].filter(Boolean);
    if (parts.length === 0) return 'Endereço não informado';
    let address = `${(entity as Client).street || (entity as Company).street || ''}`;
    if (entity.number) address += `, ${entity.number}`;
    if (entity.neighborhood) address += ` - ${entity.neighborhood}`;
    if (entity.city) address += `. ${entity.city}`;
    if (entity.state) address += `/${entity.state}`;
    return address;
};
const formatQuantity = (quantity: number) => Number.isInteger(quantity) ? quantity.toFixed(0) : quantity.toFixed(2);
const numberToWords = (num: number): string => {
    const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const teens = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const tens = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    const formatGroup = (n: number): string => {
        if (n === 0) return "";
        if (n === 100) return "cem";

        let str = "";
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (h > 0) str += hundreds[h] + (t > 0 || u > 0 ? " e " : "");
        if (t === 1) str += teens[u];
        else {
            if (t > 1) str += tens[t] + (u > 0 ? " e " : "");
            if (u > 0) str += units[u];
        }
        return str;
    };

    const reais = Math.floor(num);
    const centavos = Math.round((num - reais) * 100);

    let reaisStr = "";
    if (reais === 0) reaisStr = "zero";
    else if (reais === 1) reaisStr = "um";
    else {
        const groups = [];
        let tempReais = reais;
        while(tempReais > 0) {
            groups.push(tempReais % 1000);
            tempReais = Math.floor(tempReais / 1000);
        }
        const thousands = ["", "mil", "milhão", "bilhão", "trilhão"];
        reaisStr = groups.map((g, i) => {
            if (g === 0) return "";
            const gStr = formatGroup(g);
            return `${g > 1 ? gStr : ""} ${thousands[i]}`.trim();
        }).reverse().join(" ").replace(/\s+/g, ' ').trim();
    }
    
    let centavosStr = "";
    if (centavos > 0) {
        centavosStr = " e " + formatGroup(centavos) + (centavos > 1 ? " centavos" : " centavo");
    }

    return `${reaisStr} ${reais > 1 ? "reais" : "real"}${centavosStr}`;
};

type ReceiptContentProps = {
    company: Company;
    client: Client;
    quote: Quote;
    receivable: AccountsReceivable;
}

export default function ReceiptContent({ company, client, quote, receivable }: ReceiptContentProps) {
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);

    const handleCopyPixKey = () => {
        if (!company?.pixKey) return;
        navigator.clipboard.writeText(company.pixKey).then(() => {
            setIsCopied(true);
            toast({ title: "Chave Pix copiada!", description: company.pixKey });
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const subtotal = quote.items.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = (subtotal * (quote.discount || 0)) / 100;
    const totalAfterDiscount = subtotal - discountAmount;
    
    const totalWithInterest = (quote.installments || 1) > 1 && (quote.interestRate || 0) > 0
        ? totalAfterDiscount * (1 + ((quote.interestRate || 0) / 100))
        : totalAfterDiscount;
        
    const amountInWords = numberToWords(totalWithInterest);

    return (
        <div id="receipt-screen" className="max-w-3xl mx-auto rounded-lg shadow-sm bg-card text-foreground p-6 md:p-8">
            <header className="mb-4 flex justify-between items-start gap-4 border-b pb-4">
                <div className="flex-1 space-y-1">
                    {company?.logoUrl && <div className="relative w-32 h-16 mb-1"><Image src={company.logoUrl} alt={company.name || 'Logo da empresa'} fill style={{objectFit: 'contain'}} /></div>}
                    <h2 className="font-semibold text-xl">{company.name}</h2>
                    <p className={cn("text-xs", "text-muted-foreground")}>{company.cnpj}</p>
                    <p className={cn("text-xs", "text-muted-foreground")}>{formatFullAddress(company)}</p>
                </div>
                <div className="text-right flex-1 space-y-1">
                    <div><h3 className="text-sm font-semibold">Pagador</h3><p className="text-sm font-semibold">{client.name}</p><p className={cn("text-xs", "text-muted-foreground")}>{formatFullAddress(client)}</p></div>
                    <div className="pt-2"><h1 className="font-semibold text-xl">RECIBO</h1><p className={cn("text-lg font-semibold", "text-primary")}>{formatCurrency(totalWithInterest)}</p><p className={cn("text-xs", "text-muted-foreground")}>O.S. Nº: {receivable.quoteNumber}</p></div>
                </div>
            </header>
            <p className="text-sm leading-relaxed indent-8 my-4">
                Recebi(emos) de <strong className="font-semibold">{client.name}</strong>, a importância de <strong className="font-semibold">{formatCurrency(totalWithInterest)} ({amountInWords})</strong>, referente aos produtos e serviços da Ordem de Serviço nº <strong className="font-semibold">{receivable.quoteNumber}</strong>.
            </p>
            <div className="rounded-md border overflow-x-auto my-4">
                <Table>
                    <TableHeader>
                        <TableRow className={cn("bg-muted/50")}>
                            <TableHead className="py-2 px-2 md:px-4 h-[34px]">Item</TableHead>
                            <TableHead className="text-center w-[15%] py-2 px-2 md:px-4 h-[34px]">Qtd.</TableHead>
                            <TableHead className="text-right w-[20%] py-2 px-2 md:px-4 h-[34px]">Subtotal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quote.items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="py-0 px-2 md:px-4" style={{ fontSize: '0.8rem' }}>
                                    <div className="font-medium">
                                        <span className={cn("font-mono mr-2", "text-muted-foreground")}>{item.product?.item || (item as any).productCode || ""}</span>
                                        <span>{item.product?.description || (item as any).description || (item as any).productDescription || ""}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-0 text-center px-2 md:px-4" style={{ fontSize: '0.8rem' }}>{formatQuantity(item.quantity)} {item.product?.unit || "UNID"}</TableCell>
                                <TableCell className="py-0 text-right font-medium px-2 md:px-4" style={{ fontSize: '0.8rem' }}>{formatCurrency(item.total)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {company.pixKey && (
                <div className="w-full max-w-sm space-y-2 mb-4">
                    <h4 className="font-semibold text-sm">Chave Pix para Pagamento</h4>
                    <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/50">
                        <span className="font-semibold text-sm break-all">{company.pixKey}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCopyPixKey}>
                            {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            )}
            <p className="text-sm">E por ser verdade, firmo o presente recibo.</p>
            <div className="mt-8 text-center text-xs text-muted-foreground"><p className={"text-muted-foreground"}>Recibo emitido em {formatDate(receivable.paymentDate || new Date().toISOString())}.</p></div>
            <div className="grid grid-cols-1 gap-12 pt-8 mt-4">
                <div className="text-center">
                    {company.signatureUrl ? (<div className="relative w-48 h-24 mx-auto mb-1"><Image src={company.signatureUrl} alt={`Assinatura de ${company.name}`} fill style={{objectFit: "contain"}} /></div>) : (<Separator className="bg-gray-600 mb-12"/>)}
                    <p className="mt-1 text-xs font-semibold">{company.name}</p>
                    <p className={cn("text-xs", "text-muted-foreground")}>{company.cnpj}</p>
                </div>
            </div>
        </div>
    );
}
