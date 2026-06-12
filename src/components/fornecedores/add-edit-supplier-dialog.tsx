"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Supplier } from "@/lib/data";
import { useEffect, useState } from "react";
import { Loader2, User, Mail, Phone, Smartphone, FileText, MapPin, Hash, Home, Building, Truck, ClipboardList, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeAndCapitalize } from "@/lib/firebase/firestore";

const supplierFormSchema = z.object({
  name: z.string().min(3, "O nome do fornecedor é obrigatório."),
  email: z.string().email("Email inválido.").optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  document: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierFormData = Omit<Supplier, 'id' | 'companyId' | 'creationDate' | 'supplierCode'>;

type AddEditSupplierDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onSave: (data: Partial<SupplierFormData>, id?: string) => Promise<void>;
  supplier?: Supplier | null;
};

const formatPhone = (value: string) => {
  if (!value) return value;
  const phone = value.replace(/\D/g, "");
  if (phone.length <= 2) return `(${phone}`;
  if (phone.length <= 6) return `(${phone.slice(0, 2)}) ${phone.slice(2)}`;
  if (phone.length <= 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7, 11)}`;
};

const formatCpfCnpj = (value: string) => {
  if (!value) return value;
  const document = value.replace(/\D/g, '');
  if (document.length <= 11) {
    if (document.length <= 3) return document;
    if (document.length <= 6) return `${document.slice(0, 3)}.${document.slice(3)}`;
    if (document.length <= 9) return `${document.slice(0, 3)}.${document.slice(3, 6)}.${document.slice(6)}`;
    return `${document.slice(0, 3)}.${document.slice(3, 6)}.${document.slice(6, 9)}-${document.slice(9, 11)}`;
  } else {
    if (document.length <= 2) return document;
    if (document.length <= 5) return `${document.slice(0, 2)}.${document.slice(2)}`;
    if (document.length <= 8) return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5)}`;
    if (document.length <= 12) return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8)}`;
    return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8, 12)}-${document.slice(12, 14)}`;
  }
};

const formatCep = (value: string) => {
  if (!value) return value;
  const cep = value.replace(/\D/g, "").slice(0, 8);
  if (cep.length <= 5) return cep;
  return `${cep.slice(0, 5)}-${cep.slice(5, 8)}`;
};

export default function AddEditSupplierDialog({ isOpen, setOpen, onSave, supplier }: AddEditSupplierDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const isEditing = !!supplier;

  const form = useForm<z.infer<typeof supplierFormSchema>>({
    resolver: zodResolver(supplierFormSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && supplier) {
        form.reset({ ...supplier });
      } else {
        form.reset({
          name: "", email: "", phone: "", whatsapp: "", document: "",
          cep: "", street: "", number: "", neighborhood: "", city: "", state: "", notes: ""
        });
      }
    }
  }, [isOpen, supplier, isEditing, form]);

  const handleCepBlur = async (cep: string) => {
    const cepOnlyNumbers = cep.replace(/\D/g, "");
    if (cepOnlyNumbers.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepOnlyNumbers}/json/`);
      const data = await response.json();
      if (!data.erro) {
        form.setValue("street", data.logradouro);
        form.setValue("neighborhood", data.bairro);
        form.setValue("city", data.localidade);
        form.setValue("state", data.uf);
      } else {
        toast({ variant: "destructive", title: "CEP não encontrado" });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao buscar CEP" });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleSave = async (values: z.infer<typeof supplierFormSchema>) => {
    setIsSubmitting(true);
    try {
      await onSave({
        ...values,
        name: normalizeAndCapitalize(values.name),
      }, supplier?.id);
    } catch (err) {
      // Error toast is handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-screen-md h-full max-h-[90vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.03] border-b border-border/40">
          <div className="flex items-center gap-4">
               <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                    {isEditing ? "Editar Fornecedor" : "Novo Fornecedor"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground italic">
                    Gerencie seus parceiros e fornecedores de materiais.
                </DialogDescription>
              </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Form {...form}>
              <form id="supplier-form" onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                 <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                        <Building className="h-4 w-4" /> Nome / Razão Social
                    </FormLabel>
                    <FormControl><Input {...field} className="h-11 shadow-sm border-border/40" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <FormField name="email" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                            <Mail className="h-4 w-4" /> E-mail de Contato
                        </FormLabel>
                        <FormControl><Input {...field} type="email" className="h-11 shadow-sm border-border/40" /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="document" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                            <FileText className="h-4 w-4" /> CNPJ / CPF
                        </FormLabel>
                        <FormControl><Input {...field} onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))} className="h-11 shadow-sm border-border/40" /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <FormField name="phone" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                            <Phone className="h-4 w-4" /> Telefone Fixo
                        </FormLabel>
                        <FormControl><Input {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))} className="h-11 shadow-sm border-border/40" /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="whatsapp" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                            <Smartphone className="h-4 w-4" /> WhatsApp
                        </FormLabel>
                        <FormControl><Input {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))} className="h-11 shadow-sm border-border/40" /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )} />
                </div>

                 <div className="space-y-4 mt-6">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-[0.2em] mb-4">
                        <div className="bg-primary text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] shadow-lg shadow-primary/20">2</div>
                        Endereço e Localização
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField name="cep" control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                            <MapPin className="h-4 w-4" /> CEP
                          </FormLabel>
                          <div className="relative">
                            <FormControl><Input {...field} onBlur={(e) => handleCepBlur(e.target.value)} onChange={(e) => field.onChange(formatCep(e.target.value))} className="h-11 shadow-sm border-border/40" /></FormControl>
                            {isFetchingCep && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin" />}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField name="street" control={form.control} render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                <MapPin className="h-4 w-4" /> Logradouro
                            </FormLabel>
                            <FormControl><Input {...field} className="h-11 shadow-sm border-border/40" /></FormControl>
                            <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField name="number" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                <Hash className="h-4 w-4" /> Nº
                            </FormLabel>
                            <FormControl><Input {...field} className="h-11 shadow-sm border-border/40" /></FormControl>
                            <FormMessage />
                        </FormItem>
                      )} />
                      <FormField name="neighborhood" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                <Home className="h-4 w-4" /> Bairro
                            </FormLabel>
                            <FormControl><Input {...field} className="h-11 shadow-sm border-border/40" /></FormControl>
                            <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField name="city" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                <Building className="h-4 w-4" /> Cidade
                            </FormLabel>
                            <FormControl><Input {...field} className="h-11 shadow-sm border-border/40" /></FormControl>
                            <FormMessage />
                        </FormItem>
                      )} />
                      <FormField name="state" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                <MapPin className="h-4 w-4" /> Estado
                            </FormLabel>
                            <FormControl><Input {...field} className="h-11 shadow-sm border-border/40" /></FormControl>
                            <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                 </div>

                 <div className="space-y-4 mt-6">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-[0.2em] mb-4">
                        <div className="bg-primary text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] shadow-lg shadow-primary/20">3</div>
                        Informações Adicionais
                    </div>
                    <FormField name="notes" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                            <ClipboardList className="h-4 w-4" /> Observações Internas
                        </FormLabel>
                        <FormControl><Textarea {...field} className="min-h-[100px] shadow-sm border-border/40" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                 </div>
             </form>
            </Form>
          </div>
        </div>
        <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border/40 backdrop-blur-md">
          <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button type="submit" form="supplier-form" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 font-semibold shadow-lg shadow-primary/20">
            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? "Salvar Alterações" : "Efetivar Cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
