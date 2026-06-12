

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Tool } from "@/lib/data";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "O nome da ferramenta é obrigatório."),
  type: z.string().min(2, "O tipo/categoria é obrigatório."),
  code: z.string().optional(),
  condition: z.enum(['OK', 'Avariada', 'Extraviada']),
  notes: z.string().optional(),
});

type AddEditToolDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onSave: (data: Partial<Omit<Tool, 'id' | 'companyId'>>) => Promise<void>;
  tool?: Tool;
};

export default function AddEditToolDialog({ isOpen, setOpen, onSave, tool }: AddEditToolDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!tool;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        form.reset({
            name: tool.name,
            type: tool.type,
            code: tool.code || "",
            condition: tool.condition,
            notes: tool.notes || "",
        });
      } else {
        form.reset({
          name: "",
          type: "",
          code: "",
          condition: "OK",
          notes: "",
        });
      }
    }
  }, [isOpen, isEditing, tool, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    // For new tools, status is always "Disponível" and condition is "OK"
    const dataToSave = isEditing ? { ...values, status: tool.status } : { ...values, status: 'Disponível' as const };

    await onSave(dataToSave as any);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Ferramenta" : "Nova Ferramenta"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Altere os detalhes da ferramenta." : "Cadastre uma nova ferramenta no seu inventário."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="tool-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome da Ferramenta</FormLabel><FormControl><Input placeholder="Ex: Furadeira de Impacto" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Tipo / Categoria</FormLabel><FormControl><Input placeholder="Ex: Elétrica" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem><FormLabel>Código / Patrimônio</FormLabel><FormControl><Input placeholder="Ex: F-001" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
             <FormField control={form.control} name="condition" render={({ field }) => (
                <FormItem>
                    <FormLabel>Estado da Ferramenta</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="OK">OK</SelectItem>
                            <SelectItem value="Avariada">Avariada</SelectItem>
                            <SelectItem value="Extraviada">Extraviada</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage/>
                </FormItem>
            )}/>
             <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea placeholder="Detalhes sobre a ferramenta, como voltagem, marca, etc." {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="tool-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Adicionar Ferramenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
