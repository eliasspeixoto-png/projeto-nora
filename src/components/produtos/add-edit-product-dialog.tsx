
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, Supplier, StockLocation } from "@/lib/data";
import { useEffect, useRef, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Loader2, Upload, ImageIcon, Hash, FileText, Building, Package, DraftingCompass, DollarSign, Warehouse, Truck, Scale, Check, ChevronsUpDown, ChevronDown, Percent } from "lucide-react";
import { useAuth } from "@/firebase/auth/use-user";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "../ui/textarea";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { normalizeAndCapitalize } from "@/lib/firebase/firestore";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

const formSchema = z.object({
  item: z.string().min(1, "O código é obrigatório."),
  description: z.string().min(3, "O nome do produto deve ter pelo menos 3 caracteres.").max(100),
  detailedDescription: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  segment: z.string().min(2, "Selecione ou crie um segmento."),
  unit: z.enum(['UNID', 'PÇ', 'PAR', 'M', 'M²', 'M³', 'KG', 'L', 'CX', 'PCT', 'RL', 'KIT', 'HR', 'SV']),
  materialPrice: z.coerce.number().optional(), // custo
  sellingPrice: z.coerce.number().optional(), // venda
  servicePrice: z.coerce.number().optional(),
  isPromotion: z.boolean().optional(),
  promoPrice: z.coerce.number().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  status: z.enum(['Ativo', 'Inativo']),
  
  // Fiscal
  ncm: z.string().optional(),
  cest: z.string().optional(),
  ean: z.string().optional(),
  origin: z.string().optional(),
  cfop_venda: z.string().optional(),
  cfop_compra: z.string().optional(),
  cst_icms: z.string().optional(),
  aliq_icms: z.coerce.number().optional(),
  cst_pis: z.string().optional(),
  aliq_pis: z.coerce.number().optional(),
  cst_cofins: z.string().optional(),
  aliq_cofins: z.coerce.number().optional(),
  cst_ipi: z.string().optional(),
  aliq_ipi: z.coerce.number().optional(),
  situacao_tributaria: z.string().optional(),
  codigo_anp: z.string().optional(),
  gtin_tributavel: z.string().optional(),

  // Estoque
  stockLevels: z.record(z.coerce.number().min(0)).optional(),
  stockQuantity: z.coerce.number().optional(),
  minStockQuantity: z.coerce.number().optional(),
  maxStockQuantity: z.coerce.number().optional(),
  stockAlert: z.coerce.number().optional(),
  locationDetail: z.string().optional(),
  mainSupplierId: z.string().optional(),

  // Logistica
  weight: z.coerce.number().optional(),
  grossWeight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  width: z.coerce.number().optional(),
  length: z.coerce.number().optional(),
});

type ProductFormData = Omit<Product, 'id' | 'companyId'>;

type AddEditProductDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onProductSaved: (data: ProductFormData, productId?: string) => void;
  product?: Partial<Product>; // Can be a full product for editing or partial for pre-filling
  suppliers: Supplier[];
  locations: StockLocation[];
};

