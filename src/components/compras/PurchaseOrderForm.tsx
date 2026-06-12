

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
import { Loader2, Save, Trash2, Search, AlertTriangle, ChevronsUpDown, Check, FileText, Send, Warehouse, Truck, MapPin, PlusCircle, ShoppingCart, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { getPurchaseOrder, addPurchaseOrder, updatePurchaseOrder, getProductsOnce, getDistributorsOnce, updateProductStock, getStockLocations, getQuote, getTeamMembersOnce } from "@/lib/firebase/firestore";
import type { Product, UserProfile, PurchaseOrder, PurchaseOrderItem, StockLocation, Quote } from "@/lib/data";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";


const purchaseOrderItemSchema = z.object({
  productId: z.string(),
  productCode: z.string(),
  productDescription: z.string(),
  unit: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "A quantidade deve ser maior que zero."),
  unitCost: z.coerce.number().min(0, "Custo não pode ser negativo."),
  totalCost: z.number(),
  itemStatus: z.enum(["Confirmado", "Sem Estoque", "Substituído"]).optional(),
  distributorNotes: z.string().optional(),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Selecione um distribuidor."),
  deliveryOption: z.enum(["retirada", "entrega"], { required_error: "Selecione uma opção de entrega/retirada." }),
  deliveryAddressType: z.enum(["company", "other"]).optional(),
  deliveryStreet: z.string().optional(),
  deliveryNumber: z.string().optional(),
  deliveryNeighborhood: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryState: z.string().optional(),
  deliveryCep: z.string().optional(),
  deliveryReference: z.string().optional(),
  status: z.enum(["Rascunho", "Pedido", "Recebido", "Cancelado", "Pendente de Aprovação do Comprador", "Em preparação", "Pronto para Retirada", "Enviado", "Revisão Aprovada"]),
  destinationLocationId: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1, "Adicione pelo menos um item ao pedido."),
  assignedSalespersonId: z.string().optional(),
}).refine(data => {
    if (data.deliveryOption === 'entrega' && data.deliveryAddressType === 'other') {
        return !!data.deliveryStreet && !!data.deliveryCity && !!data.deliveryState;
    }
    return true;
}, {
    message: "O endereço de entrega é obrigatório quando 'Outro Endereço' é selecionado.",
    path: ["deliveryStreet"],
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

const formatCurrency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const normalizeString = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

type PurchaseOrderFormProps = {
  mode?: 'buyer' | 'distributor';
};

const formatCep = (value: string) => {
    if (!value) return value;
    const cep = value.replace(/\D/g, "").slice(0, 8);
    if (cep.length <= 5) return cep;
    return `${cep.slice(0, 5)}-${cep.slice(5, 8)}`;
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
  const [salespeople, setSalespeople] = useState<UserProfile[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<PurchaseOrder['status'] | null>(null);
  
  const [orderOwnerCompanyId, setOrderOwnerCompanyId] = useState<string | undefined>(undefined);
  
  const [productSearch, setProductSearch] = useState('');
  const [distributorSearch, setDistributorSearch] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [distributorAction, setDistributorAction] = useState<'review' | 'prepare'>('review');

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
      deliveryOption: "retirada",
      deliveryAddressType: "company",
      items: [],
      deliveryReference: "",
    },
  });

  const { fields, append, remove, update, replace } = useFieldArray({
    control: form.control,
    name: "items",
    keyName: "key",
  });
  
  useEffect(() => {
    if (!firebase.db) return;

    const currentCompanyId = companyId;
    if (!currentCompanyId && !isEditing) return;
    
    async function loadData() {
      setIsLoading(true);
      try {
        const orderDataForContext = isEditing ? await getPurchaseOrder(firebase.db, orderId) : null;
        const dataCompanyId = mode === 'buyer' ? currentCompanyId : orderDataForContext?.companyId || currentCompanyId;


        if (!dataCompanyId) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível determinar a empresa para carregar os dados.' });
            setIsLoading(false);
            return;
        }

        const [productsData, distributorsData, locationsData] = await Promise.all([
          getProductsOnce(firebase.db, dataCompanyId, 'Ativo'),
          getDistributorsOnce(firebase.db),
          new Promise<StockLocation[]>(res => getStockLocations(firebase.db, dataCompanyId, res, console.error))
        ]);
        setProducts(productsData);
        setDistributors(distributorsData);
        setStockLocations(locationsData);

        const centralLocation = locationsData.find(loc => loc.isCentral);
        
        let initialValues: Partial<PurchaseOrderFormData> = {
            status: "Rascunho",
            deliveryOption: "retirada",
            deliveryAddressType: "company",
            items: [],
            destinationLocationId: centralLocation?.id || "",
            deliveryReference: "",
        };

        if (isEditing && orderDataForContext) {
          setOrderOwnerCompanyId(orderDataForContext.companyId);
            const items = (orderDataForContext.items || []).map(item => ({
                ...item,
                productCode: String(item.productCode || ''),
                productDescription: String(item.productDescription || '')
            }));
            initialValues = {
              supplierId: orderDataForContext.supplierId,
              status: orderDataForContext.status,
              deliveryOption: orderDataForContext.deliveryOption || 'retirada',
              deliveryAddressType: orderDataForContext.deliveryAddressType || 'company',
              deliveryStreet: orderDataForContext.deliveryStreet || '',
              deliveryNumber: orderDataForContext.deliveryNumber || '',
              deliveryNeighborhood: orderDataForContext.deliveryNeighborhood || '',
              deliveryCity: orderDataForContext.deliveryCity || '',
              deliveryState: orderDataForContext.deliveryState || '',
              deliveryCep: orderDataForContext.deliveryCep || '',
              deliveryReference: orderDataForContext.deliveryReference || '',
              destinationLocationId: orderDataForContext.destinationLocationId || centralLocation?.id || "",
              notes: orderDataForContext.notes,
              items: items,
              assignedSalespersonId: orderDataForContext.assignedSalespersonId || '',
            };
            setOriginalStatus(orderDataForContext.status);
        } else {
            setOrderOwnerCompanyId(currentCompanyId);
            if (fromQuoteId) {
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
                        itemStatus: 'Confirmado' as const,
                        distributorNotes: ''
                    }));
                    initialValues.items = mappedItems;
                }
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
  }, [companyId, isEditing, orderId, fromQuoteId, supplierIdFromQuote, firebase.db, toast, router, form, mode]);

  const selectedSupplierId = form.watch('supplierId');
  useEffect(() => {
      if (selectedSupplierId && firebase.db) {
          const fetchSalespeople = async () => {
              const distributor = distributors.find(d => d.uid === selectedSupplierId);
              if (distributor?.companyId) {
                  const members = await getTeamMembersOnce(firebase.db, distributor.companyId);
                  setSalespeople(members.filter(m => m.role === 'vendedor'));
              } else {
                  setSalespeople([]);
              }
          };
          fetchSalespeople();
      }
  }, [selectedSupplierId, distributors, firebase.db]);
  
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
      itemStatus: "Confirmado",
      distributorNotes: ""
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

    const newTotalCost = currentItem.itemStatus === 'Sem Estoque' 
        ? 0 
        : (newQuantity || 0) * (newUnitCost || 0);

    update(index, {
        ...currentItem,
        [field]: numericValue,
        totalCost: newTotalCost,
    });
  };

  const totalAmount = useMemo(() => {
    const items = form.watch('items');
    return items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  }, [form.watch('items')]);

  const onInvalid = (errors: any) => {
    let errorMessage = "Verifique os campos obrigatórios e tente novamente.";
    const errorKeys = Object.keys(errors);
    if(errorKeys.length > 0) {
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
    if (!orderOwnerCompanyId || !userProfile || !firebase || !firebase.auth) {
        toast({ variant: "destructive", title: "Erro", description: "Dados da empresa compradora não encontrados." });
        return;
    }
    
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
    const salesperson = salespeople.find(s => s.uid === data.assignedSalespersonId);
    
    const cleanItems = data.items.map(({ productId, productCode, productDescription, unit, quantity, unitCost, totalCost, itemStatus, distributorNotes }) => ({
        productId,
        productCode,
        productDescription,
        unit: unit || "",
        quantity,
        unitCost,
        totalCost,
        itemStatus: itemStatus || 'Confirmado',
        distributorNotes: distributorNotes || '',
    }));

    try {
        // Base payload without fields that shouldn't be overwritten on edit
        const orderPayload = {
          ...data,
          items: cleanItems,
          supplierName,
          totalAmount,
          distributorUid: distributor.uid,
          distributorCompanyId: distributor.companyId,
          assignedSalespersonId: data.assignedSalespersonId === 'any' ? '' : data.assignedSalespersonId || '',
          assignedSalespersonName: salesperson ? salesperson.displayName : '',
          deliveryOption: data.deliveryOption,
          notes: data.notes || '',
          destinationLocationId: data.destinationLocationId || '',
          deliveryAddressType: data.deliveryAddressType,
          deliveryStreet: data.deliveryAddressType === 'other' ? data.deliveryStreet : '',
          deliveryNumber: data.deliveryAddressType === 'other' ? data.deliveryNumber : '',
          deliveryNeighborhood: data.deliveryAddressType === 'other' ? data.deliveryNeighborhood : '',
          deliveryCity: data.deliveryAddressType === 'other' ? data.deliveryCity : '',
          deliveryState: data.deliveryAddressType === 'other' ? data.deliveryState : '',
          deliveryCep: data.deliveryAddressType === 'other' ? data.deliveryCep : '',
          deliveryReference: data.deliveryAddressType === 'other' ? data.deliveryReference : '',
        };

        if (isEditing) {
            // Exclude fields that should not be changed on update
            const { companyId, companyName, creatorName, ...updateData }: Partial<PurchaseOrder> = { ...orderPayload };
            
            let successMessage = "Pedido de compra atualizado.";

            if (mode === 'distributor') {
                if (originalStatus === 'Pedido') {
                    if (distributorAction === 'prepare') {
                        updateData.status = 'Em preparação';
                        successMessage = "Pedido enviado para preparação.";
                    } else { // 'review'
                        updateData.status = 'Pendente de Aprovação do Comprador';
                        successMessage = "Revisão do pedido enviada ao comprador.";
                    }
                } else if (originalStatus === 'Revisão Aprovada') {
                    if (distributorAction === 'prepare') {
                        updateData.status = 'Em preparação';
                        successMessage = "Alterações salvas e pedido movido para preparação.";
                    } else {
                        successMessage = "Alterações no pedido aprovado foram salvas.";
                    }
                } else if (originalStatus === 'Em preparação') {
                    successMessage = "Alterações no pedido salvas.";
                }
            }

            await updatePurchaseOrder(firebase.db, firebase.auth, orderId, updateData);
            
            if (data.status === 'Recebido' && originalStatus !== 'Recebido' && data.destinationLocationId) {
                await updateProductStock(firebase.db, cleanItems, data.destinationLocationId);
            }
            toast({ title: "Sucesso!", description: successMessage });
            router.push(mode === 'distributor' ? `/distribuidor/pedidos/view/${orderId}` : '/compras');
        } else {
             const newOrderData: any = {
                ...orderPayload,
                companyId: orderOwnerCompanyId,
                companyName: company?.name || 'Empresa Desconhecida',
                creatorName: userProfile.displayName || userProfile.email || 'Usuário desconhecido',
            };
            const newOrderId = await addPurchaseOrder(firebase.db, newOrderData);
            
            toast({ title: "Sucesso!", description: "Pedido de compra criado." });
            router.push(`/compras/view/${newOrderId}`);
        }

    } catch (error: any) {
        toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } finally {
        setIsSaving(false);
    }
  };


  const handleCepBlur = async (cep: string) => {
    const cepOnlyNumbers = cep.replace(/\D/g, "");
    if (cepOnlyNumbers.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepOnlyNumbers}/json/`);
      const data = await response.json();
      if (!data.erro) {
        form.setValue("deliveryStreet", data.logradouro);
        form.setValue("deliveryNeighborhood", data.bairro);
        form.setValue("deliveryCity", data.localidade);
        form.setValue("deliveryState", data.uf);
      } else {
        toast({ variant: "destructive", title: "CEP não encontrado" });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao buscar CEP" });
    } finally {
      setIsFetchingCep(false);
    }
  };


  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }
  
  const handleCancel = () => {
    if (mode === 'distributor' && isEditing) {
        router.push(`/distribuidor/pedidos/view/${orderId}`);
    } else {
        router.back();
    }
  };
  
  const handleSend = () => {
    form.setValue('status', 'Pedido');
    form.handleSubmit(onSubmit, onInvalid)();
  };

  const deliveryOption = form.watch("deliveryOption");
  const deliveryAddressType = form.watch("deliveryAddressType");

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

                    </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" type="button" onClick={handleCancel} className="h-10 px-6 rounded-xl font-semibold text-xs uppercase tracking-widest bg-stone-100 dark:bg-stone-800/50 hover:bg-stone-200 dark:hover:bg-stone-800 transition-all border border-stone-200 dark:border-stone-700">
                    Cancelar
                  </Button>
                  
                  {mode === 'buyer' && (
                      <div className="flex items-center gap-2">
                          <Button variant="secondary" type="submit" disabled={isSaving} className="h-10 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all border-none shadow-sm">
                              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/> }
                              Salvar Rascunho
                          </Button>
                          <Button onClick={handleSend} disabled={isSaving} className="h-10 px-8 rounded-xl font-semibold tracking-tight shadow-premium bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all text-xs">
                              <Send className="mr-2 h-4 w-4"/> Enviar Pedido
                          </Button>
                      </div>
                  )}

                  {mode === 'distributor' && (
                      <div className="flex items-center gap-2">
                          {(originalStatus === 'Pedido' || originalStatus === undefined) && (
                              <>
                                  <Button type="submit" onClick={() => setDistributorAction('review')} disabled={isSaving} className="h-10 px-6 rounded-xl font-semibold tracking-tight bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all text-xs">
                                      <Send className="mr-2 h-4 w-4" /> Enviar para Revisão
                                  </Button>
                                  <Button variant="secondary" type="button" onClick={() => { setDistributorAction('prepare'); form.handleSubmit(onSubmit, onInvalid)(); }} disabled={isSaving} className="h-10 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all border-none">
                                      <CheckCircle className="mr-2 h-4 w-4" /> Aprovar e Preparar
                                  </Button>
                              </>
                          )}
                          {originalStatus === 'Revisão Aprovada' && (
                              <Button type="submit" onClick={() => setDistributorAction('prepare')} disabled={isSaving} className="h-10 px-8 rounded-xl font-semibold tracking-tight shadow-premium bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all text-xs">
                                  <Save className="mr-2 h-4 w-4" /> Salvar e Iniciar Preparação
                              </Button>
                          )}
                          {originalStatus === 'Em preparação' && (
                              <Button type="submit" disabled={isSaving} className="h-10 px-8 rounded-xl font-semibold tracking-tight shadow-premium bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all text-xs">
                                  <Save className="mr-2 h-4 w-4" /> Salvar Alterações
                              </Button>
                          )}
                      </div>
                  )}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-end">
                       <FormField
                          control={form.control}
                          name="supplierId"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/50 ml-1 mb-2">Parceiro Fornecedor</FormLabel>
                              <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button variant="outline" role="combobox" className={cn("h-12 w-full justify-between font-semibold text-sm rounded-2xl bg-background/50 border-primary/20 hover:bg-background/80 transition-all px-4", !field.value && "text-muted-foreground")} disabled={isEditing}>
                                      <div className="flex items-center gap-2 truncate">
                                        <FileText className="h-4 w-4 text-primary/30" />
                                        {field.value ? distributors.find(d => d.uid === field.value)?.displayName : "Selecionar distribuidor..."}
                                      </div>
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl overflow-hidden" align="start">
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
                            name="assignedSalespersonId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/50 ml-1 mb-2">Vendedor (Opcional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSupplierId}>
                                        <FormControl>
                                          <SelectTrigger className="h-12 font-semibold text-sm rounded-2xl bg-background/50 border-primary/20 hover:bg-background/80 transition-all px-4">
                                            <SelectValue placeholder="Atribuir a um vendedor..." />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                            <SelectItem value="any" className="rounded-xl">Qualquer vendedor</SelectItem>
                                            {salespeople.map(sp => (
                                                <SelectItem key={sp.uid} value={sp.uid} className="rounded-xl">{sp.displayName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage className="text-[10px] font-semibold" />
                                </FormItem>
                            )}
                         />
                         <FormField control={form.control} name="destinationLocationId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/50 ml-1 mb-2">Local de Destino do Estoque</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12 font-semibold text-sm rounded-2xl bg-background/50 border-primary/20 hover:bg-background/80 transition-all px-4">
                                        <SelectValue placeholder="Selecione o estoque..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                      {stockLocations.map(loc => <SelectItem key={loc.id} value={loc.id} className="rounded-xl">{loc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="text-[10px] font-semibold" />
                            </FormItem>
                        )}/>
                    </div>
                <div className="pt-2">
                    <FormField
                      control={form.control}
                      name="deliveryOption"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/50 ml-1">Logística de Movimentação</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="grid grid-cols-1 md:grid-cols-2 gap-4"
                            >
                              <FormItem>
                                <FormControl>
                                  <RadioGroupItem value="retirada" id="retirada" className="sr-only" />
                                </FormControl>
                                <Label
                                  htmlFor="retirada"
                                  className={cn(
                                    "flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-primary/5 shadow-sm",
                                    field.value === "retirada" ? "border-primary bg-primary/[0.03] shadow-md" : "border-border/40 bg-background/50"
                                  )}
                                >
                                  <div className={cn("p-2 rounded-xl", field.value === "retirada" ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                                    <Warehouse className="h-5 w-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm">Retirada no Local</span>
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Cliente retira no CD do Fornecedor</span>
                                  </div>
                                </Label>
                              </FormItem>
                              <FormItem>
                                <FormControl>
                                  <RadioGroupItem value="entrega" id="entrega" className="sr-only" />
                                </FormControl>
                                <Label
                                  htmlFor="entrega"
                                  className={cn(
                                    "flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-primary/5 shadow-sm",
                                    field.value === "entrega" ? "border-primary bg-primary/[0.03] shadow-md" : "border-border/40 bg-background/50"
                                  )}
                                >
                                  <div className={cn("p-2 rounded-xl", field.value === "entrega" ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                                    <Truck className="h-5 w-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm">Solicitar Entrega</span>
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Logística por conta do Fornecedor</span>
                                  </div>
                                </Label>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage className="text-[10px] font-semibold" />
                        </FormItem>
                      )}
                    />
                </div>

                {deliveryOption === 'entrega' && (
                    <div className="mt-8 animate-in slide-in-from-top-2 duration-500">
                         <Card className="border-none shadow-inner bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl overflow-hidden">
                             <CardContent className="p-6">
                                <FormField
                                    control={form.control}
                                    name="deliveryAddressType"
                                    render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MapPin className="h-4 w-4 text-primary" />
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/50">Destino da Remessa</FormLabel>
                                        </div>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="company" id="addr-company" className="text-primary border-primary/20" /></FormControl>
                                                    <Label htmlFor="addr-company" className="text-xs font-bold cursor-pointer text-muted-foreground hover:text-foreground">Sede da Empresa</Label>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="other" id="addr-other" className="text-primary border-primary/20" /></FormControl>
                                                    <Label htmlFor="addr-other" className="text-xs font-bold cursor-pointer text-muted-foreground hover:text-foreground">Outro Endereço</Label>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-semibold" />
                                    </FormItem>
                                    )}
                                />
                                {deliveryAddressType === 'other' && (
                                    <div className="mt-6 space-y-6 animate-in fade-in duration-300">
                                         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <FormField control={form.control} name="deliveryCep" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/40 ml-1">CEP</FormLabel>
                                                    <div className="relative">
                                                        <FormControl><Input {...field} onBlur={(e) => handleCepBlur(e.target.value)} onChange={(e)=>field.onChange(formatCep(e.target.value))} className="h-10 rounded-xl bg-background/80 border-border/40 focus:bg-background transition-all pl-4 text-xs font-semibold" /></FormControl>
                                                        {isFetchingCep && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-primary"/>}
                                                    </div>
                                                    <FormMessage className="text-[10px] font-semibold" />
                                                </FormItem>
                                            )}/>
                                            <div className="md:col-span-2">
                                                <FormField control={form.control} name="deliveryStreet" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/40 ml-1">Logradouro</FormLabel>
                                                        <FormControl><Input {...field} className="h-10 rounded-xl bg-background/80 border-border/40 focus:bg-background transition-all px-4 text-xs font-semibold" /></FormControl>
                                                        <FormMessage className="text-[10px] font-semibold" />
                                                    </FormItem>
                                                )}/>
                                            </div>
                                            <FormField control={form.control} name="deliveryNumber" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/40 ml-1">Número</FormLabel>
                                                    <FormControl><Input {...field} className="h-10 rounded-xl bg-background/80 border-border/40 focus:bg-background transition-all px-4 text-xs font-semibold" /></FormControl>
                                                    <FormMessage className="text-[10px] font-semibold" />
                                                </FormItem>
                                            )}/>
                                         </div>
                                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormField control={form.control} name="deliveryNeighborhood" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/40 ml-1">Bairro</FormLabel><FormControl><Input {...field} className="h-10 rounded-xl bg-background/80 border-border/40 focus:bg-background transition-all px-4 text-xs font-semibold" /></FormControl><FormMessage className="text-[10px] font-semibold" /></FormItem>)}/>
                                            <FormField control={form.control} name="deliveryCity" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/40 ml-1">Cidade</FormLabel><FormControl><Input {...field} className="h-10 rounded-xl bg-background/80 border-border/40 focus:bg-background transition-all px-4 text-xs font-semibold" /></FormControl><FormMessage className="text-[10px] font-semibold" /></FormItem>)}/>
                                            <FormField control={form.control} name="deliveryState" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/40 ml-1">UF</FormLabel><FormControl><Input {...field} className="h-10 rounded-xl bg-background/80 border-border/40 focus:bg-background transition-all px-4 text-xs font-semibold" /></FormControl><FormMessage className="text-[10px] font-semibold" /></FormItem>)}/>
                                         </div>
                                         <FormField control={form.control} name="deliveryReference" render={({ field }) => (
                                             <FormItem>
                                                 <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/40 ml-1">Ponto de Referência</FormLabel>
                                                 <FormControl><Textarea placeholder="Indique detalhes para facilitar a entrega..." {...field} className="min-h-[80px] rounded-xl bg-background/80 border-border/40 focus:bg-background transition-all px-4 text-xs font-semibold" /></FormControl>
                                                 <FormMessage className="text-[10px] font-semibold" />
                                             </FormItem>
                                         )}/>
                                    </div>
                                )}
                             </CardContent>
                         </Card>
                    </div>
                )}
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
                      <div className="p-6 pb-4">
                        <div className="flex flex-col gap-4">
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
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl overflow-hidden" align="start">
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
                          <TableHeader className="bg-primary/[0.03] border-none">
                            <TableRow className="hover:bg-transparent h-[34px]">
                              <TableHead className="px-6 text-[10px] font-bold uppercase tracking-widest text-primary/40 h-[34px]">Especificação Técnica</TableHead>
                              <TableHead className="w-32 px-4 text-center text-[10px] font-bold uppercase tracking-widest text-primary/40 h-[34px]">Quantidade</TableHead>
                              <TableHead className="w-24 px-4 text-center text-[10px] font-bold uppercase tracking-widest text-primary/40 h-[34px]">Unid.</TableHead>
                              <TableHead className="w-40 px-4 text-right text-[10px] font-bold uppercase tracking-widest text-primary/40 h-[34px]">Custo Unitário</TableHead>
                              <TableHead className="w-40 px-6 text-right text-[10px] font-bold uppercase tracking-widest text-primary/40 h-[34px]">Consolidado</TableHead>
                              {mode === 'distributor' && <TableHead className="w-48 px-4 text-[10px] font-bold uppercase tracking-widest text-primary/40 h-[34px]">Status / Análise</TableHead>}
                              <TableHead className="w-16 px-4 text-center h-[34px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fields.map((field, index) => (
                              <TableRow key={field.key} className={cn(
                                "border-border/40 transition-all group h-[34px] hover:bg-primary/5",
                                index % 2 === 0 ? 'bg-transparent' : 'bg-primary/[0.01]',
                                field.itemStatus === 'Substituído' && 'bg-amber-500/5',
                                field.itemStatus === 'Sem Estoque' && 'bg-destructive/5 opacity-60'
                              )}>
                                <TableCell className="py-2 px-6">
                                  <div className="flex flex-col">
                                    <span className={cn("font-bold text-xs tracking-tight transition-colors", field.itemStatus === 'Sem Estoque' && "line-through text-muted-foreground")}>
                                      {field.productDescription}
                                    </span>
                                    <span className="text-[9px] font-mono font-bold text-primary/30 uppercase tracking-widest mt-0.5">{field.productCode}</span>
                                    
                                    {mode === 'distributor' && (
                                         <FormField
                                            control={form.control}
                                            name={`items.${index}.distributorNotes`}
                                            render={({ field }) => (
                                            <FormItem className="mt-2">
                                                <FormControl>
                                                    <Input placeholder="Notas do distribuidor..." {...field} className="h-7 text-[10px] rounded-lg bg-background/40 border-border/40 focus:bg-background/80 transition-all px-2 font-semibold" />
                                                </FormControl>
                                            </FormItem>
                                            )}
                                        />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-0 px-4">
                                  <Input 
                                    type="number" 
                                    value={field.quantity} 
                                    onChange={e => handleItemValueChange(index, 'quantity', e.target.value)} 
                                    className="h-8 text-center font-bold text-xs rounded-lg bg-background/50 border-border/40 shadow-inner focus:bg-background transition-all" 
                                  />
                                </TableCell>
                                <TableCell className="py-0 px-4 text-center">
                                  <Badge variant="outline" className="font-bold text-[9px] uppercase tracking-widest bg-primary/5 text-primary/60 border-none h-5 px-2 rounded-md">
                                    {field.unit}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-0 px-4">
                                  <Input 
                                    type="number" 
                                    value={field.unitCost} 
                                    onChange={e => handleItemValueChange(index, 'unitCost', e.target.value)} 
                                    className="h-8 text-right font-bold text-xs rounded-lg bg-background/50 border-border/40 shadow-inner focus:bg-background transition-all" 
                                  />
                                </TableCell>
                                <TableCell className="py-0 px-6 text-right">
                                  <span className={cn("font-bold text-xs text-foreground", field.itemStatus === 'Sem Estoque' && "line-through")}>
                                    {formatCurrency(field.totalCost)}
                                  </span>
                                </TableCell>
                                {mode === 'distributor' && (
                                  <TableCell className="py-0 px-4">
                                       <FormField
                                          control={form.control}
                                          name={`items.${index}.itemStatus`}
                                          render={({ field: statusField }) => (
                                          <FormItem>
                                              <Select 
                                                  onValueChange={(newValue) => {
                                                      statusField.onChange(newValue);
                                                      const currentItem = form.getValues(`items.${index}`);
                                                      const newTotalCost = newValue === 'Sem Estoque' 
                                                          ? 0 
                                                          : (currentItem.quantity || 0) * (currentItem.unitCost || 0);
                                                      
                                                      update(index, {
                                                          ...currentItem,
                                                          itemStatus: newValue as any,
                                                          totalCost: newTotalCost,
                                                      });
                                                  }}
                                                  value={statusField.value} 
                                                  defaultValue="Confirmado"
                                              >
                                              <FormControl>
                                                <SelectTrigger className="h-8 rounded-lg bg-background/50 border-border/40 text-[10px] font-bold uppercase tracking-tight">
                                                  <SelectValue />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent className="rounded-xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-bold text-[10px] uppercase">
                                                  <SelectItem value="Confirmado" className="rounded-lg text-emerald-600 focus:text-emerald-700">Confirmado</SelectItem>
                                                  <SelectItem value="Sem Estoque" className="rounded-lg text-destructive focus:text-destructive">Sem Estoque</SelectItem>
                                                  <SelectItem value="Substituído" className="rounded-lg text-amber-600 focus:text-amber-700">Substituído</SelectItem>
                                              </SelectContent>
                                              </Select>
                                          </FormItem>
                                      )}/>
                                  </TableCell>
                                )}
                                <TableCell className="py-0 px-4 text-center">
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="p-6 bg-primary/[0.02] border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-8">
                        <div className="flex-1 w-full max-w-xl">
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2 mb-2 ml-1">
                                            <FileText className="h-3.5 w-3.5 text-primary/40" />
                                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Observações Estratégicas</FormLabel>
                                        </div>
                                        <FormControl>
                                            <Textarea placeholder="Indique observações técnicas, logísticas ou de faturamento..." {...field} className="min-h-[80px] font-semibold rounded-2xl bg-background/60 border-border/40 shadow-inner focus:bg-background/80 transition-all px-4 py-3 text-xs" />
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-semibold" />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex flex-col items-end gap-2 pr-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40">Investimento Total do Pedido</p>
                          <div className="flex items-baseline gap-2">
                             <p className="text-2xl font-bold tracking-tighter text-foreground group-hover:text-primary transition-all">
                                {formatCurrency(totalAmount)}
                             </p>
                          </div>
                          {fields.length > 0 && (
                            <p className="text-[9px] font-bold text-primary/30 uppercase tracking-widest italic">Consolidado de {fields.length} {fields.length === 1 ? 'item' : 'itens'} técnicos</p>
                          )}
                        </div>
                      </div>
                      
                      {form.formState.errors.items && (
                        <div className="p-4 bg-destructive/5 text-center border-t border-border/40">
                           <p className="text-xs font-bold uppercase tracking-widest text-destructive animate-pulse">
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

