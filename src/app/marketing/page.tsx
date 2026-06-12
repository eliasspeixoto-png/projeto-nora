"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/firebase/auth/use-user';
import { addCommunication, getCommunications, updateCommunication, deleteCommunication, getClientsOnce } from '@/lib/firebase/firestore';
import type { Communication, Client } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Megaphone, Send, History, Upload, ImageIcon, Gift, MoreHorizontal, Edit, Trash2, XCircle, Calendar as CalendarIcon, Mail, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { sendMarketingEmailAction } from '@/app/actions/email-actions';

const communicationSchema = z.object({
  title: z.string().min(5, "O título deve ter pelo menos 5 caracteres."),
  message: z.string().min(20, "A mensagem deve ter pelo menos 20 caracteres."),
  targetAudience: z.enum(['all', 'comodato', 'non-comodato']),
  type: z.enum(['comunicado', 'promocao']),
  expiresAt: z.date().optional(),
  sendByEmail: z.boolean().default(false),
});

type CommunicationFormData = z.infer<typeof communicationSchema>;

const formatDate = (dateString?: any) => {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
        const date = parseISO(dateString);
        if (!isValid(date)) return 'Data inválida';
        return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
        return 'Data inválida';
    }
};

const formatExpiryDate = (dateString?: any) => {
    if (!dateString || typeof dateString !== 'string') return 'Sem validade';
    try {
        const date = parseISO(dateString);
        if (!isValid(date)) return 'Data inválida';
        return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (e) {
        return 'Data inválida';
    }
};

export default function MarketingPage() {
  const { userProfile, firebase, company } = useAuth();
  const { toast } = useToast();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [editingComm, setEditingComm] = useState<Communication | null>(null);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAlertOpen, setAlertOpen] = useState(false);
  const [commToDelete, setCommToDelete] = useState<string | null>(null);
  const [isCalendarOpen, setCalendarOpen] = useState(false);

  const form = useForm<CommunicationFormData>({
    resolver: zodResolver(communicationSchema),
    defaultValues: {
      title: "",
      message: "",
      targetAudience: "all",
      type: "comunicado",
      sendByEmail: false,
    },
  });

  useEffect(() => {
    if (userProfile?.companyId && firebase.db) {
      const unsub = getCommunications(firebase.db, userProfile.companyId, (data) => {
        setCommunications(data);
        setIsLoading(false);
      }, (error) => {
        toast({ variant: 'destructive', title: 'Erro ao carregar comunicados', description: error.message });
        setIsLoading(false);
      });

      getClientsOnce(firebase.db, userProfile.companyId).then(setClients);

      return () => unsub();
    } else {
        setIsLoading(false);
    }
  }, [userProfile, firebase.db, toast]);

  const handleEdit = (comm: Communication) => {
    setEditingComm(comm);
    form.reset({
      title: comm.title,
      message: comm.message,
      targetAudience: comm.targetAudience,
      type: comm.type,
      expiresAt: (comm.expiresAt && typeof comm.expiresAt === 'string') ? parseISO(comm.expiresAt) : undefined,
      sendByEmail: false, 
    });
    setImagePreview(comm.imageUrl || null);
    setImageFile(null);
  };

  const cancelEditing = () => {
    setEditingComm(null);
    form.reset({ title: "", message: "", targetAudience: "all", type: "comunicado", expiresAt: undefined, sendByEmail: false });
    setImagePreview(null);
    setImageFile(null);
  };
  
  const confirmDelete = (id: string) => {
    setCommToDelete(id);
    setAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!commToDelete || !firebase.db) return;
    try {
        await deleteCommunication(firebase.db, commToDelete);
        toast({ title: "Sucesso!", description: "A mensagem foi excluída."});
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Erro ao Excluir", description: error.message });
    } finally {
        setAlertOpen(false);
        setCommToDelete(null);
    }
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }
  };

  const onSubmit = async (values: CommunicationFormData) => {
    if (!userProfile?.companyId || !userProfile.displayName || !firebase) return;
    setIsSending(true);

    try {
      let imageUrl: string | null = editingComm?.imageUrl || null;

      if (imageFile) {
        const { storage } = firebase;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(imageFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });

        const filePath = `communications/${userProfile.companyId}/${Date.now()}-${imageFile.name}`;
        const storageRef = ref(storage, filePath);

        await uploadString(storageRef, dataUrl, 'data_url');
        imageUrl = await getDownloadURL(storageRef);
      }
      
      const dataToSave = {
        ...values,
        imageUrl: imageUrl,
        expiresAt: values.expiresAt ? format(values.expiresAt, "yyyy-MM-dd") : undefined,
      };

      if (editingComm) {
        await updateCommunication(firebase.db, editingComm.id, dataToSave);
        toast({ title: 'Mensagem Atualizada!', description: 'Suas alterações foram salvas.' });
      } else {
        await addCommunication(firebase.db, {
          ...dataToSave,
          companyId: userProfile.companyId,
          sentBy: userProfile.displayName,
        });

        if (values.sendByEmail) {
            const targetClients = clients.filter(c => {
                if (values.targetAudience === 'all') return !!c.email;
                if (values.targetAudience === 'comodato') return c.isComodato && !!c.email;
                if (values.targetAudience === 'non-comodato') return !c.isComodato && !!c.email;
                return false;
            });

            let sentCount = 0;
            for (const client of targetClients) {
                try {
                    await sendMarketingEmailAction({
                        to: client.email,
                        subject: values.title,
                        content: values.message
                    });
                    sentCount++;
                } catch (e) {
                    console.error(`Falha ao enviar e-mail para ${client.email}:`, e);
                }
            }
            toast({ title: "E-mails Enviados", description: `${sentCount} clientes receberão este comunicado.` });
        }

        toast({ title: 'Mensagem Enviada!', description: 'Sua mensagem foi registrada no sistema.' });
      }

      cancelEditing();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: error.message });
    } finally {
      setIsSending(false);
    }
  };
  
  const sortedCommunications = useMemo(() => {
    return [...communications].sort((a, b) => {
        const dateA = a.sentAt && typeof a.sentAt === 'string' ? parseISO(a.sentAt).getTime() : 0;
        const dateB = b.sentAt && typeof b.sentAt === 'string' ? parseISO(b.sentAt).getTime() : 0;
        return dateB - dateA;
    });
  }, [communications]);

  return (
    <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
      <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-8">
        <div className="space-y-1">
          <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
            <Megaphone className="text-primary h-8 w-8" />
            Marketing & Comunicação
          </h1>

        </div>
      </header>

      <main className="px-4 md:px-8 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium border border-border/40 p-8 md:p-10 space-y-8">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight opacity-80">
                {editingComm ? 'Refinar Campanha' : 'Nova Composição'}
              </h2>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">
                {editingComm ? 'Ajuste os parâmetros da mensagem selecionada' : 'Desenvolva mensagens, promoções ou comunicados oficiais'}
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-1">Natureza do Conteúdo</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex gap-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0 bg-background/50 p-3 rounded-xl border border-border/40 flex-1 cursor-pointer hover:bg-primary/5 transition-colors">
                            <FormControl><RadioGroupItem value="comunicado" /></FormControl>
                            <FormLabel className="font-semibold uppercase text-[10px] tracking-widest flex items-center gap-2 cursor-pointer opacity-70">
                              <Megaphone className="h-4 w-4 text-primary"/>Comunicado
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0 bg-background/50 p-3 rounded-xl border border-border/40 flex-1 cursor-pointer hover:bg-primary/5 transition-colors">
                            <FormControl><RadioGroupItem value="promocao" /></FormControl>
                            <FormLabel className="font-semibold uppercase text-[10px] tracking-widest flex items-center gap-2 cursor-pointer opacity-70">
                              <Gift className="h-4 w-4 text-primary"/>Promoção
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="targetAudience"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-1">Público-Alvo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold focus:ring-primary shadow-sm px-6">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-2xl border-border/40 bg-background/90 backdrop-blur-3xl shadow-premium">
                            <SelectItem value="all" className="h-11 rounded-xl font-semibold ml-1 mr-1">Todos os Clientes</SelectItem>
                            <SelectItem value="comodato" className="h-11 rounded-xl font-semibold ml-1 mr-1 text-primary">Apenas Comodato</SelectItem>
                            <SelectItem value="non-comodato" className="h-11 rounded-xl font-semibold ml-1 mr-1">Sem Comodato</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="expiresAt"
                    render={({ field }) => (
                      <FormItem className="space-y-4 flex flex-col">
                        <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-1">Validade (Opcional)</FormLabel>
                        <Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "h-14 rounded-2xl bg-background/50 border-border/40 font-semibold shadow-sm px-6 text-left",
                                  !field.value && "text-muted-foreground opacity-40"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                ) : (
                                  <span className="uppercase text-[10px] tracking-widest font-semibold">Indeterminada</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-30" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-[2rem] border-border/40 bg-background/90 backdrop-blur-3xl shadow-premium overflow-hidden" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                  field.onChange(date);
                                  setCalendarOpen(false);
                              }}
                              className="p-4"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-1">Manchete / Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: CONDIÇÕES EXCLUSIVAS DE ABRIL" {...field} className="h-14 rounded-2xl bg-background/50 border-border/40 font-semibold uppercase focus:ring-primary shadow-sm px-6 tracking-tight" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                   control={form.control}
                   name="message"
                   render={({ field }) => (
                     <FormItem className="space-y-4">
                       <FormLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-1">Conteúdo da Mensagem</FormLabel>
                       <FormControl>
                         <Textarea placeholder="Descreva os detalhes da oferta ou comunicado..." {...field} className="min-h-[160px] rounded-[1.5rem] bg-background/50 border-border/40 font-semibold focus:ring-primary shadow-sm p-6 resize-none leading-relaxed" />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                <div className="space-y-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 ml-1">Material Visual</div>
                  <div className="flex items-center gap-6 p-4 rounded-2xl bg-primary/5 border border-border/40">
                      <div className="relative w-24 h-24 rounded-2xl border-2 border-background shadow-lg overflow-hidden bg-background/50 flex items-center justify-center shrink-0">
                          {imagePreview ? (
                            <Image src={imagePreview} alt="Preview" fill className="object-cover" sizes="96px" />
                          ) : (
                            <ImageIcon className="h-10 w-10 text-primary/20" />
                          )}
                      </div>
                      <div className="flex flex-col gap-3">
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                        <Button type="button" variant="outline" className="h-10 rounded-xl font-semibold uppercase text-[10px] tracking-widest border-border/40 hover:bg-primary/5 transition-all shadow-sm" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
                            <Upload className="mr-2 h-4 w-4"/> Carregar Imagem
                        </Button>
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest opacity-40">Resolução recomendada: 1200x630px</p>
                      </div>
                  </div>
                </div>

                {!editingComm && (
                    <FormField
                        control={form.control}
                        name="sendByEmail"
                        render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-border/40 p-5 bg-primary/5 transition-all hover:bg-primary/10 shadow-sm">
                            <div className="space-y-1">
                                <FormLabel className="flex items-center gap-2 font-semibold uppercase text-[10px] tracking-widest text-primary/70">
                                    <Mail className="h-4 w-4" />
                                    Multicanal: E-mail Marketing
                                </FormLabel>
                                <FormDescription className="text-[9px] font-semibold uppercase opacity-50">Disparar conteúdo para o e-mail cadastrado dos clientes</FormDescription>
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
                )}

                <div className="flex gap-4 pt-4">
                    <Button 
                      type="submit" 
                      disabled={isSending}
                      className="h-16 flex-1 rounded-[1.5rem] bg-primary text-white font-semibold uppercase tracking-[0.2em] shadow-premium transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                        {isSending ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Send className="mr-3 h-5 w-5" />}
                        {editingComm ? 'Salvar Edição' : 'Disparar Campanha'}
                    </Button>
                    {editingComm && (
                        <Button variant="outline" onClick={cancelEditing} className="h-16 px-10 rounded-[1.5rem] font-semibold uppercase text-[10px] tracking-widest border-border/40">
                            Cancelar
                        </Button>
                    )}
                </div>
              </form>
            </Form>
          </div>

          <div className="space-y-8">
            <div className="bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium border border-border/40 overflow-hidden">
                <div className="p-8 border-b border-border/40 bg-primary/5">
                  <div className="flex items-center gap-3">
                    <History className="text-primary h-5 w-5" />
                    <h2 className="text-xl font-semibold tracking-tight opacity-80">Audit de Campanhas</h2>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60 mt-1">Status e histórico de engajamento</p>
                </div>
                
                <div className="p-0">
                    {isLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 opacity-40">
                          <Loader2 className="h-10 w-10 animate-spin text-primary" />
                          <span className="text-[10px] font-semibold uppercase tracking-widest">Sincronizando histórico...</span>
                        </div>
                    ) : sortedCommunications.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 opacity-20 px-10 text-center">
                          <Megaphone className="h-12 w-12" />
                          <span className="text-[10px] font-semibold uppercase tracking-widest leading-relaxed">Nenhuma campanha orquestrada até o momento</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-primary/5">
                            {sortedCommunications.map(comm => (
                                <div key={comm.id} className="group p-8 transition-all hover:bg-primary/5 duration-500 overflow-hidden relative">
                                    <div className="absolute top-0 right-0 h-full w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-500" />
                                    
                                    <div className="flex justify-between items-start gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {comm.type === 'promocao' ? 
                                                        <Badge className="h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest bg-green-500 text-white shadow-lg shadow-green-500/20 border-none transition-transform group-hover:scale-105 active:scale-95">
                                                          <Gift className="mr-1.5 h-3 w-3"/>PROMOÇÃO
                                                        </Badge> : 
                                                        <Badge className="h-6 px-3 rounded-full font-semibold text-[9px] uppercase tracking-widest bg-blue-500 text-white shadow-lg shadow-blue-500/20 border-none transition-transform group-hover:scale-105 active:scale-95">
                                                          <Megaphone className="mr-1.5 h-3 w-3"/>COMUNICADO
                                                        </Badge>
                                                    }
                                                    <span className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-40">Ref: #{comm.id.slice(-6).toUpperCase()}</span>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-primary/10 transition-all text-foreground">
                                                            <MoreHorizontal className="h-5 w-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium w-56">
                                                        <DropdownMenuItem className="h-11 rounded-xl font-semibold cursor-pointer" onClick={() => handleEdit(comm)}>
                                                            <Edit className="mr-2 h-4 w-4 opacity-40"/> Editar Conteúdo
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="h-11 rounded-xl font-semibold cursor-pointer text-destructive" onClick={() => confirmDelete(comm.id)}>
                                                            <Trash2 className="mr-2 h-4 w-4 opacity-40"/> Excluir Registro
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <h3 className="text-base font-semibold uppercase tracking-tight opacity-80 leading-none">{comm.title}</h3>
                                            <p className="text-[13px] font-semibold text-foreground/70 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-700 whitespace-pre-wrap">{comm.message}</p>
                                            
                                            <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-border/40">
                                                <div className="flex flex-wrap items-center justify-between gap-4">
                                                  <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em] opacity-30">Status de Transmissão</span>
                                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/60">{formatDate(comm.sentAt)}</span>
                                                  </div>
                                                  {comm.expiresAt && (
                                                    <div className="flex flex-col gap-1 items-end">
                                                      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-destructive opacity-40">Encerramento da Oferta</span>
                                                      <span className="text-[10px] font-semibold uppercase tracking-widest text-destructive">{formatExpiryDate(comm.expiresAt)}</span>
                                                    </div>
                                                  )}
                                                </div>
                                                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.2em] opacity-40 italic mt-1">Autorizado por: {comm.sentBy}</p>
                                            </div>
                                        </div>
                                         {comm.imageUrl && (
                                            <div className="relative w-20 h-20 md:w-32 md:h-32 rounded-3xl overflow-hidden shrink-0 shadow-2xl group-hover:scale-110 transition-transform duration-700 border-4 border-background bg-background/50">
                                                <Image src={comm.imageUrl} alt={comm.title} fill className="object-cover" sizes="128px" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      </main>

      <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent className="bg-background border border-border/40 rounded-[2.5rem] shadow-2xl p-8">
              <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-semibold uppercase tracking-tighter">Excluir Campanha?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-semibold opacity-60">
                      Esta ação removerá permanentemente o comunicado do sistema. Clientes não poderão mais visualizar este informe no portal.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-8 gap-3">
                  <AlertDialogCancel className="h-12 px-6 rounded-2xl font-semibold uppercase text-[10px] tracking-widest">Manter Registro</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="h-12 px-8 rounded-2xl bg-destructive text-white font-semibold uppercase text-[10px] tracking-widest shadow-lg shadow-destructive/20 transition-all hover:scale-105 active:scale-95">Confirmar Exclusão</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
