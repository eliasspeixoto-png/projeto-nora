
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
import { Loader2, DollarSign, PiggyBank, Receipt, Save, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";

const formSchema = z.object({
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
});

type PartialPaymentDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onConfirm: (receivableId: string, discount: number) => Promise<void>;
  receivable: AccountsReceivable | null;
};

export default function PartialPaymentDialog({
  isOpen,
  setOpen,
  onConfirm,
  receivable,
}: PartialPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: '' as any, // Initialize with an empty string
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ amount: '' as any });
    }
  }, [isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!receivable) return;
    if (values.amount >= receivable.amount) {
        form.setError("amount", {
            type: "manual",
            message: "O valor parcial deve ser menor que o valor total pendente."
        });
        return;
    }
    setIsSubmitting(true);
    // This component is being repurposed or replaced, the onConfirm signature may need to change.
    // For now, we assume it takes a discount, which is not what this form provides.
    // This is a placeholder call.
    // await onConfirm(receivable.id, 0); 
    setIsSubmitting(false);
    setOpen(false);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md h-auto flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.03] border-b border-border/40">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <PiggyBank className="h-6 w-6" />
            </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                    Pagamento Parcial
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground italic">
                    Amortize parte da dívida da O.S. <strong>{receivable?.quoteNumber}</strong>.
                </DialogDescription>
              </div>
          </div>
        </DialogHeader>
        <div className="px-6 py-2">
          <Card className="p-4 bg-primary/5 border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" /> Saldo Pendente
            </div>
            <div className="font-semibold text-lg">{formatCurrency(receivable?.amount || 0)}</div>
          </Card>
        </div>
        <Form {...form}>
          <form id="partial-payment-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Valor a Pagar
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0,00"
                      step="0.01"
                      min="0.01"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border/40 backdrop-blur-md">
          <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button type="submit" form="partial-payment-form" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 font-semibold shadow-lg shadow-primary/20">
            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Receipt className="mr-2 h-4 w-4" />}
            Efetivar Amortização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
