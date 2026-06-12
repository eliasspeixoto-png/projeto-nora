
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
import { CalendarIcon, Clock } from "lucide-react";
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

  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minuteOptions = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setOpen(open); if(!open) form.reset(); }}>
      <DialogContent className="sm:max-w-[425px] sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Agendar e Atribuir Serviço</DialogTitle>
          <DialogDescription>
            Defina a data, hora e técnico para a O.S. <strong>{quoteNumber}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atribuir para</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um técnico..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Selecione o técnico</SelectItem>
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
                  <FormLabel>Data</FormLabel>
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
              render={({ field }) => {
                const value = field.value || "09:00";
                const [h, m] = value.split(':');
                return (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground"/> Hora</FormLabel>
                        <div className="flex items-center gap-2">
                            <Select 
                                onValueChange={(hour) => field.onChange(`${hour}:${m}`)}
                                value={h}
                            >
                                <FormControl>
                                    <SelectTrigger className="w-full font-semibold">
                                        <SelectValue placeholder="HH" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-[200px]">
                                    {hourOptions.map((hour) => (
                                        <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="font-semibold">:</span>
                            <Select 
                                onValueChange={(minute) => field.onChange(`${h}:${minute}`)}
                                value={m}
                            >
                                <FormControl>
                                    <SelectTrigger className="w-full font-semibold">
                                        <SelectValue placeholder="MM" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-[200px]">
                                    {minuteOptions.map((minute) => (
                                        <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <FormMessage />
                    </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas do Agendamento (Descrição dos Serviços)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva os serviços a serem executados... Ex: Verificar barulho no motor do portão." {...field} spellCheck />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Confirmar Agendamento</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
