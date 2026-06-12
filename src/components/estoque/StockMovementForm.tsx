
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRightLeft, ChevronsUpDown, ArrowDownToLine, ArrowUpFromLine, FileText } from "lucide-react";
import type { StockLocation, Product, Vehicle, UserProfile } from "@/lib/data";
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

const formSchema = z.object({
    type: z.enum(["entry", "exit", "transfer"]),
    fromLocationId: z.string().optional(),
    toLocationId: z.string().optional(),
    productId: z.string().min(1, "Selecione um produto."),
    quantity: z.coerce.number().min(0.01, "A quantidade deve ser maior que zero."),
    purchaseOrderNumber: z.string().optional(), // Novo campo
}).refine(data => data.type !== 'transfer' || (!!data.fromLocationId && !!data.toLocationId), {
    message: "Origem e destino são obrigatórios para transferência.",
    path: ["toLocationId"],
}).refine(data => data.type !== 'entry' || !!data.toLocationId, {
    message: "Destino é obrigatório para entrada.",
    path: ["toLocationId"],
}).refine(data => data.type !== 'exit' || !!data.fromLocationId, {
    message: "Origem é obrigatório para saída.",
    path: ["fromLocationId"],
}).refine(data => data.type !== 'transfer' || data.fromLocationId !== data.toLocationId, {
    message: "Os locais de origem e destino não podem ser iguais.",
    path: ["toLocationId"],
});


type StockMovementFormProps = {
    locations: StockLocation[];
    products: Product[];
    vehicles: Vehicle[];
    teamMembers: UserProfile[];
    onStockMovement: (type: 'transfer' | 'entry' | 'exit', productId: string, quantity: number, fromLocationId?: string, toLocationId?: string, purchaseOrderNumber?: string) => Promise<void>;
};

