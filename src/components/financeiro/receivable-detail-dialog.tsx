// @ts-nocheck

"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AccountsReceivable } from "@/lib/data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReceiptText, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { updateAccountsReceivable, getRelatedReceivables } from "@/lib/firebase/firestore";
import { useAuth } from "@/firebase/auth/use-user";
import { AccountsReceivable } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Calendar, Edit2, Wallet, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";



type ReceivableDetailDialogProps = {
    isOpen: boolean;
    setOpen: (isOpen: boolean) => void;
    receivable: AccountsReceivable | null;
};

const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
        const date = parseISO(dateString);
        return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (e) {
        return "Data Inválida";
    }
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(amount);
};

export default function ReceivableDetailDialog({ isOpen, setOpen, receivable }: ReceivableDetailDialogProps) {
    const { firebase } = useAuth();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [editAmount, setEditAmount] = useState<number>(0);
    const [editDueDate, setEditDueDate] = useState<string>("");
    const [editMethod, setEditMethod] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [relatedReceivables, setRelatedReceivables] = useState<AccountsReceivable[]>([]);

    useEffect(() => {
        if (receivable && firebase.db) {
            setEditAmount(receivable.amount);
            setEditDueDate(receivable.dueDate?.split('T')[0] || "");
            setEditMethod(receivable.method || "BOLETO");
            setIsEditing(false);

            const unsub = getRelatedReceivables(firebase.db, receivable.quoteId, (data) => {
                setRelatedReceivables(data.sort((a, b) => a.quoteNumber.localeCompare(b.quoteNumber)));
            });
            return () => unsub();
        }
    }, [receivable, firebase.db]);

    if (!receivable) return null;

    const handleSave = async () => {
        if (!firebase.db || !receivable) return;
        setIsSaving(true);
        try {
            await updateAccountsReceivable(firebase.db, receivable.id, {
                amount: editAmount,
                dueDate: editDueDate,
                method: editMethod,
            });
            toast({ title: "Sucesso!", description: "Informações da parcela atualizadas." });
            setIsEditing(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const subtotal = receivable.originalAmount || 0;
    
    // Global stats for the entire O.S.
    const osTotal = relatedReceivables.reduce((sum, r) => sum + (r.originalAmount || 0), 0) || subtotal;
    const osPaid = relatedReceivables.reduce((sum, r) => {
        const historySum = r.paymentHistory?.reduce((s, p) => s + p.amount, 0) || 0;
        // Fallback for legacy "Pago" without history
        if (r.status === 'Pago' && historySum === 0) return sum + (r.originalAmount || r.amount);
        return sum + historySum;
    }, 0);

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            <DialogContent className="max-w-4xl bg-background border border-border/40 rounded-2xl shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-8 pb-4">
                    <div className="space-y-1">
                        <DialogTitle className="text-2xl font-semibold tracking-tighter uppercase opacity-80 flex items-center gap-3">
                            <ReceiptText className="text-primary h-6 w-6" />
                            Detalhamento OS: {receivable.quoteNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-semibold uppercase tracking-widest opacity-60">
                            Fluxo de caixa e amortização: {receivable.clientName}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="p-8 pt-0 space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-xl bg-primary/5 border border-border/40">
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Total O.S.</p>
                            <p className="text-sm font-semibold text-foreground/80">{formatCurrency(osTotal)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Status Parcela</p>
                            <Badge className={cn(
                                "h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest shadow-lg shadow-black/5 border-none",
                                receivable.status === 'Pago' ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"
                            )}>
                                {receivable.status}
                            </Badge>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Total Pago (Geral)</p>
                            <p className="text-sm font-semibold text-green-500">{formatCurrency(osPaid)}</p>
                        </div>
                        <div className="space-y-1 md:col-span-2 border-l border-border/40 pl-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Saldo desta Parcela</p>
                                <Button variant="ghost" size="icon" className="h-4 w-4 opacity-40 hover:opacity-100" onClick={() => setIsEditing(!isEditing)}>
                                    <Edit2 className="h-3 w-3" />
                                </Button>
                            </div>
                            {isEditing ? (
                                <div className="space-y-3 mt-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-bold uppercase opacity-40 ml-1">Valor</p>
                                            <Input 
                                                type="number" 
                                                value={editAmount} 
                                                onChange={(e) => setEditAmount(Number(e.target.value))} 
                                                className="h-8 text-xs font-bold bg-background text-destructive"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-bold uppercase opacity-40 ml-1">Vencimento</p>
                                            <Input 
                                                type="date" 
                                                value={editDueDate} 
                                                onChange={(e) => setEditDueDate(e.target.value)} 
                                                className="h-8 text-xs bg-background"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-bold uppercase opacity-40 ml-1">Forma de Pagamento Predominante</p>
                                        <Select value={editMethod} onValueChange={setEditMethod}>
                                            <SelectTrigger className="h-8 text-[10px] font-bold uppercase tracking-widest bg-background">
                                                <SelectValue placeholder="Forma de Pagamento" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PIX">PIX</SelectItem>
                                                <SelectItem value="BOLETO">BOLETO</SelectItem>
                                                <SelectItem value="DINHEIRO">DINHEIRO</SelectItem>
                                                <SelectItem value="CARTÃO_CRÉDITO">CARTÃO CRÉDITO</SelectItem>
                                                <SelectItem value="CARTÃO_DÉBITO">CARTÃO DÉBITO</SelectItem>
                                                <SelectItem value="TRANSFERÊNCIA">TRANSFERÊNCIA</SelectItem>
                                                <SelectItem value="DEPÓSITO">DEPÓSITO</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button size="sm" className="w-full h-8 text-[10px] font-bold uppercase tracking-widest mt-2" onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
                                        Salvar Alterações
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-destructive">
                                        {receivable.status === 'Pago' ? formatCurrency(0) : formatCurrency(receivable.amount)}
                                    </p>
                                    <p className="text-[10px] opacity-60 font-semibold uppercase flex items-center gap-1 mt-1">
                                        <Calendar className="h-3 w-3" /> {receivable.dueDate ? format(parseISO(receivable.dueDate.split('T')[0]), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}
                                    </p>
                                    {receivable.method && (
                                        <p className="text-[10px] opacity-60 font-semibold uppercase flex items-center gap-1 mt-0.5">
                                            <Wallet className="h-3 w-3" /> {receivable.method}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] opacity-40 ml-2">Histórico de Amortização</h4>
                        <div className="rounded-xl border border-border/40 overflow-hidden bg-background/40">
                            <ScrollArea className="h-64">
                                <Table>
                                    <TableHeader className="bg-primary/5 h-[34px]">
                                        <TableRow className="hover:bg-transparent border-none h-[34px]">
                                            <TableHead className="px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 h-[34px]">Data do Evento</TableHead>
                                            <TableHead className="text-right px-6 font-semibold uppercase tracking-widest text-[10px] opacity-40 h-[34px]">Valor Liquidado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {relatedReceivables.length > 0 ? (
                                            relatedReceivables.map((r, index) => {
                                                const isCurrent = r.id === receivable.id;
                                                return (
                                                    <TableRow key={r.id} className={cn(
                                                        "group transition-all border-border/40 h-[40px] hover:bg-primary/10",
                                                        isCurrent ? "bg-primary/5" : "opacity-80"
                                                    )}>
                                                        <TableCell className="py-0 px-6 font-semibold text-xs uppercase tracking-tight text-foreground/60">
                                                            <div className="flex flex-col">
                                                                <span className={cn(isCurrent && "text-primary font-bold")}>{r.quoteNumber}</span>
                                                                <span className="text-[9px] opacity-60">
                                                                    Vencimento: {formatDate(r.dueDate)} 
                                                                    <span className="ml-2 font-bold text-primary/60">
                                                                        • {r.method || r.paymentHistory?.[0]?.method || 'A definir'}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-0 text-right px-6 font-semibold text-xs tracking-tighter">
                                                            <div className="flex flex-col items-end">
                                                                <span className={cn(
                                                                    r.status === 'Pago' ? "text-green-600" : "text-destructive"
                                                                )}>
                                                                    {r.status === 'Pago' ? formatCurrency(r.originalAmount || 0) : formatCurrency(r.amount)}
                                                                </span>
                                                                <Badge variant="outline" className={cn(
                                                                    "text-[8px] uppercase tracking-tighter h-4 px-1 mt-0.5",
                                                                    r.status === 'Pago' ? "bg-green-500/10 text-green-600 border-green-200" : "bg-primary/5 text-primary"
                                                                )}>
                                                                    {r.status}
                                                                </Badge>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={2} className="py-0 h-40 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                                        <ReceiptText className="h-10 w-10" />
                                                        <span className="font-semibold uppercase tracking-widest text-[10px]">Carregando amortização...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
