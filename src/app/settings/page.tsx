
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/firebase/auth/use-user";
import { getTeamMembers, updateCompany, updateTeamMember, migrateProductManufacturers } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Building, Trash2, KeyRound, Save, Copy, Check, ShieldQuestion, ImageIcon, User, Smartphone, MapPin, Database, Home, Map as MapIcon, ClipboardList, Clock, Percent, DollarSign, Crown, FileText, ShieldCheck, Users, BadgeCheck, UserPlus, Settings2 } from "lucide-react";
import Image from "next/image";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import type { Company, Role, RolePermissions, UserProfile } from "@/lib/data";
import { defaultPermissions, roleLabels, allMenuItems } from "@/lib/permissions";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { avatarOptions } from "@/lib/avatars";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import WhatsappConnectionTab from "@/components/settings/whatsapp-connection-tab";


export const dynamic = 'force-dynamic';

const companyFormSchema = z.object({
  name: z.string().min(2, "O nome da empresa é obrigatório."),
  logoUrl: z.string().optional(),
  signatureUrl: z.string().optional(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pixKey: z.string().optional(),
  
  focusNfeHomologationToken: z.string().optional(),
  focusNfeProductionToken: z.string().optional(),
  focusNfeEnvironment: z.enum(['homologacao', 'producao']).optional(),
  comodatoContractTemplate: z.string().optional(),
  permissions: z.any().optional(),

  nome_fantasia: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  inscricao_municipal: z.string().optional(),
  codigo_municipio: z.string().optional(),
  regime_tributario: z.enum(["1", "2", "3", "4"]).optional(),
  item_lista_servico: z.string().optional(),
  codigo_tributario_municipio: z.string().optional(),
  codigo_cnae: z.string().optional(),
  nome_responsavel: z.string().optional(),
  cpf_responsavel: z.string().optional(),
  aliq_pis: z.coerce.number().optional(),
  habilita_nfe: z.boolean().optional(),
  habilita_nfse: z.boolean().optional(),
  defaultCommissionPercentage: z.coerce.number().min(0).optional(),
  defaultMonthlyGoal: z.coerce.number().min(0).optional(),
  logoFontColor: z.string().optional(),
  ai_autonomy: z.object({
    finance_active: z.boolean().default(false),
    stock_active: z.boolean().default(false),
    marketing_active: z.boolean().default(false),
    operational_active: z.boolean().default(false),
  }).optional(),
});

const distributorProfileSchema = z.object({
  displayName: z.string().min(3, "O nome é obrigatório."),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  avatarUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  nameColor: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  workingHours: z.string().optional(),
});

type FormData = z.infer<typeof companyFormSchema>;

const formatCep = (value: string) => {
    if (!value) return value;
    const cep = value.replace(/\D/g, "").slice(0, 8);
    if (cep.length <= 5) return cep;
    return `${cep.slice(0, 5)}-${cep.slice(5, 8)}`;
};

const formatPhone = (value: string) => {
    if (!value) return value;
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 2) return `(${phone}`;
    if (phone.length <= 6) return `(${phone.slice(0, 2)}) ${phone.slice(2)}`;
    if (phone.length <= 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7, 11)}`;
};

const PlaceholderTag = ({ text }: { text: string }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{text}</code>
);


function DistributorSettings() {
  const { userProfile, company, firebase, setCompany } = useAuth();
  const { toast } = useToast();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<z.infer<typeof distributorProfileSchema>>({
    resolver: zodResolver(distributorProfileSchema),
  });

  const companySettingsForm = useForm<Partial<Company>>({
    // Using a partial schema for company settings
  });

  useEffect(() => {
    if (userProfile) {
      profileForm.reset({
        displayName: userProfile.displayName || "",
        phone: userProfile.phone || "",
        whatsapp: userProfile.whatsapp || "",
        avatarUrl: userProfile.avatarUrl || "",
        logoUrl: userProfile.logoUrl || "",
        nameColor: userProfile.nameColor || "#000000",
        cep: userProfile.cep || "",
        street: userProfile.street || "",
        number: userProfile.number || "",
        neighborhood: userProfile.neighborhood || "",
        city: userProfile.city || "",
        state: userProfile.state || "",
        workingHours: userProfile.workingHours || "",
      });
      setLogoPreview(userProfile.logoUrl || null);
    }
  }, [userProfile, profileForm]);

  useEffect(() => {
    if (company) {
      companySettingsForm.reset({
        defaultCommissionPercentage: company.defaultCommissionPercentage || 0,
        defaultMonthlyGoal: company.defaultMonthlyGoal || 0,
        permissions: company.permissions || defaultPermissions,
      });
    }
  }, [company, companySettingsForm]);

  const handleCepBlur = async (cep: string) => {
    const cepOnlyNumbers = cep.replace(/\D/g, "");
    if (cepOnlyNumbers.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepOnlyNumbers}/json/`);
      const data = await response.json();
      if (!data.erro) {
        profileForm.setValue("street", data.logradouro);
        profileForm.setValue("neighborhood", data.bairro);
        profileForm.setValue("city", data.localidade);
        profileForm.setValue("state", data.uf);
      } else {
        toast({ variant: "destructive", title: "CEP não encontrado" });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao buscar CEP" });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleFileUpload = async (file: File | null): Promise<string | undefined> => {
    if (!file || !userProfile) return undefined;
    
    const { storage } = firebase;
    const filePath = `logos/distributors/${userProfile.uid}/${file.name}-${Date.now()}`;
    const storageRef = ref(storage, filePath);
    
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            try {
                await uploadString(storageRef, reader.result as string, 'data_url');
                const downloadUrl = await getDownloadURL(storageRef);
                resolve(downloadUrl);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = error => reject(error);
    });
  };

  const onProfileSubmit = async (values: z.infer<typeof distributorProfileSchema>) => {
    if (!userProfile) return;
    setIsSavingProfile(true);
    try {
      const newLogoUrl = await handleFileUpload(logoFile);
      const dataToSave: { [key: string]: any } = {
        ...values,
        logoUrl: newLogoUrl || values.logoUrl,
      };

       const addressChanged = values.street !== userProfile.street ||
                           values.number !== userProfile.number ||
                           values.city !== userProfile.city ||
                           values.state !== userProfile.state ||
                           values.cep !== userProfile.cep;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey && values.cep && (addressChanged || !userProfile.latitude || !userProfile.longitude)) {
        const address = `${values.street}, ${values.number}, ${values.city}, ${values.state}`;
        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
            const geoData = await response.json();
            if (geoData.status === 'OK' && geoData.results.length > 0) {
                const location = geoData.results[0].geometry.location;
                dataToSave.latitude = location.lat;
                dataToSave.longitude = location.lng;
            }
        } catch (error) {
            console.error("Geocoding failed for distributor:", error);
        }
      }


      await updateTeamMember(firebase.db, userProfile.uid, dataToSave);
      toast({ title: "Sucesso!", description: "Seus dados foram atualizados." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
    } finally {
      setIsSavingProfile(false);
    }
  };
  
  const onCompanySettingsSubmit = async (values: Partial<Company>) => {
    if (!company) return;
    setIsSavingCompany(true);
    try {
      const dataToSave: Partial<Company> = {
        defaultCommissionPercentage: Number(values.defaultCommissionPercentage) || 0,
        defaultMonthlyGoal: Number(values.defaultMonthlyGoal) || 0,
        permissions: values.permissions,
      };
      await updateCompany(firebase.db, company.id, dataToSave);
      setCompany(prev => prev ? { ...prev, ...dataToSave } : null);
      toast({ title: "Sucesso!", description: "Configurações de vendedores salvas." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
    } finally {
      setIsSavingCompany(false);
    }
  };
  
   const renderPermissionsForm = (formInstance: any, role: Role) => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
        {allMenuItems
          .filter(i => i.page !== 'developer' && defaultPermissions[role]?.[i.page])
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((item) => (
          <div key={item.page} className="flex items-center justify-between rounded-md p-2 border">
            <span className="font-medium text-xs">{item.label}</span>
            <div className="flex items-center gap-2">
              {['view', 'edit', 'delete'].map(action => (
                <TooltipProvider key={action}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1">
                        <FormField
                          control={formInstance.control}
                          name={`permissions.${role}.${item.page}.${action}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:h-5 data-[state=unchecked]:h-5 data-[state=checked]:w-9 data-[state=unchecked]:w-9 [&>span]:data-[state=checked]:translate-x-4 [&>span]:data-[state=unchecked]:translate-x-0"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormLabel className="text-xs font-normal">{action.charAt(0)}</FormLabel>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{action === 'view' ? 'Ver' : action === 'edit' ? 'Editar' : 'Deletar'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        ))}
      </div>
  );


  return (
    <div className="flex flex-col h-full gap-4">
        <Tabs defaultValue="minha-conta" className="w-full flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="minha-conta">Minha Conta</TabsTrigger>
                <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
            </TabsList>
            <TabsContent value="minha-conta" className="mt-4 flex-1">
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader><CardTitle>Informações Principais</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                <FormField control={profileForm.control} name="displayName" render={({ field }) => (
                                    <FormItem><FormLabel>Nome de Exibição do Distribuidor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                                )}/>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={profileForm.control} name="phone" render={({ field }) => (
                                        <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))}/></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={profileForm.control} name="whatsapp" render={({ field }) => (
                                        <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))}/></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <FormField control={profileForm.control} name="workingHours" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Horário de Funcionamento</FormLabel>
                                        <FormControl><Textarea placeholder="Ex: Seg-Sex: 08h-18h, Sáb: 08h-12h" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Identidade Visual</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <FormItem>
                                        <FormLabel>Logotipo do Distribuidor</FormLabel>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="relative w-24 h-24 border-2 border-dashed rounded-md flex items-center justify-center bg-muted">
                                                {logoPreview ? (
                                                    <Image src={logoPreview} alt="Logo Preview" layout="fill" objectFit="contain" sizes="96px" />
                                                ) : <ImageIcon className="h-10 w-10 text-muted-foreground" />}
                                            </div>
                                            <div className="space-y-2">
                                                <input type="file" accept="image/*" className="hidden" ref={logoInputRef}
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            setLogoFile(e.target.files[0]);
                                                            setLogoPreview(URL.createObjectURL(e.target.files[0]));
                                                        }
                                                    }}
                                                />
                                                <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}><Upload className="mr-2" />Carregar Logo</Button>
                                                <p className="text-xs text-muted-foreground">PNG, JPG, SVG.</p>
                                            </div>
                                        </div>
                                    </FormItem>
                                    <Separator/>
                                    <FormField control={profileForm.control} name="nameColor" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cor do Nome</FormLabel>
                                            <FormControl>
                                                <Input type="color" {...field} className="h-10 p-1" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </CardContent>
                            </Card>
                        </div>
                        <Card>
                            <CardHeader><CardTitle>Endereço</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={profileForm.control} name="cep" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CEP</FormLabel>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <FormControl><Input {...field} onBlur={(e)=>handleCepBlur(e.target.value)} onChange={(e)=>field.onChange(formatCep(e.target.value))} className="pl-10" /></FormControl>
                                            {isFetchingCep && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin"/>}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={profileForm.control} name="street" render={({ field }) => (
                                    <FormItem className="md:col-span-2"><FormLabel>Logradouro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                                )}/>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={profileForm.control} name="number" render={({ field }) => (
                                        <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={profileForm.control} name="neighborhood" render={({ field }) => (
                                        <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={profileForm.control} name="city" render={({ field }) => (
                                        <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={profileForm.control} name="state" render={({ field }) => (
                                        <FormItem><FormLabel>Estado</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                            </CardContent>
                        </Card>
                         <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSavingProfile}>
                                {isSavingProfile ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                                Salvar Dados da Conta
                            </Button>
                        </div>
                    </form>
                </Form>
            </TabsContent>
            <TabsContent value="vendedores" className="mt-4 flex-1">
                 <Form {...companySettingsForm}>
                    <form onSubmit={companySettingsForm.handleSubmit(onCompanySettingsSubmit)} className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Padrões para Vendedores</CardTitle>
                                <CardDescription>Defina valores padrão que serão aplicados para cada novo vendedor cadastrado.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField name="defaultCommissionPercentage" control={companySettingsForm.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Comissão Padrão (%)</FormLabel>
                                            <div className="relative">
                                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl><Input type="number" {...field} className="pl-10" /></FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                     <FormField name="defaultMonthlyGoal" control={companySettingsForm.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Meta Mensal Padrão (R$)</FormLabel>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl><Input type="number" {...field} className="pl-10" /></FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </CardContent>
                        </Card>
                        
                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSavingCompany}>
                                {isSavingCompany ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                                Salvar Configurações de Vendedores
                            </Button>
                        </div>
                    </form>
                 </Form>
            </TabsContent>
        </Tabs>
    </div>
  );
}


function SettingsPageContent() {
  const { company, firebase, setCompany, isDeveloper } = useAuth();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState("empresa");
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      permissions: company?.permissions || defaultPermissions,
    },
  });

  const memberPermissionsForm = useForm();
  
  useEffect(() => {
    if (selectedMember) {
      const memberPerms = selectedMember.permissions || company?.permissions?.[selectedMember.role] || defaultPermissions[selectedMember.role];
      memberPermissionsForm.reset(memberPerms);
    }
  }, [selectedMember, company?.permissions, memberPermissionsForm]);
  

  const resetForm = useCallback(() => {
    if (company) {
      const mergedPermissions: Record<Role, RolePermissions> = JSON.parse(JSON.stringify(defaultPermissions));

      for (const role in mergedPermissions) {
        if (Object.prototype.hasOwnProperty.call(mergedPermissions, role)) {
          const typedRole = role as Role;
          if (company.permissions && company.permissions[typedRole]) {
            for (const page in mergedPermissions[typedRole]) {
              if (Object.prototype.hasOwnProperty.call(mergedPermissions[typedRole], page)) {
                if (company.permissions[typedRole][page]) {
                  mergedPermissions[typedRole][page] = {
                    ...mergedPermissions[typedRole][page],
                    ...company.permissions[typedRole][page]
                  };
                }
                const pagePerms = mergedPermissions[typedRole][page];
                pagePerms.view = pagePerms.view ?? false;
                pagePerms.edit = pagePerms.edit ?? false;
                pagePerms.delete = pagePerms.delete ?? false;
              }
            }
          }
        }
      }

      form.reset({
        ...company,
        permissions: mergedPermissions,
      });
      setLogoPreview(company.logoUrl || null);
      setSignaturePreview(company.signatureUrl || null);
    }
  }, [company, form]);


  useEffect(() => {
    resetForm();
  }, [company, resetForm]);

  useEffect(() => {
    if (!company?.id || !firebase.db) return;
    const unsubTeam = getTeamMembers(firebase.db, company.id, setTeamMembers, console.error);
    return () => unsubTeam();
  }, [company?.id, firebase.db]);
  
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
        form.setValue("codigo_municipio", data.ibge);
      } else {
        toast({ variant: "destructive", title: "CEP não encontrado" });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao buscar CEP" });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleFileUpload = async (file: File | null, type: 'logo' | 'signature'): Promise<string | undefined> => {
    if (!file || !firebase.auth.currentUser) return undefined;
    
    const { storage } = firebase;
    const filePath = `logos/${firebase.auth.currentUser.uid}/${type}-${Date.now()}-${file.name}`;
    const storageRef = ref(storage, filePath);
    
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            try {
                await uploadString(storageRef, reader.result as string, 'data_url');
                const downloadUrl = await getDownloadURL(storageRef);
                resolve(downloadUrl);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = error => reject(error);
    });
  };

  const onSubmit = async (data: FormData) => {
    if (!company) return;
    setIsSaving(true);
    
    try {
        const logoUrl = await handleFileUpload(logoFile, 'logo');
        const signatureUrl = await handleFileUpload(signatureFile, 'signature');
        
        const sanitizedPermissions = JSON.parse(JSON.stringify(data.permissions), (key, value) => {
          return value === undefined ? null : value;
        });

        const updateData: { [key: string]: any } = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const value = (data as any)[key];
                if (value !== undefined) { 
                    updateData[key] = value === '' ? null : value;
                }
            }
        }
        
        const addressChanged = data.street !== company.street ||
                             data.number !== company.number ||
                             data.city !== company.city ||
                             data.state !== company.state ||
                             data.cep !== company.cep;

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (apiKey && data.cep && (addressChanged || !company.latitude || !company.longitude)) {
            const address = `${data.street}, ${data.number}, ${data.city}, ${data.state}`;
            try {
                const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
                const geoData = await response.json();
                if (geoData.status === 'OK' && geoData.results.length > 0) {
                    const location = geoData.results[0].geometry.location;
                    updateData.latitude = location.lat;
                    updateData.longitude = location.lng;
                }
            } catch (error) {
                console.error("Geocoding failed for company:", error);
            }
        }

        updateData.permissions = sanitizedPermissions;
        if(logoUrl) updateData.logoUrl = logoUrl;
        if(signatureUrl) updateData.signatureUrl = signatureUrl;
        
        await updateCompany(firebase.db, company.id, updateData);
        
        toast({ title: "Sucesso!", description: "Configurações salvas com sucesso." });
        
        setLogoFile(null);
        setSignatureFile(null);
        
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Erro ao Salvar",
            description: error.message,
        });
    } finally {
        setIsSaving(false);
    }
  };

   const onMemberPermissionsSubmit = async (data: any) => {
      if (!selectedMember) return;
      setIsSaving(true);
      try {
        await updateTeamMember(firebase.db, selectedMember.uid, { permissions: data });
        toast({ title: "Sucesso!", description: `Permissões de ${selectedMember.displayName} salvas.` });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
      } finally {
        setIsSaving(false);
      }
   };
  
  const handleCopyPixKey = () => {
    if (!company?.pixKey) return;
    navigator.clipboard.writeText(company.pixKey).then(() => {
        setIsCopied(true);
        toast({ title: "Chave PIX copiada para a área de transferência!" });
        setTimeout(() => setIsCopied(false), 2000);
    });
  };
  
  const renderPermissionsForm = (formInstance: any, role?: Role) => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
        {allMenuItems
          .filter(i => i.page !== 'developer' && (!role || defaultPermissions[role]?.[i.page]))
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((item) => (
          <div key={item.page} className="flex items-center justify-between rounded-md p-2 border">
            <span className="font-medium text-xs">{item.label}</span>
            <div className="flex items-center gap-2">
              {['view', 'edit', 'delete'].map(action => (
                <TooltipProvider key={action}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1">
                        <FormField
                          control={formInstance.control}
                          name={role ? `permissions.${role}.${item.page}.${action}` : `${item.page}.${action}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:h-5 data-[state=unchecked]:h-5 data-[state=checked]:w-9 data-[state=unchecked]:w-9 [&>span]:data-[state=checked]:translate-x-4 [&>span]:data-[state=unchecked]:translate-x-0"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormLabel className="text-xs font-normal">{action.charAt(0)}</FormLabel>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{action === 'view' ? 'Ver' : action === 'edit' ? 'Editar' : 'Deletar'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        ))}
      </div>
  );

  const handleMigration = async () => {
    if (!company) return;
    setIsMigrating(true);
    try {
      const updatedCount = await migrateProductManufacturers(firebase.db, company.id);
      toast({
        title: "Normalização Concluída",
        description: `${updatedCount} fabricantes de produtos foram padronizados com sucesso.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro na Normalização",
        description: error.message,
      });
    } finally {
      setIsMigrating(false);
    }
  };
  
  if (!company) {
     return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        </div>
     );
  }
  
  return (
      <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
          <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
                  <div className="space-y-1 shrink-0">
                      <h1 className="font-semibold tracking-tighter flex items-center gap-3 truncate opacity-80 text-xl">
                          <Building className="text-primary h-8 w-8" /> 
                          Customizações
                      </h1>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.3em] text-muted-foreground opacity-100 ml-1">Configurações do Ecossistema</p>
                  </div>
                  <Button 
                      onClick={
                          activeTab === 'permissoes_individual' && selectedMember
                              ? memberPermissionsForm.handleSubmit(onMemberPermissionsSubmit)
                              : form.handleSubmit(onSubmit)
                      } 
                      disabled={isSaving}
                      className="h-12 w-full sm:w-auto shrink-0 shadow-premium rounded-2xl font-semibold uppercase tracking-widest bg-primary hover:scale-[1.02] active:scale-95 transition-all"
                  >
                      {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5"/>}
                      Salvar Alterações
                  </Button>
              </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0 px-4 md:px-8">
                <ScrollArea className="w-full whitespace-nowrap pb-4">
                    <TabsList className="inline-flex w-fit h-14 p-1.5 bg-background/40 backdrop-blur-3xl border border-border/40 rounded-2xl shadow-premium mb-2">
                        <TabsTrigger value="empresa" className="px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Empresa</TabsTrigger>
                        <TabsTrigger value="fiscal" className="px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Fiscal & NFS-e</TabsTrigger>
                        <TabsTrigger value="modelos" className="px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Modelos</TabsTrigger>
                        <TabsTrigger value="permissoes_grupo" className="px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Grupos</TabsTrigger>
                        <TabsTrigger value="permissoes_individual" className="px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Membros</TabsTrigger>
                        <TabsTrigger value="manutencao" className="px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Sistema</TabsTrigger>
                        <TabsTrigger value="whatsapp" className="px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-green-500 data-[state=active]:text-white">WhatsApp</TabsTrigger>
                        <TabsTrigger value="ai_autonomy" className="px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white"><div className="flex items-center gap-2"><Crown className="w-3 h-3"/> NORA Autonomia</div></TabsTrigger>
                    </TabsList>
                </ScrollArea>

                  
                  <TabsContent value="empresa" className="flex-1 mt-4 outline-none">
                      <div className="h-full bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-premium overflow-hidden">
                          <Form {...form}>
                              <form className="h-full flex flex-col">
                                  <ScrollArea className="flex-1">
                                      <div className="p-8 space-y-8">
                                          <div className="space-y-4">
                                              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground opacity-100">Identificação Jurídica</h3>
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                                  <FormField control={form.control} name="name" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Nome da Empresa</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                  )}/>
                                                  <FormField control={form.control} name="logoFontColor" render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Cor Logo (Cabeçalho)</FormLabel>
                                                          <FormControl>
                                                              <Input type="color" {...field} className="h-12 w-full p-1 rounded-xl bg-background/50 border-border/40 cursor-pointer shadow-sm" />
                                                          </FormControl>
                                                          <FormMessage />
                                                      </FormItem>
                                                  )}/>
                                                  <FormField control={form.control} name="cnpj" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">CNPJ</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                  )}/>
                                              </div>
                                          </div>

                                          <div className="space-y-4">
                                              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">canais de comunicação</h3>
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                  <FormField control={form.control} name="phone" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Telefone</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                  )}/>
                                                  <FormField control={form.control} name="whatsapp" render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">WhatsApp Business</FormLabel>
                                                          <div className="relative">
                                                              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                                                              <FormControl><Input placeholder="(00) 00000-0000" {...field} className="h-12 rounded-xl bg-background/50 border-border/40 pl-11 font-semibold" /></FormControl>
                                                          </div>
                                                          <FormMessage />
                                                      </FormItem>
                                                  )}/>
                                                  <FormField control={form.control} name="email" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">E-mail Corporativo</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                  )}/>
                                              </div>
                                          </div>

                                          <div className="space-y-4">
                                              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Localização e Sede</h3>
                                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                  <FormField control={form.control} name="cep" render={({ field }) => (
                                                          <FormItem>
                                                              <FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">CEP</FormLabel>
                                                              <div className="relative">
                                                                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                                                                  <FormControl>
                                                                      <Input 
                                                                          {...field} 
                                                                          onBlur={(e) => handleCepBlur(e.target.value)}
                                                                          onChange={(e) => field.onChange(formatCep(e.target.value))} 
                                                                          className="h-12 rounded-xl bg-background/50 border-border/40 pl-11 font-semibold" 
                                                                      />
                                                                  </FormControl>
                                                                  {isFetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary"/>}
                                                              </div>
                                                              <FormMessage />
                                                          </FormItem>
                                                      )}/>
                                                  <FormField control={form.control} name="street" render={({ field }) => (
                                                      <FormItem className="md:col-span-3"><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Logradouro / Endereço</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                  )}/>
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                  <FormField control={form.control} name="number" render={({ field }) => (
                                                          <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Número</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                      )}/>
                                                  <FormField control={form.control} name="neighborhood" render={({ field }) => (
                                                          <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Bairro</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                      )}/>
                                                  <FormField control={form.control} name="city" render={({ field }) => (
                                                          <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Cidade</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                      )}/>
                                                  <FormField control={form.control} name="state" render={({ field }) => (
                                                          <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Estado</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl><FormMessage/></FormItem>
                                                      )}/>
                                              </div>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-border/40">
                                              <div className="space-y-4">
                                                  <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground opacity-100">Identidade Visual (Logo)</h3>
                                                  <div className="flex items-center gap-6">
                                                      <div className="relative w-32 h-32 border-2 border-dashed border-border/40 rounded-2xl flex items-center justify-center bg-background/20 group hover:border-primary/25 transition-all transition-colors">
                                                          {logoPreview ? (
                                                              <Image src={logoPreview} alt="Logo Preview" layout="fill" objectFit="contain" className="p-2" />
                                                          ) : <ImageIcon className="h-10 w-10 text-primary/20" />}
                                                      </div>
                                                      <div className="space-y-3">
                                                          <input type="file" accept="image/*" className="hidden" id="logo-upload" onChange={(e) => {
                                                              if (e.target.files && e.target.files[0]) {
                                                                  setLogoFile(e.target.files[0]);
                                                                  setLogoPreview(URL.createObjectURL(e.target.files[0]));
                                                              }
                                                          }} />
                                                          <Button type="button" variant="outline" className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest border-border/40 hover:bg-primary/5" onClick={() => document.getElementById('logo-upload')?.click()}><Upload className="mr-2 h-4 w-4"/>Carregar Logo</Button>
                                                          <p className="text-[10px] font-semibold text-muted-foreground opacity-50 uppercase tracking-tight">PNG, JPG ou SVG. (Máx 2MB)</p>
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="space-y-4">
                                                  <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground opacity-100">Assinatura Certificada</h3>
                                                  <div className="flex items-center gap-6">
                                                      <div className="relative w-48 h-24 border-2 border-dashed border-border/40 rounded-2xl flex items-center justify-center bg-background/20 group hover:border-primary/25 transition-all transition-colors">
                                                          {signaturePreview ? (
                                                              <Image src={signaturePreview} alt="Signature Preview" layout="fill" objectFit="contain" className="p-2" />
                                                          ) : <ImageIcon className="h-10 w-10 text-primary/20" />}
                                                      </div>
                                                      <div className="space-y-3">
                                                          <input type="file" accept="image/png" className="hidden" id="signature-upload" onChange={(e) => {
                                                              if (e.target.files && e.target.files[0]) {
                                                                  setSignatureFile(e.target.files[0]);
                                                                  setSignaturePreview(URL.createObjectURL(e.target.files[0]));
                                                              }
                                                          }} />
                                                          <Button type="button" variant="outline" className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest border-border/40 hover:bg-primary/5" onClick={() => document.getElementById('signature-upload')?.click()}><Upload className="mr-2 h-4 w-4"/>Carregar Assinatura</Button>
                                                          <p className="text-[10px] font-semibold text-muted-foreground opacity-50 uppercase tracking-tight">PNG transparente obrigatório.</p>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  </ScrollArea>
                              </form>
                          </Form>
                      </div>
                  </TabsContent>
                  <TabsContent value="fiscal" className="flex-1 mt-4 outline-none">
                      <div className="h-full bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-premium overflow-hidden">
                          <Form {...form}>
                              <form className="h-full flex flex-col">
                                  <ScrollArea className="flex-1">
                                      <div className="p-8 space-y-8">
                                          <div className="space-y-4">
                                              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground opacity-100">Dados de Pagamento</h3>
                                              <FormField control={form.control} name="pixKey" render={({ field }) => (
                                                  <FormItem>
                                                  <FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Chave Pix para Recebimento</FormLabel>
                                                  <div className="relative">
                                                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                                                      <FormControl>
                                                      <Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 pl-11 pr-12 font-mono font-semibold" />
                                                      </FormControl>
                                                      <Button type="button" size="icon" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-primary/10 rounded-lg transition-all" onClick={handleCopyPixKey}>
                                                          {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground opacity-100" />}
                                                      </Button>
                                                  </div>
                                                  <FormMessage />
                                                  </FormItem>
                                              )}/>
                                          </div>

                                          <div className="space-y-6 pt-8 border-t border-border/40">
                                              <div className="flex items-center gap-3">
                                                  <FileText className="h-5 w-5 text-primary/60" />
                                                  <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground opacity-100">Integração FocusNFe (Notas Fiscais)</h3>
                                              </div>
                                              
                                              <FormField
                                                  control={form.control}
                                                  name="focusNfeEnvironment"
                                                  render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Ambiente de Processamento</FormLabel>
                                                      <Select onValueChange={field.onChange} value={field.value}>
                                                      <FormControl><SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold"><SelectValue/></SelectTrigger></FormControl>
                                                      <SelectContent className="rounded-2xl border-border/40 bg-background/80 backdrop-blur-3xl shadow-premium">
                                                          <SelectItem value="homologacao" className="rounded-lg font-semibold">Homologação (Sandbox)</SelectItem>
                                                          <SelectItem value="producao" className="rounded-lg font-semibold">Produção (Real)</SelectItem>
                                                      </SelectContent>
                                                      </Select>
                                                  </FormItem>
                                              )}/>

                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                  <FormField control={form.control} name="focusNfeHomologationToken" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Token de Homologação</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-mono text-xs" /></FormControl><FormMessage/></FormItem>
                                                  )}/>
                                                  <FormField control={form.control} name="focusNfeProductionToken" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Token de Produção</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-mono text-xs" /></FormControl><FormMessage/></FormItem>
                                                  )}/>
                                              </div>
                                          </div>

                                          <div className="space-y-6 pt-8 border-t border-border/40">
                                              <div className="flex items-center gap-3">
                                                  <ShieldCheck className="h-5 w-5 text-primary/60" />
                                                  <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground opacity-100">Parâmetros Tributários Municipais</h3>
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                  <FormField control={form.control} name="inscricao_municipal" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Inscrição Municipal</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl></FormItem>
                                                  )}/>
                                                  <FormField control={form.control} name="codigo_municipio" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Cód. Município (IBGE)</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl></FormItem>
                                                  )}/>
                                              </div>

                                              <FormField
                                                  control={form.control}
                                                  name="regime_tributario"
                                                  render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Regime Tributário</FormLabel>
                                                      <Select onValueChange={field.onChange} value={field.value}>
                                                      <FormControl><SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold"><SelectValue/></SelectTrigger></FormControl>
                                                      <SelectContent className="rounded-2xl border-border/40 bg-background/80 backdrop-blur-3xl shadow-premium">
                                                          <SelectItem value="1" className="rounded-lg font-semibold">Simples Nacional</SelectItem>
                                                          <SelectItem value="2" className="rounded-lg font-semibold">Simples Nacional (Excesso Sublimite)</SelectItem>
                                                          <SelectItem value="3" className="rounded-lg font-semibold">Regime Normal</SelectItem>
                                                          <SelectItem value="4" className="rounded-lg font-semibold">Lucro Presumido</SelectItem>
                                                      </SelectContent>
                                                      </Select>
                                                  </FormItem>
                                              )}/>

                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                  <FormField control={form.control} name="item_lista_servico" render={({ field }) => (
                                                      <FormItem className="md:col-span-1"><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Cód. Serviço (LC 116)</FormLabel><FormControl><Input placeholder="Ex: 14.06" {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl></FormItem>
                                                  )}/>
                                                  <FormField control={form.control} name="codigo_tributario_municipio" render={({ field }) => (
                                                      <FormItem className="md:col-span-1"><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Cód. Trib. Municipal</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl></FormItem>
                                                  )}/>
                                                  <FormField control={form.control} name="codigo_cnae" render={({ field }) => (
                                                      <FormItem className="md:col-span-1"><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">CNAE Principal</FormLabel><FormControl><Input placeholder="Apenas números" {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl></FormItem>
                                                  )}/>
                                              </div>

                                              <div className="max-w-xs">
                                                  <FormField control={form.control} name="aliq_pis" render={({ field }) => (
                                                      <FormItem><FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Alíquota Padrão ISS (%)</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-background/50 border-border/40 font-semibold" /></FormControl></FormItem>
                                                  )}/>
                                              </div>
                                          </div>
                                      </div>
                                  </ScrollArea>
                              </form>
                          </Form>
                      </div>
                  </TabsContent>
                  <TabsContent value="modelos" className="flex-1 mt-4 outline-none">
                      <div className="h-full bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-premium overflow-hidden flex flex-col">
                          <header className="p-8 pb-4 space-y-1">
                              <h3 className="text-xl font-semibold uppercase tracking-tighter opacity-80 flex items-center gap-2">
                                  <FileText className="h-5 w-5 text-primary" />
                                  Modelos de Documentos
                              </h3>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-muted-foreground opacity-100">Minuta dos Contratos Gerados</p>
                          </header>
                          <ScrollArea className="flex-1">
                              <div className="p-8 pt-0">
                                  <Form {...form}>
                                      <form className="space-y-6">
                                          <FormField
                                              control={form.control}
                                              name="comodatoContractTemplate"
                                              render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground opacity-100">Matriz do Contrato de Comodato</FormLabel>
                                                      <FormControl>
                                                          <Textarea
                                                              placeholder="Estrutura do contrato..."
                                                              {...field}
                                                              rows={25}
                                                              className="font-mono text-[11px] bg-background/50 border-border/40 rounded-2xl resize-none p-6 leading-relaxed selection:bg-primary/20 selection:text-primary"
                                                          />
                                                      </FormControl>
                                                      <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-border/40">
                                                          <h4 className="font-semibold uppercase text-[9px] tracking-widest text-primary mb-3">Placeholders Dinâmicos</h4>
                                                          <div className="flex flex-wrap gap-1.5">
                                                              <PlaceholderTag text="[NOME_DA_EMPRESA]" />
                                                              <PlaceholderTag text="[CNPJ_EMPRESA]" />
                                                              <PlaceholderTag text="[ENDERECO_EMPRESA]" />
                                                              <PlaceholderTag text="[NOME_CLIENTE]" />
                                                              <PlaceholderTag text="[DOCUMENTO_CLIENTE]" />
                                                              <PlaceholderTag text="[TAXA_INSTALACAO]" />
                                                              <PlaceholderTag text="[MENSALIDADE]" />
                                                              <PlaceholderTag text="[TABELA_EQUIPAMENTOS]" />
                                                              <PlaceholderTag text="[LISTA_SERVICOS]" />
                                                          </div>
                                                          <p className="text-[9px] font-semibold text-muted-foreground mt-3 uppercase">Pressione SALVAR para aplicar as alterações.</p>
                                                      </div>
                                                      <FormMessage />
                                                  </FormItem>
                                              )}
                                          />
                                      </form>
                                  </Form>
                              </div>
                          </ScrollArea>
                      </div>
                  </TabsContent>
                  <TabsContent value="permissoes_grupo" className="flex-1 mt-4 outline-none">
                      <div className="h-full bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-premium overflow-hidden flex flex-col">
                          <header className="p-8 pb-4 space-y-1">
                              <h3 className="text-xl font-semibold uppercase tracking-tighter opacity-80 flex items-center gap-2">
                                  <ShieldCheck className="h-5 w-5 text-primary" />
                                  Matriz de Grupos
                              </h3>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-muted-foreground opacity-100">Permissões por Nível de Acesso</p>
                          </header>
                          <ScrollArea className="flex-1">
                              <div className="p-8 pt-0 space-y-6">
                                  <Form {...form}>
                                      <form className="space-y-6">
                                          {Object.keys(defaultPermissions).filter(role => role !== 'admin' && (isDeveloper ? true : role !== 'developer')).map((role) => (
                                              <div key={role} className="rounded-[2rem] border border-border/40 bg-background/20 p-8 space-y-6 hover:bg-primary/5 transition-all">
                                                  <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                                                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                                          <User className="h-5 w-5" />
                                                      </div>
                                                      <h4 className="font-semibold uppercase text-xs tracking-[0.2em]">{roleLabels[role as Role]}</h4>
                                                  </div>
                                                  {renderPermissionsForm(form, role as Role)}
                                              </div>
                                          ))}
                                      </form>
                                  </Form>
                              </div>
                          </ScrollArea>
                      </div>
                  </TabsContent>
                  <TabsContent value="permissoes_individual" className="flex-1 mt-4 outline-none">
                      <div className="h-full bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-premium overflow-hidden flex flex-col">
                          <header className="p-8 pb-4 space-y-1">
                              <h3 className="text-xl font-semibold uppercase tracking-tighter opacity-80 flex items-center gap-2">
                                  <Users className="h-5 w-5 text-primary" />
                                  Acesso Individual
                              </h3>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-muted-foreground opacity-100">Personalização de Permissões por Usuário</p>
                          </header>
                          <div className="px-8 pb-6">
                              <Select onValueChange={(uid) => setSelectedMember(teamMembers.find(m => m.uid === uid) || null)}>
                                  <SelectTrigger className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold uppercase text-[10px] tracking-widest">
                                      <SelectValue placeholder="Selecione um colaborador para editar..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl border-border/40 bg-background/80 backdrop-blur-3xl shadow-premium">
                                      {teamMembers.filter(m => m.role !== 'admin').map(member => (
                                          <SelectItem key={member.uid} value={member.uid} className="rounded-lg font-semibold">{member.displayName}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                          <ScrollArea className="flex-1">
                              <div className="px-8 pb-8">
                                  {selectedMember && (
                                      <div className="rounded-[2rem] border border-border/40 bg-background/20 p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                                              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                                  <BadgeCheck className="h-5 w-5" />
                                              </div>
                                              <div>
                                                  <h4 className="font-semibold uppercase text-xs tracking-[0.2em]">{selectedMember.displayName}</h4>
                                                  <p className="text-[9px] font-semibold text-muted-foreground uppercase text-muted-foreground opacity-100">ID: {selectedMember.uid}</p>
                                              </div>
                                          </div>
                                          <Form {...memberPermissionsForm}>
                                              <form className="space-y-6">
                                                  {renderPermissionsForm(memberPermissionsForm)}
                                              </form>
                                          </Form>
                                      </div>
                                  )}
                                  {!selectedMember && (
                                      <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-[2rem] opacity-20">
                                          <UserPlus className="h-10 w-10 mb-2" />
                                          <p className="text-[10px] font-semibold uppercase tracking-widest">Escolha um membro para gerenciar</p>
                                      </div>
                                  )}
                              </div>
                          </ScrollArea>
                      </div>
                  </TabsContent>
                  <TabsContent value="manutencao" className="flex-1 mt-4 outline-none">
                      <div className="h-full bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-premium overflow-hidden flex flex-col">
                          <header className="p-8 pb-4 space-y-1">
                              <h3 className="text-xl font-semibold uppercase tracking-tighter opacity-80 flex items-center gap-2">
                                  <Settings2 className="h-5 w-5 text-primary" />
                                  Núcleo do Sistema
                              </h3>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-muted-foreground opacity-100">Ferramentas de Manutenção e Dados</p>
                          </header>
                          <ScrollArea className="flex-1">
                              <div className="p-8 pt-0 space-y-4">
                                  <div className="group flex items-center justify-between p-8 rounded-[2rem] border border-border/40 bg-background/20 hover:bg-primary/5 transition-all">
                                      <div className="space-y-1">
                                          <h3 className="font-semibold uppercase text-xs tracking-widest">Normalizar Fabricantes</h3>
                                          <p className="text-[10px] font-semibold text-muted-foreground uppercase text-muted-foreground opacity-100">Padroniza nomenclatura global de produtos</p>
                                      </div>
                                      <Button 
                                          onClick={handleMigration} 
                                          disabled={isMigrating}
                                          className="h-12 px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-lg"
                                      >
                                          {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                                          Sincronizar Agora
                                      </Button>
                                  </div>
                              </div>
                          </ScrollArea>
                      </div>
                  </TabsContent>
                  <TabsContent value="whatsapp" className="flex-1 mt-4 outline-none">
                      <WhatsappConnectionTab />
                  </TabsContent>
                  <TabsContent value="ai_autonomy" className="flex-1 mt-4 outline-none">
                      <div className="h-full bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-premium overflow-hidden">
                          <Form {...form}>
                              <form className="h-full flex flex-col" onSubmit={form.handleSubmit(onSubmit)}>
                                  <header className="p-8 pb-4 space-y-1 flex items-center justify-between">
                                      <div>
                                          <h3 className="text-xl font-semibold uppercase tracking-tighter opacity-80 flex items-center gap-2">
                                              <Crown className="h-5 w-5 text-blue-600" />
                                              NORA: Autonomia e Super Poderes
                                          </h3>
                                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-100">Ative ou desative as capacidades de decisão autônoma da IA.</p>
                                      </div>
                                      <Button type="submit" disabled={isSaving} className="h-12 px-8 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-primary shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                          Salvar Autonomia
                                      </Button>
                                  </header>
                                  <ScrollArea className="flex-1">
                                      <div className="p-8 space-y-8">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                              <FormField control={form.control} name="ai_autonomy.finance_active" render={({ field }) => (
                                                  <FormItem className="flex flex-row items-center justify-between rounded-[2rem] border border-border/40 bg-background/20 p-8 shadow-sm">
                                                      <div className="space-y-1.5">
                                                          <FormLabel className="font-bold uppercase text-xs tracking-widest">Módulo Financeiro</FormLabel>
                                                          <FormDescription className="text-[10px] font-semibold uppercase text-muted-foreground opacity-100 max-w-[250px]">
                                                              Permite a NORA ler comprovantes de pagamento no WhatsApp e dar baixa automática em faturas.
                                                          </FormDescription>
                                                      </div>
                                                      <FormControl>
                                                          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                                      </FormControl>
                                                  </FormItem>
                                              )} />
                                              <FormField control={form.control} name="ai_autonomy.stock_active" render={({ field }) => (
                                                  <FormItem className="flex flex-row items-center justify-between rounded-[2rem] border border-border/40 bg-background/20 p-8 shadow-sm">
                                                      <div className="space-y-1.5">
                                                          <FormLabel className="font-bold uppercase text-xs tracking-widest">Estoque & Compras</FormLabel>
                                                          <FormDescription className="text-[10px] font-semibold uppercase text-muted-foreground opacity-100 max-w-[250px]">
                                                              Permite a NORA criar minutas de pedido de compra ao detectar estoque crítico.
                                                          </FormDescription>
                                                      </div>
                                                      <FormControl>
                                                          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                                      </FormControl>
                                                  </FormItem>
                                              )} />
                                              <FormField control={form.control} name="ai_autonomy.marketing_active" render={({ field }) => (
                                                  <FormItem className="flex flex-row items-center justify-between rounded-[2rem] border border-border/40 bg-background/20 p-8 shadow-sm">
                                                      <div className="space-y-1.5">
                                                          <FormLabel className="font-bold uppercase text-xs tracking-widest">Marketing & Leads</FormLabel>
                                                          <FormDescription className="text-[10px] font-semibold uppercase text-muted-foreground opacity-100 max-w-[250px]">
                                                              Permite a NORA capturar e qualificar clientes automaticamente pelo site.
                                                          </FormDescription>
                                                      </div>
                                                      <FormControl>
                                                          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                                      </FormControl>
                                                  </FormItem>
                                              )} />
                                              <FormField control={form.control} name="ai_autonomy.operational_active" render={({ field }) => (
                                                  <FormItem className="flex flex-row items-center justify-between rounded-[2rem] border border-border/40 bg-background/20 p-8 shadow-sm">
                                                      <div className="space-y-1.5">
                                                          <FormLabel className="font-bold uppercase text-xs tracking-widest">Módulo Operacional</FormLabel>
                                                          <FormDescription className="text-[10px] font-semibold uppercase text-muted-foreground opacity-100 max-w-[250px]">
                                                              Permite a NORA agendar visitas e cobrar tarefas da equipe de forma autônoma.
                                                          </FormDescription>
                                                      </div>
                                                      <FormControl>
                                                          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                                      </FormControl>
                                                  </FormItem>
                                              )} />
                                          </div>
                                      </div>
                                  </ScrollArea>
                              </form>
                          </Form>
                      </div>
                  </TabsContent>
            </Tabs>
        </div>
  );
}


export default function SettingsPage() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }
  
  if (userProfile?.role === 'distribuidor') {
    return <DistributorSettings />;
  }

  return <SettingsPageContent />;
}
