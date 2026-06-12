

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Trash2, Search, AlertTriangle, ChevronsUpDown, Check, FileText, Calendar as CalendarIcon, Send, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { getPurchaseOrder, addPurchaseOrder, updatePurchaseOrder, getProductsOnce, getDistributorsOnce, updateProductStock, getStockLocations, getQuote } from "@/lib/firebase/firestore";
import type { Product, UserProfile, PurchaseOrder, PurchaseOrderItem, StockLocation, Quote } from "@/lib/data";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";


const purchaseOrderItemSchema = z.object({
  productId: z.string(),
  productCode: z.string(),
  productDescription: z.string(),
  unit: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "A quantidade deve ser maior que zero."),
  unitCost: z.coerce.number().min(0, "Custo não pode ser negativo."),
  totalCost: z.number(),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Selecione um distribuidor."),
  deliveryDate: z.date({ required_error: "A data de entrega desejada é obrigatória." }),
  status: z.string(),
  destinationLocationId: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1, "Adicione pelo menos um item ao pedido."),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const normalizeString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type PurchaseOrderFormProps = {
  mode?: 'buyer' | 'distributor';
};


export default function PurchaseOrderForm({ mode = 'buyer' }: PurchaseOrderFormProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id as string;
  const fromQuoteId = searchParams?.get('fromQuote');
  const supplierIdFromQuote = searchParams?.get('supplierId');
  const isEditing = !!orderId;

  const { toast } = useToast();
  const { userProfile, firebase, company } = useAuth();
  const companyId = userProfile?.companyId;

  const [products, setProducts] = useState<Product[]>([]);
  const [distributors, setDistributors] = useState<UserProfile[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<PurchaseOrder['status'] | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [distributorSearch, setDistributorSearch] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  const filteredDistributors = useMemo(() => {
    const searchStr = distributorSearch.trim().toLowerCase();
    if (!searchStr) return [...distributors].sort((a, b) => a.displayName.localeCompare(b.displayName));

    return distributors.filter(d => 
        d.displayName.toLowerCase().includes(searchStr) || 
        (d.companyName && d.companyName.toLowerCase().includes(searchStr))
    ).sort((a, b) => {
        const nameA = a.displayName.toLowerCase();
        const nameB = b.displayName.toLowerCase();

        const aExact = nameA === searchStr;
        const bExact = nameB === searchStr;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = nameA.startsWith(searchStr);
        const bStarts = nameB.startsWith(searchStr);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return a.displayName.localeCompare(b.displayName);
    });
  }, [distributors, distributorSearch]);

  const filteredProducts = useMemo(() => {
    const searchStr = productSearch.trim().toLowerCase();
    if (!searchStr) return [...products].sort((a, b) => a.description.localeCompare(b.description));

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

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      status: "Rascunho",
      items: [],
      deliveryDate: new Date(),
    },
  });

  const { fields, append, remove, update, replace } = useFieldArray({
    control: form.control,
    name: "items",
    keyName: "key",
  });

  useEffect(() => {
    if (!companyId || !firebase.db) return;

    async function loadData() {
      setIsLoading(true);
      try {
        const [productsData, distributorsData, locationsData] = await Promise.all([
          getProductsOnce(firebase.db, companyId!, 'Ativo'),
          getDistributorsOnce(firebase.db),
          new Promise<StockLocation[]>(res => getStockLocations(firebase.db, companyId!, res, console.error))
        ]);
        setProducts(productsData);
        setDistributors(distributorsData);
        setStockLocations(locationsData);

        const centralLocation = locationsData.find(loc => loc.isCentral);

        let initialValues: Partial<PurchaseOrderFormData> = {
          status: "Rascunho",
          items: [],
          destinationLocationId: centralLocation?.id || "",
          deliveryDate: new Date(),
        };

        if (isEditing) {
          const order = await getPurchaseOrder(firebase.db, orderId);
          if (order) {
            const items = (order.items || []).map(item => ({
              ...item,
              productCode: String(item.productCode || ''),
              productDescription: String(item.productDescription || '')
            }));
            initialValues = {
              supplierId: order.supplierId,
              status: order.status,
              deliveryDate: order.deliveryDate ? new Date(order.deliveryDate) : new Date(),
              destinationLocationId: order.destinationLocationId || centralLocation?.id || "",
              notes: order.notes,
              items: items,
            };
            setOriginalStatus(order.status);
          } else {
            toast({ variant: 'destructive', title: 'Erro', description: 'Pedido de compra não encontrado.' });
            router.push('/compras');
            return;
          }
        } else if (fromQuoteId) {
          const quote = await getQuote(firebase.db, fromQuoteId);
          if (quote) {
            const mappedItems = quote.items.map(item => ({
              productId: item.product.id,
              productCode: String(item.product.item || ''),
              productDescription: String(item.product.description || ''),
              unit: item.product.unit,
              quantity: item.quantity,
              unitCost: item.product.materialPrice || 0,
              totalCost: (item.product.materialPrice || 0) * item.quantity,
            }));
            initialValues.items = mappedItems;
          }
        }

        if (supplierIdFromQuote) {
          initialValues.supplierId = supplierIdFromQuote;
        }

        form.reset(initialValues as PurchaseOrderFormData);

      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro ao carregar dados' });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [companyId, isEditing, orderId, fromQuoteId, supplierIdFromQuote, firebase.db, toast, router, form]);


  const addProductToOrder = (product: Product) => {
    if (fields.some(field => field.productId === product.id)) {
      toast({ variant: 'destructive', title: 'Item já adicionado' });
      return;
    }
    const unitCost = product.materialPrice || 0;
    append({
      productId: product.id,
      productCode: String(product.item || ''),
      productDescription: product.description || 'Produto sem descrição',
      unit: product.unit,
      quantity: 1,
      unitCost: unitCost,
      totalCost: unitCost,
    });
    setProductSearch('');
    setProductPopoverOpen(false);
  };

  const handleItemValueChange = (index: number, field: 'quantity' | 'unitCost', value: string) => {
    const numericValue = parseFloat(value) || 0;
    const currentItem = form.getValues(`items.${index}`);

    if (!currentItem) return;

    const newQuantity = field === 'quantity' ? numericValue : currentItem.quantity;
    const newUnitCost = field === 'unitCost' ? numericValue : currentItem.unitCost;

    update(index, {
      ...currentItem,
      [field]: numericValue,
      totalCost: (newQuantity || 0) * (newUnitCost || 0),
    });
  };

  const totalAmount = useMemo(() => {
    const items = form.watch('items');
    return items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  }, [form.watch('items')]);

  const onInvalid = (errors: any) => {
    let errorMessage = "Verifique os campos obrigatórios e tente novamente.";
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstError = errorKeys[0];
      if (firstError === 'items' && Array.isArray(errors.items)) {
        for (let i = 0; i < errors.items.length; i++) {
          const itemError = errors.items[i];
          if (itemError) {
            if (itemError.quantity) {
              errorMessage = `Item ${i + 1}: ${itemError.quantity.message}`;
              break;
            }
            if (itemError.unitCost) {
              errorMessage = `Item ${i + 1}: ${itemError.unitCost.message}`;
              break;
            }
          }
        }
      } else if (firstError === 'items' && errors.items.message) {
        errorMessage = errors.items.message;
      } else if (errors[firstError]?.message) {
        errorMessage = errors[firstError].message;
      }
    }

    toast({
      variant: "destructive",
      title: "Erro de Validação",
      description: errorMessage,
    });
  };


  const onSubmit = async (data: PurchaseOrderFormData) => {
    if (!companyId || !userProfile || !firebase || !firebase.auth) return;

    if (data.status === 'Recebido' && !data.destinationLocationId) {
      form.setError("destinationLocationId", { type: "manual", message: "Selecione um local de estoque para receber os produtos." });
      toast({ variant: "destructive", title: "Local de Destino Obrigatório", description: "É necessário selecionar um local de estoque para pedidos recebidos." });
      return;
    }

    setIsSaving(true);

    const distributor = distributors.find(d => d.uid === data.supplierId);

    if (!distributor) {
      toast({
        variant: "destructive",
        title: "Distribuidor não encontrado",
        description: "Por favor, selecione o distribuidor novamente ou recarregue a página."
      });
      setIsSaving(false);
      return;
    }

    const supplierName = distributor.displayName;

    const cleanItems = data.items.map(({ productId, productCode, productDescription, unit, quantity, unitCost, totalCost }) => ({
      productId,
      productCode,
      productDescription,
      unit: unit || "",
      quantity,
      unitCost,
      totalCost,
    }));

    try {
      const baseOrderData = {
        ...data,
        items: cleanItems,
        companyId,
        supplierName,
        totalAmount,
        creatorName: userProfile.displayName || userProfile.email || 'Usuário desconhecido',
        distributorUid: distributor.uid,
        deliveryDate: data.deliveryDate.toISOString(),
        notes: data.notes || '',
        destinationLocationId: data.destinationLocationId || '',
        companyName: company?.name || 'Empresa Desconhecida',
      };

      if (isEditing) {
        let updateData: any = { ...baseOrderData };
        let historyNotes = '';
        let successMessage = "Pedido de compra atualizado.";

        if (mode === 'distributor') {
          updateData.status = 'Pendente de Aprovação do Comprador';
          historyNotes = 'Pedido editado pelo distribuidor.';
          successMessage = "Revisão do pedido enviada ao comprador.";
        }

        await updatePurchaseOrder(firebase.db, firebase.auth, orderId, { ...updateData, notes: historyNotes });

        if (data.status === 'Recebido' && originalStatus !== 'Recebido' && data.destinationLocationId) {
          await updateProductStock(firebase.db, cleanItems, data.destinationLocationId);
        }
        toast({ title: "Sucesso!", description: successMessage });
      } else {
        const newOrderData: any = {
          ...baseOrderData
        };
        await addPurchaseOrder(firebase.db, newOrderData);

        toast({ title: "Sucesso!", description: "Pedido de compra criado." });
      }

      router.push(mode === 'distributor' ? `/distribuidor/pedidos/view/${orderId}` : '/compras');

    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading) {
    return (
        <div className="flex h-[80vh] items-center justify-center">
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
                    <ShoppingCart className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                    <p className="text-2xl font-semibold tracking-tighter text-primary">Carregando Formulário</p>
                    <p className="text-xs font-semibold text-muted-foreground/40 uppercase tracking-[0.3em] animate-pulse">Motor de Inteligência</p>
                </div>
            </div>
        </div>
    );
  }

  const handleCancel = () => {
    if (mode === 'distributor' && isEditing) {
      router.push(`/distribuidor/pedidos/view/${orderId}`);
    } else {
      router.push('/compras');
    }
  };

  return (
    <main className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-10">
          
          <header className="flex flex-col gap-8 px-6 pt-8 pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
                        <ShoppingCart className="text-primary h-8 w-8" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="font-semibold tracking-tighter text-foreground text-xl">
                            {isEditing ? (mode === 'distributor' ? "Revisar Pedido" : "Editar Pedido") : "Novo Pedido de Compra"}
                        </h1>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40">Portal de Suprimentos Premium</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" type="button" onClick={handleCancel} className="h-10 px-6 rounded-xl font-semibold text-xs uppercase tracking-widest bg-stone-100 dark:bg-stone-800/50 hover:bg-stone-200 dark:hover:bg-stone-800 transition-all border border-stone-200 dark:border-stone-700">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="h-10 px-8 rounded-xl font-semibold tracking-tight shadow-premium bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all text-xs">
                    {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (mode === 'distributor' ? <Send className="mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />)}
                    {mode === 'distributor' ? "Enviar p/ Revisão" : "Confirmar Pedido"}
                  </Button>
                </div>
            </div>
          </header>

          <div className="px-6 space-y-10">
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">01</div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/40">Definições da Transação</h3>
                </div>
                <Card className="border-none shadow-premium bg-background/40 backdrop-blur-3xl rounded-xl overflow-visible">
                    <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                        <FormField
                        control={form.control}
                        name="supplierId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col md:col-span-2">
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1 mb-2">Parceiro Fornecedor</FormLabel>
                            <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant="outline" role="combobox" className={cn("h-12 w-full justify-between font-semibold text-sm rounded-2xl bg-background/50 border-border/40 hover:bg-background/80 transition-all px-4", !field.value && "text-muted-foreground")} disabled={mode === 'distributor'}>
                                    <div className="flex items-center gap-2 truncate">
                                        <FileText className="h-4 w-4 text-primary/30" />
                                        {field.value ? distributors.find(d => d.uid === field.value)?.displayName : "Selecionar distribuidor..."}
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl overflow-hidden" align="start">
                                <Command className="bg-transparent" shouldFilter={false}>
                                    <CommandInput placeholder="Filtrar por nome comercial..." value={distributorSearch} onValueChange={setDistributorSearch} className="h-14 font-semibold border-none focus:ring-0" />
                                    <CommandList className="max-h-[300px]">
                                    <CommandEmpty className="p-4 text-center font-semibold text-muted-foreground/40 text-xs">Distribuidor não localizado</CommandEmpty>
                                    <CommandGroup className="p-2">
                                        {filteredDistributors.map(distributor => (
                                        <CommandItem key={distributor.uid} value={distributor.uid} className="uppercase rounded-xl px-4 py-3 font-semibold aria-selected:bg-primary/10 aria-selected:text-primary transition-all cursor-pointer mb-1" onSelect={() => { field.onChange(distributor.uid); setSupplierPopoverOpen(false); }}>
                                            <Check className={cn("mr-3 h-4 w-4", distributor.uid === field.value ? "opacity-100" : "opacity-0")} />
                                            {distributor.displayName}
                                        </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage className="text-[10px] font-semibold" />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="deliveryDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1 mb-2">Expectativa de Entrega</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant={"outline"} className={cn("h-12 w-full justify-start text-left font-semibold text-sm rounded-2xl bg-background/50 border-border/40 hover:bg-background/80 transition-all px-4", !field.value && "text-muted-foreground")} disabled={mode === 'distributor'}>
                                    <CalendarIcon className="mr-3 h-4 w-4 text-primary/30" />
                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Definir data...</span>}
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl overflow-hidden" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} className="p-4" />
                                </PopoverContent>
                            </Popover>
                            <FormMessage className="text-[10px] font-semibold" />
                            </FormItem>
                        )}
                        />
                        <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1 mb-2">Status Operacional</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={mode === 'distributor'}>
                            <FormControl>
                                <SelectTrigger className="h-12 font-semibold text-sm rounded-2xl bg-background/50 border-border/40 hover:bg-background/80 transition-all px-4">
                                    <SelectValue />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                <SelectItem value="Rascunho" className="rounded-xl">Documento Provisório</SelectItem>
                                <SelectItem value="Pedido" className="rounded-xl text-blue-600">Pedido Confirmado</SelectItem>
                                <SelectItem value="Recebido" className="rounded-xl text-emerald-600">Material Recebido</SelectItem>
                                <SelectItem value="Cancelado" className="rounded-xl text-destructive">Operação Cancelada</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px] font-semibold" />
                        </FormItem>
                        )} />
                    </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">02</div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/40">Composição do Pedido</h3>
                </div>
                <Card className="border-none shadow-premium bg-background/40 backdrop-blur-3xl rounded-xl overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-8 pb-4">
                        <div className="flex flex-col gap-4">
                          <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 ml-1">Acrescentar Itens de Catálogo</FormLabel>
                          <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="h-12 w-full md:w-[450px] justify-between font-semibold rounded-2xl bg-background/50 border-border/40 shadow-sm transition-all text-sm px-6">
                                <div className="flex items-center gap-3">
                                    <Search className="h-4 w-4 text-primary/30" />
                                    {productSearch || "Procurar por descrição ou código..."}
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl overflow-hidden" align="start">
                              <Command className="bg-transparent" shouldFilter={false}>
                                <CommandInput placeholder="Digitar termo de busca..." value={productSearch} onValueChange={setProductSearch} className="h-14 font-semibold border-none focus:ring-0" />
                                <CommandList className="max-h-[350px]">
                                  <CommandEmpty className="p-4 text-center font-semibold text-muted-foreground/40 text-xs">Objeto não localizado no inventário</CommandEmpty>
                                  <CommandGroup className="p-2">
                                    {filteredProducts.map((product) => {
                                      const stock = product.stockQuantity || 0;
                                      const minStock = product.minStockQuantity || 0;
                                      const isLowStock = stock <= minStock;
                                      return (
                                        <CommandItem key={product.id} value={product.id} className="uppercase rounded-xl px-4 py-3 font-semibold aria-selected:bg-primary/10 aria-selected:text-primary transition-all cursor-pointer mb-1 border-b border-primary/[0.02]" onSelect={() => addProductToOrder(product)}>
                                          <div className="flex justify-between items-center w-full">
                                            <div className="flex flex-col">
                                              <span className="text-sm tracking-tight">{product.description}</span>
                                              <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest mt-0.5">{product.item}</span>
                                            </div>
                                            <Badge variant={isLowStock ? "destructive" : "secondary"} className="h-6 font-semibold text-[9px] uppercase tracking-tighter rounded-lg">
                                              {isLowStock && <AlertTriangle className="mr-1 h-3 w-3" />}
                                              DISP: {stock}
                                            </Badge>
                                          </div>
                                        </CommandItem>
                                      )
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="overflow-x-auto w-full">
                        <Table>
                          <TableHeader className="bg-primary/[0.03] border-none h-[34px]">
                            <TableRow className="hover:bg-transparent h-[34px]">
                              <TableHead className="px-6 text-xs font-semibold uppercase tracking-widest text-primary/40 h-[34px]">Especificação Técnica</TableHead>
                              <TableHead className="w-32 px-4 text-center text-xs font-semibold uppercase tracking-widest text-primary/40 h-[34px]">Quantidade</TableHead>
                              <TableHead className="w-24 px-4 text-center text-xs font-semibold uppercase tracking-widest text-primary/40 h-[34px]">Unidade</TableHead>
                              <TableHead className="w-40 px-4 text-right text-xs font-semibold uppercase tracking-widest text-primary/40 h-[34px]">Custo Unitário</TableHead>
                              <TableHead className="w-40 px-6 text-right text-xs font-semibold uppercase tracking-widest text-primary/40 h-[34px]">Consolidado</TableHead>
                              <TableHead className="w-16 px-4 text-center h-[34px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fields.map((field, index) => (
                              <TableRow key={field.key} className="border-border/40 transition-all group h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30">
                                <TableCell className="py-0 px-6">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-xs tracking-tight text-foreground group-hover:text-primary transition-colors">{field.productDescription}</span>
                                    <span className="text-[10px] font-mono font-semibold text-primary/30 uppercase tracking-widest mt-0.5">{field.productCode}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-0 px-4">
                                  <Input 
                                    type="number" 
                                    value={field.quantity} 
                                    onChange={e => handleItemValueChange(index, 'quantity', e.target.value)} 
                                    className="h-8 text-center font-bold text-xs rounded-lg bg-background/50 border-border/40 shadow-inner" 
                                  />
                                </TableCell>
                                <TableCell className="py-0 px-4 text-center">
                                  <Badge variant="outline" className="font-bold text-[9px] uppercase tracking-widest bg-primary/5 text-primary/60 border-none h-5 px-2 rounded-md">{field.unit}</Badge>
                                </TableCell>
                                <TableCell className="py-0 px-4">
                                  <Input 
                                    type="number" 
                                    value={field.unitCost} 
                                    onChange={e => handleItemValueChange(index, 'unitCost', e.target.value)} 
                                    className="h-8 text-right font-bold text-xs rounded-lg bg-background/50 border-border/40 shadow-inner" 
                                  />
                                </TableCell>
                                <TableCell className="py-0 px-6 text-right">
                                  <span className="font-bold text-xs text-foreground group-hover:text-emerald-600 transition-colors">
                                    {formatCurrency(field.totalCost)}
                                  </span>
                                </TableCell>
                                <TableCell className="py-0 px-4 text-center">
                                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="p-6 bg-primary/[0.02] border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex-1 w-full max-w-xl">
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input placeholder="Adicionar observações técnicas ou logísticas ao pedido..." {...field} className="h-10 font-semibold rounded-xl bg-background/60 border-border/40 shadow-inner focus:bg-background/80 transition-all px-4 text-xs" />
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-semibold" />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40">Total do Pedido</p>
                          <p className="text-2xl font-semibold tracking-tighter text-foreground group-hover:text-primary transition-all">
                             {formatCurrency(totalAmount)}
                          </p>
                        </div>
                      </div>
                      
                      {form.formState.errors.items && (
                        <div className="p-4 bg-destructive/5 text-center">
                           <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
                             {form.formState.errors.items.message || (form.formState.errors.items as any)?.root?.message}
                           </p>
                        </div>
                      )}
                    </CardContent>
                </Card>
            </div>
          </div>
        </form>
      </Form>
    </main>
  );
}
