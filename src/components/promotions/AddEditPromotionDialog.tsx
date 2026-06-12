
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
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, Supplier, StockLocation, Promotion } from "@/lib/data";
import { useEffect, useRef, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Loader2, Upload, ImageIcon, Hash, FileText, Building, Package, DraftingCompass, DollarSign, Warehouse, Truck, Scale, Check, ChevronsUpDown, ChevronDown, Percent, Calendar as CalendarIcon } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  promoExpiresAt: z.date().optional(),
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


type AddEditPromotionDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onSave: (data: Omit<Product, 'id' | 'companyId'>, productId?: string) => Promise<void>;
  product?: Partial<Product>;
};

export default function AddEditPromotionDialog({ isOpen, setOpen, onSave, product }: AddEditPromotionDialogProps) {
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
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const segment = form.watch("segment");
  const isTool = segment === 'FERRAMENTAL';
  const materialPrice = form.watch("materialPrice");

  useEffect(() => {
    const cost = materialPrice || 0;
    const markup = parseFloat(markupPercentage) || 0;
    
    if (cost > 0 && !isNaN(markup)) {
        const newSellingPrice = cost * (1 + markup / 100);
        form.setValue("sellingPrice", parseFloat(newSellingPrice.toFixed(2)), { shouldValidate: true });
    }
  }, [materialPrice, markupPercentage, form]);

  const uniqueSegments = useMemo(() => {
    const segments = new Set<string>();
    allProducts.forEach(p => {
      if (p.segment) segments.add(p.segment);
    });
    const defaultSegments = ['PROMOÇÃO', 'CÂMERAS', 'ALARMES', 'CERCAS', 'OUTROS'];
    defaultSegments.forEach(s => segments.add(s));
    return Array.from(segments).sort();
  }, [allProducts]);

  const isEditing = !!(product && product.id);
  const itemRef = useRef<HTMLInputElement>(null);
  const fiscalTabRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const defaults = {
        item: `PROMO-${Date.now().toString().slice(-6)}`, description: "", detailedDescription: "", model: "", manufacturer: "",
        segment: "PROMOÇÃO" as const, unit: "UNID" as const, materialPrice: 0, sellingPrice: 0,
        servicePrice: 0, isPromotion: true, promoPrice: 0, imageUrl: "", notes: "", status: "Ativo" as const, ncm: "", cest: "",
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
      
      const initialValues: Partial<Product> = product ? { ...defaults, ...product, isPromotion: true, segment: 'PROMOÇÃO' } : defaults;
      
      if (initialValues.promoExpiresAt && typeof initialValues.promoExpiresAt === 'string') {
        (initialValues as any).promoExpiresAt = new Date(initialValues.promoExpiresAt);
      }
      
      const cost = initialValues.materialPrice || 0;
      const sale = initialValues.sellingPrice || 0;
      if (cost > 0 && sale > cost) {
          const markup = ((sale / cost) - 1) * 100;
          setMarkupPercentage(markup.toFixed(0));
      } else {
          setMarkupPercentage("40");
      }
      
      form.reset(initialValues as any);
      setPreviewImageUrl(product?.imageUrl || null);
      
      setTimeout(() => itemRef.current?.focus(), 100);
    }
  }, [product, isOpen, form]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewImageUrl(objectUrl);
    }
  };

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
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(imageFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });

        const filePath = `promotions/${userProfile.companyId}/${Date.now()}-${imageFile.name}`;
        const fileRef = ref(storage, filePath);
        
        await uploadString(fileRef, dataUrl, 'data_url');
        finalImageUrl = await getDownloadURL(fileRef);
      }
      
      const dataToSave = { ...values };
      const totalStock = Object.values(values.stockLevels || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
      dataToSave.stockQuantity = totalStock;
      
      dataToSave.description = normalizeAndCapitalize(dataToSave.description);
      if(dataToSave.manufacturer) {
        dataToSave.manufacturer = normalizeAndCapitalize(dataToSave.manufacturer);
      }

      const finalData: Omit<Product, 'id' | 'companyId'> = {
        ...dataToSave,
        imageUrl: finalImageUrl,
        isPromotion: true,
        segment: 'PROMOÇÃO' as any,
        materialPrice: dataToSave.materialPrice || 0,
        promoExpiresAt: dataToSave.promoExpiresAt ? dataToSave.promoExpiresAt.toISOString() : undefined,
      } as any;

      await onSave(finalData, product?.id);

    } catch (error: any) {
        console.error("Error submitting product:", error);
        toast({
            variant: "destructive",
            title: "Erro ao Salvar",
            description: "Falha ao fazer upload da imagem ou salvar dados.",
        });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const totalStock = Object.values(form.watch("stockLevels") || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] flex flex-col bg-background/60 backdrop-blur-3xl border-border/40 shadow-2xl rounded-[3rem] p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 flex flex-row items-center gap-4 space-y-0">
          <div className="p-3 bg-primary/10 rounded-2xl shadow-inner text-primary">
            <Percent className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <DialogTitle className="text-2xl font-semibold tracking-tighter italic text-foreground">
              {isEditing ? "Gestão de Ativo Promocional" : "Novo Protocolo de Oferta"}
            </DialogTitle>
            <DialogDescription className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40">
              {isEditing ? "Refinamento de parâmetros e vigência" : "Configuração inicial de produto e valor"}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} id="product-form" className="flex-1 min-h-0 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col px-8">
              <TabsList className="shrink-0 grid w-full grid-cols-3 bg-primary/5 p-1.5 rounded-2xl h-14">
                <TabsTrigger value="general" className="rounded-xl font-semibold text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all">Identificação</TabsTrigger>
                <TabsTrigger value="fiscal" className="rounded-xl font-semibold text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all">Fiscal & Yield</TabsTrigger>
                <TabsTrigger value="logistics" className="rounded-xl font-semibold text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all">Supply Chain</TabsTrigger>
              </TabsList>
              
              <ScrollArea className="flex-1 mt-6 pr-4">
                <div className="pb-8 space-y-8">
                  <TabsContent value="general" className="mt-0 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <FormField
                            control={form.control}
                            name="item"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Código de Registro</FormLabel>
                                <FormControl>
                                <Input placeholder="TAG-000000" className="h-12 bg-background/40 border-border/40 rounded-2xl font-mono font-semibold focus-visible:ring-primary/20" {...field} autoComplete="off" ref={itemRef} />
                                </FormControl>
                                <FormMessage className="text-[10px] font-semibold italic" />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Designação Comercial</FormLabel>
                                <FormControl>
                                <Input placeholder="Nome do ativo..." className="h-12 bg-background/40 border-border/40 rounded-2xl font-semibold focus-visible:ring-primary/20" {...field} autoComplete="off" />
                                </FormControl>
                                <FormMessage className="text-[10px] font-semibold italic" />
                            </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="detailedDescription"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Especificações Técnicas</FormLabel>
                            <FormControl>
                            <Textarea placeholder="Detalhamento do produto..." className="min-h-[120px] bg-background/40 border-border/40 rounded-[2rem] font-medium resize-none focus-visible:ring-primary/20" {...field} />
                            </FormControl>
                            <FormMessage className="text-[10px] font-semibold italic" />
                        </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <FormField
                            control={form.control}
                            name="manufacturer"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Fabricante Originário</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: Intelbras" className="h-12 bg-background/40 border-border/40 rounded-2xl font-semibold focus-visible:ring-primary/20" {...field} autoComplete="off" />
                                </FormControl>
                                <FormMessage className="text-[10px] font-semibold italic" />
                                </FormItem>
                            )}
                        />
                         <FormItem>
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Parceiro Logístico</FormLabel>
                            <Input value={userProfile?.displayName} disabled className="h-12 bg-primary/[0.02] border-border/40 rounded-2xl font-semibold opacity-60" />
                         </FormItem>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <FormField
                            control={form.control}
                            name="model"
                            render={({ field }) => (
                                <FormItem className="lg:col-span-1">
                                <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Versão / Modelo</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: V2-S" className="h-12 bg-background/40 border-border/40 rounded-2xl font-semibold focus-visible:ring-primary/20" {...field} autoComplete="off" />
                                </FormControl>
                                <FormMessage className="text-[10px] font-semibold italic" />
                                </FormItem>
                            )}/>
                        <FormField
                            control={form.control}
                            name="unit"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Unidade Fluxo</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12 bg-background/40 border-border/40 rounded-2xl font-semibold focus:ring-primary/20">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-2xl border-border/40 bg-background/90 backdrop-blur-3xl font-semibold">
                                        <SelectItem value="UNID" className="rounded-xl">UNIDADE (UNID)</SelectItem>
                                        <SelectItem value="PÇ" className="rounded-xl">PEÇA (PÇ)</SelectItem>
                                        <SelectItem value="KIT" className="rounded-xl">KIT COMPLETO</SelectItem>
                                        <SelectItem value="CX" className="rounded-xl">CAIXA (CX)</SelectItem>
                                    </SelectContent>
                                </Select>
                                </FormItem>
                            )}/>
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Ciclo de Vida</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12 bg-background/40 border-border/40 rounded-2xl font-semibold focus:ring-primary/20 border-l-4 border-l-primary">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-2xl border-border/40 bg-background/90 backdrop-blur-3xl font-semibold">
                                        <SelectItem value="Ativo" className="rounded-xl text-[10px] font-semibold">DISPONÍVEL NO MERCADO</SelectItem>
                                        <SelectItem value="Inativo" className="rounded-xl text-[10px] font-semibold">REGISTRO SUSPENSO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                            )}/>
                    </div>

                    <div className="bg-primary/[0.02] border border-border/40 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center gap-8">
                        <div className="relative w-40 h-40 group shrink-0">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-40 transition-opacity" />
                            <div className="relative w-full h-full border-2 border-dashed border-primary/20 rounded-[2rem] flex items-center justify-center bg-background/40 overflow-hidden shadow-inner group-hover:border-primary/40 transition-all">
                                {previewImageUrl ? (
                                    <Image src={previewImageUrl} alt="Preview" layout="fill" objectFit="contain" className="p-4 transition-transform duration-500 group-hover:scale-110" />
                                ) : <ImageIcon className="h-12 w-12 text-primary/20" />}
                            </div>
                        </div>
                        <div className="space-y-4 text-center md:text-left flex-1">
                            <h4 className="text-sm font-semibold uppercase tracking-widest text-primary">Ativo Visual</h4>
                            <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-sm">Capture ou envie uma imagem de alta definição para representar este item promocional na vitrine.</p>
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-12 px-6 rounded-2xl border-border/40 hover:bg-primary/5 font-semibold transition-all shadow-sm">
                                <Upload className="mr-2 h-4 w-4" /> Selecionar Mídia
                            </Button>
                        </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="fiscal" className="mt-0 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                                <DollarSign className="h-3 w-3" /> Parâmetros de Aquisição
                            </h4>
                            <FormField
                                control={form.control}
                                name="materialPrice"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest uppercase">Custo de Operação (R$)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-semibold opacity-30 text-sm italic">BRL</span>
                                            <Input type="number" className="h-14 pl-12 bg-background/40 border-border/40 rounded-2xl font-semibold text-lg focus:ring-primary/20" placeholder="0.00" {...field} step="0.01" ref={fiscalTabRef} value={field.value || ''} min="0" />
                                        </div>
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            
                            <div className="p-6 bg-primary/[0.03] border border-border/40 rounded-[2rem] space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">Target Markup (Yield)</Label>
                                    <span className="text-xl font-semibold text-primary italic">{markupPercentage}%</span>
                                </div>
                                <Input
                                    type="range"
                                    min="0"
                                    max="200"
                                    step="5"
                                    value={markupPercentage}
                                    onChange={(e) => setMarkupPercentage(e.target.value)}
                                    className="h-2 bg-primary/10 rounded-full appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                                <Percent className="h-3 w-3" /> Parâmetros de Mercado
                            </h4>
                            <FormField
                                control={form.control}
                                name="sellingPrice"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest uppercase">Preço Sugerido (Tabela R$)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-semibold opacity-30 text-sm italic">BRL</span>
                                            <Input type="number" className="h-14 pl-12 bg-background/40 border-border/40 rounded-2xl font-semibold text-lg text-primary focus:ring-primary/20 shadow-inner" placeholder="0.00" {...field} step="0.01" value={field.value || ''} min="0" />
                                        </div>
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="servicePrice"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest uppercase">Taxa de Implementação (R$)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-semibold opacity-30 text-sm italic">BRL</span>
                                            <Input type="number" className="h-14 pl-12 bg-background/20 border-border/40 rounded-2xl font-semibold text-lg focus:ring-primary/20" placeholder="0.00" {...field} step="0.01" value={field.value || ''} min="0" />
                                        </div>
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    <div className={cn("p-8 rounded-[2.5rem] border-2 border-dashed transition-all duration-700", form.watch("isPromotion") ? "bg-primary/[0.04] border-primary shadow-2xl" : "bg-muted/10 border-border/40")}>
                        <FormField
                            control={form.control}
                            name="isPromotion"
                            render={({ field }) => (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-lg transition-colors", field.value ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                                                <Percent className="h-5 w-5" />
                                            </div>
                                            <FormLabel className="text-lg font-semibold tracking-tighter italic">Campanha Promocional Ativa</FormLabel>
                                        </div>
                                        <p className="text-xs font-semibold text-muted-foreground/60">Destaque este item na camada Premium de promoções globais.</p>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                                    </FormControl>
                                </div>
                            )}
                        />

                        {form.watch("isPromotion") && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 animate-in zoom-in-95 duration-500">
                                <FormField control={form.control} name="promoPrice" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-semibold tracking-widest text-primary italic uppercase">VALOR DA OFERTA (R$)</FormLabel>
                                        <FormControl>
                                            <Input type="number" className="h-16 bg-background rounded-3xl border-primary/20 font-semibold text-2xl text-center text-primary shadow-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" {...field} step="0.01" value={field.value || ''} min="0" />
                                        </FormControl>
                                    </FormItem>
                                )}/>
                                 <FormField control={form.control} name="promoExpiresAt" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-semibold tracking-widest text-primary/40 uppercase">VIGÊNCIA DA CAMPANHA</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" className={cn("h-16 rounded-3xl bg-background border-border/40 font-semibold text-sm tracking-tight px-6", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Indefinida</span>}
                                                        <CalendarIcon className="ml-auto h-5 w-5 text-primary opacity-40" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 rounded-[2rem] border-border/40 shadow-2xl bg-background/95 backdrop-blur-3xl" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="rounded-[2rem]" />
                                            </PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )}/>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-primary/[0.02] p-8 rounded-[2rem] border border-border/40">
                        <FormField control={form.control} name="ncm" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-semibold uppercase text-primary/30 tracking-[0.2em]">Cód. NCM</FormLabel><FormControl><Input placeholder="0000.00.00" className="h-10 bg-background/40 border-border/40 rounded-xl font-mono text-center text-xs font-semibold" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="cest" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-semibold uppercase text-primary/30 tracking-[0.2em]">Cód. CEST</FormLabel><FormControl><Input placeholder="00.000.00" className="h-10 bg-background/40 border-border/40 rounded-xl font-mono text-center text-xs font-semibold" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="ean" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-semibold uppercase text-primary/30 tracking-[0.2em]">Cód. EAN / GTIN</FormLabel><FormControl><Input placeholder="7890000..." className="h-10 bg-background/40 border-border/40 rounded-xl font-mono text-center text-xs font-semibold" {...field} /></FormControl></FormItem>)} />
                    </div>
                  </TabsContent>

                  <TabsContent value="logistics" className="mt-0 space-y-10">
                    <div className="flex flex-col gap-6">
                      <div className="flex justify-between items-end border-b border-border/40 pb-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold uppercase tracking-widest text-primary italic">Status de Inventário</h4>
                            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Soma agregada de todas as localizações</p>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-semibold tracking-tighter text-primary italic">{totalStock}</div>
                            <div className="text-[9px] font-semibold uppercase tracking-[0.3em] opacity-40">UNIDADES EM FLUXO</div>
                        </div>
                      </div>

                       <FormField control={form.control} name="locationDetail" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Sítio de Armazenagem Preferencial</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Warehouse className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30" />
                                    <Input placeholder="Ex: Prateleira A-1, Corredor Beta" className="h-14 pl-12 bg-background/40 border-border/40 rounded-2xl font-semibold italic" {...field} />
                                </div>
                            </FormControl>
                          </FormItem>
                        )}/>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                            <Scale className="h-3 w-3" /> Métricas Físicas do Ativo
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-semibold opacity-60 uppercase">Peso Líquido (kg)</FormLabel><FormControl><Input type="number" className="h-12 bg-background/40 border-border/40 rounded-xl font-semibold text-center" placeholder="0.00" {...field} value={field.value || ''} min="0" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="grossWeight" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-semibold opacity-60 uppercase">Peso Bruto (kg)</FormLabel><FormControl><Input type="number" className="h-12 bg-background/40 border-border/40 rounded-xl font-semibold text-center" placeholder="0.00" {...field} value={field.value || ''} min="0" /></FormControl></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-semibold opacity-60 uppercase">Alt.</FormLabel><FormControl><Input type="number" className="h-12 bg-background/40 border-border/40 rounded-xl font-semibold text-center" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="width" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-semibold opacity-60 uppercase">Larg.</FormLabel><FormControl><Input type="number" className="h-12 bg-background/40 border-border/40 rounded-xl font-semibold text-center" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="length" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-semibold opacity-60 uppercase">Comp.</FormLabel><FormControl><Input type="number" className="h-12 bg-background/40 border-border/40 rounded-xl font-semibold text-center" placeholder="0" {...field} value={field.value || ''} min="0" /></FormControl></FormItem>)} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary/5 rounded-[2.5rem] p-8 space-y-4">
                        <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                            <FileText className="h-3 w-3" /> Portfólio de Notas Analíticas
                        </h4>
                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Textarea placeholder="Meta-dados adicionais ou observações do parceiro logístico..." className="min-h-[100px] border-none bg-transparent font-medium italic focus-visible:ring-0" {...field} />
                                </FormControl>
                            </FormItem>
                        )} />
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </form>
        </Form>
        <DialogFooter className="p-8 border-t border-border/40 flex flex-row items-center justify-between bg-primary/[0.01]">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-14 px-8 rounded-2xl font-semibold text-[10px] uppercase tracking-widest text-primary/40 hover:text-primary hover:bg-primary/5 transition-all">Cancelar Protocolo</Button>
          <Button type="submit" form="product-form" disabled={isSubmitting} className="h-14 px-10 rounded-2xl bg-primary shadow-2xl shadow-primary/20 hover:bg-primary/90 font-semibold text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95">
            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
            {isEditing ? "Confirmar Alterações" : "Ativar Novo Registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
