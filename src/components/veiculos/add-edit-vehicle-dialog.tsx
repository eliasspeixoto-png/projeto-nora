

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { addVehicle, updateVehicle } from "@/lib/firebase/firestore";
import type { Vehicle, UserProfile } from "@/lib/data";
import { useState, useEffect, useMemo } from "react";
import { Loader2, Check, ChevronsUpDown, Truck, Car, Calendar, Hash, User, ClipboardList, Save } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  brand: z.string().min(2, "A marca é obrigatória."),
  model: z.string().min(2, "O modelo é obrigatório."),
  year: z.string().regex(/^\d{4}$/, "Ano inválido."),
  plate: z.string().min(7, "A placa deve ter 7 caracteres.").max(8, "A placa deve ter até 8 caracteres."),
  technicianIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type AddEditVehicleDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  vehicle?: Vehicle;
  teamMembers: UserProfile[];
  onVehicleSaved: () => void; // Callback to refetch data
};

export default function AddEditVehicleDialog({ isOpen, setOpen, vehicle, teamMembers, onVehicleSaved }: AddEditVehicleDialogProps) {
  const { userProfile, firebase } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isEditing = !!vehicle;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      technicianIds: [],
    }
  });

  const collaborators = useMemo(() => 
    teamMembers.filter(member => member.role !== 'cliente'), 
    [teamMembers]
  );

  const filteredCollaborators = useMemo(() => {
    const searchStr = search.trim().toLowerCase();
    
    if (!searchStr) {
      return [...collaborators].sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    return collaborators.filter(member => 
      member.displayName.toLowerCase().includes(searchStr)
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

      return nameA.localeCompare(nameB);
    });
  }, [collaborators, search]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        form.reset({ ...vehicle, technicianIds: vehicle.technicianIds || [] });
      } else {
        form.reset({
          brand: "",
          model: "",
          year: "",
          plate: "",
          technicianIds: [],
          notes: "",
        });
      }
    }
  }, [isOpen, isEditing, vehicle, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId || !firebase.db) return;
    
    setIsSubmitting(true);
    
    const selectedTechnicians = teamMembers.filter(t => values.technicianIds?.includes(t.uid));

    const vehicleData = {
      ...values,
      technicianIds: values.technicianIds || [],
      technicianNames: selectedTechnicians.map(t => t.displayName),
      isShared: (values.technicianIds?.length || 0) > 1,
      companyId: userProfile.companyId,
    };

    try {
      if (isEditing) {
        await updateVehicle(firebase.db, vehicle.id, vehicleData);
        toast({ title: "Sucesso!", description: "Veículo atualizado." });
      } else {
        await addVehicle(firebase.db, vehicleData);
        toast({ title: "Sucesso!", description: "Veículo cadastrado." });
      }
      onVehicleSaved(); // Call the refetch callback
      setOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTechnicianIds = form.watch("technicianIds") || [];

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-screen-md h-full max-h-[90vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
            <DialogHeader className="p-6 pb-4 bg-primary/[0.03] border-b border-border/40">
                <div className="flex items-center gap-4">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Truck className="h-6 w-6" />
                    </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                    {isEditing ? "Editar Veículo" : "Novo Veículo"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground italic">
                    Gerencie a frota e vinculação de técnicos aos veículos.
                </DialogDescription>
              </div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form id="vehicle-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <Car className="h-4 w-4" /> Marca
                  </FormLabel>
                  <FormControl><Input placeholder="Ex: Fiat" {...field} className="h-10 shadow-sm border-border/40" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <Car className="h-4 w-4" /> Modelo
                  </FormLabel>
                  <FormControl><Input placeholder="Ex: Fiorino" {...field} className="h-10 shadow-sm border-border/40" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField control={form.control} name="year" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <Calendar className="h-4 w-4" /> Ano
                  </FormLabel>
                  <FormControl><Input placeholder="Ex: 2023" {...field} className="h-10 shadow-sm border-border/40" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="plate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <Hash className="h-4 w-4" /> Placa
                  </FormLabel>
                  <FormControl><Input placeholder="Ex: ABC1D23" {...field} className="h-10 shadow-sm border-border/40" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </div>
             <FormField
                control={form.control}
                name="technicianIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                        <User className="h-4 w-4" /> Colaboradores Vinculados
                    </FormLabel>
                   <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between h-auto min-h-[40px] shadow-sm border-border/40", !field.value?.length && "text-muted-foreground")}
                          >
                             <div className="flex gap-1 flex-wrap">
                              {selectedTechnicianIds.length > 0 ? 
                                selectedTechnicianIds.map(id => (
                                  <Badge variant="secondary" key={id} className="uppercase">{teamMembers.find(t => t.uid === id)?.displayName}</Badge>
                                ))
                                : "Selecione um ou mais colaboradores..."
                              }
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="Buscar colaborador..." value={search} onValueChange={setSearch} />
                          <CommandList>
                            <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                            <CommandGroup>
                              {filteredCollaborators.map((member) => (
                                <CommandItem
                                  key={member.uid}
                                  value={member.displayName}
                                  className="uppercase"
                                  onSelect={() => {
                                    const currentIds = field.value || [];
                                    const newIds = currentIds.includes(member.uid)
                                      ? currentIds.filter((id) => id !== member.uid)
                                      : [...currentIds, member.uid];
                                    field.onChange(newIds);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value?.includes(member.uid) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {member.displayName}
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
             <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <ClipboardList className="h-4 w-4" /> Observações e Manutenção
                </FormLabel>
                <FormControl><Textarea placeholder="Detalhes sobre o estado do veículo ou restrições..." {...field} className="min-h-[80px] shadow-sm border-border/40" /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
         </form>
        </Form>
        <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border/40 backdrop-blur-md">
          <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button type="submit" form="vehicle-form" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 font-semibold shadow-lg shadow-primary/20">
            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? "Salvar Alterações" : "Efetivar Cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
