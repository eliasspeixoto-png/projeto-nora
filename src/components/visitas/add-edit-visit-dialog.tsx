
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    CalendarIcon,
    Loader2,
    Upload,
    ImageIcon,
    Trash2,
    Check,
    ChevronsUpDown,
    User,
    MapPin,
    Clock,
    ClipboardList,
    Construction,
    Wrench,
    Camera,
    FileText,
    BadgeInfo,
    Smartphone,
    CheckCircle,
    FileSignature,
    AlertCircle,
    CalendarClock
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import type { Visit, Client, UserProfile, ServiceAddress } from "@/lib/data";
import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { addClient, getClientsOnce } from "@/lib/firebase/firestore";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { statusConfig } from "./visit-status";
import AddEditClientDialog from "@/components/clientes/add-edit-client-dialog";

const formSchema = z.object({
    clientId: z.string().min(1, "Selecione um cliente."),
    technicianId: z.string().optional(),
    date: z.date({ required_error: "A data é obrigatória." }),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:mm)."),
    address: z.string().min(5, "O endereço deve ter pelo menos 5 caracteres."),
    description: z.string().min(5, "A descrição deve ter pelo menos 5 caracteres."),
    status: z.enum(["Solicitada", "Agendada", "Atribuída", "Gerar Orçamento", "Finalizada", "Improdutiva", "Reagendar"], {
        required_error: "O status da visita é obrigatório.",
        invalid_type_error: "Status inválido selecionado.",
    }),

    serviceReport: z.string().optional(),
    requiredMaterials: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    rescheduleDate: z.date().optional(),
    rescheduleTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:mm).").optional(),
}).superRefine((data, ctx) => {
    if (data.status === 'Gerar Orçamento') {
        if (!data.serviceReport || data.serviceReport.length < 5) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A descrição da mão de obra é obrigatória.", path: ["serviceReport"] });
        }
        if (!data.requiredMaterials || data.requiredMaterials.length < 5) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A lista de materiais é obrigatória.", path: ["requiredMaterials"] });
        }
    } else if (data.status === 'Improdutiva' || data.status === 'Finalizada') {
        if (!data.serviceReport || data.serviceReport.length < 5) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O preenchimento deste campo é obrigatório para o desfecho selecionado.", path: ["serviceReport"] });
        }
    } else if (data.status === 'Reagendar') {
        if (!data.serviceReport || data.serviceReport.length < 5) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O motivo do reagendamento é obrigatório.", path: ["serviceReport"] });
        }
        if (!data.rescheduleDate && !data.rescheduleTime) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe a nova data ou novo horário para o reagendamento.", path: ["rescheduleDate"] });
        }
    }
});

type VisitFormData = Omit<Visit, 'id' | 'companyId' | 'visitNumber'>;

type AddEditVisitDialogProps = {
    isOpen: boolean;
    setOpen: (isOpen: boolean) => void;
    onVisitSaved: (data: VisitFormData, visitId?: string) => Promise<void>;
    visit?: Visit;
    clients: Client[];
    teamMembers: UserProfile[];
    allVisits: Visit[];
    preselectedDate?: Date;
    readOnly?: boolean;
    onEdit?: (visit: Visit) => void;
};

const formatAddressString = (addr: Partial<ServiceAddress> | Partial<Client>) => {
    return [addr.street, addr.number, addr.neighborhood, addr.city, addr.state].filter(Boolean).join(', ');
}

