"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { registerOSAdvancePayment } from "@/lib/firebase/firestore";
import type { Quote } from "@/lib/data";
import { DollarSign, CreditCard, Calendar, Check, Loader2, ArrowRight, Wallet, Receipt } from "lucide-react";
import { format } from "date-fns";

type AdvancePaymentDialogProps = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  quote: Quote | null;
  onSuccess?: () => void;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

export default function AdvancePaymentDialog({ isOpen, setOpen, quote, onSuccess }: AdvancePaymentDialogProps) {
  const { firebase, userProfile } = useAuth();
  const { toast } = useToast();

  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>("");
  const [method, setMethod] = useState<string>("PIX");
  const [notes, setNotes] = useState<string>("");
  const [generateRemaining, setGenerateRemaining] = useState<boolean>(true);
  const [remainingDueDate, setRemainingDueDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && quote) {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      setDate(todayStr);
      setMethod("PIX");
      setNotes(`Adiantamento referente à O.S. ${quote.quoteNumber.replace('ORC', 'OS')}`);
      setGenerateRemaining(true);
      setRemainingDueDate(quote.expectedEndDate || quote.scheduledDate || todayStr);

      const currentAdvances = (quote.advancePayments || []).reduce((sum, a) => sum + a.amount, 0);
      const remainingBalance = Math.max(0, quote.total - currentAdvances);
      
      // Sugere metade do saldo restante ou saldo restante se for menor
      setAmount(remainingBalance > 0 ? (currentAdvances === 0 ? Math.round(remainingBalance / 2) : remainingBalance) : 0);
    }
  }, [isOpen, quote]);

  if (!quote) return null;

  const totalAdvances = (quote.advancePayments || []).reduce((sum, a) => sum + a.amount, 0);
  const currentBalance = Math.max(0, quote.total - totalAdvances);
  const newBalanceAfterAdvance = Math.max(0, currentBalance - (amount || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebase.db || !firebase.auth) return;

    if (!amount || amount <= 0) {
      toast({ variant: "destructive", title: "Valor inválido", description: "O valor do adiantamento deve ser maior que zero." });
      return;
    }

    if (amount > currentBalance) {
      toast({
        variant: "destructive",
        title: "Valor superior ao saldo",
        description: `O valor do adiantamento (${formatCurrency(amount)}) não pode ser maior que o saldo restante (${formatCurrency(currentBalance)}).`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await registerOSAdvancePayment(firebase.db, firebase.auth, quote.id, {
        amount: Number(amount),
        date,
        method,
        notes,
        generateRemainingReceivable: generateRemaining,
        remainingDueDate: generateRemaining ? remainingDueDate : undefined,
      });

      toast({
        title: "Adiantamento Registrado! 💰",
        description: `Entrada de ${formatCurrency(amount)} lançada com sucesso no Contas a Receber da O.S. ${quote.quoteNumber.replace('ORC', 'OS')}.`,
      });

      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Erro ao registrar adiantamento:", error);
      toast({ variant: "destructive", title: "Erro ao registrar adiantamento", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="w-[95vw] max-w-lg bg-background/95 backdrop-blur-3xl border border-border/40 shadow-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.04] border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/10 text-green-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Lançar Adiantamento / Parcela
                <Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
                  {quote.quoteNumber.replace("ORC", "OS")}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Registre uma entrada financeira antecipada para <strong>{quote.clientName}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Card Resumo Financeiro da O.S. */}
          <div className="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-muted/30 border border-border/40 text-center">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor Total O.S.</p>
              <p className="text-sm font-bold text-foreground">{formatCurrency(quote.total)}</p>
            </div>
            <div className="space-y-0.5 border-x border-border/40 px-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">Já Adiantado</p>
              <p className="text-sm font-bold text-green-600">{formatCurrency(totalAdvances)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Saldo Restante</p>
              <p className="text-sm font-bold text-blue-600">{formatCurrency(currentBalance)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-primary" /> Valor do Adiantamento (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={currentBalance}
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="h-10 text-base font-bold text-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Data do Pagamento
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 text-xs font-semibold"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-primary" /> Forma de Pagamento
            </Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-10 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX" className="text-xs font-semibold">PIX</SelectItem>
                <SelectItem value="TED / Transferência" className="text-xs font-semibold">TED / Transferência Bancária</SelectItem>
                <SelectItem value="Dinheiro" className="text-xs font-semibold">Dinheiro em Espécie</SelectItem>
                <SelectItem value="Cartão de Crédito" className="text-xs font-semibold">Cartão de Crédito</SelectItem>
                <SelectItem value="Cartão de Débito" className="text-xs font-semibold">Cartão de Débito</SelectItem>
                <SelectItem value="Boleto Bancário" className="text-xs font-semibold">Boleto Bancário</SelectItem>
                <SelectItem value="Cheque" className="text-xs font-semibold">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-primary" /> Observações / Comprovante
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Entrada de 50% via PIX para aquisição de câmeras."
              rows={2}
              className="text-xs"
            />
          </div>

          {/* Opção de gerar a parcela do saldo restante */}
          {newBalanceAfterAdvance > 0 && (
            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="generateRemaining"
                  checked={generateRemaining}
                  onCheckedChange={(checked) => setGenerateRemaining(!!checked)}
                />
                <label
                  htmlFor="generateRemaining"
                  className="text-xs font-semibold text-foreground/90 cursor-pointer"
                >
                  Lançar também o saldo restante ({formatCurrency(newBalanceAfterAdvance)}) como Pendente no Financeiro
                </label>
              </div>

              {generateRemaining && (
                <div className="space-y-1 pl-6">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Vencimento do Saldo Restante</Label>
                  <Input
                    type="date"
                    value={remainingDueDate}
                    onChange={(e) => setRemainingDueDate(e.target.value)}
                    className="h-8 text-xs font-semibold max-w-[200px]"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 flex justify-between items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting} className="h-9 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-9 px-6 text-xs font-bold bg-green-600 hover:bg-green-700 text-white shadow-md">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" /> Confirmar Adiantamento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