export default function AddEditProductDialog({ isOpen, setOpen, onProductSaved, product, suppliers, locations }: AddEditProductDialogProps) {
  const { toast } = useToast();
  const { userProfile, company, firebase } = useAuth();
  const allProducts = company?.products || [];
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [segmentPopoverOpen, setSegmentPopoverOpen] = useState(false);
  const [newSegment, setNewSegment] = useState("");
  const [showOtherLocations, setShowOtherLocations] = useState(false);
  const [markupPercentage, setMarkupPercentage] = useState("40");
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");

  const filteredSuppliers = useMemo(() => {
    const searchStr = supplierSearch.trim().toLowerCase();
    if (!searchStr) return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));

    return suppliers.filter(s => 
        s.name.toLowerCase().includes(searchStr) || 
        (s.document && s.document.includes(searchStr))
    ).sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        const aExact = nameA === searchStr;
        const bExact = nameB === searchStr;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = nameA.startsWith(searchStr);
        const bStarts = nameB.startsWith(searchStr);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return a.name.localeCompare(b.name);
    });
  }, [suppliers, supplierSearch]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const segment = form.watch("segment");
  const isTool = segment === 'FERRAMENTAL';
  const materialPrice = form.watch("materialPrice");

  // Recalculates selling price when cost or markup changes
  useEffect(() => {
    const cost = materialPrice || 0;
    const markup = parseFloat(markupPercentage) || 0;
    
    if (cost > 0 && !isNaN(markup)) {
        const newSellingPrice = cost * (1 + markup / 100);
        form.setValue("sellingPrice", parseFloat(newSellingPrice.toFixed(2)), { shouldValidate: true });
    }
  }, [materialPrice, markupPercentage, form]);

  const uniqueSegments = useMemo(() => {
    const segments = new Set<any>(allProducts.map(p => p.segment).filter(Boolean));
    const defaultSegments = ['CERCAS', 'CÂMERAS', 'ALARMES', 'FECHADURAS', 'SERVIÇOS', 'CONCERTINA', 'INDUSTRIAL PESADA', 'FERRAMENTAL', 'REDES', 'OUTROS'];
    defaultSegments.forEach(s => segments.add(s));
    return Array.from(segments).sort();
  }, [allProducts]);

  const isEditing = !!(product && product.id);
  const itemRef = useRef<HTMLInputElement>(null);
  const fiscalTabRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);

  const centralLocation = useMemo(() => locations?.find(loc => loc.isCentral), [locations]);
  const otherLocations = useMemo(() => locations?.filter(loc => !loc.isCentral), [locations]);

  useEffect(() => {
    if (isOpen) {
      const isNewProduct = !(product && product.id);
      const defaults = {
        item: "", description: "", detailedDescription: "", model: "", manufacturer: "",
        segment: "OUTROS" as const, unit: "UNID" as const, materialPrice: 0, sellingPrice: 0,
        servicePrice: 0, isPromotion: false, promoPrice: 0, imageUrl: "", notes: "", status: "Ativo" as const, ncm: "", cest: "",
        ean: "", origin: "", cfop_venda: "", cfop_compra: "", cst_icms: "", aliq_icms: 0,
        cst_pis: "", aliq_pis: 0, cst_cofins: "", aliq_cofins: 0, cst_ipi: "", aliq_ipi: 0,
        situacao_tributaria: "", codigo_anp: "", gtin_tributavel: "", stockLevels: {},
        stockQuantity: 0, minStockQuantity: 0, maxStockQuantity: 0, stockAlert: 0,
        locationDetail: "", mainSupplierId: "none", weight: 0, grossWeight: 0,
        height: 0, width: 0, length: 0,
      };

      setShowOtherLocations(false);
      setActiveTab("general");
      setImageFile(null);
      
      const initialValues = product ? { ...defaults, ...product, isPromotion: product.isPromotion ?? false, promoPrice: product.promoPrice ?? 0, mainSupplierId: product.mainSupplierId || 'none' } : defaults;
      
      // FIX: Ensure fields that must be strings are strings
      if (initialValues.item) initialValues.item = String(initialValues.item);
      if (initialValues.ean) initialValues.ean = String(initialValues.ean);
      if (initialValues.ncm) initialValues.ncm = String(initialValues.ncm);
      if (initialValues.cest) initialValues.cest = String(initialValues.cest);
      if (initialValues.gtin_tributavel) initialValues.gtin_tributavel = String(initialValues.gtin_tributavel);
      if (initialValues.origin) initialValues.origin = String(initialValues.origin);

      const cost = initialValues.materialPrice || 0;
      const sale = initialValues.sellingPrice || 0;
      if (cost > 0 && sale > cost) {
          const markup = ((sale / cost) - 1) * 100;
          setMarkupPercentage(markup.toFixed(0));
      } else {
          setMarkupPercentage("40");
      }
      
      form.reset(initialValues);
      setPreviewImageUrl(product?.imageUrl || null);
      
      setTimeout(() => itemRef.current?.focus(), 100);
    }
  }, [product, isOpen, form]);

  useEffect(() => {
    setTimeout(() => {
        if(activeTab === 'general' && itemRef.current) {
            itemRef.current.focus();
        } else if (activeTab === 'fiscal' && fiscalTabRef.current) {
            fiscalTabRef.current.focus();
        } else if (activeTab === 'logistics' && stockRef.current) {
            stockRef.current.focus();
        }
    }, 100);
  }, [activeTab]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewImageUrl(objectUrl);
    }
  };

  useEffect(() => {
    return () => {
      if (previewImageUrl && previewImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId || !firebase) {
      toast({ variant: "destructive", title: "Erro de autenticação" });
      return;
    }
    setIsSubmitting(true);
    let finalImageUrl = values.imageUrl || '';
    
    try {
      if (imageFile) {
        const { storage } = firebase;
        if (!storage) {
          toast({
            variant: "destructive",
            title: "Erro ao enviar imagem",
            description: "O serviço de armazenamento não está disponível. Salve o produto sem imagem e tente adicionar a imagem pela tela de Produtos.",
          });
          setIsSubmitting(false);
          return;
        }
        await new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onloadend = async () => {
              try {
                const dataUrl = reader.result as string;
                const filePath = `products/${userProfile.companyId}/${Date.now()}-${imageFile.name}`;
                const fileRef = ref(storage, filePath);
                
                await uploadString(fileRef, dataUrl, 'data_url');
                finalImageUrl = await getDownloadURL(fileRef);
                resolve();
              } catch(e) {
                reject(e);
              }
            }
            reader.onerror = (error) => reject(error);
          });
      }
      
      const dataToSave = { 
        ...values,
        materialPrice: values.materialPrice ?? 0,
        sellingPrice: values.sellingPrice ?? 0,
        servicePrice: values.servicePrice ?? 0,
        promoPrice: values.promoPrice ?? 0,
      };
      if (dataToSave.mainSupplierId === 'none') {
        dataToSave.mainSupplierId = '';
      }
      
      const totalStock = Object.values(values.stockLevels || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
      dataToSave.stockQuantity = totalStock;
      
      // Formata o nome do produto e fabricante aqui
      dataToSave.description = normalizeAndCapitalize(dataToSave.description);
      if(dataToSave.manufacturer) {
        dataToSave.manufacturer = normalizeAndCapitalize(dataToSave.manufacturer);
      }

      await onProductSaved({
        ...dataToSave,
        segment: dataToSave.segment as any,
        imageUrl: finalImageUrl,
      } as any, isEditing ? product.id : undefined);

    } catch (error: any) {
        console.error("Error submitting product:", error);
        toast({
            variant: "destructive",
            title: "Erro ao Salvar",
            description: "Falha ao fazer upload da imagem. Verifique as regras de CORS do seu Firebase Storage.",
        });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stockLevels = form.watch("stockLevels") || {};
  const totalStock = Object.values(stockLevels).reduce((sum, qty) => sum + Number(qty || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-5xl sm:max-h-[92vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-premium sm:overflow-hidden sm:rounded-[2.5rem]">
        <DialogHeader className="p-8 pb-6 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-[1.2rem] bg-primary shadow-xl shadow-primary/20 text-white">
              <Package className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-2xl font-bold tracking-tighter text-primary uppercase">
                {isEditing ? "Gestão de Item" : "Novo Item no Catálogo"}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-primary/40 font-bold uppercase tracking-[0.2em]">
                {isEditing ? "Modificando Parâmetros Técnicos e Fiscais" : "Configuração Inicial de Ativo • Sistema"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} id="product-form" className="flex-1 min-h-0 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
              <div className="px-8 py-3 bg-muted/20 border-b border-border/40">
                <TabsList className="grid w-full grid-cols-3 bg-background/50 h-14 p-1.5 gap-2 rounded-2xl border border-border/40">
                  <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl transition-all font-bold uppercase tracking-widest text-[10px]">Dados Gerais</TabsTrigger>
                  <TabsTrigger value="fiscal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl transition-all font-bold uppercase tracking-widest text-[10px]">Fiscal & Preços</TabsTrigger>
                  <TabsTrigger value="logistics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl transition-all font-bold uppercase tracking-widest text-[10px]">Estoque & Logística</TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <TabsContent value="general" className="mt-0">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField
                                control={form.control}
                                name="item"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 ml-1 opacity-60">
                                      <Hash className="h-3 w-3" /> EAN / Código de Barras
                                    </FormLabel>
                                    <FormControl>
                                    <Input className="h-12 rounded-2xl bg-muted/10 border-border/40 focus:bg-background transition-all" placeholder="ex: 7899298657101" {...field} autoComplete="off" ref={itemRef} enableAutocomplete={false} />
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-bold uppercase ml-2 mt-1" />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 ml-1 opacity-60">
                                      <FileText className="h-3 w-3" /> Nome do Item
                                    </FormLabel>
                                    <FormControl>
                                    <Input className="h-12 rounded-2xl bg-muted/10 border-border/40 focus:bg-background transition-all" placeholder="ex: Central de choque Genno" {...field} autoComplete="off" />
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-bold uppercase ml-2 mt-1" />
                                </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="detailedDescription"
                            render={({ field }) => (
                             <FormItem>
                                <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                                  <DraftingCompass className="h-4 w-4" /> Descrição Detalhada
                                </FormLabel>
                                <FormControl>
                                <Textarea placeholder="Descrição completa do produto..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField
                                control={form.control}
                                name="manufacturer"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                                      <Building className="h-4 w-4" /> Marca / Fabricante
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="ex: Intelbras" {...field} autoComplete="off" />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                              <FormField control={form.control} name="mainSupplierId" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                      <Truck className="h-4 w-4" /> Fornecedor Principal
                                    </FormLabel>
                                    <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                                      <PopoverTrigger asChild>
                                        <FormControl>
                                          <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between h-10 shadow-sm border-border/40 font-normal", !field.value && "text-muted-foreground", field.value && field.value !== "none" && "uppercase")}
                                          >
                                            {field.value && field.value !== "none"
                                              ? suppliers.find((s) => s.id === field.value)?.name
                                              : "Selecione um fornecedor"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                        </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command shouldFilter={false}>
                                          <CommandInput placeholder="Buscar fornecedor..." value={supplierSearch} onValueChange={setSupplierSearch} />
                                          <CommandList>
                                            <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                                            <CommandGroup>
                                              <CommandItem
                                                value="none"
                                                onSelect={() => {
                                                  form.setValue("mainSupplierId", "none");
                                                  setSupplierPopoverOpen(false);
                                                }}
                                              >
                                                <Check className={cn("mr-2 h-4 w-4", field.value === "none" || !field.value ? "opacity-100" : "opacity-0")} />
                                                Nenhum
                                              </CommandItem>
                                              {filteredSuppliers.map((s) => (
                                                <CommandItem
                                                  value={s.name}
                                                  key={s.id}
                                                  className="uppercase"
                                                  onSelect={() => {
                                                    form.setValue("mainSupplierId", s.id);
                                                    setSupplierPopoverOpen(false);
                                                  }}
                                                >
                                                  <Check className={cn("mr-2 h-4 w-4", s.id === field.value ? "opacity-100" : "opacity-0")} />
                                                  {s.name}
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField
                                control={form.control}
                                name="segment"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                                      <ImageIcon className="h-4 w-4" /> Categoria / Segmento
                                    </FormLabel>
                                    <Popover open={segmentPopoverOpen} onOpenChange={setSegmentPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                        >
                                            {field.value || "Selecione ou crie um segmento"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command
                                            filter={(value, search) => {
                                                if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                                                return 0;
                                            }}
                                        >
                                        <CommandInput 
                                            placeholder="Buscar ou criar segmento..."
                                            value={newSegment}
                                            onValueChange={setNewSegment}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                 {newSegment && (
                                                    <CommandItem
                                                        onSelect={() => {
                                                            form.setValue("segment", newSegment.toUpperCase());
                                                            setNewSegment("");
                                                            setSegmentPopoverOpen(false);
                                                        }}
                                                    >
                                                        Criar "{newSegment}"
                                                    </CommandItem>
                                                )}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {uniqueSegments.map((s) => (
                                                <CommandItem
                                                    value={s}
                                                    key={s}
                                                    onSelect={() => {
                                                        form.setValue("segment", s);
                                                        setNewSegment("");
                                                        setSegmentPopoverOpen(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", s === field.value ? "opacity-100" : "opacity-0")} />
                                                    {s}
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
                            <FormField
                                control={form.control}
                                name="model"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                                      <Hash className="h-4 w-4" /> Modelo / Versão
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="ex: ECR-18" {...field} autoComplete="off" />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                           />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField
                                control={form.control}
                                name="unit"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                                      <Scale className="h-4 w-4" /> Unidade
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="UNID">Unidade (UNID)</SelectItem>
                                            <SelectItem value="PÇ">Peça (PÇ)</SelectItem>
                                            <SelectItem value="PAR">Par</SelectItem>
                                            <SelectItem value="M">Metro (M)</SelectItem>
                                            <SelectItem value="M²">Metro Quadrado (M²)</SelectItem>
                                            <SelectItem value="M³">Metro Cúbico (M³)</SelectItem>
                                            <SelectItem value="KG">Kilograma (KG)</SelectItem>
                                            <SelectItem value="L">Litro (L)</SelectItem>
                                            <SelectItem value="CX">Caixa (CX)</SelectItem>
                                            <SelectItem value="PCT">Pacote (PCT)</SelectItem>
                                            <SelectItem value="RL">Rolo (RL)</SelectItem>
                                            <SelectItem value="KIT">Kit</SelectItem>
                                            <SelectItem value="HR">Hora (HR)</SelectItem>
                                            <SelectItem value="SV">Serviço (SV)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                           <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                             <FormItem>
                                <FormLabel className="flex items-center gap-2 font-semibold text-primary/80">
                                  <Check className="h-4 w-4" /> Status do Produto
                                </FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Ativo">Ativo</SelectItem>
                                    <SelectItem value="Inativo">Inativo</SelectItem>
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        </div>
                        <FormItem className="pt-4">
                            <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-4">
                              <ImageIcon className="h-4 w-4" /> Foto em Alta Resolução
                            </FormLabel>
                           <FormControl>
                                <div 
                                    className="relative w-32 h-32 mx-auto rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {previewImageUrl ? (
                                        <Image src={previewImageUrl} alt="Foto do produto" fill={true} style={{objectFit:"contain"}} className="rounded-md" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"/>
                                    ) : (
                                        <div className="text-center text-muted-foreground text-xs">
                                            <Upload className="mx-auto h-6 w-6 mb-1"/>
                                            Clique para carregar
                                        </div>
                                    )}
                                     <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    </div>
                  </TabsContent>
                  <TabsContent value="fiscal" className="mt-0">
                    <div className="space-y-6 p-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="materialPrice"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 ml-1 opacity-60">
                                      <DollarSign className="h-3 w-3" /> Preço de Custo (Médio)
                                    </FormLabel>
                                   <FormControl>
                                    <Input className="h-12 rounded-2xl bg-muted/10 border-border/40 focus:bg-background transition-all font-bold" type="number" placeholder="0.00" {...field} step="0.01" ref={fiscalTabRef} value={field.value || ''} min="0" />
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-bold uppercase ml-2 mt-1" />
                                </FormItem>
                                )}
                            />
                            {!isTool && (
                                <FormField
                                    control={form.control}
                                    name="sellingPrice"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2 font-semibold text-emerald-600">
                                          <DollarSign className="h-4 w-4" /> Preço Sugerido de Venda
                                        </FormLabel>
                                       <div className="flex items-center gap-2">
                                            <FormControl>
                                                <Input type="number" placeholder="0.00" {...field} step="0.01" value={field.value || ''} min="0" />
                                            </FormControl>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    placeholder="%"
                                                    className="w-32 text-center pr-10 shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    value={markupPercentage}
                                                    onChange={(e) => setMarkupPercentage(e.target.value)}
                                                />
                                                <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                            </div>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            )}
                        </div>
                        {!isTool && (
                             <FormField
                                control={form.control}
                                name="servicePrice"
                                render={({ field }) => (
                                 <FormItem>
                                    <FormLabel className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 ml-1 opacity-60">
                                      <DraftingCompass className="h-3 w-3" /> Mão de Obra / Instalação (Serviço)
                                    </FormLabel>
                                   <FormControl>
                                    <Input className="h-12 rounded-2xl bg-muted/10 border-border/40 focus:bg-background transition-all font-bold" type="number" placeholder="0.00" {...field} step="0.01" value={field.value || ''} min="0" />
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-bold uppercase ml-2 mt-1" />
                                </FormItem>
                                )}
                            />
                        )}
                        <Separator className="my-4" />
                        <FormField
                        control={form.control}
                        name="isPromotion"
                        render={({ field }) => (
                             <FormItem className="flex flex-row items-center justify-between rounded-xl border border-orange-200 p-4 shadow-sm bg-orange-50/30">
                             <div className="space-y-0.5">
                                <FormLabel className="text-orange-700 font-semibold flex items-center gap-2">
                                  <Percent className="h-4 w-4" /> Oferta Promocional
                                </FormLabel>
                               <FormDescription>
                                Este item aparecerá na vitrine de promoções.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            </FormItem>
                        )}
                        />
                        {form.watch("isPromotion") && (
                            <FormField
                            control={form.control}
                            name="promoPrice"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Preço Promocional (R$)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="0.00" {...field} step="0.01" value={field.value || ''} min="0" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        )}
                        <Separator className="my-4" />
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField control={form.control} name="ncm" render={({ field }) => (<FormItem><FormLabel>NCM</FormLabel><FormControl><Input placeholder="Código NCM" {...field} enableAutocomplete={false} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="cest" render={({ field }) => (<FormItem><FormLabel>CEST</FormLabel><FormControl><Input placeholder="Código CEST" {...field} enableAutocomplete={false} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="ean" render={({ field }) => (<FormItem><FormLabel>EAN</FormLabel><FormControl><Input placeholder="Código de Barras" {...field} enableAutocomplete={false} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField control={form.control} name="cfop_venda" render={({ field }) => (<FormItem><FormLabel>CFOP Venda</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="cfop_compra" render={({ field }) => (<FormItem><FormLabel>CFOP Compra</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="origin" render={({ field }) => (<FormItem><FormLabel>Origem</FormLabel><FormControl><Input placeholder="0 a 8" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="cst_icms" render={({ field }) => (<FormItem><FormLabel>CST/CSOSN ICMS</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="aliq_icms" render={({ field }) => (<FormItem><FormLabel>Alíquota ICMS (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="cst_pis" render={({ field }) => (<FormItem><FormLabel>CST PIS</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="aliq_pis" render={({ field }) => (<FormItem><FormLabel>Alíquota PIS (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="cst_cofins" render={({ field }) => (<FormItem><FormLabel>CST COFINS</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="aliq_cofins" render={({ field }) => (<FormItem><FormLabel>Alíquota COFINS (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="cst_ipi" render={({ field }) => (<FormItem><FormLabel>CST IPI</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="aliq_ipi" render={({ field }) => (<FormItem><FormLabel>Alíquota IPI (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                         <FormField
                            control={form.control}
                            name="situacao_tributaria"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Situação Tributária</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o regime tributário" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                                    <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                                    <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                  </TabsContent>
                  <TabsContent value="logistics" className="mt-0">
                    <div className="space-y-4 p-1">
                      <h4 className="text-sm font-medium text-muted-foreground pt-2">Controle de Estoque</h4>
                      
                      {centralLocation && (
                        <FormField
                            control={form.control}
                            name={`stockLevels.${centralLocation.id}`}
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 ml-1 opacity-60">Estoque no Local Central ({centralLocation.name})</FormLabel>
                                <FormControl>
                                    <Input
                                    type="number"
                                    placeholder="0"
                                    {...field}
                                    ref={stockRef}
                                    className="h-12 rounded-2xl bg-muted/10 border-border/40 focus:bg-background transition-all font-bold"
                                    min="0"
                                    onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                                    value={field.value || ''}
                                    />
                                </FormControl>
                                <FormMessage className="text-[10px] font-bold uppercase ml-2 mt-1" />
                                </FormItem>
                            )}
                         />
                      )}

                      <div className="text-right font-semibold text-lg">
                        Estoque Total: {totalStock}
                      </div>

                      <div className="space-y-2">
                        <Button
                            type="button"
                            variant="link"
                            className="p-0 h-auto text-sm"
                            onClick={() => setShowOtherLocations(prev => !prev)}
                        >
                           <ChevronDown className={cn("h-4 w-4 mr-2 transition-transform", showOtherLocations && "rotate-180")}/>
                           {showOtherLocations ? "Ocultar outros locais" : "Gerenciar estoque em outros locais"}
                        </Button>
                        {showOtherLocations && otherLocations && (
                            <div className="rounded-md border mt-2">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-border/40">
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">Local de Estoque</TableHead>
                                            <TableHead className="w-32 text-center h-10 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">Quantidade</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {otherLocations.map(loc => (
                                            <TableRow key={loc.id} className="border-border/40 hover:bg-primary/5 transition-colors">
                                                <TableCell className="py-3 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2 text-primary/80">
                                                    {loc.type === 'warehouse' ? <Warehouse className="h-3 w-3 text-primary/40" /> : <Truck className="h-3 w-3 text-primary/40" />}
                                                    {loc.name}
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`stockLevels.${loc.id}`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <Input type="number" placeholder="0" {...field} className="h-8 rounded-lg text-center bg-muted/10 border-border/40 focus:bg-background transition-all font-bold" min="0" onChange={(e) => field.onChange(parseInt(e.target.value, 10))} value={field.value || ''} />
                                                                </FormControl>
                                                                <FormMessage className="text-[10px] font-bold uppercase mt-1" />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <FormField control={form.control} name="minStockQuantity" render={({ field }) => (<FormItem><FormLabel>Estoque Mínimo</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="maxStockQuantity" render={({ field }) => (<FormItem><FormLabel>Estoque Máximo</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="stockAlert" render={({ field }) => (<FormItem><FormLabel>Alerta de Estoque</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                       <FormField
                          control={form.control}
                          name="locationDetail"
                          render={({ field }) => (
                            <FormItem>
                                <FormLabel>Localização no Estoque</FormLabel>
                                <FormControl>
                                <Input placeholder="Ex: Prateleira A-1, Corredor 3" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                          )}
                        />
                      
                      <h4 className="text-sm font-medium text-muted-foreground pt-4">Logística</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                          <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Peso Líquido (kg)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="grossWeight" render={({ field }) => (<FormItem><FormLabel>Peso Bruto (kg)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Altura (cm)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="width" render={({ field }) => (<FormItem><FormLabel>Largura (cm)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="length" render={({ field }) => (<FormItem><FormLabel>Comprimento (cm)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl><FormMessage /></FormItem>)} />
                      </div>

                       <h4 className="text-sm font-medium text-muted-foreground pt-4">Informações Adicionais</h4>
                       <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Observações Internas</FormLabel><FormControl><Textarea placeholder="Informações internas sobre o produto..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </TabsContent>
                </div>
              </div>
            </Tabs>
          </form>
        </Form>
        <DialogFooter className="p-8 pt-6 bg-muted/20 border-t border-border/40 backdrop-blur-md">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-12 px-6 rounded-2xl font-bold uppercase tracking-widest text-[10px] bg-stone-100 dark:bg-stone-800/50 hover:bg-stone-200 dark:hover:bg-stone-800 transition-all border border-stone-200 dark:border-stone-700">
            Cancelar Alterações
          </Button>
          <Button type="submit" form="product-form" disabled={isSubmitting} className="h-12 px-10 rounded-2xl font-bold uppercase tracking-widest text-[10px] bg-primary shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Processando...
              </div>
            ) : (isEditing ? "Atualizar Base" : "Confirmar Cadastro")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
