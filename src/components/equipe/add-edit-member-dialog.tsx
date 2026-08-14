
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { updateTeamMember, inviteTeamMember } from "@/lib/firebase/firestore";
import { useState, useEffect, useRef } from "react";
import { Loader2, User, Mail, Smartphone, FileText, MapPin, Hash, Home, Map as MapIcon, Building, Percent, DollarSign, ClipboardList, ImageIcon, Save } from "lucide-react";
import type { UserProfile } from "@/lib/data";
import { avatarOptions } from "@/lib/avatars";
import Image from "next/image";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { cn, formatDisplayName } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Separator } from "../ui/separator";

const formatPhone = (value: string) => {
  if (!value) return value;
  const phone = value.replace(/\D/g, "");
  if (phone.length <= 2) return `(${phone}`;
  if (phone.length <= 6) return `(${phone.slice(0, 2)}) ${phone.slice(2)}`;
  if (phone.length <= 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7, 11)}`;
}

const formatCpfCnpj = (value: string) => {
  if (!value) return value;
  const document = value.replace(/\D/g, '');

  if (document.length <= 11) { // CPF
    if (document.length <= 3) return document;
    if (document.length <= 6) return `${document.slice(0, 3)}.${document.slice(3)}`;
    if (document.length <= 9) return `${document.slice(0, 3)}.${document.slice(3, 6)}.${document.slice(6)}`;
    return `${document.slice(0, 3)}.${document.slice(3, 6)}.${document.slice(6, 9)}-${document.slice(9, 11)}`;
  } else { // CNPJ
    if (document.length <= 2) return document;
    if (document.length <= 5) return `${document.slice(0, 2)}.${document.slice(2)}`;
    if (document.length <= 8) return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5)}`;
    if (document.length <= 12) return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8)}`;
    return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8, 12)}-${document.slice(12, 14)}`;
  }
};

const formatCep = (value: string) => {
  if (!value) return value;
  const cep = value.replace(/\D/g, '').slice(0, 8);
  if (cep.length <= 5) return cep;
  return `${cep.slice(0, 5)}-${cep.slice(5, 8)}`;
};

const baseSchema = z.object({
  displayName: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  reMatricula: z.string().optional(),
  employmentType: z.enum(["CLT", "freelance"]),
  role: z.enum(["tecnico", "surveyor", "supervisor", "admin", "comprador", "vendedor", "developer", "distribuidor"], {
    required_error: "Você deve selecionar uma função.",
  }),
  email: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  document: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  avatarUrl: z.string().optional(),
  commissionPercentage: z.coerce.number().min(0, "A comissão não pode ser negativa.").optional(),
  monthlyGoal: z.coerce.number().min(0, "A meta não pode ser negativa.").optional(),
  allowWhatsappAccess: z.boolean().optional(),
});

const inviteSchema = baseSchema.extend({
  email: z.string().email("Por favor, insira um email válido."),
});

type AddEditMemberDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onInviteSuccess: () => void;
  onUpdateMember: (uid: string, data: Partial<Omit<UserProfile, 'uid' | 'email'>>) => void;
  memberToEdit: UserProfile | null;
};

