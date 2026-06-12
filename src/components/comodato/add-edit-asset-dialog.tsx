
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ComodatoAsset, Client, Product } from "@/lib/data";
import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import { Loader2, Upload, ImageIcon, Package, Hash, Building, ClipboardList, Calendar as CalendarIcon, Info, DollarSign, Box, Save, Search, User, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatTitleCase } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

const formSchema = z.object({
  model: z.string().min(3, "O modelo deve ter pelo menos 3 caracteres."),
  serial: z.string().optional(),
  description: z.string().optional(),
  manufacturer: z.string().optional(),
  firmware: z.string().optional(),
  status: z.enum(["active", "maintenance", "returned"]),
  clientId: z.string().optional(),
  osId: z.string().optional(),
  monthlyFee: z.coerce.number().optional(),
  installationDate: z.date().optional(),
  photoUrl: z.string().url("URL inválida.").optional().or(z.literal('')),
  notes: z.string().optional(),
});

type AddEditAssetDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onAssetSaved: (data: Omit<ComodatoAsset, 'id' | 'companyId'>) => Promise<void>;
  onBulkAssetSaved?: (data: Omit<ComodatoAsset, 'id' | 'companyId' | 'serial'>, serials: string[]) => Promise<void>;
  asset?: ComodatoAsset;
  clients: Client[];
  products: Product[];
  preselectedClientId?: string;
};