export default function AddEditVisitDialog({
    isOpen,
    setOpen,
    onVisitSaved,
    visit,
    clients,
    teamMembers,
    allVisits,
    preselectedDate,
    readOnly = false,
    onEdit,
}: AddEditVisitDialogProps) {
    const { toast } = useToast();
    const { userProfile, firebase } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isCalendarOpen, setCalendarOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [existingVisitConfirm, setExistingVisitConfirm] = useState<Visit | null>(null);
    const [tempSelectedClientId, setTempSelectedClientId] = useState<string | null>(null);

    const [clientSearch, setClientSearch] = useState("");
    const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
    
    const [localClients, setLocalClients] = useState<Client[]>([]);
    const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);

    useEffect(() => {
        setLocalClients(clients);
    }, [clients]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            status: "Agendada",
            time: "09:00",
            attachments: [],
        }
    });

    const isEditing = !!visit;

    const technicians = teamMembers.filter(m => {
        const role = m.role?.toLowerCase();
        return role === 'tecnico' || role === 'admin' || role === 'supervisor';
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));

    const normalizeString = (str: string | null | undefined) => {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    };

    const filteredClients = useMemo(() => {
        if (!clientSearch) return [...localClients].sort((a, b) => a.name.localeCompare(b.name));
        const searchStr = normalizeString(clientSearch).trim();
        return localClients.filter(client =>
            normalizeString(client.name).includes(searchStr) ||
            normalizeString(client.document).includes(searchStr) ||
            (client.clientCode && normalizeString(client.clientCode).includes(searchStr))
        ).sort((a, b) => {
            const nameA = normalizeString(a.name);
            const nameB = normalizeString(b.name);
            const docA = normalizeString(a.document);
            const docB = normalizeString(b.document);
            const codeA = a.clientCode ? normalizeString(a.clientCode) : '';
            const codeB = b.clientCode ? normalizeString(b.clientCode) : '';

            // Priority 1: Exact code or document
            const aExactDoc = docA === searchStr || codeA === searchStr;
            const bExactDoc = docB === searchStr || codeB === searchStr;
            if (aExactDoc && !bExactDoc) return -1;
            if (!aExactDoc && bExactDoc) return 1;

            // Priority 2: Starts with code or document
            const aStartsDoc = docA.startsWith(searchStr) || codeA.startsWith(searchStr);
            const bStartsDoc = docB.startsWith(searchStr) || codeB.startsWith(searchStr);
            if (aStartsDoc && !bStartsDoc) return -1;
            if (!aStartsDoc && bStartsDoc) return 1;

            // Priority 3: Exact name
            const aExactName = nameA === searchStr;
            const bExactName = nameB === searchStr;
            if (aExactName && !bExactName) return -1;
            if (!aExactName && bExactName) return 1;

            // Priority 4: Starts with name
            const aStartsName = nameA.startsWith(searchStr);
            const bStartsName = nameB.startsWith(searchStr);
            if (aStartsName && !bStartsName) return -1;
            if (!aStartsName && bStartsName) return 1;

            return a.name.localeCompare(b.name);
        });
    }, [localClients, clientSearch]);

    const selectedClientId = form.watch("clientId");
    const selectedTechnicianId = form.watch("technicianId");
    const currentStatus = form.watch("status");

    useEffect(() => {
        const clientData = localClients.find(c => c.id === selectedClientId);
        setSelectedClient(clientData || null);

        if (clientData && !readOnly && !isEditing) {
            const mainAddress = formatAddressString(clientData);
            form.setValue("address", mainAddress);
        }
    }, [selectedClientId, localClients, form, readOnly, isEditing]);

    useEffect(() => {
        if (!readOnly && !isEditing) {
            if (selectedTechnicianId && selectedTechnicianId !== 'none' && currentStatus === 'Agendada') {
                form.setValue('status', 'Atribuída');
            } else if ((!selectedTechnicianId || selectedTechnicianId === 'none') && currentStatus === 'Atribuída') {
                form.setValue('status', 'Agendada');
            }
        }
    }, [selectedTechnicianId, form, readOnly, isEditing, currentStatus]);

    useEffect(() => {
        if (isOpen) {
            setExistingVisitConfirm(null);
            setTempSelectedClientId(null);
            if (isEditing && visit) {
                form.reset({
                    ...visit,
                    date: visit.visitDate ? parseISO(visit.visitDate) : new Date(),
                    technicianId: visit.technicianId || "none",
                    attachments: visit.attachments || [],
                });
            } else {
                form.reset({
                    clientId: "",
                    technicianId: "none",
                    date: preselectedDate || new Date(),
                    status: preselectedDate ? "Atribuída" : "Agendada",
                    time: "09:00",
                    description: "",
                    address: "",
                    serviceReport: "",
                    requiredMaterials: "",
                    attachments: [],
                });
            }
        }
    }, [visit, isEditing, isOpen, form, preselectedDate]);

    const checkTechnicianAvailability = (technicianId: string, date: Date, time: string, visitIdToExclude?: string): boolean => {
        const proposedDateTime = new Date(`${format(date, "yyyy-MM-dd")}T${time}`);
        for (const item of allVisits) {
            if (visitIdToExclude && item.id === visitIdToExclude) continue;
            if (item.technicianId !== technicianId) continue;
            const existingDateTime = new Date(`${item.visitDate}T${item.time}`);
            const diff = Math.abs(proposedDateTime.getTime() - existingDateTime.getTime()) / (1000 * 60);
            if (diff < 30) return false;
        }
        return true;
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSaving(true);
        let finalStatus = values.status;

        if (isEditing) {
            if ((values.serviceReport || values.requiredMaterials) && (values.status === 'Agendada' || values.status === 'Atribuída')) {
                finalStatus = "Gerar Orçamento";
            }
        }

        let finalVisitDate = format(values.date, "yyyy-MM-dd");
        let finalTime = values.time;
        let newReschedules = visit?.reschedules ? [...visit.reschedules] : [];
        let finalOriginalDate = visit?.originalDate;
        let finalOriginalTime = visit?.originalTime;
        let finalServiceReport = values.serviceReport || '';

        if (finalStatus === 'Reagendar') {
            finalStatus = 'Atribuída';
            if (!finalOriginalDate) {
                finalOriginalDate = visit?.visitDate || finalVisitDate;
                finalOriginalTime = visit?.time || finalTime;
            }
            
            const rDate = values.rescheduleDate ? format(values.rescheduleDate, "yyyy-MM-dd") : finalVisitDate;
            const rTime = values.rescheduleTime || finalTime;
            
            newReschedules.push({
                newDate: rDate,
                newTime: rTime,
                reason: values.serviceReport || 'Sem motivo informado',
                timestamp: new Date().toISOString()
            });

            finalVisitDate = rDate;
            finalTime = rTime;
            finalServiceReport = ''; // Limpa o relatório para a próxima vez
        }

        const dataToSave: Omit<Visit, 'id' | 'companyId'> = {
            clientId: values.clientId,
            clientName: clients.find(c => c.id === values.clientId)?.name || visit?.clientName || '',
            technicianId: (values.technicianId === 'none' || !values.technicianId) ? '' : values.technicianId,
            technicianName: teamMembers.find(t => t.uid === values.technicianId)?.displayName || visit?.technicianName || '',
            visitDate: finalVisitDate,
            time: finalTime,
            address: values.address,
            description: values.description,
            status: finalStatus,
            serviceReport: finalServiceReport,
            requiredMaterials: values.requiredMaterials || '',
            attachments: values.attachments || [],
            visitNumber: visit?.visitNumber || '',
            creationDate: visit?.creationDate || new Date().toISOString(),
            originalDate: finalOriginalDate,
            originalTime: finalOriginalTime,
            reschedules: newReschedules,
        };


        try {
            if (values.technicianId && values.technicianId !== 'none') {
                const isAvailable = checkTechnicianAvailability(values.technicianId, values.date, values.time, visit?.id);
                if (!isAvailable) {
                    toast({
                        variant: "destructive",
                        title: "Conflito de Agendamento",
                        description: "O técnico já possui um compromisso neste horário. Verifique a agenda.",
                    });
                    setIsSaving(false);
                    return;
                }
            }

            if (dataToSave.status === 'Finalizada' || dataToSave.status === 'Gerar Orçamento' || dataToSave.status === 'Improdutiva' || dataToSave.status === 'Reagendar') {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0
                        });
                    });
                    dataToSave.completionLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                } catch (error) {
                    console.warn("Location check failed, proceeding without completion location.");
                }
            }

            await onVisitSaved(dataToSave, visit?.id);
            setOpen(false);
        } catch (error) {
            // Handled in parent
        } finally {
            setIsSaving(false);
        }
    };

    const handleClientSaved = async (clientData: any) => {
        if (!userProfile?.companyId || !firebase.auth || !firebase.db) return;
        try {
            const newClientData = { ...clientData, companyId: userProfile.companyId };
            const newClientId = await addClient(firebase.db, firebase.auth, newClientData);
            
            const updatedClients = await getClientsOnce(firebase.db, userProfile.companyId);
            setLocalClients(updatedClients);
            
            if (newClientId) {
                form.setValue("clientId", newClientId);
                const addedClient = updatedClients.find(c => c.id === newClientId);
                if (addedClient) {
                    setClientSearch(addedClient.name);
                }
            }
            
            setIsClientDialogOpen(false);
            setClientPopoverOpen(false);
            toast({ title: "Cliente adicionado", description: "O novo cliente foi selecionado para a visita." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao criar cliente", description: error.message });
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !userProfile || !firebase) return;

        setIsUploading(true);
        try {
            const { storage } = firebase;
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                const filePath = `visit-attachments/${userProfile.companyId}/${visit?.id || 'new'}/${file.name}-${Date.now()}`;
                const fileRef = ref(storage, filePath);
                await uploadString(fileRef, dataUrl, 'data_url');
                const downloadUrl = await getDownloadURL(fileRef);
                const currentAttachments = form.getValues("attachments") || [];
                form.setValue("attachments", [...currentAttachments, downloadUrl]);
                toast({ title: "Foto anexada!" });
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Erro no Upload" });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    const removeAttachment = (urlToRemove: string) => {
        const currentAttachments = form.getValues("attachments") || [];
        form.setValue("attachments", currentAttachments.filter(url => url !== urlToRemove));
    }

    const hasServiceAddresses = selectedClient && selectedClient.serviceAddresses && selectedClient.serviceAddresses.length > 0;
    const mainAddressString = selectedClient ? formatAddressString(selectedClient) : '';

    const statusInfo = statusConfig[currentStatus] || { label: currentStatus, variant: 'default', icon: BadgeInfo };

    let reportLabel = "Relatório do Campo";
    let reportPlaceholder = "Descreva as ações realizadas no local...";
    let materialsLabel = "Materiais p/ Proposta";
    let materialsPlaceholder = "Liste os materiais e componentes necessários...";
    let showMaterials = true;

    if (currentStatus === "Finalizada") {
        reportLabel = "Serviços Realizados (Para Faturamento/O.S)";
        reportPlaceholder = "Descreva detalhadamente tudo o que foi feito no local para gerar a cobrança/O.S...";
        showMaterials = false;
    } else if (currentStatus === "Gerar Orçamento") {
        reportLabel = "Mão de Obra e Ações Necessárias";
        reportPlaceholder = "Descreva detalhadamente o que será necessário fazer de serviço...";
        materialsLabel = "Lista de Materiais";
        materialsPlaceholder = "Especifique os materiais que precisarão ser comprados ou faturados...";
    } else if (currentStatus === "Improdutiva") {
        reportLabel = "Motivo da Visita Improdutiva";
        reportPlaceholder = "Explique por que não foi possível realizar o serviço (ex: cliente ausente, sem acesso)...";
        showMaterials = false;
    } else if (currentStatus === "Reagendar") {
        reportLabel = "Motivo do Reagendamento";
        reportPlaceholder = "Explique o motivo pelo qual o serviço não pôde ser iniciado/concluído e precisa ser reagendado...";
        showMaterials = false;
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-4xl flex flex-col p-0 h-[90vh] bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
                    <DialogHeader className="p-10 pb-6 border-b border-border/40 bg-primary/5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
                                        <Construction className="h-8 w-8 text-primary" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-3xl font-semibold tracking-tighter text-foreground">
                                            {isEditing ? `Visita #${visit?.visitNumber}` : "Agendar Visita"}
                                        </DialogTitle>

                                    </div>
                                </div>
                            </div>
                            {isEditing && (
                                <Badge variant={statusInfo.variant} className="h-10 px-6 text-xs font-semibold uppercase tracking-widest rounded-2xl shadow-lg border-border/40 flex items-center gap-3 active:scale-95 transition-all">
                                    <statusInfo.icon className="h-5 w-5" />
                                    {statusInfo.label}
                                </Badge>
                            )}
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 px-10">
                        <div className="pb-10">
                            <Form {...form}>
                                <form id="visit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                                    <fieldset disabled={readOnly} className="space-y-10">

                                        {/* SEÇÃO 1: IDENTIFICAÇÃO */}
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">01</div>
                                                <h3 className="text-sm font-semibold tracking-tight text-primary/80">Parâmetros de Identificação</h3>
                                            </div>
                                            <Card className="border-border/40 shadow-sm bg-primary/[0.02] rounded-[2rem] overflow-visible">
                                                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <FormField
                                                        control={form.control}
                                                        name="clientId"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col">
                                                                <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">
                                                                    Cliente
                                                                </FormLabel>
                                                                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                                                                    <PopoverTrigger asChild>
                                                                        <FormControl>
                                                                            <Button
                                                                                variant="outline"
                                                                                role="combobox"
                                                                                disabled={readOnly || isEditing}
                                                                                className={cn(
                                                                                    "h-12 w-full justify-between font-semibold text-sm rounded-xl bg-background border-primary/20 hover:bg-accent hover:text-accent-foreground transition-all px-4 shadow-sm",
                                                                                    !field.value && "text-muted-foreground"
                                                                                )}
                                                                            >
                                                                                <div className="flex items-center gap-2 truncate">
                                                                                    <User className="h-4 w-4 text-primary/40" />
                                                                                    {field.value
                                                                                        ? localClients.find((client) => client.id === field.value)?.name || visit?.clientName || "Cliente Desconhecido"
                                                                                        : "Selecionar cliente..."}
                                                                                </div>
                                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
                                                                            </Button>
                                                                        </FormControl>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-[2rem] border-border/40 shadow-2xl bg-background/90 backdrop-blur-3xl overflow-hidden" align="start">
                                                                        <Command className="bg-transparent">
                                                                            <CommandInput
                                                                                placeholder="Pesquisar por nome, documento ou ID..."
                                                                                className="h-14 font-semibold border-none focus:ring-0"
                                                                                value={clientSearch}
                                                                                onValueChange={setClientSearch}
                                                                            />
                                                                            <CommandList className="max-h-[300px]">
                                                                                <CommandEmpty className="p-4 text-center font-semibold text-muted-foreground/40 text-xs">Nenhum registro localizado</CommandEmpty>
                                                                                <CommandGroup className="p-2">
                                                                                    <CommandItem
                                                                                        onSelect={() => setIsClientDialogOpen(true)}
                                                                                        className="p-3 font-semibold cursor-pointer hover:bg-primary/5 text-primary justify-center gap-2 mb-1 rounded-xl"
                                                                                    >
                                                                                        <User className="h-4 w-4" /> Cadastrar Novo Cliente
                                                                                    </CommandItem>
                                                                                    {filteredClients.map((client) => (
                                                                                        <CommandItem
                                                                                            value={client.name}
                                                                                            key={client.id}
                                                                                            className="rounded-xl px-4 py-3 font-semibold aria-selected:bg-primary/10 aria-selected:text-primary transition-all cursor-pointer mb-1"
                                                                                            onSelect={() => {
                                                                                                const formattedAddress = client.address ||
                                                                                                    [client.street, client.number, client.neighborhood, client.city]
                                                                                                        .filter(Boolean)
                                                                                                        .join(', ');

                                                                                                const existingVisit = allVisits.find(v => v.clientId === client.id && (v.status === 'Agendada' || v.status === 'Atribuída'));
                                                                                                if (existingVisit && !isEditing) {
                                                                                                    setTempSelectedClientId(client.id);
                                                                                                    setExistingVisitConfirm(existingVisit);
                                                                                                    if (formattedAddress) form.setValue('address', formattedAddress);
                                                                                                } else {
                                                                                                    field.onChange(client.id);
                                                                                                    if (formattedAddress) form.setValue('address', formattedAddress);
                                                                                                }
                                                                                                setClientPopoverOpen(false)
                                                                                            }}
                                                                                        >
                                                                                            <Check className={cn("mr-3 h-4 w-4", client.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                                            <div className="flex flex-col">
                                                                                                <span className="text-sm tracking-tight">{client.name}</span>
                                                                                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 mt-0.5">
                                                                                                    {client.clientCode ? `ID: ${client.clientCode}` : (client.document || 'Sem documento')}
                                                                                                </span>
                                                                                            </div>
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
                                                        name="technicianId"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">
                                                                    Técnico Atribuído
                                                                </FormLabel>
                                                                <Select onValueChange={field.onChange} value={field.value || "none"} disabled={readOnly}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-12 font-semibold text-sm rounded-xl bg-background border-primary/20 hover:bg-accent transition-all px-4 shadow-sm">
                                                                            <div className="flex items-center gap-2">
                                                                                <Smartphone className="h-4 w-4 text-primary/40" />
                                                                                <SelectValue placeholder="Definir profissional..." />
                                                                            </div>
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent className="rounded-2xl border-border/40 shadow-2xl bg-background/90 backdrop-blur-3xl font-semibold">
                                                                        <SelectItem value="none" className="rounded-xl">Selecione um técnico</SelectItem>
                                                                        {technicians.map(tech => (
                                                                            <SelectItem key={tech.uid} value={tech.uid} className="rounded-xl">{tech.displayName}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage className="text-[10px] font-semibold" />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* SEÇÃO 2: AGENDA */}
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">02</div>
                                                <h3 className="text-sm font-semibold tracking-tight text-primary/80">Logística e Temporalidade</h3>
                                            </div>
                                            <Card className="border-border/40 shadow-sm bg-primary/[0.02] rounded-[2rem]">
                                                <CardContent className="p-8 space-y-8">
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 items-end">
                                                        <FormField
                                                            control={form.control}
                                                            name="date"
                                                            render={({ field }) => (
                                                                <FormItem className="flex flex-col sm:col-span-2">
                                                                    <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">
                                                                        Data Planejada
                                                                    </FormLabel>
                                                                    <Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
                                                                        <PopoverTrigger asChild>
                                                                            <FormControl>
                                                                                <Button
                                                                                    variant={"outline"}
                                                                                    className={cn(
                                                                                        "h-12 w-full justify-between font-semibold text-sm rounded-xl bg-background border-primary/20 hover:bg-accent transition-all px-4 shadow-sm",
                                                                                        !field.value && "text-muted-foreground"
                                                                                    )}
                                                                                    disabled={readOnly}
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <CalendarIcon className="h-4 w-4 text-primary/40" />
                                                                                        {field.value ? format(field.value, "EEEE, dd 'de' MMMM", { locale: ptBR }) : <span>Definir data...</span>}
                                                                                    </div>
                                                                                    <ChevronsUpDown className="ml-auto h-4 w-4 opacity-30" />
                                                                                </Button>
                                                                            </FormControl>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-auto p-0 rounded-3xl border-border/40 shadow-2xl bg-background/90 backdrop-blur-3xl overflow-hidden" align="start">
                                                                            <Calendar locale={ptBR} mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setCalendarOpen(false); }} initialFocus className="p-4" />
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                    <FormMessage className="text-[10px] font-semibold" />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name="time"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">
                                                                        Horário Estimado
                                                                    </FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="time"
                                                                            disabled={readOnly}
                                                                            {...field}
                                                                            className="h-12 font-semibold text-sm rounded-xl bg-background border-primary/20 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage className="text-[10px] font-semibold" />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                    {visit?.reschedules && visit.reschedules.length > 0 && (
                                                        <div className="space-y-4 p-6 bg-slate-500/5 border border-border/40 rounded-2xl">
                                                            <div className="flex items-center gap-2 text-primary/80 mb-2">
                                                                <CalendarClock className="h-5 w-5" />
                                                                <h4 className="text-sm font-semibold">Histórico de Reagendamentos</h4>
                                                            </div>
                                                            <div className="flex flex-col gap-3">
                                                                <div className="text-xs font-semibold text-muted-foreground">
                                                                    Data Planejada Inicialmente: {format(parseISO(visit.originalDate || visit.visitDate), "dd/MM/yyyy")} às {visit.originalTime || visit.time}
                                                                </div>
                                                                {visit.reschedules.map((res, idx) => (
                                                                    <div key={idx} className="flex flex-col p-4 bg-background rounded-xl border border-border/50 gap-1 shadow-sm">
                                                                        <div className="flex justify-between items-start">
                                                                            <span className="text-xs font-bold text-amber-600">Reagendamento #{idx + 1}</span>
                                                                            <span className="text-[10px] text-muted-foreground">{format(parseISO(res.timestamp), "dd/MM HH:mm")}</span>
                                                                        </div>
                                                                        <div className="text-sm font-semibold text-foreground">
                                                                            Para {format(parseISO(res.newDate), "dd/MM/yyyy")} às {res.newTime}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground mt-1">
                                                                            <span className="font-semibold">Motivo: </span>{res.reason}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {currentStatus === "Reagendar" && visit?.status !== "Reagendar" && (
                                                        <div className="space-y-4 p-6 bg-amber-500/5 border border-amber-200/50 rounded-2xl">
                                                            <div className="flex items-center gap-2 text-amber-600 mb-2">
                                                                <CalendarClock className="h-5 w-5" />
                                                                <h4 className="text-sm font-semibold">Definir Nova Data/Hora para Reagendamento</h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 items-end">
                                                                <FormField
                                                                    control={form.control}
                                                                    name="rescheduleDate"
                                                                    render={({ field }) => (
                                                                        <FormItem className="flex flex-col sm:col-span-2">
                                                                            <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">Nova Data</FormLabel>
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                    <FormControl>
                                                                                        <Button variant={"outline"} className={cn("h-12 w-full justify-start text-left font-semibold text-sm rounded-xl bg-amber-50/50 border-amber-200 shadow-sm", !field.value && "text-muted-foreground")}>
                                                                                            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                                                                            {field.value ? format(field.value, "EEEE, dd 'de' MMMM", { locale: ptBR }) : <span>Mesma data atual</span>}
                                                                                        </Button>
                                                                                    </FormControl>
                                                                                </PopoverTrigger>
                                                                                <PopoverContent className="w-auto p-0 rounded-3xl" align="start">
                                                                                    <Calendar locale={ptBR} mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="p-4" />
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                            <FormMessage className="text-[10px] font-semibold" />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField
                                                                    control={form.control}
                                                                    name="rescheduleTime"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">Novo Horário</FormLabel>
                                                                            <FormControl>
                                                                                <Input type="time" {...field} className="h-12 font-semibold text-sm rounded-xl bg-amber-50/50 border-amber-200 shadow-sm transition-all px-4" />
                                                                            </FormControl>
                                                                            <FormMessage className="text-[10px] font-semibold" />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </div>
                                                            <p className="text-xs text-muted-foreground font-medium px-1">Selecione apenas o que precisar mudar. Deixar em branco mantém o original.</p>
                                                        </div>
                                                    )}
                                                    <FormField
                                                        control={form.control}
                                                        name="address"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">
                                                                    Ponto de Atendimento
                                                                </FormLabel>
                                                                {hasServiceAddresses && !readOnly ? (
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger className="h-12 font-semibold text-sm rounded-xl bg-background border-primary/20 hover:bg-accent transition-all px-4 shadow-sm">
                                                                                <div className="flex items-center gap-2 truncate">
                                                                                    <MapPin className="h-4 w-4 text-primary/40" />
                                                                                    <SelectValue placeholder="Escolha um local cadastrado..." />
                                                                                </div>
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent className="rounded-2xl border-border/40 shadow-2xl bg-background/90 backdrop-blur-3xl font-semibold max-w-[400px]">
                                                                            <SelectItem value={mainAddressString} className="rounded-xl">
                                                                                <span className="font-semibold text-primary text-[10px] uppercase tracking-widest mr-2 bg-primary/5 px-2 py-0.5 rounded-lg">Principal</span>
                                                                                {selectedClient.street}, {selectedClient.number}
                                                                            </SelectItem>
                                                                            {selectedClient.serviceAddresses?.map(addr => (
                                                                                <SelectItem key={addr.id} value={formatAddressString(addr)} className="rounded-xl">
                                                                                    <span className="font-semibold text-orange-600 text-[10px] uppercase tracking-widest mr-2 bg-orange-500/5 px-2 py-0.5 rounded-lg">{addr.name}</span>
                                                                                    {addr.street}, {addr.number}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                ) : (
                                                                    <FormControl>
                                                                        <div className="relative group">
                                                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-all" />
                                                                            <Input placeholder="Digitar endereço completo do serviço..." {...field} className="h-12 pl-12 font-medium rounded-xl bg-background border-primary/20 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30" disabled={readOnly || (!!selectedClientId && !hasServiceAddresses)} />
                                                                        </div>
                                                                    </FormControl>
                                                                )}
                                                                <FormMessage className="text-[10px] font-semibold" />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* SEÇÃO 3: SERVIÇO */}
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">03</div>
                                                <h3 className="text-sm font-semibold tracking-tight text-primary/80">Escopo Operacional</h3>
                                            </div>
                                            <Card className="border-border/40 shadow-sm bg-primary/[0.02] rounded-[2rem]">
                                                <CardContent className="p-8 space-y-8">
                                                    <FormField
                                                        control={form.control}
                                                        name="description"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">
                                                                    Descrição da Necessidade / OS
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Textarea
                                                                        placeholder="Descreva tecnicamente os problemas relatados ou o escopo do atendimento..."
                                                                        {...field}
                                                                        rows={4}
                                                                        disabled={readOnly}
                                                                        className="resize-none font-medium rounded-xl bg-background border-primary/20 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all p-4"
                                                                    />
                                                                </FormControl>
                                                                <FormMessage className="text-[10px] font-semibold" />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="status"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-2">
                                                                    {isEditing ? "Desfecho da Visita" : "Status do Fluxo de Trabalho"}
                                                                </FormLabel>
                                                                {isEditing && !readOnly ? (
                                                                    <div className="space-y-4">
                                                                        <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                                                                            <FormControl>
                                                                                <SelectTrigger className="h-12 font-semibold text-sm rounded-xl bg-background border-primary/20 hover:bg-accent transition-all px-4 shadow-sm">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <ClipboardList className="h-4 w-4 text-primary/40" />
                                                                                        <SelectValue />
                                                                                    </div>
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent className="rounded-2xl border-border/40 shadow-2xl bg-background/90 backdrop-blur-3xl font-semibold">
                                                                                <SelectItem value="Solicitada" className="rounded-xl text-amber-600">Nova Solicitação (Pendente)</SelectItem>
                                                                                <SelectItem value="Agendada" className="rounded-xl">Compromisso Agendado</SelectItem>
                                                                                <SelectItem value="Atribuída" className="rounded-xl text-blue-600">Alocado p/ Equipe</SelectItem>
                                                                                <SelectItem value="Gerar Orçamento" className="rounded-xl text-orange-600">Demanda p/ Orçar</SelectItem>
                                                                                <SelectItem value="Finalizada" className="rounded-xl text-green-600">Operação Concluída</SelectItem>
                                                                                <SelectItem value="Improdutiva" className="rounded-xl text-destructive">Visita Improdutiva</SelectItem>
                                                                                <SelectItem value="Reagendar" className="rounded-xl text-amber-600">Reagendar Visita</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>

                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                                                                            <div 
                                                                                onClick={() => field.onChange("Finalizada")}
                                                                                className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2", field.value === "Finalizada" ? "border-green-500 bg-green-500/10" : "border-border/40 hover:border-green-500/50 bg-background")}
                                                                            >
                                                                                <div className="flex items-center gap-2 font-semibold text-green-600"><CheckCircle className="h-5 w-5" /> Serviço Realizado</div>
                                                                                <span className="text-[10px] text-muted-foreground leading-tight">Operação concluída com sucesso.</span>
                                                                            </div>
                                                                            <div 
                                                                                onClick={() => field.onChange("Gerar Orçamento")}
                                                                                className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2", field.value === "Gerar Orçamento" ? "border-orange-500 bg-orange-500/10" : "border-border/40 hover:border-orange-500/50 bg-background")}
                                                                            >
                                                                                <div className="flex items-center gap-2 font-semibold text-orange-600"><FileSignature className="h-5 w-5" /> Necessita Orçamento</div>
                                                                                <span className="text-[10px] text-muted-foreground leading-tight">Requer aprovação de novos custos.</span>
                                                                            </div>
                                                                            <div 
                                                                                onClick={() => field.onChange("Improdutiva")}
                                                                                className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2", field.value === "Improdutiva" ? "border-destructive bg-destructive/10" : "border-border/40 hover:border-destructive/50 bg-background")}
                                                                            >
                                                                                <div className="flex items-center gap-2 font-semibold text-destructive"><AlertCircle className="h-5 w-5" /> Improdutiva</div>
                                                                                <span className="text-[10px] text-muted-foreground leading-tight">Não foi possível realizar o serviço.</span>
                                                                            </div>
                                                                            <div 
                                                                                onClick={() => field.onChange("Reagendar")}
                                                                                className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2", field.value === "Reagendar" ? "border-amber-500 bg-amber-500/10" : "border-border/40 hover:border-amber-500/50 bg-background")}
                                                                            >
                                                                                <div className="flex items-center gap-2 font-semibold text-amber-600"><CalendarClock className="h-5 w-5" /> Reagendar</div>
                                                                                <span className="text-[10px] text-muted-foreground leading-tight">Solicitar nova data para o serviço.</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                                                                        <FormControl>
                                                                            <SelectTrigger className="h-12 font-semibold text-sm rounded-xl bg-background border-primary/20 hover:bg-accent transition-all px-4 shadow-sm">
                                                                                <div className="flex items-center gap-2">
                                                                                    <ClipboardList className="h-4 w-4 text-primary/40" />
                                                                                    <SelectValue />
                                                                                </div>
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent className="rounded-2xl border-border/40 shadow-2xl bg-background/90 backdrop-blur-3xl font-semibold">
                                                                            <SelectItem value="Solicitada" className="rounded-xl text-amber-600">Nova Solicitação (Pendente)</SelectItem>
                                                                            <SelectItem value="Agendada" className="rounded-xl">Compromisso Agendado</SelectItem>
                                                                            <SelectItem value="Atribuída" className="rounded-xl text-blue-600">Alocado p/ Equipe</SelectItem>
                                                                            <SelectItem value="Gerar Orçamento" className="rounded-xl text-orange-600">Demanda p/ Orçar</SelectItem>
                                                                            <SelectItem value="Finalizada" className="rounded-xl text-green-600">Operação Concluída</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}
                                                                <FormMessage className="text-[10px] font-semibold" />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* SEÇÃO 4: EXECUÇÃO */}
                                        {(isEditing || readOnly) && (
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">04</div>
                                                    <h3 className="text-sm font-semibold tracking-tight text-primary/80">Evidências e Laudo Técnico</h3>
                                                </div>
                                                <Card className="border-border/40 shadow-sm bg-primary/[0.02] rounded-[2rem] overflow-hidden">
                                                    <CardContent className="p-8 space-y-8">
                                                        <div className={cn("grid gap-8", showMaterials ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                                                            <FormField
                                                                control={form.control}
                                                                name="serviceReport"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs font-semibold text-blue-700 ml-1 mb-2">{reportLabel}</FormLabel>
                                                                        <FormControl>
                                                                            <Textarea placeholder={reportPlaceholder} {...field} rows={6} disabled={readOnly} className="font-medium rounded-xl bg-blue-50/50 border-blue-200 shadow-sm focus-visible:ring-1 focus-visible:ring-blue-500/30 transition-all p-4" />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[10px] font-semibold" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            {showMaterials && (
                                                                <FormField
                                                                    control={form.control}
                                                                    name="requiredMaterials"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs font-semibold text-orange-700 ml-1 mb-2">{materialsLabel}</FormLabel>
                                                                            <FormControl>
                                                                                <Textarea placeholder={materialsPlaceholder} {...field} rows={6} disabled={readOnly} className="font-medium rounded-xl bg-orange-50/50 border-orange-200 shadow-sm focus-visible:ring-1 focus-visible:ring-orange-500/30 transition-all p-4" />
                                                                            </FormControl>
                                                                            <FormMessage className="text-[10px] font-semibold" />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            )}
                                                        </div>

                                                        <Separator className="opacity-10" />

                                                        <FormField
                                                            control={form.control}
                                                            name="attachments"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs font-semibold text-primary/80 ml-1 mb-4 flex items-center gap-2">
                                                                        <Camera className="h-4 w-4" /> Galeria de Anexos Operacionais
                                                                    </FormLabel>
                                                                    <div className="flex flex-wrap items-center gap-4">
                                                                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                                                        {!readOnly && (
                                                                            <Button type="button" variant="outline" size="lg" className="h-14 w-full sm:w-auto rounded-2xl border-dashed border-primary/20 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary transition-all font-semibold" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                                                                {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-3 h-5 w-5 text-primary" />}
                                                                                {isUploading ? "PROCESSANDO ARQUIVO..." : "UPLOAD DE EVIDÊNCIA"}
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-6">
                                                                        {field.value?.map(url => (
                                                                            <div key={url} className="relative aspect-square group rounded-[1.5rem] overflow-hidden border border-border/40 bg-background shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer">
                                                                                <Image src={url} alt="anexo operacional" fill style={{ objectFit: 'cover' }} sizes="200px" />
                                                                                {!readOnly && (
                                                                                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                                                        <Button variant="destructive" size="icon" className="h-10 w-10 rounded-xl shadow-xl shadow-destructive/20" onClick={() => removeAttachment(url)}>
                                                                                            <Trash2 className="h-5 w-5" />
                                                                                        </Button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                        {(!field.value || field.value.length === 0) && (
                                                                            <div className="col-span-full py-12 text-center rounded-[2rem] border-2 border-dashed border-border/40 bg-primary/[0.01]">
                                                                                <ImageIcon className="h-12 w-12 text-primary/10 mx-auto mb-3" />
                                                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/20">Sem mídias cadastradas para este atendimento</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <FormMessage className="text-[10px] font-semibold" />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        )}
                                    </fieldset>
                                </form>
                            </Form>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-10 pt-6 flex gap-4">
                        <Button variant="ghost" onClick={() => setOpen(false)} className="h-14 px-8 rounded-2xl font-semibold text-xs uppercase tracking-widest bg-stone-100 dark:bg-stone-800/50 hover:bg-stone-200 dark:hover:bg-stone-800 transition-all border border-stone-200 dark:border-stone-700">
                            {readOnly ? "Fechar Painel" : "Cancelar"}
                        </Button>
                        {!readOnly && (
                            <Button type="submit" form="visit-form" disabled={isSaving || isUploading} className="h-14 px-10 rounded-2xl font-semibold text-xs uppercase tracking-[0.1em] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                                {isSaving ? <Loader2 className="animate-spin mr-3 h-5 w-5" /> : <Check className="mr-3 h-5 w-5" />}
                                {isEditing ? (['Finalizada', 'Gerar Orçamento', 'Improdutiva', 'Reagendar'].includes(currentStatus) ? "Finalizar Visita" : "Atualizar Registro") : "Confirmar Operação"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!existingVisitConfirm} onOpenChange={(open) => !open && setExistingVisitConfirm(null)}>
                <AlertDialogContent className="rounded-xl border-primary/20 shadow-2xl">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                            <Construction className="h-5 w-5" />
                            Visita Ativa Identificada
                        </div>
                        <AlertDialogTitle>O cliente {clients.find(c => c.id === tempSelectedClientId)?.name} já possui um agendamento.</AlertDialogTitle>
                        <AlertDialogDescription className="text-foreground pt-2">
                            Identificamos que este cliente tem uma visita em aberto para o dia <b>{existingVisitConfirm && format(parseISO(existingVisitConfirm.visitDate), "dd/MM/yyyy", { locale: ptBR })}</b>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {existingVisitConfirm && (
                        <div className="my-4 space-y-2 rounded-xl border border-border/40 bg-primary/5 p-4 text-sm">
                            <div className="flex justify-between font-semibold">
                                <span>#{existingVisitConfirm.visitNumber}</span>
                                <Badge variant="secondary">{existingVisitConfirm.status}</Badge>
                            </div>
                            <Separator className="bg-primary/10" />
                            <p className="italic text-muted-foreground">"{existingVisitConfirm.description}"</p>
                        </div>
                    )}
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel onClick={() => { setExistingVisitConfirm(null); setTempSelectedClientId(null); form.setValue('clientId', ''); setClientSearch(''); }} className="w-full sm:w-auto">
                            Cancelar
                        </AlertDialogCancel>
                        <Button variant="outline" onClick={() => { if (tempSelectedClientId) form.setValue('clientId', tempSelectedClientId); setExistingVisitConfirm(null); setTempSelectedClientId(null); }} className="w-full sm:w-auto">
                            Manter Ambos
                        </Button>
                        <AlertDialogAction onClick={() => { if (existingVisitConfirm && onEdit) { setOpen(false); onEdit(existingVisitConfirm); } setExistingVisitConfirm(null); setTempSelectedClientId(null); }} className="w-full sm:w-auto">
                            Editar Existente
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AddEditClientDialog 
                isOpen={isClientDialogOpen} 
                setOpen={setIsClientDialogOpen}
                onClientSaved={handleClientSaved}
            />
        </>
    );
}