export default function AddEditMemberDialog({
  isOpen,
  setOpen,
  onInviteSuccess,
  onUpdateMember,
  memberToEdit,
}: AddEditMemberDialogProps) {
  const { userProfile, company, firebase, isDeveloper } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const isEditing = !!memberToEdit;
  const currentFormSchema = isEditing ? baseSchema : inviteSchema;
  type FormValues = z.infer<typeof inviteSchema>;

  const isDistributor = userProfile?.role === 'distribuidor';

  const form = useForm<FormValues>({
    resolver: zodResolver(currentFormSchema),
    defaultValues: (isEditing && memberToEdit) ? {
      displayName: memberToEdit.displayName || "",
      reMatricula: memberToEdit.reMatricula || "",
      email: memberToEdit.email || "",
      employmentType: (memberToEdit.employmentType as "CLT" | "freelance") || "CLT",
      role: memberToEdit.role as any,
      allowWhatsappAccess: memberToEdit.allowWhatsappAccess ?? true,
      phone: memberToEdit.phone || "",
      whatsapp: memberToEdit.whatsapp || "",
      document: memberToEdit.document || "",
      cep: memberToEdit.cep || "",
      street: memberToEdit.street || "",
      number: memberToEdit.number || "",
      neighborhood: memberToEdit.neighborhood || "",
      city: memberToEdit.city || "",
      state: memberToEdit.state || "",
      avatarUrl: memberToEdit.avatarUrl || "",
      commissionPercentage: memberToEdit.commissionPercentage || 0,
      monthlyGoal: memberToEdit.monthlyGoal || 0,
    } : {
      displayName: "",
      reMatricula: "",
      email: "",
      employmentType: "CLT",
      role: (isDistributor ? "vendedor" : "tecnico") as any,
      allowWhatsappAccess: true,
      phone: "",
      whatsapp: "",
      document: "",
      cep: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
      avatarUrl: "",
      commissionPercentage: company?.defaultCommissionPercentage || 0,
      monthlyGoal: company?.defaultMonthlyGoal || 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && memberToEdit) {
        form.reset({
          displayName: memberToEdit.displayName,
          reMatricula: memberToEdit.reMatricula || "",
          email: memberToEdit.email,
          employmentType: memberToEdit.employmentType || "CLT",
          role: memberToEdit.role as any,
          allowWhatsappAccess: memberToEdit.allowWhatsappAccess ?? true,
          phone: memberToEdit.phone || "",
          whatsapp: memberToEdit.whatsapp || "",
          document: memberToEdit.document || "",
          cep: memberToEdit.cep || "",
          street: memberToEdit.street || "",
          number: memberToEdit.number || "",
          neighborhood: memberToEdit.neighborhood || "",
          city: memberToEdit.city || "",
          state: memberToEdit.state || "",
          avatarUrl: memberToEdit.avatarUrl || "",
          commissionPercentage: memberToEdit.commissionPercentage || 0,
          monthlyGoal: memberToEdit.monthlyGoal || 0,
        });
      } else {
        form.reset({
          displayName: "",
          reMatricula: "",
          email: "",
          employmentType: "CLT",
          role: isDistributor ? "vendedor" : "tecnico",
          allowWhatsappAccess: true,
          phone: "",
          whatsapp: "",
          document: "",
          cep: "",
          street: "",
          number: "",
          neighborhood: "",
          city: "",
          state: "",
          avatarUrl: "",
          commissionPercentage: company?.defaultCommissionPercentage || 0,
          monthlyGoal: company?.defaultMonthlyGoal || 0,
        });
      }
    }
  }, [isOpen, isEditing, memberToEdit, form, isDistributor, company]);

  const handleCepBlur = async (cep: string) => {
    const cepOnlyNumbers = cep.replace(/\D/g, '');
    if (cepOnlyNumbers.length !== 8) {
      return;
    }
    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepOnlyNumbers}/json/`);
      const data = await response.json();
      if (!data.erro) {
        form.setValue('street', data.logradouro);
        form.setValue('neighborhood', data.bairro);
        form.setValue('city', data.localidade);
        form.setValue('state', data.uf);
      } else {
        toast({
          variant: "destructive",
          title: "CEP não encontrado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao buscar CEP",
      });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof currentFormSchema>) => {
    if (!userProfile?.companyId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "ID da empresa não encontrado.",
      });
      return;
    }
    setIsLoading(true);

    try {
      if (isEditing && memberToEdit) {
        // Handle update
        await onUpdateMember(memberToEdit.uid, values as Partial<UserProfile>);
      } else if ('email' in values) {
        // Handle invite
        await inviteTeamMember(firebase.db, firebase.auth, {
          companyId: userProfile.companyId,
          userData: values,
        });

        toast({
          title: "Usuário Criado com Sucesso!",
          description: `O novo ${isDistributor ? 'vendedor' : 'colaborador'} foi adicionado. Um email com as instruções de acesso será enviado.`,
          duration: 8000,
        });
        onInviteSuccess();
      }
      setOpen(false);
    } catch (error: any) {
      console.error("Error inviting/updating member:", error);
      toast({
        variant: "destructive",
        title: `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'}`,
        description: error.message || `Não foi possível ${isEditing ? 'atualizar' : 'cadastrar'} o ${isDistributor ? 'vendedor' : 'colaborador'}. Tente novamente.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const role = form.watch("role");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) form.reset();
      }}
    >
      <DialogContent className="sm:max-w-5xl h-full max-h-[90vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[3rem]">
        <DialogHeader className="p-8 pb-6 bg-primary/5 border-b border-border/40">
          <div className="flex items-center gap-5">
            <div className="p-3 rounded-2xl bg-primary shadow-lg shadow-primary/20 text-white">
              <User className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-primary">
                {isEditing ? `Perfil de ${formatDisplayName(memberToEdit?.displayName)}` : `Novo Funcionario`}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-medium opacity-70">
                Configure as credenciais e informações profissionais do colaborador.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <Form {...form}>
            <form id="member-form" onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-[0.2em] mb-4">
                  <div className="bg-primary text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] shadow-lg shadow-primary/20">1</div>
                  Informações Pessoais
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <User className="h-3 w-3" /> Nome Completo
                        </FormLabel>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input placeholder={`Nome completo do ${isDistributor ? 'vendedor' : 'colaborador'}`} {...field} className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm" tabIndex={1} />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="reMatricula"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <Hash className="h-3 w-3" /> RE / Matrícula
                        </FormLabel>
                        <div className="relative">
                          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input {...field} className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm" placeholder="Digite o RE ou matrícula" />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="employmentType"
                  render={({ field }) => (
                    <FormItem className="space-y-4 rounded-[2rem] border border-border/40 bg-primary/5 p-6 shadow-inner">
                      <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                        <FileText className="h-3 w-3" /> Tipo de Vínculo Contratual
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-1 md:grid-cols-2 gap-3"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0 bg-background/80 p-4 rounded-2xl border border-border/40 w-full cursor-pointer hover:bg-background transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm">
                            <FormControl><RadioGroupItem value="CLT" className="h-4 w-4 border-primary/20 text-primary" /></FormControl>
                            <FormLabel className="font-semibold text-sm cursor-pointer text-primary/80">Funcionário (Regime CLT)</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0 bg-background/80 p-4 rounded-2xl border border-border/40 w-full cursor-pointer hover:bg-background transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm">
                            <FormControl><RadioGroupItem value="freelance" className="h-4 w-4 border-primary/20 text-primary" /></FormControl>
                            <FormLabel className="font-semibold text-sm cursor-pointer text-primary/80">Prestador (Freelance / PJ)</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="text-[10px] font-semibold" />
                    </FormItem>
                  )}
                />
                {!isEditing && (
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <Mail className="h-3 w-3" /> E-mail Profissional
                        </FormLabel>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="email@gestonora.com"
                              {...field}
                              className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm"
                              tabIndex={2}
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <Smartphone className="h-3 w-3" /> Telefone Principal
                        </FormLabel>
                        <div className="relative">
                          <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input
                              placeholder="ex: (11) 99999-9999"
                              {...field}
                              autoComplete="tel"
                              onChange={(e) => {
                                const formatted = formatPhone(e.target.value);
                                field.onChange(formatted);
                              }}
                              className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm"
                              tabIndex={5}
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <Smartphone className="h-3 w-3" /> WhatsApp
                        </FormLabel>
                        <div className="relative">
                          <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input
                              placeholder="ex: (11) 99999-9999"
                              {...field}
                              autoComplete="tel"
                              onChange={(e) => {
                                const formatted = formatPhone(e.target.value);
                                field.onChange(formatted);
                              }}
                              className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm"
                              tabIndex={6}
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/60 mb-2">
                        <FileText className="h-3 w-3" /> CPF / CNPJ
                      </FormLabel>
                      <div className="relative">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input
                            placeholder="ex: 123.456.789-00"
                            {...field}
                            autoComplete="off"
                            onChange={(e) => {
                              const formatted = formatCpfCnpj(e.target.value);
                              field.onChange(formatted);
                            }}
                            className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm"
                            tabIndex={7}
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-[10px] font-semibold" />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-[0.2em] mb-4">
                  <div className="bg-primary text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] shadow-lg shadow-primary/20">2</div>
                  Endereço Residencial
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-6">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">CEP</FormLabel>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input
                              placeholder="00000-000"
                              {...field}
                              onBlur={(e) => handleCepBlur(e.target.value)}
                              onChange={(e) => {
                                const formatted = formatCep(e.target.value);
                                field.onChange(formatted);
                              }}
                              className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm"
                              tabIndex={8}
                            />
                          </FormControl>
                          {isFetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-4">
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <MapIcon className="h-3 w-3" /> Logradouro
                        </FormLabel>
                        <div className="relative">
                          <MapIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input placeholder="Rua, Avenida..." {...field} className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm" tabIndex={9} />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-1">
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <Hash className="h-3 w-3" /> Nº
                        </FormLabel>
                        <div className="relative">
                          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input placeholder="123" {...field} className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm" tabIndex={10} />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="neighborhood"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-3">
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/60 mb-2">
                          <Home className="h-3 w-3" /> Bairro
                        </FormLabel>
                        <div className="relative">
                          <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input {...field} className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm" tabIndex={11} />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-3">
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <Building className="h-3 w-3" /> Cidade
                        </FormLabel>
                        <div className="relative">
                          <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input {...field} className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm" tabIndex={12} />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                          <MapIcon className="h-3 w-3" /> Estado (UF)
                        </FormLabel>
                        <div className="relative">
                          <MapIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input {...field} className="pl-12 h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm" tabIndex={13} />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[10px] font-semibold" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                      <ClipboardList className="h-3 w-3" /> Função no Sistema
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} >
                      <FormControl>
                        <SelectTrigger tabIndex={3} className="h-12 rounded-2xl bg-background border-border/40 focus:ring-primary/20 transition-all font-semibold shadow-sm">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Selecione uma função profissional" />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-[2rem] border-border/40 shadow-2xl backdrop-blur-3xl bg-background/90">
                        {isDistributor ? (
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="tecnico">Técnico</SelectItem>
                            <SelectItem value="surveyor">Vistoriador</SelectItem>
                            <SelectItem value="comprador">Comprador</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                            {isDeveloper && <SelectItem value="developer">Desenvolvedor</SelectItem>}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allowWhatsappAccess"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-background/50 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-green-500" />
                        Acesso à NORA via WhatsApp
                      </FormLabel>
                      <FormDescription className="text-[11px] text-muted-foreground">
                        Permite que este colaborador converse e envie comandos para a NORA pelo WhatsApp.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {role === 'vendedor' && (
                <>
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-[0.2em] mt-8 mb-4">
                    <div className="bg-primary text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] shadow-lg shadow-primary/20">3</div>
                    Metas e Comissões
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="commissionPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                            <Percent className="h-3 w-3" /> Comissão (%)
                          </FormLabel>
                          <div className="relative">
                            <Percent className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl>
                              <Input type="number" placeholder="Ex: 5" {...field} className="pl-12 h-12 rounded-2xl bg-background/50 border-border/40 focus:ring-primary/20 transition-all font-semibold" />
                            </FormControl>
                          </div>
                          <FormMessage className="text-[10px] font-semibold" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="monthlyGoal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                            <DollarSign className="h-3 w-3" /> Meta Mensal (R$)
                          </FormLabel>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl>
                              <Input type="number" placeholder="Ex: 10.000" {...field} className="pl-12 h-12 rounded-2xl bg-background/50 border-border/40 focus:ring-primary/20 transition-all font-semibold" />
                            </FormControl>
                          </div>
                          <FormMessage className="text-[10px] font-semibold" />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}
              <FormField
                control={form.control}
                name="avatarUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-4">
                      <ImageIcon className="h-3 w-3" /> Ícone / Avatar de Identificação
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-4 sm:grid-cols-6 gap-2"
                      >
                        {avatarOptions.map((avatar) => (
                          <FormItem key={avatar.id} className="flex items-center justify-center">
                            <FormControl>
                              <RadioGroupItem value={avatar.url} id={avatar.id} className="sr-only peer" />
                            </FormControl>
                            <Label
                              htmlFor={avatar.id}
                              className={cn(
                                "rounded-full border-2 border-transparent w-16 h-16 p-1 cursor-pointer",
                                "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary"
                              )}
                            >
                              <Image src={avatar.url} alt={avatar.name} width={64} height={64} className="rounded-full" />
                            </Label>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </ScrollArea>
        <DialogFooter className="p-8 pt-6 bg-primary/5 border-t border-border/40 backdrop-blur-xl flex gap-4">
          <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none rounded-2xl h-14 font-semibold text-muted-foreground hover:bg-black/5">
            Cancelar
          </Button>
          <Button type="submit" form="member-form" disabled={isLoading} className="flex-1 sm:flex-none px-12 h-14 rounded-2xl font-semibold text-base shadow-2xl shadow-primary/30 transition-all active:scale-[0.98]">
            {isLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
            {isEditing ? "Salvar Alterações" : "Cadastrar Colaborador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