export default function AddEditAssetDialog({ isOpen, setOpen, onAssetSaved, onBulkAssetSaved, asset, clients, products, preselectedClientId }: AddEditAssetDialogProps) {
  const { toast } = useToast();
  const { userProfile, firebase } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [modelSearch, setModelSearch] = useState('');
  const [isProductListVisible, setProductListVisible] = useState(false);

  // Batch serial management
  const [serialsList, setSerialsList] = useState<string[]>([]);
  const [currentSerialInput, setCurrentSerialInput] = useState('');

  const addSerial = () => {
    const trimmed = currentSerialInput.trim();
    if (!trimmed) return;
    // Support pasting comma/newline separated serials
    const newSerials = trimmed.split(/[,;\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    const uniqueNew = newSerials.filter(s => !serialsList.includes(s));
    if (uniqueNew.length === 0) {
      toast({ variant: 'destructive', title: 'Serial duplicado', description: 'Esse número de série já está na lista.' });
      return;
    }
    setSerialsList(prev => [...prev, ...uniqueNew]);
    setCurrentSerialInput('');
  };

  const removeSerial = (serial: string) => {
    setSerialsList(prev => prev.filter(s => s !== serial));
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        model: "",
        serial: "",
        description: "",
        manufacturer: "",
        firmware: "",
        status: "active",
        clientId: "none",
        osId: "",
        monthlyFee: 0,
        photoUrl: "",
        notes: "",
    },
  });

  const filteredProducts = useMemo(() => {
    if (!modelSearch) return [];
    
    const lowerCaseSearch = modelSearch.toLowerCase();
    return products
      .filter(p => 
        p.description.toLowerCase().includes(lowerCaseSearch) || 
        p.manufacturer?.toLowerCase().includes(lowerCaseSearch) ||
        p.item.toLowerCase().includes(lowerCaseSearch)
      )
      .slice(0, 10);
  }, [products, modelSearch]);

  const handleProductSelect = (product: Product) => {
    form.setValue('model', product.description);
    form.setValue('description', product.item);
    form.setValue('manufacturer', product.manufacturer || '');
    form.setValue('photoUrl', product.imageUrl || '');
    setPreviewImageUrl(product.imageUrl || null);
    setModelSearch(product.description);
    setProductListVisible(false);
  }

  const isEditing = !!asset;

  useEffect(() => {
    if (isOpen) {
      setImageFile(null);
      setModelSearch('');
      setProductListVisible(false);
      setSerialsList([]);
      setCurrentSerialInput('');
      if (isEditing) {
        const modelValue = asset.model || '';
        form.reset({
          ...asset,
          model: modelValue,
          description: asset.description ?? "",
          manufacturer: asset.manufacturer ?? "",
          firmware: asset.firmware ?? "",
          clientId: asset.clientId || "none",
          photoUrl: asset.photoUrl ?? "",
          notes: asset.notes ?? "",
          osId: asset.osId ?? "",
          monthlyFee: asset.monthlyFee ?? 0,
          installationDate: asset.installationDate ? new Date(asset.installationDate) : undefined,
          serial: asset.serial ?? "",
        });
        setModelSearch(modelValue);
        setPreviewImageUrl(asset.photoUrl || null);
      } else {
         form.reset({
            model: "",
            serial: "",
            description: "",
            manufacturer: "",
            firmware: "",
            status: "active",
            clientId: preselectedClientId || "none",
            osId: "",
            monthlyFee: 0,
            photoUrl: "",
            notes: "",
            installationDate: undefined,
        });
        setPreviewImageUrl(null);
      }
    }
  }, [asset, isEditing, isOpen, preselectedClientId, form]);

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

    // Validate serials for new assets
    const isBulkMode = !isEditing && serialsList.length > 0;
    if (!isEditing && serialsList.length === 0 && !values.serial) {
      toast({ variant: "destructive", title: "Serial obrigatório", description: "Informe pelo menos um número de série." });
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = values.photoUrl || '';
    
    try {
      if (imageFile) {
        const { storage } = firebase;
        await new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onloadend = async () => {
              try {
                const dataUrl = reader.result as string;
                const filePath = `comodato-assets/${userProfile.companyId}/${imageFile.name}-${Date.now()}`;
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
      
      const finalClientId = values.clientId === "none" ? "" : values.clientId;
      
      if (isBulkMode && onBulkAssetSaved) {
        // Bulk mode: save multiple assets with different serials
        const { serial, ...baseValues } = values;
        const baseData: Omit<ComodatoAsset, 'id' | 'companyId' | 'serial'> = {
          ...baseValues,
          clientId: finalClientId,
          photoUrl: finalImageUrl,
          installationDate: values.installationDate ? values.installationDate.toISOString() : undefined,
        };
        if (!baseData.installationDate) delete baseData.installationDate;
        await onBulkAssetSaved(baseData, serialsList);
      } else {
        // Single mode (edit or single new)
        const finalSerial = isEditing ? values.serial : (serialsList.length === 1 ? serialsList[0] : values.serial);
        const dataToSave: Omit<ComodatoAsset, 'id' | 'companyId'> = {
          ...values,
          serial: finalSerial || '',
          clientId: finalClientId,
          photoUrl: finalImageUrl,
          installationDate: values.installationDate ? values.installationDate.toISOString() : undefined,
        };
        if (!dataToSave.installationDate) delete dataToSave.installationDate;
        await onAssetSaved(dataToSave);
      }

    } catch (error: any) {
        console.error("Error submitting asset:", error);
        toast({
            variant: "destructive",
            title: "Erro ao Salvar",
            description: "Falha ao processar o formulário ou fazer upload da imagem.",
        });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-4xl h-auto sm:max-h-[90vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl sm:overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-10 pb-6 bg-primary/[0.03] border-b border-border/40">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shadow-inner">
                <Box className="h-7 w-7" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-semibold tracking-tighter text-foreground leading-none">
                    {isEditing ? "Editar Registro" : "Ativo em Comodato"}
                </DialogTitle>

              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/5">
                    <Info className="h-5 w-5 text-primary/40" />
                 </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-6 rounded-2xl bg-background/60 backdrop-blur-2xl border-border/40 shadow-2xl">
                 <p className="text-xs font-semibold leading-relaxed text-muted-foreground/80">
                    Cadastre aqui os equipamentos que você deixa em comodato com seus clientes. Isto ajuda no controle de inventário e manutenção preventiva.
                 </p>
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
            <Form {...form}>
              <form id="asset-form" onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-8">
                 
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-[0.2em] mb-4">
                        <div className="bg-primary text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] shadow-lg shadow-primary/20">1</div>
                        Identificação do Equipamento
                    </div>
                    
                    <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                         <FormItem>
                             <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                <Package className="h-4 w-4" /> Modelo do Ativo
                             </FormLabel>
                           <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                    <Input 
                                        placeholder="Ex: Câmera IP VIP 3230"
                                        {...field}
                                        value={modelSearch}
                                        onChange={(e) => {
                                            setModelSearch(e.target.value);
                                            field.onChange(e.target.value);
                                            if(!isProductListVisible) setProductListVisible(true);
                                        }}
                                        onFocus={() => setProductListVisible(true)}
                                        onBlur={() => setTimeout(() => setProductListVisible(false), 150)}
                                        autoComplete="off"
                                        className="h-14 pl-12 rounded-2xl bg-background/50 border-border/40 shadow-inner focus:bg-background transition-all outline-none"
                                    />
                                </FormControl>
                                 {isProductListVisible && filteredProducts.length > 0 && (
                                    <Card className="absolute z-10 w-full mt-1">
                                        <ScrollArea className="h-48">
                                            {filteredProducts.map(product => (
                                                <div
                                                    key={product.id}
                                                    onMouseDown={() => handleProductSelect(product)}
                                                    className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted"
                                                >
                                                    <span className="text-sm truncate">{product.description}</span>
                                                    <span className="text-xs font-mono text-muted-foreground">{product.item}</span>
                                                </div>
                                            ))}
                                        </ScrollArea>
                                    </Card>
                                )}
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {isEditing ? (
                          <FormField
                            control={form.control}
                            name="serial"
                            render={({ field }) => (
                             <FormItem>
                                 <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                    <Hash className="h-4 w-4" /> Número de Série
                                 </FormLabel>
                               <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                    <Input placeholder="Obrigatório" {...field} className="pl-10 text-xs font-mono" />
                                </FormControl>
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                          />
                        ) : (
                          <div className="md:col-span-3">
                            <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                              <Hash className="h-4 w-4" /> Números de Série
                            </FormLabel>
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Digite o serial e pressione Enter ou clique +"
                                    value={currentSerialInput}
                                    onChange={(e) => setCurrentSerialInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSerial(); } }}
                                    className="pl-10 text-xs font-mono"
                                  />
                                </div>
                                <Button type="button" variant="outline" onClick={addSerial} className="h-9 px-4 rounded-xl font-bold text-primary border-primary/20 hover:bg-primary/10 shrink-0">
                                  <PlusCircle className="h-4 w-4 mr-1" /> Adicionar
                                </Button>
                              </div>
                              {serialsList.length > 0 && (
                                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-primary/[0.03] border border-border/40 min-h-[44px]">
                                  {serialsList.map((serial, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary font-mono text-xs font-semibold border border-primary/20 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                      {serial}
                                      <button type="button" onClick={() => removeSerial(serial)} className="ml-0.5 hover:bg-primary/20 rounded-full h-4 w-4 flex items-center justify-center text-primary/60 hover:text-primary transition-colors">
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {serialsList.length > 0 && (
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">
                                  {serialsList.length} {serialsList.length === 1 ? 'serial adicionado' : 'seriais adicionados'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                         <FormField
                          control={form.control}
                          name="manufacturer"
                          render={({ field }) => (
                           <FormItem>
                               <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                 <Building className="h-4 w-4" /> Fabricante
                               </FormLabel>
                             <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <FormControl>
                                  <Input placeholder="Ex: Intelbras" {...field} className="pl-10" />
                                  </FormControl>
                              </div>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="firmware"
                          render={({ field }) => (
                           <FormItem>
                               <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                 <Info className="h-4 w-4" /> Firmware
                               </FormLabel>
                             <div className="relative">
                                <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <FormControl>
                                  <Input placeholder="Versão" {...field} className="pl-10 text-xs font-mono" />
                                  </FormControl>
                              </div>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                    </div>

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                         <FormItem>
                             <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                <ClipboardList className="h-4 w-4" /> Especificações Técnicas
                             </FormLabel>
                           <div className="relative">
                              <ClipboardList className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                <Textarea placeholder="Código do produto ou breve descrição técnica..." {...field} className="pl-10 resize-none min-h-[80px]" />
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                 </div>

                 <div className="space-y-6">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-[0.2em] mb-4">
                        <div className="bg-primary text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] shadow-lg shadow-primary/20">2</div>
                        Atribuição e Contrato
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                             <FormItem>
                                 <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                    <Info className="h-4 w-4" /> Status Operacional
                                 </FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Selecione o status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="active">Ativo</SelectItem>
                                    <SelectItem value="maintenance">Em Manutenção</SelectItem>
                                    <SelectItem value="returned">Devolvido</SelectItem>
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="clientId"
                            render={({ field }) => (
                             <FormItem>
                                 <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                    <User className="h-4 w-4" /> Cliente Responsável
                                 </FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger disabled={!!preselectedClientId}>
                                    <SelectValue placeholder="Selecione um cliente" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Estoque</SelectItem>
                                    {clients.sort((a,b) => a.name.localeCompare(b.name)).map(client => (
                                        <SelectItem key={client.id} value={client.id}>{formatTitleCase(client.name)}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                          control={form.control}
                          name="osId"
                          render={({ field }) => (
                           <FormItem>
                               <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                 <ClipboardList className="h-4 w-4" /> Nº do Contrato / O.S.
                               </FormLabel>
                             <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <FormControl>
                                  <Input placeholder="Ex: OS-001/24" {...field} className="pl-10" />
                              </FormControl>
                              </div>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="monthlyFee"
                          render={({ field }) => (
                           <FormItem>
                               <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                 <DollarSign className="h-4 w-4" /> Taxa de Comodato Mensal
                               </FormLabel>
                             <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <FormControl>
                                  <Input type="number" placeholder="Ex: 50.00" {...field} className="pl-10" min="0" />
                              </FormControl>
                              </div>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                    </div>

                    <FormField
                          control={form.control}
                          name="installationDate"
                          render={({ field }) => (
                             <FormItem className="flex flex-col">
                               <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                 <CalendarIcon className="h-4 w-4" /> Data da Instalação
                               </FormLabel>
                             <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP", { locale: ptBR })
                                      ) : (
                                        <span>Escolha a data</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    locale={ptBR}
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    
                    <FormItem>
                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                            <ImageIcon className="h-4 w-4" /> Registro Fotográfico
                        </FormLabel>
                       <FormControl>
                        <div className="flex items-center gap-4">
                            <div className="relative w-24 h-24 rounded-md border flex items-center justify-center bg-muted/50">
                            {previewImageUrl ? (
                                <Image src={previewImageUrl} alt="Foto do ativo" fill={true} style={{objectFit:"contain"}} className="rounded-md" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"/>
                            ) : (
                                <ImageIcon className="h-10 w-10 text-muted-foreground" />
                            )}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                            <Upload className="mr-2 h-4 w-4"/>
                            Enviar Foto
                            </Button>
                        </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>

                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                         <FormItem>
                             <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                <Info className="h-4 w-4" /> Observações Administrativas
                             </FormLabel>
                           <div className="relative">
                                <ClipboardList className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                <Textarea placeholder="Qualquer informação relevante sobre o ativo..." {...field} className="pl-10" />
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                 </div>
              </form>
            </Form>
        </ScrollArea>
        <DialogFooter className="p-8 bg-primary/[0.02] border-t border-border/40 backdrop-blur-xl flex gap-4">
          <Button variant="ghost" onClick={() => setOpen(false)} className="h-14 px-8 rounded-2xl font-semibold text-xs uppercase tracking-widest bg-stone-100 dark:bg-stone-800/50 hover:bg-stone-200 dark:hover:bg-stone-800 transition-all border border-stone-200 dark:border-stone-700">
            Cancelar
          </Button>
          <Button 
            type="submit" 
            form="asset-form" 
            disabled={isSubmitting || (!isEditing && serialsList.length === 0)} 
            className="h-14 px-10 rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-3 bg-primary"
          >
            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5" />}
            {isEditing ? "Atualizar Ativo" : (serialsList.length <= 1 ? "Efetivar 1 Ativo" : `Efetivar ${serialsList.length} Ativos`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

