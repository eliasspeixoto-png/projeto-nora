
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Building, Info, Eye, User as UserIcon, Mail, FileText, Phone, Smartphone, DollarSign, Crown, Edit } from "lucide-react";
import { useAuth } from "@/firebase/auth/use-user";
import type { Company, UserProfile } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inviteDistributor, updateTeamMember } from "@/lib/firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { collection, getDocs, query, where } from "firebase/firestore";




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

const distributorFormSchema = z.object({
  displayName: z.string().min(3, "O nome é obrigatório."),
  email: z.string().email("Por favor, insira um email válido."),
  plan: z.string().default('distribuidor'),
  planPrice: z.coerce.number().min(0, "O valor não pode ser negativo.").default(0),
  clickValue: z.coerce.number().min(0, "O valor não pode ser negativo.").default(0.50),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  document: z.string().optional(),
});


export default function DeveloperDashboard() {
    const { user, isDeveloper, loading: authLoading, firebase } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [distributors, setDistributors] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedDistributor, setSelectedDistributor] = useState<UserProfile | null>(null);
    const [isDetailDialogOpen, setDetailDialogOpen] = useState(false);
    const [isInviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [editingDistributor, setEditingDistributor] = useState<UserProfile | null>(null);

    const form = useForm<z.infer<typeof distributorFormSchema>>({
        resolver: zodResolver(distributorFormSchema),
        defaultValues: { 
            displayName: "", 
            email: "",
            plan: 'distribuidor',
            planPrice: 0,
            clickValue: 0.50,
            phone: "",
            whatsapp: "",
            document: "",
        },
    });

    const fetchDistributors = useCallback(async () => {
        try {
            if (!firebase.db) return;
            const q = query(collection(firebase.db, 'users'), where('role', '==', 'distribuidor'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            } as UserProfile));
            setDistributors(data);
        } catch (error) {
             console.error("Error fetching distributors:", error);
            toast({
                variant: "destructive",
                title: "Erro ao buscar distribuidores",
            })
        }
    }, [firebase.db, toast]);

    useEffect(() => {
        if (authLoading) return;

        if (!user || !isDeveloper) {
            router.push('/dashboard');
            return;
        }

        const fetchCompanies = async () => {
            setIsLoading(true);
            try {
                if (!firebase.db) return;
                const snapshot = await getDocs(collection(firebase.db, 'companies'));
                const allCompanies = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Company));
                setCompanies(allCompanies);
            } catch (error) {
                console.error("Error fetching companies from Firestore:", error);
                toast({
                    variant: "destructive",
                    title: "Erro ao buscar empresas",
                    description: "Não foi possível carregar a lista de empresas."
                })
            } finally {
                setIsLoading(false);
            }
        };

        fetchCompanies();
        fetchDistributors();

    }, [user, authLoading, toast, router, fetchDistributors]);
    

    const filteredCompanies = useMemo(() => {
        if (!searchTerm) return companies;
        return companies.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.cnpj?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [companies, searchTerm]);

    const filteredDistributors = useMemo(() => {
        if (!searchTerm) return distributors;
        return distributors.filter(d => 
            d.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [distributors, searchTerm]);
    
    const handleEditDistributor = (distributor: UserProfile) => {
        setEditingDistributor(distributor);
        form.reset({
            displayName: distributor.displayName,
            email: distributor.email,
            plan: distributor.plan || 'distribuidor',
            planPrice: distributor.planPrice || 0,
            clickValue: distributor.clickValue || 0,
            phone: distributor.phone || '',
            whatsapp: distributor.whatsapp || '',
            document: distributor.document || '',
        });
        setInviteDialogOpen(true);
    };

    const handleDialogSubmit = async (values: z.infer<typeof distributorFormSchema>) => {
        if (editingDistributor) {
            setIsInviting(true);
            try {
                if (!firebase.db) throw new Error("Firebase DB not available");
                await updateTeamMember(firebase.db, editingDistributor.uid, {
                    displayName: values.displayName,
                    planPrice: values.planPrice,
                    clickValue: values.clickValue,
                    phone: values.phone,
                    whatsapp: values.whatsapp,
                    document: values.document,
                });
                toast({
                    title: "Distribuidor Atualizado!",
                    description: "Os dados do distribuidor foram salvos.",
                });
                setInviteDialogOpen(false);
                setEditingDistributor(null);
                fetchDistributors();
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Erro ao atualizar",
                    description: error.message,
                });
            } finally {
                setIsInviting(false);
            }
        } else {
             setIsInviting(true);
            try {
                if (!firebase.db || !firebase.auth) throw new Error("Firebase not available");
                await inviteDistributor(firebase.db, firebase.auth, values as any);
                toast({
                    title: "Distribuidor Convidado!",
                    description: "Um email com instruções de acesso foi enviado.",
                });
                setInviteDialogOpen(false);
                form.reset();
                fetchDistributors();
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Erro ao convidar",
                    description: error.message,
                });
            } finally {
                setIsInviting(false);
            }
        }
    };


    const handleAccessCompany = (companyId: string, companyName: string) => {
        localStorage.setItem('developer_impersonating', JSON.stringify({ companyId, companyName }));
        sessionStorage.removeItem('nora_user_profile');
        sessionStorage.removeItem('nora_company_data');
        toast({
            title: `Acessando ${companyName}`,
            description: "Você agora está visualizando o painel desta empresa.",
        });
        router.push('/dashboard');
        setTimeout(() => window.location.reload(), 500); 
    };

    const handleAccessDistributor = (distributor: UserProfile) => {
        router.push(`/distribuidor/${distributor.uid}`);
    };

    const handleViewCompanyDetails = (company: Company) => {
        setSelectedCompany(company);
        setSelectedDistributor(null);
        setDetailDialogOpen(true);
    };

    const handleViewDistributorDetails = (distributor: UserProfile) => {
        setSelectedDistributor(distributor);
        setSelectedCompany(null);
        setDetailDialogOpen(true);
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return (
        <>
            <Tabs defaultValue="companies">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <Building className="h-6 w-6" />
                              <CardTitle className="text-xl">Painel do Desenvolvedor</CardTitle>
                              <Popover>
                              <PopoverTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                              </PopoverTrigger>
                              <PopoverContent>
                                  <p className="text-sm">Acesso rápido a todas as contas de empresa para fins de suporte e desenvolvimento.</p>
                              </PopoverContent>
                              </Popover>
                          </div>
                          <Button onClick={() => { setEditingDistributor(null); form.reset(); setInviteDialogOpen(true); }}>Adicionar Distribuidor</Button>
                        </div>
                        <CardDescription className="text-sm md:text-base">Visualize e acesse todas as empresas cadastradas no sistema.</CardDescription>
                        <TabsList className="grid w-full grid-cols-2 mt-2">
                          <TabsTrigger value="companies">Empresas</TabsTrigger>
                          <TabsTrigger value="distributors">Distribuidores</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nome ou CNPJ/Email..."
                                    className="pl-8 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <TabsContent value="companies">
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-sm h-[34px]">Empresa</TableHead>
                                            <TableHead className="text-sm h-[34px]">CNPJ</TableHead>
                                            <TableHead className="text-sm h-[34px]">Proprietário (ID)</TableHead>
                                            <TableHead className="text-right text-sm h-[34px]">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCompanies.length > 0 ? filteredCompanies.map((company) => (
                                            <TableRow key={company.id}>
                                                <TableCell className="py-0 font-medium text-xs">{company.name}</TableCell>
                                                <TableCell className="py-0 text-xs">{company.cnpj}</TableCell>
                                                <TableCell className="py-0 font-mono text-xs">{company.ownerId}</TableCell>
                                                <TableCell className="py-0 text-right space-x-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleViewCompanyDetails(company)}>
                                                        <Eye className="mr-2 h-4 w-4"/>
                                                        Ver Dados
                                                    </Button>
                                                    <Button size="sm" onClick={() => handleAccessCompany(company.id, company.name)}>
                                                        Acessar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-0 h-24 text-center">
                                                    Nenhuma empresa encontrada.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="distributors">
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-sm h-[34px]">Distribuidor</TableHead>
                                            <TableHead className="text-sm h-[34px]">Email</TableHead>
                                            <TableHead className="text-right text-sm h-[34px]">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredDistributors.length > 0 ? filteredDistributors.map((distributor) => (
                                            <TableRow key={distributor.uid}>
                                                <TableCell className="py-0 font-medium text-xs">{distributor.displayName}</TableCell>
                                                <TableCell className="py-0 text-xs">{distributor.email}</TableCell>
                                                <TableCell className="py-0 text-right space-x-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleEditDistributor(distributor)}>
                                                        <Edit className="mr-2 h-4 w-4"/>
                                                        Editar
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleViewDistributorDetails(distributor)}>
                                                        <Eye className="mr-2 h-4 w-4"/>
                                                        Ver Dados
                                                    </Button>
                                                    <Button size="sm" onClick={() => handleAccessDistributor(distributor)}>
                                                        Acessar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="py-0 h-24 text-center">
                                                    Nenhum distribuidor encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>

            <Dialog open={isDetailDialogOpen} onOpenChange={setDetailDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Dados: {selectedCompany?.name || selectedDistributor?.displayName}</DialogTitle>
                        <DialogDescription>
                            Visualização completa dos dados como estão salvos no banco de dados.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] mt-4">
                        <pre className="p-4 bg-muted rounded-md text-xs whitespace-pre-wrap break-all">
                            {JSON.stringify(selectedCompany || selectedDistributor, null, 2)}
                        </pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={isInviteDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) { setEditingDistributor(null); form.reset(); } setInviteDialogOpen(isOpen); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDistributor ? 'Editar Distribuidor' : 'Convidar Novo Distribuidor'}</DialogTitle>
                        <DialogDescription>
                            {editingDistributor ? 'Atualize os dados do distribuidor.' : 'Crie uma conta de acesso para um novo distribuidor. Eles receberão um email com uma senha temporária.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form id="distributor-form" onSubmit={form.handleSubmit(handleDialogSubmit)} className="space-y-4 py-4">
                             <FormField
                                control={form.control}
                                name="displayName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome de Exibição do Distribuidor</FormLabel>
                                        <div className="relative">
                                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <FormControl>
                                                <Input placeholder="Ex: Eurotech Distribuidor" {...field} className="pl-10" />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email de Acesso</FormLabel>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <FormControl>
                                                <Input type="email" placeholder="email@distribuidor.com" {...field} className="pl-10" disabled={!!editingDistributor} />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="plan"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Plano</FormLabel>
                                        <div className="relative">
                                            <Crown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <FormControl>
                                                <Input {...field} disabled className="pl-10 font-medium" />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="planPrice"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Valor Mensal (R$)</FormLabel>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} className="pl-10" />
                                                </FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="clickValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Valor por Clique (R$)</FormLabel>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} className="pl-10" />
                                                </FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="document"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>CNPJ</FormLabel>
                                    <div className="relative">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <FormControl>
                                        <Input placeholder="00.000.000/0000-00" {...field} onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))} className="pl-10" />
                                    </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Telefone</FormLabel>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <FormControl>
                                        <Input placeholder="(00) 0000-0000" {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))} className="pl-10" />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={form.control}
                                name="whatsapp"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>WhatsApp</FormLabel>
                                    <div className="relative">
                                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <FormControl>
                                        <Input placeholder="(00) 00000-0000" {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))} className="pl-10" />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                            </div>
                        </form>
                    </Form>
                     <DialogFooter>
                        <Button variant="outline" onClick={() => { setInviteDialogOpen(false); setEditingDistributor(null); form.reset(); }}>Cancelar</Button>
                        <Button type="submit" form="distributor-form" disabled={isInviting}>
                            {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             {editingDistributor ? 'Salvar Alterações' : 'Convidar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
