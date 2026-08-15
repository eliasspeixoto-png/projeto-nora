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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, Tag, CalendarRange, User, ClipboardList, Save } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserProfile, Quote } from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";

const formSchema = z.object({
  date: z.date({ required_error: "A data de início é obrigatória." }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:mm)."),
  expectedEndDate: z.date().optional(),
  expectedEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:mm).").optional(),
  unitIdentifier: z.string().optional(),
  notes: z.string().optional(),
  technicianId: z.string().optional(),
});

type ScheduleServiceDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onSchedule: (data: {
    date: string;
    time: string;
    expectedEndDate?: string;
    expectedEndTime?: string;
    unitIdentifier?: string;
    notes?: string;
    technicianId?: string;
  }) => void;
  quoteNumber: string;
  teamMembers: UserProfile[];
  currentTechnicianId?: string;
};

export default function ScheduleServiceDialog({
  isOpen,
  setOpen,
  onSchedule,
  quoteNumber,
  teamMembers,
  currentTechnicianId,
}: ScheduleServiceDialogProps) {
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setEndCalendarOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      time: "09:00",
      expectedEndTime: "18:00",
      notes: "",
      technicianId: "none",
      unitIdentifier: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        date: new Date(),
        time: "09:00",
        expectedEndTime: "18:00",
        notes: "",
        technicianId: currentTechnicianId || "none",
        unitIdentifier: "",
      });
    }
  }, [isOpen, currentTechnicianId, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onSchedule({
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
      expectedEndDate: values.expectedEndDate ? format(values.expectedEndDate, "yyyy-MM-dd") : undefined,
      technicianId: values.technicianId === "none" ? undefined : values.technicianId,
      unitIdentifier: values.unitIdentifier?.trim() || undefined,
    });
    form.reset();
  };

  const technicians = teamMembers
    .filter((m) => ["admin", "supervisor", "tecnico"].includes(m.role))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setOpen(open); if (!open) form.reset(); }}>
      <DialogContent className="sm:max-w-md h-auto max-h-[92vh] flex flex-col p-0 bg-background sm:rounded-2xl shadow-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.04] border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CalendarRange className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Agendar e Atribuir Serviço
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Defina o cronograma e responsável para a O.S. <strong>{quoteNumber}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 px-6 overflow-y-auto custom-scrollbar flex-1">
            <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-xs text-foreground/80">
                    <User className="h-3.5 w-3.5 text-primary" /> Atribuir Técnico
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs font-semibold">
                        <SelectValue placeholder="Selecione um técnico..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Não atribuído</SelectItem>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.uid} value={tech.uid} className="text-xs font-medium">
                          {tech.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unitIdentifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-xs text-foreground/80">
                    <Tag className="h-3.5 w-3.5 text-primary" /> Placa / TAG / Unidade
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Placa ABC-1234, Caminhão 01, Apto 101..." {...field} className="h-9 text-xs font-semibold" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/40">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-1.5 font-semibold text-xs text-foreground/80">
                      <CalendarIcon className="h-3.5 w-3.5 text-primary" /> Início do Atendimento
                    </FormLabel>
                    <Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full h-9 pl-3 text-left font-medium text-xs",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Escolha a data</span>}
                            <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          locale={ptBR}
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 font-semibold text-xs text-foreground/80">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Horário Previsto
                    </FormLabel>
                    <FormControl>
                      <Input type="time" {...field} className="h-9 text-xs font-semibold" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
              <FormField
                control={form.control}
                name="expectedEndDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-1.5 font-semibold text-xs text-blue-700 dark:text-blue-400">
                      <CalendarRange className="h-3.5 w-3.5" /> Previsão de Término
                    </FormLabel>
                    <Popover open={isEndCalendarOpen} onOpenChange={setEndCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full h-9 pl-3 text-left font-medium text-xs",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Definir prazo</span>}
                            <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          locale={ptBR}
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setEndCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expectedEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 font-semibold text-xs text-blue-700 dark:text-blue-400">
                      <Clock className="h-3.5 w-3.5" /> Hora Término
                    </FormLabel>
                    <FormControl>
                      <Input type="time" {...field} className="h-9 text-xs font-semibold" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-xs text-foreground/80">
                    <ClipboardList className="h-3.5 w-3.5 text-primary" /> Instruções de Serviço
                  </FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva os serviços a serem executados..." rows={2} {...field} spellCheck className="text-xs" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="p-4 pt-2 bg-muted/30 border-t border-border/40 -mx-6 -mb-4 flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-9 text-xs font-semibold">
                Cancelar
              </Button>
              <Button type="submit" className="h-9 px-6 font-bold text-xs bg-primary text-white shadow-md">
                <Save className="mr-2 h-4 w-4" />
                Efetivar Agendamento
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
