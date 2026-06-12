
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/firebase/auth/use-user";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Building, FileText, Home, Lock, Mail, MapPin, Phone, Save, Smartphone, User } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { getClient, updateClient } from "@/lib/firebase/firestore";
import { Client } from "@/lib/data";

const clientFormSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  phone: z.string().min(10, "O telefone deve ter pelo menos 10 caracteres."),
  whatsapp: z.string().optional(),
  document: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

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
    const document = value.replace(/\D/g, "");
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

export default function MyDataPage() {
  const { userProfile, signOut, company, firebase } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [clientData, setClientData] = useState<Client | null>(null);

  const form = useForm<z.infer<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
  });

  useEffect(() => {
    if (userProfile?.clientId && firebase.db) {
      getClient(firebase.db, userProfile.clientId).then(data => {
        if(data) {
          setClientData(data);
          form.reset(data);
        }
      });
    }
  }, [userProfile?.clientId, form, firebase.db]);

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

  const onSubmit = async (values: z.infer<typeof clientFormSchema>) => {
    if (!userProfile?.clientId || !firebase.db || !firebase.auth) return;
    setIsSaving(true);
    try {
      await updateClient(firebase.db, userProfile.clientId, values);
      toast({ title: "Sucesso!", description: "Seus dados foram atualizados." });
      router.push('/cliente/dashboard');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!clientData) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 md:p-6">
      <header className="bg-background/80 backdrop-blur-md border-b p-4 sticky top-0 z-50 shadow-sm -m-4 md:-m-6 mb-8">
          <div className="max-w-7xl mx-auto flex justify-between items-center px-4 md:px-6">
              <div className="flex items-center gap-4">
                  {company?.logoUrl && (
                      <div className="relative h-10 w-28">
                          <Image src={company.logoUrl} alt={company.name || 'Logo'} fill style={{objectFit:'contain'}} sizes="112px"/>
                      </div>
                  )}
                   <h1 className="text-xl font-semibold text-primary hidden sm:block tracking-tight">Perfil do Cliente</h1>
              </div>
              <nav className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => router.push('/cliente/dashboard')} className="rounded-xl hover:bg-primary/5 font-semibold">
                    <ArrowLeft className="mr-2 h-4 w-4"/>
                    Dashboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={signOut} className="rounded-xl font-semibold border-2">Sair</Button>
              </nav>
          </div>
      </header>
      
      <Card className="max-w-4xl mx-auto border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-background">
        <CardHeader className="bg-muted/30 p-8 md:p-10">
          <CardTitle className="font-semibold tracking-tight flex items-center gap-3 text-xl">
            <div className="bg-primary/10 p-3 rounded-2xl"><User className="h-8 w-8 text-primary" /></div>
            Informações Cadastrais
          </CardTitle>
          <CardDescription className="text-lg">Gerencie seus dados e mantenha seu cadastro atualizado para melhor atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 md:p-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
               <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo / Razão Social</FormLabel>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl><Input {...field} className="pl-10" /></FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}/>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormItem>
                        <FormLabel>Email</FormLabel>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl><Input value={clientData.email} className="pl-10" disabled /></FormControl>
                        </div>
                      </FormItem>
                     <FormField name="document" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel>CPF / CNPJ</FormLabel>
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
                            <FormLabel>Telefone</FormLabel>
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
                            <FormLabel>WhatsApp</FormLabel>
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
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField name="cep" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>CEP</FormLabel>
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
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl><Input {...field} className="pl-10" /></FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField name="number" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField name="neighborhood" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )}/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField name="city" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input {...field} className="pl-10" /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}/>
                     <FormField name="state" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl><Input {...field} /></FormControl><FormMessage />
                        </FormItem>
                     )}/>
                 </div>

                 {clientData.isComodato && (
                    <Card className="bg-muted/50">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2"><Lock/> Contrato de Comodato</CardTitle>
                            <CardDescription>As informações do seu contrato de comodato não podem ser alteradas por aqui. Entre em contato com o suporte para mais detalhes.</CardDescription>
                        </CardHeader>
                    </Card>
                 )}

                <div className="flex justify-end pt-8">
                  <Button type="submit" disabled={isSaving} size="lg" className="rounded-2xl px-10 h-14 text-lg font-semibold shadow-xl hover:scale-105 transition-transform">
                    {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                    Salvar Alterações
                  </Button>
                </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
