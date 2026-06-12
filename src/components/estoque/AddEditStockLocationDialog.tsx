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
import { Loader2 } from "lucide-react";
import { Switch } from "../ui/switch";

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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Editar Local de Estoque" : "Novo Local de Estoque"}</DialogTitle>
                    <DialogDescription>{isEditing ? "Edite os detalhes do local." : "Crie um novo local para gerenciar seu estoque."}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form id="location-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nome do Local</FormLabel><FormControl><Input placeholder="Ex: Depósito Central" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem><FormLabel>Tipo de Local</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="warehouse">Depósito / Almoxarifado</SelectItem><SelectItem value="vehicle">Veículo</SelectItem></SelectContent></Select><FormMessage />
                            </FormItem>
                        )}/>
                        {locationType === 'warehouse' && (
                            <FormField control={form.control} name="address" render={({ field }) => (
                                <FormItem><FormLabel>Endereço do Depósito</FormLabel><FormControl><Input placeholder="Ex: Rua Principal, 123" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        )}
                        {locationType === 'vehicle' && (
                            <FormField control={form.control} name="vehicleId" render={({ field }) => (
                                <FormItem><FormLabel>Vincular ao Veículo</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione um veículo..."/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">Selecione...</SelectItem>
                                        {availableVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</SelectItem>)}
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                            )}/>
                        )}
                        <FormField
                            control={form.control}
                            name="isCentral"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Estoque Central</FormLabel>
                                    <FormDescription>
                                        Marcar como o local principal para recebimento de compras.
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
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button type="submit" form="location-form" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Salvar Alterações" : "Criar Local"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
