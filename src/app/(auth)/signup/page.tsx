

"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../../components/ui/form";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../hooks/use-toast";
import { LoaderCircle, User, Mail, Lock, Eye, EyeOff, Building, FileText, Phone, Smartphone, MapPin, Home, Map as MapIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../../../firebase/auth/use-user";
import { createUserProfile } from "../../../lib/firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";

const formSchema = z.object({
  accountType: z.enum(["empresa", "distribuidor"]),
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  email: z.string().email("Por favor, insira um email válido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  confirmPassword: z.string(),
  companyName: z.string().optional(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não correspondem.",
  path: ["confirmPassword"],
}).superRefine((data, ctx) => {
    if (data.accountType === 'empresa') {
      if (!data.companyName || data.companyName.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "O nome da empresa deve ter pelo menos 3 caracteres.",
          path: ["companyName"],
        });
      }
      if (!data.cnpj || data.cnpj.length < 14) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "O CNPJ deve ter pelo menos 14 caracteres.",
          path: ["cnpj"],
        });
      }
    }
     if (data.accountType === 'distribuidor') {
        if (!data.phone || data.phone.length < 10) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "O telefone é obrigatório.",
                path: ["phone"],
            });
        }
        if (!data.cep || data.cep.length < 8) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "O CEP é obrigatório.",
                path: ["cep"],
            });
        }
    }
  });

