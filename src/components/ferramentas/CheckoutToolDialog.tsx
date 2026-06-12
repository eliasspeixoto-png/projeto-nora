
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tool, UserProfile } from "@/lib/data";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  technicianId: z.string().min(1, "Selecione um colaborador."),
});

type CheckoutToolDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  tool: Tool | null;
  teamMembers: UserProfile[];
  onCheckout: (toolId: string, technicianId: string, technicianName: string) => Promise<void>;
};

export default function CheckoutToolDialog({ isOpen, setOpen, tool, teamMembers, onCheckout }: CheckoutToolDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ technicianId: "" });
    }
  }, [isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!tool) return;
    const technician = teamMembers.find(t => t.uid === values.technicianId);
    if (!technician) return;
    
    setIsSubmitting(true);
    await onCheckout(tool.id, technician.uid, technician.displayName);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entregar Ferramenta</DialogTitle>
          <DialogDescription>
            Registrar a entrega da ferramenta <strong>{tool?.name}</strong> para um colaborador.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="checkout-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="technicianId" render={({ field }) => (
                <FormItem>
                    <FormLabel>Colaborador</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione para quem entregar..."/></SelectTrigger></FormControl>
                        <SelectContent>
                            {teamMembers.filter(t => t.role !== 'surveyor').map(t => (
                                <SelectItem key={t.uid} value={t.uid}>{t.displayName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage/>
                </FormItem>
            )}/>
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="checkout-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
