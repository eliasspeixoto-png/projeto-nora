"use client";
// FORCE RE-RENDER v2
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Client, Product, Quote, QuoteItem, QuoteData, ComodatoAsset, Supplier } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, ListChecks, Search, Save, Trash2, ShieldQuestion, X, Lock, PlusCircle, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getProducts, getClients, addQuote, getCompany, getQuote, updateQuote, getComodatoAssets, updateProduct, addProduct, addClient, updateVisit, getSuppliers } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import CalculatedItemsTable from "@/components/orcamentos/calculated-items-table";
import AddEditProductDialog from "@/components/produtos/add-edit-product-dialog";
import AddEditClientDialog from "@/components/clientes/add-edit-client-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Form, FormField, FormControl, FormItem, FormMessage, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const round = (value: number) => Math.round(value * 100) / 100;

const normalizeString = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 'Data Inválida';
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return 'Data Inválida';
  }
};

type EditGeneralQuotePageProps = {
  isModal?: boolean;
  osType?: 'Manutenção de Comodato Preventiva' | 'Manutenção de Comodato Corretiva' | 'Serviço Avulso';
  onClose?: () => void;
};


export function EditGeneralQuoteComponent({ isModal = false, osType: osTypeProp, onClose }: EditGeneralQuotePageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const quoteId = params?.id as string;

  const isEditing = !!quoteId && quoteId !== 'novo';
  const isOsAvulsa = params?.id === 'novo' || isModal;

  const { toast } = useToast();
  const { userProfile, firebase } = useAuth();
  const companyId = userProfile?.companyId;

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [comodatoAssets, setComodatoAssets] = useState<ComodatoAsset[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const clientIdFromQuery = searchParams?.get('clientId');
  const visitIdFromQuery = searchParams?.get('visitId');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientIdFromQuery || null);
  const [items, setItems] = useState<QuoteItem[]>([]);

  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [installments, setInstallments] = useState<number>(1);
  const [interestRate, setInterestRate] = useState<number>(0);
  const [osType, setOsType] = useState<Quote['osType']>(osTypeProp || 'Serviço Avulso');
  const [currentStatus, setCurrentStatus] = useState<Quote['status']>('draft');


  const [clientSearch, setClientSearch] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

  const [productSearch, setProductSearch] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const [isProductDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

  const [isClientDialogOpen, setClientDialogOpen] = useState(false);
  const [isQuickCreatingProduct, setIsQuickCreatingProduct] = useState(false);

  const form = useForm();

  useEffect(() => {
    if (!companyId || !firebase.db) {
      setIsLoading(false);
      return;
    }

    const { db } = firebase;
    let clientsLoaded = false;
    let productsLoaded = false;
    let quoteLoaded = !isEditing;

    const checkLoading = () => {
      if (clientsLoaded && productsLoaded && quoteLoaded) {
        setIsLoading(false);
      }
    };

    const unsubProducts = getProducts(
      db,
      companyId,
      (data) => {
        setProducts(data);
        productsLoaded = true;
        checkLoading();
      },
      (error) => {
        toast({ variant: "destructive", title: "Erro ao buscar produtos" });
        productsLoaded = true;
        checkLoading();
      }
    );

    const unsubClients = getClients(
      db,
      companyId,
      (data) => {
        setClients(data);
        clientsLoaded = true;
        checkLoading();
      },
      (error) => {
        toast({ variant: "destructive", title: "Erro ao buscar clientes" });
        clientsLoaded = true;
        checkLoading();
      }
    );

    const unsubComodato = getComodatoAssets(db, companyId, setComodatoAssets, console.error);
    const unsubSuppliers = getSuppliers(db, companyId, setSuppliers, console.error);

    if (isEditing) {
      getQuote(db, quoteId).then(existingQuote => {
        if (existingQuote) {
          setItems(existingQuote.items);
          setSelectedClientId(existingQuote.clientId);
          setDiscountPercentage(existingQuote.discount || 0);
          setInstallments(existingQuote.installments || 1);
          setInterestRate(existingQuote.interestRate || 0);
          setOsType(existingQuote.osType || 'Serviço Avulso');
          setCurrentStatus(existingQuote.status || 'draft');
        } else {
          toast({ variant: "destructive", title: "Erro", description: "Orçamento não encontrado." });
          router.push('/orcamentos');
        }
        quoteLoaded = true;
        checkLoading();
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      unsubProducts();
      unsubClients();
      unsubComodato();
      unsubSuppliers();
    };

  }, [companyId, isEditing, quoteId, router, toast, firebase.db]);

  useEffect(() => {
    if (clients.length > 0 && selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setClientSearch(client.name);
      }
    }
  }, [clients, selectedClientId]);

  const filteredClients = useMemo(() => {
    let clientsToFilter = [...clients].sort((a, b) => a.name.localeCompare(b.name));

    if (osType === 'Manutenção de Comodato Preventiva' || osType === 'Manutenção de Comodato Corretiva') {
      clientsToFilter = clientsToFilter.filter(c => c.isComodato);
    }

    const searchStr = (clientSearch || '').trim().toLowerCase();
    if (!searchStr) {
        return clientsToFilter;
    }

    return clientsToFilter.filter(c => 
        c.name.toLowerCase().includes(searchStr) || 
        (c.document && c.document.toLowerCase().includes(searchStr)) ||
        (c.clientCode && c.clientCode.toLowerCase().includes(searchStr))
    ).sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        const docA = (a.document || '').toLowerCase();
        const docB = (b.document || '').toLowerCase();
        const codeA = (a.clientCode || '').toLowerCase();
        const codeB = (b.clientCode || '').toLowerCase();

        const aExact = nameA === searchStr || docA === searchStr || codeA === searchStr;
        const bExact = nameB === searchStr || docB === searchStr || codeB === searchStr;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = nameA.startsWith(searchStr) || docA.startsWith(searchStr) || codeA.startsWith(searchStr);
        const bStarts = nameB.startsWith(searchStr) || docB.startsWith(searchStr) || codeB.startsWith(searchStr);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return a.name.localeCompare(b.name);
    });
  }, [clients, clientSearch, osType]);

  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);

  const clientComodatoAssets = useMemo(() => {
    if (!selectedClientId || !(osType ?? '').includes('Comodato')) {
      return [];
    }
    return comodatoAssets.filter(asset => asset.clientId === selectedClientId);
  }, [selectedClientId, osType, comodatoAssets]);

  const filteredProducts = useMemo(() => {
    const searchStr = (productSearch || '').trim().toLowerCase();
    if (!searchStr) {
        return [...products].sort((a, b) => a.description.localeCompare(b.description));
    }

    return products.filter(p => 
        p.description.toLowerCase().includes(searchStr) || 
        (p.item && p.item.toLowerCase().includes(searchStr))
    ).sort((a, b) => {
        const descA = a.description.toLowerCase();
        const descB = b.description.toLowerCase();
        const itemA = (a.item || '').toLowerCase();
        const itemB = (b.item || '').toLowerCase();

        const aExactItem = itemA === searchStr;
        const bExactItem = itemB === searchStr;
        if (aExactItem && !bExactItem) return -1;
        if (!aExactItem && bExactItem) return 1;

        const aStartsItem = itemA.startsWith(searchStr);
        const bStartsItem = itemB.startsWith(searchStr);
        if (aStartsItem && !bStartsItem) return -1;
        if (!aStartsItem && bStartsItem) return 1;

        const aExactDesc = descA === searchStr;
        const bExactDesc = descB === searchStr;
        if (aExactDesc && !bExactDesc) return -1;
        if (!aExactDesc && bExactDesc) return 1;

        const aStartsDesc = descA.startsWith(searchStr);
        const bStartsDesc = descB.startsWith(searchStr);
        if (aStartsDesc && !bStartsDesc) return -1;
        if (!aStartsDesc && bStartsDesc) return 1;

        return a.description.localeCompare(b.description);
    });
  }, [products, productSearch]);

  const handleAddProduct = (product: Product) => {
    if (items.some(item => item.product.id === product.id)) {
      toast({
        variant: "destructive",
        title: "Item já adicionado",
        description: "Este produto ou serviço já está na lista do orçamento.",
      });
      return;
    }

    const newItem: QuoteItem = {
      id: `item-${product.id}-${Date.now()}`,
      product: product,
      quantity: 1,
      materialPrice: product.sellingPrice || 0, // Use sellingPrice for materialPrice
      servicePrice: product.servicePrice || 0,
      includeService: true,
      includeMaterial: true,
      total: (product.sellingPrice || 0) + (product.servicePrice || 0),
    };

    setItems(prevItems => [...prevItems, newItem]);
    setProductSearch('');
    setProductPopoverOpen(false);
  };

  const handleDeleteItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleEditItem = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleItemChange = (itemId: string, newQuantity: string | number, includeService?: boolean, includeMaterial?: boolean) => {
    const numericQuantity = typeof newQuantity === 'string' ? parseFloat(newQuantity) || 0 : newQuantity;
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id === itemId) {
          const quantity = numericQuantity >= 0 ? numericQuantity : 0;
          
          const finalIncludeService = includeService !== undefined ? includeService : (item.includeService ?? true);
          const finalIncludeMaterial = includeMaterial !== undefined ? includeMaterial : (item.includeMaterial ?? true);
          
          const effectiveServicePrice = finalIncludeService ? item.servicePrice : 0;
          const effectiveMaterialPrice = finalIncludeMaterial ? item.materialPrice : 0;
          
          return {
            ...item,
            quantity: quantity,
            includeService: finalIncludeService,
            includeMaterial: finalIncludeMaterial,
            total: round(quantity * (effectiveMaterialPrice + effectiveServicePrice)),
          };
        }
        return item;
      })
    );
  };

  const onProductSaved = async (productData: Omit<Product, 'id' | 'companyId'>) => {
    if (!companyId || !firebase.db) return;
    try {
      if (editingProduct) {
        // Modo Edição de Item existente
        await updateProduct(firebase.db, editingProduct.id, { ...productData, companyId });
        toast({ title: "Sucesso!", description: "Item atualizado com sucesso." });

        setItems(prevItems => prevItems.map(item => {
          if (item.product.id === editingProduct.id) {
            const updatedProduct = { ...item.product, ...productData };
            return {
              ...item,
              product: updatedProduct,
              materialPrice: updatedProduct.sellingPrice || 0,
              servicePrice: updatedProduct.servicePrice || 0,
              total: round(item.quantity * ((updatedProduct.sellingPrice || 0) + (updatedProduct.servicePrice || 0))),
            };
          }
          return item;
        }));
      } else if (isQuickCreatingProduct) {
        // Modo Cadastro Rápido
        const newProductId = await addProduct(firebase.db, { ...productData, companyId });
        const newProduct = { ...productData, id: newProductId, companyId } as Product; // temp cast for immediate use

        // Adiciona automaticamente ao orçamento
        const newItem: QuoteItem = {
          id: `item-${newProductId}-${Date.now()}`,
          product: { ...newProduct, id: newProductId },
          quantity: 1,
          materialPrice: newProduct.sellingPrice || 0,
          servicePrice: newProduct.servicePrice || 0,
          includeService: true,
          includeMaterial: true,
          total: (newProduct.sellingPrice || 0) + (newProduct.servicePrice || 0),
        };

        setItems(prevItems => [...prevItems, newItem]);
        toast({ title: "Sucesso!", description: "Produto cadastrado e adicionado ao orçamento." });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setIsQuickCreatingProduct(false);
      }

      setProductDialogOpen(false);
      setEditingProduct(undefined);
      setIsQuickCreatingProduct(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as alterações no item." });
    }
  };

  const handleClientQuickSave = async (clientData: any) => {
    if (!companyId || !firebase.db || !firebase.auth) return;
    try {
      const newClientId = await addClient(firebase.db, firebase.auth, { ...clientData, companyId });
      setSelectedClientId(newClientId);
      setClientDialogOpen(false);
      toast({ title: "Sucesso!", description: "Cliente cadastrado e selecionado." });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao cadastrar cliente", description: e.message });
    }
  };

  const handleSaveQuote = async () => {
    if (!companyId || !selectedClientId || items.length === 0 || !firebase.db || !firebase.auth) {
      toast({ variant: "destructive", title: "Dados Incompletos", description: "Selecione um cliente e adicione itens." });
      return;
    }

    setIsSaving(true);
    try {
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const discountAmount = (subtotal * discountPercentage) / 100;
      const totalAfterDiscount = subtotal - discountAmount;

      const client = clients.find(c => c.id === selectedClientId);
      const company = await getCompany(firebase.db, companyId);

      const itemsToSave = items.map((item: QuoteItem) => {
        const p = item.product as any;
        return {
          id: item.id,
          product: {
            id: p.id || '',
            item: p.item || '',
            description: p.description || '',
            manufacturer: p.manufacturer || '',
            unit: p.unit || 'UNID',
            materialPrice: round(p.materialPrice || p.sellingPrice || 0),
            sellingPrice: round(p.sellingPrice || 0),
            servicePrice: round(p.servicePrice || 0),
            segment: p.segment || 'OUTROS',
            status: p.status || 'Ativo',
            companyId: p.companyId || companyId,
            imageUrl: p.imageUrl || '',
          },
          quantity: round(item.quantity),
          materialPrice: round(item.materialPrice),
          servicePrice: round(item.servicePrice),
          includeMaterial: item.includeMaterial !== false,
          includeService: item.includeService !== false,
          total: round(item.total),
        };
      }) as any[];

      const quoteData: Partial<Quote> = {
        clientId: selectedClientId,
        clientName: client?.name || 'Cliente',
        companyName: company?.name || 'Empresa',
        items: itemsToSave,
        total: round(totalAfterDiscount),
        discount: discountPercentage,
        installments: installments,
        interestRate: interestRate,
        status: (isOsAvulsa && !isEditing) ? 'Pendente' : currentStatus,
        companyId: companyId,
        serviceType: 'Geral',
        osType: osType,
      };

      if (isEditing) {
        await updateQuote(firebase.db, firebase.auth, quoteId, quoteData);
        toast({ title: "Sucesso!", description: "Orçamento atualizado." });
      } else {
        const result = await addQuote(firebase.db, firebase.auth, quoteData as QuoteData);
        toast({ title: "Sucesso!", description: isOsAvulsa ? "O.S. Avulsa criada." : "Orçamento salvo." });
        
        if (visitIdFromQuery && result?.id) {
          try {
            await updateVisit(firebase.db, firebase.auth, visitIdFromQuery, { 
              status: 'Finalizada',
              relatedQuoteId: result.id
            });
            toast({ title: "Visita Finalizada", description: "A visita pendente foi encerrada com sucesso." });
          } catch (e) {
            console.error("Erro ao fechar visita", e);
          }
        }
      }

      // Invalidação do cache para atualização instantânea do Dashboard
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['accountsReceivable'] });

      if (onClose) {
        onClose();
      } else {
        const destination = isOsAvulsa && (osType ?? '').includes('Comodato') ? '/comodato' : (isOsAvulsa ? '/ordem-de-servico' : '/orcamentos');
        router.push(destination);
      }


    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-muted/10">
      {isLoading ? (
        <div className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-xl z-[100]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 w-full max-w-[1750px] mx-auto p-4 md:p-8 animate-in fade-in duration-500">
          <div className="flex items-center gap-4 mb-2 px-4 md:px-0">
            <div className="p-2.5 rounded-xl bg-primary shadow-lg shadow-primary/20 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <h1 className="font-black tracking-tighter text-3xl text-primary uppercase">
              {isOsAvulsa ? 'Nova O.S. Avulsa' : (isEditing ? 'Editar Orçamento' : 'Novo Orçamento')}
            </h1>
          </div>

          <div className="flex flex-col gap-8 w-full pb-12">
            <div className="space-y-6">
              <Card className="bg-background/60 backdrop-blur-md border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-border/40 py-3 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-widest text-primary">
                    <div className="bg-primary text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">1</div>
                    Escopo e Definições
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-all px-4 h-9 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-primary/10 bg-stone-100 dark:bg-stone-800/50" 
                      onClick={() => router.back()}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      className="px-8 h-10 rounded-xl font-bold uppercase tracking-wider shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-primary text-white text-xs" 
                      onClick={handleSaveQuote} 
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {isOsAvulsa ? 'Finalizar O.S.' : 'Salvar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                        <User className="h-3 w-3" /> Seleção do Cliente
                      </Label>
                      <FormField
                        control={form.control}
                        name="client"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                              <PopoverTrigger asChild>
                                <div className="flex gap-2 w-full">
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn("flex-1 justify-between h-12 rounded-2xl bg-background border-border/40 text-base font-semibold transition-all hover:border-primary/40 shadow-sm", !selectedClientId && "text-muted-foreground")}
                                    >
                                      {selectedClientId
                                        ? clients.find((c) => c.id === selectedClientId)?.name.toUpperCase()
                                        : "Pesquisar na base de clientes..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    className="shrink-0 h-12 w-12 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setClientDialogOpen(true);
                                    }}
                                  >
                                    <PlusCircle className="h-6 w-6" />
                                  </Button>
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl">
                                <Command shouldFilter={false}>
                                  <CommandInput placeholder="Digite nome, CPF ou código..." value={clientSearch} onValueChange={setClientSearch} />
                                  <CommandList>
                                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {filteredClients.map((c) => (
                                        <CommandItem key={c.id} value={c.id} onSelect={() => { setSelectedClientId(c.id); setClientPopoverOpen(false); }} className="uppercase">
                                          <Check className={cn("mr-2 h-4 w-4", c.id === selectedClientId ? "opacity-100" : "opacity-0")} />
                                          <div className="flex flex-col">
                                            <span className="font-semibold uppercase">{c.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{c.document || `ID: ${c.clientCode}`}</span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                        <ListChecks className="h-3 w-3" /> Tipo de Atendimento
                      </Label>
                      <RadioGroup value={osType} onValueChange={(v) => setOsType(v as any)} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className={cn("flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer hover:bg-background shadow-sm hover:shadow-md", osType === 'Serviço Avulso' ? "border-primary bg-background ring-2 ring-primary/10" : "border-border/40 bg-background/50 opacity-70")}>
                          <RadioGroupItem value="Serviço Avulso" id="avulso" className="text-primary border-primary/25" />
                          <Label htmlFor="avulso" className="font-bold text-[11px] uppercase tracking-wider cursor-pointer text-primary/80">Orçamento</Label>
                        </div>
                        <div className={cn("flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer hover:bg-background shadow-sm hover:shadow-md", osType === 'Manutenção de Comodato Preventiva' ? "border-primary bg-background ring-2 ring-primary/10" : "border-border/40 bg-background/50 opacity-70")}>
                          <RadioGroupItem value="Manutenção de Comodato Preventiva" id="preventiva" className="text-primary border-primary/25" />
                          <Label htmlFor="preventiva" className="font-bold text-[11px] uppercase tracking-wider cursor-pointer text-primary/80">Preventiva</Label>
                        </div>
                        <div className={cn("flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer hover:bg-background shadow-sm hover:shadow-md", osType === 'Manutenção de Comodato Corretiva' ? "border-primary bg-background ring-2 ring-primary/10" : "border-border/40 bg-background/50 opacity-70")}>
                          <RadioGroupItem value="Manutenção de Comodato Corretiva" id="corretiva" className="text-primary border-primary/25" />
                          <Label htmlFor="corretiva" className="font-bold text-[11px] uppercase tracking-wider cursor-pointer text-primary/80">Corretiva</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/60 backdrop-blur-md border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-border/40 py-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-widest text-primary">
                    <div className="bg-primary text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">2</div>
                    Itens e Composição de Custos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-6 bg-muted/20 border-b border-border/40">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1 space-y-2">
                        <Label className="flex items-center gap-2 font-semibold text-[10px] uppercase tracking-widest text-primary/80 mb-2 ml-1">
                          <Search className="h-3 w-3" /> Buscar em produtos
                        </Label>
                        <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                          <PopoverTrigger asChild>
                            <div className="flex gap-2 w-full">
                              <Button
                                variant="outline"
                                role="combobox"
                                className="flex-1 justify-between h-12 rounded-2xl bg-background border-border/40 hover:border-primary/40 transition-all text-xs font-semibold text-primary/40 shadow-sm"
                              >
                                {productSearch || "ADICIONAR PRODUTO OU SERVIÇO POR NOME OU CÓDIGO..."}
                                <Search className="ml-2 h-5 w-5 shrink-0 opacity-40" />
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="shrink-0 h-12 w-12 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingProduct(undefined);
                                  setIsQuickCreatingProduct(true);
                                  setProductDialogOpen(true);
                                }}
                              >
                                <PlusCircle className="h-6 w-6" />
                              </Button>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl">
                            <Command shouldFilter={false}>
                              <CommandInput placeholder="Ex: Central, Cerca, Sensor..." value={productSearch} onValueChange={setProductSearch} />
                              <CommandList>
                                <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {filteredProducts.map((product) => (
                                    <CommandItem key={product.id} value={product.id} onSelect={() => handleAddProduct(product)} className="py-3 uppercase">
                                      <div className="flex justify-between items-center w-full">
                                        <div>
                                          <p className="font-bold text-sm tracking-tight text-primary/90 uppercase">{product.description}</p>
                                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">{product.item}</p>
                                        </div>
                                        <Badge variant="secondary" className="bg-primary/5 text-primary text-[10px] font-semibold">R$ {product.sellingPrice?.toFixed(2)}</Badge>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  <div className="p-0">
                    <CalculatedItemsTable
                      isOsAvulsa={isOsAvulsa}
                      items={items}
                      setItems={setItems}
                      onItemChange={handleItemChange}
                      onDeleteItem={handleDeleteItem}
                      onEditItem={handleEditItem}
                      onSaveQuote={handleSaveQuote}
                      discountPercentage={discountPercentage}
                      setDiscountPercentage={setDiscountPercentage}
                      installments={installments}
                      setInstallments={setInstallments}
                      interestRate={interestRate}
                      setInterestRate={setInterestRate}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <AddEditProductDialog
            isOpen={isProductDialogOpen}
            setOpen={setProductDialogOpen}
            onProductSaved={onProductSaved}
            product={editingProduct}
            suppliers={suppliers}
            locations={[]}
          />

          <AddEditClientDialog
            isOpen={isClientDialogOpen}
            setOpen={setClientDialogOpen}
            onClientSaved={handleClientQuickSave}
            isQuickCreate={true}
          />
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <>
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>
            {isOsAvulsa ? 'Nova O.S. Avulsa' : (isEditing ? 'Editar Orçamento Geral' : 'Novo Orçamento Geral')}
          </DialogTitle>
          <DialogDescription>Preencha os dados abaixo para criar a O.S.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="p-6 pt-0">
            {content}
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSaveQuote} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isOsAvulsa ? 'Salvar O.S.' : 'Salvar Orçamento'}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <div className="w-full h-full bg-background">
      {content}
    </div>
  );
}
