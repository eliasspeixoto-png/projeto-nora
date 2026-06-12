"use client";

import { useMemo } from "react";
import { 
  Bell, 
  MapPin, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  HardHat,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";

interface ActivityItem {
  id: string;
  type: "os" | "visit" | "payment";
  title: string;
  description: string;
  time: string;
  status: string;
}

interface OperationalIntelligenceProps {
  activities: ActivityItem[];
  onlineTeam: any[];
  alerts: { type: "stock" | "overdue"; message: string; count: number }[];
}

export default function OperationalIntelligence({ 
  activities, 
  onlineTeam, 
  alerts 
}: OperationalIntelligenceProps) {
  const router = useRouter();
  
  const formatTime = (timeStr: string) => {
    try {
      const date = parseISO(timeStr);
      if (!isValid(date)) return "Recentemente";
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch {
      return "Agora";
    }
  };

  const formatDateTime = (timeStr: string) => {
    try {
      const date = parseISO(timeStr);
      if (!isValid(date)) return "Recém logado";
      return format(date, "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return "Logado";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Atividade Recente (Feed) */}
      <motion.div 
        className="lg:col-span-1"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="h-[260px] border-border/40 bg-background/50 backdrop-blur-sm shadow-premium flex flex-col">
          <CardHeader className="py-2.5 px-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-4">
              <div className="space-y-3 pb-3 pt-2">
                {activities.length > 0 ? activities.map((activity, idx) => (
                  <div 
                    key={activity.id} 
                    className={cn(
                      "relative ml-4 pl-6 pb-3 border-l last:pb-0 last:border-l-0 border-border/40 transition-colors rounded-r-lg group",
                      (activity.type === 'os' || activity.type === 'visit') && "cursor-pointer hover:bg-muted/30"
                    )}
                    onClick={() => {
                        if (activity.type === 'os') {
                            router.push(`/orcamentos/details/${activity.id}`);
                        } else if (activity.type === 'visit') {
                            router.push(`/visitas`);
                        }
                    }}
                  >
                    <div className="absolute left-[-5.5px] top-0 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-primary shrink-0">
                          {activity.type === 'os' ? 'O.S.' : activity.type === 'visit' ? 'Visita' : 'Fin.'}
                        </span>
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                          {formatTime(activity.time)}
                        </span>
                      </div>
                      <p className="text-xs font-semibold leading-tight text-foreground/90 break-words whitespace-normal">{activity.title}</p>
                      <p className="text-[10px] text-muted-foreground leading-snug break-words whitespace-normal">{activity.description}</p>
                    </div>
                  </div>
                )) : (
                   <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground opacity-50">
                      <Clock className="h-8 w-8 mb-1" />
                      <p className="text-[10px]">Sem atividades recentes.</p>
                   </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* 2. Status da Equipe (Live Pulse) */}
      <motion.div 
        className="lg:col-span-1"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card className="h-[260px] border-border/40 bg-background/50 backdrop-blur-sm shadow-premium flex flex-col">
          <CardHeader className="py-2.5 px-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <HardHat className="h-4 w-4 text-primary" />
              Equipe de Campo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
             <ScrollArea className="h-full px-4">
                <div className="space-y-2 pb-3">
                  {onlineTeam.length > 0 ? onlineTeam.map((tech) => (
                    <div key={tech.uid} className="flex items-center justify-between p-2 rounded-xl border border-border/40 bg-primary/5 hover:bg-primary/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="relative">

                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
                        </div>
                        <div className="space-y-0 min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground/90 leading-tight">{tech.nome}</p>
                          <p className="text-[9px] font-semibold text-emerald-600">Ativo agora</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-semibold text-muted-foreground block">
                            {formatDateTime(tech.ultima_atualizacao)}
                        </span>
                      </div>
                    </div>
                  )) : (
                     <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground opacity-50">
                        <User className="h-8 w-8 mb-1" />
                        <p className="text-[10px]">Nenhum técnico online.</p>
                     </div>
                  )}
                </div>
             </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* 3. Inteligência Operacional & Alertas */}
      <motion.div 
        className="lg:col-span-1"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card className="h-[260px] border-border/40 bg-background/50 backdrop-blur-sm shadow-premium flex flex-col overflow-hidden">
          <CardHeader className="py-2 px-4 bg-rose-500/5">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-4 w-4" />
              Risco & Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-3.5 space-y-3">
             {alerts.map((alert, idx) => (
               <div key={idx} className={cn(
                 "p-3 rounded-xl border border-border/40 bg-primary/5 hover:bg-primary/10 transition-all flex gap-3 group/alert",
                 alert.type === 'overdue' ? "border-l-rose-500/50" : "border-l-amber-500/50"
               )}>
                 <div className={cn(
                   "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover/alert:scale-110",
                   alert.type === 'overdue' ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"
                 )}>
                   {alert.type === 'overdue' ? <Clock className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                 </div>
                 <div className="space-y-0.5 min-w-0">
                   <p className="text-xs font-semibold leading-tight truncate">{alert.message}</p>
                   <p className="text-[10px] text-muted-foreground line-clamp-1">
                     {alert.count} {alert.type === 'overdue' ? 'pendentes' : 'atingiram o mínimo'}.
                   </p>
                   <button className="text-[9px] uppercase font-semibold flex items-center gap-1 pt-0.5 text-primary opacity-60 hover:opacity-100 transition-opacity">
                     Visualizar agora <ArrowRight className="h-2 w-2" />
                   </button>
                 </div>
               </div>
             ))}

             {alerts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-emerald-600 opacity-60 text-center">
                   <CheckCircle2 className="h-10 w-10 mb-2" />
                   <p className="text-sm font-semibold uppercase tracking-wider">Tudo sob controle!</p>
                   <p className="text-xs">Não encontramos gargalos operacionais no momento.</p>
                </div>
             )}

             <div className="mt-auto p-2.5 rounded-xl bg-primary/5 border border-border/40 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                   <HardHat className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                   <p className="text-[10px] font-semibold leading-none">Insight do Gestor</p>
                   <p className="text-[9px] text-muted-foreground line-clamp-2 mt-1">
                     O volume de serviços aumentou 15% esta semana. Recomenda-se conferir o estoque.
                   </p>
                </div>
             </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
