"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Quote, Client } from "@/lib/data";
import { updateQuote, addServiceImageToQuote, deleteServiceImageFromQuote, createReceivable, updateClient, decrementStockFromQuote, getProductsOnce, addOSReturn } from "@/lib/firebase/firestore";
import { Loader2, ArrowLeft, User, MapPin, ClipboardList, Check, AlertTriangle, Upload, Trash2, Camera, Edit, Eraser, ImageIcon, PackageCheck, Phone, Smartphone, CalendarClock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { Textarea } from "@/components/ui/textarea";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Clock, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import dynamic from 'next/dynamic';



const formatQuantity = (quantity: number) => Number.isInteger(quantity) ? quantity.toFixed(0) : quantity.toFixed(2);

type OsExecutionClientProps = {
  initialQuote: Quote;
  initialClient: Client;
}

export default function OsExecutionClient({ initialQuote, initialClient }: OsExecutionClientProps) {
  const router = useRouter();
  const { userProfile, firebase } = useAuth();
  const { toast } = useToast();
  
  const [quote, setQuote] = useState<Quote>(initialQuote);
  const [client, setClient] = useState<Client>(initialClient);
  
  const [isSaving, setIsSaving] = useState(false);
  const [serviceReport, setServiceReport] = useState(initialQuote.notes || "");
  
  useEffect(() => {
      // Apenas seta o report inicial e inicializa
      setServiceReport(initialQuote.notes || "");
  }, [initialQuote]);

  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>(initialQuote.serviceImages || []);
  const [returnReason, setReturnReason] = useState("");
  const [isReturnDialogOpen, setReturnDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [isPhotoAlertOpen, setPhotoAlertOpen] = useState(false);

  const [requiresPreventive, setRequiresPreventive] = useState(initialQuote.requiresPreventiveMaintenance || false);
  const [preventiveFrequency, setPreventiveFrequency] = useState(initialQuote.preventiveMaintenanceFrequency?.toString() || "6");

  const [materialConfirmation, setMaterialConfirmation] = useState<'unanswered' | 'yes' | 'no'>(
    initialQuote.status === 'Finalizado' ? 'yes' : 'unanswered'
  );
  const [materialDiscrepancyNotes, setMaterialDiscrepancyNotes] = useState("");

  // Reschedule state
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [isRescheduleCalendarOpen, setRescheduleCalendarOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const notifyAdmins = async (title: string, message: string, data?: any) => {
    try {
        const idToken = await firebase.auth?.currentUser?.getIdToken();
        if (!idToken) return;

        const res = await fetch('/api/notifications/notify-admins', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ title, message, data })
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            console.warn('Admin Notification skip:', errorData.error);
        }
    } catch (e) {
        console.error('Falha ao disparar notificação para administradores:', e);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distância em metros
  };

  const checkLowStockAlerts = async (quote: Quote) => {
    if (!firebase.db || !userProfile?.companyId) return;
    
    try {
        const products = await getProductsOnce(firebase.db, userProfile.companyId);
        const lowStockItems = quote.items.filter(item => {
            const product = products.find(p => p.id === item.product.id);
            if (!product) return false;
            return (product.stockQuantity || 0) <= (product.minStockQuantity || 0);
        });

        if (lowStockItems.length > 0) {
            const itemNames = lowStockItems.map(i => i.product.description).join(', ');
            notifyAdmins(
                "Alerta de Estoque Baixo 📦",
                `Os seguintes produtos atingiram o nível crítico: ${itemNames}. Favor providenciar reposição.`,
                { type: 'low_stock_alert', products: itemNames, clickAction: '/estoque' }
            );
        }
    } catch (e) {
        console.error('Falha ao verificar alertas de estoque:', e);
    }
  };

  const handleSaveProgress = async () => {
    if (!quote || !client || !firebase) return;
    setIsSaving(true);
    try {
      const finalReport = materialConfirmation === 'no' && materialDiscrepancyNotes.trim() 
        ? `${serviceReport}\n\n[REVISÃO DE MATERIAL]:\n${materialDiscrepancyNotes}`
        : serviceReport;
        
      await updateQuote(firebase.db, firebase.auth, quote.id, {
        notes: finalReport,
        serviceImages: attachments,
      });
      toast({ title: "Progresso Salvo", description: "O relatório e as fotos foram atualizados sem finalizar a O.S." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishOS = async () => {
    if (!quote || !client || !firebase) return;
    
    if (materialConfirmation === 'unanswered') {
        toast({ variant: "destructive", title: "Ação Necessária", description: "Por favor, confirme se o uso de material foi conforme o planejado." });
        return;
    }
    
    if (materialConfirmation === 'no' && !materialDiscrepancyNotes.trim()) {
        toast({ variant: "destructive", title: "Ação Necessária", description: "Descreva as alterações de material para prosseguir." });
        return;
    }

    setIsSaving(true);
    
    let completionLocation: { latitude: number; longitude: number; } | undefined;
    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        completionLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        toast({ title: "Localização registrada!"});
    } catch (error) {
        toast({ variant: "destructive", title: "Atenção", description: "Não foi possível obter a localização. A O.S. será finalizada sem geolocalização."});
    }

    try {
      if (quote.status !== 'Finalizado' && !quote.isChildOS && !quote.parentQuoteId) {
          await createReceivable(firebase.db, quote.id);
      }
      
      const newStatus = materialConfirmation === 'yes' ? 'Finalizado' : 'revision-pending';
      const finalReport = materialConfirmation === 'no' 
        ? `${serviceReport}\n\n[REVISÃO DE MATERIAL]:\n${materialDiscrepancyNotes}`
        : serviceReport;

      const completionDate = new Date().toISOString();
      
      let nextPreventiveMaintenanceDate;
      if (requiresPreventive) {
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + parseInt(preventiveFrequency, 10));
        nextPreventiveMaintenanceDate = nextDate.toISOString();
      }
      
      const updateData: any = {
        status: newStatus,
        notes: finalReport,
        serviceImages: attachments,
        requiresPreventiveMaintenance: requiresPreventive,
      };

      if (completionLocation) {
        updateData.completionLocation = completionLocation;
      }
      
      if (newStatus === 'Finalizado') {
        updateData.completionDate = completionDate;
      }

      if (requiresPreventive) {
        updateData.preventiveMaintenanceFrequency = parseInt(preventiveFrequency, 10);
        updateData.nextPreventiveMaintenanceDate = nextPreventiveMaintenanceDate;
      } else {
        updateData.preventiveMaintenanceFrequency = null;
        updateData.nextPreventiveMaintenanceDate = null;
      }
      
      await updateQuote(firebase.db, firebase.auth, quote.id, updateData);

      if (newStatus === 'Finalizado') {
        if (quote.osType === 'Manutenção de Comodato Preventiva') {
          await updateClient(firebase.db, client.id, { lastPreventiveMaintenanceDate: completionDate });
        }
        
        // Dar baixa no estoque físico dos materiais da Ordem de Serviço apenas se for a primeira finalização
        if (quote.status !== 'Finalizado') {
          await decrementStockFromQuote(firebase.db, quote);
          setTimeout(() => checkLowStockAlerts(quote), 2000);
        }
      }
      
      toast({ 
        title: "Sucesso!", 
        description: quote.status === 'Finalizado' 
          ? "Relatório técnico e fotos da O.S. atualizados com sucesso." 
          : `Ordem de Serviço marcada como ${newStatus === 'Finalizado' ? 'Finalizada' : 'Pendente de Revisão'}.` 
      });
      
      // Notificar Administradores
      const osNumber = quote.quoteNumber.replace('ORC', 'OS');
      let gpsWarning = "";
      
      // Validação de GPS (Geo-fencing) - Limite de 1000m
      if (completionLocation && client.latitude && client.longitude) {
        const distance = calculateDistance(
            completionLocation.latitude, 
            completionLocation.longitude, 
            client.latitude, 
            client.longitude
        );
        if (distance > 1000) {
            gpsWarning = ` ⚠️ ALERTA: Finalizada a ${Math.round(distance)}m do local cadastrado.`;
        }
      }

      // Destaque financeiro para faturamentos acima de R$ 1.000,00
      let financeHighlight = "";
      if (quote.total > 1000) {
          financeHighlight = ` 💰 Faturamento: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(quote.total)}`;
      }

      notifyAdmins(
        `OS ${newStatus === 'Finalizado' ? 'Finalizada' : 'p/ Revisão'} ✅${financeHighlight}${gpsWarning}`,
        `O técnico ${userProfile?.displayName || 'desconhecido'} concluiu a ${osNumber} (${client.name}).${financeHighlight}${gpsWarning}`,
        { osId: quote.id, type: 'os_finished', status: newStatus, gpsWarning, total: quote.total }
      );

      router.push('/minhas-os');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao Finalizar", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleReturnOS = async () => {
    if (!quote || !returnReason.trim() || !firebase) {
        toast({ variant: "destructive", title: "Erro", description: "O motivo da devolução é obrigatório." });
        return;
    }
    setIsSaving(true);

    let returnLocation: { latitude: number; longitude: number; } | undefined;
    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
        returnLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch (error) {
        console.warn("GPS não capturado na devolução:", error);
    }
    
    try {
      const techName = userProfile?.displayName || 'Técnico';
      
      // 1. Salvar Devolução Estruturada na Nova Coleção
      await addOSReturn(firebase.db, {
          osId: quote.id,
          osNumber: quote.quoteNumber.replace('ORC', 'OS'),
          technicianId: userProfile?.uid || 'Unknown',
          technicianName: techName,
          returnedAt: new Date().toISOString(),
          reason: returnReason,
          location: returnLocation,
          companyId: quote.companyId
      });

      // 2. Atualizar O.S. Root (Limpar atribuição e marcar como Devolvida)
      const statusUpdate = { 
        status: 'Devolvida' as const,
        returnReason: returnReason,
        returnedBy: techName,
        returnedAt: new Date().toISOString(),
        returnLocation: returnLocation,
        assignedTechnicianId: '',
        assignedTechnicianName: '',
        assignedAt: '',
        statusHistory: [
          ...(quote.statusHistory || []),
          {
            status: 'Devolvida',
            changedAt: new Date().toISOString(),
            changedBy: userProfile?.uid,
            notes: `Devolvida: ${returnReason}`
          }
        ]
      };
      
      await updateQuote(firebase.db, firebase.auth, quote.id, statusUpdate);
      toast({ title: "O.S. Devolvida", description: "A Ordem de Serviço foi marcada como Devolvida e liberada." });
      
      if (returnLocation) {
          toast({ title: "GPS Capturado!", description: "A localização da devolução foi registrada no sistema." });
      }
      
      // Notificar Administradores sobre a devolução
      const osNumber = quote.quoteNumber.replace('ORC', 'OS');
      notifyAdmins(
        "OS Devolvida p/ Técnico ⚠️",
        `O técnico ${userProfile?.displayName || 'desconhecido'} devolveu a ${osNumber} (${client.name}). Motivo: ${returnReason}${returnLocation ? ' (GPS Capturado)' : ''}`,
        { osId: quote.id, type: 'os_returned', reason: returnReason, returnLocation, clickAction: '/ordem-de-servico' }
      );

      setReturnDialogOpen(false);
      router.push('/minhas-os');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao Devolver", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRescheduleOS = async () => {
    if (!quote || !rescheduleDate || !rescheduleTime || !rescheduleReason.trim() || !firebase) {
        toast({ variant: "destructive", title: "Erro", description: "Preencha a data, hora e motivo do reagendamento." });
        return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(rescheduleTime)) {
        toast({ variant: "destructive", title: "Erro", description: "Formato de hora inválido (HH:mm)." });
        return;
    }

    setIsSaving(true);

    try {
        const finalVisitDate = format(rescheduleDate, "yyyy-MM-dd");
        const finalTime = rescheduleTime;
        let newReschedules = quote.reschedules ? [...quote.reschedules] : [];
        
        const currentScheduledDate = quote.scheduledDate || format(new Date(), "yyyy-MM-dd");
        const currentScheduledTime = quote.scheduledTime || "";

        let finalOriginalDate = quote.originalDate || currentScheduledDate;
        let finalOriginalTime = quote.originalTime || currentScheduledTime;

        newReschedules.push({
            newDate: finalVisitDate,
            newTime: finalTime,
            reason: rescheduleReason,
            timestamp: new Date().toISOString()
        });

        const statusUpdate = { 
            status: 'Atribuída' as const, // Mantém para o mesmo técnico
            scheduledDate: finalVisitDate,
            scheduledTime: finalTime,
            originalDate: finalOriginalDate,
            originalTime: finalOriginalTime,
            reschedules: newReschedules,
            statusHistory: [
              ...(quote.statusHistory || []),
              {
                status: 'Reagendado',
                changedAt: new Date().toISOString(),
                changedBy: userProfile?.uid,
                notes: `Reagendado para ${format(rescheduleDate, "dd/MM/yyyy")} às ${finalTime}. Motivo: ${rescheduleReason}`
              }
            ]
        };

        await updateQuote(firebase.db, firebase.auth, quote.id, statusUpdate);
        toast({ title: "O.S. Reagendada", description: "A Ordem de Serviço foi reagendada com sucesso." });
        
        // Notificar Administradores sobre o reagendamento
        const osNumber = quote.quoteNumber.replace('ORC', 'OS');
        notifyAdmins(
            "OS Reagendada ⏳",
            `O técnico ${userProfile?.displayName || 'desconhecido'} reagendou a ${osNumber} (${client.name}) para ${format(rescheduleDate, "dd/MM/yyyy")} às ${finalTime}. Motivo: ${rescheduleReason}`,
            { osId: quote.id, type: 'os_rescheduled', reason: rescheduleReason, clickAction: '/ordem-de-servico' }
        );

        setIsRescheduleDialogOpen(false);
        router.push('/minhas-os');
    } catch (e: any) {
        toast({ variant: "destructive", title: "Erro ao Reagendar", description: e.message });
    } finally {
        setIsSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userProfile || !quote || !firebase) return;
    
    setIsUploading(true);
    toast({ title: `Enviando foto...` });

    try {
        const { storage } = firebase;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            const filePath = `service-images/${quote.companyId}/${quote.id}/${file.name}-${Date.now()}`;
            const fileRef = ref(storage, filePath);
            await uploadString(fileRef, dataUrl, 'data_url');
            const downloadUrl = await getDownloadURL(fileRef);

            await addServiceImageToQuote(firebase.db, quote.id, [downloadUrl]);
            setAttachments(prev => [...prev, downloadUrl]);

            // Notificar Administradores sobre nova evidência fotográfica
            const osNumber = quote.quoteNumber.replace('ORC', 'OS');
            notifyAdmins(
                "Nova Foto de OS 📸",
                `O técnico ${userProfile?.displayName || 'desconhecido'} anexou uma foto na ${osNumber} (${client.name}).`,
                { osId: quote.id, type: 'os_photo_added', imageUrl: downloadUrl, clickAction: `/ordem-de-servico` }
            );
            toast({ title: "Foto anexada!" });
        }
    } catch (e) {
        toast({ variant: "destructive", title: "Erro no Upload" });
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const removeAttachment = async (urlToRemove: string) => {
      if (!quote || !firebase) return;
      await deleteServiceImageFromQuote(firebase.db, quote.id, urlToRemove);
      setAttachments(prev => prev.filter(url => url !== urlToRemove));
      toast({ title: "Foto removida." });
  };

  const confirmDeletePhoto = (url: string) => {
    setPhotoToDelete(url);
    setPhotoAlertOpen(true);
  };

  const handleDeletePhoto = () => {
    if (photoToDelete) {
      removeAttachment(photoToDelete);
      setPhotoToDelete(null);
      setPhotoAlertOpen(false);
    }
  };

  return (
    <>
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="mr-2" /> Voltar</Button>
        </div>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Execução de O.S. - {quote.quoteNumber.replace('ORC','OS')}</CardTitle>
                        <CardDescription>Cliente: {client.name}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge variant={quote.status === 'Finalizado' ? 'success' : 'warning'}>{quote.status}</Badge>
                        {quote.originalDate && (
                            <div className="flex flex-col items-end">
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                                    Reagendado
                                </Badge>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {quote.originalDate && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                        <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Histórico de Agendamento
                        </h4>
                        <div className="text-sm text-amber-900 space-y-1">
                            <p><span className="font-semibold">Data Original:</span> {format(parseISO(quote.originalDate), "dd/MM/yyyy")} {quote.originalTime && `às ${quote.originalTime}`}</p>
                            {quote.reschedules && quote.reschedules.length > 0 && (
                                <div className="mt-2 space-y-2">
                                    <p className="font-semibold text-xs opacity-80">Reagendamentos:</p>
                                    {quote.reschedules.map((res, idx) => (
                                        <div key={idx} className="bg-amber-100/50 p-2 rounded-lg text-xs">
                                            <p className="font-semibold">{format(parseISO(res.newDate), "dd/MM/yyyy")} às {res.newTime}</p>
                                            <p className="italic opacity-80">Motivo: {res.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> 
                    <p>{client.street}, {client.number} - {client.neighborhood}, {client.city}/{client.state}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <User className="h-4 w-4 shrink-0" /> 
                    <p className="font-semibold text-foreground">{client.name}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground ml-6">
                    {client.phone && client.phone !== 'N/A' && (
                        <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            <a href={`tel:${client.phone.replace(/\D/g, '')}`} className="hover:text-primary transition-colors font-medium text-foreground">
                                {client.phone}
                            </a>
                        </div>
                    )}
                    {(client.whatsapp || (client.phone && client.phone !== 'N/A')) && (
                        <div className="flex items-center gap-1.5 text-green-600 font-semibold">
                            <Smartphone className="h-3.5 w-3.5" />
                            <a 
                                href={`https://wa.me/55${(client.whatsapp || client.phone!).replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:underline"
                            >
                                WhatsApp: {client.whatsapp || client.phone}
                            </a>
                        </div>
                    )}
                </div>
                {quote.schedulingNotes && (
                  <div className="border-l-4 border-primary pl-3 text-sm mt-4">
                    <p className="font-semibold text-foreground">Descrição dos Serviços:</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{quote.schedulingNotes}</p>
                  </div>
                )}
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList /> Itens e Serviços</CardTitle></CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-16 text-center h-[34px]">Qtd.</TableHead>
                                <TableHead>Descrição</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quote.items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="py-0 text-center font-medium">{formatQuantity(item.quantity)}</TableCell>
                                    <TableCell>{item.product?.description || (item as any).description || (item as any).productDescription || "Descrição não disponível"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader><CardTitle className="text-base">Relatório de Serviço e Fotos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <label htmlFor="service-report" className="text-sm font-medium">Relatório Técnico</label>
                    <Textarea id="service-report" placeholder="Descreva o serviço executado, problemas encontrados, soluções aplicadas, etc." value={serviceReport} onChange={e => setServiceReport(e.target.value)} rows={6} className="mt-1" />
                </div>
                <div>
                     <label className="text-sm font-medium">Anexar Fotos</label>
                     <div className="flex items-center gap-4 mt-1">
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden"/>
                        <input type="file" ref={cameraInputRef} onChange={handleImageUpload} accept="image/*" capture="environment" className="hidden"/>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="sm" disabled={isUploading}>
                                    {isUploading ? <Loader2 className="animate-spin mr-2"/> : <Upload className="mr-2"/>}
                                    {isUploading ? "Enviando..." : "Adicionar Foto"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                                    <Camera className="mr-2 h-4 w-4"/>
                                    Câmera
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                    <ImageIcon className="mr-2 h-4 w-4"/>
                                    Arquivo
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                     <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {attachments.map(url => (
                            <div key={url} className="relative aspect-square group">
                                <Image src={url} alt="anexo" layout="fill" objectFit="cover" className="rounded-md"/>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => confirmDeletePhoto(url)}>
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <Separator />
        
        <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarClock/> Manutenção Preventiva</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Agendar Manutenção Preventiva?</Label>
                        <p className="text-sm text-muted-foreground">
                            Marque se este serviço exige um retorno futuro para revisão.
                        </p>
                    </div>
                    <Switch
                        checked={requiresPreventive}
                        onCheckedChange={setRequiresPreventive}
                    />
                </div>
                {requiresPreventive && (
                    <div className="flex flex-col space-y-2 max-w-sm">
                        <Label>Frequência (Meses)</Label>
                        <Select value={preventiveFrequency} onValueChange={setPreventiveFrequency}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a frequência" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 mês</SelectItem>
                                <SelectItem value="2">2 meses</SelectItem>
                                <SelectItem value="3">3 meses</SelectItem>
                                <SelectItem value="4">4 meses</SelectItem>
                                <SelectItem value="6">6 meses</SelectItem>
                                <SelectItem value="12">1 ano (12 meses)</SelectItem>
                                <SelectItem value="24">2 anos (24 meses)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </CardContent>
        </Card>

        <Separator />
        
         <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><PackageCheck/>Confirmação de Materiais</CardTitle>
                <CardDescription>O material utilizado foi o mesmo do orçamento inicial?</CardDescription>
            </CardHeader>
            <CardContent>
                <RadioGroup 
                    value={materialConfirmation} 
                    onValueChange={(value) => setMaterialConfirmation(value as 'yes' | 'no')}
                    className="flex flex-col sm:flex-row gap-4"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="mat-yes" />
                        <Label htmlFor="mat-yes" className="cursor-pointer">Sim, material usado conforme o previsto</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="mat-no" />
                        <Label htmlFor="mat-no" className="cursor-pointer">Não, houve alteração de material</Label>
                    </div>
                </RadioGroup>
                {materialConfirmation === 'no' && (
                    <div className="mt-4">
                        <Label htmlFor="material-discrepancy" className="font-semibold text-destructive">Descreva as alterações (obrigatório)</Label>
                        <Textarea
                            id="material-discrepancy"
                            value={materialDiscrepancyNotes}
                            onChange={(e) => setMaterialDiscrepancyNotes(e.target.value)}
                            placeholder="Ex: Adicionado 1 conector extra. Removido 2 metros de cabo."
                            className="mt-2"
                        />
                    </div>
                )}
            </CardContent>
        </Card>

        
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
            <AlertDialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isSaving} className="border-amber-500 text-amber-600 hover:bg-amber-50">
                        <CalendarClock className="mr-2 h-4 w-4" /> Reagendar O.S.
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reagendar Ordem de Serviço</AlertDialogTitle>
                        <AlertDialogDescription>
                            Escolha a nova data e hora e justifique o motivo do reagendamento.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nova Data</Label>
                                <Popover open={isRescheduleCalendarOpen} onOpenChange={setRescheduleCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !rescheduleDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {rescheduleDate ? format(rescheduleDate, "PPP", { locale: ptBR }) : <span>Selecionar...</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={rescheduleDate}
                                            onSelect={(d) => { setRescheduleDate(d); setRescheduleCalendarOpen(false); }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label>Nova Hora</Label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="time" 
                                        className="pl-9" 
                                        value={rescheduleTime} 
                                        onChange={e => setRescheduleTime(e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Motivo (Obrigatório)</Label>
                            <Textarea 
                                placeholder="Descreva por que o serviço não pôde ser executado agora..." 
                                value={rescheduleReason}
                                onChange={e => setRescheduleReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRescheduleOS} disabled={isSaving || !rescheduleDate || !rescheduleTime || !rescheduleReason.trim()} className="bg-amber-600 hover:bg-amber-700">
                             {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isReturnDialogOpen} onOpenChange={setReturnDialogOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSaving}><AlertTriangle className="mr-2"/> Devolver O.S.</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Devolver Ordem de Serviço?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação marcará a O.S. como **Devolvida** e a liberará da sua lista de tarefas. Por favor, detalhe o motivo abaixo.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea 
                        placeholder="Ex: Cliente não estava no local, faltou material, etc." 
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                    />
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReturnOS} disabled={!returnReason.trim() || isSaving}>
                         {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Devolução
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {quote.status !== 'Finalizado' && (
                <Button onClick={handleSaveProgress} disabled={isSaving} variant="outline" className="border-primary text-primary hover:bg-primary/10 shadow-sm bg-background">
                    {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Progresso
                </Button>
            )}
            <Button onClick={handleFinishOS} disabled={isSaving} className="bg-green-600 hover:bg-green-700 shadow-md">
                {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                {quote.status === 'Finalizado' ? 'Salvar Alterações da O.S.' : 'Finalizar Serviço'}
            </Button>
        </div>

        <AlertDialog open={isPhotoAlertOpen} onOpenChange={setPhotoAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Remover Foto?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Tem certeza que deseja remover esta evidência fotográfica? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeletePhoto} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirmar Exclusão
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  );
}
