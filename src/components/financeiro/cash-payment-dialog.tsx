
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
import type { AccountsReceivable } from "@/lib/data";
import { useEffect, useState } from "react";
import { Loader2, Percent, DollarSign, Wallet, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const formSchema = z.object({
  discount: z.coerce.number().min(0, "O desconto não pode ser negativo.").max(100, "O desconto não pode ser maior que 100%.").optional(),
  method: z.string().min(1, "Selecione a forma de pagamento."),
});

type CashPaymentDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onConfirm: (receivableId: string, discount: number, method: string) => Promise<void>;
  receivable: AccountsReceivable | null;
};

export default function CashPaymentDialog({
  isOpen,
  setOpen,
  onConfirm,
  receivable,
}: CashPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      discount: 0,
      method: "PIX",
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ discount: 0, method: "PIX" });
    }
  }, [isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!receivable) return;
    setIsSubmitting(true);
    await onConfirm(receivable.id, values.discount || 0, values.method);
    setIsSubmitting(false);
    setOpen(false);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };
  
  const originalAmount = receivable?.originalAmount || receivable?.amount || 0;
  const discountValue = form.watch("discount") || 0;
  const finalAmount = originalAmount * (1 - discountValue / 100);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md p-0 flex flex-col bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.03] border-b border-border/40">
          <div className="flex items-center gap-4">
               <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                    Recebimento à Vista
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground italic">
                    Finalize o faturamento da O.S. <strong>{receivable?.quoteNumber}</strong>.
                </DialogDescription>
              </div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form id="cash-payment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-6">
            <Card className="p-4 bg-primary/5 border-border/40">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Valor Original:</span>
                    <span className="font-semibold">{formatCurrency(originalAmount)}</span>
                </div>
            </Card>
            <FormField
              control={form.control}
              name="discount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Percent className="h-3.5 w-3.5" />
                    Desconto (%)
                  </FormLabel>
                   <div className="relative">
                      <Input
                        type="number"
                        placeholder="0"
                        step="1"
                        min="0"
                        max="100"
                        {...field}
                        className="pr-8"
                      />
                      <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60">
                    Forma de Pagamento
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 bg-background/50 border-border/40">
                        <SelectValue placeholder="Selecione a forma de pagamento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-xl shadow-2xl">
                      <SelectItem value="PIX" className="font-semibold">PIX</SelectItem>
                      <SelectItem value="DINHEIRO" className="font-semibold">DINHEIRO (ESPÉCIE)</SelectItem>
                      <SelectItem value="CARTÃO DE CRÉDITO" className="font-semibold">CARTÃO DE CRÉDITO</SelectItem>
                      <SelectItem value="CARTÃO DE DÉBITO" className="font-semibold">CARTÃO DE DÉBITO</SelectItem>
                      <SelectItem value="BOLETO" className="font-semibold">BOLETO BANCÁRIO</SelectItem>
                      <SelectItem value="DEPÓSITO" className="font-semibold">DEPÓSITO / TRANSFERÊNCIA</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                <span className="font-semibold text-primary">Valor Final:</span>
                <span className="font-semibold text-xl text-primary">{formatCurrency(finalAmount)}</span>
            </div>
          </form>
        </Form>
        <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border/40 backdrop-blur-md">
          <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button type="submit" form="cash-payment-form" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 font-semibold shadow-lg shadow-primary/20">
            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4" />}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
