
"use client";

import { useState } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  reason: z.string().min(5, "A justificativa deve ter pelo menos 5 caracteres."),
});

type ReasonDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  title: string;
  description: string;
  onConfirm: (reason: string) => Promise<void>;
};

export default function ReasonDialog({ isOpen, setOpen, title, description, onConfirm }: ReasonDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { reason: "" },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    await onConfirm(values.reason);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="reason-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justificativa / Motivo</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva o motivo da ação..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="reason-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
