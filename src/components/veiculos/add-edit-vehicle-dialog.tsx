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
import type { Vehicle, UserProfile, VehicleMaintenanceItem } from "@/lib/data";
import { useState, useEffect, useMemo } from "react";
import { 
  Loader2, 
  Check, 
  ChevronsUpDown, 
  Truck, 
  Car, 
  Calendar, 
  Hash, 
  User, 
  ClipboardList, 
  Save, 
  Wrench, 
  Plus, 
  Trash2, 
  Pencil,
  X,
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

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
  onVehicleSaved: () => void;
};

export default function AddEditVehicleDialog({ isOpen, setOpen, vehicle, teamMembers, onVehicleSaved }: AddEditVehicleDialogProps) {
  const { userProfile, firebase } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Estado da lista de manutenções estruturadas
  const [maintenances, setMaintenances] = useState<VehicleMaintenanceItem[]>([]);
  
  // Novo item de manutenção
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newExpectedReturnDate, setNewExpectedReturnDate] = useState("");
  const [newStatus, setNewStatus] = useState<'Agendado' | 'Em Manutenção' | 'Pendente' | 'Concluído'>('Agendado');
  const [isAddingMaint, setIsAddingMaint] = useState(false);

  // Edição de item existente
  const [editingMaintId, setEditingMaintId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editExpectedReturnDate, setEditExpectedReturnDate] = useState("");
  const [editStatus, setEditStatus] = useState<'Agendado' | 'Em Manutenção' | 'Pendente' | 'Concluído'>('Agendado');

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
      if (isEditing && vehicle) {
        form.reset({ ...vehicle, technicianIds: vehicle.technicianIds || [] });
        let list = vehicle.maintenanceList || [];

        // Se maintenanceList estiver vazio mas vehicle.notes tiver texto, faz o parsing automático das linhas!
        if (list.length === 0 && vehicle.notes && vehicle.notes.trim()) {
          const lines = vehicle.notes.trim().split('\n').filter(l => l.trim());
          list = lines.map((line, idx) => {
            let itemDate = format(new Date(), "yyyy-MM-dd");
            const dateMatch = line.match(/\[(\d{2})\/(\d{2})\/(\d{4})\]/);
            if (dateMatch) {
              itemDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            }

            let status: 'Agendado' | 'Pendente' | 'Concluído' = 'Concluído';
            const lower = line.toLowerCase();
            if (lower.includes('status: pendente') || lower.includes('pendente') || lower.includes('oficina') || lower.includes('precisa')) {
              status = 'Pendente';
            } else if (lower.includes('status: agendado') || lower.includes('agendad') || lower.includes('próxim')) {
              status = 'Agendado';
            }

            const cleanDesc = line.replace(/\[.*?\]/g, '').replace(/\(Status:.*?\)/g, '').trim();

            return {
              id: `parsed_${Date.now()}_${idx}`,
              description: cleanDesc || line,
              date: itemDate,
              status,
              createdAt: new Date().toISOString(),
              createdBy: 'Histórico'
            };
          });
        }

        // Ordena por data decrescente
        setMaintenances([...list].sort((a, b) => (b.date || "").localeCompare(a.date || "")));
      } else {
        form.reset({
          brand: "",
          model: "",
          year: "",
          plate: "",
          technicianIds: [],
          notes: "",
        });
        setMaintenances([]);
      }
      setNewDesc("");
      setNewDate(format(new Date(), "yyyy-MM-dd"));
      setNewStatus("Agendado");
      setIsAddingMaint(false);
    }
  }, [isOpen, isEditing, vehicle, form]);

  const handleAddMaintenance = () => {
    if (!newDesc.trim()) {
      toast({ variant: "destructive", title: "Atenção", description: "Informe a descrição do serviço/manutenção." });
      return;
    }

    const newItem: any = {
      id: `maint_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      description: newDesc.trim(),
      date: newDate || format(new Date(), "yyyy-MM-dd"),
      status: newStatus,
      createdAt: new Date().toISOString(),
      createdBy: userProfile?.displayName || "Administrador"
    };
    if (newExpectedReturnDate) {
      newItem.expectedReturnDate = newExpectedReturnDate;
    }
    if (newStatus === 'Concluído') {
      newItem.completedAt = new Date().toISOString();
    }

    const updated = [newItem, ...maintenances].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    setMaintenances(updated);
    setNewDesc("");
    setNewDate(format(new Date(), "yyyy-MM-dd"));
    setNewExpectedReturnDate("");
    setNewStatus("Agendado");
    setIsAddingMaint(false);
    toast({ title: "Manutenção adicionada!", description: "Clique em Salvar Alterações para gravar." });
  };

  const handleStatusChange = (id: string, nextStatus: 'Agendado' | 'Em Manutenção' | 'Pendente' | 'Concluído') => {
    const updated = maintenances.map(m => {
      if (m.id === id) {
        const item: any = {
          ...m,
          status: nextStatus
        };
        if (nextStatus === 'Concluído') {
          item.completedAt = new Date().toISOString();
        } else {
          delete item.completedAt;
        }
        return item;
      }
      return m;
    });
    setMaintenances(updated);
  };

  const handleDeleteMaintenance = (id: string) => {
    setMaintenances(maintenances.filter(m => m.id !== id));
    if (editingMaintId === id) {
      setEditingMaintId(null);
    }
  };

  const startEditMaintenance = (m: VehicleMaintenanceItem) => {
    setEditingMaintId(m.id);
    setEditDesc(m.description);
    setEditDate(m.date || format(new Date(), "yyyy-MM-dd"));
    setEditExpectedReturnDate(m.expectedReturnDate || "");
    setEditStatus(m.status);
    setIsAddingMaint(false);
  };

  const cancelEditMaintenance = () => {
    setEditingMaintId(null);
    setEditDesc("");
    setEditDate("");
    setEditExpectedReturnDate("");
  };

  const saveEditMaintenance = (id: string) => {
    if (!editDesc.trim()) {
      toast({ variant: "destructive", title: "Atenção", description: "A descrição não pode ficar vazia." });
      return;
    }
    const updated = maintenances.map(m => {
      if (m.id === id) {
        const item: any = {
          ...m,
          description: editDesc.trim(),
          date: editDate || format(new Date(), "yyyy-MM-dd"),
          status: editStatus
        };
        if (editExpectedReturnDate) {
          item.expectedReturnDate = editExpectedReturnDate;
        } else {
          delete item.expectedReturnDate;
        }
        if (editStatus === 'Concluído' && !item.completedAt) {
          item.completedAt = new Date().toISOString();
        } else if (editStatus !== 'Concluído') {
          delete item.completedAt;
        }
        return item;
      }
      return m;
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    setMaintenances(updated);
    setEditingMaintId(null);
    toast({ title: "Manutenção atualizada!", description: "Clique em Salvar Alterações para gravar." });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId || !firebase.db) return;
    
    setIsSubmitting(true);
    
    const selectedTechnicians = teamMembers.filter(t => values.technicianIds?.includes(t.uid));

    // Sanitiza itens de manutenção para garantir que não haja campos undefined
    const cleanMaintenances = maintenances.map(m => {
      const cleanItem: any = {
        id: m.id,
        description: m.description,
        date: m.date,
        status: m.status,
        createdAt: m.createdAt || new Date().toISOString(),
        createdBy: m.createdBy || 'Administrador'
      };
      if (m.expectedReturnDate) cleanItem.expectedReturnDate = m.expectedReturnDate;
      if (m.completedAt) cleanItem.completedAt = m.completedAt;
      if (m.cost) cleanItem.cost = Number(m.cost);
      if (m.notes) cleanItem.notes = m.notes;
      return cleanItem;
    });

    // Gerar notas de texto sincronizadas em ordem decrescente
    const syncedNotes = cleanMaintenances.map(m => {
      const dateBr = (m.date || "").split("-").reverse().join("/");
      const prevText = m.expectedReturnDate ? ` [Previsão retorno: ${m.expectedReturnDate.split('-').reverse().join('/')}]` : '';
      return `[${dateBr}] ${m.description} (Status: ${m.status}${prevText})`;
    }).join("\n");

    const vehicleData = {
      ...values,
      notes: syncedNotes || values.notes || "",
      maintenanceList: cleanMaintenances,
      technicianIds: values.technicianIds || [],
      technicianNames: selectedTechnicians.map(t => t.displayName),
      isShared: (values.technicianIds?.length || 0) > 1,
      companyId: userProfile.companyId,
    };

    try {
      if (isEditing && vehicle) {
        await updateVehicle(firebase.db, vehicle.id, vehicleData);
        toast({ title: "Sucesso!", description: "Veículo e manutenções atualizados com sucesso." });
      } else {
        await addVehicle(firebase.db, vehicleData);
        toast({ title: "Sucesso!", description: "Veículo cadastrado com sucesso." });
      }
      onVehicleSaved();
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
      <DialogContent className="sm:max-w-screen-lg h-full max-h-[92vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.03] border-b border-border/40 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {isEditing ? `Veículo: ${vehicle?.brand} ${vehicle?.model} (${vehicle?.plate})` : "Novo Veículo da Frota"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground italic">
                Gerencie os dados cadastrais, colaboradores vinculados e o histórico de manutenções com status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Form {...form}>
            <form id="vehicle-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="brand" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-1 text-xs">
                      <Car className="h-3.5 w-3.5" /> Marca
                    </FormLabel>
                    <FormControl><Input placeholder="Ex: Chevrolet" {...field} className="h-9 text-xs shadow-sm border-border/40" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="model" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-1 text-xs">
                      <Car className="h-3.5 w-3.5" /> Modelo
                    </FormLabel>
                    <FormControl><Input placeholder="Ex: Montana LS" {...field} className="h-9 text-xs shadow-sm border-border/40" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="year" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-1 text-xs">
                      <Calendar className="h-3.5 w-3.5" /> Ano
                    </FormLabel>
                    <FormControl><Input placeholder="Ex: 2016" {...field} className="h-9 text-xs shadow-sm border-border/40" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="plate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-1 text-xs">
                      <Hash className="h-3.5 w-3.5" /> Placa
                    </FormLabel>
                    <FormControl><Input placeholder="Ex: HKH-2180" {...field} className="h-9 text-xs shadow-sm border-border/40 uppercase" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <FormField
                control={form.control}
                name="technicianIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-1 text-xs">
                      <User className="h-3.5 w-3.5" /> Colaboradores Vinculados
                    </FormLabel>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between h-auto min-h-[38px] text-xs shadow-sm border-border/40", !field.value?.length && "text-muted-foreground")}
                          >
                            <div className="flex gap-1 flex-wrap">
                              {selectedTechnicianIds.length > 0 ? 
                                selectedTechnicianIds.map(id => (
                                  <Badge variant="secondary" key={id} className="uppercase text-[10px]">{teamMembers.find(t => t.uid === id)?.displayName}</Badge>
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
                                  className="uppercase text-xs"
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
            </form>
          </Form>

          {/* Seção Estruturada de Manutenções da Frota */}
          <div className="space-y-4 pt-4 border-t border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  Gestão de Manutenções & Serviços
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Acompanhe os serviços agendados, problemas pendentes e o histórico de manutenções concluídas.
                </p>
              </div>

              {!isAddingMaint && (
                <Button 
                  size="sm" 
                  onClick={() => setIsAddingMaint(true)} 
                  className="h-8 text-[11px] font-semibold gap-1.5 rounded-xl shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Manutenção
                </Button>
              )}
            </div>

            {/* Formulário de Adição Rápida */}
            {isAddingMaint && (
              <div className="p-4 rounded-2xl bg-primary/[0.04] border border-primary/20 space-y-3 animate-in fade-in-50">
                <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Novo Registro de Manutenção
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className={cn("space-y-1", (newStatus === 'Em Manutenção' || newStatus === 'Agendado') ? "md:col-span-1" : "md:col-span-2")}>
                    <label className="text-[10px] font-bold uppercase opacity-60">Descrição do Serviço / Defeito</label>
                    <Input 
                      placeholder="Ex: Troca de trambulador na oficina..." 
                      value={newDesc} 
                      onChange={(e) => setNewDesc(e.target.value)} 
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase opacity-60">Data (Entrada / Início)</label>
                    <Input 
                      type="date" 
                      value={newDate} 
                      onChange={(e) => setNewDate(e.target.value)} 
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  {(newStatus === 'Em Manutenção' || newStatus === 'Agendado') && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Previsão de Retorno
                      </label>
                      <Input 
                        type="date" 
                        value={newExpectedReturnDate} 
                        onChange={(e) => setNewExpectedReturnDate(e.target.value)} 
                        className="h-8 text-xs bg-background border-purple-300 dark:border-purple-800"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase opacity-60">Status Inicial:</span>
                    <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
                      <SelectTrigger className="h-8 text-xs font-semibold w-44 min-w-[160px] bg-background px-3 border-border/60 shadow-sm">
                        <SelectValue>
                          {newStatus === 'Agendado' && <span className="text-blue-600 font-bold flex items-center gap-1.5">🔵 Agendado</span>}
                          {newStatus === 'Em Manutenção' && <span className="text-purple-600 font-bold flex items-center gap-1.5">🟣 Em Manutenção</span>}
                          {newStatus === 'Pendente' && <span className="text-amber-600 font-bold flex items-center gap-1.5">🟠 Pendente</span>}
                          {newStatus === 'Concluído' && <span className="text-green-600 font-bold flex items-center gap-1.5">🟢 Concluído</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="min-w-[170px]">
                        <SelectItem value="Agendado" className="text-xs font-bold text-blue-600 cursor-pointer">🔵 Agendado</SelectItem>
                        <SelectItem value="Em Manutenção" className="text-xs font-bold text-purple-600 cursor-pointer">🟣 Em Manutenção</SelectItem>
                        <SelectItem value="Pendente" className="text-xs font-bold text-amber-600 cursor-pointer">🟠 Pendente</SelectItem>
                        <SelectItem value="Concluído" className="text-xs font-bold text-green-600 cursor-pointer">🟢 Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setIsAddingMaint(false)} 
                      className="h-7 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleAddMaintenance} 
                      className="h-7 text-xs font-semibold"
                    >
                      Inserir no Histórico
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Manutenções em Ordem Decrescente */}
            <div className="rounded-2xl border border-border/40 bg-background/40 overflow-hidden">
              <ScrollArea className="max-h-64">
                {maintenances.length > 0 ? (
                  <div className="divide-y divide-border/30">
                    {maintenances.map((m) => {
                      const isEditingThis = editingMaintId === m.id;
                      if (isEditingThis) {
                        return (
                          <div key={m.id} className="p-3.5 bg-primary/[0.04] border-l-4 border-l-primary space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                                <Pencil className="h-3.5 w-3.5" /> Editando Manutenção
                              </span>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={cancelEditMaintenance} 
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className={cn("space-y-1", (editStatus === 'Em Manutenção' || editStatus === 'Agendado') ? "sm:col-span-1" : "sm:col-span-2")}>
                                <label className="text-[10px] font-bold uppercase opacity-60">Descrição do Serviço</label>
                                <Input 
                                  value={editDesc} 
                                  onChange={(e) => setEditDesc(e.target.value)} 
                                  className="h-8 text-xs bg-background"
                                  autoFocus
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase opacity-60">Data (Início/Entrada)</label>
                                <Input 
                                  type="date" 
                                  value={editDate} 
                                  onChange={(e) => setEditDate(e.target.value)} 
                                  className="h-8 text-xs bg-background"
                                />
                              </div>
                              {(editStatus === 'Em Manutenção' || editStatus === 'Agendado') && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Previsão Retorno
                                  </label>
                                  <Input 
                                    type="date" 
                                    value={editExpectedReturnDate} 
                                    onChange={(e) => setEditExpectedReturnDate(e.target.value)} 
                                    className="h-8 text-xs bg-background border-purple-300 dark:border-purple-800"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase opacity-60">Status:</span>
                                <Select value={editStatus} onValueChange={(v: any) => setEditStatus(v)}>
                                  <SelectTrigger className="h-8 text-xs font-semibold w-44 min-w-[160px] bg-background px-3 border-border/60 shadow-sm">
                                    <SelectValue>
                                      {editStatus === 'Agendado' && <span className="text-blue-600 font-bold flex items-center gap-1.5">🔵 Agendado</span>}
                                      {editStatus === 'Em Manutenção' && <span className="text-purple-600 font-bold flex items-center gap-1.5">🟣 Em Manutenção</span>}
                                      {editStatus === 'Pendente' && <span className="text-amber-600 font-bold flex items-center gap-1.5">🟠 Pendente</span>}
                                      {editStatus === 'Concluído' && <span className="text-green-600 font-bold flex items-center gap-1.5">🟢 Concluído</span>}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="min-w-[170px]">
                                    <SelectItem value="Agendado" className="text-xs font-bold text-blue-600 cursor-pointer">🔵 Agendado</SelectItem>
                                    <SelectItem value="Em Manutenção" className="text-xs font-bold text-purple-600 cursor-pointer">🟣 Em Manutenção</SelectItem>
                                    <SelectItem value="Pendente" className="text-xs font-bold text-amber-600 cursor-pointer">🟠 Pendente</SelectItem>
                                    <SelectItem value="Concluído" className="text-xs font-bold text-green-600 cursor-pointer">🟢 Concluído</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={cancelEditMaintenance} 
                                  className="h-7 text-xs"
                                >
                                  Cancelar
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => saveEditMaintenance(m.id)} 
                                  className="h-7 text-xs font-semibold gap-1.5"
                                >
                                  <Check className="h-3.5 w-3.5" /> Salvar Item
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const dateBr = (m.date || "").split("-").reverse().join("/");
                      return (
                        <div key={m.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-primary/[0.02] transition-colors">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {dateBr || "Sem data"}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[10px] font-bold uppercase px-2 py-0.5 border rounded-lg",
                                  m.status === 'Agendado' && "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
                                  m.status === 'Em Manutenção' && "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-800 font-extrabold",
                                  m.status === 'Pendente' && "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
                                  m.status === 'Concluído' && "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800"
                                )}
                              >
                                {m.status === 'Agendado' && <Clock className="h-3 w-3 mr-1 inline" />}
                                {m.status === 'Em Manutenção' && <Wrench className="h-3 w-3 mr-1 inline" />}
                                {m.status === 'Pendente' && <AlertCircle className="h-3 w-3 mr-1 inline" />}
                                {m.status === 'Concluído' && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                                {m.status}
                              </Badge>
                              {m.expectedReturnDate && (
                                <Badge variant="secondary" className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 gap-1">
                                  <Calendar className="h-2.5 w-2.5" />
                                  Previsão Retorno: {m.expectedReturnDate.split('-').reverse().join('/')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-foreground/80 font-medium break-words">
                              {m.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {/* Seletor Rápido de Status */}
                            <Select 
                              value={m.status} 
                              onValueChange={(val: any) => handleStatusChange(m.id, val)}
                            >
                              <SelectTrigger className="h-8 text-xs font-semibold w-44 min-w-[160px] bg-background/90 px-3 border-border/60 shadow-sm">
                                <SelectValue>
                                  {m.status === 'Agendado' && <span className="text-blue-600 font-bold flex items-center gap-1.5">🔵 Agendado</span>}
                                  {m.status === 'Em Manutenção' && <span className="text-purple-600 font-bold flex items-center gap-1.5">🟣 Em Manutenção</span>}
                                  {m.status === 'Pendente' && <span className="text-amber-600 font-bold flex items-center gap-1.5">🟠 Pendente</span>}
                                  {m.status === 'Concluído' && <span className="text-green-600 font-bold flex items-center gap-1.5">🟢 Concluído</span>}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="min-w-[170px]">
                                <SelectItem value="Agendado" className="text-xs font-bold text-blue-600 cursor-pointer">🔵 Agendado</SelectItem>
                                <SelectItem value="Em Manutenção" className="text-xs font-bold text-purple-600 cursor-pointer">🟣 Em Manutenção</SelectItem>
                                <SelectItem value="Pendente" className="text-xs font-bold text-amber-600 cursor-pointer">🟠 Pendente</SelectItem>
                                <SelectItem value="Concluído" className="text-xs font-bold text-green-600 cursor-pointer">🟢 Concluído</SelectItem>
                              </SelectContent>
                            </Select>

                            {/* Botão de Edição */}
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => startEditMaintenance(m)} 
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                              title="Editar manutenção"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            {/* Botão de Exclusão */}
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleDeleteMaintenance(m.id)} 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              title="Remover manutenção"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-2 opacity-50">
                    <Wrench className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-xs font-semibold uppercase tracking-wider">Nenhuma manutenção registrada</p>
                    <p className="text-[11px] text-muted-foreground">Clique em "Adicionar Manutenção" ou peça para a NORA registrar pelo WhatsApp/Chat.</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 px-6 bg-muted/30 border-t border-border/40 backdrop-blur-md shrink-0 flex justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)} className="px-6 text-xs">
            Cancelar
          </Button>
          <Button type="submit" form="vehicle-form" disabled={isSubmitting} className="px-8 text-xs font-semibold shadow-lg shadow-primary/20">
            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? "Salvar Alterações" : "Efetivar Cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
