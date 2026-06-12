
"use client";

import { useForm, useFieldArray } from "react-hook-form";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Client, ServiceAddress } from "@/lib/data";
import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  User,
  Mail,
  Phone,
  Smartphone,
  FileText,
  MapPin,
  Hash,
  Home,
  Map as MapIcon,
  ClipboardList,
  Building,
  Lock,
  DollarSign,
  Repeat,
  Calendar as CalendarIcon,
  KeyRound,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "../ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeAndCapitalize } from "@/lib/firebase/firestore";
import { Separator } from "../ui/separator";
import { Card } from "../ui/card";

const serviceAddressSchema = z.object({
  id: z.string(),
  name: z.string().min(2, "O nome do local é obrigatório.").max(50, "O nome do local deve ter no máximo 50 caracteres."),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const clientFormSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  clientCode: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().min(10, "O telefone deve ter pelo menos 10 caracteres."),
  whatsapp: z.string().optional(),
  document: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  codigo_municipio: z.string().optional(),
  notes: z.string().optional(),
  isComodato: z.boolean(),
  comodatoStartDate: z.date().optional().nullable(),
  paymentDay: z.coerce.number().optional().nullable(),
  serviceDescription: z.string().optional(),
  serviceValue: z.coerce.number().optional(),
  preventiveMaintenanceFrequency: z.coerce.number().optional(),
  lastPreventiveMaintenanceDate: z.date().optional().nullable(),
  hasPortalAccess: z.boolean().default(false),
  serviceAddresses: z.array(serviceAddressSchema).optional(),
}).refine(data => {
    if (data.isComodato && !data.comodatoStartDate) {
        return false;
    }
    return true;
}, {
    message: "A data de início do comodato é obrigatória para clientes comodato.",
    path: ["comodatoStartDate"],
}).refine(data => {
    if (data.hasPortalAccess) {
        return z.string().email("Para dar acesso ao portal, um email válido é obrigatório.").min(1, "Email é obrigatório.").safeParse(data.email).success;
    }
    return true;
}, {
  message: "Email é obrigatório e deve ser válido para dar acesso ao portal.",
  path: ["email"],
});


type ClientFormData = Omit<Client, "id" | "companyId" | "lastPreventiveMaintenanceDate" | "comodatoStartDate"> & {
  lastPreventiveMaintenanceDate?: Date | null;
  comodatoStartDate?: Date | null;
};

type AddEditClientDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onClientSaved: (data: Partial<ClientFormData & { hasPortalAccess?: boolean }>) => Promise<void> | void;
  client?: Client;
  isQuickCreate?: boolean;
};

const formatPhone = (value: string) => {
  if (!value) return value;
  const phone = value.replace(/\D/g, "");
  if (phone.length <= 2) return `(${phone}`;
  if (phone.length <= 6) return `(${phone.slice(0, 2)}) ${phone.slice(2)}`;
  if (phone.length <= 10)
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7, 11)}`;
};

const formatCpfCnpj = (value: string) => {
  if (!value) return value;
  const document = value.replace(/\D/g, "");
  if (document.length <= 11) {
    if (document.length <= 3) return document;
    if (document.length <= 6) return `${document.slice(0, 3)}.${document.slice(3)}`;
    if (document.length <= 9)
      return `${document.slice(0, 3)}.${document.slice(3, 6)}.${document.slice(6)}`;
    return `${document.slice(0, 3)}.${document.slice(3, 6)}.${document.slice(6, 9)}-${document.slice(9, 11)}`;
  } else {
    if (document.length <= 2) return document;
    if (document.length <= 5) return `${document.slice(0, 2)}.${document.slice(2)}`;
    if (document.length <= 8)
      return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5)}`;
    if (document.length <= 12)
      return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8)}`;
    return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8, 12)}-${document.slice(12, 14)}`;
  }
};

const formatCep = (value: string) => {
  if (!value) return value;
  const cep = value.replace(/\D/g, "").slice(0, 8);
  if (cep.length <= 5) return cep;
  return `${cep.slice(0, 5)}-${cep.slice(5, 8)}`;
};