export default function StockMovementForm({ locations, products, vehicles, teamMembers, onStockMovement }: StockMovementFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productPopoverOpen, setProductPopoverOpen] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            type: "transfer",
        }
    });

    const filteredProducts = useMemo(() => {
        const searchStr = productSearch.trim().toLowerCase();
        if (!searchStr) {
            return [...products].sort((a, b) => a.description.localeCompare(b.description));
        }

        return products.filter(product => 
            product.description.toLowerCase().includes(searchStr) || 
            (product.item && product.item.toLowerCase().includes(searchStr))
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
    
    const movementType = form.watch("type");

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true);
        await onStockMovement(values.type, values.productId, values.quantity, values.fromLocationId, values.toLocationId, values.purchaseOrderNumber);
        form.reset({ type: values.type, quantity: 0, productId: '', purchaseOrderNumber: '' });
        setIsSubmitting(false);
    };

    const fromLocationId = form.watch("fromLocationId");
    const selectedProductFrom = products.find(p => p.id === form.watch("productId"));
    const availableStock = fromLocationId && selectedProductFrom ? selectedProductFrom.stockLevels?.[fromLocationId] || 0 : 0;
    
    const renderLocationOption = (loc: StockLocation) => {
        if (loc.type === 'vehicle' && loc.vehicleId) {
            const vehicle = vehicles.find(v => v.id === loc.vehicleId);
            if (vehicle) {
                return `${vehicle.brand} ${vehicle.model} (${vehicle.plate}) - ${vehicle.technicianNames?.[0] || 'Sem responsável'}`;
            }
        }
        return loc.name;
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="space-y-1 px-2">
                <h2 className="text-xl font-semibold tracking-tighter opacity-80 flex items-center gap-2">
                    <ArrowRightLeft className="text-primary h-6 w-6" />
                    Nova Movimentação
                </h2>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">Transferência, entrada ou saída de itens</p>
            </div>

            <div className="bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium border border-border/40 p-8 md:p-10">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                        <FormField control={form.control} name="type" render={({ field }) => (
                           <FormItem className="space-y-6">
                              <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">Natureza da Operação</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                                >
                                  {[
                                      { value: "transfer", label: "Transferência", icon: ArrowRightLeft, color: "text-blue-500" },
                                      { value: "entry", label: "Entrada / NF", icon: ArrowDownToLine, color: "text-green-500" },
                                      { value: "exit", label: "Saída / Consumo", icon: ArrowUpFromLine, color: "text-orange-500" }
                                  ].map((opt) => (
                                      <FormItem key={opt.value} className="flex items-center space-x-0 space-y-0">
                                        <FormControl>
                                            <RadioGroupItem value={opt.value} className="sr-only" />
                                        </FormControl>
                                        <FormLabel className={cn(
                                            "flex-1 flex items-center justify-center gap-3 h-14 rounded-2xl border-2 border-border/40 cursor-pointer transition-all font-semibold uppercase text-[10px] tracking-widest",
                                            field.value === opt.value ? "bg-primary text-white border-primary shadow-lg scale-105" : "bg-primary/5 text-foreground/40 hover:bg-primary/10"
                                        )}>
                                            <opt.icon className={cn("h-4 w-4", field.value === opt.value ? "text-white" : opt.color)} />
                                            {opt.label}
                                        </FormLabel>
                                      </FormItem>
                                  ))}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage className="font-semibold text-[10px] uppercase" />
                            </FormItem>
                        )}/>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            { (movementType === 'transfer' || movementType === 'exit') && (
                                <FormField control={form.control} name="fromLocationId" render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Origem</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold focus:ring-primary shadow-sm px-6">
                                                    <SelectValue placeholder="Selecione a origem..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-2xl border-border/40 bg-background/90 backdrop-blur-3xl shadow-premium overflow-hidden">
                                                {locations.map(loc => (
                                                    <SelectItem key={loc.id} value={loc.id} className="h-10 rounded-xl font-semibold transition-all focus:bg-primary focus:text-white cursor-pointer ml-1 mr-1">
                                                        {renderLocationOption(loc)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="font-semibold text-[10px] uppercase" />
                                    </FormItem>
                                )}/>
                            )}
                             { (movementType === 'transfer' || movementType === 'entry') && (
                                <FormField control={form.control} name="toLocationId" render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Destino</FormLabel>
                                         <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold focus:ring-primary shadow-sm px-6">
                                                    <SelectValue placeholder="Selecione o destino..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-2xl border-border/40 bg-background/90 backdrop-blur-3xl shadow-premium">
                                                {locations.map(loc => (
                                                    <SelectItem key={loc.id} value={loc.id} className="h-10 rounded-xl font-semibold transition-all focus:bg-primary focus:text-white cursor-pointer ml-1 mr-1">
                                                        {renderLocationOption(loc)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="font-semibold text-[10px] uppercase" />
                                    </FormItem>
                                )}/>
                             )}
                        </div>

                         <FormField control={form.control} name="productId" render={({ field }) => (
                            <FormItem className="flex flex-col space-y-4">
                                <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Produto Selecionado</FormLabel>
                                <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant="outline" role="combobox" className={cn(
                                                "w-full h-14 justify-between rounded-2xl bg-background/50 border-border/40 font-semibold uppercase text-[11px] tracking-widest px-6 shadow-sm hover:bg-primary/5 transition-all text-left",
                                                !field.value && "text-muted-foreground"
                                            )}>
                                                {field.value ? products.find(p => p.id === field.value)?.description : "Pesquisar produto no catálogo..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-3 border-none bg-background/80 backdrop-blur-3xl rounded-3xl shadow-premium mt-2">
                                        <Command className="bg-transparent" shouldFilter={false}>
                                            <div className="relative mb-2">
                                                <CommandInput placeholder="Código ou descrição..." value={productSearch} onValueChange={setProductSearch} className="h-12 border-none bg-primary/5 rounded-2xl px-4 font-semibold" />
                                            </div>
                                            <CommandEmpty className="py-6 text-center font-semibold uppercase text-[10px] opacity-40">Nenhum produto encontrado.</CommandEmpty>
                                            <CommandList className="max-h-72">
                                            <CommandGroup>
                                                {filteredProducts.map((product) => (
                                                <CommandItem
                                                    value={product.id}
                                                    key={product.id}
                                                    onSelect={() => {
                                                        form.setValue("productId", product.id);
                                                        setProductPopoverOpen(false);
                                                    }}
                                                    className="h-12 rounded-xl font-semibold cursor-pointer transition-all hover:bg-primary hover:text-white mb-1 uppercase"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="uppercase text-[11px] tracking-tight">{product.description}</span>
                                                        <span className="text-[9px] font-semibold opacity-40 font-mono tracking-widest">#{product.item}</span>
                                                    </div>
                                                </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage className="font-semibold text-[10px] uppercase" />
                            </FormItem>
                        )}/>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField control={form.control} name="quantity" render={({ field }) => (
                                <FormItem className="space-y-4">
                                    <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Quantidade</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="0.00" {...field} className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold text-lg focus:ring-primary shadow-sm px-6" />
                                    </FormControl>
                                { (movementType === 'transfer' || movementType === 'exit') && (
                                    <div className="flex items-center gap-2 px-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                        <p className="text-[9px] font-semibold uppercase tracking-widest text-primary/60">Disponível: {availableStock}</p>
                                    </div>
                                )}
                                    <FormMessage className="font-semibold text-[10px] uppercase" />
                                </FormItem>
                            )}/>
                            {movementType === 'entry' && (
                                <FormField control={form.control} name="purchaseOrderNumber" render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-2">Ref. Pedido de Compra</FormLabel>
                                        <div className="relative">
                                            <FileText className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30" />
                                            <FormControl>
                                                <Input placeholder="Ex: PC-0001/24" {...field} className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold focus:ring-primary shadow-sm pl-14 pr-6 uppercase placeholder:normal-case"/>
                                            </FormControl>
                                        </div>
                                        <FormMessage className="font-semibold text-[10px] uppercase" />
                                    </FormItem>
                                )}/>
                            )}
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="h-16 px-10 rounded-[1.5rem] bg-primary text-white font-semibold uppercase tracking-[0.2em] shadow-premium transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="mr-3 h-5 w-5 animate-spin"/>
                                ) : (
                                    <ArrowRightLeft className="mr-3 h-5 w-5"/>
                                )}
                                Executar Movimentação
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
}
