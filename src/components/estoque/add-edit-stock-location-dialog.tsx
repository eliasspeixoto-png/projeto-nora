
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { StockLocation, Vehicle } from "@/lib/data";
import { useState, useEffect } from "react";
import { Loader2, Package, MapPin, Truck, Hash, Save, Info } from "lucide-react";
import { Switch } from "../ui/switch";
import { useAuth } from "@/firebase/auth/use-user";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
    name: z.string().min(3, "O nome é obrigatório."),
    type: z.enum(["warehouse", "vehicle"]),
    address: z.string().optional(),
    vehicleId: z.string().optional(),
    isCentral: z.boolean().optional(),
}).refine(data => data.type !== 'vehicle' || !!data.vehicleId, {
    message: "Selecione um veículo.",
    path: ["vehicleId"],
});

type AddEditStockLocationDialogProps = {
    isOpen: boolean;
    setOpen: (isOpen: boolean) => void;
    location?: StockLocation;
    onLocationSaved: (data: Omit<StockLocation, 'id'|'companyId'>) => Promise<void>;
    vehicles: Vehicle[];
    allLocations: StockLocation[];
};

export default function AddEditStockLocationDialog({ isOpen, setOpen, location, onLocationSaved, vehicles, allLocations }: AddEditStockLocationDialogProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditing = !!location;
    const { firebase } = useAuth();


    const availableVehicles = vehicles.filter(v => 
        !allLocations.some(l => l.vehicleId === v.id) || (isEditing && location.vehicleId === v.id)
    );

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    const locationType = form.watch("type");

    useEffect(() => {
        if (isOpen) {
            if (isEditing) {
                form.reset({
                    name: location.name,
                    type: location.type,
                    address: location.address || "",
                    vehicleId: location.vehicleId || "none",
                    isCentral: location.isCentral || false,
                });
            } else {
                form.reset({
                    name: "",
                    type: "warehouse",
                    address: "",
                    vehicleId: "none",
                    isCentral: false,
                });
            }
        }
    }, [isOpen, isEditing, location, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true);
        const dataToSave = {
            ...values,
            address: values.type === 'warehouse' ? values.address : '',
            vehicleId: values.type === 'vehicle' ? values.vehicleId : '',
            isCentral: values.isCentral || false,
        };
        try {
            await onLocationSaved(dataToSave);
        } catch (error: any) {
            // Toast will be shown by parent
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md h-auto max-h-[90vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
                <DialogHeader className="p-6 pb-4 bg-primary/[0.03] border-b border-border/40">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Package className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-semibold tracking-tight">
                                {isEditing ? "Editar Local de Estoque" : "Novo Local de Estoque"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground italic">
                                Defina onde seus materiais e ferramentas serão armazenados.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] px-6">
                    <Form {...form}>
                        <form id="location-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                        <Hash className="h-4 w-4" /> Nome do Local
                                    </FormLabel>
                                    <FormControl><Input placeholder="Ex: Depósito Central" {...field} className="h-10 border-border/40 shadow-sm" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                        <Info className="h-4 w-4" /> Tipo de Local
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="warehouse">Depósito / Almoxarifado</SelectItem><SelectItem value="vehicle">Veículo</SelectItem></SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            {locationType === 'warehouse' && (
                                <FormField control={form.control} name="address" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                            <MapPin className="h-4 w-4" /> Endereço do Depósito
                                        </FormLabel>
                                        <FormControl><Input placeholder="Ex: Rua Principal, 123" {...field} className="h-10 border-border/40 shadow-sm" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            )}
                            {locationType === 'vehicle' && (
                                <FormField control={form.control} name="vehicleId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                                            <Truck className="h-4 w-4" /> Vincular ao Veículo
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione um veículo..."/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Selecione...</SelectItem>
                                                {availableVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            )}
                            <FormField
                                control={form.control}
                                name="isCentral"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/40 bg-primary/5 p-4 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel className="font-semibold text-primary">Estoque Central</FormLabel>
                                        <FormDescription className="text-[10px] leading-tight">
                                            Define este local como o principal para o recebimento automático de materiais.
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
                        </form>
                    </Form>
                </ScrollArea>
                <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border/40 backdrop-blur-md">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
                        Cancelar
                    </Button>
                    <Button type="submit" form="location-form" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 font-semibold shadow-lg shadow-primary/20">
                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEditing ? "Salvar Alterações" : "Efetivar Cadastro"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