export default function AddEditClientDialog({
  isOpen,
  setOpen,
  onClientSaved,
  client,
}: AddEditClientDialogProps) {
  const { toast } = useToast();
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!client;

  const form = useForm<z.infer<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      clientCode: "",
      email: "",
      phone: "",
      whatsapp: "",
      document: "",
      cep: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
      codigo_municipio: "",
      notes: "",
      isComodato: false,
      comodatoStartDate: null,
      paymentDay: 10,
      serviceDescription: "",
      serviceValue: 0,
      preventiveMaintenanceFrequency: 6,
      lastPreventiveMaintenanceDate: null,
      hasPortalAccess: false,
      serviceAddresses: [],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "serviceAddresses",
  });
  
  const isComodato = form.watch("isComodato");
  const hasPortalAccess = form.watch("hasPortalAccess");

  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && client) {
      const dateValue = client.lastPreventiveMaintenanceDate
        ? new Date(client.lastPreventiveMaintenanceDate)
        : undefined;

      form.reset(
        {
          name: client.name || "",
          clientCode: client.clientCode || "N/A",
          email: client.email || "",
          phone: client.phone || "",
          whatsapp: client.whatsapp || "",
          document: client.document || "",
          cep: client.cep || "",
          street: client.street || "",
          number: client.number || "",
          neighborhood: client.neighborhood || "",
          city: client.city || "",
          state: client.state || "",
          codigo_municipio: client.codigo_municipio || "",
          notes: client.notes || "",
          isComodato: client.isComodato || false,
          comodatoStartDate: client.comodatoStartDate ? new Date(client.comodatoStartDate) : null,
          paymentDay: client.paymentDay || 10,
          serviceDescription: client.serviceDescription || "",
          serviceValue: client.serviceValue || 0,
          preventiveMaintenanceFrequency: client.preventiveMaintenanceFrequency || 6,
          lastPreventiveMaintenanceDate: isValid(dateValue) ? dateValue : null,
          hasPortalAccess: client.authUid ? true : (client.hasPortalAccess ?? false),
          serviceAddresses: client.serviceAddresses || [],
        },
        {
          keepErrors: false,
          keepDirty: false,
          keepTouched: false,
          keepIsValid: true,
        }
      );
    } else {
      form.reset({
        name: "",
        clientCode: "Automático",
        email: "",
        phone: "",
        whatsapp: "",
        document: "",
        cep: "",
        street: "",
        number: "",
        neighborhood: "",
        city: "",
        state: "",
        codigo_municipio: "",
        notes: "",
        isComodato: false,
        comodatoStartDate: null,
        paymentDay: 10,
        serviceDescription: "",
        serviceValue: 0,
        preventiveMaintenanceFrequency: 6,
        lastPreventiveMaintenanceDate: null,
        hasPortalAccess: false,
        serviceAddresses: [],
      });
    }

    setTimeout(() => nameInputRef.current?.focus(), 100);
  }, [isOpen, client, isEditing, form]);

  const handleCepBlur = async (cep: string, fieldPrefix?: string) => {
    const cepOnlyNumbers = cep.replace(/\D/g, "");
    if (cepOnlyNumbers.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepOnlyNumbers}/json/`);
      const data = await response.json();
      if (!data.erro) {
        const streetField = fieldPrefix ? `${fieldPrefix}.street` : "street";
        const neighborhoodField = fieldPrefix ? `${fieldPrefix}.neighborhood` : "neighborhood";
        const cityField = fieldPrefix ? `${fieldPrefix}.city` : "city";
        const stateField = fieldPrefix ? `${fieldPrefix}.state` : "state";
        const ibgeCodeField = "codigo_municipio";

        form.setValue(streetField as any, data.logradouro);
        form.setValue(neighborhoodField as any, data.bairro);
        form.setValue(cityField as any, data.localidade);
        form.setValue(stateField as any, data.uf);
        if (!fieldPrefix) {
          form.setValue(ibgeCodeField, data.ibge);
        }
      } else {
        toast({ variant: "destructive", title: "CEP não encontrado" });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao buscar CEP" });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleSave = async (values: z.infer<typeof clientFormSchema>) => {
    try {
      await onClientSaved({
          ...values,
          name: normalizeAndCapitalize(values.name),
          comodatoStartDate: values.comodatoStartDate ? values.comodatoStartDate.toISOString() : null,
          lastPreventiveMaintenanceDate: values.lastPreventiveMaintenanceDate ? values.lastPreventiveMaintenanceDate.toISOString() : null,
      } as any);
      setOpen(false);
      toast({
        title: "Sucesso",
        description: isEditing ? "Cliente atualizado com sucesso!" : "Cliente criado! O acesso ao portal foi enviado para o email do cliente.",
      });
    } catch (err) {
      // O toast de erro já é tratado na função `onClientSaved` se houver erro de API
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="w-[95vw] sm:max-w-5xl flex flex-col p-0 max-h-[95dvh] sm:h-full sm:max-h-[90vh] bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-xl">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {isEditing ? "Editar Cliente" : "Adicionar Novo Cliente"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground italic">
                {isEditing ? "Edite os detalhes do cliente abaixo para manter a base atualizada." : "Preencha os detalhes para o novo cliente e crie seu acesso ao portal."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form id="client-form" onSubmit={form.handleSubmit(handleSave)} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-auto">
              <div className="p-6 space-y-4">
                <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 mb-2 font-semibold text-primary/80">
                      <User className="h-4 w-4" /> Nome Completo / Razão Social
                    </FormLabel>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input {...field} ref={nameInputRef} autoComplete="name" className="pl-10" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}/>
                
                  <FormField
                  control={form.control}
                  name="hasPortalAccess"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-xl border border-primary/20 p-4 shadow-sm bg-primary/5 transition-all hover:bg-primary/10">
                        <div className="space-y-0.5">
                            <FormLabel className="flex items-center gap-2 text-primary font-semibold">
                                <KeyRound className="h-4 w-4"/> Acesso ao Portal do Cliente
                            </FormLabel>
                            <FormDescription className="text-[10px] leading-tight">
                                {isEditing && client?.authUid 
                                ? "Desativar o acesso não excluirá a conta do cliente, apenas impedirá o login."
                                : "Criar um usuário e senha para o cliente acessar o portal enviando os dados por e-mail."
                                }
                            </FormDescription>
                        </div>
                        <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            role="switch"
                        />
                        </FormControl>
                    </FormItem>
                  )}
                />

                 <FormField
                  name="email"
                  control={form.control}
                  render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                      <Mail className="h-4 w-4" /> Email {hasPortalAccess && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input {...field} autoComplete="email" className="pl-10" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}/>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField name="clientCode" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                          <Hash className="h-4 w-4" /> Código
                        </FormLabel>
                        <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} className="pl-10" disabled />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                    <FormField name="document" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                          <FileText className="h-4 w-4" /> CPF / CNPJ
                        </FormLabel>
                        <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} onChange={(e)=>field.onChange(formatCpfCnpj(e.target.value))} className="pl-10" />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField name="phone" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                          <Phone className="h-4 w-4" /> Telefone
                        </FormLabel>
                        <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} onChange={(e)=>field.onChange(formatPhone(e.target.value))} className="pl-10" />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                    <FormField name="whatsapp" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                          <Smartphone className="h-4 w-4" /> WhatsApp
                        </FormLabel>
                        <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} onChange={(e)=>field.onChange(formatPhone(e.target.value))} className="pl-10" />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                </div>
                
                 <Separator className="my-8 bg-primary/10"/>
                 <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    <h3 className="text-lg font-semibold tracking-tight text-primary">Endereço Principal <span className="text-xs font-normal text-muted-foreground ml-2">(Faturamento)</span></h3>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField name="cep" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                          <MapPin className="h-4 w-4" /> CEP
                        </FormLabel>
                        <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} onBlur={(e)=>handleCepBlur(e.target.value)} onChange={(e)=>field.onChange(formatCep(e.target.value))} className="pl-10" />
                        </FormControl>
                        {isFetchingCep && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin"/>}
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                    <FormField name="street" control={form.control} render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>Logradouro</FormLabel>
                        <div className="relative">
                        <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} className="pl-10" />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField name="number" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Número</FormLabel>
                        <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} className="pl-10" />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>

                    <FormField name="neighborhood" control={form.control} render={({ field }) => (
                    <FormItem className="md:col-span-3">
                        <FormLabel>Bairro</FormLabel>
                        <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} className="pl-10" />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField name="city" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} className="pl-10" />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>

                    <FormField name="state" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <div className="relative">
                        <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} className="pl-10" />
                        </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                </div>
                
                <FormField name="codigo_municipio" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Código do Município (IBGE)</FormLabel>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl>
                                <Input {...field} className="pl-10" placeholder="Preenchido via CEP" />
                            </FormControl>
                        </div>
                        <FormDescription>Necessário para emissão de NFS-e para clientes de outras cidades.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}/>
                
                <Separator className="my-6" />
                <div className="space-y-2">
                    <h3 className="text-lg font-medium">Endereços de Serviço</h3>
                    <p className="text-sm text-muted-foreground">Adicione locais adicionais onde os serviços podem ser executados.</p>
                </div>
                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <Card key={field.id} className="p-4 bg-primary/5 border-border/40 relative overflow-hidden group hover:bg-primary/10 transition-colors">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary/30" />
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <div className="space-y-4">
                                <FormField control={form.control} name={`serviceAddresses.${index}.name`} render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs font-semibold text-primary/60 uppercase tracking-wider">Nome do Local</FormLabel>
                                      <FormControl><Input placeholder="Ex: Sede, Filial Praia" {...field} className="bg-background/50" /></FormControl>
                                      <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField control={form.control} name={`serviceAddresses.${index}.cep`} render={({ field }) => (
                                        <FormItem><FormLabel>CEP</FormLabel><FormControl><Input placeholder="CEP" {...field} onBlur={(e) => handleCepBlur(e.target.value, `serviceAddresses.${index}`)} onChange={(e) => field.onChange(formatCep(e.target.value))} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name={`serviceAddresses.${index}.street`} render={({ field }) => (
                                        <FormItem className="md:col-span-2"><FormLabel>Logradouro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <FormField control={form.control} name={`serviceAddresses.${index}.number`} render={({ field }) => (
                                        <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name={`serviceAddresses.${index}.neighborhood`} render={({ field }) => (
                                        <FormItem className="md:col-span-3"><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name={`serviceAddresses.${index}.city`} render={({ field }) => (
                                        <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name={`serviceAddresses.${index}.state`} render={({ field }) => (
                                        <FormItem><FormLabel>Estado</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                            </div>
                        </Card>
                    ))}
                    <Button type="button" variant="outline" className="w-full border-dashed border-primary/25 hover:border-primary hover:bg-primary/5 text-primary h-10" onClick={() => append({ id: `new_${Date.now()}`, name: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Endereço de Serviço
                    </Button>
                </div>


                <FormField name="isComodato" control={form.control} render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-primary/20 p-4 shadow-sm mt-8 bg-primary/5 hover:bg-primary/10 transition-all">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2 text-primary font-semibold">
                        <Lock className="h-4 w-4" /> Cliente Comodato (Lease)
                      </FormLabel>
                      <FormDescription className="text-xs">Marque se este cliente possui equipamentos em regime de comodato ativo.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} role="switch" />
                    </FormControl>
                  </FormItem>
                )}/>
                
                {isComodato && (
                  <div className="space-y-6 rounded-xl border border-border/40 p-6 bg-primary/5 mt-4">
                        <FormField name="serviceValue" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                              <DollarSign className="h-4 w-4" /> Valor Mensal do Serviço (R$)
                            </FormLabel>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <FormControl>
                                <Input type="number" placeholder="Ex: 150.00" {...field} className="pl-10 bg-background/50 h-11 text-lg font-semibold text-primary" min="0" />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}/>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="comodatoStartDate" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                                <CalendarIcon className="h-4 w-4" /> Início do Comodato <span className="text-destructive">*</span>
                              </FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                      {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar locale={ptBR} mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}/>

                          <FormField name="paymentDay" control={form.control} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dia de Pagamento / Vencimento</FormLabel>
                              <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="Ex: 10" 
                                    {...field} 
                                    value={field.value ?? ""} 
                                    className="pl-10" 
                                    min="1" 
                                    max="31" 
                                  />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}/>
                        </div>

                        <FormField name="serviceDescription" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição do Serviço (Comodato)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Ex: Mensalidade de monitoramento 24h" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}/>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField name="preventiveMaintenanceFrequency" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frequência da Preventiva (meses)</FormLabel>
                                    <div className="relative">
                                        <Repeat className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <FormControl>
                                            <Input type="number" placeholder="Ex: 6" {...field} className="pl-10" min="1" />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="lastPreventiveMaintenanceDate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Data da Última Preventiva</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar locale={ptBR} mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                  </div>
                )}

                <FormField name="notes" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas Adicionais</FormLabel>
                    <div className="relative">
                      <ClipboardList className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Textarea {...field} className="pl-10" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>
            </div>
          </form>
        </Form>

        <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border/40 backdrop-blur-md">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-10 mr-2">
            Cancelar
          </Button>
          <Button type="submit" form="client-form" className="h-10 px-8 font-semibold shadow-lg shadow-primary/20">
            {isEditing ? "Salvar Alterações" : "Adicionar Cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
