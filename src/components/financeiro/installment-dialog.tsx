
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { AccountsReceivable } from "@/lib/data";
import { useEffect, useState } from "react";
import { Loader2, Percent, Repeat, Hash, Save, Wallet, CreditCard, Calendar, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


import { addDays, format } from "date-fns";
import { cn } from "@/lib/utils";


const formSchema = z.object({
  installments: z.coerce.number().int().min(2, "O parcelamento deve ter no mínimo 2 parcelas.").max(12, "Máximo de 12 parcelas."),
  interestRate: z.coerce.number().min(0, "A taxa de juros não pode ser negativa.").optional(),
  method: z.string().min(1, "Selecione a forma de pagamento."),
});

type InstallmentDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onConfirm: (receivableId: string, installments: number, interestRate: number, method: string, customInstallments?: any[]) => Promise<void>;
  receivable: AccountsReceivable | null;
};

export default function InstallmentDialog({
  isOpen,
  setOpen,
  onConfirm,
  receivable,
}: InstallmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customInstallments, setCustomInstallments] = useState<any[]>([]);
  const [showCustom, setShowCustom] = useState(false);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      installments: 2,
      interestRate: 0,
      method: "BOLETO",
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ installments: 2, interestRate: 0, method: "BOLETO" });
    }
  }, [isOpen, form]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const installments = form.watch("installments") || 2;
  const interestRate = form.watch("interestRate") || 0;
  const originalAmount = receivable?.originalAmount || receivable?.amount || 0;
  const totalAmountWithInterest = originalAmount * (1 + interestRate / 100);

  useEffect(() => {
    if (isOpen) {
      form.reset({ installments: 2, interestRate: 0, method: "BOLETO" });
      setShowCustom(false);
    }
  }, [isOpen, form]);

  useEffect(() => {
      const count = installments;
      const rate = interestRate;
      const total = totalAmountWithInterest;
      const baseValue = parseFloat((total / count).toFixed(2));
      const now = new Date();
      
      const defaults = Array.from({ length: count }, (_, idx) => {
          const i = idx + 1;
          return {
              amount: baseValue,
              dueDate: format(addDays(now, i * 30), 'yyyy-MM-dd')
          };
      });
      setCustomInstallments(defaults);
  }, [installments, interestRate, totalAmountWithInterest]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!receivable) return;
    setIsSubmitting(true);
    await onConfirm(receivable.id, values.installments, values.interestRate || 0, values.method, customInstallments);
    setIsSubmitting(false);
    setOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl h-auto max-h-[90vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.03] border-b border-border/40">
          <div className="flex items-center gap-4">
               <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Repeat className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                    Plano de Parcelamento
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground italic">
                    Divida o valor da O.S. <strong>{receivable?.quoteNumber}</strong> em mensalidades.
                </DialogDescription>
              </div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form id="installment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-6">
            <div className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Valor Original da O.S.: <span className="font-semibold">{formatCurrency(originalAmount)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="installments"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center gap-2"><Hash className="h-3 w-3" /> Nº de Parcelas</FormLabel>
                        <Input
                            type="number"
                            min="2"
                            max="12"
                            {...field}
                        />
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="interestRate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center gap-2"><Percent className="h-3 w-3" /> Juros (%)</FormLabel>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="0"
                                step="1"
                                min="0"
                                {...field}
                                className="pr-8"
                            />
                            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold uppercase text-[10px] tracking-widest opacity-60"><CreditCard className="h-3 w-3" /> Forma de Pagamento Predominante</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger className="h-12 bg-background/50 border-border/40">
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-xl shadow-2xl">
                            <SelectItem value="BOLETO" className="font-semibold">BOLETO BANCÁRIO</SelectItem>
                            <SelectItem value="CARTÃO DE CRÉDITO" className="font-semibold">CARTÃO DE CRÉDITO</SelectItem>
                            <SelectItem value="PIX" className="font-semibold">PIX</SelectItem>
                            <SelectItem value="DEPÓSITO" className="font-semibold">DEPÓSITO / TRANSFERÊNCIA</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <Card className="p-4 bg-primary/5 border-border/40 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-left space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Resumo do Parcelamento</p>
                        <p className="text-xl font-bold text-primary">{formatCurrency(totalAmountWithInterest)} <span className="text-xs font-normal opacity-60">em {installments}x</span></p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest" onClick={() => setShowCustom(!showCustom)}>
                        {showCustom ? "Ocultar Detalhes" : "Ajustar Parcelas Individualmente"}
                    </Button>
                </div>

                {showCustom && (
                    <ScrollArea className="h-48 pr-4">
                        <div className="space-y-3">
                            {customInstallments.map((inst, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/20">
                                    <span className="text-[10px] font-bold opacity-40 w-6">{idx + 1}ª</span>
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-bold uppercase opacity-40 ml-1">Valor</p>
                                            <Input 
                                                type="number" 
                                                value={inst.amount} 
                                                onChange={(e) => {
                                                    const newList = [...customInstallments];
                                                    newList[idx].amount = parseFloat(e.target.value) || 0;
                                                    setCustomInstallments(newList);
                                                }}
                                                className="h-8 text-xs font-semibold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-bold uppercase opacity-40 ml-1">Vencimento</p>
                                            <Input 
                                                type="date" 
                                                value={inst.dueDate} 
                                                onChange={(e) => {
                                                    const newList = [...customInstallments];
                                                    newList[idx].dueDate = e.target.value;
                                                    setCustomInstallments(newList);
                                                }}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
                
                {showCustom && (
                    <div className={cn(
                        "flex items-center gap-2 p-2 rounded-lg text-[10px] font-semibold uppercase tracking-widest",
                        Math.abs(customInstallments.reduce((sum, i) => sum + i.amount, 0) - totalAmountWithInterest) > 0.05
                            ? "bg-destructive/10 text-destructive"
                            : "bg-green-500/10 text-green-600"
                    )}>
                        <AlertCircle className="h-3 w-3" />
                        Soma das parcelas: {formatCurrency(customInstallments.reduce((sum, i) => sum + i.amount, 0))}
                        {Math.abs(customInstallments.reduce((sum, i) => sum + i.amount, 0) - totalAmountWithInterest) > 0.05 && 
                            " (Divergente do total)"}
                    </div>
                )}
            </Card>
          </form>
        </Form>
        <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border/40 backdrop-blur-md">
          <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button type="submit" form="installment-form" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 font-semibold shadow-lg shadow-primary/20">
            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4" />}
            Criar Parcelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