function SignupPageContent() {
  const [isLoading, setLoading] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebase } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const formatCnpj = (value: string) => {
    if (!value) return value;
    const cnpj = value.replace(/\D/g, '');
    if (cnpj.length <= 2) return cnpj;
    if (cnpj.length <= 5) return `${cnpj.slice(0, 2)}.${cnpj.slice(2)}`;
    if (cnpj.length <= 8) return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5)}`;
    if (cnpj.length <= 12) return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8)}`;
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
  };
  
   const formatPhone = (value: string) => {
    if (!value) return value;
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 2) return `(${phone}`;
    if (phone.length <= 6) return `(${phone.slice(0, 2)}) ${phone.slice(2)}`;
    if (phone.length <= 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7, 11)}`;
  };
  
  const formatCep = (value: string) => {
    if (!value) return value;
    const cep = value.replace(/\D/g, "").slice(0, 8);
    if (cep.length <= 5) return cep;
    return `${cep.slice(0, 5)}-${cep.slice(5, 8)}`;
  };

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


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      accountType: "empresa",
      name: "", 
      email: "", 
      password: "", 
      confirmPassword: "",
      companyName: "",
      cnpj: "",
      phone: "",
      whatsapp: "",
      cep: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
    },
  });
  
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    if (!firebase) {
        toast({ variant: "destructive", title: "Erro de Inicialização", description: "Serviço de autenticação indisponível." });
        setLoading(false);
        return;
    }

    const isDistributor = values.accountType === "distribuidor";
    const plan = isDistributor ? "distribuidor" : (searchParams?.get('plan') as "Essencial" | "Profissional" | "Enterprise") || 'Periodo Teste';
    const companyName = isDistributor ? values.name : values.companyName!;
    const cnpj = values.cnpj || '';
    
    const extraData = isDistributor ? {
        phone: values.phone,
        whatsapp: values.whatsapp,
        cep: values.cep,
        street: values.street,
        number: values.number,
        neighborhood: values.neighborhood,
        city: values.city,
        state: values.state,
    } : {};


    try {
        const userCredential = await createUserWithEmailAndPassword(firebase.auth, values.email, values.password);
        const user = userCredential.user;

        await createUserProfile(firebase.db, user, companyName, cnpj, plan, values.name, extraData);

        toast({ title: "Sucesso!", description: "Conta criada com sucesso. Redirecionando para seu painel..." });
        window.location.href = "/dashboard";

    } catch (error: any) {
        let description = "Ocorreu um erro desconhecido ao criar a conta.";
        if (error.code === 'auth/email-already-in-use') {
            description = "Este e-mail já está cadastrado. Por favor, tente com outro e-mail.";
        } else if (error.message) {
            description = error.message;
        }
        toast({ variant: "destructive", title: "Erro ao Criar Conta", description: description });
        setLoading(false);
    }
  };
  
  const accountType = form.watch("accountType");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
            <div className="relative size-16 mb-4">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20transparente.png?alt=media&token=2d5b0b94-7dd8-47e2-9d6b-32779ad80b84" alt="NORA Logo" width={64} height={64} className="rounded-lg" />
            </div>
        <CardTitle className="text-xl">Crie sua Conta</CardTitle>
        <CardDescription>
            Escolha o tipo de conta e preencha seus dados para começar.
        </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Qual tipo de conta você deseja criar?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4 pt-2"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="empresa" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Quero gerenciar minha empresa de serviços
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="distribuidor" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Sou um distribuidor de produtos
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                      <FormLabel>{accountType === 'distribuidor' ? 'Nome do Distribuidor / Empresa' : 'Seu Nome Completo'}</FormLabel>
                      <FormControl>
                      <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                              placeholder={accountType === 'distribuidor' ? 'Digite o nome do seu negócio' : 'Digite seu nome completo'}
                              {...field}
                              ref={nameInputRef}
                              autoComplete="name"
                              className="pl-10"
                          />
                      </div>
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Seu Email</FormLabel>
                    <FormControl>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Digite seu melhor email" {...field} autoComplete="email" className="pl-10" />
                    </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                        <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Crie uma senha"
                            {...field}
                            autoComplete="new-password"
                            className="pl-10 pr-10"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            >
                            {showPassword ? <EyeOff /> : <Eye />}
                            </Button>
                        </div>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                        <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirme a senha"
                            {...field}
                            autoComplete="new-password"
                            className="pl-10 pr-10"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                            {showConfirmPassword ? <EyeOff /> : <Eye />}
                            </Button>
                        </div>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            {accountType === "empresa" && (
            <>
                <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nome da Empresa</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Digite o nome da empresa"
                                    {...field}
                                    autoComplete="organization"
                                    className="pl-10"
                                />
                            </div>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )
                    }
                />
                <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Digite o CNPJ da sua empresa" 
                                {...field}
                                onChange={(e) => {
                                const formatted = formatCnpj(e.target.value);
                                field.onChange(formatted);
                                }}
                                className="pl-10"
                            />
                        </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </>
            )}

            {accountType === 'distribuidor' && (
              <>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField name="phone" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input {...field} onChange={(e)=>field.onChange(formatPhone(e.target.value))} className="pl-10" /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField name="whatsapp" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel>WhatsApp</FormLabel>
                            <div className="relative">
                                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input {...field} onChange={(e)=>field.onChange(formatPhone(e.target.value))} className="pl-10" /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>
                 <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>CNPJ (Opcional)</FormLabel>
                        <FormControl>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Digite o CNPJ da sua empresa" 
                                {...field}
                                onChange={(e) => {
                                const formatted = formatCnpj(e.target.value);
                                field.onChange(formatted);
                                }}
                                className="pl-10"
                            />
                        </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField name="cep" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                            <Input {...field} onBlur={(e)=>handleCepBlur(e.target.value)} onChange={(e)=>field.onChange(formatCep(e.target.value))} className="pl-10" />
                        </FormControl>
                        {isFetchingCep && <LoaderCircle className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin"/>}
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
                             <div className="relative">
                                <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input {...field} className="pl-10" /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                     )}/>
                 </div>
              </>
            )}

            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading ? <LoaderCircle className="animate-spin" /> : "Finalizar Cadastro"}
            </Button>
            </form>
        </Form>
        <div className="mt-4 text-center text-sm">
            Já possui uma conta?{" "}
            <Link href="/login" className="underline hover:text-primary">
            Faça login
            </Link>
            {' | '}
            <Link href="/planos" className="underline hover:text-primary">
                Ver Planos
            </Link>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
    return (
      <Suspense fallback={<div>Carregando...</div>}>
        <SignupPageContent />
      </Suspense>
    );
}

