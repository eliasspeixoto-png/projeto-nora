

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
import { CalendarIcon, User, Clock, ClipboardList, Save } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserProfile } from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";

const formSchema = z.object({
  date: z.date({ required_error: "A data é obrigatória." }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:mm)."),
  notes: z.string().optional(),
  technicianId: z.string().optional(),
});

type ScheduleServiceDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onSchedule: (data: { date: string, time: string, notes?: string, technicianId?: string }) => void;
  quoteNumber: string;
  teamMembers: UserProfile[];
  currentTechnicianId?: string;
};

export default function ScheduleServiceDialog({ isOpen, setOpen, onSchedule, quoteNumber, teamMembers, currentTechnicianId }: ScheduleServiceDialogProps) {
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      time: "09:00",
      notes: "",
      technicianId: "none",
    },
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({
            date: new Date(),
            time: "09:00",
            notes: "",
            technicianId: currentTechnicianId || "none",
        })
    }
  }, [isOpen, currentTechnicianId, form])

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onSchedule({
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
      technicianId: values.technicianId === 'none' ? undefined : values.technicianId,
    });
    form.reset();
  };
  
  const technicians = teamMembers.filter(m => ['admin', 'supervisor', 'tecnico'].includes(m.role)).sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md h-auto max-h-[90vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border-border/40 shadow-2xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.03] border-b border-border/40">
          <div className="flex items-center gap-4">
               <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                    Agendar Serviço
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground italic">
                    Defina o cronograma para a O.S. <strong>{quoteNumber}</strong>.
                </DialogDescription>
              </div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 px-6">
             <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <User className="h-4 w-4" /> Atribuir Responsável
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um técnico..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Selecione o tecnico</SelectItem>
                      {technicians.map(tech => (
                        <SelectItem key={tech.uid} value={tech.uid}>{tech.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <CalendarIcon className="h-4 w-4" /> Data do Atendimento
                  </FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
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
                            <span>Escolha uma data</span>
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
                  <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <Clock className="h-4 w-4" /> Horário Previsto
                  </FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-semibold text-primary/80 mb-2">
                    <ClipboardList className="h-4 w-4" /> Instruções de Serviço
                  </FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva os serviços a serem executados... Ex: Verificar barulho no motor do portão." {...field} spellCheck />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border/40 backdrop-blur-md">
              <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 sm:flex-none px-8 font-semibold shadow-lg shadow-primary/20">
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
